import OpenAI from 'openai';
import { z } from 'zod';
import { env } from '../../env.js';
import type { InterviewState } from '../state.js';
import { getFeedbackPrompt } from '../../prompts.js';
import { logger } from '../../utils/logger.js';

const client = new OpenAI({
  apiKey: env.GROQ_API_KEY,
  baseURL: env.GROQ_BASE_URL,
});

// ─── Zod schema for feedback report ──────────────────────────────────────────

const CompetencyScoreSchema = z.object({
  score: z.number().min(0).max(10),
  rationale: z.string().min(1),
});

export const FeedbackReportSchema = z.object({
  overall_score: z.number().min(0).max(10),
  hire_recommendation: z.enum(['strong_yes', 'yes', 'maybe', 'no', 'strong_no']),
  summary: z.string().min(1),
  competency_scores: z.record(z.string(), CompetencyScoreSchema),
  strengths: z.array(z.string()).min(1),
  areas_for_improvement: z.array(z.string()).min(1),
  standout_moments: z.array(z.string()),
  red_flags: z.array(z.string()),
  interviewer_notes: z.string().min(1),
  questions_asked: z.number().int().min(0),
  duration_minutes: z.number().min(0),
  topics_covered: z.array(z.string()),
});

export type FeedbackReport = z.infer<typeof FeedbackReportSchema>;

// ─── Standalone function (called from API, not part of the main graph) ────────

/**
 * generateFeedbackReport — Standalone async function called from the API layer
 * after an interview concludes. NOT a LangGraph node — it runs outside the graph.
 *
 * @param state - Complete InterviewState at the end of the session
 * @returns Validated FeedbackReport
 */
export async function generateFeedbackReport(
  state: InterviewState
): Promise<FeedbackReport> {
  logger.info(
    {
      sessionId: state.sessionId,
      questionsAsked: state.questionsAsked,
      topicsCount: state.topicsCovered.length,
    },
    'feedbackNode: generating comprehensive feedback report'
  );

  const prompt = getFeedbackPrompt(state.interviewType, state);

  const response = await client.chat.completions.create({
    model: env.GROQ_MODEL,
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
    temperature: 0.3,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  });

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) {
    throw new Error('feedbackNode: Groq returned empty content');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch (err) {
    throw new Error(
      `feedbackNode: failed to parse JSON — ${String(err)}\nRaw: ${rawContent}`
    );
  }

  const result = FeedbackReportSchema.safeParse(parsed);
  if (!result.success) {
    logger.error(
      { sessionId: state.sessionId, errors: result.error.errors },
      'feedbackNode: Zod validation failed'
    );
    throw new Error(
      `feedbackNode: Zod validation failed — ${result.error.message}`
    );
  }

  logger.info(
    {
      sessionId: state.sessionId,
      overallScore: result.data.overall_score,
      recommendation: result.data.hire_recommendation,
    },
    'feedbackNode: feedback report generated successfully'
  );

  return result.data;
}
