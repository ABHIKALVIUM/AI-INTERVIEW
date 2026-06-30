import OpenAI from 'openai';
import { env } from '../../env.js';
import type { InterviewState } from '../state.js';
import { getIntroPrompt } from '../../prompts.js';
import { logger } from '../../utils/logger.js';

const client = new OpenAI({
  apiKey: env.GROQ_API_KEY,
  baseURL: env.GROQ_BASE_URL,
});

export async function introNode(state: InterviewState): Promise<InterviewState> {
  logger.info({ sessionId: state.sessionId, stage: 'intro' }, 'introNode: generating introduction');

  const prompt = getIntroPrompt(state.interviewType, state.candidateProfile);

  const response = await client.chat.completions.create({
    model: env.GROQ_MODEL,
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
    temperature: 0.8,
    max_tokens: 300,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('introNode: Groq returned empty content');
  }

  const introText = content.trim();
  logger.info({ sessionId: state.sessionId, introLength: introText.length }, 'introNode: intro generated');

  return {
    ...state,
    stage: 'questioning',
    pendingResponse: introText,
    messages: [
      ...state.messages,
      {
        role: 'ai',
        content: introText,
        timestamp: Date.now(),
      },
    ],
  };
}
