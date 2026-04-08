import React from 'react';
import { NavLink } from 'react-router-dom';
import { DocumentTextIcon, HomeIcon } from '@heroicons/react/24/outline';

const Sidebar = () => {
    return (
        <div className="w-72 bg-white border-r border-gray-100 flex flex-col hidden md:flex shrink-0">
            <div className="h-24 flex items-center px-8">
                <span className="text-2xl font-black bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent tracking-tight">
                    SmartReach AI
                </span>
            </div>
            
            <nav className="flex-1 px-4 py-6 space-y-2">
                <div className="px-4 mb-4">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Main Menu</p>
                </div>
                <NavLink
                    to="/dashboard"
                    className={({ isActive }) =>
                        `flex items-center px-4 py-4 rounded-2xl transition-all duration-200 group ${
                            isActive 
                            ? 'bg-gray-900 text-white shadow-lg shadow-gray-200' 
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                        }`
                    }
                >
                    <HomeIcon className="w-5 h-5 mr-3" />
                    <span className="font-bold text-sm">Dashboard</span>
                </NavLink>
            </nav>

            <div className="p-6">
                <div className="">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150"></div>
                    <div className="relative z-10">
                        {/* <p className="text-white text-xs font-bold mb-1 opacity-80 uppercase tracking-widest">Your Plan</p>
                        <p className="text-white text-lg font-black mb-4 tracking-tight">Free Trial</p> */}
                        {/* <button className="w-full py-2 bg-white text-primary-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary-50 transition-colors">
                            Upgrade
                        </button> */}
                    </div>
                </div>
                <div className="mt-6 text-[10px] text-center text-gray-400 font-bold uppercase tracking-widest">
                    Version 2.0.0
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
