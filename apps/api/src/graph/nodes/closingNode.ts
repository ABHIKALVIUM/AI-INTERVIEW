import OpenAI from 'openai';
import { env } from '../../env.js';
import type { InterviewState } from '../state.js';
import { getClosingPrompt } from '../../prompts.js';
import { logger } from '../../utils/logger.js';

const client = new OpenAI({
  apiKey: env.GROQ_API_KEY,
  baseURL: env.GROQ_BASE_URL,
});

export async function closingNode(state: InterviewState): Promise<InterviewState> {
  logger.info(
    {
      sessionId: state.sessionId,
      questionsAsked: state.questionsAsked,
      elapsed: Date.now() - state.startTime,
    },
    'closingNode: generating closing remarks'
  );

  const prompt = getClosingPrompt(state.interviewType, state.messages);

  const response = await client.chat.completions.create({
    model: env.GROQ_MODEL,
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
    temperature: 0.75,
    max_tokens: 300,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('closingNode: Groq returned empty content');
  }

  const closingText = content.trim();
  logger.info(
    { sessionId: state.sessionId },
    'closingNode: closing remarks generated — interview complete'
  );

  return {
    ...state,
    stage: 'done',
    pendingResponse: closingText,
    messages: [
      ...state.messages,
      {
        role: 'ai',
        content: closingText,
        timestamp: Date.now(),
      },
    ],
  };
}
