import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Video, Keyboard, Shield, Users, Zap } from 'lucide-react';
import useAuthStore from '@/store/slices/authStore';

const SLIDES = [
  {
    icon: <Video className="w-9 h-9 text-white" />,
    title: 'Get a link that you can share',
    desc: (
      <>
        Click <strong>New meeting</strong> to get a link you can send to people you want to meet with.
      </>
    ),
  },
  {
    icon: <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    title: 'Invite people you want to meet',
    desc: 'Share the meeting code or link — they can join directly from any browser.',
  },
  {
    icon: <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
    title: 'Your meeting is safe',
    desc: 'No one can join a meeting unless invited or admitted by the host.',
  },
];

const FEATURES = [
  { icon: <Shield className="w-5 h-5 text-[#8ab4f8]" />, title: 'End-to-end encrypted', desc: 'All messages and calls are encrypted in transit.' },
  { icon: <Users className="w-5 h-5 text-[#8ab4f8]" />, title: 'Up to 20 participants', desc: 'Host large meetings with no time limit.' },
  { icon: <Zap className="w-5 h-5 text-[#8ab4f8]" />, title: 'No downloads needed', desc: 'Works directly in any modern browser.' },
];

export default function HomePage() {
  const [code, setCode] = useState('');
  const [slide, setSlide] = useState(0);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
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
      <nav className="flex items-center justify-between px-4 sm:px-8 py-3.5 border-b border-white/8">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-8 h-8 bg-[#4f46e5] rounded-lg flex items-center justify-center">
            <Video className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-semibold text-white tracking-tight">SyncSpace</span>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <span className="text-sm text-[#9aa0a6] hidden lg:block mr-3">
            {fmt(time)} · {fmtDate(time)}
          </span>
          {isAuthenticated ? (
            <button onClick={() => navigate('/dashboard')}
              className="text-sm font-medium text-white bg-[#4f46e5] hover:bg-[#4338ca] px-4 py-2 rounded-lg transition-colors">
              Dashboard
            </button>
          ) : (
            <>
              <Link to="/login"
                className="text-sm font-medium text-[#9aa0a6] hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/5">
                Sign in
              </Link>
              <Link to="/register"
                className="text-sm font-medium text-white bg-[#4f46e5] hover:bg-[#4338ca] px-4 py-2 rounded-lg transition-colors">
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <main className="flex-1 flex flex-col items-center px-4 sm:px-6 pt-14 sm:pt-20 pb-12">
        <div className="w-full max-w-2xl text-center">

          <h1 className="text-4xl sm:text-5xl md:text-[3.5rem] font-semibold text-white leading-tight tracking-tight mb-4 sm:mb-5">
            Premium video meetings.<br className="hidden sm:block" />{' '}
            <span className="sm:hidden"> </span>Now free for everyone.
          </h1>

          <p className="text-base text-[#9aa0a6] max-w-lg mx-auto leading-relaxed mb-8 sm:mb-10">
            Built for seamless collaboration. Secure, enterprise-grade video conferencing that feels lightweight.
          </p>

          {/* Action row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
            {/* New meeting button */}
            <button onClick={handleNew}
              className="flex items-center justify-center gap-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-medium text-sm px-5 py-2.5 rounded-lg transition-colors">
              <Video className="w-4 h-4 flex-shrink-0" />
              New meeting
            </button>

            {/* Code input + Join button */}
            <form onSubmit={handleJoin} className="flex items-center gap-0">
              <div className="flex items-center bg-transparent border border-[#5f6368] hover:border-[#8ab4f8] rounded-lg rounded-r-none px-3 gap-2 transition-colors focus-within:border-[#8ab4f8] flex-1 sm:flex-none border-r-0">
                <Keyboard className="w-4 h-4 text-[#9aa0a6] flex-shrink-0" />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter a code or link"
                  className="bg-transparent text-white text-sm py-2.5 w-full sm:w-44 md:w-52 focus:outline-none placeholder-[#9aa0a6]"
                />
              </div>
              <button type="submit"
                disabled={!code.trim()}
                className="px-4 py-2.5 text-sm font-medium rounded-lg rounded-l-none border border-[#5f6368] border-l-[#3c4043] text-[#8ab4f8] hover:bg-[#4f46e5]/10 hover:text-white disabled:opacity-40 disabled:cursor-default transition-colors whitespace-nowrap flex-shrink-0">
                Join
              </button>
            </form>
          </div>

          <div className="mt-10 sm:mt-12 mb-6 border-t border-[#3c4043]" />
          <p className="text-sm text-[#9aa0a6]">
            <span className="text-[#8ab4f8] font-medium cursor-pointer hover:underline">Learn more</span>
            {' '}about SyncSpace for your enterprise.
          </p>
        </div>

        {/* ── Feature card carousel ── */}
        <div className="w-full max-w-sm sm:max-w-md mt-8 sm:mt-10">
          <div className="relative overflow-hidden rounded-2xl bg-[#303134]">
            <div className="px-8 sm:px-12 py-10 sm:py-12 flex flex-col items-center text-center min-h-[240px] sm:min-h-[260px] justify-center">
              {/* ✦ Circular icon container */}
              <div className="w-16 h-16 bg-[#202124] rounded-full flex items-center justify-center mb-6 shadow-lg">
                {SLIDES[slide].icon}
              </div>
              <h2 className="text-base sm:text-lg font-semibold text-white mb-2.5 leading-snug">
                {SLIDES[slide].title}
              </h2>
              <p className="text-sm text-[#9aa0a6] leading-relaxed max-w-xs">
                {SLIDES[slide].desc}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pb-5">
              {SLIDES.map((_, i) => (
                <button key={i} onClick={() => setSlide(i)}
                  className={`rounded-full transition-all ${i === slide ? 'w-5 h-1.5 bg-[#8ab4f8]' : 'w-1.5 h-1.5 bg-[#5f6368] hover:bg-[#9aa0a6]'}`} />
              ))}
            </div>
          </div>
        </div>

        {/* ── Features row ── */}
        <div className="w-full max-w-2xl mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <div key={i} className="flex flex-col items-center sm:items-start gap-2.5 px-5 py-4 bg-[#303134] rounded-xl border border-white/6 text-center sm:text-left">
              {/* ✦ Circular icon container */}
              <div className="w-9 h-9 bg-[#4f46e5]/12 rounded-full flex items-center justify-center">
                {f.icon}
              </div>
              <p className="text-sm font-medium text-white">{f.title}</p>
              <p className="text-xs text-[#9aa0a6] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[#3c4043] px-4 sm:px-8 py-8 mt-4">
        <div className="max-w-5xl mx-auto">
          {/* Top row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-6">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 bg-[#4f46e5] rounded-lg flex items-center justify-center">
                  <Video className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-semibold text-white">SyncSpace</span>
              </div>
              <p className="text-xs text-[#5f6368] max-w-xs leading-relaxed">
                Secure, enterprise-grade video conferencing for everyone. No account needed to join.
              </p>
            </div>

            {/* Links grid */}
            <div className="flex gap-10 sm:gap-12">
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-semibold text-[#5f6368] uppercase tracking-widest mb-1">Product</p>
                <a href="#" className="text-xs text-[#9aa0a6] hover:text-white transition-colors">Features</a>
                <a href="#" className="text-xs text-[#9aa0a6] hover:text-white transition-colors">Enterprise</a>
                <a href="#" className="text-xs text-[#9aa0a6] hover:text-white transition-colors">Pricing</a>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-semibold text-[#5f6368] uppercase tracking-widest mb-1">Company</p>
                <a href="#" className="text-xs text-[#9aa0a6] hover:text-white transition-colors">About</a>
                <a href="#" className="text-xs text-[#9aa0a6] hover:text-white transition-colors">Blog</a>
                <a href="#" className="text-xs text-[#9aa0a6] hover:text-white transition-colors">Careers</a>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-semibold text-[#5f6368] uppercase tracking-widest mb-1">Legal</p>
                <a href="#" className="text-xs text-[#9aa0a6] hover:text-white transition-colors">Privacy</a>
                <a href="#" className="text-xs text-[#9aa0a6] hover:text-white transition-colors">Terms</a>
                <a href="#" className="text-xs text-[#9aa0a6] hover:text-white transition-colors">Security</a>
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 border-t border-[#3c4043]">
            <p className="text-xs text-[#5f6368]">
              © {new Date().getFullYear()} SyncSpace. All rights reserved.
            </p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
              <span className="text-xs text-[#5f6368]">All systems operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
