import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'mealbuddy-dev-only-change-me';
const EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

export interface TokenPayload {
  sub: string;
  role: 'STUDENT' | 'COOK';
  name: string;
  email: string;
}

export function signToken(p: TokenPayload): string {
  return jwt.sign(p, SECRET, { expiresIn: EXPIRES } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const d = jwt.verify(token, SECRET) as jwt.JwtPayload & TokenPayload;
    if (!d?.sub || !d?.role) return null;
    return { sub: String(d.sub), role: d.role === 'COOK' ? 'COOK' : 'STUDENT', name: d.name ?? '', email: d.email ?? '' };
  } catch {
    return null;
  }
}

export function authSecretConfigured(): boolean {
  return Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16);
}