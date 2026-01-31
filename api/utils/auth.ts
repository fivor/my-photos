import { SignJWT, jwtVerify } from 'jose';
import { Env } from '../types';

export async function createToken(payload: any, env: Env) {
  const secret = new TextEncoder().encode(env.JWT_SECRET || 'dev-secret');
  // If payload is just a string (backward compatibility), wrap it
  const jwtPayload = typeof payload === 'string' ? { role: payload } : payload;
  
  return await new SignJWT(jwtPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifyToken(request: Request, env: Env): Promise<any | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1];
  const secret = new TextEncoder().encode(env.JWT_SECRET || 'dev-secret');
  
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (e) {
    return null;
  }
}
