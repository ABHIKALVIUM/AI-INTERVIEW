export type InterviewType = 'behavioral' | 'technical' | 'system_design' | 'hr';
export type InterviewStage = 'intro' | 'questioning' | 'followup' | 'done';
export type AnswerQuality = 'strong' | 'adequate' | 'weak' | 'incomplete';
export type DifficultyLevel = 'warmup' | 'standard' | 'hard' | 'probing';
export type NextAction =
  | 'ask_question'
  | 'follow_up'
  | 'acknowledge_and_proceed'
  | 'probe_deeper'
  | 'close_interview';

export interface CandidateProfile {
  name: string;
  jobRole: string;
  experienceLevel: string;
}

export interface ConversationMessage {
  role: 'ai' | 'candidate';
  content: string;
  timestamp: number;
}

export interface InterviewState {
  sessionId: string;
  userId: string;
  interviewType: InterviewType;
  candidateProfile: CandidateProfile;
  messages: ConversationMessage[];
  stage: InterviewStage;
  topicsCovered: string[];
  questionsAsked: number;
  targetQuestions: number;
  lastAnswerQuality: AnswerQuality | null;
  lastAnswerTopics: string[];
  consecutiveWeakAnswers: number;
  consecutiveStrongAnswers: number;
  currentDifficulty: DifficultyLevel;
  startTime: number;
  maxDurationMs: number;
  nextAction: NextAction | null;
  pendingResponse: string | null;
}
