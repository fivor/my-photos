import { Env } from '../types';
import { jsonResponse, errorResponse } from '../utils/response';
import { createToken, verifyToken } from '../utils/auth';
import * as db from '../utils/db';
import { checkRateLimit, recordLoginAttempt, sendVerificationCode, verifyCode } from '../utils/security';

export async function handleAuthRoutes(request: Request, env: Env, path: string): Promise<Response | null> {
    // Auth Route
    if (path === '/api/auth/login' && request.method === 'POST') {
      try {
        const { password, role } = await request.json() as { password: string, role: string };
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        
        // 1. Check Rate Limit
        const { blocked, remaining } = await checkRateLimit(env, ip);
        if (blocked) {
            return errorResponse(`Too many failed attempts. Please try again in ${Math.ceil((remaining || 0) / 60)} minutes.`, 429);
        }

        let valid = false;
        let visitorId = '';
        let allowedFolders: string[] = [];

        if (role === 'admin') {
          // Check DB config for password first
          const config = await db.getConfig(env);
          const dbPwd = config['admin_password'];
          
          if (dbPwd) {
              valid = password === dbPwd;
          } else {
              // Fallback to Env
              const adminPwd = env.ADMIN_PASSWORD;
              valid = password === (adminPwd || 'admin');
          }
        } else if (role === 'visitor') {
          // Check global visitor password first (backward compatibility or simple mode)
          if (env.VISITOR_PASSWORD && password === env.VISITOR_PASSWORD) {
             valid = true;
          }
          
          if (!valid) {
             const visitor = await db.getVisitorByPassword(env, password);
             if (visitor) {
                 valid = true;
                 visitorId = visitor.id;
                 allowedFolders = visitor.allowedFolders || [];
             }
          }
        } else {
          return errorResponse('Invalid role');
        }

        // 2. Record Attempt
        await recordLoginAttempt(env, ip, valid);

        if (!valid) {
          return errorResponse('Invalid password', 401);
        }

        const tokenPayload: any = { role };
        if (role === 'visitor') {
           tokenPayload.visitorId = visitorId;
           tokenPayload.allowedFolders = allowedFolders;
        }

        const token = await createToken(tokenPayload, env);
        return jsonResponse({ 
          token, 
          role,
          visitorId: role === 'visitor' ? visitorId : undefined,
          allowedFolders: role === 'visitor' ? allowedFolders : undefined,
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000 
        });
      } catch (e) {
        return errorResponse('Invalid request body');
      }
    }

    // Auth: Bind Email (Admin Only)
    if (path === '/api/auth/bind-email' && request.method === 'POST') {
       const user = await verifyToken(request, env);
       if (!user || user.role !== 'admin') return errorResponse('Forbidden', 403);
       
       try {
           const { email } = await request.json() as { email: string };
           if (!email || !email.includes('@')) return errorResponse('Invalid email');
           
           await db.updateConfig(env, { admin_email: email });
           return jsonResponse({ success: true });
       } catch (e) {
           return errorResponse('Failed to bind email');
       }
    }

    // Auth: Send Verification Code
    if (path === '/api/auth/send-code' && request.method === 'POST') {
       try {
           const { email } = await request.json() as { email: string };
           
           // Check if this is the admin email
           const config = await db.getConfig(env);
           const boundEmail = (config['admin_email'] || '').trim().toLowerCase();
           const requestEmail = email.trim().toLowerCase();
           
           if (boundEmail !== requestEmail) {
               return jsonResponse({ 
                   success: false, 
                   error: 'Email mismatch', 
                   debug: { 
                       received: requestEmail, 
                       stored: boundEmail
                   } 
               });
           }
           
           const { code, emailSent, error } = await sendVerificationCode(env, email);
           
           if (!emailSent) {
               return jsonResponse({ 
                   success: false, 
                   error: error || 'Failed to send email', 
                   debug_code: code 
               });
           }
           
           return jsonResponse({ success: true }); 
       } catch (e: any) {
           return errorResponse(e.message || 'Failed to send code');
       }
    }
    
    // Auth: Verify Code Only (New Endpoint for Multi-step security)
    if (path === '/api/auth/verify-code' && request.method === 'POST') {
        // Can be public but rate limited ideally. For now open.
        try {
            const { email, code } = await request.json() as { email: string, code: string };
            const isValid = await verifyCode(env, email, code);
            return jsonResponse({ valid: isValid });
        } catch (e) {
            return errorResponse('Verification failed');
        }
    }

    // Auth: Verify and Change Password
    if (path === '/api/auth/verify-and-change-password' && request.method === 'POST') {
        const user = await verifyToken(request, env);
        if (!user || user.role !== 'admin') return errorResponse('Forbidden', 403);

        try {
            const { email, code, newPassword } = await request.json() as any;
            
            // Verify
            const isValid = await verifyCode(env, email, code);
            if (!isValid) return errorResponse('Invalid or expired code', 400);
            
            // Change Password
            await db.updateConfig(env, { admin_password: newPassword });
            
            return jsonResponse({ success: true });
        } catch (e) {
            return errorResponse('Failed to change password');
        }
    }

    // Auth Status Route
    if (path === '/api/auth/status' && request.method === 'GET') {
       const user = await verifyToken(request, env);
       if (!user) return errorResponse('Unauthorized', 401);

       if (user.role === 'visitor' && user.visitorId) {
          const currentVisitor = await db.getVisitor(env, user.visitorId);
          if (currentVisitor) {
             return jsonResponse({
               role: 'visitor',
               visitorId: user.visitorId,
               allowedFolders: currentVisitor.allowedFolders || []
             });
          }
       }
       return jsonResponse(user);
    }

    return null;
}
