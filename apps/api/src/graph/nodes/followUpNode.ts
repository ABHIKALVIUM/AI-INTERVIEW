import OpenAI from 'openai';
import { env } from '../../env.js';
import type { InterviewState } from '../state.js';
import { getFollowUpPrompt } from '../../prompts.js';
import { logger } from '../../utils/logger.js';

const client = new OpenAI({
  apiKey: env.GROQ_API_KEY,
  baseURL: env.GROQ_BASE_URL,
});

export async function followUpNode(state: InterviewState): Promise<InterviewState> {
  // Get the most recent candidate answer to follow up on
  const candidateMessages = state.messages.filter((m) => m.role === 'candidate');
  const lastAnswer = candidateMessages[candidateMessages.length - 1]?.content ?? '';

  logger.info(
    { sessionId: state.sessionId, lastAnswerLength: lastAnswer.length },
    'followUpNode: generating follow-up'
  );

  const prompt = getFollowUpPrompt(state.interviewType, state.messages, lastAnswer);

  const response = await client.chat.completions.create({
    model: env.GROQ_MODEL,
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
    temperature: 0.7,
    max_tokens: 250,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('followUpNode: Groq returned empty content');
  }

  const followUpText = content.trim();
  logger.info(
    { sessionId: state.sessionId, followUpLength: followUpText.length },
    'followUpNode: follow-up generated'
  );

  return {
    ...state,
    stage: 'followup',
    pendingResponse: followUpText,
    messages: [
      ...state.messages,
      {
        role: 'ai',
        content: followUpText,
        timestamp: Date.now(),
      },
    ],
  };
}
