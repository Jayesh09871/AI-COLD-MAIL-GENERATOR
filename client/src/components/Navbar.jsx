import { ArrowLeftOnRectangleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
    const { user, logout } = useAuth();

    return (
        <header className="h-24 bg-gray-50 flex items-center justify-between px-10 shrink-0">
            <div className="flex flex-col hidden md:block">
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                    Welcome back, {user?.name?.split(' ')[0] || 'User'} 👋
                </h1>
                <p className="text-sm font-medium text-gray-500">Let's generate some high-converting outreach.</p>
            </div>
            {/* Mobile Title */}
            <div className="text-xl font-black bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent md:hidden tracking-tight">
                SmartReach AI
            </div>

            <div className="flex items-center space-x-6">
                <div className="hidden sm:flex items-center space-x-2 px-4 py-2 bg-white rounded-2xl border border-gray-100 shadow-sm">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">AI Status: Online</span>
                </div>
                
                <button
                    onClick={logout}
                    className="flex items-center px-5 py-3 rounded-2xl bg-white border border-gray-100 shadow-sm text-gray-600 hover:text-red-500 hover:border-red-50 transition-all duration-200 group"
                >
                    <ArrowLeftOnRectangleIcon className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
                    <span className="text-xs font-black uppercase tracking-widest">Logout</span>
                </button>
            </div>
        </header>
    );
};

export default Navbar;
