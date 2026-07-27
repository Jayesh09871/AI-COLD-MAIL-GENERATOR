import { Link as RouterLink } from 'react-router-dom';
import {
  ArrowRight,
  PenLine,
  Mail,
  MessageSquare,
  Repeat2,
  BookmarkPlus,
  Search,
  Sun,
  Moon,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const Logo = ({ compact = false }) => (
  <span className="inline-flex items-baseline gap-1 select-none">
    <svg
      viewBox="0 0 24 24"
      width={compact ? 14 : 16}
      height={compact ? 14 : 16}
      className="mb-0.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      <path d="M8 7h8" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
    </svg>
    <span className={`serif font-semibold tracking-tightest ${compact ? 'text-lg' : 'text-xl'} text-ink-900 dark:text-paper-50`}>
      Draftwell
    </span>
  </span>
);

const Navbar = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="relative z-20 border-b border-ink-200/70 dark:border-ink-700/80 bg-paper-100/70 dark:bg-ink-900/50 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 md:px-10 h-20 flex items-center justify-between">
        <RouterLink to="/" className="shrink-0">
          <Logo />
        </RouterLink>

        <nav className="hidden md:flex items-center gap-10">
          <a href="#process" className="text-sm text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-paper-50 tracking-wide transition-colors">
            Process
          </a>
          <a href="#features" className="text-sm text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-paper-50 tracking-wide transition-colors">
            The Workbench
          </a>
          <a href="#letters" className="text-sm text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-paper-50 tracking-wide transition-colors">
            Example Letters
          </a>
          <a href="#pricing" className="text-sm text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-paper-50 tracking-wide transition-colors">
            Open Source
          </a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            aria-label="Toggle theme"
            onClick={toggleTheme}
            className="p-2.5 rounded-sm border border-transparent hover:border-ink-200 dark:hover:border-ink-700 text-ink-600 dark:text-ink-300 hover:text-ink-900 dark:hover:text-paper-50 hover:bg-paper-50 dark:hover:bg-ink-800 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {user ? (
            <>
              <RouterLink to="/app/editor" className="btn-ghost hidden sm:inline-flex">
                Editor
              </RouterLink>
              <button onClick={logout} className="btn-outline">
                Log out
              </button>
            </>
          ) : (
            <>
              <RouterLink to="/login" className="btn-ghost hidden sm:inline-flex">
                Log in
              </RouterLink>
              <RouterLink to="/signup" className="btn-primary">
                Start writing
                <ArrowRight className="w-4 h-4" />
              </RouterLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

const Hero = () => (
  <section className="relative z-10 border-b border-ink-200/70 dark:border-ink-700/80">
    <div className="max-w-7xl mx-auto px-6 md:px-10 pt-20 pb-24 md:pt-28 md:pb-32 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
      <div className="lg:col-span-6 relative">
        <p className="eyebrow mb-6">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent-700 dark:bg-accent-500" />
          Issue 01 · A journal for thoughtful outreach
        </p>
        <h1 className="serif text-5xl sm:text-6xl md:text-7xl leading-[0.98] tracking-tightest text-ink-900 dark:text-paper-50">
          Outreach that <em className="italic text-accent-700 dark:text-accent-400">reads</em> like
          writing, <br />
          not like a prompt.
        </h1>
        <p className="mt-8 text-lg leading-relaxed text-ink-700 dark:text-ink-300 max-w-xl">
          Draftwell is a drafting desk for cold emails, LinkedIn messages, and follow-ups.
          Every output is typeset as a document you'd actually sign — because the last thing
          anyone wants to open is another AI-spam sausage.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <RouterLink to="/signup" className="btn-primary px-6 py-3 text-base">
            Begin a draft
            <PenLine className="w-4 h-4" />
          </RouterLink>
          <a href="#features" className="btn-outline px-6 py-3 text-base">
            See the workbench
          </a>
        </div>

        <dl className="mt-16 grid grid-cols-3 gap-6 max-w-md">
          {[
            { k: '2.1s', v: 'avg. draft time' },
            { k: '4×', v: 'variants per run' },
            { k: '0', v: 'gradient blobs' },
          ].map((s) => (
            <div key={s.v}>
              <dt className="serif text-3xl text-ink-900 dark:text-paper-50 font-semibold tracking-tight">
                {s.k}
              </dt>
              <dd className="mt-1 text-[11px] uppercase tracking-[0.2em] text-ink-500 dark:text-ink-400 font-semibold">
                {s.v}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="lg:col-span-6 relative">
        <div className="sticky top-10">
          <div className="sheet p-10 md:p-12 max-w-xl ml-auto animate-slide-up">
            <div className="flex items-center justify-between border-b border-ink-200 dark:border-ink-700 pb-5">
              <div>
                <p className="eyebrow">Cover letter · Draft 03</p>
                <h3 className="serif text-2xl mt-1.5 text-ink-900 dark:text-paper-50">
                  To: Head of Platform, Stripe
                </h3>
              </div>
              <span className="chip">
                <Mail className="w-3 h-3" />
                Cold Email
              </span>
            </div>

            <div className="mt-6 doc-body dark:text-paper-100">
              <p className="text-xs text-ink-500 dark:text-ink-400 mb-2">
                Subject: <span className="font-semibold text-ink-700 dark:text-ink-300">Systems engineer tightening your checkout tail latency</span>
              </p>
              <p className="drop-cap text-ink-800 dark:text-paper-100">
                I noticed you opened a Platform role last week and are migrating Ruby services onto a new Rust-based payments core — the kind of work where the
                difference between “it ships” and “it scales” is a week of profiling and a careful
                rewrite. In 2023 I reduced p99 checkout latency at a Series B fintech by 42% by
                replacing a fan-out DB read with a precomputed Redis pipeline and removing a
                redundant identity hop. I’d send you the PR if it weren’t still under their walls.
              </p>
              <p className="mt-4 text-ink-800 dark:text-paper-100">
                Could we trade 20 minutes next Tuesday? I’m not chasing a title; I’m looking for
                the team that wants one fewer thing to worry about at 2am.
              </p>
              <p className="mt-5 text-ink-800 dark:text-paper-100">
                — Jayesh
              </p>
            </div>

            <div className="mt-8 pt-5 rule-dashed flex items-center justify-between text-xs text-ink-500 dark:text-ink-400">
              <span className="mono">Formal · 87 words · 2-minute read</span>
              <span className="inline-flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-accent-600 dark:text-accent-500" />
                Edited 1× by human
              </span>
            </div>
          </div>
          <div className="absolute -bottom-8 -left-6 w-28 h-28 border border-ink-300 dark:border-ink-700 rounded-sm rotate-[-4deg] bg-paper-50/40 dark:bg-ink-800/40 shadow-paper-sm -z-10 opacity-80" />
          <div className="absolute -top-6 -right-4 w-24 h-28 border border-accent-300 dark:border-accent-800 rounded-sm rotate-[5deg] bg-accent-50/60 dark:bg-accent-900/30 shadow-paper-sm -z-10 opacity-80" />
        </div>
      </div>
    </div>
  </section>
);

const Process = () => {
  const steps = [
    {
      n: '01',
      h: 'Set the context',
      b: 'Describe the recipient, your angle, and the ask in plain sentences — or pick one of the starting templates.',
      icon: <PenLine className="w-5 h-5" />,
    },
    {
      n: '02',
      h: 'Choose a voice',
      b: 'Formal, casual, persuasive, or short-and-direct. Draftwell rewrites the system prompt, not just the adjectives.',
      icon: <MessageSquare className="w-5 h-5" />,
    },
    {
      n: '03',
      h: 'Rewrite in the margins',
      b: 'Edit inline, swap variants, regenerate just a subject or a follow-up. The AI is a first-draft partner, not the author.',
      icon: <Repeat2 className="w-5 h-5" />,
    },
    {
      n: '04',
      h: 'Send or archive',
      b: 'Tag it, favorite it, export PDF/TXT, and mark it sent or replied when it lands. Nothing evaporates.',
      icon: <BookmarkPlus className="w-5 h-5" />,
    },
  ];
  return (
    <section id="process" className="relative z-10 border-b border-ink-200/70 dark:border-ink-700/80">
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-24 md:py-32">
        <div className="max-w-2xl mb-16">
          <p className="eyebrow mb-4">How this actually works</p>
          <h2 className="serif text-4xl md:text-5xl leading-tight tracking-tightest text-ink-900 dark:text-paper-50">
            Four steps from blank page to a letter you’d actually hit <em className="italic text-accent-700 dark:text-accent-400">send</em>.
          </h2>
        </div>
        <ol className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-14">
          {steps.map((s, i) => (
            <li
              key={s.n}
              className="relative pl-24 animate-stagger-in"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="absolute left-0 top-0 serif text-6xl text-ink-200 dark:text-ink-700 font-semibold -mt-2">
                {s.n}
              </span>
              <h3 className="serif text-2xl text-ink-900 dark:text-paper-50 font-semibold tracking-tight flex items-center gap-3">
                <span className="p-2 rounded-sm border border-ink-200 dark:border-ink-700 bg-paper-50 dark:bg-ink-800 text-accent-700 dark:text-accent-400">
                  {s.icon}
                </span>
                {s.h}
              </h3>
              <p className="mt-4 leading-relaxed text-ink-700 dark:text-ink-300">{s.b}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};

const Features = () => {
  const items = [
    {
      h: 'Voice-first generation',
      b: 'Four tone presets wire up entirely different prompts, not just thesaurus swaps.',
      tag: 'Tones',
    },
    {
      h: 'Editable output, always',
      b: 'Click any paragraph and rewrite it. Draftwell remembers your edits in the saved draft.',
      tag: 'Inline edit',
    },
    {
      h: 'A proper paper trail',
      b: 'Searchable history with tags, favorites, and sent/replied status — like a mini CRM for your outreach.',
      tag: 'CRM-lite',
    },
    {
      h: 'Export as real documents',
      b: 'Download as .txt or a properly typeset PDF, not a screenshot pasted into Notion.',
      tag: 'PDF/TXT',
    },
    {
      h: 'Side-by-side variants',
      b: 'Generate 2–3 variants in one pass and compare before you pick the version that sounds like you.',
      tag: 'A/B variants',
    },
    {
      h: 'Engineered, not vibes',
      b: 'Rate limits, input sanitization, JWT auth, hashed OTP, and the boring-but-important things that separate a portfolio piece from homework.',
      tag: 'Secure',
    },
  ];
  return (
    <section id="features" className="relative z-10 border-b border-ink-200/70 dark:border-ink-700/80">
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-24 md:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-20">
          <div className="lg:col-span-4 lg:sticky lg:top-10 h-fit">
            <p className="eyebrow mb-4">The workbench</p>
            <h2 className="serif text-4xl md:text-5xl leading-tight tracking-tightest text-ink-900 dark:text-paper-50">
              Built to look like <em className="italic text-accent-700 dark:text-accent-400">craft</em>.
            </h2>
            <p className="mt-6 leading-relaxed text-ink-700 dark:text-ink-300 max-w-md">
              If every AI app on your feed is wearing the same outfit, Draftwell is the one
              wearing a tailored jacket and reading a real book.
            </p>
            <RouterLink to="/signup" className="mt-10 btn-primary">
              Make an account
              <ArrowRight className="w-4 h-4" />
            </RouterLink>
          </div>

          <ul className="lg:col-span-8 divide-y divide-ink-200 dark:divide-ink-700 border-t border-b border-ink-200 dark:border-ink-700">
            {items.map((f, i) => (
              <li
                key={f.h}
                className="grid grid-cols-12 gap-6 py-8 hover:bg-paper-50/40 dark:hover:bg-ink-800/40 transition-colors px-2 -mx-2 rounded-sm animate-stagger-in"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="col-span-3 md:col-span-2">
                  <span className="chip">{f.tag}</span>
                </div>
                <div className="col-span-9 md:col-span-10">
                  <h3 className="serif text-2xl text-ink-900 dark:text-paper-50 font-semibold tracking-tight">
                    {f.h}
                  </h3>
                  <p className="mt-2 leading-relaxed text-ink-700 dark:text-ink-300">{f.b}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

const Samples = () => {
  const samples = [
    {
      t: 'Formal',
      subj: 'Backend engineer focused on reliability at scale',
      body:
        'I’m writing because I’ve spent the last three years owning the reliability surface of a consumer app that spikes 6× on event nights — the kind of Tuesday where a single stale connection pool can cost you six figures before morning coffee.',
    },
    {
      t: 'Short & direct',
      subj: '20-min chat on your platform roadmap?',
      body:
        'Your last two engineering posts describe exactly the kind of systems work I do. I can save your team one painful incident this year. Coffee next week?',
    },
    {
      t: 'Persuasive',
      subj: 'The migration tool you’ll wish you’d had last quarter',
      body:
        'I built a schema-change runner last year that let my team ship 3× more migrations with zero data-loss incidents. I know you’re mid-migration because I read your recent postmortem. Happy to share — no pitch.',
    },
  ];
  return (
    <section id="letters" className="relative z-10 border-b border-ink-200/70 dark:border-ink-700/80">
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-24 md:py-32">
        <div className="flex items-end justify-between flex-wrap gap-6 mb-16">
          <div className="max-w-2xl">
            <p className="eyebrow mb-4">Letters from the archive</p>
            <h2 className="serif text-4xl md:text-5xl leading-tight tracking-tightest text-ink-900 dark:text-paper-50">
              Every tone, the <em className="italic text-accent-700 dark:text-accent-400">same</em> draft.
            </h2>
          </div>
          <span className="mono text-xs tracking-wider text-ink-500 dark:text-ink-400 uppercase">
            — Three takes, one prompt
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {samples.map((s, i) => (
            <article
              key={s.t}
              className="sheet p-7 flex flex-col animate-slide-up"
              style={{ animationDelay: `${i * 120}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className="chip chip-active">{s.t}</span>
                <Mail className="w-4 h-4 text-ink-500 dark:text-ink-400" />
              </div>
              <p className="mt-5 text-xs uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400 font-semibold">
                Subject
              </p>
              <h3 className="serif text-lg mt-1 text-ink-900 dark:text-paper-50 font-semibold leading-snug">
                {s.subj}
              </h3>
              <div className="rule-dashed my-6" />
              <p className="doc-body text-ink-800 dark:text-paper-100">{s.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

const OpenSource = () => (
  <section id="pricing" className="relative z-10 border-b border-ink-200/70 dark:border-ink-700/80">
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-24 md:py-32">
      <div className="sheet p-10 md:p-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-center">
          <div className="md:col-span-8">
            <p className="eyebrow mb-4">Free forever · for portfolios</p>
            <h2 className="serif text-4xl md:text-5xl leading-tight tracking-tightest text-ink-900 dark:text-paper-50">
              MIT licensed. No rate-limit wall. Built to be <em className="italic text-accent-700 dark:text-accent-400">linked</em> in a résumé.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-ink-700 dark:text-ink-300 max-w-2xl">
              You’re building this to show you can build real things. So we kept the stack
              honest: Express + Mongo + Vite + React, with structured logging, rate limits,
              input validation, hashed OTP, graceful shutdown, and a real document-style UI.
            </p>
          </div>
          <div className="md:col-span-4">
            <RouterLink to="/signup" className="btn-primary w-full justify-center py-3 text-base">
              Try the editor
              <Search className="w-4 h-4" />
            </RouterLink>
            <RouterLink to="/login" className="btn-outline w-full justify-center mt-3 py-3 text-base">
              I already have an account
            </RouterLink>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const Footer = () => (
  <footer className="relative z-10 bg-paper-100/60 dark:bg-ink-900/60">
    <div className="max-w-7xl mx-auto px-6 md:px-10 py-14">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-10">
        <div>
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-ink-600 dark:text-ink-400 max-w-sm">
            An opinionated drafting desk for thoughtful outreach. Made for people who still
            read what they’re about to send.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-10 text-sm">
          <div>
            <p className="label">Product</p>
            <ul className="space-y-3">
              <li><RouterLink to="/app/editor" className="text-ink-700 hover:text-ink-900 dark:text-ink-300 dark:hover:text-paper-50">Editor</RouterLink></li>
              <li><RouterLink to="/app/history" className="text-ink-700 hover:text-ink-900 dark:text-ink-300 dark:hover:text-paper-50">Archive</RouterLink></li>
              <li><a href="#features" className="text-ink-700 hover:text-ink-900 dark:text-ink-300 dark:hover:text-paper-50">Workbench</a></li>
            </ul>
          </div>
          <div>
            <p className="label">Writing</p>
            <ul className="space-y-3">
              <li><a href="#letters" className="text-ink-700 hover:text-ink-900 dark:text-ink-300 dark:hover:text-paper-50">Sample letters</a></li>
              <li><a href="#process" className="text-ink-700 hover:text-ink-900 dark:text-ink-300 dark:hover:text-paper-50">Process</a></li>
            </ul>
          </div>
          <div>
            <p className="label">Legal</p>
            <ul className="space-y-3">
              <li className="text-ink-500 dark:text-ink-400">Privacy — coming soon</li>
              <li className="text-ink-500 dark:text-ink-400">Terms — coming soon</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="rule-dashed mt-12 mb-6" />
      <p className="mono text-xs text-ink-500 dark:text-ink-400 tracking-widest uppercase">
        © {new Date().getFullYear()} Draftwell · Set in Playfair Display and Inter · Made in a text editor, not a prompt.
      </p>
    </div>
  </footer>
);

const LandingPage = () => (
  <div className="relative min-h-screen flex flex-col">
    <Navbar />
    <main className="relative z-10 flex-1">
      <Hero />
      <Process />
      <Features />
      <Samples />
      <OpenSource />
    </main>
    <Footer />
  </div>
);

export default LandingPage;
