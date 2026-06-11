import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Video, Keyboard, Shield, Zap, Users, Globe, ArrowRight, Check, Star, Lock, Monitor } from 'lucide-react';
import useAuthStore from '@/store/slices/authStore';

const FEATURES = [
  { icon: <Video className="w-6 h-6" />, title: 'Crystal Clear Video', desc: 'HD video calls with adaptive quality. Looks great even on slow connections.' },
  { icon: <Shield className="w-6 h-6" />, title: 'End-to-End Encrypted', desc: 'Messages and calls are encrypted. Only you and your participants can see them.' },
  { icon: <Monitor className="w-6 h-6" />, title: 'Screen Sharing', desc: 'Share your screen, a window, or a browser tab with one click.' },
  { icon: <Users className="w-6 h-6" />, title: 'Collaborative Whiteboard', desc: 'Brainstorm together on a shared canvas in real time.' },
  { icon: <Zap className="w-6 h-6" />, title: 'Instant Rooms', desc: 'Create a room and share the link. No downloads, no installs needed.' },
  { icon: <Lock className="w-6 h-6" />, title: 'Private Rooms', desc: 'Password-protect your room so only invited guests can join.' },
];

const STEPS = [
  { step: '01', title: 'Create a room', desc: 'Hit "New Meeting" and get a shareable link in seconds.' },
  { step: '02', title: 'Invite anyone', desc: 'Share the link or the room code. No account needed to join.' },
  { step: '03', title: 'Collaborate', desc: 'Chat, share your screen, draw on the whiteboard, or share files.' },
];

export default function HomePage() {
  const [code, setCode] = useState('');
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [time, setTime] = useState(new Date());
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleJoin = (e) => {
    e?.preventDefault();
    if (code.trim()) {
      const clean = code.replace(/https?:\/\/[^/]+\/lobby\//, '').replace(/https?:\/\/[^/]+\/room\//, '').trim();
      navigate(`/lobby/${clean}`);
    }
  };

  const fmt = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const fmtDate = (d) => d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="min-h-screen bg-[#0e0e16] text-white font-sans">

      {/* ── Navbar ── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#0e0e16]/95 backdrop-blur-md border-b border-white/8 shadow-xl' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Video className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">SyncSpace</span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">Features</a>
            <a href="#how" className="text-sm text-gray-400 hover:text-white transition-colors">How it works</a>
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden md:block text-sm text-gray-500">{fmt(time)} · {fmtDate(time)}</span>
            {isAuthenticated ? (
              <button onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all shadow-lg shadow-indigo-600/20">
                Dashboard <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="text-sm text-gray-300 hover:text-white px-4 py-2 rounded-xl hover:bg-white/8 transition-all">Sign in</Link>
                <Link to="/register" className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl transition-all shadow-lg shadow-indigo-600/20">Get started</Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-20 overflow-hidden">
        {/* Background glow blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/3 w-[600px] h-[600px] bg-indigo-600/12 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-[100px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-900/5 rounded-full blur-[150px]" />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 mb-8">
            <Star className="w-3.5 h-3.5 text-indigo-400 fill-indigo-400" />
            <span className="text-xs font-semibold text-indigo-300">Free for everyone — always</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-[1.05] tracking-tight">
            Video meetings that{' '}
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              actually work
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            HD video calls, encrypted chat, screen sharing, whiteboard — all in one place. Start a meeting in seconds, no downloads required.
          </p>

          {/* CTA block */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <button
              onClick={() => navigate(isAuthenticated ? '/dashboard' : '/register')}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-7 py-3.5 rounded-2xl text-base transition-all shadow-xl shadow-indigo-600/25 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Video className="w-5 h-5" />
              {isAuthenticated ? 'Start a meeting' : 'Get started free'}
            </button>

            <form onSubmit={handleJoin} className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-72">
                <Keyboard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Enter a code or link…"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full bg-white/8 border border-white/12 rounded-2xl py-3.5 pl-10 pr-4 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-indigo-500/60 focus:bg-white/10 transition-all"
                />
              </div>
              <button type="submit" disabled={!code.trim()}
                className="bg-white/10 hover:bg-white/15 border border-white/12 text-white font-semibold px-5 py-3.5 rounded-2xl text-sm transition-all disabled:opacity-40">
                Join
              </button>
            </form>
          </div>

          {isAuthenticated && (
            <p className="text-sm text-gray-500">Welcome back, <span className="text-gray-300 font-medium">{user?.name}</span> 👋</p>
          )}

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-6 mt-10 flex-wrap">
            {['No sign-up to join', 'End-to-end encrypted', 'HD quality'].map((t) => (
              <div key={t} className="flex items-center gap-1.5 text-sm text-gray-500">
                <Check className="w-3.5 h-3.5 text-green-400" />
                {t}
              </div>
            ))}
          </div>

          {/* Mock video grid preview */}
          <div className="mt-16 mx-auto max-w-3xl bg-[#151520] rounded-3xl border border-white/8 p-4 shadow-2xl shadow-black/50">
            <div className="grid grid-cols-2 gap-3">
              {[
                { initials: 'AJ', color: '#1a73e8', name: 'Alex Johnson', speaking: true },
                { initials: 'SC', color: '#0f9d58', name: 'Sarah Chen', speaking: false },
                { initials: 'MW', color: '#f9ab00', name: 'Marcus W.', speaking: false },
                { initials: 'JR', color: '#a142f4', name: 'James R.', speaking: false },
              ].map((p) => (
                <div key={p.name} className={`relative bg-[#1e1e2a] rounded-2xl aspect-video flex items-center justify-center border-2 transition-all ${p.speaking ? 'border-green-500/60 shadow-lg shadow-green-500/10' : 'border-transparent'}`}>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-lg" style={{ background: p.color }}>
                      {p.initials}
                    </div>
                    <span className="text-xs text-gray-400">{p.name}</span>
                  </div>
                  {p.speaking && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/50 rounded-full px-2 py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-[10px] text-white">Speaking</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-center gap-3">
              {['Mic', 'Camera', 'Screen', 'Chat', 'Leave'].map((c, i) => (
                <div key={c} className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${i === 4 ? 'bg-red-600 text-white' : 'bg-white/10 text-gray-400'}`}>
                  {c[0]}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-6 border-t border-white/6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Everything you need in one place</h2>
            <p className="text-gray-400 max-w-xl mx-auto">No extra apps, no subscriptions. All the collaboration tools you actually use.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-[#141420] border border-white/8 rounded-2xl p-6 hover:border-indigo-500/30 hover:bg-[#17172a] transition-all group">
                <div className="w-11 h-11 bg-indigo-600/15 rounded-xl flex items-center justify-center mb-4 text-indigo-400 group-hover:bg-indigo-600/20 transition-colors">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="py-24 px-6 border-t border-white/6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Up and running in 30 seconds</h2>
            <p className="text-gray-400">No configuration, no waiting.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <div key={s.step} className="flex flex-col items-center text-center relative">
                <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-indigo-600/20">
                  <span className="text-lg font-bold text-white">{s.step}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-7 left-[calc(50%+36px)] right-[calc(-50%+36px)] h-px bg-gradient-to-r from-white/10 to-white/5" />
                )}
                <h3 className="font-semibold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-6 border-t border-white/6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Ready to meet?</h2>
          <p className="text-gray-400 mb-10">Join thousands of teams already using SyncSpace for their daily standups, client calls, and everything in between.</p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button onClick={() => navigate(isAuthenticated ? '/dashboard' : '/register')}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-3.5 rounded-2xl transition-all shadow-xl shadow-indigo-600/25 hover:scale-[1.02]">
              <Video className="w-5 h-5" />
              Start for free
            </button>
            {!isAuthenticated && (
              <Link to="/login" className="text-gray-400 hover:text-white text-sm font-medium transition-colors">
                Already have an account? Sign in →
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/8 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Video className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-400">SyncSpace</span>
          </div>
          <p className="text-xs text-gray-600">Real-Time Collaboration Platform · Built with ❤️</p>
        </div>
      </footer>
    </div>
  );
}
