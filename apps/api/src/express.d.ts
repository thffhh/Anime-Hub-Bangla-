import 'express';
import type { Role } from './auth.js';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        role: Role;
        email: string;
      };
    }
  }
}

export {};
