import { Env } from '../types';

export async function checkRateLimit(env: Env, ip: string): Promise<{ blocked: boolean, remaining?: number }> {
    const now = Date.now();
    
    // Check if blocked
    const record: any = await env.DB.prepare('SELECT * FROM login_attempts WHERE ip = ?').bind(ip).first();
    
    if (record) {
        if (record.blocked_until && record.blocked_until > now) {
            return { blocked: true, remaining: Math.ceil((record.blocked_until - now) / 1000) };
        }
        
        // If block expired, reset?
        if (record.blocked_until && record.blocked_until <= now) {
             await env.DB.prepare('UPDATE login_attempts SET attempts = 0, blocked_until = NULL WHERE ip = ?').bind(ip).run();
             return { blocked: false };
        }
    }
    
    return { blocked: false };
}

export async function recordLoginAttempt(env: Env, ip: string, success: boolean) {
    const now = Date.now();
    
    if (success) {
        // Reset on success
        await env.DB.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run();
    } else {
        // Increment failure
        const record: any = await env.DB.prepare('SELECT * FROM login_attempts WHERE ip = ?').bind(ip).first();
        
        if (record) {
            const newAttempts = record.attempts + 1;
            if (newAttempts >= 3) {
                // Block for 10 minutes
                const blockUntil = now + 10 * 60 * 1000;
                await env.DB.prepare('UPDATE login_attempts SET attempts = ?, last_attempt = ?, blocked_until = ? WHERE ip = ?')
                    .bind(newAttempts, now, blockUntil, ip)
                    .run();
            } else {
                await env.DB.prepare('UPDATE login_attempts SET attempts = ?, last_attempt = ? WHERE ip = ?')
                    .bind(newAttempts, now, ip)
                    .run();
            }
        } else {
            await env.DB.prepare('INSERT INTO login_attempts (ip, attempts, last_attempt) VALUES (?, 1, ?)')
                .bind(ip, now)
                .run();
        }
    }
}

export async function sendVerificationCode(env: Env, email: string): Promise<{ code: string, emailSent: boolean, error?: string }> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 mins
    
    // Store code
    await env.DB.prepare('INSERT OR REPLACE INTO verification_codes (email, code, expires_at) VALUES (?, ?, ?)')
        .bind(email, code, expiresAt)
        .run();
        
    let emailSent = false;
    let errorMsg: string | undefined;

    if (email.includes('@')) {
        // 1. Try Resend if configured (Recommended)
        if (env.RESEND_API_KEY) {
            try {
                const resendResp = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        from: 'Photo Gallery <no-reply@fivor.de>', // Ensure domain is verified in Resend
                        to: [email],
                        subject: 'Your Verification Code',
                        html: `<p>Your verification code is: <strong>${code}</strong></p><p>It expires in 10 minutes.</p>`
                    })
                });
                
                if (resendResp.ok) {
                    emailSent = true;
                    console.log(`[EMAIL] Sent via Resend to ${email}`);
                } else {
                    const errorText = await resendResp.text();
                    console.error('Resend Error:', errorText);
                    errorMsg = `Resend Error: ${resendResp.status} - ${errorText}`;
                }
            } catch (e: any) {
                console.error('Resend Failed', e);
                errorMsg = `Resend Failed: ${e.message}`;
            }
        } 
        
        // 2. Fallback to MailChannels (if Resend not configured or failed?) 
        // For now, let's only use MailChannels if Resend is NOT configured to avoid double sending logic complexity
        else {
            try {
                const sendRequest = new Request('https://api.mailchannels.net/tx/v1/send', {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                    },
                    body: JSON.stringify({
                        personalizations: [
                            {
                                to: [{ email: email, name: "Admin" }],
                            },
                        ],
                        from: {
                            email: "no-reply@fivor.de",
                            name: "Photo Gallery Security",
                        },
                        subject: "Your Verification Code",
                        content: [
                            {
                                type: "text/plain",
                                value: `Your verification code is: ${code}\n\nIt expires in 10 minutes.`,
                            },
                        ],
                    }),
                });
                
                const resp = await fetch(sendRequest);
                
                if (!resp.ok) {
                    const errorText = await resp.text();
                    console.error('MailChannels Error:', errorText);
                    errorMsg = `Email Service Error: ${resp.status} - ${errorText.substring(0, 100)}`;
                } else {
                    emailSent = true;
                }
            } catch (e: any) {
                console.error('Email Send Failed', e);
                errorMsg = `Failed to send email: ${e.message}`;
            }
        }
    } else {
        errorMsg = 'Invalid email format';
    }
    
    console.log(`[EMAIL] To: ${email}, Code: ${code}, Sent: ${emailSent}`);
    
    return { code, emailSent, error: errorMsg };
}

export async function verifyCode(env: Env, email: string, code: string): Promise<boolean> {
    const record: any = await env.DB.prepare('SELECT * FROM verification_codes WHERE email = ?').bind(email).first();
    
    if (!record) return false;
    if (record.code !== code) return false;
    if (record.expires_at < Date.now()) return false;
    
    // Delete after use
    await env.DB.prepare('DELETE FROM verification_codes WHERE email = ?').bind(email).run();
    
    return true;
}
