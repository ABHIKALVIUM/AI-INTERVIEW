import { useEffect, useState } from 'react';
import { sessionsApi, reportsApi, type Report, type SessionToken } from '../lib/api';
import type { Session } from '../store/interviewStore';

interface UseInterviewResult {
  session: Session | null;
  token: string | null;
  wsUrl: string | null;
  report: Report | null;
  isLoadingSession: boolean;
  isLoadingToken: boolean;
  isLoadingReport: boolean;
  sessionError: string | null;
}

export function useInterview(sessionId: string): UseInterviewResult {
  const [session, setSession] = useState<Session | null>(null);
  const [tokenData, setTokenData] = useState<SessionToken | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    async function fetchSession() {
      setIsLoadingSession(true);
      setSessionError(null);
      try {
        const s = await sessionsApi.getSession(sessionId);
        if (!cancelled) setSession(s);
      } catch {
        if (!cancelled) setSessionError('Failed to load session.');
      } finally {
        if (!cancelled) setIsLoadingSession(false);
      }
    }

    fetchSession();
    return () => { cancelled = true; };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !session) return;
    if (session.status !== 'active' && session.status !== 'pending') return;

    let cancelled = false;

    async function fetchToken() {
      setIsLoadingToken(true);
      try {
        const t = await sessionsApi.getSessionToken(sessionId);
        if (!cancelled) setTokenData(t);
      } catch {
        // Token fetch failure is non-fatal, LiveKit hook will handle
      } finally {
        if (!cancelled) setIsLoadingToken(false);
      }
    }

    fetchToken();
    return () => { cancelled = true; };
  }, [sessionId, session]);

  // Poll for report once session is completed
  useEffect(() => {
    if (!sessionId || !session) return;
    if (session.status !== 'completed') return;

    let cancelled = false;
    setIsLoadingReport(true);

    async function pollReport() {
      try {
        const r = await reportsApi.getReport(sessionId);
        if (!cancelled) {
          setReport(r);
          if (r.generatedAt) {
            setIsLoadingReport(false);
          }
        }
      } catch {
        // still polling
      }
    }

    pollReport();
    const interval = setInterval(async () => {
      if (cancelled) return;
      const r = await reportsApi.getReport(sessionId).catch(() => null);
      if (!cancelled && r) {
        setReport(r);
        if (r.generatedAt) {
          setIsLoadingReport(false);
          clearInterval(interval);
        }
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sessionId, session]);

  return {
    session,
    token: tokenData?.token ?? null,
    wsUrl: tokenData?.wsUrl ?? null,
    report,
    isLoadingSession,
    isLoadingToken,
    isLoadingReport,
    sessionError,
  };
}
