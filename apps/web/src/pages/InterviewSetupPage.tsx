import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { sessionsApi } from '../lib/api';
import type { InterviewType } from '../store/interviewStore';

interface InterviewCard {
  type: InterviewType;
  title: string;
  persona: string;
  personaTitle: string;
  description: string;
  bullets: string[];
  icon: string;
  theme: {
    gradient: string;
    border: string;
    badge: string;
    badgeText: string;
    button: string;
    glow: string;
    accent: string;
  };
}

const INTERVIEW_CARDS: InterviewCard[] = [
  {
    type: 'behavioral',
    title: 'Behavioral Interview',
    persona: 'Sarah',
    personaTitle: 'Sr. Engineering Manager',
    description: 'STAR-method questions exploring past experiences and how you handled challenging situations.',
    bullets: ['Leadership & teamwork scenarios', 'Conflict resolution', 'Growth mindset & adaptability'],
    icon: '🧠',
    theme: {
      gradient: 'from-indigo-600/20 via-slate-900/50 to-slate-900/80',
      border: 'border-indigo-500/30 hover:border-indigo-400/60',
      badge: 'bg-indigo-500/15 border-indigo-500/30',
      badgeText: 'text-indigo-300',
      button: 'bg-indigo-600 hover:bg-indigo-500',
      glow: 'hover:shadow-glow-indigo',
      accent: 'text-indigo-400',
    },
  },
  {
    type: 'technical',
    title: 'Technical Interview',
    persona: 'Sarah',
    personaTitle: 'Staff Software Engineer',
    description: 'Live coding challenges, algorithm problems, and data structure questions with real-time feedback.',
    bullets: ['Algorithms & data structures', 'Code quality & optimization', 'Problem decomposition'],
    icon: '⚡',
    theme: {
      gradient: 'from-emerald-600/20 via-slate-900/50 to-slate-900/80',
      border: 'border-emerald-500/30 hover:border-emerald-400/60',
      badge: 'bg-emerald-500/15 border-emerald-500/30',
      badgeText: 'text-emerald-300',
      button: 'bg-emerald-600 hover:bg-emerald-500',
      glow: 'hover:shadow-glow-emerald',
      accent: 'text-emerald-400',
    },
  },
  {
    type: 'system_design',
    title: 'System Design',
    persona: 'Sarah',
    personaTitle: 'Principal Architect',
    description: 'Architect large-scale distributed systems under real-world constraints and trade-off decisions.',
    bullets: ['Scalability & reliability patterns', 'Database & caching strategies', 'API design & microservices'],
    icon: '🏗️',
    theme: {
      gradient: 'from-amber-600/20 via-slate-900/50 to-slate-900/80',
      border: 'border-amber-500/30 hover:border-amber-400/60',
      badge: 'bg-amber-500/15 border-amber-500/30',
      badgeText: 'text-amber-300',
      button: 'bg-amber-600 hover:bg-amber-500',
      glow: 'hover:shadow-[0_0_30px_rgba(245,158,11,0.4)]',
      accent: 'text-amber-400',
    },
  },
  {
    type: 'hr',
    title: 'HR / Culture Fit',
    persona: 'Sarah',
    personaTitle: 'Talent Acquisition Lead',
    description: 'Values alignment, cultural fit, and career motivation questions to assess your fit for the team.',
    bullets: ['Career goals & motivations', 'Company values alignment', 'Salary negotiation practice'],
    icon: '🌟',
    theme: {
      gradient: 'from-rose-600/20 via-slate-900/50 to-slate-900/80',
      border: 'border-rose-500/30 hover:border-rose-400/60',
      badge: 'bg-rose-500/15 border-rose-500/30',
      badgeText: 'text-rose-300',
      button: 'bg-rose-600 hover:bg-rose-500',
      glow: 'hover:shadow-glow-rose',
      accent: 'text-rose-400',
    },
  },
];

export default function InterviewSetupPage() {
  const navigate = useNavigate();
  const [loadingType, setLoadingType] = useState<InterviewType | null>(null);

  async function handleBeginInterview(type: InterviewType) {
    setLoadingType(type);
    try {
      const session = await sessionsApi.createSession(type);
      navigate(`/interview/${session.id}`);
    } catch {
      setLoadingType(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 page-enter">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="orb w-[700px] h-[700px] bg-indigo-700 -top-64 -left-32 animate-[orb1_15s_ease-in-out_infinite]"
          style={{ opacity: 0.07 }}
        />
        <div
          className="orb w-[500px] h-[500px] bg-violet-700 bottom-0 right-0 animate-[orb2_12s_ease-in-out_infinite]"
          style={{ opacity: 0.06 }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-slate-950/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link
            to="/dashboard"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-200 flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M7.78 12.53a.75.75 0 01-1.06 0L2.47 8.28a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 1.06L4.81 7h7.44a.75.75 0 010 1.5H4.81l2.97 2.97a.75.75 0 010 1.06z"/>
            </svg>
            <span className="text-sm font-medium">Dashboard</span>
          </Link>
          <div className="w-px h-5 bg-slate-700"/>
          <h1 className="text-white font-semibold">Choose Interview Type</h1>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-10">
        <div className="text-center mb-10 animate-[slideUp_0.4s_ease-out_forwards]">
          <h2 className="text-4xl font-bold text-white mb-3">
            Select your{' '}
            <span className="gradient-text">interview format</span>
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            Practice with our AI personas who adapt to your experience level and give real-time, actionable feedback.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {INTERVIEW_CARDS.map((card, i) => (
            <div
              key={card.type}
              className={`relative group rounded-2xl border bg-gradient-to-br ${card.theme.gradient} ${card.theme.border}
                          transition-all duration-300 overflow-hidden cursor-pointer
                          ${card.theme.glow} hover:-translate-y-1 shadow-card hover:shadow-card-hover`}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              {/* Corner shine effect */}
              <div className="absolute top-0 right-0 w-32 h-32 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                <div className="absolute top-0 right-0 w-full h-full"
                  style={{
                    background: 'radial-gradient(circle at top right, rgba(255,255,255,0.04), transparent 70%)'
                  }}
                />
              </div>

              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">{card.icon}</div>
                    <div>
                      <h3 className="text-white font-bold text-lg leading-tight">{card.title}</h3>
                      <div className={`inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-full text-xs font-medium border ${card.theme.badge} ${card.theme.badgeText}`}>
                        <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-xs">
                          {card.persona[0]}
                        </div>
                        with {card.persona} · {card.personaTitle}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-slate-400 text-sm leading-relaxed mb-4">{card.description}</p>

                {/* Bullets */}
                <ul className="space-y-2 mb-6">
                  {card.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-slate-300 text-sm">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" className={card.theme.accent}>
                        <path fillRule="evenodd" d="M11.78 4.22a.75.75 0 010 1.06l-6.25 6.25a.75.75 0 01-1.06 0L1.22 8.28a.75.75 0 011.06-1.06L5 9.94l5.72-5.72a.75.75 0 011.06 0z"/>
                      </svg>
                      {b}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  onClick={() => handleBeginInterview(card.type)}
                  disabled={loadingType !== null}
                  className={`w-full py-3 px-5 rounded-xl text-white font-semibold text-sm
                              transition-all duration-200 flex items-center justify-center gap-2
                              ${card.theme.button}
                              disabled:opacity-50 disabled:cursor-not-allowed
                              hover:-translate-y-0.5 active:translate-y-0`}
                >
                  {loadingType === card.type ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Setting up room...
                    </>
                  ) : (
                    <>
                      Begin Interview with {card.persona}
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                        <path fillRule="evenodd" d="M6.22 1.97a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06L7.28 11.53a.75.75 0 01-1.06-1.06l2.97-2.97H2.75a.75.75 0 010-1.5h6.44L6.22 3.03a.75.75 0 010-1.06z"/>
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-center text-slate-600 text-sm mt-8">
          Each session is approximately 20–30 minutes. You'll receive a detailed report when complete.
        </p>
      </main>
    </div>
  );
}
