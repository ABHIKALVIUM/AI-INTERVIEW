import { Router, Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { reports, sessions } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../utils/AppError.js';

const router = Router();

// All report routes require authentication
router.use(requireAuth);

// ─── GET /:sessionId — fetch report for a session ────────────────────────────

router.get(
  '/:sessionId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user!.userId;

      // Verify session exists and user owns it
      const [session] = await db
        .select({ id: sessions.id, user_id: sessions.user_id })
        .from(sessions)
        .where(eq(sessions.id, sessionId!));

      if (!session) {
        throw AppError.notFound('Session not found');
      }

      if (session.user_id !== userId) {
        throw AppError.forbidden('You do not have access to this session');
      }

      // Fetch report
      const [report] = await db
        .select()
        .from(reports)
        .where(eq(reports.session_id, sessionId!));

      if (!report) {
        throw AppError.notFound(
          'Report not yet generated. Please check back in a moment.',
        );
      }

      res.status(200).json({
        status: 'success',
        data: { report },
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
