import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { Session, InterviewType } from '../store/interviewStore';
import type { UserProfile } from '../store/authStore';

// ─── Axios Instance ────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  user: UserProfile;
}

export interface SessionToken {
  token: string;
  wsUrl: string;
}

export interface SubScore {
  label: string;
  score: number;
  maxScore: number;
}

export interface QAItem {
  question: string;
  answerSummary: string;
  score: number;
  notes: string;
}

export interface Report {
  id: string;
  sessionId: string;
  overallScore: number;
  generatedAt: string | null;
  communication: SubScore;
  depth: SubScore;
  structure: SubScore;
  confidence: SubScore;
  strengths: string[];
  improvements: string[];
  detailedFeedback: string;
  qaBreakdown: QAItem[];
}

// ─── Interceptor: 401 → refresh ────────────────────────────────────────────────

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  config: InternalAxiosRequestConfig;
}> = [];

function processQueue(error: unknown) {
  failedQueue.forEach(({ resolve, reject, config }) => {
    if (error) {
      reject(error);
    } else {
      resolve(api(config));
    }
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject, config: originalRequest });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await api.post('/auth/refresh');
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        // Clear session storage and redirect to login
        sessionStorage.removeItem('auth-session');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ─── Auth API ──────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await api.post<{ status: string, data: AuthResponse }>('/auth/login', { email, password });
    return data.data;
  },

  signup: async (email: string, name: string, password: string): Promise<AuthResponse> => {
    const { data } = await api.post<{ status: string, data: AuthResponse }>('/auth/signup', { email, name, password });
    return data.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  refreshToken: async (): Promise<void> => {
    await api.post('/auth/refresh');
  },

  updateProfile: async (profile: Partial<UserProfile>): Promise<AuthResponse> => {
    const { data } = await api.patch<{ status: string, data: AuthResponse }>('/auth/profile', profile);
    return data.data;
  },

  getMe: async (): Promise<AuthResponse> => {
    const { data } = await api.get<{ status: string, data: AuthResponse }>('/auth/me');
    return data.data;
  },
};

// ─── Raw Session (snake_case from DB) ─────────────────────────────────────────

interface RawSession {
  id: string;
  user_id: string;
  interview_type: InterviewType;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'abandoned';
  livekit_room_name: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  overall_score: number | null;
  created_at: string;
}

function mapSession(raw: RawSession): Session {
  return {
    id: raw.id,
    interviewType: raw.interview_type,
    // Map 'abandoned' → 'failed' for the frontend
    status: raw.status === 'abandoned' ? 'failed' : raw.status as Session['status'],
    createdAt: raw.created_at,
    endedAt: raw.ended_at ?? undefined,
    durationSeconds: raw.duration_seconds ?? undefined,
    overallScore: raw.overall_score ?? undefined,
  };
}

// ─── Sessions API ──────────────────────────────────────────────────────────────

export const sessionsApi = {
  getSessions: async (): Promise<Session[]> => {
    const { data } = await api.get<{ status: string, data: { sessions: RawSession[] } }>('/sessions');
    return data.data.sessions.map(mapSession);
  },

  createSession: async (interviewType: InterviewType): Promise<Session> => {
    const { data } = await api.post<{ status: string, data: { session: RawSession } }>('/sessions', { interviewType });
    return mapSession(data.data.session);
  },

  getSession: async (id: string): Promise<Session> => {
    const { data } = await api.get<{ status: string, data: { session: RawSession } }>(`/sessions/${id}`);
    return mapSession(data.data.session);
  },

  endSession: async (id: string): Promise<Session> => {
    const { data } = await api.patch<{ status: string, data: { session: RawSession } }>(`/sessions/${id}/end`);
    return mapSession(data.data.session);
  },

  getSessionToken: async (id: string): Promise<SessionToken> => {
    const { data } = await api.get<{ status: string, data: SessionToken }>(`/sessions/${id}/token`);
    return data.data;
  },
};

// ─── Raw Report (snake_case from DB) ──────────────────────────────────────────

interface RawReport {
  id: string;
  session_id: string;
  overall_score: number | null;
  communication_score: number | null;
  depth_score: number | null;
  structure_score: number | null;
  confidence_score: number | null;
  strengths: string[] | null;
  improvements: string[] | null;
  detailed_feedback: string | null;
  question_breakdown: Array<{ question: string; answer_summary: string; score: number; notes: string }> | null;
  generated_at: string | null;
}

function mapReport(raw: RawReport): Report {
  return {
    id: raw.id,
    sessionId: raw.session_id,
    overallScore: raw.overall_score ?? 0,
    generatedAt: raw.generated_at,
    communication: { label: 'Communication', score: raw.communication_score ?? 0, maxScore: 100 },
    depth: { label: 'Technical Depth', score: raw.depth_score ?? 0, maxScore: 100 },
    structure: { label: 'Structure', score: raw.structure_score ?? 0, maxScore: 100 },
    confidence: { label: 'Confidence', score: raw.confidence_score ?? 0, maxScore: 100 },
    strengths: raw.strengths ?? [],
    improvements: raw.improvements ?? [],
    detailedFeedback: raw.detailed_feedback ?? '',
    qaBreakdown: (raw.question_breakdown ?? []).map((q) => ({
      question: q.question,
      answerSummary: q.answer_summary,
      score: q.score,
      notes: q.notes,
    })),
  };
}

// ─── Reports API ───────────────────────────────────────────────────────────────

export const reportsApi = {
  getReport: async (sessionId: string): Promise<Report> => {
    const { data } = await api.get<{ status: string, data: { report: RawReport } }>(`/reports/${sessionId}`);
    return mapReport(data.data.report);
  },
};

export default api;
