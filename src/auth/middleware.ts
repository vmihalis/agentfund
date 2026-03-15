/**
 * Auth middleware for Express.
 *
 * Validates Bearer token from Authorization header.
 * Attaches user to req.user on success, returns 401 on failure.
 */

import type { Request, Response, NextFunction } from 'express';
import type { UserStore, UserPublic } from './user-store.js';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: UserPublic;
    }
  }
}

/**
 * Create auth middleware that validates tokens against the UserStore.
 */
export function createAuthMiddleware(userStore: UserStore) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required. Send Authorization: Bearer <token>' });
      return;
    }

    const token = authHeader.slice(7);
    const user = userStore.validateToken(token);

    if (!user) {
      res.status(401).json({ error: 'Invalid or expired token. Please login again.' });
      return;
    }

    req.user = user;
    next();
  };
}
