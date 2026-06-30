import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, profiles } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import {
  getUserSessions,
  getSessionById,
  createSession,
  endSession,
  generateLiveKitToken,
} from '../services/sessionService.js';
import { generateReport } from '../services/reportService.js';
import pino from 'pino';

const logger = pino({ name: 'sessions-route' });
const router = Router();

// All sessions routes require authentication
router.use(requireAuth);

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const interviewTypeSchema = z.object({
  interviewType: z.enum(['behavioral', 'technical', 'system_design', 'hr'], {
    errorMap: () => ({
      message:
        "interviewType must be one of: 'behavioral', 'technical', 'system_design', 'hr'",
    }),
  }),
});

// ─── GET / — list user's sessions ────────────────────────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const sessions = await getUserSessions(userId);

    res.status(200).json({
      status: 'success',
      data: { sessions },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST / — create a new session ───────────────────────────────────────────

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { interviewType } = interviewTypeSchema.parse(req.body);

    // Fetch user name and profile for LiveKit room metadata
    const [record] = await db
      .select({ user: users, profile: profiles })
      .from(users)
      .leftJoin(profiles, eq(users.id, profiles.user_id))
      .where(eq(users.id, userId));

    const candidateProfile = {
      name: record?.user?.name ?? 'Candidate',
      jobRole: record?.profile?.job_role ?? '',
      experienceLevel: (record?.profile?.experience_level ?? 'junior') as 'junior' | 'mid' | 'senior',
    };

    const session = await createSession(userId, interviewType, candidateProfile);

    res.status(201).json({
      status: 'success',
      data: { session },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /:id — get single session ───────────────────────────────────────────

router.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      const session = await getSessionById(id!, userId);

      res.status(200).json({
        status: 'success',
        data: { session },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── PATCH /:id/end — mark session complete and fire report generation ────────

router.patch(
  '/:id/end',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      const session = await endSession(id!, userId);

      // Fire and forget — do NOT await; report generates in background
      generateReport(session.id).catch((err: unknown) => {
        logger.error(
          { err, sessionId: session.id },
          'Background report generation failed',
        );
      });

      res.status(200).json({
        status: 'success',
        data: { session },
        message: 'Session ended. Report is being generated.',
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /:id/token — get LiveKit room token ──────────────────────────────────

router.get(
  '/:id/token',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      const { token, wsUrl } = await generateLiveKitToken(id!, userId);

      res.status(200).json({
        status: 'success',
        data: { token, wsUrl },
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
