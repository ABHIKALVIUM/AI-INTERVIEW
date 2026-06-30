import OpenAI from 'openai';
import { z } from 'zod';
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { type Report, transcripts, sessions, reports } from '../db/schema.js';
import { env } from '../env.js';
import pino from 'pino';

const logger = pino({ name: 'report-service' });

// ─── Groq client (OpenAI-compatible) ─────────────────────────────────────────

const groq = new OpenAI({
  apiKey: env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildSystemPrompt(interviewType: string): string {
  return `You are an expert technical interviewer and career coach specializing in ${interviewType} interviews. 
Your task is to analyze a mock interview transcript and provide a comprehensive, honest, and constructive evaluation.

You MUST respond with a single valid JSON object and nothing else (no markdown, no prose outside JSON).

The JSON must conform exactly to this structure:
{
  "overall_score": <number 0-10, one decimal>,
  "communication_score": <number 0-10, one decimal>,
  "depth_score": <number 0-10, one decimal — evaluates technical depth and correctness>,
  "structure_score": <number 0-10, one decimal — evaluates answer organization and clarity>,
  "confidence_score": <number 0-10, one decimal — evaluates confidence and poise>,
  "strengths": [<string>, ...],
  "improvements": [<string>, ...],
  "detailed_feedback": "<2-3 paragraph narrative covering overall performance, key moments, and specific advice>",
  "question_breakdown": [
    {
      "question": "<the interviewer question>",
      "answer_summary": "<concise summary of the candidate's answer>",
      "score": <number 0-10>,
      "notes": "<specific feedback on this answer>"
    }
  ]
}

Scoring guidelines:
- 9-10: Exceptional, hire immediately
- 7-8: Strong candidate, minor gaps
- 5-6: Average, significant areas to improve
- 3-4: Below expectations, major gaps
- 0-2: Unsatisfactory

Be specific and actionable in all feedback. Use real quotes from the transcript when relevant.`;
}

function buildUserPrompt(
  interviewType: string,
  conversation: string,
): string {
  return `Interview Type: ${interviewType.toUpperCase().replace('_', ' ')}

TRANSCRIPT:
${conversation}

Evaluate the candidate's performance across all dimensions and return the JSON report.`;
}

function formatTranscript(
  rows: Array<{ speaker: string; content: string; sequence_number: number }>,
): string {
  return rows
    .sort((a, b) => a.sequence_number - b.sequence_number)
    .map((row) => {
      const label = row.speaker === 'ai' ? 'Interviewer' : 'Candidate';
      return `${label}: ${row.content}`;
    })
    .join('\n\n');
}

// ─── Relaxed schema (no minimums that can fail) ───────────────────────────────

const reportResponseSchemaRelaxed = z.object({
  overall_score: z.number().min(0).max(10).catch(5),
  communication_score: z.number().min(0).max(10).catch(5),
  depth_score: z.number().min(0).max(10).catch(5),
  structure_score: z.number().min(0).max(10).catch(5),
  confidence_score: z.number().min(0).max(10).catch(5),
  strengths: z.array(z.string()).catch(['Shows initiative in attempting the interview']),
  improvements: z.array(z.string()).catch(['Continue practising to improve answer structure']),
  detailed_feedback: z.string().catch('The interview was completed. Continue practising to improve your performance.'),
  question_breakdown: z.array(
    z.object({
      question: z.string().catch('Interview question'),
      answer_summary: z.string().catch('Answer provided'),
      score: z.number().min(0).max(10).catch(5),
      notes: z.string().catch(''),
    })
  ).catch([]),
});

async function saveFallbackReport(sessionId: string, reason: string): Promise<Report> {
  logger.warn({ sessionId, reason }, 'Saving fallback report');
  const [report] = await db
    .insert(reports)
    .values({
      session_id: sessionId,
      overall_score: 5,
      communication_score: 5,
      depth_score: 5,
      structure_score: 5,
      confidence_score: 5,
      strengths: ['Completed the interview session', 'Engaged with the AI interviewer'],
      improvements: ['Continue practising to build confidence', 'Work on structuring answers more clearly'],
      detailed_feedback: 'Your interview session was recorded and completed. The automated analysis encountered an issue generating detailed scores. Please try another interview session for a full breakdown.',
      question_breakdown: [],
      generated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: reports.session_id,
      set: { generated_at: new Date() },
    })
    .returning();
  return report!;
}

// ─── Main service function ────────────────────────────────────────────────────

export async function generateReport(sessionId: string): Promise<Report> {
  logger.info({ sessionId }, 'Generating report for session');

  // 1. Fetch the session to get interview type
  let session;
  try {
    const rows = await db.select().from(sessions).where(eq(sessions.id, sessionId));
    session = rows[0];
  } catch (err) {
    logger.error({ err, sessionId }, 'Failed to fetch session');
    return saveFallbackReport(sessionId, 'db-session-fetch-error');
  }

  if (!session) {
    return saveFallbackReport(sessionId, 'session-not-found');
  }

  // 2. Fetch all transcripts ordered by sequence
  let transcriptRows: Array<{ speaker: string; content: string; sequence_number: number }> = [];
  try {
    transcriptRows = await db
      .select({
        speaker: transcripts.speaker,
        content: transcripts.content,
        sequence_number: transcripts.sequence_number,
      })
      .from(transcripts)
      .where(eq(transcripts.session_id, sessionId))
      .orderBy(asc(transcripts.sequence_number));
  } catch (err) {
    logger.error({ err, sessionId }, 'Failed to fetch transcripts');
    return saveFallbackReport(sessionId, 'db-transcript-fetch-error');
  }

  // If there are no transcripts, save a placeholder report immediately
  if (transcriptRows.length === 0) {
    logger.warn({ sessionId }, 'No transcripts found — saving placeholder report');
    const [report] = await db
      .insert(reports)
      .values({
        session_id: sessionId,
        overall_score: 0,
        communication_score: 0,
        depth_score: 0,
        structure_score: 0,
        confidence_score: 0,
        strengths: ['Session was initiated successfully'],
        improvements: [
          'No conversation was recorded. Please ensure your microphone is enabled.',
          'Try refreshing the page and starting a new interview.',
        ],
        detailed_feedback:
          'No interview conversation was recorded for this session. This can happen if the microphone was not enabled or the session ended before any dialogue occurred. Please start a new interview and allow microphone access when prompted.',
        question_breakdown: [],
        generated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: reports.session_id,
        set: { generated_at: new Date() },
      })
      .returning();
    return report!;
  }

  const conversation = formatTranscript(transcriptRows);

  // 3. Call Groq API with broad error handling
  let rawContent = '';
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: buildSystemPrompt(session.interview_type) },
        { role: 'user', content: buildUserPrompt(session.interview_type, conversation) },
      ],
      temperature: 0.3,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    });
    rawContent = completion.choices[0]?.message?.content ?? '';
    logger.debug({ sessionId, rawContentLength: rawContent.length }, 'Groq response received');
  } catch (err) {
    logger.error({ err, sessionId }, 'Groq API call failed — using fallback report');
    return saveFallbackReport(sessionId, 'groq-api-error');
  }

  // 4. Parse and validate — use relaxed schema with .catch() defaults so it never throws
  let parsed: z.infer<typeof reportResponseSchemaRelaxed>;
  try {
    const json: unknown = JSON.parse(rawContent);
    parsed = reportResponseSchemaRelaxed.parse(json);
  } catch (err) {
    logger.error({ err, rawContent: rawContent.slice(0, 300), sessionId }, 'Failed to parse Groq JSON — using fallback');
    return saveFallbackReport(sessionId, 'groq-json-parse-error');
  }

  // 5. Upsert into reports table
  try {
    const [report] = await db
      .insert(reports)
      .values({
        session_id: sessionId,
        overall_score: parsed.overall_score,
        communication_score: parsed.communication_score,
        depth_score: parsed.depth_score,
        structure_score: parsed.structure_score,
        confidence_score: parsed.confidence_score,
        strengths: parsed.strengths,
        improvements: parsed.improvements,
        detailed_feedback: parsed.detailed_feedback,
        question_breakdown: parsed.question_breakdown,
        generated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: reports.session_id,
        set: {
          overall_score: parsed.overall_score,
          communication_score: parsed.communication_score,
          depth_score: parsed.depth_score,
          structure_score: parsed.structure_score,
          confidence_score: parsed.confidence_score,
          strengths: parsed.strengths,
          improvements: parsed.improvements,
          detailed_feedback: parsed.detailed_feedback,
          question_breakdown: parsed.question_breakdown,
          generated_at: new Date(),
        },
      })
      .returning();

    logger.info({ sessionId, reportId: report?.id }, 'Report generated and saved');
    return report!;
  } catch (err) {
    logger.error({ err, sessionId }, 'Failed to save report to DB — using fallback');
    return saveFallbackReport(sessionId, 'db-insert-error');
  }
}
