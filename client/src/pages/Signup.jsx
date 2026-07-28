import {
    ArrowRight,
    Check,
    Eye,
    EyeOff,
    Loader2,
    Lock,
    Moon,
    Sparkles,
    Sun,
    UserPlus,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
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
      <p className="eyebrow mt-10">New to the desk</p>
      <h2 className="serif text-4xl xl:text-5xl mt-6 leading-[1.02] tracking-tightest text-ink-900 dark:text-paper-50">
        Blank page. <br />
        <em className="italic text-accent-700 dark:text-accent-400">Clean</em> drawers.
      </h2>
      <p className="mt-6 text-sm leading-relaxed text-ink-600 dark:text-ink-400 max-w-sm">
        Once you verify your email, your drafts become yours — searchable, exportable, and favorite-able across sessions.
      </p>
    </div>

    <ul className="relative z-10 mt-14 space-y-5 max-w-md">
      {[
        ['01', 'Four tones wired to different prompts.'],
        ['02', 'Edit inline, always. Nothing is read-only.'],
        ['03', 'Export as .txt or a typeset PDF.'],
        ['04', 'Hashed OTP, rate limits, input validation.'],
      ].map(([n, b]) => (
        <li key={n} className="flex items-start gap-4 animate-stagger-in">
          <span className="mono text-accent-700 dark:text-accent-400 mt-0.5 text-sm">{n}</span>
          <p className="text-sm text-ink-700 dark:text-ink-300 leading-relaxed">{b}</p>
        </li>
      ))}
    </ul>

    <div className="relative z-10 mono text-[11px] tracking-widest uppercase text-ink-400 dark:text-ink-500">
      No credit card · no newsletter · MIT licensed
    </div>
  </div>
);

const PwRule = ({ ok, label }) => (
  <li className={`flex items-center gap-2 text-xs ${ok ? 'text-moss' : 'text-ink-500 dark:text-ink-400'}`}>
    {ok ? (
      <Check className="w-3.5 h-3.5" />
    ) : (
      <X className="w-3.5 h-3.5" />
    )}
    <span>{label}</span>
  </li>
);

const Signup = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [genericErr, setGenericErr] = useState('');

  const rules = useMemo(() => {
    const p = password;
    return {
      length: p.length >= 8 && p.length <= 128,
      upper: /[A-Z]/.test(p),
      lower: /[a-z]/.test(p),
      digit: /\d/.test(p),
    };
  }, [password]);

  const pwValid = rules.length && rules.upper && rules.lower && rules.digit;
  const pwStrength = Object.values(rules).filter(Boolean).length;

  const onSubmit = async (e) => {
    e.preventDefault();
    setGenericErr('');
    if (!name.trim()) {
      toast.error('Add your name (letters only, 2–100 characters).');
      return;
    }
    if (!email) {
      toast.error('Enter an email.');
      return;
    }
    if (!pwValid) {
      toast.error('Password needs 8–128 chars, upper, lower, and a digit.');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords don’t match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post('/auth/register', { name: name.trim(), email, password });
      const data = res.data?.data || res.data;
      // SECURITY FIX: do NOT call AuthContext.login() here. Register
      // /register intentionally does NOT issue a token nor set isVerified.
      // Persisting a partial { token: undefined, isVerified: undefined } object
      // would bypass ProtectedRoute's isVerified gate and leak the /app/editor page
      // to unverified users. Instead we pass userId+email via navigate state
      // so VerifyOtp reads them on the next screen.
      const userId = data?._id || data?.userId;
      const navigateEmail = data?.email || email;
      toast.success('Check your email (or the terminal) for the 6-digit code.');
      navigate('/verify-otp', {
        state: { email: navigateEmail, userId, reason: 'just-registered' },
        replace: true,
      });
    } catch (err) {
      const status = err?.response?.status;
      const payload = err?.response?.data;
      const fieldErrors = Array.isArray(payload?.errors) ? payload.errors : [];
      if (fieldErrors.length) {
        const first = fieldErrors[0];
        const fieldLabel = first.field ? `${first.field}: ` : '';
        const msg = `${fieldLabel}${first.message || first.msg || 'Validation failed.'}`;
        setGenericErr(msg);
        toast.error(msg);
      } else {
        const msg =
          status === 409
            ? 'That email already has an account — try signing in.'
            : status === 429
            ? 'Too many signups from this location right now.'
            : payload?.message || payload?.error || 'Something went wrong.';
        setGenericErr(msg);
        toast.error(msg);
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
            <div>
              <p className="eyebrow mb-4 flex items-center gap-2">
                <UserPlus className="w-3 h-3 text-accent-700 dark:text-accent-400" />
                Sign up
              </p>
              <h1 className="serif text-4xl md:text-5xl leading-[1.02] tracking-tightest text-ink-900 dark:text-paper-50">
                You’re one <br />
                <em className="italic text-accent-700 dark:text-accent-400">draft</em> away.
              </h1>
              <p className="mt-5 text-sm leading-relaxed text-ink-600 dark:text-ink-400">
                A 6-digit OTP will be sent to your email. It’s the demo flow — no newsletter, no marketing.
              </p>
            </div>

            <form onSubmit={onSubmit} className="mt-10 space-y-5" noValidate>
              <div>
                <label className="label" htmlFor="name">
                  Full name
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  className="field"
                  value={name}
                  onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z\s'-]/g, ''))}
                  placeholder="Harry Smith"
                  required
                  maxLength={100}
                />
              </div>

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
                <label className="label" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="field !pr-12"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Make it long"
                    required
                    maxLength={128}
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
                <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <PwRule ok={rules.length} label="8 to 128 characters" />
                  <PwRule ok={rules.upper} label="Uppercase letter" />
                  <PwRule ok={rules.lower} label="Lowercase letter" />
                  <PwRule ok={rules.digit} label="At least one digit" />
                </ul>
                <div className="mt-3 h-1.5 rounded-full overflow-hidden bg-paper-200 dark:bg-ink-800 flex">
                  {[1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className={`flex-1 first:rounded-l-full last:rounded-r-full transition-colors ${
                        pwStrength >= i
                          ? pwValid
                            ? 'bg-moss'
                            : 'bg-accent-600 dark:bg-accent-500'
                          : 'bg-transparent'
                      }`}
                      style={i > 1 ? { borderLeft: '3px solid transparent' } : undefined}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="label" htmlFor="confirm">
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    id="confirm"
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="field !pr-12"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="One more time"
                    required
                    maxLength={128}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-ink-400 dark:text-ink-500 hover:text-ink-700 dark:hover:text-ink-300"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirm && (
                  <p className={`mt-2 text-xs flex items-center gap-2 ${
                    password === confirm ? 'text-moss' : 'text-accent-700 dark:text-accent-400'
                  }`}>
                    {password === confirm ? (
                      <><Check className="w-3.5 h-3.5" /> Passwords match.</>
                    ) : (
                      <><X className="w-3.5 h-3.5" /> Passwords don’t match yet.</>
                    )}
                  </p>
                )}
              </div>

              {genericErr && (
                <p className="text-sm text-accent-700 dark:text-accent-400 font-semibold">
                  {genericErr}
                </p>
              )}

              <button
                type="submit"
                className="btn-primary w-full justify-center py-3 text-base"
                disabled={submitting}
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Create account
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="rule-dashed my-10" />

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-ink-600 dark:text-ink-400">
              <p>Already have an account?</p>
              <RouterLink to="/login" className="btn-outline w-full sm:w-auto justify-center">
                <Lock className="w-4 h-4" />
                Sign in
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

export default Signup;
