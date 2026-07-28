import {
    ArchiveRestore,
    Bookmark,
    BookmarkCheck,
    CheckCircle2,
    ClipboardPaste,
    Copy,
    Download,
    Eye,
    FileDown,
    FileText,
    FileText as FileTextIcon,
    Inbox,
    Loader2,
    Minus,
    Plus,
    ReplyAll,
    RotateCcw,
    Send,
    SendHorizonal,
    Sparkles,
    Star,
    Tag as TagIcon,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../utils/api';

const statusOptions = [
  { id: 'draft', label: 'Draft', icon: <FileTextIcon className="w-3.5 h-3.5" /> },
  { id: 'sent', label: 'Sent', icon: <SendHorizonal className="w-3.5 h-3.5" /> },
  { id: 'replied', label: 'Replied', icon: <ReplyAll className="w-3.5 h-3.5" /> },
  { id: 'archived', label: 'Archived', icon: <ArchiveRestore className="w-3.5 h-3.5" /> },
];

const statusColor = (id) => {
  switch (id) {
    case 'sent':
      return 'text-moss dark:text-moss bg-moss/10 border-moss/40';
    case 'replied':
      return 'text-accent-700 dark:text-accent-400 bg-accent-50 dark:bg-accent-900/30 border-accent-300 dark:border-accent-800';
    case 'archived':
      return 'text-ink-500 dark:text-ink-400 bg-ink-100 dark:bg-ink-800/60 border-ink-200 dark:border-ink-700';
    default:
      return 'text-ink-700 dark:text-ink-300 bg-paper-100 dark:bg-ink-800/60 border-ink-200 dark:border-ink-700';
  }
};

const emptyVariant = (variantId = 'v-1') => ({
  variantId,
  selected: variantId === 'v-1',
  subject: '',
  emailBody: '',
  linkedInDM: '',
  followUpEmail: '',
});

const emptyDraft = () => ({
  _id: null,
  prompt: '',
  tone: 'formal',
  templateId: 'blank',
  variants: [emptyVariant('v-1')],
  tags: [],
  isFavorite: false,
  status: 'draft',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const copyToClipboard = async (text, label = 'Copied to clipboard') => {
  try {
    await navigator.clipboard.writeText(text || '');
    toast.success(label);
    return true;
  } catch {
    toast.error('Clipboard blocked — copy manually');
    return false;
  }
};

const Editor = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [tones, setTones] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(Boolean(id));
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [numVariants, setNumVariants] = useState(1);

  const [draft, setDraft] = useState(emptyDraft());
  const [activeVariantId, setActiveVariantId] = useState('v-1');
  const [tagInput, setTagInput] = useState('');

  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/ai/tones');
        if (Array.isArray(res.data?.tones)) setTones(res.data.tones);
      } catch {
        setTones([
          { id: 'formal', label: 'Formal', description: 'Professional & respectful' },
          { id: 'casual', label: 'Casual', description: 'Friendly & conversational' },
          { id: 'persuasive', label: 'Persuasive', description: 'Confident & compelling' },
          { id: 'short-and-direct', label: 'Short & direct', description: 'Punchy & no fluff' },
        ]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!id) return;
    setIsLoadingExisting(true);
    (async () => {
      try {
        const res = await api.get(`/ai/history/${id}`);
        const data = res.data?.data || res.data;
        if (!data) throw new Error('Not found');
        const hasVariants = Array.isArray(data.variants) && data.variants.length > 0;
        const normalized = {
          ...data,
          variants: hasVariants
            ? data.variants
            : [
                {
                  variantId: 'v-1',
                  selected: true,
                  subject: data.subject || '',
                  emailBody: data.emailBody || '',
                  linkedInDM: data.linkedInDM || '',
                  followUpEmail: data.followUpEmail || '',
                },
              ],
        };
        setDraft(normalized);
        const active = normalized.variants.find((v) => v.selected) || normalized.variants[0];
        setActiveVariantId(active.variantId);
        setNumVariants(Math.max(1, normalized.variants.length));
      } catch (err) {
        const status = err?.response?.status;
        toast.error(status === 404 ? 'Draft not found' : 'Could not load draft');
        navigate('/app/editor', { replace: true });
      } finally {
        setIsLoadingExisting(false);
      }
    })();
  }, [id, navigate]);

  const activeVariant = useMemo(
    () => draft.variants.find((v) => v.variantId === activeVariantId) || draft.variants[0],
    [draft.variants, activeVariantId]
  );

  const toneLabel = useMemo(
    () => (tones.find((t) => t.id === draft.tone)?.label || draft.tone),
    [tones, draft.tone]
  );

  const subject = activeVariant?.subject || '';
  const emailBody = activeVariant?.emailBody || '';
  const linkedInDM = activeVariant?.linkedInDM || '';
  const followUpEmail = activeVariant?.followUpEmail || '';

  const updateDraft = (patch) => {
    setIsDirty(true);
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const updateActiveVariant = (patch) => {
    setIsDirty(true);
    setDraft((prev) => ({
      ...prev,
      variants: prev.variants.map((v) =>
        v.variantId === activeVariantId ? { ...v, ...patch } : v
      ),
    }));
  };

  const setTagList = (tags) => {
    const sanitized = tags
      .map((t) => (t || '').trim().slice(0, 50))
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 20);
    updateDraft({ tags: sanitized });
  };

  const addTag = (raw) => {
    const next = (raw || '').trim().slice(0, 50);
    if (!next) return;
    if (draft.tags.includes(next)) {
      setTagInput('');
      return;
    }
    setTagList([...draft.tags, next]);
    setTagInput('');
  };

  const removeTag = (t) => setTagList(draft.tags.filter((x) => x !== t));

  const validateBeforeGenerate = () => {
    if (!draft.prompt.trim()) {
      toast.error('Write a note about the recipient and what you want them to do.');
      return false;
    }
    if (draft.prompt.trim().length < 15) {
      toast.error('Please add a bit more context (15+ characters).');
      return false;
    }
    if (numVariants < 1 || numVariants > 3) {
      toast.error('Pick 1–3 variants.');
      return false;
    }
    return true;
  };

  const handleGenerate = async () => {
    if (!validateBeforeGenerate()) return;
    setIsGenerating(true);
    const toastId = toast.loading('Drafting on the desk…');
    try {
      const res = await api.post('/ai/generate-email', {
        prompt: draft.prompt,
        tone: draft.tone,
        templateId: draft.templateId,
        numVariants,
      });
      const data = res.data?.data || res.data;
      const incoming = Array.isArray(data?.variants) && data.variants.length > 0;
      const newDraft = {
        ...draft,
        _id: data?._id || draft._id,
        createdAt: data?.createdAt || draft.createdAt,
        updatedAt: data?.updatedAt || draft.updatedAt,
        tone: data?.tone || draft.tone,
        prompt: data?.prompt || draft.prompt,
        tags: data?.tags || draft.tags,
        isFavorite: data?.isFavorite ?? draft.isFavorite,
        status: data?.status || draft.status,
        variants: incoming
          ? data.variants.map((v, i) => ({ ...emptyVariant(v.variantId || `v-${i + 1}`), ...v, selected: i === 0 }))
          : [
              {
                ...emptyVariant('v-1'),
                subject: data?.subject || '',
                emailBody: data?.emailBody || '',
                linkedInDM: data?.linkedInDM || '',
                followUpEmail: data?.followUpEmail || '',
                selected: true,
              },
            ],
      };
      setDraft(newDraft);
      setActiveVariantId(newDraft.variants[0].variantId);
      setNumVariants(newDraft.variants.length);
      setIsDirty(false);
      toast.success('Draft is on the page. Now make it yours.', { id: toastId });
    } catch (err) {
      const status = err?.response?.status;
      const msg =
        status === 429
          ? 'You’re generating too fast — wait a moment and try again.'
          : status === 401
          ? 'Your session expired. Please log in again.'
          : err?.response?.data?.error || 'Something interrupted the draft.';
      toast.error(msg, { id: toastId });
      if (status === 401) navigate('/login', { replace: true });
    } finally {
      setIsGenerating(false);
    }
  };

  const saveDraftChanges = async (opts = {}) => {
    if (!draft._id) return { ok: false };
    setIsSaving(true);
    const toastId = opts.silent ? null : toast.loading('Saving edits…');
    try {
      const payload = {
        prompt: draft.prompt,
        tone: draft.tone,
        tags: draft.tags,
        isFavorite: draft.isFavorite,
        status: draft.status,
        variants: draft.variants,
      };
      const res = await api.patch(`/ai/history/${draft._id}`, payload);
      const data = res.data?.data || res.data;
      if (data) {
        setDraft((prev) => ({ ...prev, ...data }));
        setIsDirty(false);
        if (toastId) toast.success('Saved.', { id: toastId });
        return { ok: true };
      }
      throw new Error('No response');
    } catch (err) {
      if (toastId) toast.error(err?.response?.data?.error || 'Could not save', { id: toastId });
      return { ok: false };
    } finally {
      setIsSaving(false);
    }
  };

  const toggleFavorite = async () => {
    const target = !draft.isFavorite;
    if (draft._id) {
      try {
        await api.post(`/ai/history/${draft._id}/favorite`);
      } catch (err) {
        toast.error(err?.response?.data?.error || 'Could not update favorite');
        return;
      }
    }
    updateDraft({ isFavorite: target });
    toast.success(target ? 'Marked as a favorite draft.' : 'Removed from favorites.');
  };

  const changeStatus = async (nextStatus) => {
    if (draft._id) {
      try {
        await api.patch(`/ai/history/${draft._id}`, { status: nextStatus });
      } catch (err) {
        toast.error(err?.response?.data?.error || 'Could not update status');
        return;
      }
    }
    updateDraft({ status: nextStatus });
    toast.success(
      nextStatus === 'sent' ? 'Marked as sent.' :
      nextStatus === 'replied' ? 'Marked as replied — nice.' :
      nextStatus === 'archived' ? 'Archived.' :
      'Back to draft.'
    );
  };

  const exportFile = async (format) => {
    if (!draft._id) {
      toast.error('Generate or save a draft first, then export.');
      return;
    }
    const toastId = toast.loading(`Preparing ${format.toUpperCase()}…`);
    try {
      const res = await api.get(`/ai/history/${draft._id}/export`, {
        params: { format },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], {
        type:
          format === 'pdf'
            ? 'application/pdf'
            : 'text/plain;charset=utf-8',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      const slug = (subject || 'coldx-draft').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'draft';
      a.href = url;
      a.download = `${slug}-${date}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} ready.`, { id: toastId });
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not export', { id: toastId });
    }
  };

  const copySection = async (label, text) => {
    await copyToClipboard(text, `${label} copied.`);
  };

  if (isLoadingExisting) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-5 h-5 animate-spin text-accent-700 dark:text-accent-400" />
          <span className="mono text-xs uppercase tracking-[0.3em] text-ink-500 dark:text-ink-400">
            Pulling draft from the archive…
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="px-6 md:px-10 lg:px-14 py-8 md:py-10 border-b border-ink-200 dark:border-ink-700/80 bg-paper-100/50 dark:bg-ink-900/40">
        <div className="flex items-start justify-between flex-wrap gap-6">
          <div className="max-w-2xl">
            <p className="eyebrow mb-3">
              {id ? 'Editing an existing draft' : 'A blank page — the best kind.'}
            </p>
            <h1 className="serif text-3xl md:text-4xl leading-tight tracking-tightest text-ink-900 dark:text-paper-50">
              {subject?.trim() ? (
                <>“{subject.length > 78 ? subject.slice(0, 78) + '…' : subject}”</>
              ) : (
                <>New draft <span className="text-ink-400 dark:text-ink-500">· {toneLabel}</span></>
              )}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-600 dark:text-ink-400 max-w-xl">
              ColdX writes the first take. You make it sound like you.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={toggleFavorite}
              className={`btn-outline ${draft.isFavorite ? 'border-accent-400 dark:border-accent-700 text-accent-700 dark:text-accent-400 bg-accent-50/60 dark:bg-accent-900/20' : ''}`}
              title={draft.isFavorite ? 'Remove favorite' : 'Add to favorites'}
            >
              {draft.isFavorite ? (
                <><BookmarkCheck className="w-4 h-4" /> Favorite</>
              ) : (
                <><Bookmark className="w-4 h-4" /> Favorite</>
              )}
            </button>

            <div className="group relative">
              <button
                type="button"
                className="btn-outline"
                id="export-btn"
                onClick={() => exportFile('txt')}
                title="Quick TXT export"
              >
                <FileDown className="w-4 h-4" />
                Export
              </button>
              <div className="hidden group-hover:flex absolute right-0 top-full mt-2 z-20 w-48 border border-ink-200 dark:border-ink-700 bg-paper-50 dark:bg-ink-800 shadow-paper-lg rounded-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => exportFile('txt')}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-ink-700 dark:text-ink-300 hover:bg-paper-100 dark:hover:bg-ink-700/50"
                >
                  <FileTextIcon className="w-4 h-4" />
                  Plain text (.txt)
                </button>
                <button
                  type="button"
                  onClick={() => exportFile('pdf')}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-ink-700 dark:text-ink-300 hover:bg-paper-100 dark:hover:bg-ink-700/50"
                >
                  <FileDown className="w-4 h-4" />
                  PDF (.pdf)
                </button>
              </div>
            </div>

            <div className="group relative">
              <button
                type="button"
                className={`btn-outline !rounded-sm !border ${statusColor(draft.status)}`}
              >
                {statusOptions.find((s) => s.id === draft.status)?.icon}
                {statusOptions.find((s) => s.id === draft.status)?.label}
              </button>
              <div className="absolute right-0 top-full mt-2 z-20 w-52 border border-ink-200 dark:border-ink-700 bg-paper-50 dark:bg-ink-800 shadow-paper-lg rounded-sm overflow-hidden hidden group-hover:block animate-fade-in">
                {statusOptions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => changeStatus(s.id)}
                    className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left ${
                      draft.status === s.id
                        ? 'bg-paper-100 dark:bg-ink-700/50 text-ink-900 dark:text-paper-50'
                        : 'text-ink-700 dark:text-ink-300 hover:bg-paper-100 dark:hover:bg-ink-700/50'
                    }`}
                  >
                    {s.icon}
                    <span className="flex-1">{s.label}</span>
                    {draft.status === s.id && <CheckCircle2 className="w-4 h-4 text-moss" />}
                  </button>
                ))}
              </div>
            </div>

            {draft._id && isDirty && (
              <button
                type="button"
                onClick={() => saveDraftChanges()}
                disabled={isSaving || isGenerating}
                className="btn-accent"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isSaving ? 'Saving…' : 'Save edits'}
              </button>
            )}

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || isSaving}
              className="btn-primary"
            >
              {isGenerating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Drafting…</>
              ) : draft._id ? (
                <><RotateCcw className="w-4 h-4" /> Regenerate</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Write first draft</>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 px-6 md:px-10 lg:px-14 py-8 md:py-10">
        <section className="xl:col-span-5 space-y-8">
          <div className="paper-card p-6 md:p-7 space-y-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Drafting desk</p>
                <h2 className="serif text-2xl mt-2 text-ink-900 dark:text-paper-50">
                  The brief
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.readText?.().then((t) => {
                    if (t) {
                      updateDraft({ prompt: (draft.prompt ? draft.prompt + '\n' : '') + t });
                      toast.success('Pasted into the brief.');
                    }
                  }).catch(() => {});
                }}
                className="btn-ghost"
              >
                <ClipboardPaste className="w-4 h-4" />
                Paste
              </button>
            </div>

            <div>
              <label className="label" htmlFor="prompt">
                Recipient · context · ask
              </label>
              <textarea
                id="prompt"
                className="field field-textarea h-56 !py-4 !leading-relaxed font-serif !text-[15.5px]"
                placeholder="Who are you writing to, what do you want them to do, and what one thing makes you worth responding to? Paste notes — anything shorter than a blank page works."
                value={draft.prompt}
                onChange={(e) => updateDraft({ prompt: e.target.value })}
                spellCheck={false}
              />
              <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
                The better the brief, the less rewriting you’ll do. One or two paragraphs is plenty.
              </p>
            </div>

            <div>
              <label className="label">Tone</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(tones.length ? tones : [
                  { id: 'formal', label: 'Formal', description: '' },
                  { id: 'casual', label: 'Casual', description: '' },
                  { id: 'persuasive', label: 'Persuasive', description: '' },
                  { id: 'short-and-direct', label: 'Short & direct', description: '' },
                ]).map((t) => {
                  const active = draft.tone === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => updateDraft({ tone: t.id })}
                      className={`text-left p-3.5 rounded-sm border transition-all ${
                        active
                          ? 'border-ink-900 dark:border-paper-50 bg-ink-900 dark:bg-paper-50 text-paper-50 dark:text-ink-900 shadow-paper-sm'
                          : 'border-ink-200 dark:border-ink-700 bg-paper-50 dark:bg-ink-800/60 hover:border-ink-300 dark:hover:border-ink-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`serif text-base font-semibold tracking-tight ${active ? '' : 'text-ink-900 dark:text-paper-50'}`}>
                          {t.label}
                        </span>
                        <span
                          className={`mono text-[10px] tracking-widest uppercase ${
                            active ? 'opacity-80' : 'text-ink-400 dark:text-ink-500'
                          }`}
                        >
                          {active ? '● selected' : 'choose'}
                        </span>
                      </div>
                      {t.description && (
                        <p className={`mt-2 text-sm leading-relaxed ${active ? 'opacity-80' : 'text-ink-600 dark:text-ink-400'}`}>
                          {t.description}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="label">Template</label>
                <select
                  className="field"
                  value={draft.templateId}
                  onChange={(e) => updateDraft({ templateId: e.target.value })}
                >
                  <option value="blank">Blank sheet</option>
                  <option value="cold-outreach">Cold outreach</option>
                  <option value="cover-letter">Cover letter</option>
                  <option value="follow-up">Follow-up</option>
                  <option value="linkedin-intro">LinkedIn intro</option>
                </select>
              </div>
              <div>
                <label className="label">Variants</label>
                <div className="field !p-0 flex items-center !px-3 gap-3">
                  <button
                    type="button"
                    aria-label="Fewer variants"
                    onClick={() => setNumVariants((n) => Math.max(1, n - 1))}
                    disabled={numVariants <= 1}
                    className="p-1.5 rounded-sm text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-paper-50 hover:bg-paper-100 dark:hover:bg-ink-700/50 disabled:opacity-40"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="mono text-ink-700 dark:text-ink-300 tracking-widest text-sm flex-1 text-center">
                    {numVariants} {numVariants === 1 ? 'variant' : 'variants'}
                  </span>
                  <button
                    type="button"
                    aria-label="More variants"
                    onClick={() => setNumVariants((n) => Math.min(3, n + 1))}
                    disabled={numVariants >= 3}
                    className="p-1.5 rounded-sm text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-paper-50 hover:bg-paper-100 dark:hover:bg-ink-700/50 disabled:opacity-40"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="label">
                Tags <span className="font-normal text-xs opacity-70">· Up to 20, 50 characters each</span>
              </label>
              <div className="flex flex-wrap items-center gap-2 border border-ink-200 dark:border-ink-700 bg-paper-50 dark:bg-ink-800/60 min-h-[48px] px-3 py-2 rounded-sm focus-within:border-ink-900 dark:focus-within:border-paper-50 focus-within:shadow-[0_0_0_3px_rgba(28,25,23,0.08)] dark:focus-within:shadow-[0_0_0_3px_rgba(251,248,242,0.08)]">
                {draft.tags.map((t) => (
                  <span
                    key={t}
                    className="chip chip-active items-center !px-2.5 !py-1 gap-1.5"
                  >
                    <TagIcon className="w-3 h-3 opacity-80" />
                    {t}
                    <button
                      type="button"
                      aria-label={`Remove ${t} tag`}
                      onClick={() => removeTag(t)}
                      className="opacity-80 hover:opacity-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  className="flex-1 min-w-[120px] bg-transparent text-sm py-1 outline-none text-ink-700 dark:text-ink-300 placeholder:text-ink-400 dark:placeholder:text-ink-500"
                  placeholder={draft.tags.length ? 'Add another…' : 'Add tags — press Enter, comma, or Tab'}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
                      if (tagInput.trim()) e.preventDefault();
                      addTag(tagInput);
                    } else if (e.key === 'Backspace' && !tagInput && draft.tags.length) {
                      setTagList(draft.tags.slice(0, -1));
                    }
                  }}
                  onBlur={() => {
                    if (tagInput.trim()) addTag(tagInput);
                  }}
                  maxLength={50}
                />
              </div>
              <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
                Used later to filter your archive. Try things like “series-b”, “design-led”, “follow-up”.
              </p>
            </div>
          </div>

          <div className="paper-card p-6 md:p-7">
            <p className="eyebrow mb-3">Marginalia</p>
            <ul className="text-sm leading-relaxed space-y-3 text-ink-600 dark:text-ink-400">
              <li className="flex gap-3">
                <span className="mono text-accent-700 dark:text-accent-400 mt-0.5">01</span>
                Name the person’s recent work. Generic compliments land with a thud.
              </li>
              <li className="flex gap-3">
                <span className="mono text-accent-700 dark:text-accent-400 mt-0.5">02</span>
                Give one concrete proof point, not a portfolio dump.
              </li>
              <li className="flex gap-3">
                <span className="mono text-accent-700 dark:text-accent-400 mt-0.5">03</span>
                Keep the ask small. A 20-minute Tuesday is easier to say yes to than “pick your brain”.
              </li>
            </ul>
          </div>
        </section>

        <section className="xl:col-span-7 space-y-8">
          {draft.variants.length > 1 && (
            <div className="paper-card p-3 flex items-center gap-2 flex-wrap">
              <span className="eyebrow !mb-0 pl-3 pr-2">Variants</span>
              {draft.variants.map((v, i) => {
                const active = v.variantId === activeVariantId;
                return (
                  <button
                    key={v.variantId}
                    type="button"
                    onClick={() => setActiveVariantId(v.variantId)}
                    className={`px-3.5 py-2 rounded-sm text-sm flex items-center gap-2 transition-colors border ${
                      active
                        ? 'bg-ink-900 dark:bg-paper-50 text-paper-50 dark:text-ink-900 border-ink-900 dark:border-paper-50 shadow-paper-sm'
                        : 'bg-paper-50 dark:bg-ink-800/60 text-ink-700 dark:text-ink-300 border-ink-200 dark:border-ink-700 hover:border-ink-300 dark:hover:border-ink-600'
                    }`}
                  >
                    <span className="mono text-[10px] opacity-70">V{i + 1}</span>
                    <span>{v.subject?.trim() ? (v.subject.length > 32 ? v.subject.slice(0, 32) + '…' : v.subject) : 'Untitled variant'}</span>
                  </button>
                );
              })}
            </div>
          )}

          <article className="sheet p-8 md:p-12 xl:p-14 relative overflow-hidden animate-fade-in">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <p className="eyebrow">
                  {toneLabel} ·{' '}
                  <span className="capitalize">{draft.status}</span>
                  {draft.tags.length > 0 && (
                    <>
                      {' · '}
                      {draft.tags.slice(0, 3).join(', ')}
                      {draft.tags.length > 3 && ` +${draft.tags.length - 3}`}
                    </>
                  )}
                </p>
                <h2 className="sr-only">The draft</h2>
              </div>
              {isGenerating && (
                <span className="chip">
                  <span className="caret" />
                  Typesetting…
                </span>
              )}
            </div>

            <div className={isGenerating ? 'animate-type-in' : ''}>
              <div className="mt-6 flex items-start gap-3 group">
                <label className="label mt-1.5 !text-[11px] !tracking-[0.22em] shrink-0 w-24">
                  Subject
                </label>
                <div className="flex-1 relative">
                  <input
                    className="field !border-0 !px-0 !py-0 text-2xl serif font-semibold leading-snug tracking-tight !bg-transparent focus:!shadow-none placeholder:!text-ink-300 dark:placeholder:!text-ink-600"
                    placeholder="Subject line — make it sound like something you’d actually open"
                    value={subject}
                    onChange={(e) => updateActiveVariant({ subject: e.target.value })}
                    spellCheck={false}
                  />
                  <div className="mt-1 flex items-center gap-2 text-xs text-ink-500 dark:text-ink-400">
                    <span className="mono">{subject.length} chars</span>
                    <span aria-hidden>·</span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-accent-700 dark:hover:text-accent-400"
                      onClick={() => copySection('Subject', subject)}
                    >
                      <Copy className="w-3.5 h-3.5" /> copy
                    </button>
                  </div>
                </div>
              </div>

              <div className="rule-dashed my-10" />

              <div className="flex items-start gap-3 group">
                <label className="label mt-1.5 !text-[11px] !tracking-[0.22em] shrink-0 w-24">
                  Email
                </label>
                <div className="flex-1 relative">
                  <textarea
                    className="field field-textarea !border-0 !px-0 !py-0 font-serif !text-[16.5px] !leading-[1.85] !bg-transparent focus:!shadow-none min-h-[340px] placeholder:!text-ink-300 dark:placeholder:!text-ink-600"
                    placeholder="Hi [Name],

The AI will draft an actual letter here — paragraphs, a drop cap, a closing. You can rewrite anything in place."
                    value={emailBody}
                    onChange={(e) => updateActiveVariant({ emailBody: e.target.value })}
                    spellCheck={false}
                  />
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-ink-500 dark:text-ink-400">
                    <div className="flex items-center gap-3">
                      <span className="mono">{emailBody ? emailBody.split(/\s+/).filter(Boolean).length : 0} words</span>
                      <span aria-hidden>·</span>
                      <span className="mono">
                        ~{Math.max(1, Math.round(((emailBody || '').length / 5) / 200))}-min read
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-accent-700 dark:hover:text-accent-400"
                        onClick={() => copySection('Email', emailBody)}
                      >
                        <Copy className="w-3.5 h-3.5" /> copy
                      </button>
                      <button
                        type="button"
                        onClick={() => saveDraftChanges()}
                        className="inline-flex items-center gap-1 hover:text-moss"
                        disabled={!draft._id || isSaving}
                      >
                        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5" />}
                        {draft._id ? 'save' : 'locked'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rule-dashed my-10" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex items-start gap-3 group">
                  <label className="label mt-1.5 !text-[11px] !tracking-[0.22em] shrink-0 w-24">
                    LinkedIn DM
                  </label>
                  <div className="flex-1 relative">
                    <textarea
                      className="field field-textarea !border-0 !px-0 !py-0 !text-sm !leading-relaxed !bg-transparent focus:!shadow-none min-h-[140px] placeholder:!text-ink-300 dark:placeholder:!text-ink-600"
                      placeholder="Shorter, punchier — the version you paste into the LinkedIn message box."
                      value={linkedInDM}
                      onChange={(e) => updateActiveVariant({ linkedInDM: e.target.value })}
                      spellCheck={false}
                    />
                    <div className="mt-2 flex items-center justify-between text-xs text-ink-500 dark:text-ink-400">
                      <span className="mono">{linkedInDM.length} chars</span>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-accent-700 dark:hover:text-accent-400"
                        onClick={() => copySection('LinkedIn DM', linkedInDM)}
                      >
                        <Copy className="w-3.5 h-3.5" /> copy
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 group">
                  <label className="label mt-1.5 !text-[11px] !tracking-[0.22em] shrink-0 w-24">
                    Follow-up
                  </label>
                  <div className="flex-1 relative">
                    <textarea
                      className="field field-textarea !border-0 !px-0 !py-0 !text-sm !leading-relaxed !bg-transparent focus:!shadow-none min-h-[140px] placeholder:!text-ink-300 dark:placeholder:!text-ink-600"
                      placeholder="The 3–4 day nudge — polite, short, and nothing like a ping."
                      value={followUpEmail}
                      onChange={(e) => updateActiveVariant({ followUpEmail: e.target.value })}
                      spellCheck={false}
                    />
                    <div className="mt-2 flex items-center justify-between text-xs text-ink-500 dark:text-ink-400">
                      <span className="mono">{followUpEmail ? followUpEmail.split(/\s+/).filter(Boolean).length : 0} words</span>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-accent-700 dark:hover:text-accent-400"
                        onClick={() => copySection('Follow-up', followUpEmail)}
                      >
                        <Copy className="w-3.5 h-3.5" /> copy
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-14 pt-6 rule-dashed flex flex-wrap items-center justify-between gap-4 text-xs text-ink-500 dark:text-ink-400">
              <span className="mono tracking-widest uppercase">
                {new Date(draft.updatedAt || Date.now()).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {draft._id ? ` · saved ${draft.isFavorite ? '· ★' : ''}` : ' · unsaved'}
              </span>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => exportFile('txt')}
                >
                  <FileText className="w-4 h-4" />
                  TXT
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => exportFile('pdf')}
                >
                  <Download className="w-4 h-4" />
                  PDF
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating || isSaving}
                  className="btn-outline"
                >
                  {isGenerating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Drafting</>
                  ) : (
                    <><RotateCcw className="w-4 h-4" /> Rewrite</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => changeStatus('sent')}
                  className="btn-accent"
                  disabled={isGenerating}
                >
                  <Send className="w-4 h-4" />
                  Mark sent
                </button>
              </div>
            </div>
          </article>

          <div className="paper-card p-5 md:p-6 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3 text-xs text-ink-500 dark:text-ink-400">
              <Eye className="w-4 h-4" />
              <p className="leading-relaxed max-w-lg">
                Tip: the email body is the only section with a drop cap when it exports. If the first sentence feels wrong, rewrite just that.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/app/history')}
              className="btn-ghost"
            >
              <Inbox className="w-4 h-4" />
              Browse archive →
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Editor;
