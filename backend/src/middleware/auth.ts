import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../lib/auth';

export interface AuthedUser {
  id: string;
  role: 'STUDENT' | 'COOK';
  name: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Authorization header. Send: Authorization: Bearer <token>' });
    return;
  }
  const payload = verifyToken(h.slice(7).trim());
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token.' });
    return;
  }
  req.user = { id: payload.sub, role: payload.role, name: payload.name, email: payload.email };
  next();
}

export function requireRole(...roles: Array<'STUDENT' | 'COOK'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden: your role cannot perform this action.' });
      return;
    }
    next();
  };
}