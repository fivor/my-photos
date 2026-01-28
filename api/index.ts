import { Env } from './types';
import { handleOptions, corsHeaders, jsonResponse, errorResponse } from './utils/response';
import { createToken, verifyToken } from './utils/auth';
import { getMetadata, saveMetadata } from './utils/storage';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle CORS
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    // Auth Route
    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      try {
        const { password, role } = await request.json() as { password: string, role: string };
        
        let valid = false;
        if (role === 'admin') {
          valid = password === (env.ADMIN_PASSWORD || 'admin');
        } else if (role === 'visitor') {
          valid = password === (env.VISITOR_PASSWORD || 'visitor');
        } else {
          return errorResponse('Invalid role');
        }

        if (!valid) {
          return errorResponse('Invalid password', 401);
        }

        const token = await createToken(role as 'admin' | 'visitor', env);
        return jsonResponse({ 
          token, 
          role, 
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000 
        });
      } catch (e) {
        return errorResponse('Invalid request body');
      }
    }

    // Protected Routes Middleware
    const user = await verifyToken(request, env);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    // Data Route
    if (url.pathname === '/api/data') {
      if (request.method === 'GET') {
        const metadata = await getMetadata(env);
        return jsonResponse(metadata);
      }
      
      if (request.method === 'POST') {
        if (user.role !== 'admin') {
          return errorResponse('Forbidden', 403);
        }
        
        try {
          const { action, data } = await request.json() as { action: string, data: any };
          const metadata = await getMetadata(env);
          
          if (action === 'update_photos') {
             const photo = data;
             const index = metadata.photos.findIndex(p => p.id === photo.id);
             if (index >= 0) {
               metadata.photos[index] = { ...metadata.photos[index], ...photo };
             } else {
               metadata.photos.unshift(photo);
             }
          } else if (action === 'add_folder') {
             metadata.folders.push(data);
          } else if (action === 'delete_photo') {
             metadata.photos = metadata.photos.filter(p => p.id !== data.id);
          }
          
          await saveMetadata(env, metadata);
          return jsonResponse({ success: true });
        } catch (e) {
          return errorResponse('Invalid request');
        }
      }
    }

    // Upload URL Route
    if (url.pathname === '/api/upload-url' && request.method === 'POST') {
      if (user.role !== 'admin') {
        return errorResponse('Forbidden', 403);
      }
      
      try {
        const { filename, folder } = await request.json() as { filename: string, folder: string };
        const id = crypto.randomUUID();
        const key = `photos/${id}-${filename}`;
        
        // Using Worker as proxy for upload to avoid S3 SDK complexity in this demo
        const uploadUrl = `/api/upload-file?key=${encodeURIComponent(key)}`;
        
        // Determine public URL (assuming public bucket access)
        // In real scenario, user needs to configure their custom domain or R2.dev subdomain
        const publicDomain = 'https://r2.example.com'; 
        const publicUrl = `${publicDomain}/${key}`;

        return jsonResponse({
          uploadUrl,
          photoId: id,
          publicUrl,
          key
        });
      } catch (e) {
        return errorResponse('Invalid request');
      }
    }

    // Actual Upload Handler (Proxy)
    if (url.pathname === '/api/upload-file' && request.method === 'PUT') {
       if (user.role !== 'admin') {
         return errorResponse('Forbidden', 403);
       }
       const key = url.searchParams.get('key');
       if (!key) return errorResponse('Missing key');
       
       await env.BUCKET.put(key, request.body);
       return jsonResponse({ success: true });
    }

    return errorResponse('Not Found', 404);
  }
};
