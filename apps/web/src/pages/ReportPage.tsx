import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { reportsApi, type Report, type QAItem } from '../lib/api';

// ── Score Ring SVG ─────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 160 }: { score: number; size?: number }) {
  const r = (size - 20) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(10, Math.max(0, score));
  const offset = circ - (pct / 10) * circ;
  const center = size / 2;

  const color =
    pct >= 8 ? '#10b981' :
    pct >= 6 ? '#6366f1' :
    pct >= 4 ? '#f59e0b' :
    '#f43f5e';

  const label =
    pct >= 8 ? 'Excellent' :
    pct >= 6 ? 'Good' :
    pct >= 4 ? 'Fair' :
    'Needs Work';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          {/* Background track */}
          <circle
            cx={center} cy={center} r={r}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="10"
          />
          {/* Glow ring */}
          <circle
            cx={center} cy={center} r={r}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeDasharray={circ}
            strokeDashoffset={circ - (pct / 10) * circ * 0.9}
            opacity="0.2"
          />
          {/* Progress arc */}
          <circle
            cx={center} cy={center} r={r}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 8px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-black text-white leading-none">{pct}</span>
          <span className="text-slate-400 text-xs font-medium mt-1">/ 10</span>
        </div>
      </div>
      <span className="text-sm font-semibold" style={{ color }}>{label}</span>
    </div>
  );
}

// ── Sub Score Card ─────────────────────────────────────────────────────────────
function SubScoreCard({
  label,
  score,
  maxScore,
  icon,
  color,
}: {
  label: string;
  score: number;
  maxScore: number;
  icon: string;
  color: { text: string; bar: string; bg: string; border: string };
}) {
  const pct = Math.round((score / maxScore) * 100);

  return (
    <div className={`glass-card p-5 border ${color.border} flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className="text-sm font-semibold text-slate-300">{label}</span>
        </div>
        <span className={`text-lg font-black ${color.text}`}>{score}<span className="text-slate-600 text-sm font-normal">/{maxScore}</span></span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full ${color.bar} transition-all duration-1000`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── QA Table Row ───────────────────────────────────────────────────────────────
function QARow({ item, index }: { item: QAItem; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const scoreColor = item.score >= 8 ? 'text-emerald-400' : item.score >= 5 ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        className="w-full text-left py-4 px-5 flex items-start gap-4 hover:bg-slate-800/30 transition-colors duration-150 group"
        onClick={() => setExpanded((e) => !e)}
      >
        <span className="text-slate-600 text-xs font-mono mt-0.5 w-5 shrink-0">{String(index + 1).padStart(2, '0')}</span>
        <div className="flex-1 min-w-0">
          <p className="text-slate-200 text-sm font-medium group-hover:text-white transition-colors leading-snug">
            {item.question}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`font-bold text-sm ${scoreColor}`}>{item.score}/10</span>
          <svg
            width="14" height="14" viewBox="0 0 14 14" fill="currentColor"
            className={`text-slate-600 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          >
            <path fillRule="evenodd" d="M2.97 5.22a.75.75 0 011.06 0L7 8.19l2.97-2.97a.75.75 0 111.06 1.06L7.53 9.78a.75.75 0 01-1.06 0L2.97 6.28a.75.75 0 010-1.06z"/>
          </svg>
        </div>
      </button>
      {expanded && (
        <div className="px-5 pb-4 space-y-3 animate-[slideUp_0.2s_ease-out_forwards]">
          <div className="bg-slate-900/60 rounded-xl p-4">
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1.5">Your Response</p>
            <p className="text-slate-300 text-sm leading-relaxed">{item.answerSummary}</p>
          </div>
          {item.notes && (
            <div className="bg-indigo-500/8 border border-indigo-500/20 rounded-xl p-4">
              <p className="text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Feedback</p>
              <p className="text-slate-300 text-sm leading-relaxed">{item.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Loading State ──────────────────────────────────────────────────────────────
function ReportLoading() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6 page-enter">
      <div className="relative">
        <div className="w-24 h-24 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin"/>
        <div className="w-24 h-24 rounded-full border-2 border-violet-500/10 border-b-violet-500/50 animate-spin absolute inset-0" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}/>
        <div className="absolute inset-0 flex items-center justify-center text-2xl">🤖</div>
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Generating your feedback...</h2>
        <p className="text-slate-400 max-w-xs">
          Our AI is analyzing your interview responses and preparing a detailed performance report.
        </p>
      </div>
      {/* Animated dots */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main Report Page ───────────────────────────────────────────────────────────
export default function ReportPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    const startTime = Date.now();
    const MAX_WAIT_MS = 90_000; // poll for up to 90 seconds
    const POLL_INTERVAL_MS = 4_000;

    async function tryFetch() {
      try {
        const r = await reportsApi.getReport(sessionId!);
        if (!cancelled) {
          setReport(r);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        // If it's a 404 and we haven't timed out, keep polling
        const is404 =
          typeof err === 'object' &&
          err !== null &&
          'response' in err &&
          (err as { response?: { status?: number } }).response?.status === 404;

        if (!cancelled) {
          if (is404 && Date.now() - startTime < MAX_WAIT_MS) {
            // Still generating — stay in loading state and retry
            return;
          }
          // Either a real error, or timed out
          setFetchError(
            is404
              ? 'Report is taking longer than expected. Please try refreshing the page in a moment.'
              : 'Failed to load report. Please try again later.'
          );
          setIsLoading(false);
        }
      }
    }

    // Start immediately then poll
    void tryFetch();
    const interval = setInterval(() => {
      if (cancelled) return;
      // Stop polling once we have the report or there's a hard error
      if (report || fetchError) {
        clearInterval(interval);
        return;
      }
      void tryFetch();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (isLoading) {
    return <ReportLoading />;
  }

  if (fetchError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="glass-card p-8 max-w-md text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">Report Unavailable</h2>
          <p className="text-slate-400 text-sm mb-6">{fetchError}</p>
          <Link to="/dashboard" className="btn-secondary">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const SUB_SCORES = [
    {
      key: 'communication',
      label: 'Communication',
      icon: '🗣️',
      data: { score: report.communication.score, maxScore: 10 },
      color: { text: 'text-indigo-400', bar: 'bg-indigo-500', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
    },
    {
      key: 'depth',
      label: 'Depth',
      icon: '🔍',
      data: { score: report.depth.score, maxScore: 10 },
      color: { text: 'text-violet-400', bar: 'bg-violet-500', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
    },
    {
      key: 'structure',
      label: 'Structure',
      icon: '🏗️',
      data: { score: report.structure.score, maxScore: 10 },
      color: { text: 'text-amber-400', bar: 'bg-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    },
    {
      key: 'confidence',
      label: 'Confidence',
      icon: '⚡',
      data: { score: report.confidence.score, maxScore: 10 },
      color: { text: 'text-emerald-400', bar: 'bg-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 page-enter">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="orb w-[600px] h-[600px] bg-indigo-700 -top-48 -right-32" style={{ opacity: 0.05 }}/>
        <div className="orb w-[400px] h-[400px] bg-violet-700 bottom-0 -left-16" style={{ opacity: 0.04 }}/>
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-slate-950/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="13" stroke="url(#rh1)" strokeWidth="2"/>
                <path d="M9 14c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="url(#rh1)" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="14" cy="17" r="3" fill="url(#rh1)"/>
                <defs>
                  <linearGradient id="rh1" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#818cf8"/>
                    <stop offset="1" stopColor="#c084fc"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="font-bold text-white text-lg tracking-tight">InterviewAI</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/interview/setup" className="btn-primary text-sm px-4 py-2">
              New Interview
            </Link>
            <Link to="/dashboard" className="btn-secondary text-sm px-4 py-2">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-10 space-y-8">
        {/* ── Hero Section ── */}
        <div className="glass-card p-8 text-center animate-[slideUp_0.4s_ease-out_forwards]">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-6">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path fillRule="evenodd" d="M11.78 4.22a.75.75 0 010 1.06l-6.25 6.25a.75.75 0 01-1.06 0L1.22 8.28a.75.75 0 011.06-1.06L5 9.94l5.72-5.72a.75.75 0 011.06 0z"/>
            </svg>
            Interview Complete
          </div>

          <h1 className="text-4xl font-black text-white mb-2">
            Your Performance{' '}
            <span className="gradient-text">Report</span>
          </h1>
          <p className="text-slate-400 mb-8">
            Here's a detailed breakdown of how you performed across all dimensions.
          </p>

          <div className="flex justify-center">
            <ScoreRing score={report.overallScore} size={180} />
          </div>

          <p className="text-slate-500 text-sm mt-4">Overall Score</p>
        </div>

        {/* ── Sub Scores ── */}
        <div className="animate-[slideUp_0.5s_ease-out_forwards]">
          <h2 className="section-heading mb-4">Performance Breakdown</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SUB_SCORES.map(({ key, label, icon, data, color }) => (
              <SubScoreCard
                key={key}
                label={label}
                icon={icon}
                score={data.score}
                maxScore={data.maxScore}
                color={color}
              />
            ))}
          </div>
        </div>

        {/* ── Strengths & Improvements ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-[slideUp_0.55s_ease-out_forwards]">
          {/* Strengths */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-emerald-400">
                  <path fillRule="evenodd" d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                </svg>
              </div>
              <h3 className="text-white font-bold">Strengths</h3>
            </div>
            <ul className="space-y-2.5">
              {report.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-emerald-400 mt-0.5 shrink-0">
                    <path fillRule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"/>
                  </svg>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Areas to Improve */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-amber-400">
                  <path fillRule="evenodd" d="M8 1a.75.75 0 01.75.75v6.5a.75.75 0 01-1.5 0v-6.5A.75.75 0 018 1zm0 10a1 1 0 110 2 1 1 0 010-2z"/>
                </svg>
              </div>
              <h3 className="text-white font-bold">Areas to Improve</h3>
            </div>
            <ul className="space-y-2.5">
              {report.improvements.map((imp, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-amber-400 mt-0.5 shrink-0">
                    <path fillRule="evenodd" d="M8.22 1.97a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06L9.28 11.53a.75.75 0 01-1.06-1.06l2.97-2.97H3.75a.75.75 0 010-1.5h7.44L8.22 3.03a.75.75 0 010-1.06z"/>
                  </svg>
                  <span>{imp}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Detailed Feedback ── */}
        <div className="glass-card p-6 animate-[slideUp_0.6s_ease-out_forwards]">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-indigo-400">
                <path d="M2 4.75A.75.75 0 012.75 4h10.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 3.5A.75.75 0 012.75 7.5h10.5a.75.75 0 010 1.5H2.75A.75.75 0 012 8.25zm0 3.5A.75.75 0 012.75 11h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 012 11.75z"/>
              </svg>
            </div>
            <h2 className="text-white font-bold">Detailed Feedback</h2>
          </div>
          <p className="text-slate-300 leading-relaxed text-sm">{report.detailedFeedback}</p>
        </div>

        {/* ── Q&A Breakdown ── */}
        <div className="animate-[slideUp_0.65s_ease-out_forwards]">
          <h2 className="section-heading mb-4">Question Breakdown</h2>
          <div className="glass-card overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5 flex items-center gap-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span className="w-5">#</span>
              <span className="flex-1">Question</span>
              <span className="shrink-0">Score</span>
              <span className="w-4"/>
            </div>
            {report.qaBreakdown.map((item, i) => (
              <QARow key={i} item={item} index={i} />
            ))}
          </div>
        </div>

        {/* ── CTAs ── */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pb-6 animate-[fadeIn_0.7s_ease-out_forwards]">
          <Link to="/interview/setup" className="btn-primary flex items-center justify-center gap-2 px-8">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7 1a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 017 1z"/>
            </svg>
            Start Another Interview
          </Link>
          <Link to="/dashboard" className="btn-secondary flex items-center justify-center gap-2 px-8">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M7.78 12.53a.75.75 0 01-1.06 0L2.47 8.28a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 1.06L4.81 7h7.44a.75.75 0 010 1.5H4.81l2.97 2.97a.75.75 0 010 1.06z"/>
            </svg>
            Back to Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
