import { SignJWT, jwtVerify } from 'jose';
import { Env } from '../types';

export async function createToken(role: 'admin' | 'visitor', env: Env) {
  const secret = new TextEncoder().encode(env.JWT_SECRET || 'dev-secret');
  return await new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifyToken(request: Request, env: Env): Promise<{ role: string } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  const secret = new TextEncoder().encode(env.JWT_SECRET || 'dev-secret');
  
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as { role: string };
  } catch (e) {
    return null;
  }
}
