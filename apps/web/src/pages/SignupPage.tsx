import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { authApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export default function SignupPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const { user } = await authApi.signup(email, name, password);
      login(user);
      navigate('/onboarding');
    } catch (err: unknown) {
      let message = 'An error occurred during signup.';
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

  const passwordStrength = (): { label: string; color: string; width: string } => {
    if (password.length === 0) return { label: '', color: '', width: '0%' };
    if (password.length < 6) return { label: 'Weak', color: 'bg-rose-500', width: '25%' };
    if (password.length < 8) return { label: 'Fair', color: 'bg-amber-500', width: '50%' };
    if (password.length < 12) return { label: 'Good', color: 'bg-indigo-500', width: '75%' };
    return { label: 'Strong', color: 'bg-emerald-500', width: '100%' };
  };

  const strength = passwordStrength();

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden px-4 py-8">
      {/* Animated gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="orb w-[700px] h-[700px] bg-violet-600 -top-64 -right-32 animate-[orb2_14s_ease-in-out_infinite]"
          style={{ opacity: 0.1 }}
        />
        <div
          className="orb w-[500px] h-[500px] bg-indigo-600 -bottom-48 -left-24 animate-[orb1_18s_ease-in-out_infinite]"
          style={{ opacity: 0.1 }}
        />
        <div
          className="orb w-[200px] h-[200px] bg-sky-400 top-1/3 right-1/4 animate-[orb3_8s_ease-in-out_infinite]"
          style={{ opacity: 0.05 }}
        />
        {/* Grid overlay */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(139,92,246,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.03) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md animate-[slideUp_0.5s_ease-out_forwards]">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-600/20 border border-violet-500/30 mb-4">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="14" cy="14" r="13" stroke="url(#lg2)" strokeWidth="2"/>
              <path d="M9 14c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="url(#lg2)" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="14" cy="17" r="3" fill="url(#lg2)"/>
              <defs>
                <linearGradient id="lg2" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#818cf8"/>
                  <stop offset="1" stopColor="#c084fc"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">InterviewAI</h1>
          <p className="text-slate-500 text-sm mt-1">Start your journey to interview mastery</p>
        </div>

        <div className="glass-card p-8 shadow-glass">
          <h2 className="text-xl font-semibold text-white mb-1">Create your account</h2>
          <p className="text-slate-400 text-sm mb-6">Free to start — no credit card required.</p>

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
              <label htmlFor="name" className="label-text">Full name</label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Johnson"
                className="input-field"
                required
              />
            </div>

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
              <label htmlFor="password" className="label-text">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="input-field"
                required
              />
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    <div className="h-1 flex-1 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${strength.color}`}
                        style={{ width: strength.width }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Strength:{' '}
                    <span className={`font-medium ${
                      strength.label === 'Strong' ? 'text-emerald-400' :
                      strength.label === 'Good' ? 'text-indigo-400' :
                      strength.label === 'Fair' ? 'text-amber-400' : 'text-rose-400'
                    }`}>
                      {strength.label}
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="label-text">Confirm password</label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                className={`input-field ${
                  confirmPassword && confirmPassword !== password
                    ? 'border-rose-500/50 focus:ring-rose-500/30 focus:border-rose-500'
                    : confirmPassword && confirmPassword === password
                    ? 'border-emerald-500/50 focus:ring-emerald-500/30 focus:border-emerald-500'
                    : ''
                }`}
                required
              />
              {confirmPassword && confirmPassword === password && (
                <p className="mt-1 text-xs text-emerald-400 flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M10.28 3.28L5 8.56 2.72 6.28a.75.75 0 00-1.06 1.06l3 3a.75.75 0 001.06 0l6-6a.75.75 0 00-1.06-1.06z"/>
                  </svg>
                  Passwords match
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Creating account...
                </>
              ) : (
                <>
                  Get started free
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="evenodd" d="M8.22 2.97a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06l2.97-2.97H3.75a.75.75 0 010-1.5h7.44L8.22 4.03a.75.75 0 010-1.06z"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/5 text-center">
            <p className="text-slate-400 text-sm">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
