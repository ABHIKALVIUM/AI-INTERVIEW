import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { authApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { user } = await authApi.login(email, password);
      login(user);
      navigate(user.onboardingComplete ? '/dashboard' : '/onboarding');
    } catch (err: unknown) {
      let message = 'Invalid email or password.';
      if (isAxiosError(err) && err.response?.data?.message) {
        message = err.response.data.message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden px-4">
      {/* Animated gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="orb w-[600px] h-[600px] bg-indigo-600 -top-64 -left-32 animate-[orb1_12s_ease-in-out_infinite]"
          style={{ opacity: 0.12 }}
        />
        <div
          className="orb w-[500px] h-[500px] bg-violet-600 -bottom-48 -right-24 animate-[orb2_16s_ease-in-out_infinite]"
          style={{ opacity: 0.1 }}
        />
        <div
          className="orb w-[300px] h-[300px] bg-indigo-400 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-[orb3_10s_ease-in-out_infinite]"
          style={{ opacity: 0.06 }}
        />
        {/* Grid overlay */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md animate-[slideUp_0.5s_ease-out_forwards]">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 mb-4 shadow-glow-indigo">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="14" cy="14" r="13" stroke="url(#lg1)" strokeWidth="2"/>
              <path d="M9 14c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="url(#lg1)" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="14" cy="17" r="3" fill="url(#lg1)"/>
              <defs>
                <linearGradient id="lg1" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#818cf8"/>
                  <stop offset="1" stopColor="#c084fc"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">InterviewAI</h1>
          <p className="text-slate-500 text-sm mt-1">Ace your next interview with AI coaching</p>
        </div>

        <div className="glass-card p-8 shadow-glass">
          <h2 className="text-xl font-semibold text-white mb-1">Sign in to your account</h2>
          <p className="text-slate-400 text-sm mb-6">Welcome back! Let's continue your practice.</p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 4a.75.75 0 01.75.75v2.5a.75.75 0 01-1.5 0v-2.5A.75.75 0 018 5zm0 7a1 1 0 110-2 1 1 0 010 2z"/>
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label-text">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-field"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="label-text mb-0">Password</label>
                <button type="button" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                  Forgot password?
                </button>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-field"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="evenodd" d="M8.22 2.97a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06l2.97-2.97H3.75a.75.75 0 010-1.5h7.44L8.22 4.03a.75.75 0 010-1.06z"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/5 text-center">
            <p className="text-slate-400 text-sm">
              Don't have an account?{' '}
              <Link
                to="/signup"
                className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                Create one free
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          By signing in, you agree to our{' '}
          <span className="text-slate-500 hover:text-slate-400 cursor-pointer transition-colors">Terms</span>
          {' '}and{' '}
          <span className="text-slate-500 hover:text-slate-400 cursor-pointer transition-colors">Privacy Policy</span>
        </p>
      </div>
    </div>
  );
}
