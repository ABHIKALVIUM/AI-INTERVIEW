import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import jwt from 'jsonwebtoken';
import pino from 'pino';
import { AppError } from '../utils/AppError.js';

const logger = pino({
  name: 'error-handler',
  level: process.env['NODE_ENV'] === 'production' ? 'warn' : 'debug',
});

interface ErrorResponse {
  status: 'error' | 'fail';
  message: string;
  errors?: Record<string, string>[];
  code?: string;
}

// Central Express error handler — must have 4 params for Express to recognize it
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const isProduction = process.env['NODE_ENV'] === 'production';

  // ── ZodError ──────────────────────────────────────────────────────────────
  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    const body: ErrorResponse = {
      status: 'fail',
      message: 'Validation error',
      errors,
    };

    res.status(400).json(body);
    return;
  }

  // ── JWT errors ─────────────────────────────────────────────────────────────
  if (err instanceof jwt.TokenExpiredError) {
    res.status(401).json({
      status: 'fail',
      message: 'Token has expired',
      code: 'TOKEN_EXPIRED',
    } satisfies ErrorResponse);
    return;
  }

  if (err instanceof jwt.JsonWebTokenError) {
    res.status(401).json({
      status: 'fail',
      message: 'Invalid token',
      code: 'INVALID_TOKEN',
    } satisfies ErrorResponse);
    return;
  }

  // ── AppError ───────────────────────────────────────────────────────────────
  if (err instanceof AppError) {
    if (!err.isOperational || err.statusCode >= 500) {
      logger.error(
        { err, url: req.url, method: req.method },
        'Operational 5xx error',
      );
    }

    res.status(err.statusCode).json({
      status: err.statusCode >= 500 ? 'error' : 'fail',
      message: isProduction && err.statusCode >= 500
        ? 'An unexpected error occurred'
        : err.message,
    } satisfies ErrorResponse);
    return;
  }

  // ── Unknown / unhandled errors ─────────────────────────────────────────────
  logger.error(
    { err, url: req.url, method: req.method },
    'Unhandled error reached error handler',
  );

  res.status(500).json({
    status: 'error',
    message: isProduction
      ? 'An unexpected error occurred'
      : err instanceof Error
        ? err.message
        : 'Unknown error',
  } satisfies ErrorResponse);
}
