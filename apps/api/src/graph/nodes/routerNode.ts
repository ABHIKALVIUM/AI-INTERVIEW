import type { InterviewState, DifficultyLevel } from '../state.js';
import { logger } from '../../utils/logger.js';

/**
 * routerNode — Pure logic, no LLM call.
 * Returns the name of the next node as a string.
 * Used as a conditional edge function in LangGraph.
 */
export function routerNode(state: InterviewState): string {
  const elapsed = Date.now() - state.startTime;

  // ─── Time limit check ─────────────────────────────────────────────────────
  if (elapsed >= state.maxDurationMs) {
    logger.info(
      { sessionId: state.sessionId, elapsed, maxDurationMs: state.maxDurationMs },
      'routerNode: time limit reached → closingNode'
    );
    return 'closingNode';
  }

  // ─── Question count check ─────────────────────────────────────────────────
  if (state.questionsAsked >= state.targetQuestions) {
    logger.info(
      { sessionId: state.sessionId, questionsAsked: state.questionsAsked, target: state.targetQuestions },
      'routerNode: target questions reached → closingNode'
    );
    return 'closingNode';
  }

  // ─── Explicit close from evaluator ───────────────────────────────────────
  if (state.nextAction === 'close_interview') {
    logger.info(
      { sessionId: state.sessionId },
      'routerNode: evaluator suggested close_interview → closingNode'
    );
    return 'closingNode';
  }

  // ─── Incomplete answer — needs follow-up ─────────────────────────────────
  if (state.lastAnswerQuality === 'incomplete') {
    logger.info(
      { sessionId: state.sessionId },
      'routerNode: incomplete answer → followUpNode'
    );
    return 'followUpNode';
  }

  // ─── Explicit follow-up requested ────────────────────────────────────────
  if (state.nextAction === 'follow_up') {
    logger.info(
      { sessionId: state.sessionId },
      'routerNode: nextAction=follow_up → followUpNode'
    );
    return 'followUpNode';
  }

  // ─── Weak answer — probe if not already done twice ───────────────────────
  if (
    state.lastAnswerQuality === 'weak' &&
    state.consecutiveWeakAnswers < 2 &&
    state.nextAction === 'probe_deeper'
  ) {
    logger.info(
      { sessionId: state.sessionId, consecutiveWeakAnswers: state.consecutiveWeakAnswers },
      'routerNode: weak answer → probeNode'
    );
    return 'probeNode';
  }

  // ─── Strong streak — escalate difficulty before next question ─────────────
  if (
    state.lastAnswerQuality === 'strong' &&
    state.consecutiveStrongAnswers >= 2
  ) {
    logger.info(
      { sessionId: state.sessionId, consecutiveStrongAnswers: state.consecutiveStrongAnswers },
      'routerNode: strong streak → escalating difficulty → questionNode'
    );
    // Note: state is a reference — we signal difficulty escalation via a
    // mutation-free approach; questionNode reads currentDifficulty from
    // updated state that caller sets before calling runGraph.
    return 'questionNode';
  }

  // ─── Default: ask next question ───────────────────────────────────────────
  logger.info(
    { sessionId: state.sessionId, nextAction: state.nextAction },
    'routerNode: default → questionNode'
  );
  return 'questionNode';
}

/**
 * Escalates difficulty one level. Call this when routerNode signals escalation.
 */
export function escalateDifficulty(current: DifficultyLevel): DifficultyLevel {
  const progression: Record<DifficultyLevel, DifficultyLevel> = {
    warmup: 'standard',
    standard: 'hard',
    hard: 'probing',
    probing: 'probing', // already at max
  };
  return progression[current];
}
