import { CheckIcon, ClipboardDocumentIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import api from '../utils/api';

const Dashboard = () => {
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [copied, setCopied] = useState('');

    const handleGenerate = async (e) => {
        e.preventDefault();
        if (!prompt.trim()) return;

        setLoading(true);
        try {
            const { data } = await api.post('/ai/generate-email', { prompt });
            setResult(data);
            toast.success('Successfully generated!');
        } catch (error) {
            toast.error('Failed to generate. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text, type) => {
        navigator.clipboard.writeText(text);
        setCopied(type);
        toast.success('Copied to clipboard!');
        setTimeout(() => setCopied(''), 2000);
    };

    const ResultCard = ({ title, content, type }) => (
        <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-primary-500/5 transition-all duration-300 mb-6 group">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600 group-hover:bg-primary-600 group-hover:text-white transition-colors duration-300">
                        {type === 'subject' && <DocumentTextIcon className="w-5 h-5" />}
                        {type === 'email' && <DocumentTextIcon className="w-5 h-5" />}
                        {type === 'linkedin' && <DocumentTextIcon className="w-5 h-5" />}
                        {type === 'followup' && <DocumentTextIcon className="w-5 h-5" />}
                    </div>
                    <h3 className="font-bold text-gray-900 tracking-tight">{title}</h3>
                </div>
                <button
                    onClick={() => copyToClipboard(content, type)}
                    className="p-2.5 rounded-xl bg-gray-50 text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-all duration-200"
                    title="Copy to clipboard"
                >
                    {copied === type ? (
                        <CheckIcon className="w-5 h-5 text-green-500" />
                    ) : (
                        <ClipboardDocumentIcon className="w-5 h-5" />
                    )}
                </button>
            </div>
            <div className="relative">
                <div className="absolute -left-4 top-0 bottom-0 w-1 bg-primary-100 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <p className="text-gray-600 whitespace-pre-wrap leading-relaxed font-medium pl-2">{content}</p>
            </div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8 h-full min-h-0">
            {/* Input Section */}
            <div className="w-full lg:w-[400px] bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col shrink-0">
                <div className="mb-8">
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-2">New Campaign</h2>
                    <p className="text-sm font-medium text-gray-500">Define your prospect's context</p>
                </div>
                
                <form onSubmit={handleGenerate} className="flex-1 flex flex-col">
                    <div className="flex-1 relative group">
                        <label className="absolute -top-2.5 left-4 px-2 bg-white text-[10px] font-black text-primary-600 uppercase tracking-widest z-10">Context / Prompt</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="w-full h-full min-h-[300px] lg:min-h-0 border-2 border-gray-100 rounded-[2rem] p-6 text-gray-700 focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500 transition-all resize-none font-medium leading-relaxed placeholder:text-gray-300"
                            placeholder="e.g. Write a cold email to a marketing director at a SaaS company offering our AI-driven analytics tool that increases retention by 20%..."
                        />
                    </div>
                    
                    <button
                        type="submit"
                        disabled={loading || !prompt.trim()}
                        className="mt-8 w-full group relative overflow-hidden bg-gray-900 hover:bg-gray-800 text-white font-bold py-5 px-6 rounded-2xl transition-all duration-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-gray-200"
                    >
                        <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-[200%] transition-transform duration-1000"></div>
                        {loading ? (
                            <span className="flex items-center relative z-10">
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Brewing Magic...
                            </span>
                        ) : (
                            <span className="relative z-10">Generate Sequence</span>
                        )}
                    </button>
                </form>
            </div>

            {/* Output Section */}
            <div className="w-full lg:flex-1 flex flex-col min-h-0">
                {result ? (
                    <div className="overflow-y-auto pr-4 custom-scrollbar pb-10">
                        <div className="flex items-center justify-between mb-8 sticky top-0 bg-gray-50/80 backdrop-blur-md py-4 z-20">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 tracking-tight">AI Generated Results</h2>
                                <p className="text-sm font-medium text-gray-500">Hand-crafted sequences for your outreach</p>
                            </div>
                            <div className="px-4 py-2 rounded-full bg-green-50 text-green-700 text-xs font-black uppercase tracking-widest border border-green-100">
                                High Conversion Rate
                            </div>
                        </div>
                        <div className="space-y-2">
                            <ResultCard title="Subject Line" content={result.subject} type="subject" />
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                <ResultCard title="Cold Email" content={result.emailBody} type="email" />
                                <ResultCard title="LinkedIn DM" content={result.linkedInDM} type="linkedin" />
                            </div>
                            <ResultCard title="Follow-up Email" content={result.followUpEmail} type="followup" />
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-white border border-gray-100 rounded-[3rem] shadow-sm">
                        <div className="w-24 h-24 bg-primary-50 rounded-[2rem] flex items-center justify-center mb-8 relative">
                            <div className="absolute inset-0 bg-primary-200 rounded-[2rem] animate-ping opacity-20"></div>
                            <ClipboardDocumentIcon className="w-10 h-10 text-primary-600 relative z-10" />
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">Ready to generate?</h3>
                        <p className="text-gray-500 max-w-sm font-medium leading-relaxed">
                            Enter your prospect's context on the left and our AI will craft a high-converting multi-channel sequence for you.
                        </p>
                        <div className="mt-8 flex gap-3">
                            {['Personalized', 'Multi-channel', 'AI-Optimized'].map((tag) => (
                                <span key={tag} className="px-4 py-2 rounded-full bg-gray-50 text-gray-400 text-[10px] font-black uppercase tracking-widest border border-gray-100">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
