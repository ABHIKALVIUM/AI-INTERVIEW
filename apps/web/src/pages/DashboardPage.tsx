import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { sessionsApi } from '../lib/api';
import type { Session, InterviewType } from '../store/interviewStore';

const TYPE_CONFIG: Record<InterviewType, { label: string; color: string; bg: string; badge: string }> = {
  behavioral: {
    label: 'Behavioral',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10 border-indigo-500/30',
    badge: 'bg-indigo-500/20 text-indigo-300',
  },
  technical: {
    label: 'Technical',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    badge: 'bg-emerald-500/20 text-emerald-300',
  },
  system_design: {
    label: 'System Design',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/30',
    badge: 'bg-amber-500/20 text-amber-300',
  },
  hr: {
    label: 'HR / Culture',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/30',
    badge: 'bg-rose-500/20 text-rose-300',
  },
};

const STATUS_CONFIG: Record<Session['status'], { label: string; classes: string; dot: string }> = {
  pending: { label: 'Pending', classes: 'bg-slate-700/50 text-slate-400', dot: 'bg-slate-500' },
  active: { label: 'In Progress', classes: 'bg-amber-500/20 text-amber-300', dot: 'bg-amber-400 animate-pulse' },
  completed: { label: 'Completed', classes: 'bg-emerald-500/20 text-emerald-300', dot: 'bg-emerald-400' },
  failed: { label: 'Failed', classes: 'bg-rose-500/20 text-rose-300', dot: 'bg-rose-400' },
};

function ScoreRing({ score }: { score: number }) {
  const pct = Math.min(10, Math.max(0, score));
  const r = 20;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 10) * circ;
  const color = pct >= 7.5 ? '#10b981' : pct >= 5 ? '#6366f1' : '#f59e0b';

  return (
    <div className="relative w-14 h-14 flex items-center justify-center">
      <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4"/>
        <circle
          cx="28" cy="28" r={r} fill="none"
          stroke={color} strokeWidth="4"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <span className="absolute text-xs font-bold text-white">{pct}</span>
    </div>
  );
}

function SessionCardSkeleton() {
  return (
    <div className="glass-card p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="h-5 w-24 bg-slate-800 rounded-full"/>
        <div className="h-5 w-20 bg-slate-800 rounded-full"/>
      </div>
      <div className="h-4 w-32 bg-slate-800 rounded mb-2"/>
      <div className="h-3 w-20 bg-slate-800 rounded mb-4"/>
      <div className="h-8 w-full bg-slate-800 rounded-lg"/>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function EmptyState() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
      <div className="w-24 h-24 rounded-3xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mb-6">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="text-indigo-400">
          <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4"/>
          <path d="M20 12v8M20 24v.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">No interviews yet</h3>
      <p className="text-slate-400 max-w-xs mb-6">
        Start your first AI mock interview and get detailed feedback on your performance.
      </p>
      <Link to="/interview/setup" className="btn-primary flex items-center gap-2">
        Start your first interview
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path fillRule="evenodd" d="M8.22 2.97a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06l2.97-2.97H3.75a.75.75 0 010-1.5h7.44L8.22 4.03a.75.75 0 010-1.06z"/>
        </svg>
      </Link>
    </div>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchSessions() {
      setIsLoading(true);
      try {
        const data = await sessionsApi.getSessions();
        if (!cancelled) setSessions(data);
      } catch {
        // handle error silently - show empty state
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchSessions();
    return () => { cancelled = true; };
  }, []);

  const completed = sessions.filter((s) => s.status === 'completed');
  const avgScore =
    completed.length > 0
      ? Math.round(
          completed.reduce((acc, s) => acc + (s.overallScore ?? 0), 0) / completed.length
        )
      : 0;

  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12 ? 'Good morning' : greetingHour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-slate-950 page-enter">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="orb w-[600px] h-[600px] bg-indigo-700 -top-48 -right-32"
          style={{ opacity: 0.06 }}
        />
        <div
          className="orb w-[400px] h-[400px] bg-violet-700 bottom-0 -left-16"
          style={{ opacity: 0.05 }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-slate-950/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="13" stroke="url(#dh1)" strokeWidth="2"/>
                <path d="M9 14c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="url(#dh1)" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="14" cy="17" r="3" fill="url(#dh1)"/>
                <defs>
                  <linearGradient id="dh1" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#818cf8"/>
                    <stop offset="1" stopColor="#c084fc"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="font-bold text-white text-lg tracking-tight">InterviewAI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/interview/setup"
              className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M7 1a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 017 1z"/>
              </svg>
              New Interview
            </Link>
            <button
              onClick={logout}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all duration-200"
              title="Sign out"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                <path d="M10.5 2.25a.75.75 0 000 1.5h4.5v10.5h-4.5a.75.75 0 000 1.5h4.5A1.5 1.5 0 0016.5 14.25V3.75A1.5 1.5 0 0015 2.25h-4.5zM4.72 5.47a.75.75 0 011.06 1.06L4.31 8h8.94a.75.75 0 010 1.5H4.31l1.47 1.47a.75.75 0 11-1.06 1.06l-2.75-2.75a.75.75 0 010-1.06L4.72 5.47z"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Greeting */}
        <div className="mb-8 animate-[slideUp_0.4s_ease-out_forwards]">
          <h1 className="text-3xl font-bold text-white">
            {greeting},{' '}
            <span className="gradient-text">{user?.name?.split(' ')[0] ?? 'there'}</span> 👋
          </h1>
          <p className="text-slate-400 mt-1">
            {sessions.length === 0
              ? "Ready to nail your next interview?"
              : `You have completed ${completed.length} interview${completed.length !== 1 ? 's' : ''}.`}
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 animate-[slideUp_0.5s_ease-out_forwards]">
          {[
            {
              label: 'Total Sessions',
              value: sessions.length,
              icon: (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" className="text-indigo-400">
                  <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z"/>
                </svg>
              ),
              accent: 'indigo',
            },
            {
              label: 'Completed',
              value: completed.length,
              icon: (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" className="text-emerald-400">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"/>
                </svg>
              ),
              accent: 'emerald',
            },
            {
              label: 'Average Score',
              value: completed.length > 0 ? `${avgScore}/10` : '—',
              icon: (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" className="text-amber-400">
                  <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z"/>
                </svg>
              ),
              accent: 'amber',
            },
          ].map((stat) => (
            <div key={stat.label} className="glass-card p-5 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-slate-800`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold text-white mt-0.5">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Sessions Grid */}
        <div className="animate-[fadeIn_0.6s_ease-out_forwards]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Sessions</h2>
            {sessions.length > 0 && (
              <Link to="/interview/setup" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1">
                New interview
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <path fillRule="evenodd" d="M5.22 1.97a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06L6.28 11.53a.75.75 0 01-1.06-1.06l3.72-3.72-3.72-3.72a.75.75 0 010-1.06z"/>
                </svg>
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <SessionCardSkeleton key={i} />)
            ) : sessions.length === 0 ? (
              <EmptyState />
            ) : (
              sessions.map((session, i) => {
                const typeConf = TYPE_CONFIG[session.interviewType];
                const statusConf = STATUS_CONFIG[session.status];
                return (
                  <div
                    key={session.id}
                    className="glass-card-hover p-5"
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className={`status-chip border text-xs ${typeConf.bg} ${typeConf.color}`}>
                        {typeConf.label}
                      </span>
                      <span className={`status-chip text-xs ${statusConf.classes}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`}/>
                        {statusConf.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-300 text-sm font-medium">{formatDate(session.createdAt)}</p>
                        {session.durationSeconds != null && (
                          <p className="text-slate-500 text-xs mt-0.5">
                            Duration: {formatDuration(session.durationSeconds)}
                          </p>
                        )}
                      </div>
                      {session.overallScore != null && (
                        <ScoreRing score={session.overallScore} />
                      )}
                    </div>

                    <div className="mt-4 flex gap-2">
                      {session.status === 'completed' ? (
                        <Link
                          to={`/report/${session.id}`}
                          className="flex-1 text-center btn-primary text-xs py-2 px-3"
                        >
                          View Report
                        </Link>
                      ) : session.status === 'active' ? (
                        <Link
                          to={`/interview/${session.id}`}
                          className="flex-1 text-center py-2 px-3 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold hover:bg-amber-500/30 transition-all"
                        >
                          Rejoin →
                        </Link>
                      ) : (
                        <Link
                          to="/interview/setup"
                          className="flex-1 text-center btn-secondary text-xs py-2 px-3"
                        >
                          New Interview
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
