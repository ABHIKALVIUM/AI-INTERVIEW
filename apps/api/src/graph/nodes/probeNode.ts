import OpenAI from 'openai';
import { env } from '../../env.js';
import type { InterviewState } from '../state.js';
import { getProbePrompt } from '../../prompts.js';
import { logger } from '../../utils/logger.js';

const client = new OpenAI({
  apiKey: env.GROQ_API_KEY,
  baseURL: env.GROQ_BASE_URL,
});

export async function probeNode(state: InterviewState): Promise<InterviewState> {
  // Get the most recent candidate answer to probe
  const candidateMessages = state.messages.filter((m) => m.role === 'candidate');
  const lastAnswer = candidateMessages[candidateMessages.length - 1]?.content ?? '';

  logger.info(
    { sessionId: state.sessionId, consecutiveWeakAnswers: state.consecutiveWeakAnswers },
    'probeNode: generating probe'
  );

  const prompt = getProbePrompt(state.interviewType, state.messages, lastAnswer);

  const response = await client.chat.completions.create({
    model: env.GROQ_MODEL,
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
    temperature: 0.65,
    max_tokens: 250,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('probeNode: Groq returned empty content');
  }

  const probeText = content.trim();
  logger.info(
    { sessionId: state.sessionId, probeLength: probeText.length },
    'probeNode: probe generated'
  );

  return {
    ...state,
    pendingResponse: probeText,
    messages: [
      ...state.messages,
      {
        role: 'ai',
        content: probeText,
        timestamp: Date.now(),
      },
    ],
  };
}
