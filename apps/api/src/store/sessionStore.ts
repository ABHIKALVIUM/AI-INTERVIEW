import type { InterviewState, InterviewType, CandidateProfile } from '../graph/state.js';
import { logger } from '../utils/logger.js';

export interface SessionConfig {
  userId: string;
  interviewType: InterviewType;
  candidateProfile: CandidateProfile;
  targetQuestions: number;
  maxDurationMs?: number;
}

const DEFAULT_MAX_DURATION_MS = 45 * 60 * 1000; // 45 minutes

// ─── In-memory session store ──────────────────────────────────────────────────

const sessions = new Map<string, InterviewState>();

// ─── Public API ───────────────────────────────────────────────────────────────

export function initSession(
  sessionId: string,
  config: SessionConfig
): InterviewState {
  if (sessions.has(sessionId)) {
    logger.warn({ sessionId }, 'sessionStore: session already exists, re-initializing');
  }

  const state: InterviewState = {
    sessionId,
    userId: config.userId,
    interviewType: config.interviewType,
    candidateProfile: config.candidateProfile,
    messages: [],
    stage: 'intro',
    topicsCovered: [],
    questionsAsked: 0,
    targetQuestions: config.targetQuestions,
    lastAnswerQuality: null,
    lastAnswerTopics: [],
    consecutiveWeakAnswers: 0,
    consecutiveStrongAnswers: 0,
    currentDifficulty: 'warmup',
    startTime: Date.now(),
    maxDurationMs: config.maxDurationMs ?? DEFAULT_MAX_DURATION_MS,
    nextAction: null,
    pendingResponse: null,
  };

  sessions.set(sessionId, state);
  logger.info(
    { sessionId, interviewType: config.interviewType, targetQuestions: config.targetQuestions },
    'sessionStore: session initialized'
  );

  return state;
}

export function getSession(sessionId: string): InterviewState | undefined {
  return sessions.get(sessionId);
}

export function updateSession(sessionId: string, state: InterviewState): void {
  if (!sessions.has(sessionId)) {
    logger.warn({ sessionId }, 'sessionStore: updateSession called for unknown session');
  }
  sessions.set(sessionId, state);
}

export function deleteSession(sessionId: string): void {
  if (!sessions.has(sessionId)) {
    logger.warn({ sessionId }, 'sessionStore: deleteSession called for unknown session');
    return;
  }
  sessions.delete(sessionId);
  logger.info({ sessionId }, 'sessionStore: session deleted');
}

export function getAllSessionIds(): string[] {
  return Array.from(sessions.keys());
}

export function getSessionCount(): number {
  return sessions.size;
}
