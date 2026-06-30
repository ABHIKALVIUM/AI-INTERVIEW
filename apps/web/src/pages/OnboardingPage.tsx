import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../lib/api';

type Step = 1 | 2 | 3;
type ExperienceLevel = 'junior' | 'mid' | 'senior';

const EXPERIENCE_OPTIONS: { level: ExperienceLevel; title: string; description: string; years: string; icon: string }[] = [
  { level: 'junior', title: 'Junior', description: 'Just starting out or early in career', years: '0–2 years', icon: '🌱' },
  { level: 'mid', title: 'Mid-Level', description: 'Some experience, growing in expertise', years: '3–5 years', icon: '🚀' },
  { level: 'senior', title: 'Senior', description: 'Deep expertise and leadership experience', years: '6+ years', icon: '⚡' },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuthStore();

  const [step, setStep] = useState<Step>(1);
  const [displayName, setDisplayName] = useState(user?.name ?? '');
  const [jobRole, setJobRole] = useState('');
  const [experience, setExperience] = useState<ExperienceLevel | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');

  function goNext() {
    setDirection('forward');
    setStep((s) => Math.min(s + 1, 3) as Step);
  }

  function goBack() {
    setDirection('back');
    setStep((s) => Math.max(s - 1, 1) as Step);
  }

  async function handleComplete() {
    if (!experience) return;
    setIsLoading(true);
    try {
      const profileData = {
        name: displayName,
        jobRole,
        experienceLevel: experience,
        onboardingComplete: true,
      };
      updateProfile(profileData);
      await authApi.updateProfile(profileData).catch(() => {
        // Gracefully handle if profile endpoint doesn't exist yet
      });
      navigate('/dashboard');
    } finally {
      setIsLoading(false);
    }
  }

  const stepTitles = ['Personal Info', 'Your Target Role', 'Experience Level'];

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden px-4">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="orb w-[800px] h-[800px] bg-indigo-700 -top-1/2 -left-1/4 animate-[orb1_15s_ease-in-out_infinite]"
          style={{ opacity: 0.08 }}
        />
        <div
          className="orb w-[600px] h-[600px] bg-violet-600 bottom-0 right-0 animate-[orb2_12s_ease-in-out_infinite]"
          style={{ opacity: 0.06 }}
        />
      </div>

      <div className="relative z-10 w-full max-w-lg animate-[fadeIn_0.4s_ease-out_forwards]">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {([1, 2, 3] as Step[]).map((n) => (
              <div key={n} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500 ${
                      n < step
                        ? 'bg-indigo-600 text-white shadow-glow-indigo'
                        : n === step
                        ? 'bg-indigo-600/20 border-2 border-indigo-500 text-indigo-400'
                        : 'bg-slate-800 border border-slate-700 text-slate-600'
                    }`}
                  >
                    {n < step ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                      </svg>
                    ) : n}
                  </div>
                  <span className={`text-xs font-medium whitespace-nowrap transition-colors duration-300 ${
                    n === step ? 'text-indigo-400' : n < step ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    {stepTitles[n - 1]}
                  </span>
                </div>
                {n < 3 && (
                  <div className="flex-1 h-px mx-3 mt-[-16px] transition-all duration-500"
                    style={{
                      background: n < step
                        ? 'linear-gradient(90deg, #6366f1, #8b5cf6)'
                        : 'rgba(255,255,255,0.06)'
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Card */}
        <div className="glass-card p-8 shadow-glass overflow-hidden">
          <div
            key={step}
            className={`animate-[${direction === 'forward' ? 'slideInRight' : 'slideUp'}_0.35s_ease-out_forwards]`}
            style={{
              animation: direction === 'forward'
                ? 'slideInRight 0.35s ease-out forwards'
                : 'slideUp 0.35s ease-out forwards'
            }}
          >
            {/* ── Step 1: Name ── */}
            {step === 1 && (
              <div>
                <div className="mb-6">
                  <p className="text-indigo-400 text-sm font-semibold uppercase tracking-widest mb-2">Step 1 of 3</p>
                  <h2 className="text-3xl font-bold text-white leading-tight">
                    What should we{' '}
                    <span className="gradient-text">call you?</span>
                  </h2>
                  <p className="text-slate-400 mt-2">We'll personalize your interview experience.</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="displayName" className="label-text">Your name</label>
                    <input
                      id="displayName"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Alex"
                      className="input-field text-lg"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={goNext}
                    disabled={!displayName.trim()}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    Continue
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="evenodd" d="M8.22 2.97a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06l2.97-2.97H3.75a.75.75 0 010-1.5h7.44L8.22 4.03a.75.75 0 010-1.06z"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 2: Job Role ── */}
            {step === 2 && (
              <div>
                <div className="mb-6">
                  <p className="text-violet-400 text-sm font-semibold uppercase tracking-widest mb-2">Step 2 of 3</p>
                  <h2 className="text-3xl font-bold text-white leading-tight">
                    What role are you{' '}
                    <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                      aiming for?
                    </span>
                  </h2>
                  <p className="text-slate-400 mt-2">We'll tailor questions to your target position.</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="jobRole" className="label-text">Target role</label>
                    <input
                      id="jobRole"
                      type="text"
                      value={jobRole}
                      onChange={(e) => setJobRole(e.target.value)}
                      placeholder="e.g. Senior Software Engineer, Product Manager..."
                      className="input-field text-base"
                      autoFocus
                    />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={goBack} className="btn-secondary flex-1">
                      ← Back
                    </button>
                    <button
                      onClick={goNext}
                      disabled={!jobRole.trim()}
                      className="btn-primary flex-[2] flex items-center justify-center gap-2"
                    >
                      Continue
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path fillRule="evenodd" d="M8.22 2.97a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06l2.97-2.97H3.75a.75.75 0 010-1.5h7.44L8.22 4.03a.75.75 0 010-1.06z"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 3: Experience ── */}
            {step === 3 && (
              <div>
                <div className="mb-6">
                  <p className="text-emerald-400 text-sm font-semibold uppercase tracking-widest mb-2">Step 3 of 3</p>
                  <h2 className="text-3xl font-bold text-white leading-tight">
                    What's your{' '}
                    <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                      experience level?
                    </span>
                  </h2>
                  <p className="text-slate-400 mt-2">This helps us calibrate question difficulty.</p>
                </div>
                <div className="space-y-3 mb-5">
                  {EXPERIENCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.level}
                      onClick={() => setExperience(opt.level)}
                      className={`w-full text-left rounded-xl p-4 border transition-all duration-200 flex items-center gap-4 ${
                        experience === opt.level
                          ? 'bg-indigo-600/20 border-indigo-500/60 shadow-glow-indigo'
                          : 'bg-slate-800/50 border-slate-700 hover:border-slate-600 hover:bg-slate-800'
                      }`}
                    >
                      <span className="text-3xl">{opt.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold text-sm ${experience === opt.level ? 'text-indigo-300' : 'text-white'}`}>
                            {opt.title}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            experience === opt.level
                              ? 'bg-indigo-500/20 text-indigo-300'
                              : 'bg-slate-700 text-slate-400'
                          }`}>
                            {opt.years}
                          </span>
                        </div>
                        <p className="text-slate-400 text-xs mt-0.5">{opt.description}</p>
                      </div>
                      {experience === opt.level && (
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" className="text-indigo-400 shrink-0">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={goBack} className="btn-secondary flex-1">
                    ← Back
                  </button>
                  <button
                    onClick={handleComplete}
                    disabled={!experience || isLoading}
                    className="btn-primary flex-[2] flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Setting up...
                      </>
                    ) : (
                      <>
                        Let's go 🚀
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
