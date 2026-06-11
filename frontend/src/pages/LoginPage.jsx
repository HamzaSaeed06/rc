import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Video, Mail, Lock, Loader2 } from 'lucide-react';
import useAuthStore from '@/store/slices/authStore';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form);
      navigate(location.state?.from || '/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    setGoogleLoading(true);
    window.location.href = '/api/v1/auth/google';
  };

  return (
    <div className="min-h-screen bg-[#202124] flex flex-col">
      {/* Nav */}
      <nav className="flex items-center px-6 py-3 border-b border-white/8">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-9 h-9 bg-[#4f46e5] rounded-xl flex items-center justify-center shadow-lg">
            <Video className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-semibold text-white">SyncSpace</span>
        </div>
      </nav>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Sign in</h1>
            <p className="text-sm text-[#9aa0a6]">to continue to SyncSpace</p>
          </div>

          <div className="bg-[#303134] border border-[#5f6368]/40 rounded-2xl p-7 shadow-2xl">
            {/* Google */}
            <button type="button" onClick={handleGoogle} disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-[#202124] font-semibold text-sm px-4 py-2.5 rounded-xl border border-gray-200 transition-all mb-5 disabled:opacity-60 shadow-sm">
              {googleLoading ? <Loader2 className="w-4 h-4 animate-spin text-gray-500" /> : <GoogleIcon />}
              Continue with Google
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-[#5f6368]/40" />
              <span className="text-xs text-[#9aa0a6]">or</span>
              <div className="flex-1 h-px bg-[#5f6368]/40" />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 mb-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9aa0a6] pointer-events-none" />
                <input type="email" name="email" value={form.email} onChange={handleChange}
                  placeholder="Email address"
                  className="w-full bg-[#202124] border border-[#5f6368] hover:border-[#8ab4f8] focus:border-[#8ab4f8] text-white placeholder-[#9aa0a6] rounded-xl px-4 py-3 pl-10 text-sm focus:outline-none transition-colors"
                  required autoComplete="email" />
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9aa0a6] pointer-events-none" />
                <input type="password" name="password" value={form.password} onChange={handleChange}
                  placeholder="Password"
                  className="w-full bg-[#202124] border border-[#5f6368] hover:border-[#8ab4f8] focus:border-[#8ab4f8] text-white placeholder-[#9aa0a6] rounded-xl px-4 py-3 pl-10 text-sm focus:outline-none transition-colors"
                  required autoComplete="current-password" />
              </div>

              <button type="submit" disabled={loading}
                className="w-full bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 mt-1 shadow-lg shadow-indigo-600/20">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <p className="text-center text-sm text-[#9aa0a6] mt-5">
              Don't have an account?{' '}
              <Link to="/register" className="text-[#8ab4f8] hover:underline font-medium">Create account</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
