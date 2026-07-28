import {
    ArrowLeft,
    ArrowRight,
    Loader2,
    Mail,
    Moon,
    RefreshCw,
    ShieldCheck,
    Sun,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
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
      <p className="eyebrow mt-10">Verify your inbox</p>
      <h2 className="serif text-4xl xl:text-5xl mt-6 leading-[1.02] tracking-tightest text-ink-900 dark:text-paper-50">
        Six little <em className="italic text-accent-700 dark:text-accent-400">digits</em>. <br />
        The whole desk on the other side.
      </h2>
    </div>

    <div className="relative z-10 mt-14 paper-card p-8 animate-slide-up max-w-md">
      <div className="flex items-center gap-3">
        <Mail className="w-5 h-5 text-accent-700 dark:text-accent-400" />
        <p className="eyebrow !mb-0">Your OTP just landed</p>
      </div>
      <h3 className="serif text-2xl mt-5 text-ink-900 dark:text-paper-50 font-semibold leading-snug">
        Check your inbox (and the server console, since this is a demo) for a 6-digit code.
      </h3>
      <div className="rule-dashed my-6" />
      <ul className="space-y-3 text-sm text-ink-700 dark:text-ink-300">
        <li className="flex gap-3"><span className="mono text-accent-700 dark:text-accent-400 mt-0.5">01</span>The code expires in 10 minutes.</li>
        <li className="flex gap-3"><span className="mono text-accent-700 dark:text-accent-400 mt-0.5">02</span>Too many wrong guesses? Locked for 15 minutes.</li>
        <li className="flex gap-3"><span className="mono text-accent-700 dark:text-accent-400 mt-0.5">03</span>Request a new code if the first one doesn’t arrive.</li>
      </ul>
    </div>

    <div className="relative z-10 mono text-[11px] tracking-widest uppercase text-ink-400 dark:text-ink-500">
      One time · verified locally · no newsletter
    </div>
  </div>
);

const VerifyOtp = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // userId and email come from navigate state (preferred — Signup & Login
  // unverified redirects pass these), or fall back to AuthContext.user when
  // the user is mid-flow and has an unverified partial session.
  const startEmail = location.state?.email || user?.email || '';
  const startUserId = location.state?.userId || user?._id || '';
  const [email] = useState(startEmail);
  const [userIdFromState] = useState(startUserId);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)];
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [genericErr, setGenericErr] = useState('');

  // Resolve the active userId — state first, fall back to the
  // AuthContext user._id for legacy resend flows.
  const getUserId = () => userIdFromState || user?._id || '';

  useEffect(() => {
    setTimeout(() => inputs[0]?.current?.focus(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (i, raw) => {
    const v = raw.replace(/\D/g, '').slice(-1);
    setOtp((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
    if (v && i < 5) inputs[i + 1]?.current?.focus();
  };

  const handleKey = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) {
      inputs[i - 1]?.current?.focus();
    } else if (e.key === 'ArrowLeft' && i > 0) {
      inputs[i - 1]?.current?.focus();
    } else if (e.key === 'ArrowRight' && i < 5) {
      inputs[i + 1]?.current?.focus();
    } else if (e.key === 'Enter') {
      submit();
    }
  };

  const handlePaste = (e) => {
    const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const arr = text.split('');
    while (arr.length < 6) arr.push('');
    setOtp(arr);
    const next = Math.min(5, Math.max(0, arr.findIndex((c) => c === '') - 1));
    inputs[next >= 0 ? next : 5]?.current?.focus();
  };

  const resend = async () => {
    if (!email) {
      toast.error('No email associated — please sign up again.');
      navigate('/signup', { replace: true });
      return;
    }
    setResending(true);
    try {
      const res = await api.post('/auth/resend-otp', { email });
      const data = res.data?.data || res.data;
      // SECURITY FIX: only call login() here if we don't already have a
      // resolved userId, AND only persist the MINIMUM unverified state.
      // This populates AuthContext with { _id, email, isVerified: false }
      // so the user can progress, but ProtectedRoute still catches
      // isVerified === false and redirects BACK to /verify-otp — never Editor.
      const resolvedUid = getUserId();
      if (data?.userId && !resolvedUid) {
        login({
          ...(user || {}),
          _id: data.userId,
          email: data.email || email,
          isVerified: false,
        });
      }
      toast.success('A new code was sent.');
    } catch (err) {
      const status = err?.response?.status;
      const payload = err?.response?.data;
      const msg =
        status === 429
          ? 'Slow down on resends.'
          : status === 404
          ? 'No account with that email. Please sign up.'
          : payload?.message || payload?.error || 'Could not resend.';
      toast.error(msg);
      if (status === 404) {
        setTimeout(() => navigate('/signup', { replace: true }), 1200);
      }
    } finally {
      setResending(false);
    }
  };

  const submit = async () => {
    setGenericErr('');
    const code = otp.join('');
    if (!/^\d{6}$/.test(code)) {
      toast.error('Enter all 6 digits.');
      return;
    }
    const userId = getUserId();
    if (!userId) {
      toast.error('Missing session — please sign up again, or resend the code to restore it.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/auth/verify-otp', { userId, otp: code });
      const data = res.data?.data || res.data;
      login({
        token: data.token || user?.token,
        _id: data._id || userId,
        name: data.name || user?.name,
        email: data.email || email,
        isVerified: true,
        lastLoginAt: data.lastLoginAt,
      });
      toast.success('Email verified. Welcome to the desk.');
      navigate('/app/editor', { replace: true });
    } catch (err) {
      const status = err?.response?.status;
      const payload = err?.response?.data;
      const msg =
        status === 400
          ? payload?.message || payload?.error || 'Wrong code.'
          : status === 410
          ? 'Code expired. Request a new one.'
          : status === 404
          ? 'Session not found — please sign up again.'
          : payload?.message || payload?.error || 'Verification failed.';
      setGenericErr(msg);
      toast.error(msg);
      if (status === 404) {
        setTimeout(() => navigate('/signup', { replace: true }), 1200);
      }
    } finally {
      setSubmitting(false);
    }
  };

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
            {/* SECURITY FIX: Back link must never route to /app/editor for unverified users.
                Only go to editor if the AuthContext user is explicitly verified; otherwise
                fall back to /signup for a clean restart (the user already has their OTP
                on screen so this is a safe, in-flow default). */}
            <RouterLink
              to={user?.isVerified ? '/app/editor' : '/signup'}
              className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-paper-50 mb-6"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </RouterLink>

            <div>
              <p className="eyebrow mb-4 flex items-center gap-2">
                <ShieldCheck className="w-3 h-3 text-moss" />
                Email verification
              </p>
              <h1 className="serif text-4xl md:text-5xl leading-[1.02] tracking-tightest text-ink-900 dark:text-paper-50">
                Enter the <em className="italic text-accent-700 dark:text-accent-400">six digits</em> we just sent.
              </h1>
              {email && (
                <p className="mt-5 text-sm leading-relaxed text-ink-600 dark:text-ink-400">
                  Sent to <span className="font-semibold text-ink-800 dark:text-paper-100">{email}</span>.
                  Check the spam folder, or the server logs in dev mode.
                </p>
              )}
            </div>

            <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="mt-10" noValidate>
              <div className="grid grid-cols-6 gap-3">
                {inputs.map((r, i) => (
                  <input
                    key={i}
                    ref={r}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    type="text"
                    autoComplete="one-time-code"
                    className="field !px-0 !py-4 text-center serif text-2xl md:text-3xl font-semibold tracking-widest text-ink-900 dark:text-paper-50"
                    value={otp[i]}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKey(i, e)}
                    onPaste={i === 0 ? handlePaste : undefined}
                    aria-label={`Digit ${i + 1}`}
                  />
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between">
                <button
                  type="button"
                  onClick={resend}
                  disabled={resending}
                  className="btn-ghost"
                >
                  {resending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Resend code
                </button>
                <div className="mono text-[10px] uppercase tracking-widest text-ink-500 dark:text-ink-400">
                  Expires in 10:00
                </div>
              </div>

              {genericErr && (
                <p className="mt-6 text-sm text-accent-700 dark:text-accent-400 font-semibold">
                  {genericErr}
                </p>
              )}

              <button
                type="submit"
                className="btn-primary w-full justify-center py-3 text-base mt-8"
                disabled={submitting}
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Verify and enter desk
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        <div className="px-6 pb-8 text-center mono text-[10px] tracking-[0.25em] uppercase text-ink-400 dark:text-ink-500">
          ColdX · Set in Playfair Display and Inter · MIT licensed
        </div>
      </div>
    </div>
  );
};

export default VerifyOtp;
