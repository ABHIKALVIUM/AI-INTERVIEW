import { StateGraph, Annotation, END, START } from '@langchain/langgraph';
import type {
  InterviewType,
  InterviewStage,
  AnswerQuality,
  DifficultyLevel,
  NextAction,
  CandidateProfile,
  ConversationMessage,
  InterviewState,
} from './state.js';
import { introNode } from './nodes/introNode.js';
import { evaluateAnswerNode } from './nodes/evaluateAnswerNode.js';
import { questionNode } from './nodes/questionNode.js';
import { followUpNode } from './nodes/followUpNode.js';
import { probeNode } from './nodes/probeNode.js';
import { closingNode } from './nodes/closingNode.js';
import { routerNode, escalateDifficulty } from './nodes/routerNode.js';
import { getSession, updateSession } from '../store/sessionStore.js';
import { logger } from '../utils/logger.js';

// ─────────────────────────────────────────────────────────────────────────────
// LangGraph StateAnnotation — defines state shape with last-value reducers
// ─────────────────────────────────────────────────────────────────────────────

const InterviewStateAnnotation = Annotation.Root({
  sessionId: Annotation<string>({ reducer: (_old: any, next: any) => next, default: () => '' }),
  userId: Annotation<string>({ reducer: (_old: any, next: any) => next, default: () => '' }),
  interviewType: Annotation<InterviewType>({
    reducer: (_old: any, next: any) => next,
    default: () => 'behavioral' as InterviewType,
  }),
  candidateProfile: Annotation<CandidateProfile>({
    reducer: (_old: any, next: any) => next,
    default: () => ({ name: '', jobRole: '', experienceLevel: '' }),
  }),
  messages: Annotation<ConversationMessage[]>({
    reducer: (_old: any, next: any) => next,
    default: () => [] as ConversationMessage[],
  }),
  stage: Annotation<InterviewStage>({
    reducer: (_old: any, next: any) => next,
    default: () => 'intro' as InterviewStage,
  }),
  topicsCovered: Annotation<string[]>({
    reducer: (_old: any, next: any) => next,
    default: () => [] as string[],
  }),
  questionsAsked: Annotation<number>({ reducer: (_old: any, next: any) => next, default: () => 0 }),
  targetQuestions: Annotation<number>({ reducer: (_old: any, next: any) => next, default: () => 5 }),
  lastAnswerQuality: Annotation<AnswerQuality | null>({
    reducer: (_old: any, next: any) => next,
    default: () => null,
  }),
  lastAnswerTopics: Annotation<string[]>({
    reducer: (_old: any, next: any) => next,
    default: () => [] as string[],
  }),
  consecutiveWeakAnswers: Annotation<number>({
    reducer: (_old: any, next: any) => next,
    default: () => 0,
  }),
  consecutiveStrongAnswers: Annotation<number>({
    reducer: (_old: any, next: any) => next,
    default: () => 0,
  }),
  currentDifficulty: Annotation<DifficultyLevel>({
    reducer: (_old: any, next: any) => next,
    default: () => 'warmup' as DifficultyLevel,
  }),
  startTime: Annotation<number>({ reducer: (_old: any, next: any) => next, default: () => 0 }),
  maxDurationMs: Annotation<number>({
    reducer: (_old: any, next: any) => next,
    default: () => 45 * 60 * 1000,
  }),
  nextAction: Annotation<NextAction | null>({
    reducer: (_old: any, next: any) => next,
    default: () => null,
  }),
  pendingResponse: Annotation<string | null>({
    reducer: (_old: any, next: any) => next,
    default: () => null,
  }),
});

type GraphState = typeof InterviewStateAnnotation.State;

// Adapter: convert our InterviewState to GraphState (they're structurally identical)
function toGraphState(s: InterviewState): GraphState {
  return s as unknown as GraphState;
}

function fromGraphState(s: GraphState): InterviewState {
  return s as unknown as InterviewState;
}

// ─────────────────────────────────────────────────────────────────────────────
// Build the intro graph (run once at session start)
// Flow: START → introNode → END
// ─────────────────────────────────────────────────────────────────────────────

function buildIntroGraph() {
  const graph = new StateGraph(InterviewStateAnnotation)
    .addNode('introNode', (s: GraphState) => introNode(fromGraphState(s)))
    .addEdge(START, 'introNode')
    .addEdge('introNode', END);

  return graph.compile();
}

// ─────────────────────────────────────────────────────────────────────────────
// Build the response graph (run on each candidate turn)
// Flow: START → evaluateAnswerNode → [conditional edge via routerNode] → node → END
// ─────────────────────────────────────────────────────────────────────────────

function buildResponseGraph() {
  const graph = new StateGraph(InterviewStateAnnotation)
    // Add all nodes with state adapters
    .addNode('evaluateAnswerNode', (s: GraphState) => evaluateAnswerNode(fromGraphState(s)))
    .addNode('questionNode', (s: GraphState) => questionNode(fromGraphState(s)))
    .addNode('followUpNode', (s: GraphState) => followUpNode(fromGraphState(s)))
    .addNode('probeNode', (s: GraphState) => probeNode(fromGraphState(s)))
    .addNode('closingNode', (s: GraphState) => closingNode(fromGraphState(s)))

    // Entry edge
    .addEdge(START, 'evaluateAnswerNode')

    // Conditional routing after evaluation — routerNode receives plain InterviewState
    .addConditionalEdges(
      'evaluateAnswerNode',
      (s: GraphState) => routerNode(fromGraphState(s)),
      {
        questionNode: 'questionNode',
        followUpNode: 'followUpNode',
        probeNode: 'probeNode',
        closingNode: 'closingNode',
      }
    )

    // All leaf nodes go to END
    .addEdge('questionNode', END)
    .addEdge('followUpNode', END)
    .addEdge('probeNode', END)
    .addEdge('closingNode', END);

  return graph.compile();
}

// Compile graphs once at module load
const introGraph = buildIntroGraph();
const responseGraph = buildResponseGraph();

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * runIntro — Called once when a session starts.
 * Runs the introNode and returns the AI's opening message.
 */
export async function runIntro(sessionId: string): Promise<string> {
  const state = getSession(sessionId);
  if (!state) {
    throw new Error(`runIntro: session not found: ${sessionId}`);
  }

  logger.info({ sessionId }, 'graph: running intro');

  const result = fromGraphState(await introGraph.invoke(toGraphState(state)) as GraphState);

  updateSession(sessionId, result);

  const response = result.pendingResponse;
  if (!response) {
    throw new Error('runIntro: introNode did not produce a pendingResponse');
  }

  return response;
}

/**
 * runGraph — Called on each candidate utterance.
 * Appends the candidate's message to state, evaluates it, routes to the next node,
 * and returns the AI's response text.
 *
 * @param sessionId - The active session ID
 * @param candidateText - The transcribed candidate utterance
 * @returns The AI's next response (to be synthesized and played back)
 */
export async function runGraph(
  sessionId: string,
  candidateText: string
): Promise<string> {
  const state = getSession(sessionId);
  if (!state) {
    throw new Error(`runGraph: session not found: ${sessionId}`);
  }

  if (state.stage === 'done') {
    logger.warn({ sessionId }, 'runGraph: interview already completed, ignoring input');
    return 'The interview has already concluded. Thank you!';
  }

  logger.info(
    { sessionId, stage: state.stage, candidateTextLength: candidateText.length },
    'graph: processing candidate turn'
  );

  // Step 1: Append candidate message to state
  const stateWithCandidate: InterviewState = {
    ...state,
    messages: [
      ...state.messages,
      {
        role: 'candidate',
        content: candidateText,
        timestamp: Date.now(),
      },
    ],
  };

  // Step 2: Escalate difficulty if on a strong streak (before evaluation,
  // so the question generator uses the new difficulty)
  let stateToProcess = stateWithCandidate;
  if (
    state.lastAnswerQuality === 'strong' &&
    state.consecutiveStrongAnswers >= 2
  ) {
    const newDifficulty = escalateDifficulty(state.currentDifficulty);
    if (newDifficulty !== state.currentDifficulty) {
      logger.info(
        {
          sessionId,
          from: state.currentDifficulty,
          to: newDifficulty,
        },
        'graph: escalating difficulty due to consecutive strong answers'
      );
    }
    stateToProcess = { ...stateToProcess, currentDifficulty: newDifficulty };
  }

  // Step 3: Run response graph (evaluate → route → respond)
  const result = fromGraphState(await responseGraph.invoke(toGraphState(stateToProcess)) as GraphState);

  // Step 4: Persist updated state
  updateSession(sessionId, result);

  logger.info(
    {
      sessionId,
      stage: result.stage,
      questionsAsked: result.questionsAsked,
      lastQuality: result.lastAnswerQuality,
      nextAction: result.nextAction,
    },
    'graph: turn complete'
  );

  const response = result.pendingResponse;
  if (!response) {
    throw new Error('runGraph: no pendingResponse produced');
  }

  return response;
}

/**
 * getInterviewStage — Returns the current stage of the interview.
 * Useful for checking if the interview has concluded.
 */
export function getInterviewStage(sessionId: string): InterviewState['stage'] | null {
  const state = getSession(sessionId);
  return state?.stage ?? null;
}

export type { InterviewState };
