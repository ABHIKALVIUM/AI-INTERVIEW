import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, max } from 'drizzle-orm';
import { db } from '../db/index.js';
import { transcripts, sessions } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../utils/AppError.js';

const router = Router();

// All transcript routes require authentication
router.use(requireAuth);

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const createTranscriptSchema = z.object({
  speaker: z.enum(['ai', 'candidate'], {
    errorMap: () => ({ message: "speaker must be 'ai' or 'candidate'" }),
  }),
  content: z.string().min(1, 'Content cannot be empty').max(10000),
  timestamp: z.string().datetime({ message: 'timestamp must be an ISO 8601 datetime string' }),
});

// ─── POST /:sessionId — add a transcript entry ────────────────────────────────

router.post(
  '/:sessionId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user!.userId;

      // Validate body
      const body = createTranscriptSchema.parse(req.body);

      // Verify session exists and belongs to user
      const [session] = await db
        .select({ id: sessions.id, user_id: sessions.user_id })
        .from(sessions)
        .where(eq(sessions.id, sessionId!));

      if (!session) {
        throw AppError.notFound('Session not found');
      }

      if (session.user_id !== userId) {
        throw AppError.forbidden(
          'You do not have access to this session',
        );
      }

      // Get next sequence number
      const [seqRow] = await db
        .select({ maxSeq: max(transcripts.sequence_number) })
        .from(transcripts)
        .where(eq(transcripts.session_id, sessionId!));

      const nextSeq = (seqRow?.maxSeq ?? -1) + 1;

      // Insert transcript
      const [transcript] = await db
        .insert(transcripts)
        .values({
          session_id: sessionId!,
          speaker: body.speaker,
          content: body.content,
          timestamp: new Date(body.timestamp),
          sequence_number: nextSeq,
        })
        .returning();

      if (!transcript) {
        throw AppError.internal('Failed to save transcript');
      }

      res.status(201).json({
        status: 'success',
        data: { transcript },
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
