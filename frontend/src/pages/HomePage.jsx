import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Video, Keyboard, ChevronRight } from 'lucide-react';
import useAuthStore from '@/store/slices/authStore';

export default function HomePage() {
    const [code, setCode] = useState('');
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuthStore();
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const handleJoin = (e) => {
        e.preventDefault();
        if (code.trim()) {
            const cleanCode = code.replace(/https?:\/\/[^\/]+\/lobby\//, '').trim();
            navigate(`/lobby/${cleanCode}`);
        }
    };

    const formattedTime = time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const formattedDate = time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

    return (
        <div className="min-h-screen bg-[#202124] text-white flex flex-col font-sans selection:bg-primary-500/30">
            {/* Header */}
            <header className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="bg-primary-500 p-1.5 rounded-lg">
                        <Video className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xl font-medium tracking-tight text-white/90">SyncSpace</span>
                </div>

                <div className="flex items-center gap-6">
                    <div className="hidden md:flex text-sm font-medium text-gray-400">
                        {formattedTime} • {formattedDate}
                    </div>
                    {isAuthenticated ? (
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-300 hidden sm:block">Hi, {user?.name}</span>
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="bg-[#8ab4f8] hover:bg-[#aecbfa] text-dark-900 px-5 py-2 rounded-md font-medium transition-colors text-sm"
                            >
                                Go to Dashboard
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-4">
                            <Link to="/login" className="text-[#8ab4f8] hover:underline text-sm font-medium">
                                Log in
                            </Link>
                            <Link
                                to="/register"
                                className="bg-[#8ab4f8] hover:bg-[#aecbfa] text-dark-900 px-5 py-2 rounded-md font-medium transition-colors text-sm"
                            >
                                Sign up
                            </Link>
                        </div>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col lg:flex-row items-center justify-center p-6 lg:px-24 gap-12 lg:gap-24 mb-16">
                {/* Left Column - Actions */}
                <div className="flex-1 max-w-xl flex flex-col items-center lg:items-start text-center lg:text-left">
                    <h1 className="text-4xl lg:text-[2.75rem] leading-[1.2] font-normal text-white mb-4 tracking-tight">
                        Premium video meetings.<br />Now free for everyone.
                    </h1>
                    <p className="text-gray-400 text-lg mb-10 max-w-md">
                        Built for seamless collaboration. Secure, enterprise-grade video conferencing that feels lightweight.
                    </p>

                    <div className="flex flex-col sm:flex-row w-full lg:w-auto items-center gap-4 sm:gap-6">
                        <button
                            onClick={() => navigate(isAuthenticated ? '/dashboard' : '/login')}
                            className="w-full sm:w-auto bg-[#8ab4f8] hover:bg-[#aecbfa] text-dark-900 px-6 py-3 rounded-md font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            <Video className="w-5 h-5" />
                            New meeting
                        </button>

                        <form onSubmit={handleJoin} className="relative w-full sm:w-auto flex items-center">
                            <div className="relative w-full">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Keyboard className="w-5 h-5 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Enter a code or link"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    className="w-full bg-transparent border border-gray-500 rounded-md py-3 pl-10 pr-4 text-white placeholder-gray-400 focus:outline-none focus:border-[#8ab4f8] focus:ring-1 focus:ring-[#8ab4f8] transition-all"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={!code.trim()}
                                className="ml-4 font-medium text-gray-400 hover:text-[#8ab4f8] disabled:opacity-50 disabled:hover:text-gray-400 transition-colors hidden sm:block"
                            >
                                Join
                            </button>
                        </form>
                    </div>

                    {/* Mobile Join Button */}
                    <button
                        onClick={handleJoin}
                        disabled={!code.trim()}
                        className="mt-4 font-medium text-gray-400 hover:text-[#8ab4f8] disabled:opacity-50 sm:hidden transition-colors"
                    >
                        Join
                    </button>

                    <div className="mt-10 border-t border-gray-700 w-full lg:w-[80%] pt-6 text-sm text-gray-400">
                        <a href="#" className="text-[#8ab4f8] hover:underline">Learn more</a> about SyncSpace for your enterprise.
                    </div>
                </div>

                {/* Right Column - Carousel / Graphic */}
                <div className="flex-1 max-w-xl w-full hidden md:flex flex-col items-center justify-center">
                    <div className="w-full aspect-square md:aspect-video lg:aspect-square bg-[#3c4043] rounded-3xl p-8 flex flex-col items-center justify-center border border-white/5 relative overflow-hidden shadow-2xl">
                        {/* Mock abstract geometric graphic */}
                        <div className="w-48 h-48 sm:w-64 sm:h-64 rounded-full bg-gradient-to-br from-primary-500/20 to-blue-500/20 absolute blur-3xl" />

                        <div className="z-10 text-center">
                            <div className="w-24 h-24 bg-[#1e1e1e] rounded-full mx-auto mb-6 flex items-center justify-center border border-white/10 shadow-lg">
                                <Video className="w-10 h-10 text-[#8ab4f8]" />
                            </div>
                            <h3 className="text-xl text-white font-medium mb-3">Get a link that you can share</h3>
                            <p className="text-sm text-gray-400 max-w-xs mx-auto">
                                Click <span className="font-semibold text-gray-300">New meeting</span> to get a link you can send to people you want to meet with.
                            </p>
                        </div>

                        {/* Pagination dots mock */}
                        <div className="absolute bottom-6 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#8ab4f8]"></span>
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
