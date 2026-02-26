import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../../utils/errors';
import { env, DESKTOP_MODE } from '../../config/env';
import { getPrismaClient } from '../../config/database';

export interface AuthPayload {
  userId: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

// Cached desktop user payload (avoids DB lookup on every request)
let _desktopUser: AuthPayload | null = null;

/**
 * JWT authentication middleware.
 * In desktop mode: auto-authenticates as the local user if no token is provided.
 * In web mode: requires a valid Bearer token.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7);
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
      req.user = payload;
      next();
      return;
    } catch {
      if (!DESKTOP_MODE) {
        throw new UnauthorizedError('Invalid or expired token');
      }
      // In desktop mode, fall through to auto-auth
    }
  }

  // Desktop mode: allow requests without Authorization header
  if (DESKTOP_MODE) {
    autoAuthDesktop(req)
      .then(() => next())
      .catch(() => next(new UnauthorizedError('Desktop auto-login failed')));
    return;
  }

  throw new UnauthorizedError('Missing or invalid Authorization header');
}

/**
 * Auto-authenticate as the desktop local user.
 */
async function autoAuthDesktop(req: Request): Promise<void> {
  if (_desktopUser) {
    req.user = _desktopUser;
    return;
  }

  const db = getPrismaClient();
  const user = await db.user.findFirst();
  if (!user) {
    throw new UnauthorizedError('No desktop user found');
  }

  _desktopUser = { userId: user.id, email: user.email };
  req.user = _desktopUser;
}

/**
 * Generate a JWT token for the given user.
 */
export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as string,
  } as jwt.SignOptions);
}
