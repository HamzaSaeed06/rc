import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Video, Plus, LogOut, Users, Globe, Lock, Loader2,
  Search, Clock, X, Eye, EyeOff, LayoutGrid, Keyboard,
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
  const getColor = (name) => getParticipantColor(name || '').bg;

  return (
    <div className="min-h-screen bg-[#0e0e16]">

      {/* Navbar */}
      <nav className="border-b border-white/8 px-6 py-3.5 sticky top-0 z-20 bg-[#0e0e16]/95 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/25">
              <Video className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-sm">SyncSpace</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/dashboard')}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow"
                style={{ background: color.bg }}>
                {initials(user?.name)}
              </div>
              <span className="text-sm text-gray-300 hidden sm:block font-medium">{user?.name}</span>
            </div>
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white px-3 py-2 rounded-xl hover:bg-white/8 transition-all">
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Sign out</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Hero header */}
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]} 👋
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {rooms.length > 0 ? `${rooms.length} active room${rooms.length !== 1 ? 's' : ''}` : 'No active rooms yet'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
            <form onSubmit={handleJoinCodeSubmit} className="hidden md:flex items-center gap-2">
              <div className="relative">
                <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Enter a code or link"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="w-56 bg-[#141420] border border-white/10 text-white placeholder-gray-600 rounded-xl px-4 py-2.5 pl-9 text-sm focus:outline-none focus:border-indigo-500/50 transition-all"
                />
              </div>
              <button type="submit" disabled={!joinCode.trim()}
                className="font-medium text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40 transition-colors">
                Join
              </button>
            </form>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/20">
              <Plus className="w-4 h-4" />
              New Meeting
            </button>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-2.5 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search meetings…"
              className="w-full bg-[#141420] border border-white/10 text-white placeholder-gray-600 rounded-xl px-4 py-2.5 pl-9 text-sm focus:outline-none focus:border-indigo-500/50 transition-all" />
          </div>
          <div className="flex gap-1 p-1 bg-[#141420] border border-white/8 rounded-xl">
            {['all', 'public', 'private'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${filter === f ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}>
                {f === 'all' ? 'All' : f === 'public' ? 'Public' : 'Private'}
              </button>
            ))}
          </div>
        </div>

        {/* Rooms */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <LayoutGrid className="w-8 h-8 text-gray-600" />
            </div>
            <p className="text-gray-500 text-sm font-medium">
              {search || filter !== 'all' ? 'No rooms match your search.' : 'No active rooms — start one!'}
            </p>
            {!search && filter === 'all' && (
              <button onClick={() => setShowModal(true)}
                className="mt-4 inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                <Plus className="w-4 h-4" /> Create your first meeting
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredRooms.map((room) => (
              <div key={room._id} onClick={() => handleJoinRoom(room)}
                className="group bg-[#141420] border border-white/8 hover:border-indigo-500/30 rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:bg-[#171726] hover:shadow-lg hover:shadow-indigo-500/5">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${room.isPrivate ? 'bg-amber-400/12' : 'bg-indigo-600/15'}`}>
                    {room.isPrivate
                      ? <Lock className="w-4.5 h-4.5 text-amber-400" />
                      : <Globe className="w-4.5 h-4.5 text-indigo-400" />}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {room.isPrivate && (
                      <span className="text-[10px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">Private</span>
                    )}
                    <span className="text-[10px] text-gray-500 bg-white/6 border border-white/8 px-2 py-0.5 rounded-full font-medium">
                      {room.participants?.length || 0}/{room.maxParticipants}
                    </span>
                  </div>
                </div>
                <h3 className="font-semibold text-white text-sm mb-1 truncate group-hover:text-indigo-300 transition-colors">
                  {room.name}
                </h3>
                <p className="text-xs text-gray-500 flex items-center gap-1 mb-4">
                  <Users className="w-3 h-3" /> {room.host?.name}
                </p>
                <div className="flex items-center justify-between pt-3 border-t border-white/6">
                  <div className="flex -space-x-1.5">
                    {(room.participants?.slice(0, 4) || []).map((p, i) => (
                      <div key={i} className="w-6 h-6 rounded-full border-2 border-[#141420] flex items-center justify-center text-[9px] font-bold text-white"
                        style={{ background: getColor(p.user?.name) }} title={p.user?.name}>
                        {initials(p.user?.name)}
                      </div>
                    ))}
                    {(room.participants?.length || 0) > 4 && (
                      <div className="w-6 h-6 rounded-full bg-white/10 border-2 border-[#141420] flex items-center justify-center text-[9px] text-gray-400">
                        +{room.participants.length - 4}
                      </div>
                    )}
                    {(room.participants?.length || 0) === 0 && (
                      <span className="text-[10px] text-gray-600">Empty</span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-600 flex items-center gap-1">
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
          <div className="bg-[#141420] border border-white/12 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600/15 rounded-lg flex items-center justify-center">
                  <Video className="w-4 h-4 text-indigo-400" />
                </div>
                <h2 className="text-base font-bold text-white">New Meeting</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-xl hover:bg-white/8 text-gray-500 hover:text-white transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Meeting Name</label>
                <input type="text" value={newRoom.name} onChange={e => setNewRoom({ ...newRoom, name: e.target.value })}
                  placeholder="e.g. Team Standup"
                  className="w-full bg-[#1a1a26] border border-white/10 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                  required maxLength={100} autoFocus />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Max Participants</label>
                <input type="number" value={newRoom.maxParticipants}
                  onChange={e => setNewRoom({ ...newRoom, maxParticipants: parseInt(e.target.value) })}
                  className="w-full bg-[#1a1a26] border border-white/10 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/60 transition-all"
                  min={2} max={20} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Duration</label>
                <select value={newRoom.durationMinutes}
                  onChange={e => setNewRoom({ ...newRoom, durationMinutes: parseInt(e.target.value) })}
                  className="w-full bg-[#1a1a26] border border-white/10 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/60 transition-all appearance-none">
                  <option value={0}>No limit</option>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={90}>1.5 hours</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>
              <label className="flex items-center gap-3 cursor-pointer p-3.5 rounded-xl bg-white/4 hover:bg-white/6 border border-white/8 transition-all">
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${newRoom.isPrivate ? 'bg-indigo-600 border-indigo-600' : 'border-white/20 bg-transparent'}`}
                  onClick={() => setNewRoom({ ...newRoom, isPrivate: !newRoom.isPrivate, password: '' })}>
                  {newRoom.isPrivate && <Check className="w-3 h-3 text-white" />}
                </div>
                <div>
                  <span className="text-sm text-white font-medium">Private meeting</span>
                  <p className="text-xs text-gray-500 mt-0.5">Requires a password to enter</p>
                </div>
              </label>
              {newRoom.isPrivate && (
                <div className="animate-fade-in">
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Password</label>
                  <input type="password" value={newRoom.password}
                    onChange={e => setNewRoom({ ...newRoom, password: e.target.value })}
                    placeholder="4–32 characters"
                    className="w-full bg-[#1a1a26] border border-white/10 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/60 transition-all"
                    required minLength={4} maxLength={32} />
                </div>
              )}
              <div className="flex gap-2.5 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/6 hover:bg-white/10 border border-white/8 text-gray-300 text-sm font-semibold transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={creating}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-600/20">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {creating ? 'Creating…' : 'Create Meeting'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Verify Password Modal */}
      {selectedPrivateRoom && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPrivateRoom(null)}>
          <div className="bg-[#141420] border border-white/12 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-fade-in"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-amber-400/12 rounded-xl flex items-center justify-center flex-shrink-0">
                <Lock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Private Meeting</h2>
                <p className="text-xs text-gray-500 mt-0.5 truncate">"{selectedPrivateRoom.name}"</p>
              </div>
            </div>
            <form onSubmit={handleVerifyPassword} className="space-y-3">
              <div className="relative">
                <input type={showJoinPw ? 'text' : 'password'} value={joinPassword}
                  onChange={e => setJoinPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-[#1a1a26] border border-white/10 text-white placeholder-gray-600 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:border-indigo-500/60 transition-all"
                  required autoFocus />
                <button type="button" onClick={() => setShowJoinPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                  {showJoinPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {joinError && <p className="text-xs text-red-400">{joinError}</p>}
              <div className="flex gap-2.5 pt-1">
                <button type="button" onClick={() => setSelectedPrivateRoom(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/6 hover:bg-white/10 border border-white/8 text-gray-300 text-sm font-semibold transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={verifyingPassword || !joinPassword}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50">
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

