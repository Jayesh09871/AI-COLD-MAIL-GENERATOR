import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Search,
  X,
  BookmarkCheck,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Trash2,
  Edit3,
  Frown,
  Loader2,
  Filter,
  ArchiveRestore,
  SendHorizonal,
  ReplyAll,
  FileTextIcon,
  Plus,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react';
import api from '../utils/api';

const STATUS_LIST = ['draft', 'sent', 'replied', 'archived'];

const statusMeta = {
  draft: { label: 'Draft', icon: <FileTextIcon className="w-3 h-3" />, chip: 'bg-paper-100 dark:bg-ink-800/60 border-ink-200 dark:border-ink-700 text-ink-700 dark:text-ink-300' },
  sent: { label: 'Sent', icon: <SendHorizonal className="w-3 h-3" />, chip: 'bg-moss/10 border-moss/40 text-moss' },
  replied: { label: 'Replied', icon: <ReplyAll className="w-3 h-3" />, chip: 'bg-accent-50 dark:bg-accent-900/30 border-accent-300 dark:border-accent-800 text-accent-700 dark:text-accent-400' },
  archived: { label: 'Archived', icon: <ArchiveRestore className="w-3 h-3" />, chip: 'bg-ink-100 dark:bg-ink-800/60 border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-400' },
};

const toneColor = (tone) => {
  switch (tone) {
    case 'formal':
      return 'bg-ink-900 dark:bg-paper-50 text-paper-50 dark:text-ink-900 border-ink-900 dark:border-paper-50';
    case 'casual':
      return 'bg-moss/15 border-moss/50 text-moss';
    case 'persuasive':
      return 'bg-accent-50 dark:bg-accent-900/30 border-accent-300 dark:border-accent-800 text-accent-700 dark:text-accent-400';
    case 'short-and-direct':
      return 'bg-paper-200/60 dark:bg-ink-800 border-ink-300 dark:border-ink-700 text-ink-800 dark:text-paper-100';
    default:
      return 'bg-paper-100 dark:bg-ink-800/60 border-ink-200 dark:border-ink-700 text-ink-700 dark:text-ink-300';
  }
};

const toneLabel = (tone) => {
  if (!tone) return 'Tone';
  return tone
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

const excerpt = (s, len = 160) => {
  if (!s) return '';
  const clean = s.replace(/\s+/g, ' ').trim();
  return clean.length > len ? clean.slice(0, len - 1) + '…' : clean;
};

const HISTORY_LIMIT = 10;

const History = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tone, setTone] = useState('any');
  const [status, setStatus] = useState('any');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [tagFilter, setTagFilter] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [deleting, setDeleting] = useState(new Set());
  const [favoriting, setFavoriting] = useState(new Set());

  const totalPages = Math.max(1, Math.ceil(count / HISTORY_LIMIT));
  const page = Math.floor(offset / HISTORY_LIMIT) + 1;

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 280);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch, tone, status, favoriteOnly, tagFilter]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(HISTORY_LIMIT));
      params.set('offset', String(offset));
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (tone !== 'any') params.set('tone', tone);
      if (status !== 'any') params.set('status', status);
      if (favoriteOnly) params.set('favorite', 'true');
      if (tagFilter.trim()) params.set('tag', tagFilter.trim());
      const res = await api.get(`/ai/history?${params.toString()}`);
      const data = res.data?.data || res.data;
      setItems(Array.isArray(data?.items) ? data.items : []);
      setCount(typeof data?.count === 'number' ? data.count : 0);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not load archive');
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, debouncedSearch, tone, status, favoriteOnly, tagFilter]);

  const toggleFavorite = async (entry) => {
    const id = entry._id;
    setFavoriting((prev) => new Set(prev).add(id));
    try {
      await api.post(`/ai/history/${id}/favorite`);
      setItems((prev) => prev.map((x) => (x._id === id ? { ...x, isFavorite: !x.isFavorite } : x)));
      toast(entry.isFavorite ? 'Removed from favorites.' : 'Marked favorite.');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not update');
    } finally {
      setFavoriting((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }
  };

  const doDelete = async (entry) => {
    const id = entry._id;
    if (!confirm('Delete this draft? This cannot be undone.')) return;
    setDeleting((prev) => new Set(prev).add(id));
    try {
      await api.delete(`/ai/history/${id}`);
      setItems((prev) => prev.filter((x) => x._id !== id));
      setCount((c) => Math.max(0, c - 1));
      toast.success('Draft deleted.');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not delete');
    } finally {
      setDeleting((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }
  };

  const exportEntry = async (entry, format) => {
    const id = entry._id;
    const toastId = toast.loading(`Preparing ${format.toUpperCase()}…`);
    try {
      const res = await api.get(`/ai/history/${id}/export`, {
        params: { format },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], {
        type: format === 'pdf' ? 'application/pdf' : 'text/plain;charset=utf-8',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      const v = getPrimaryVariant(entry);
      const slug = (v?.subject || entry.prompt || 'draftwell-draft')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60) || 'draft';
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

  const hasActiveFilters = debouncedSearch || tone !== 'any' || status !== 'any' || favoriteOnly || tagFilter;

  return (
    <div className="w-full">
      <div className="px-6 md:px-10 lg:px-14 py-8 md:py-10 border-b border-ink-200 dark:border-ink-700/80 bg-paper-100/50 dark:bg-ink-900/40">
        <div className="flex items-start justify-between flex-wrap gap-6">
          <div className="max-w-2xl">
            <p className="eyebrow mb-3">The archive</p>
            <h1 className="serif text-3xl md:text-4xl leading-tight tracking-tightest text-ink-900 dark:text-paper-50">
              Every draft you’ve ever <em className="italic text-accent-700 dark:text-accent-400">paused</em> on.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-600 dark:text-ink-400 max-w-xl">
              Full-text search, filterable by tone, status, favorite, or tag. Delete what you don’t want, export what you do.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/app/editor')}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            New draft
          </button>
        </div>
      </div>

      <div className="px-6 md:px-10 lg:px-14 py-6 md:py-8 sticky top-0 z-10 bg-paper-50/80 dark:bg-ink-900/70 backdrop-blur-md border-b border-ink-200 dark:border-ink-700/60">
        <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-5">
          <div className="flex-1 relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 dark:text-ink-500 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subject, prompt, or body…"
              className="field !pl-11"
              aria-label="Search drafts"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-sm hover:bg-paper-100 dark:hover:bg-ink-800 text-ink-400 dark:text-ink-500 hover:text-ink-700 dark:hover:text-ink-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className={`btn-outline ${filtersOpen ? '!bg-ink-900 dark:!bg-paper-50 !text-paper-50 dark:!text-ink-900 !border-ink-900 dark:!border-paper-50' : ''}`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setDebouncedSearch('');
                  setTone('any');
                  setStatus('any');
                  setFavoriteOnly(false);
                  setTagFilter('');
                }}
                className="btn-ghost text-accent-700 dark:text-accent-400"
              >
                Clear all
              </button>
            )}
            <div className="mono text-xs tracking-widest uppercase text-ink-500 dark:text-ink-400 ml-2">
              {count} {count === 1 ? 'entry' : 'entries'}
            </div>
          </div>
        </div>

        {filtersOpen && (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-5 border-t border-ink-200 dark:border-ink-700/80">
            <div>
              <label className="label">Tone</label>
              <select className="field" value={tone} onChange={(e) => setTone(e.target.value)}>
                <option value="any">Any tone</option>
                {['formal', 'casual', 'persuasive', 'short-and-direct'].map((t) => (
                  <option key={t} value={t}>
                    {toneLabel(t)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="any">Any status</option>
                {STATUS_LIST.map((s) => (
                  <option key={s} value={s}>
                    {statusMeta[s].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Tag (exact)</label>
              <input
                className="field"
                placeholder="e.g. series-b"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <label className="field !py-3 cursor-pointer flex items-center gap-3 w-full select-none">
                <input
                  type="checkbox"
                  className="accent-accent-700 dark:accent-accent-500 w-4 h-4"
                  checked={favoriteOnly}
                  onChange={(e) => setFavoriteOnly(e.target.checked)}
                />
                <span className="text-sm text-ink-700 dark:text-ink-300">Favorites only</span>
                <Sparkles className="w-4 h-4 ml-auto text-accent-600 dark:text-accent-400" />
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="px-6 md:px-10 lg:px-14 py-8 md:py-10">
        {loading && items.length === 0 && firstLoad ? (
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-5 h-5 animate-spin text-accent-700 dark:text-accent-400" />
              <span className="mono text-xs uppercase tracking-[0.3em] text-ink-500 dark:text-ink-400">
                Pulling files from the archive…
              </span>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="paper-card p-10 md:p-14 max-w-xl text-center">
              <div className="mx-auto w-12 h-12 rounded-sm border border-ink-200 dark:border-ink-700 flex items-center justify-center text-ink-500 dark:text-ink-400 bg-paper-50 dark:bg-ink-800/60">
                <Frown className="w-6 h-6" />
              </div>
              <h3 className="serif text-2xl md:text-3xl mt-6 text-ink-900 dark:text-paper-50 font-semibold tracking-tight">
                {hasActiveFilters ? 'Nothing matches those filters.' : 'Empty desk, empty drawer.'}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-600 dark:text-ink-400">
                {hasActiveFilters
                  ? 'Try clearing the filters or a different search. Draftwell saved everything, I promise.'
                  : 'Draft something to populate the archive. The first one is the hardest.'}
              </p>
              <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setDebouncedSearch('');
                      setTone('any');
                      setStatus('any');
                      setFavoriteOnly(false);
                      setTagFilter('');
                    }}
                    className="btn-outline"
                  >
                    <Filter className="w-4 h-4" />
                    Reset filters
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => navigate('/app/editor')}
                  className="btn-primary"
                >
                  <Plus className="w-4 h-4" />
                  Begin a draft
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {items.map((entry, i) => {
                const v = getPrimaryVariant(entry);
                const subj = v?.subject || entry.subject || '';
                const body = v?.emailBody || entry.emailBody || entry.prompt || '';
                return (
                  <li
                    key={entry._id}
                    className="paper-card p-6 flex flex-col animate-slide-up"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`chip ${toneColor(entry.tone)} !px-2 !py-0.5 !text-[11px] !uppercase tracking-wider`}>
                            {toneLabel(entry.tone)}
                          </span>
                          <span className={`chip ${statusMeta[entry.status]?.chip || statusMeta.draft.chip} !px-2 !py-0.5 !text-[11px] !uppercase tracking-wider inline-flex items-center gap-1`}>
                            {statusMeta[entry.status]?.icon}
                            {statusMeta[entry.status]?.label || 'Draft'}
                          </span>
                          {entry.isFavorite && (
                            <span className="chip !border-accent-400 dark:!border-accent-800 !bg-accent-50 dark:!bg-accent-900/30 !text-accent-700 dark:!text-accent-400 !px-2 !py-0.5 !text-[11px] inline-flex items-center gap-1">
                              <BookmarkCheck className="w-3 h-3" />
                              Favorite
                            </span>
                          )}
                        </div>
                        <h3 className="serif text-xl mt-4 text-ink-900 dark:text-paper-50 font-semibold leading-snug tracking-tight">
                          {subj?.trim() ? (
                            subj.length > 78 ? subj.slice(0, 78) + '…' : subj
                          ) : (
                            <span className="italic text-ink-500 dark:text-ink-400 text-base">Untitled draft</span>
                          )}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleFavorite(entry)}
                        disabled={favoriting.has(entry._id)}
                        aria-label={entry.isFavorite ? 'Remove favorite' : 'Mark favorite'}
                        className={`shrink-0 p-2 rounded-sm border transition-colors ${
                          entry.isFavorite
                            ? 'border-accent-300 dark:border-accent-800 bg-accent-50 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400'
                            : 'border-ink-200 dark:border-ink-700 text-ink-500 dark:text-ink-400 hover:text-accent-700 dark:hover:text-accent-400 hover:border-accent-300 dark:hover:border-accent-800 bg-paper-50 dark:bg-ink-800/60'
                        }`}
                      >
                        {favoriting.has(entry._id) ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : entry.isFavorite ? (
                          <BookmarkCheck className="w-4 h-4" />
                        ) : (
                          <Bookmark className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    <p className="mt-4 text-sm leading-relaxed text-ink-700 dark:text-ink-300 min-h-[4.5rem]">
                      {excerpt(body, 170) || <span className="italic text-ink-500 dark:text-ink-400">Nothing in the body yet — open it to write.</span>}
                    </p>

                    {entry.tags?.length > 0 && (
                      <div className="mt-5 flex flex-wrap gap-1.5">
                        {entry.tags.slice(0, 6).map((t) => (
                          <span key={t} className="chip !text-[11px] !py-0.5">#{t}</span>
                        ))}
                        {entry.tags.length > 6 && (
                          <span className="chip !text-[11px] !py-0.5">+{entry.tags.length - 6}</span>
                        )}
                      </div>
                    )}

                    <div className="rule-dashed my-6" />

                    <div className="flex items-center justify-between text-xs text-ink-500 dark:text-ink-400">
                      <div className="mono tracking-widest uppercase">
                        {new Date(entry.updatedAt || entry.createdAt || Date.now()).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                      {Array.isArray(entry.variants) && entry.variants.length > 1 && (
                        <span className="mono tracking-widest uppercase">
                          {entry.variants.length} variants
                        </span>
                      )}
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => navigate(`/app/editor/${entry._id}`)}
                        className="btn-outline col-span-2"
                      >
                        <Edit3 className="w-4 h-4" />
                        Open in editor
                      </button>
                      <button
                        type="button"
                        onClick={() => exportEntry(entry, 'txt')}
                        className="btn-ghost"
                      >
                        <FileDown className="w-4 h-4" />
                        TXT
                      </button>
                      <button
                        type="button"
                        onClick={() => exportEntry(entry, 'pdf')}
                        className="btn-ghost"
                      >
                        <FileDown className="w-4 h-4" />
                        PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => doDelete(entry)}
                        disabled={deleting.has(entry._id)}
                        className="col-span-2 btn-ghost !text-accent-700 dark:!text-accent-400 hover:!bg-accent-50 dark:hover:!bg-accent-900/30"
                      >
                        {deleting.has(entry._id) ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                        Delete draft
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {totalPages > 1 && (
              <div className="mt-12 flex items-center justify-between flex-wrap gap-4">
                <div className="mono text-xs uppercase tracking-widest text-ink-500 dark:text-ink-400">
                  Page {page} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page === 1 || loading}
                    onClick={() => setOffset((o) => Math.max(0, o - HISTORY_LIMIT))}
                    className="btn-outline disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages || loading}
                    onClick={() => setOffset((o) => Math.min((totalPages - 1) * HISTORY_LIMIT, o + HISTORY_LIMIT))}
                    className="btn-outline disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

function getPrimaryVariant(entry) {
  if (!Array.isArray(entry?.variants) || entry.variants.length === 0) return null;
  return entry.variants.find((v) => v.selected) || entry.variants[0];
}

export default History;
