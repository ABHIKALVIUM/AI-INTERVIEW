import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { transcripts, sessions, profiles, users } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../utils/AppError.js';
import { runIntro, runGraph } from '../graph/index.js';
import { initSession, getSession } from '../store/sessionStore.js';
import type { InterviewType } from '../graph/state.js';

const router = Router();
router.use(requireAuth);

const chatSchema = z.object({
  sessionId: z.string().uuid(),
  userMessage: z.string().min(1).max(5000),
});

const startSchema = z.object({
  sessionId: z.string().uuid(),
});

async function loadSessionState(sessionId: string, userId: string) {
  let state = getSession(sessionId);
  if (state) return state;

  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
  if (!session) throw AppError.notFound('Session not found');
  if (session.user_id !== userId) throw AppError.forbidden('Access denied');

  const [record] = await db
    .select({ user: users, profile: profiles })
    .from(users)
    .leftJoin(profiles, eq(users.id, profiles.user_id))
    .where(eq(users.id, userId));

  const candidateName = record?.user?.name ?? 'Candidate';
  const jobRole = record?.profile?.job_role ?? '';
  const experienceLevel = record?.profile?.experience_level ?? 'mid';

  // Initialize in-memory state
  state = initSession(sessionId, {
    userId,
    interviewType: session.interview_type as InterviewType,
    candidateProfile: { name: candidateName, jobRole, experienceLevel },
    targetQuestions: 5,
  });

  // Rehydrate history from DB
  const history = await db
    .select()
    .from(transcripts)
    .where(eq(transcripts.session_id, sessionId))
    .orderBy(asc(transcripts.sequence_number));

  for (const turn of history) {
    state.messages.push({
      role: turn.speaker === 'ai' ? 'ai' : 'candidate',
      content: turn.content,
      timestamp: turn.timestamp.getTime(),
    });
    if (turn.speaker === 'ai') state.questionsAsked++;
  }
  
  if (state.questionsAsked >= state.targetQuestions) {
    state.stage = 'done';
  } else if (state.questionsAsked > 0) {
    state.stage = 'questioning'; 
  }

  return state;
}

router.post('/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = startSchema.parse(req.body);
    const userId = req.user!.userId;

    const state = await loadSessionState(sessionId, userId);

    if (state.messages.length > 0) {
      const lastAi = state.messages.filter(m => m.role === 'ai').pop();
      return res.status(200).json({
        status: 'success',
        data: { aiText: lastAi?.content ?? 'Welcome back! Please continue.' },
      });
    }

    const aiText = await runIntro(sessionId);

    await db.insert(transcripts).values({
      session_id: sessionId,
      speaker: 'ai',
      content: aiText,
      timestamp: new Date(),
      sequence_number: 1,
    });

    return res.status(200).json({ status: 'success', data: { aiText } });
  } catch (err) {
    return next(err);
  }
});

router.post('/chat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId, userMessage } = chatSchema.parse(req.body);
    const userId = req.user!.userId;

    const state = await loadSessionState(sessionId, userId);
    
    if (state.stage === 'done') {
      return res.status(200).json({ status: 'success', data: { aiText: '', done: true } });
    }

    const nextSeqBase = state.messages.length + 1;

    await db.insert(transcripts).values({
      session_id: sessionId,
      speaker: 'candidate',
      content: userMessage,
      timestamp: new Date(),
      sequence_number: nextSeqBase,
    });

    const aiText = await runGraph(sessionId, userMessage);
    const updatedState = getSession(sessionId)!;

    await db.insert(transcripts).values({
      session_id: sessionId,
      speaker: 'ai',
      content: aiText,
      timestamp: new Date(),
      sequence_number: nextSeqBase + 1,
    });

    return res.status(200).json({
      status: 'success',
      data: { aiText, done: updatedState.stage === 'done' },
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
