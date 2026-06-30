import OpenAI from 'openai';
import { env } from '../../env.js';
import type { InterviewState } from '../state.js';
import { getQuestionPrompt } from '../../prompts.js';
import { logger } from '../../utils/logger.js';

const client = new OpenAI({
  apiKey: env.GROQ_API_KEY,
  baseURL: env.GROQ_BASE_URL,
});

export async function questionNode(state: InterviewState): Promise<InterviewState> {
  logger.info(
    {
      sessionId: state.sessionId,
      questionsAsked: state.questionsAsked,
      difficulty: state.currentDifficulty,
      topicsCovered: state.topicsCovered,
    },
    'questionNode: generating next question'
  );

  const prompt = getQuestionPrompt(state.interviewType, {
    topicsCovered: state.topicsCovered,
    currentDifficulty: state.currentDifficulty,
    messages: state.messages,
    questionsAsked: state.questionsAsked,
    candidateProfile: state.candidateProfile,
    lastAnswerQuality: state.lastAnswerQuality,
  });

  const response = await client.chat.completions.create({
    model: env.GROQ_MODEL,
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user },
    ],
    temperature: 0.75,
    max_tokens: 400,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('questionNode: Groq returned empty content');
  }

  const questionText = content.trim();

  // Extract topic hint from the question text (first key noun phrase as a fallback label)
  const topicHint = `Q${state.questionsAsked + 1}`;

  logger.info(
    { sessionId: state.sessionId, questionLength: questionText.length },
    'questionNode: question generated'
  );

  return {
    ...state,
    stage: 'questioning',
    questionsAsked: state.questionsAsked + 1,
    pendingResponse: questionText,
    nextAction: 'ask_question',
    messages: [
      ...state.messages,
      {
        role: 'ai',
        content: questionText,
        timestamp: Date.now(),
      },
    ],
    // Add topic hint — real topic will be added by evaluateAnswerNode after candidate responds
    topicsCovered: state.topicsCovered.includes(topicHint)
      ? state.topicsCovered
      : [...state.topicsCovered, topicHint],
  };
}
