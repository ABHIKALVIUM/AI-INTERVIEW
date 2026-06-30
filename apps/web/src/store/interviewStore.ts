import { create } from 'zustand';

export type InterviewType = 'behavioral' | 'technical' | 'system_design' | 'hr';

export interface Session {
  id: string;
  interviewType: InterviewType;
  status: 'pending' | 'active' | 'completed' | 'failed';
  createdAt: string;
  endedAt?: string;
  durationSeconds?: number;
  overallScore?: number;
}

export type AgentStatus = 'idle' | 'listening' | 'thinking' | 'speaking';

interface InterviewState {
  currentSession: Session | null;
  isConnected: boolean;
  agentStatus: AgentStatus;
  elapsedSeconds: number;
  setSession: (session: Session) => void;
  setConnected: (v: boolean) => void;
  setAgentStatus: (s: AgentStatus) => void;
  tick: () => void;
  reset: () => void;
}

export const useInterviewStore = create<InterviewState>((set) => ({
  currentSession: null,
  isConnected: false,
  agentStatus: 'idle',
  elapsedSeconds: 0,
  setSession: (session) => set({ currentSession: session }),
  setConnected: (v) => set({ isConnected: v }),
  setAgentStatus: (s) => set({ agentStatus: s }),
  tick: () => set((state) => ({ elapsedSeconds: state.elapsedSeconds + 1 })),
  reset: () =>
    set({
      currentSession: null,
      isConnected: false,
      agentStatus: 'idle',
      elapsedSeconds: 0,
    }),
}));
