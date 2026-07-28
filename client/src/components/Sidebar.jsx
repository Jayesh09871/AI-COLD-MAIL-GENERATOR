import { NavLink, useLocation } from 'react-router-dom';
import {
  PenSquare,
  LibraryBig,
  LayoutTemplate,
  Sparkles,
  BarChart3,
  Settings2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const sections = [
  {
    label: 'Workspace',
    items: [
      { to: '/app/editor', label: 'Drafting Desk', icon: <PenSquare className="w-4 h-4" /> },
      { to: '/app/history', label: 'Archive', icon: <LibraryBig className="w-4 h-4" /> },
    ],
  },
  {
    label: 'Coming soon',
    items: [
      { to: '#', label: 'Templates', icon: <LayoutTemplate className="w-4 h-4" />, disabled: true },
      { to: '#', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" />, disabled: true },
    ],
  },
];

const initialsOf = (name) => {
  if (!name) return 'DW';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
    .slice(0, 2) || 'DW';
};

const Sidebar = ({ onNavigate }) => {
  const { user } = useAuth();
  const loc = useLocation();

  const isActive = (to) => {
    if (to === '/app/editor') {
      return loc.pathname.startsWith('/app/editor');
    }
    return loc.pathname === to;
  };

  return (
    <nav className="h-full w-full py-8 px-6 flex flex-col">
      <div className="mb-8">
        <p className="eyebrow">Current session</p>
        <div className="mt-3 flex items-center gap-3 rounded-sm border border-ink-200 dark:border-ink-700 bg-paper-50 dark:bg-ink-800/60 p-3">
          <div className="w-9 h-9 rounded-sm flex items-center justify-center serif font-semibold text-sm text-paper-50 bg-accent-700 dark:bg-accent-600 shrink-0">
            {initialsOf(user?.name)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-900 dark:text-paper-50 truncate">
              {user?.name || 'Writer'}
            </p>
            <p className="text-xs text-ink-500 dark:text-ink-400 truncate">{user?.email || ''}</p>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-sm border border-dashed border-accent-300 dark:border-accent-900/60 bg-accent-50/40 dark:bg-accent-900/10 p-4">
        <div className="flex items-center gap-2 text-accent-700 dark:text-accent-400">
          <Sparkles className="w-3.5 h-3.5" />
          <p className="eyebrow !text-accent-700 dark:!text-accent-400">Tip</p>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink-700 dark:text-ink-300">
          Pick a tone first — it rewrites how ColdX thinks, not just what words it uses.
        </p>
      </div>

      {sections.map((section) => (
        <div key={section.label} className="mb-8">
          <p className="eyebrow mb-3">{section.label}</p>
          <ul className="space-y-1">
            {section.items.map((it) => {
              const active = !it.disabled && isActive(it.to);
              return (
                <li key={it.label}>
                  {it.disabled ? (
                    <span
                      aria-disabled
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-sm text-sm text-ink-400 dark:text-ink-500 cursor-not-allowed"
                    >
                      {it.icon}
                      <span className="flex-1">{it.label}</span>
                      <span className="mono text-[10px] tracking-wider uppercase text-ink-400 dark:text-ink-500">
                        Soon
                      </span>
                    </span>
                  ) : (
                    <NavLink
                      to={it.to}
                      onClick={onNavigate}
                      className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-sm text-sm transition-colors group ${
                        active
                          ? 'bg-ink-900 dark:bg-paper-50 text-paper-50 dark:text-ink-900 shadow-paper-sm'
                          : 'text-ink-700 hover:text-ink-900 dark:text-ink-300 dark:hover:text-paper-50 hover:bg-paper-50 dark:hover:bg-ink-800/60'
                      }`}
                    >
                      <span className={active ? '' : 'text-ink-500 dark:text-ink-400 group-hover:text-ink-700 dark:group-hover:text-ink-300'}>
                        {it.icon}
                      </span>
                      <span className="flex-1 tracking-wide">{it.label}</span>
                      {active && <span className="mono text-[10px] opacity-60">●</span>}
                    </NavLink>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="mt-auto pt-6 border-t border-ink-200 dark:border-ink-700/80">
        <button
          type="button"
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-sm text-sm text-ink-500 dark:text-ink-400 hover:text-ink-700 hover:bg-paper-50 dark:hover:bg-ink-800/60 dark:hover:text-ink-300 transition-colors"
        >
          <Settings2 className="w-4 h-4" />
          <span>Account settings</span>
        </button>
      </div>
    </nav>
  );
};

export default Sidebar;
