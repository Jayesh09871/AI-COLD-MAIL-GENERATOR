import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useState } from 'react';
import { Menu } from 'lucide-react';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="relative min-h-screen flex flex-col">
      <Navbar onMenuClick={() => setSidebarOpen(true)} />

      <div className="flex flex-1 overflow-hidden relative">
        <aside
          className={`md:relative md:translate-x-0 md:block md:w-72 shrink-0 transition-all duration-300 border-r border-ink-200 dark:border-ink-700/80 bg-paper-100/80 dark:bg-ink-900/80 backdrop-blur-sm ${
            sidebarOpen
              ? 'fixed inset-y-0 left-0 top-20 z-40 w-72 translate-x-0 border-r border-ink-200 dark:border-ink-700/80'
              : 'hidden'
          }`}
        >
          <Sidebar onNavigate={() => setSidebarOpen(false)} />
        </aside>

        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
            className="md:hidden fixed inset-0 bg-ink-900/40 z-30 backdrop-blur-sm"
          />
        )}

        <div className="md:hidden sticky top-20 z-20 border-b border-ink-200 dark:border-ink-700/80 bg-paper-100/80 dark:bg-ink-900/80 backdrop-blur-sm md:bg-transparent">
          <div className="px-5 py-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-sm border border-ink-200 dark:border-ink-700 text-ink-700 dark:text-ink-300"
            >
              <Menu className="w-4 h-4" />
            </button>
            <span className="serif text-ink-900 dark:text-paper-50 text-lg font-semibold">
              Draftwell
            </span>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto relative bg-paper-50/40 dark:bg-ink-900/30">
          <div className="min-h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
