import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, profiles } from '../db/schema.js';
import { env } from '../env.js';
import { AppError } from '../utils/AppError.js';
import { requireAuth } from '../middleware/auth.js';
import type { JwtPayload } from '../middleware/auth.js';

const router = Router();

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  jobRole: z.string().optional(),
  experienceLevel: z.enum(['junior', 'mid', 'senior']).optional(),
  onboardingComplete: z.boolean().optional(),
});

// ─── Cookie helpers ───────────────────────────────────────────────────────────

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env['NODE_ENV'] === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

function signTokens(userId: string, email: string): {
  accessToken: string;
  refreshToken: string;
} {
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = { userId, email };

  const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

  return { accessToken, refreshToken };
}

function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
): void {
  // Access token — short-lived (e.g. 15m)
  res.cookie('accessToken', accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: 15 * 60 * 1000, // 15 minutes in ms
  });

  // Refresh token — long-lived (e.g. 7d)
  res.cookie('refreshToken', refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  });
}

// ─── POST /signup ─────────────────────────────────────────────────────────────

router.post(
  '/signup',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = signupSchema.parse(req.body);

      // Check for existing email
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, body.email.toLowerCase()));

      if (existing) {
        throw AppError.conflict('An account with this email already exists');
      }

      // Hash password
      const password_hash = await bcrypt.hash(body.password, 10);

      // Insert user
      const [user] = await db
        .insert(users)
        .values({
          email: body.email.toLowerCase(),
          name: body.name.trim(),
          password_hash,
        })
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
        });

      if (!user) {
        throw AppError.internal('Failed to create user');
      }

      // Insert blank profile
      const [profile] = await db
        .insert(profiles)
        .values({
          user_id: user.id,
          job_role: '',
          experience_level: 'junior',
        })
        .returning();

      // Sign tokens & set cookies
      const { accessToken, refreshToken } = signTokens(user.id, user.email);
      setAuthCookies(res, accessToken, refreshToken);

      res.status(201).json({
        status: 'success',
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            jobRole: profile.job_role,
            experienceLevel: profile.experience_level,
            onboardingComplete: profile.job_role !== '',
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /login ──────────────────────────────────────────────────────────────

router.post(
  '/login',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = loginSchema.parse(req.body);

      // Find user and profile
      const [record] = await db
        .select({ user: users, profile: profiles })
        .from(users)
        .leftJoin(profiles, eq(users.id, profiles.user_id))
        .where(eq(users.email, body.email.toLowerCase()));

      if (!record || !record.user) {
        // Generic message to avoid user enumeration
        throw AppError.unauthorized('Invalid email or password');
      }

      const { user, profile } = record;

      // Compare password
      const isValid = await bcrypt.compare(body.password, user.password_hash);
      if (!isValid) {
        throw AppError.unauthorized('Invalid email or password');
      }

      // Sign tokens & set cookies
      const { accessToken, refreshToken } = signTokens(user.id, user.email);
      setAuthCookies(res, accessToken, refreshToken);

      res.status(200).json({
        status: 'success',
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            jobRole: profile?.job_role ?? '',
            experienceLevel: profile?.experience_level ?? 'junior',
            onboardingComplete: !!(profile && profile.job_role !== ''),
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /me ──────────────────────────────────────────────────────────────────

router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const [record] = await db
      .select({ user: users, profile: profiles })
      .from(users)
      .leftJoin(profiles, eq(users.id, profiles.user_id))
      .where(eq(users.id, userId));

    if (!record || !record.user) {
      throw AppError.unauthorized('User not found');
    }

    const { user, profile } = record;

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          jobRole: profile?.job_role ?? '',
          experienceLevel: profile?.experience_level ?? 'junior',
          onboardingComplete: !!(profile && profile.job_role !== ''),
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /profile ───────────────────────────────────────────────────────────

router.patch('/profile', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const body = updateProfileSchema.parse(req.body);

    if (body.name) {
      await db.update(users).set({ name: body.name }).where(eq(users.id, userId));
    }

    if (body.jobRole !== undefined || body.experienceLevel !== undefined) {
      await db
        .update(profiles)
        .set({
          ...(body.jobRole !== undefined ? { job_role: body.jobRole } : {}),
          ...(body.experienceLevel !== undefined ? { experience_level: body.experienceLevel } : {}),
        })
        .where(eq(profiles.user_id, userId));
    }

    // Return the updated profile
    const [record] = await db
      .select({ user: users, profile: profiles })
      .from(users)
      .leftJoin(profiles, eq(users.id, profiles.user_id))
      .where(eq(users.id, userId));

    if (!record || !record.user) {
      throw AppError.unauthorized('User not found after update');
    }

    const { user, profile } = record;

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          jobRole: profile?.job_role ?? '',
          experienceLevel: profile?.experience_level ?? 'junior',
          onboardingComplete: !!(profile && profile.job_role !== ''),
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /refresh ────────────────────────────────────────────────────────────

router.post(
  '/refresh',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token: string | undefined = req.cookies['refreshToken'] as
        | string
        | undefined;

      if (!token) {
        throw AppError.unauthorized('Refresh token missing');
      }

      let decoded: JwtPayload;
      try {
        decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
      } catch {
        throw AppError.unauthorized('Invalid or expired refresh token');
      }

      // Verify user still exists
      const [user] = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.id, decoded.userId));

      if (!user) {
        throw AppError.unauthorized('User no longer exists');
      }

      // Issue new access token only
      const newAccessToken = jwt.sign(
        { userId: user.id, email: user.email },
        env.JWT_ACCESS_SECRET,
        {
          expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
        },
      );

      res.cookie('accessToken', newAccessToken, {
        ...COOKIE_OPTIONS,
        maxAge: 15 * 60 * 1000,
      });

      res.status(200).json({ status: 'success', message: 'Token refreshed' });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /logout ─────────────────────────────────────────────────────────────

router.post('/logout', (_req: Request, res: Response) => {
  const clearOptions = {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  };

  res.clearCookie('accessToken', clearOptions);
  res.clearCookie('refreshToken', clearOptions);

  res.status(200).json({ status: 'success', message: 'Logged out' });
});

export default router;
