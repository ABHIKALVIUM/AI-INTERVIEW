import OpenAI from 'openai';
import { z } from 'zod';
import { env } from '../../env.js';
import type { InterviewState, AnswerQuality, NextAction } from '../state.js';
import { getEvaluationPrompt } from '../../prompts.js';
import { logger } from '../../utils/logger.js';

const client = new OpenAI({
  apiKey: env.GROQ_API_KEY,
  baseURL: env.GROQ_BASE_URL,
});

// ─── Zod schema for LLM evaluation output ───────────────────────────────────

export const EvaluationSchema = z.object({
  quality: z.enum(['strong', 'adequate', 'weak', 'incomplete']),
  topics_covered: z.array(z.string()),
  star_present: z.boolean().optional(),
  vagueness_detected: z.boolean(),
  reasoning: z.string().min(1),
  suggested_next: z.enum([
    'follow_up',
    'probe_deeper',
    'acknowledge_and_proceed',
    'close_interview',
  ]),
});

export type Evaluation = z.infer<typeof EvaluationSchema>;

// ─── suggested_next → NextAction mapping ────────────────────────────────────

const suggestedNextToAction: Record<
  z.infer<typeof EvaluationSchema>['suggested_next'],
  NextAction
> = {
  follow_up: 'follow_up',
  probe_deeper: 'probe_deeper',
  acknowledge_and_proceed: 'acknowledge_and_proceed',
  close_interview: 'close_interview',
};

// ─── Node ────────────────────────────────────────────────────────────────────

export async function evaluateAnswerNode(
  state: InterviewState
): Promise<InterviewState> {
  // Find the most recent candidate message to evaluate
  const candidateMessages = state.messages.filter((m) => m.role === 'candidate');
  if (candidateMessages.length === 0) {
    logger.warn({ sessionId: state.sessionId }, 'evaluateAnswerNode: no candidate messages, skipping evaluation');
    return state;
  }

  const lastAnswer = candidateMessages[candidateMessages.length - 1]!.content;

  logger.info(
    { sessionId: state.sessionId, answerLength: lastAnswer.length },
    'evaluateAnswerNode: evaluating answer'
  );

  const prompt = getEvaluationPrompt(state.interviewType, state.messages, lastAnswer);

  const response = await client.chat.completions.create({
    model: env.GROQ_MODEL,
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
    temperature: 0.2, // Low temp for consistent structured output
    max_tokens: 500,
    response_format: { type: 'json_object' },
  });

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) {
    throw new Error('evaluateAnswerNode: Groq returned empty content');
  }

  // Parse and validate
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch (err) {
    throw new Error(`evaluateAnswerNode: failed to parse JSON — ${String(err)}\nRaw: ${rawContent}`);
  }

  const result = EvaluationSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `evaluateAnswerNode: Zod validation failed — ${result.error.message}\nRaw: ${rawContent}`
    );
  }

  const evaluation = result.data;
  logger.info(
    {
      sessionId: state.sessionId,
      quality: evaluation.quality,
      suggestedNext: evaluation.suggested_next,
      reasoning: evaluation.reasoning,
    },
    'evaluateAnswerNode: evaluation complete'
  );

  // ─── Update consecutive counters ──────────────────────────────────────────
  const quality = evaluation.quality as AnswerQuality;
  let consecutiveWeak = state.consecutiveWeakAnswers;
  let consecutiveStrong = state.consecutiveStrongAnswers;

  if (quality === 'weak' || quality === 'incomplete') {
    consecutiveWeak += 1;
    consecutiveStrong = 0;
  } else if (quality === 'strong') {
    consecutiveStrong += 1;
    consecutiveWeak = 0;
  } else {
    // adequate — reset both streaks
    consecutiveWeak = 0;
    consecutiveStrong = 0;
  }

  // ─── Merge topics ─────────────────────────────────────────────────────────
  const newTopics = evaluation.topics_covered.filter(
    (t) => !state.topicsCovered.includes(t)
  );

  return {
    ...state,
    lastAnswerQuality: quality,
    lastAnswerTopics: evaluation.topics_covered,
    consecutiveWeakAnswers: consecutiveWeak,
    consecutiveStrongAnswers: consecutiveStrong,
    topicsCovered: [...state.topicsCovered, ...newTopics],
    nextAction: suggestedNextToAction[evaluation.suggested_next],
  };
}
