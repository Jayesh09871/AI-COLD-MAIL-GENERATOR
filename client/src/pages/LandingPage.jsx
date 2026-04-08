import { ArrowRightIcon, BoltIcon, ChartBarIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LandingPage = () => {
    const { user } = useAuth();

    const features = [
        {
            name: 'Lightning Fast Generation',
            description: 'Generate highly custom cold emails in seconds using state-of-the-art AI.',
            icon: BoltIcon,
        },
        {
            name: 'Omnichannel Outreach',
            description: 'Get an email, a follow-up, and a LinkedIn DM perfectly synced for your prospect.',
            icon: DocumentTextIcon,
        },
        {
            name: ' Higher Conversion Rates',
            description: 'Personalized copy ensures higher open rates and better reply outcomes.',
            icon: ChartBarIcon,
        },
    ];

    return (
        <div className="bg-white min-h-screen font-sans selection:bg-primary-100 selection:text-primary-900 overflow-x-hidden">
            {/* Navigation */}
            <nav className="border-b border-gray-100 bg-white/70 backdrop-blur-xl fixed w-full z-50 transition-all">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        <div className="flex items-center">
                            <span className="text-2xl font-black bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent tracking-tight">
                                SmartReach AI
                            </span>
                        </div>
                        <div className="hidden md:flex items-center space-x-8">
                            <a href="#features" className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">Features</a>
                         
                            {user ? (
                                <Link
                                    to="/dashboard"
                                    className="inline-flex items-center justify-center px-6 py-2.5 rounded-full text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 hover:shadow-lg hover:shadow-gray-200 transition-all duration-200"
                                >
                                    Dashboard
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        to="/login"
                                        className="text-sm font-bold text-gray-900 hover:text-primary-600 transition-colors"
                                    >
                                        Log in
                                    </Link>
                                    <Link
                                        to="/signup"
                                        className="inline-flex items-center justify-center px-6 py-2.5 rounded-full text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 hover:shadow-lg hover:shadow-primary-500/30 transition-all duration-200"
                                    >
                                        Get Started
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <div className="relative pt-32 pb-20 sm:pt-48 sm:pb-32">
                {/* Modern Gradient Background */}
                <div className="absolute inset-0 -z-10 overflow-hidden">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-primary-50/50 to-transparent blur-3xl opacity-50"></div>
                    <div className="absolute -top-24 right-0 w-96 h-96 bg-indigo-100/40 rounded-full blur-3xl"></div>
                    <div className="absolute top-48 -left-24 w-96 h-96 bg-primary-100/40 rounded-full blur-3xl"></div>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
                    <div className="text-center max-w-4xl mx-auto">
                        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-primary-50 border border-primary-100 mb-8 animate-fade-in">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
                            </span>
                            <span className="text-xs font-bold text-primary-700 uppercase tracking-wider">New: AI-Powered Follow-ups</span>
                        </div>
                        
                        <h1 className="text-6xl md:text-8xl font-black text-gray-900 tracking-tighter mb-8 leading-[1.1]">
                            Write Outreach <br className="hidden md:block" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 via-indigo-600 to-primary-600 bg-[length:200%_auto] animate-gradient">That Converts</span>
                        </h1>
                        
                        <p className="mt-8 text-xl md:text-2xl text-gray-600 max-w-2xl mx-auto leading-relaxed font-medium">
                            Stop wasting hours on manual outreach. Generate personalized sequences that look like they took hours to write, in seconds.
                        </p>
                        
                        <div className="mt-12 flex flex-col sm:flex-row justify-center gap-4">
                            <Link
                                to={user ? "/dashboard" : "/signup"}
                                className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold rounded-2xl text-white bg-gray-900 hover:bg-gray-800 transition-all duration-300 overflow-hidden shadow-2xl shadow-gray-200"
                            >
                                <span className="relative z-10 flex items-center">
                                    Start Generating Free
                                    <ArrowRightIcon className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </span>
                            </Link>
                            <a
                                href="#features"
                                className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold rounded-2xl text-gray-700 bg-white border-2 border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all duration-300"
                            >
                                See How it Works
                            </a>
                        </div>

                        {/* Social Proof / Trust Badges */}
                        <div className="mt-20 pt-10 border-t border-gray-100">
                            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-8">Trusted by SDRs at</p>
                            <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                                {['Stripe', 'Airbnb', 'HubSpot', 'Salesforce', 'Shopify'].map((company) => (
                                    <span key={company} className="text-xl font-black text-gray-800 tracking-tighter">{company}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Feature Section */}
            <div id="features" className="py-32 bg-gray-50/50 relative">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
                    <div className="text-center mb-24">
                        <h2 className="text-sm font-black text-primary-600 uppercase tracking-[0.2em] mb-4">Features</h2>
                        <h3 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight">Everything you need to <br />close more deals</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {features.map((feature, i) => (
                            <div key={feature.name} className="group relative p-10 bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-2xl hover:shadow-primary-500/10 transition-all duration-500 hover:-translate-y-2 overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary-50/50 rounded-full -mr-16 -mt-16 transition-transform duration-500 group-hover:scale-150"></div>
                                <div className="relative z-10">
                                    <div className="h-16 w-16 rounded-2xl bg-primary-50 flex items-center justify-center mb-8 group-hover:bg-primary-600 transition-colors duration-500">
                                        <feature.icon className="h-8 w-8 text-primary-600 group-hover:text-white transition-colors duration-500" aria-hidden="true" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-4 tracking-tight">{feature.name}</h3>
                                    <p className="text-gray-600 leading-relaxed text-lg font-medium">{feature.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Premium Look CTA */}
            <div className="relative py-32 px-6 sm:py-48 lg:px-8 bg-gray-900 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(59,130,246,0.3),transparent)]"></div>
                <div className="mx-auto max-w-4xl text-center relative z-10">
                    <h2 className="text-4xl md:text-6xl font-black tracking-tight text-white mb-8">
                        Ready to scale your <br />outreach to the moon?
                    </h2>
                    <p className="mx-auto mt-6 max-w-2xl text-xl leading-relaxed text-gray-300 font-medium">
                        Join 500+ high-performance sales teams using SmartReach AI to accelerate their pipeline today.
                    </p>
                    <div className="mt-12 flex items-center justify-center">
                        <Link
                            to="/signup"
                            className="group relative px-10 py-5 rounded-2xl bg-white text-gray-900 font-black text-lg hover:scale-105 transition-all duration-300 shadow-xl shadow-primary-500/20"
                        >
                            Get Started for Free
                        </Link>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-100 py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-10">
                        <div className="flex flex-col items-center md:items-start">
                            <span className="text-2xl font-black bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent mb-4">
                                SmartReach AI
                            </span>
                            <p className="text-gray-500 font-medium">Supercharging sales outreach with AI.</p>
                        </div>
                        <div className="flex gap-10 text-sm font-bold text-gray-400 uppercase tracking-widest">
                            <a href="#" className="hover:text-gray-900 transition-colors">Privacy</a>
                            <a href="#" className="hover:text-gray-900 transition-colors">Terms</a>
                            <a href="#" className="hover:text-gray-900 transition-colors">Twitter</a>
                        </div>
                    </div>
                    <div className="mt-20 pt-10 border-t border-gray-100 text-center">
                        <p className="text-gray-400 text-sm font-medium">© {new Date().getFullYear()} SmartReach AI. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
