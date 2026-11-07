import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'CONTENT_MANAGER' | 'ADVERTISEMENT_MANAGER' | 'COLLABORATION_MANAGER' | 'MODERATOR' | 'ANALYST' | 'USER';
export interface AuthRequest extends Request { auth?: { userId: string; role: Role; email: string } }

const secret = () => {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters');
  return value;
};

export function signToken(payload: { userId: string; role: Role; email: string }) {
  return jwt.sign(payload, secret(), { expiresIn: '8h', issuer: 'anime-hub-bangla' });
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
    const decoded = jwt.verify(header.slice(7), secret(), { issuer: 'anime-hub-bangla' }) as jwt.JwtPayload;
    if (!decoded.userId || !decoded.role || !decoded.email) return res.status(401).json({ error: 'Invalid session' });
    if (!pool) return res.status(503).json({ error: 'Database not configured' });
    const result = await pool.query('SELECT id, role, status FROM users WHERE id=$1', [decoded.userId]);
    const user = result.rows[0];
    if (!user || user.status !== 'ACTIVE' || user.role !== decoded.role) return res.status(401).json({ error: 'Session expired or account changed' });
    req.auth = { userId: user.id, role: user.role, email: decoded.email };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

export async function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return next();
    const decoded = jwt.verify(header.slice(7), secret(), { issuer: 'anime-hub-bangla' }) as jwt.JwtPayload;
    if (!decoded.userId || !decoded.role || !decoded.email || !pool) return res.status(401).json({ error: 'Invalid session' });
    const result = await pool.query('SELECT id, role, status FROM users WHERE id=$1', [decoded.userId]);
    const user = result.rows[0];
    if (!user || user.status !== 'ACTIVE' || user.role !== decoded.role) return res.status(401).json({ error: 'Session expired or account changed' });
    req.auth = { userId: user.id, role: user.role, email: decoded.email };
    next();
  } catch { return res.status(401).json({ error: 'Invalid or expired session' }); }
}

export function requireRoles(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
}
