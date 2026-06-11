import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Video, Mail, Lock, User, Loader2, ArrowLeft } from 'lucide-react';
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

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuthStore();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      navigate(location.state?.from || '/dashboard');
    } catch (err) {
      const msg = err.response?.data?.errors?.[0] || err.response?.data?.message || 'Registration failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    setGoogleLoading(true);
    window.location.href = '/api/v1/auth/google';
  };

  return (
    <div className="min-h-screen bg-[#0e0e16] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 right-1/3 w-96 h-96 bg-indigo-600/8 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/3 left-1/3 w-96 h-96 bg-violet-600/8 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 mb-8 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to home
        </Link>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-4 shadow-xl shadow-indigo-600/30">
            <Video className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-gray-500 text-sm mt-1">Free forever · No credit card needed</p>
        </div>

        <div className="bg-[#141420] border border-white/10 rounded-2xl p-8 shadow-2xl">

          {/* Google sign-up */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-800 font-semibold text-sm px-4 py-3 rounded-xl border border-gray-200 transition-all mb-5 disabled:opacity-60 shadow-sm"
          >
            {googleLoading ? <Loader2 className="w-4 h-4 animate-spin text-gray-500" /> : <GoogleIcon />}
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-xs text-gray-600 font-medium">or sign up with email</span>
            <div className="flex-1 h-px bg-white/8" />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/25 text-red-400 text-sm rounded-xl px-4 py-3 mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className="w-full bg-[#1a1a26] border border-white/10 text-white placeholder-gray-600 rounded-xl px-4 py-3 pl-10 text-sm focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className="w-full bg-[#1a1a26] border border-white/10 text-white placeholder-gray-600 rounded-xl px-4 py-3 pl-10 text-sm focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Min. 8 chars, 1 uppercase, 1 number"
                  className="w-full bg-[#1a1a26] border border-white/10 text-white placeholder-gray-600 rounded-xl px-4 py-3 pl-10 text-sm focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/50 text-white font-semibold py-3 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 mt-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
