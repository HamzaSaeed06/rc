import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Video, Plus, LogOut, Users, Globe, Lock, Loader2,
  Search, Clock, X, Eye, EyeOff, LayoutGrid, Keyboard, Check,
} from 'lucide-react';
import useAuthStore from '@/store/slices/authStore';
import api from '@/services/api';
import { getParticipantColor } from '@/utils/participantColors';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: '', isPrivate: false, maxParticipants: 10, password: '', durationMinutes: 0 });
  const [selectedPrivateRoom, setSelectedPrivateRoom] = useState(null);
  const [joinPassword, setJoinPassword] = useState('');
  const [showJoinPw, setShowJoinPw] = useState(false);
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => { fetchRooms(); }, []);

  const fetchRooms = async () => {
    try {
      const { data } = await api.get('/rooms');
      setRooms(data.data.rooms);
    } catch { } finally { setLoading(false); }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { data } = await api.post('/rooms', newRoom);
      navigate(`/lobby/${data.data.room.roomId}`);
    } catch { } finally { setCreating(false); }
  };

  const handleJoinRoom = (room) => {
    if (room.isPrivate) {
      setSelectedPrivateRoom(room);
      setJoinPassword(''); setJoinError(''); setShowJoinPw(false);
    } else {
      navigate(`/lobby/${room.roomId}`);
    }
  };

  const handleVerifyPassword = async (e) => {
    e.preventDefault();
    setVerifyingPassword(true); setJoinError('');
    try {
      await api.post(`/rooms/${selectedPrivateRoom.roomId}/verify-password`, { password: joinPassword });
      const roomId = selectedPrivateRoom.roomId;
      setSelectedPrivateRoom(null);
      navigate(`/lobby/${roomId}`);
    } catch (err) {
      setJoinError(err.response?.data?.message || 'Incorrect password');
    } finally { setVerifyingPassword(false); }
  };

  const handleJoinCodeSubmit = (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    const clean = joinCode.replace(/https?:\/\/[^/]+\/lobby\//, '').replace(/https?:\/\/[^/]+\/room\//, '').trim();
    navigate(`/lobby/${clean}`);
  };

  const handleLogout = async () => { await logout(); navigate('/'); };

  const filteredRooms = rooms.filter((room) => {
    const ms = room.name.toLowerCase().includes(search.toLowerCase()) || room.host?.name?.toLowerCase().includes(search.toLowerCase());
    const mf = filter === 'all' || (filter === 'public' && !room.isPrivate) || (filter === 'private' && room.isPrivate);
    return ms && mf;
  });

  const timeAgo = (d) => {
    const m = Math.floor((Date.now() - new Date(d)) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const color = getParticipantColor(user?._id || user?.name || '');
  const initials = (name) => (name || '?').charAt(0).toUpperCase();
  const getColor = (userId) => getParticipantColor(userId || '').bg;

  return (
    <div className="min-h-screen bg-[#202124] text-white font-sans">

      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-3 border-b border-[#3c4043] sticky top-0 z-20 bg-[#202124]">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-8 h-8 bg-[#4f46e5] rounded-xl flex items-center justify-center">
            <Video className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-white text-sm">SyncSpace</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow cursor-pointer"
            style={{ background: color.bg }}
            title={user?.name}>
            {initials(user?.name)}
          </div>
          <span className="text-sm text-[#e8eaed] hidden sm:block">{user?.name}</span>
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-[#9aa0a6] hover:text-white px-3 py-2 rounded-xl hover:bg-[#3c4043] transition-all">
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:block">Sign out</span>
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Top row */}
        <div className="flex items-start justify-between mb-7 flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">
              {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'}, {user?.name?.split(' ')[0]}
            </h1>
            <p className="text-sm text-[#9aa0a6] mt-0.5">
              {rooms.length > 0 ? `${rooms.length} active room${rooms.length !== 1 ? 's' : ''}` : 'No active rooms'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <form onSubmit={handleJoinCodeSubmit} className="hidden md:flex items-center gap-0 border border-[#5f6368] hover:border-[#8ab4f8] focus-within:border-[#8ab4f8] rounded-xl px-3 transition-colors">
              <Keyboard className="w-3.5 h-3.5 text-[#9aa0a6] flex-shrink-0" />
              <input type="text" placeholder="Enter a code or link" value={joinCode} onChange={(e) => setJoinCode(e.target.value)}
                className="w-52 bg-transparent text-white text-sm py-2.5 px-3 focus:outline-none placeholder-[#9aa0a6]" />
              {joinCode.trim() && (
                <button type="submit" className="text-xs font-semibold text-[#8ab4f8] hover:text-white transition-colors">Join</button>
              )}
            </form>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors">
              <Plus className="w-4 h-4" />
              New meeting
            </button>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-2.5 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9aa0a6] pointer-events-none" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search meetings…"
              className="w-full bg-[#303134] border border-[#5f6368]/50 hover:border-[#5f6368] focus:border-[#8ab4f8] text-white placeholder-[#9aa0a6] rounded-xl px-4 py-2.5 pl-9 text-sm focus:outline-none transition-colors" />
          </div>
          <div className="flex gap-1 p-1 bg-[#303134] border border-[#5f6368]/40 rounded-xl">
            {['all', 'public', 'private'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${filter === f ? 'bg-[#4f46e5] text-white shadow' : 'text-[#9aa0a6] hover:text-white'}`}>
                {f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>
        </div>

        {/* Rooms grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-[#4f46e5] animate-spin" />
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 bg-[#303134] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <LayoutGrid className="w-8 h-8 text-[#5f6368]" />
            </div>
            <p className="text-[#9aa0a6] text-sm">
              {search || filter !== 'all' ? 'No rooms match.' : 'No active rooms — start one!'}
            </p>
            {!search && filter === 'all' && (
              <button onClick={() => setShowModal(true)}
                className="mt-4 inline-flex items-center gap-2 text-sm text-[#8ab4f8] hover:underline font-medium">
                <Plus className="w-4 h-4" /> Create your first meeting
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredRooms.map((room) => (
              <div key={room._id} onClick={() => handleJoinRoom(room)}
                className="group bg-[#303134] border border-[#5f6368]/30 hover:border-[#4f46e5]/50 rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:bg-[#35363a] hover:shadow-lg">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${room.isPrivate ? 'bg-amber-400/10' : 'bg-[#4f46e5]/15'}`}>
                    {room.isPrivate ? <Lock className="w-4 h-4 text-amber-400" /> : <Globe className="w-4 h-4 text-[#8ab4f8]" />}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {room.isPrivate && (
                      <span className="text-[10px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">Private</span>
                    )}
                    <span className="text-[10px] text-[#9aa0a6] bg-[#3c4043] px-2 py-0.5 rounded-full font-medium">
                      {room.participants?.length || 0}/{room.maxParticipants}
                    </span>
                  </div>
                </div>
                <h3 className="font-semibold text-white text-sm mb-1 truncate group-hover:text-[#8ab4f8] transition-colors">
                  {room.name}
                </h3>
                <p className="text-xs text-[#9aa0a6] flex items-center gap-1 mb-4">
                  <Users className="w-3 h-3" /> {room.host?.name}
                </p>
                <div className="flex items-center justify-between pt-3 border-t border-[#3c4043]">
                  <div className="flex -space-x-1.5">
                    {(room.participants?.slice(0, 4) || []).map((p, i) => (
                      <div key={i}
                        className="w-6 h-6 rounded-full border-2 border-[#303134] flex items-center justify-center text-[9px] font-bold text-white"
                        style={{ background: getColor(p.user?._id || p.user?.name) }} title={p.user?.name}>
                        {initials(p.user?.name)}
                      </div>
                    ))}
                    {(room.participants?.length || 0) > 4 && (
                      <div className="w-6 h-6 rounded-full bg-[#3c4043] border-2 border-[#303134] flex items-center justify-center text-[9px] text-[#9aa0a6]">
                        +{room.participants.length - 4}
                      </div>
                    )}
                    {(room.participants?.length || 0) === 0 && (
                      <span className="text-[10px] text-[#5f6368]">Empty</span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#5f6368] flex items-center gap-1">
                    <Clock className="w-3 h-3" />{timeAgo(room.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Room Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}>
          <div className="bg-[#303134] border border-[#5f6368]/40 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-scale-in"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-white">New meeting</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-xl hover:bg-[#3c4043] text-[#9aa0a6] hover:text-white transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#9aa0a6] mb-1.5">Meeting name</label>
                <input type="text" value={newRoom.name} onChange={e => setNewRoom({ ...newRoom, name: e.target.value })}
                  placeholder="e.g. Team Standup"
                  className="w-full bg-[#202124] border border-[#5f6368] focus:border-[#8ab4f8] text-white placeholder-[#5f6368] rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
                  required maxLength={100} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#9aa0a6] mb-1.5">Max participants</label>
                  <input type="number" value={newRoom.maxParticipants}
                    onChange={e => setNewRoom({ ...newRoom, maxParticipants: parseInt(e.target.value) })}
                    className="w-full bg-[#202124] border border-[#5f6368] focus:border-[#8ab4f8] text-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
                    min={2} max={20} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#9aa0a6] mb-1.5">Duration</label>
                  <select value={newRoom.durationMinutes}
                    onChange={e => setNewRoom({ ...newRoom, durationMinutes: parseInt(e.target.value) })}
                    className="w-full bg-[#202124] border border-[#5f6368] focus:border-[#8ab4f8] text-white rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors appearance-none">
                    <option value={0}>No limit</option>
                    <option value={30}>30 min</option>
                    <option value={60}>1 hour</option>
                    <option value={90}>1.5 hrs</option>
                    <option value={120}>2 hours</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer p-3.5 rounded-xl bg-[#202124] border border-[#5f6368]/50 hover:border-[#5f6368] transition-all"
                onClick={() => setNewRoom({ ...newRoom, isPrivate: !newRoom.isPrivate, password: '' })}>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${newRoom.isPrivate ? 'bg-[#4f46e5] border-[#4f46e5]' : 'border-[#5f6368] bg-transparent'}`}>
                  {newRoom.isPrivate && <Check className="w-3 h-3 text-white" />}
                </div>
                <div>
                  <p className="text-sm text-white font-medium">Private meeting</p>
                  <p className="text-xs text-[#9aa0a6]">Requires a password to enter</p>
                </div>
              </label>
              {newRoom.isPrivate && (
                <div className="animate-fade-in">
                  <label className="block text-xs font-medium text-[#9aa0a6] mb-1.5">Password</label>
                  <input type="password" value={newRoom.password}
                    onChange={e => setNewRoom({ ...newRoom, password: e.target.value })}
                    placeholder="4–32 characters"
                    className="w-full bg-[#202124] border border-[#5f6368] focus:border-[#8ab4f8] text-white placeholder-[#5f6368] rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
                    required minLength={4} maxLength={32} />
                </div>
              )}
              <div className="flex gap-2.5 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-[#3c4043] hover:bg-[#4a4b4f] text-[#e8eaed] text-sm font-semibold transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={creating}
                  className="flex-1 py-2.5 rounded-xl bg-[#4f46e5] hover:bg-[#4338ca] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {selectedPrivateRoom && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPrivateRoom(null)}>
          <div className="bg-[#303134] border border-[#5f6368]/40 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-in"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-amber-400/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Lock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Private meeting</h2>
                <p className="text-xs text-[#9aa0a6] mt-0.5 truncate">"{selectedPrivateRoom.name}"</p>
              </div>
            </div>
            <form onSubmit={handleVerifyPassword} className="space-y-3">
              <div className="relative">
                <input type={showJoinPw ? 'text' : 'password'} value={joinPassword}
                  onChange={e => setJoinPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-[#202124] border border-[#5f6368] focus:border-[#8ab4f8] text-white placeholder-[#5f6368] rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none transition-colors"
                  required autoFocus />
                <button type="button" onClick={() => setShowJoinPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9aa0a6] hover:text-white transition-colors">
                  {showJoinPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {joinError && <p className="text-xs text-red-400">{joinError}</p>}
              <div className="flex gap-2.5 pt-1">
                <button type="button" onClick={() => setSelectedPrivateRoom(null)}
                  className="flex-1 py-2.5 rounded-xl bg-[#3c4043] hover:bg-[#4a4b4f] text-[#e8eaed] text-sm font-semibold transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={verifyingPassword || !joinPassword}
                  className="flex-1 py-2.5 rounded-xl bg-[#4f46e5] hover:bg-[#4338ca] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                  {verifyingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {verifyingPassword ? 'Checking…' : 'Join'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
