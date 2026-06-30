import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sessionsApi } from '../lib/api';
import api from '../lib/api';
import { useInterviewStore } from '../store/interviewStore';
import WaveformVisualiser from '../components/WaveformVisualiser';
import type { AgentStatus, InterviewType } from '../store/interviewStore';

// ── Speech API types ───────────────────────────────────────────────────────────
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

// ── Constants ──────────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<InterviewType, string> = {
  behavioral: 'Behavioral Interview',
  technical: 'Technical Interview',
  system_design: 'System Design',
  hr: 'HR / Culture Fit',
};
const PERSONA_NAMES: Record<InterviewType, string> = {
  behavioral: 'Sarah',
  technical: 'Sarah',
  system_design: 'Sarah',
  hr: 'Sarah',
};
const STATUS_CONFIG: Record<AgentStatus, { label: string; dotColor: string; textColor: string }> = {
  idle: { label: 'Connecting...', dotColor: 'bg-slate-500', textColor: 'text-slate-400' },
  listening: { label: 'Listening to you...', dotColor: 'bg-emerald-400', textColor: 'text-emerald-400' },
  thinking: { label: 'AI is thinking...', dotColor: 'bg-amber-400', textColor: 'text-amber-400' },
  speaking: { label: 'AI is speaking...', dotColor: 'bg-indigo-400', textColor: 'text-indigo-400' },
};

function formatTime(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ── Confirm dialog ─────────────────────────────────────────────────────────────
function ConfirmDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="glass-card p-8 max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="currentColor" className="text-rose-400">
              <path d="M14 3a11 11 0 100 22A11 11 0 0014 3zm-.75 5.75a.75.75 0 011.5 0v5.5a.75.75 0 01-1.5 0v-5.5zm.75 10.5a1 1 0 110-2 1 1 0 010 2z"/>
            </svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">End Interview?</h3>
          <p className="text-slate-400 text-sm">Your session will be saved and a report will be generated.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-secondary flex-1">Continue</button>
          <button onClick={onConfirm} className="btn-danger flex-1">End Interview</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function InterviewRoomPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { agentStatus, elapsedSeconds, setAgentStatus, setSession, tick, reset } = useInterviewStore();

  const [sessionType, setSessionType] = useState<InterviewType>('behavioral');
  const [isReady, setIsReady] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);
  const [liveText, setLiveText] = useState(''); // what user has said so far (shown live)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isSpeakingRef = useRef(false);     // AI is currently speaking
  const isListeningRef = useRef(false);    // SpeechRecognition is running
  const sessionEndedRef = useRef(false);
  const accumulatedTextRef = useRef('');   // full text the user has said in this turn
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SILENCE_MS = 2500; // send after 2.5s of silence

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setIsSpeechSupported(false);
      return;
    }

    async function init() {
      try {
        const session = await sessionsApi.getSession(sessionId!);
        setSession(session);
        setSessionType(session.interviewType);
        
        if (!isMounted) return;
        timerRef.current = setInterval(tick, 1000);
        setIsReady(true);

        setAgentStatus('thinking');
        const { data } = await api.post<{ data: { aiText: string } }>('/interview/start', { sessionId });
        await speakText(data.data.aiText);
      } catch (err) {
        console.error('Init error:', err);
        setLoadError('Failed to start interview. Please go back and try again.');
      }
    }

    let isMounted = true;
    void init();

    return () => {
      isMounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      stopListening();
      window.speechSynthesis?.cancel();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // ── TTS: speak via SpeechSynthesis ────────────────────────────────────────
  const speakText = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!text.trim() || sessionEndedRef.current) { resolve(); return; }

      stopListening();
      isSpeakingRef.current = true;
      setAgentStatus('speaking');
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.92;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Pick best available voice
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find(v => v.lang === 'en-US' && v.name.includes('Google US English')) ||
        voices.find(v => v.lang === 'en-US' && !v.localService) ||
        voices.find(v => v.lang.startsWith('en'));
      if (preferred) utterance.voice = preferred;

      utterance.onend = () => {
        isSpeakingRef.current = false;
        if (!sessionEndedRef.current) {
          setAgentStatus('listening');
          startListening();
        }
        resolve();
      };
      utterance.onerror = () => {
        isSpeakingRef.current = false;
        if (!sessionEndedRef.current) {
          setAgentStatus('listening');
          startListening();
        }
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setAgentStatus]);

  // ── STT: continuous listening with silence detection ──────────────────────
  const startListening = useCallback(() => {
    if (isListeningRef.current || isSpeakingRef.current || sessionEndedRef.current) return;
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    accumulatedTextRef.current = '';
    setLiveText('');

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;      // IMPORTANT: don't stop on silence
    recognition.interimResults = true;  // show live transcript
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListeningRef.current = true;
      setAgentStatus('listening');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Collect final results and show interim
      let interimTranscript = '';
      let newFinalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result?.[0]?.transcript ?? '';
        if (result?.isFinal) {
          newFinalText += text + ' ';
        } else {
          interimTranscript = text;
        }
      }

      if (newFinalText) {
        accumulatedTextRef.current += newFinalText;
      }

      // Show live preview
      setLiveText((accumulatedTextRef.current + interimTranscript).trim());

      // Reset silence timer on every word received
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if ((accumulatedTextRef.current + newFinalText).trim().length > 0) {
        silenceTimerRef.current = setTimeout(() => {
          // User has been silent for SILENCE_MS — send what we have
          const textToSend = accumulatedTextRef.current.trim();
          if (textToSend && !isSpeakingRef.current && !sessionEndedRef.current) {
            void handleUserTurn(textToSend);
          }
        }, SILENCE_MS);
      }
    };

    recognition.onerror = (event) => {
      const errEvent = event as Event & { error?: string };
      // 'no-speech' is normal — just means the user hasn't spoken yet
      if (errEvent.error === 'no-speech') return;
      console.warn('SpeechRecognition error:', errEvent.error);
      isListeningRef.current = false;
      recognitionRef.current = null;
      // Restart unless session is over
      if (!sessionEndedRef.current && !isSpeakingRef.current) {
        setTimeout(startListening, 500);
      }
    };

    recognition.onend = () => {
      isListeningRef.current = false;
      recognitionRef.current = null;
      // Auto-restart to keep listening continuously
      if (!sessionEndedRef.current && !isSpeakingRef.current) {
        setTimeout(startListening, 300);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      isListeningRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setAgentStatus]);

  function stopListening() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    try { recognitionRef.current?.abort(); } catch { /* ignore */ }
    isListeningRef.current = false;
    recognitionRef.current = null;
  }

  // ── Send user turn to AI ──────────────────────────────────────────────────
  const handleUserTurn = useCallback(async (text: string) => {
    if (sessionEndedRef.current) return;
    stopListening();
    setLiveText('');
    accumulatedTextRef.current = '';
    setAgentStatus('thinking');

    try {
      const { data } = await api.post<{ data: { aiText: string; done?: boolean } }>(
        '/interview/chat',
        { sessionId, userMessage: text }
      );

      if (data.data.aiText) {
        await speakText(data.data.aiText);
      }

      if (data.data.done && !sessionEndedRef.current) {
        setTimeout(() => { void handleEndInterview(); }, 1500);
      }
    } catch (err) {
      console.error('Chat error:', err);
      if (!sessionEndedRef.current) {
        setAgentStatus('listening');
        startListening();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, speakText, setAgentStatus, startListening]);

  // ── End interview ─────────────────────────────────────────────────────────
  const handleEndInterview = useCallback(async () => {
    if (sessionEndedRef.current) return;
    sessionEndedRef.current = true;
    setShowConfirm(false);
    setIsEnding(true);
    stopListening();
    window.speechSynthesis?.cancel();
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      if (sessionId) await sessionsApi.endSession(sessionId);
      reset();
      navigate(`/report/${sessionId}`);
    } catch {
      setIsEnding(false);
      sessionEndedRef.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, navigate, reset]);

  // ── Render ────────────────────────────────────────────────────────────────
  const personaName = PERSONA_NAMES[sessionType] ?? 'AI';
  const typeLabel = TYPE_LABELS[sessionType] ?? 'Interview';
  const statusInfo = STATUS_CONFIG[agentStatus];
  const waveformMode = agentStatus === 'speaking' || agentStatus === 'thinking' ? 'speaking' : agentStatus === 'listening' ? 'listening' : 'idle';

  if (!isSpeechSupported) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="glass-card p-8 max-w-md text-center">
          <div className="text-5xl mb-4">🎙️</div>
          <h2 className="text-xl font-bold text-white mb-2">Browser Not Supported</h2>
          <p className="text-slate-400 text-sm mb-6">Please use <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong> for the interview. Firefox does not support the Web Speech API.</p>
          <button onClick={() => navigate('/dashboard')} className="btn-secondary w-full">Back to Dashboard</button>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="glass-card p-8 max-w-md text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">Session Error</h2>
          <p className="text-slate-400 text-sm mb-6">{loadError}</p>
          <button onClick={() => navigate('/dashboard')} className="btn-secondary w-full">Back to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col page-enter relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 transition-all duration-1000" style={{
          background: agentStatus === 'speaking'
            ? 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(99,102,241,0.07) 0%, transparent 70%)'
            : agentStatus === 'listening'
            ? 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(16,185,129,0.05) 0%, transparent 70%)'
            : 'none',
        }}/>
      </div>

      {/* Header */}
      <header className="relative z-20 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-slate-950/90 backdrop-blur-sm">
        <div>
          <p className="text-white font-bold">{typeLabel}</p>
          <p className="text-slate-500 text-xs">with {personaName} · AI Interviewer</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-700/50">
          <div className={`w-2 h-2 rounded-full ${isReady ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}/>
          <span className="font-mono text-white font-bold text-lg tracking-wider">{formatTime(elapsedSeconds)}</span>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-8 gap-8">
        {!isReady ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin"/>
            <p className="text-slate-400">Connecting to your AI interviewer...</p>
          </div>
        ) : (
          <>
            {/* AI Avatar */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-xl shadow-glow-indigo">
                  {personaName[0]}
                </div>
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-950 bg-emerald-400`}/>
              </div>
              <div>
                <p className="text-white font-semibold">{personaName}</p>
                <p className="text-slate-500 text-xs">AI Interview Coach</p>
              </div>
            </div>

            {/* Waveform */}
            <WaveformVisualiser isActive={isReady} mode={waveformMode} />

            {/* Status + live transcript */}
            <div className="flex flex-col items-center gap-3 w-full max-w-lg">
              <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-slate-900/80 border border-slate-700/50">
                <div className={`w-2.5 h-2.5 rounded-full ${statusInfo.dotColor} ${agentStatus !== 'idle' ? 'animate-pulse' : ''}`}/>
                <span className={`font-medium text-sm ${statusInfo.textColor}`}>{statusInfo.label}</span>
              </div>

              {liveText && agentStatus === 'listening' && (
                <div className="glass-card px-5 py-3 w-full text-sm text-slate-300 leading-relaxed text-center">
                  {liveText}
                  <span className="ml-1 inline-block w-0.5 h-4 bg-indigo-400 animate-pulse align-middle"/>
                </div>
              )}

              {agentStatus === 'listening' && !liveText && (
                <p className="text-slate-500 text-xs flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className="text-emerald-400">
                    <path d="M6 1a2 2 0 00-2 2v3a2 2 0 004 0V3a2 2 0 00-2-2zM3.5 6a.5.5 0 00-1 0A3.5 3.5 0 005.5 9.45V10H4a.5.5 0 000 1h4a.5.5 0 000-1H6.5v-.55A3.5 3.5 0 009.5 6a.5.5 0 00-1 0A2.5 2.5 0 016 8.5 2.5 2.5 0 013.5 6z"/>
                  </svg>
                  Microphone active — speak your answer
                </p>
              )}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-20 flex items-center justify-between px-6 py-4 border-t border-white/5 bg-slate-950/90 backdrop-blur-sm">
        <p className="text-xs text-slate-600">
          {isReady ? `Session ${sessionId?.slice(0, 8)}...` : 'Initializing...'}
        </p>
        <button onClick={() => setShowConfirm(true)} disabled={isEnding} className="btn-danger flex items-center gap-2 px-5 py-2.5 text-sm">
          {isEnding ? (
            <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Ending...</>
          ) : (
            <><svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="2" width="4" height="10" rx="1"/><rect x="8" y="2" width="4" height="10" rx="1"/></svg>End Interview</>
          )}
        </button>
      </footer>

      {showConfirm && <ConfirmDialog onConfirm={handleEndInterview} onCancel={() => setShowConfirm(false)} />}
    </div>
  );
}
