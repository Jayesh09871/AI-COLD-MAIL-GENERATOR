import {
    AlertTriangle,
    ArrowRight,
    Eye,
    EyeOff,
    Loader2,
    Lock,
    Moon,
    Sun,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../utils/api';

const LogoMark = () => (
  <span className="inline-flex items-baseline gap-1 select-none">
    <svg viewBox="0 0 24 24" width={16} height={16} className="mb-0.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      <path d="M8 7h8" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
    </svg>
    <span className="serif font-semibold tracking-tightest text-xl text-ink-900 dark:text-paper-50">
      ColdX
    </span>
  </span>
);

const PaperPanel = () => (
  <div className="hidden lg:flex lg:flex-col lg:justify-between p-14 xl:p-20 bg-paper-100 dark:bg-ink-900/80 border-r border-ink-200 dark:border-ink-800 relative overflow-hidden">
    <div className="relative z-10">
      <RouterLink to="/" className="inline-flex">
        <LogoMark />
      </RouterLink>
      <p className="eyebrow mt-10">Issue 01 · From the desk</p>
      <h2 className="serif text-4xl xl:text-5xl mt-6 leading-[1.02] tracking-tightest text-ink-900 dark:text-paper-50">
        A writer of drafts. <br />
        <em className="italic text-accent-700 dark:text-accent-400">Not</em> a sender of spam.
      </h2>
    </div>

    <div className="relative z-10 mt-16 sheet p-8 shadow-paper-sm animate-slide-up max-w-md">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Cover letter · Unsaved</p>
        <span className="chip">
          <Lock className="w-3 h-3" />
          Sign in to save
        </span>
      </div>
      <p className="mt-5 text-xs uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400 font-semibold">
        Subject
      </p>
      <h3 className="serif text-lg mt-1.5 text-ink-900 dark:text-paper-50 font-semibold leading-snug">
        Product designer with a portfolio of shipped design systems
      </h3>
      <div className="rule-dashed my-5" />
      <p className="drop-cap text-[15px] leading-[1.9] text-ink-800 dark:text-paper-100">
        I read your post last week on the cost of inconsistent components. I’ve been on three
        teams that wrote the same button four times, and the one that didn’t still has a $40k
        accessibility debt. I’d like to spare you that — and send you the audit I ran if it’s
        useful. Twenty minutes next Wednesday?
      </p>
      <p className="mt-4 text-[15px] leading-[1.9] text-ink-800 dark:text-paper-100">— Mira</p>
      <div className="mt-6 pt-4 rule-dashed flex items-center justify-between text-xs text-ink-500 dark:text-ink-400">
        <span className="mono">Persuasive · 122 words</span>
        <span className="mono">3 min before editing</span>
      </div>
    </div>

    <div className="relative z-10 mono text-[11px] tracking-widest uppercase text-ink-400 dark:text-ink-500">
      Log in · and pick up where your last draft left off
    </div>
  </div>
);

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lockSecs, setLockSecs] = useState(0);
  const [genericErr, setGenericErr] = useState('');

  useEffect(() => {
    if (lockSecs <= 0) return;
    const t = setInterval(() => setLockSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [lockSecs]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setGenericErr('');
    if (!email || !password) {
      toast.error('Enter an email and password.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      const data = res.data?.data || res.data;
      login({
        token: data.token,
        _id: data._id,
        name: data.name,
        email: data.email,
        isVerified: data.isVerified,
        lastLoginAt: data.lastLoginAt,
      });
      toast.success('Welcome back.');
      navigate('/app/editor', { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      const payload = err?.response?.data;
      const retryAfter = payload?.retryAfterSeconds;
      if (status === 423 && typeof retryAfter === 'number') {
        setLockSecs(retryAfter);
      }
      const rawMsg = payload?.message || payload?.error || '';
      // SECURITY FIX: handle the "Please verify your email first" 401
      // response the server returns when password is correct but isVerified === false.
      // Server includes `userId` in the response. Navigate to OTP verify screen
      // so the user can finish verification instead of being stuck on login.
      const isUnverified =
        status === 401 &&
        /verify.*(email|your)|email.*not.*verified/i.test(rawMsg || '');
      if (isUnverified) {
        const navigateUserId = payload?.userId;
        toast.error(rawMsg);
        navigate('/verify-otp', {
          replace: true,
          state: {
            email,
            userId: navigateUserId,
            reason: 'unverified-login',
          },
        });
        return;
      }
      const msg =
        status === 423
          ? `Too many attempts. Account locked for ${Math.ceil(retryAfter / 60)} minutes.`
          : status === 401
          ? rawMsg || 'Email or password didn’t match.'
          : status === 429
          ? 'Too many requests. Slow down and try again.'
          : rawMsg || 'Something went wrong.';
      setGenericErr(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const mins = Math.floor(lockSecs / 60);
  const secs = lockSecs % 60;

  return (
    <div className="min-h-screen flex relative">
      <button
        type="button"
        aria-label="Toggle theme"
        onClick={toggleTheme}
        className="fixed top-5 right-5 z-20 p-2.5 rounded-sm border border-transparent hover:border-ink-200 dark:hover:border-ink-700 text-ink-600 dark:text-ink-300 hover:text-ink-900 dark:hover:text-paper-50 hover:bg-paper-50 dark:hover:bg-ink-800/70 bg-paper-100/70 dark:bg-ink-900/60 backdrop-blur-sm"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <PaperPanel />

      <div className="flex-1 flex flex-col">
        <div className="lg:hidden px-6 pt-8 flex items-center justify-between">
          <RouterLink to="/"><LogoMark /></RouterLink>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-12 lg:py-16">
          <div className="w-full max-w-md animate-fade-in">
            <div>
              <p className="eyebrow mb-4">Sign in</p>
              <h1 className="serif text-4xl md:text-5xl leading-[1.02] tracking-tightest text-ink-900 dark:text-paper-50">
                Welcome back <br />
                to the desk.
              </h1>
              <p className="mt-5 text-sm leading-relaxed text-ink-600 dark:text-ink-400">
                You need to verify your email on your first sign-in. After that, it’s straight to work.
              </p>
            </div>

            {lockSecs > 0 && (
              <div className="mt-8 p-4 rounded-sm border border-accent-300 dark:border-accent-800 bg-accent-50 dark:bg-accent-900/20 flex items-start gap-3 animate-fade-in">
                <AlertTriangle className="w-5 h-5 text-accent-700 dark:text-accent-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-accent-800 dark:text-accent-300">
                    Temporarily locked
                  </p>
                  <p className="mt-1 text-sm text-accent-700 dark:text-accent-400">
                    Too many failed attempts. Retry in{' '}
                    <span className="mono font-semibold">
                      {mins}:{String(secs).padStart(2, '0')}
                    </span>
                    .
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={onSubmit} className="mt-10 space-y-5" noValidate>
              <div>
                <label className="label" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.trim())}
                  placeholder="you@company.com"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label !mb-0" htmlFor="password">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => toast("If you've lost your password, make a new account for now — this demo doesn't have a reset flow.")}
                    className="text-xs text-accent-700 dark:text-accent-400 hover:underline underline-offset-4"
                  >
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="field !pr-12"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="8+ characters"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-ink-400 dark:text-ink-500 hover:text-ink-700 dark:hover:text-ink-300"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {genericErr && (
                <p className="text-sm text-accent-700 dark:text-accent-400 font-semibold">
                  {genericErr}
                </p>
              )}

              <button
                type="submit"
                className="btn-primary w-full justify-center py-3 text-base"
                disabled={submitting || lockSecs > 0}
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
                ) : (
                  <>Sign in <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>

            <div className="rule-dashed my-10" />

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-ink-600 dark:text-ink-400">
              <p>New here?</p>
              <RouterLink to="/signup" className="btn-outline w-full sm:w-auto justify-center">
                Create an account
                <ArrowRight className="w-4 h-4" />
              </RouterLink>
            </div>
          </div>
        </div>

        <div className="px-6 pb-8 text-center mono text-[10px] tracking-[0.25em] uppercase text-ink-400 dark:text-ink-500">
          ColdX · Set in Playfair Display and Inter · MIT licensed
        </div>
      </div>
    </div>
  );
};

export default Login;
