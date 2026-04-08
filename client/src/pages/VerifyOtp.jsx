import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const VerifyOtp = () => {
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { login } = useAuth();

    const userId = location.state?.userId;
    const email = location.state?.email;

    if (!userId) {
        navigate('/signup');
        return null;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { data } = await api.post('/auth/verify-otp', { userId, otp });
            login(data);
            toast.success('Email verified successfully!');
            navigate('/dashboard');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Verification failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-white font-sans">
            {/* Left Side: Illustration/Gradient */}
            <div className="hidden lg:flex lg:w-1/2 bg-gray-900 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary-600 to-indigo-900 opacity-90"></div>
                <div className="relative z-10 w-full flex flex-col justify-center px-20">
                    <div className="mb-12">
                        <span className="text-3xl font-black text-white tracking-tight">SmartReach AI</span>
                    </div>
                    <h1 className="text-5xl font-extrabold text-white leading-tight mb-6">
                        Secure your <br />
                        <span className="text-primary-400">Account.</span>
                    </h1>
                    <p className="text-xl text-primary-100/80 leading-relaxed max-w-lg">
                        We've sent a verification code to your email. Please enter it to continue.
                    </p>
                </div>
                {/* Decorative circles */}
                <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl"></div>
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
                        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Verify your email</h2>
                        <p className="mt-3 text-gray-600">
                            We sent a code to <span className="font-semibold text-gray-900">{email}</span>
                        </p>
                    </div>

                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div className="space-y-4">
                            <label className="block text-sm font-semibold text-gray-700 tracking-wide text-center">Enter 6-digit OTP</label>
                            <input
                                type="text"
                                required
                                maxLength={6}
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                className="w-full px-4 py-4 rounded-xl border-2 border-gray-200 bg-white text-gray-900 focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all outline-none text-center text-3xl tracking-[0.5em] font-mono font-bold"
                                placeholder="000000"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || otp.length !== 6}
                            className="w-full py-4 px-6 rounded-xl bg-gray-900 text-white font-bold text-sm shadow-xl shadow-gray-200 hover:bg-gray-800 hover:shadow-gray-300 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                'Verify Email'
                            )}
                        </button>
                    </form>

                    <div className="mt-10 pt-8 border-t border-gray-100 text-center">
                        <p className="text-sm text-gray-600">
                            Didn't receive the code?{' '}
                            {/* <button className="font-bold text-primary-600 hover:text-primary-500 transition-colors">
                                Resend OTP
                            </button> */}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VerifyOtp;
