import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';

const Signup = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { data } = await api.post('/auth/register', { name, email, password });
            toast.success(data.message);
            navigate('/verify-otp', { state: { userId: data.userId, email } });
        } catch (error) {
            toast.error(error.response?.data?.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-white font-sans">
            {/* Left Side: Illustration/Gradient */}
            <div className="hidden lg:flex lg:w-1/2 bg-gray-900 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-primary-900 opacity-90"></div>
                <div className="relative z-10 w-full flex flex-col justify-center px-20">
                    <div className="mb-12">
                        <span className="text-3xl font-black text-white tracking-tight">SmartReach AI</span>
                    </div>
                    <h1 className="text-5xl font-extrabold text-white leading-tight mb-6">
                        Start your journey <br />
                        <span className="text-primary-400">with SmartReach AI.</span>
                    </h1>
                    <p className="text-xl text-primary-100/80 leading-relaxed max-w-lg">
                        The smarter way to handle outreach. Join thousands of pros and start closing more deals.
                    </p>
                    
                    <div className="mt-12 space-y-6">
                        {[
                            'Free 10 credits on signup',
                            'No credit card required',
                            'Access to all AI models'
                        ].map((feature, i) => (
                            <div key={i} className="flex items-center text-white/90">
                                <div className="h-6 w-6 rounded-full bg-primary-500/20 border border-primary-500/30 flex items-center justify-center mr-4">
                                    <svg className="h-3.5 w-3.5 text-primary-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <span className="font-medium">{feature}</span>
                            </div>
                        ))}
                    </div>
                </div>
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-primary-400/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-indigo-400/10 rounded-full blur-3xl"></div>
            </div>

            {/* Right Side: Form */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-12 lg:px-20 py-12 bg-gray-50/30">
                <div className="max-w-md w-full mx-auto">
                    <div className="lg:hidden mb-8">
                        <span className="text-2xl font-black bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent">
                            SmartReach AI
                        </span>
                    </div>

                    <div className="mb-10">
                        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Create your account</h2>
                        <p className="mt-3 text-gray-600">Enter your details to get started with SmartReach AI</p>
                    </div>

                    <form className="space-y-5" onSubmit={handleSubmit}>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700 tracking-wide">Full Name</label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="John Doe"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700 tracking-wide">Email Address</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@company.com"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700 tracking-wide">Password</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-2 py-4 px-6 rounded-xl bg-gray-900 text-white font-bold text-sm shadow-xl shadow-gray-200 hover:bg-gray-800 hover:shadow-gray-300 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                'Create Account'
                            )}
                        </button>
                    </form>

                    <div className="mt-10 pt-8 border-t border-gray-100 text-center">
                        <p className="text-sm text-gray-600">
                            Already have an account?{' '}
                            <Link to="/login" className="font-bold text-primary-600 hover:text-primary-500 transition-colors">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Signup;
