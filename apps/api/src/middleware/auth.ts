import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env.js';
import { AppError } from '../utils/AppError.js';

export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

// Augment Express Request to carry the decoded JWT user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  try {
    const token: string | undefined = req.cookies['accessToken'] as
      | string
      | undefined;

    if (!token) {
      throw AppError.unauthorized('Access token missing');
    }

    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;

    if (!decoded.userId || !decoded.email) {
      throw AppError.unauthorized('Invalid token payload');
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    };

    next();
  } catch (err) {
    if (err instanceof AppError) {
      next(err);
      return;
    }

    if (err instanceof jwt.TokenExpiredError) {
      next(AppError.unauthorized('Access token has expired'));
      return;
    }

    if (err instanceof jwt.JsonWebTokenError) {
      next(AppError.unauthorized('Invalid access token'));
      return;
    }

    next(AppError.unauthorized('Authentication failed'));
  }
}
