import { LogOut, Menu, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

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

const Navbar = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate('/');
  };

  return (
    <header className="relative z-30 border-b border-ink-200/70 dark:border-ink-700/80 bg-paper-100/70 dark:bg-ink-900/70 backdrop-blur-md h-20 shrink-0">
      <div className="h-full px-5 md:px-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={onMenuClick}
            className="md:hidden p-2 rounded-sm border border-ink-200 dark:border-ink-700 text-ink-700 dark:text-ink-300"
          >
            <Menu className="w-4 h-4" />
          </button>

          <NavLink to="/" className="hidden md:inline-flex items-baseline gap-1 shrink-0">
            <svg
              viewBox="0 0 24 24"
              width={16}
              height={16}
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
            <span className="serif font-semibold tracking-tightest text-xl text-ink-900 dark:text-paper-50">
              ColdX
            </span>
          </NavLink>

          <div className="hidden md:flex items-center gap-1.5 pl-6 ml-2 border-l border-ink-200 dark:border-ink-700/80">
            <NavLink
              to="/app/editor"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-sm text-sm transition-colors ${
                  isActive
                    ? 'bg-ink-900 dark:bg-paper-50 text-paper-50 dark:text-ink-900'
                    : 'text-ink-600 hover:text-ink-900 hover:bg-paper-50 dark:text-ink-300 dark:hover:text-paper-50 dark:hover:bg-ink-800/60'
                }`
              }
            >
              Desk
            </NavLink>
            <NavLink
              to="/app/history"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-sm text-sm transition-colors ${
                  isActive
                    ? 'bg-ink-900 dark:bg-paper-50 text-paper-50 dark:text-ink-900'
                    : 'text-ink-600 hover:text-ink-900 hover:bg-paper-50 dark:text-ink-300 dark:hover:text-paper-50 dark:hover:bg-ink-800/60'
                }`
              }
            >
              Archive
            </NavLink>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Toggle theme"
            onClick={toggleTheme}
            className="p-2.5 rounded-sm border border-transparent hover:border-ink-200 dark:hover:border-ink-700 text-ink-600 dark:text-ink-300 hover:text-ink-900 dark:hover:text-paper-50 hover:bg-paper-50 dark:hover:bg-ink-800/60 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2.5 pl-2 pr-1 py-1 rounded-sm border border-ink-200 dark:border-ink-700 hover:border-ink-300 dark:hover:border-ink-600 bg-paper-50 dark:bg-ink-800/60 transition-colors"
            >
              <span className="w-7 h-7 rounded-sm flex items-center justify-center serif font-semibold text-xs text-paper-50 bg-accent-700 dark:bg-accent-600">
                {initialsOf(user?.name)}
              </span>
              <span className="hidden sm:block text-sm text-ink-700 dark:text-ink-300 max-w-[160px] truncate pr-2">
                {user?.email}
              </span>
              <svg width="10" height="10" viewBox="0 0 10 10" className="text-ink-500 dark:text-ink-400 mr-1.5">
                <path d="M2 3l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 mt-3 w-72 z-40 rounded-sm border border-ink-200 dark:border-ink-700 bg-paper-50 dark:bg-ink-800 shadow-paper-lg overflow-hidden animate-fade-in">
                  <div className="px-5 py-4 border-b border-ink-200 dark:border-ink-700">
                    <p className="eyebrow">Signed in as</p>
                    <p className="mt-2 text-sm font-semibold text-ink-900 dark:text-paper-50 truncate">
                      {user?.name || 'Writer'}
                    </p>
                    <p className="text-xs text-ink-500 dark:text-ink-400 truncate">{user?.email}</p>
                    {user?.lastLoginAt && (
                      <p className="mono text-[10px] tracking-widest uppercase mt-2 text-ink-400 dark:text-ink-500">
                        Last: {new Date(user.lastLoginAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <div className="p-2">
                    <NavLink
                      to="/app/history"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-sm text-sm text-ink-700 hover:text-ink-900 hover:bg-paper-100 dark:text-ink-300 dark:hover:text-paper-50 dark:hover:bg-ink-700/50 transition-colors"
                    >
                      <span className="mono text-[10px] opacity-60">⌘E</span>
                      Open archive
                    </NavLink>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-sm text-sm text-accent-700 hover:text-accent-800 hover:bg-accent-50 dark:text-accent-400 dark:hover:text-accent-300 dark:hover:bg-accent-900/30 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Log out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
