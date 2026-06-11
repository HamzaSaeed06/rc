import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Video, Keyboard } from 'lucide-react';
import useAuthStore from '@/store/slices/authStore';

const SLIDES = [
  {
    icon: <Video className="w-10 h-10 text-white" />,
    title: 'Get a link that you can share',
    desc: (
      <>
        Click <strong>New meeting</strong> to get a link you can send to people you want to meet with.
      </>
    ),
  },
  {
    icon: <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    title: 'Invite people you want to meet',
    desc: 'Share the meeting code or link — they can join directly from any browser.',
  },
  {
    icon: <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
    title: 'Your meeting is safe',
    desc: 'No one can join a meeting unless invited or admitted by the host.',
  },
];

export default function HomePage() {
  const [code, setCode] = useState('');
  const [slide, setSlide] = useState(0);
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setSlide(s => (s + 1) % SLIDES.length), 4000);
    return () => clearInterval(id);
  }, []);

  const handleJoin = (e) => {
    e?.preventDefault();
    if (code.trim()) {
      const clean = code.replace(/https?:\/\/[^/]+\/lobby\//, '').replace(/https?:\/\/[^/]+\/room\//, '').trim();
      navigate(`/lobby/${clean}`);
    }
  };

  const handleNew = () => navigate(isAuthenticated ? '/dashboard' : '/register');

  const fmt = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const fmtDate = (d) => d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="min-h-screen bg-[#202124] text-white font-sans flex flex-col">

      {/* ── Navbar ── */}
      <nav className="flex items-center justify-between px-6 py-3 border-b border-white/8">
        {/* Logo */}
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-9 h-9 bg-[#4f46e5] rounded-xl flex items-center justify-center shadow-lg">
            <Video className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-semibold text-white tracking-tight">SyncSpace</span>
        </div>

        {/* Right nav */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-[#9aa0a6] hidden md:block">
            {fmt(time)} · {fmtDate(time)}
          </span>
          {isAuthenticated ? (
            <button onClick={() => navigate('/dashboard')}
              className="text-sm font-medium text-white bg-[#4f46e5] hover:bg-[#4338ca] px-5 py-2 rounded-full transition-colors">
              Dashboard
            </button>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-[#8ab4f8] hover:text-white transition-colors px-2">
                Log in
              </Link>
              <Link to="/register"
                className="text-sm font-semibold text-[#202124] bg-white hover:bg-gray-100 px-5 py-2 rounded-full transition-colors shadow-sm">
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <main className="flex-1 flex flex-col items-center justify-start px-6 pt-20 pb-10">
        <div className="w-full max-w-2xl text-center">
          {/* Headline */}
          <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight tracking-tight mb-5">
            Premium video meetings.<br />Now free for everyone.
          </h1>

          {/* Subtitle */}
          <p className="text-lg text-[#9aa0a6] max-w-lg mx-auto leading-relaxed mb-10">
            Built for seamless collaboration. Secure, enterprise-grade video conferencing that feels lightweight.
          </p>

          {/* Action row */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {/* New meeting button */}
            <button onClick={handleNew}
              className="flex items-center gap-2.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-semibold text-base px-6 py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-[.98]">
              <Video className="w-5 h-5" />
              New meeting
            </button>

            {/* Code input */}
            <form onSubmit={handleJoin} className="flex items-center gap-0">
              <div className="flex items-center bg-transparent border border-[#5f6368] hover:border-[#8ab4f8] rounded-xl px-4 gap-3 transition-colors focus-within:border-[#8ab4f8]">
                <Keyboard className="w-5 h-5 text-[#9aa0a6] flex-shrink-0" />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter a code or link"
                  className="bg-transparent text-white text-base py-3 w-56 focus:outline-none placeholder-[#9aa0a6]"
                />
                {code.trim() && (
                  <button type="submit"
                    className="text-sm font-semibold text-[#8ab4f8] hover:text-white pr-1 transition-colors">
                    Join
                  </button>
                )}
                {!code.trim() && (
                  <span className="text-sm text-[#9aa0a6] pr-1">Join</span>
                )}
              </div>
            </form>
          </div>

          {/* Divider + learn more */}
          <div className="mt-12 mb-8 border-t border-[#3c4043]" />
          <p className="text-sm text-[#9aa0a6]">
            <span className="text-[#8ab4f8] font-medium cursor-pointer hover:underline">Learn more</span>
            {' '}about SyncSpace for your enterprise.
          </p>
        </div>

        {/* ── Feature card carousel ── */}
        <div className="w-full max-w-md mt-10">
          <div className="relative overflow-hidden rounded-3xl"
            style={{ background: 'linear-gradient(145deg, #303134 0%, #2a2c31 60%, #2d2f3a 100%)' }}>
            {/* Slide content */}
            <div className="px-12 py-14 flex flex-col items-center text-center min-h-[280px] justify-center">
              {/* Icon circle */}
              <div className="w-20 h-20 bg-[#1a1a1a] rounded-full flex items-center justify-center mb-8 shadow-2xl">
                {SLIDES[slide].icon}
              </div>
              <h2 className="text-xl font-bold text-white mb-3 leading-snug">
                {SLIDES[slide].title}
              </h2>
              <p className="text-sm text-[#9aa0a6] leading-relaxed max-w-xs">
                {SLIDES[slide].desc}
              </p>
            </div>

            {/* Dot indicators */}
            <div className="flex items-center justify-center gap-2 pb-6">
              {SLIDES.map((_, i) => (
                <button key={i} onClick={() => setSlide(i)}
                  className={`rounded-full transition-all ${i === slide ? 'w-5 h-2 bg-[#8ab4f8]' : 'w-2 h-2 bg-[#5f6368] hover:bg-[#9aa0a6]'}`} />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
