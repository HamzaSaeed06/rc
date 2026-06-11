import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Video, Plus, LogOut, Users, Globe, Lock, Loader2,
  Search, Clock, X, Eye, EyeOff,
} from 'lucide-react';
import useAuthStore from '@/store/slices/authStore';
import api from '@/services/api';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: '', isPrivate: false, maxParticipants: 10, password: '' });
  const [selectedPrivateRoom, setSelectedPrivateRoom] = useState(null);
  const [joinPassword, setJoinPassword] = useState('');
  const [showJoinPw, setShowJoinPw] = useState(false);
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'public' | 'private'

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const { data } = await api.get('/rooms');
      setRooms(data.data.rooms);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { data } = await api.post('/rooms', newRoom);
      navigate(`/room/${data.data.room.roomId}`);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinRoom = (room) => {
    if (room.isPrivate) {
      setSelectedPrivateRoom(room);
      setJoinPassword('');
      setJoinError('');
      setShowJoinPw(false);
    } else {
      navigate(`/room/${room.roomId}`);
    }
  };

  const handleVerifyPassword = async (e) => {
    e.preventDefault();
    setVerifyingPassword(true);
    setJoinError('');
    try {
      await api.post(`/rooms/${selectedPrivateRoom.roomId}/verify-password`, {
        password: joinPassword,
      });
      setSelectedPrivateRoom(null);
      navigate(`/room/${selectedPrivateRoom.roomId}`);
    } catch (err) {
      setJoinError(err.response?.data?.message || 'Incorrect password');
    } finally {
      setVerifyingPassword(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // ─── Filtering + Search ─────────────────────────────────────────────────────
  const filteredRooms = rooms.filter((room) => {
    const matchesSearch = room.name.toLowerCase().includes(search.toLowerCase()) ||
      room.host?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === 'all' ||
      (filter === 'public' && !room.isPrivate) ||
      (filter === 'private' && room.isPrivate);
    return matchesSearch && matchesFilter;
  });

  // ─── Relative time ──────────────────────────────────────────────────────────
  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Navbar */}
      <nav className="border-b border-dark-700 px-6 py-4 sticky top-0 z-10 bg-dark-900 bg-opacity-95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <Video className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-white">SyncSpace</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-sm font-medium text-white">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-gray-300 hidden sm:block">{user?.name}</span>
            </div>
            <button onClick={handleLogout} className="btn-ghost flex items-center gap-2 text-sm">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:block">Sign out</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Rooms</h1>
            <p className="text-gray-400 text-sm mt-1">
              {rooms.length} active room{rooms.length !== 1 ? 's' : ''} — join one or create your own
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Room
          </button>
        </div>

        {/* Search + Filter bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by room name or host..."
              className="input-field pl-9 text-sm"
            />
          </div>
          <div className="flex gap-2">
            {['all', 'public', 'private'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors duration-200 ${
                  filter === f
                    ? 'bg-primary-600 text-white'
                    : 'bg-dark-700 text-gray-400 hover:text-white hover:bg-dark-600'
                }`}
              >
                {f === 'all' ? 'All' : f === 'public' ? '🌐 Public' : '🔒 Private'}
              </button>
            ))}
          </div>
        </div>

        {/* Rooms Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-dark-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Video className="w-8 h-8 text-gray-500" />
            </div>
            <p className="text-gray-400">
              {search || filter !== 'all' ? 'No rooms match your filter.' : 'No active rooms. Create one to get started.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRooms.map((room) => (
              <div
                key={room._id}
                onClick={() => handleJoinRoom(room)}
                className={`glass-card p-5 cursor-pointer animate-fade-in transition-all duration-200 hover:scale-[1.02] hover:shadow-lg group ${
                  room.isPrivate
                    ? 'hover:border-amber-500'
                    : 'hover:border-primary-600'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    room.isPrivate
                      ? 'bg-amber-500 bg-opacity-20'
                      : 'bg-primary-600 bg-opacity-20'
                  }`}>
                    {room.isPrivate ? (
                      <Lock className="w-5 h-5 text-amber-400" />
                    ) : (
                      <Globe className="w-5 h-5 text-primary-400" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 bg-dark-700 px-2 py-1 rounded-full">
                      {room.participants?.length || 0}/{room.maxParticipants}
                    </span>
                    {room.isPrivate && (
                      <span className="text-xs text-amber-400 bg-amber-500 bg-opacity-10 px-2 py-1 rounded-full font-medium">
                        Password
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="font-semibold text-white mb-1 truncate group-hover:text-primary-300 transition-colors">
                  {room.name}
                </h3>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    Hosted by {room.host?.name}
                  </p>
                  <p className="text-xs text-gray-600 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {timeAgo(room.createdAt)}
                  </p>
                </div>

                {/* Participant avatars */}
                {room.participants?.length > 0 && (
                  <div className="flex items-center gap-1 mt-3 pt-3 border-t border-dark-600">
                    <div className="flex -space-x-1.5">
                      {room.participants.slice(0, 5).map((p, i) => (
                        <div
                          key={i}
                          className="w-5 h-5 rounded-full bg-primary-700 border border-dark-700 flex items-center justify-center text-[9px] font-medium text-white"
                          title={p.user?.name}
                        >
                          {p.user?.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                      ))}
                      {room.participants.length > 5 && (
                        <div className="w-5 h-5 rounded-full bg-dark-600 border border-dark-700 flex items-center justify-center text-[9px] text-gray-400">
                          +{room.participants.length - 5}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 ml-1">in room</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Room Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="glass-card p-6 w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">Create New Room</h2>
              <button onClick={() => setShowModal(false)} className="icon-btn text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Room Name</label>
                <input
                  type="text"
                  value={newRoom.name}
                  onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                  placeholder="e.g. Team Standup"
                  className="input-field"
                  required
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Max Participants
                </label>
                <input
                  type="number"
                  value={newRoom.maxParticipants}
                  onChange={(e) => setNewRoom({ ...newRoom, maxParticipants: parseInt(e.target.value) })}
                  className="input-field"
                  min={2}
                  max={20}
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-dark-700 transition-colors">
                <input
                  type="checkbox"
                  checked={newRoom.isPrivate}
                  onChange={(e) => setNewRoom({ ...newRoom, isPrivate: e.target.checked, password: '' })}
                  className="w-4 h-4 accent-primary-600"
                />
                <div>
                  <span className="text-sm text-gray-200 font-medium">Private room</span>
                  <p className="text-xs text-gray-500 mt-0.5">Room appears in list but requires a password to enter</p>
                </div>
              </label>
              {newRoom.isPrivate && (
                <div className="animate-fade-in">
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Room Password</label>
                  <input
                    type="password"
                    value={newRoom.password}
                    onChange={(e) => setNewRoom({ ...newRoom, password: e.target.value })}
                    placeholder="Enter password (4–32 chars)"
                    className="input-field"
                    required
                    minLength={4}
                    maxLength={32}
                  />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-ghost flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {creating ? 'Creating...' : 'Create Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Verify Room Password Modal */}
      {selectedPrivateRoom && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="glass-card p-6 w-full max-w-md animate-slide-up">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-amber-500 bg-opacity-20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Lock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Private Room</h2>
                <p className="text-sm text-gray-400">"{selectedPrivateRoom.name}" is password-protected</p>
              </div>
            </div>
            <form onSubmit={handleVerifyPassword} className="space-y-4">
              <div className="relative">
                <input
                  type={showJoinPw ? 'text' : 'password'}
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  placeholder="Enter room password"
                  className="input-field pr-10"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowJoinPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showJoinPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                {joinError && (
                  <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                    <span className="inline-block w-1 h-1 rounded-full bg-red-400" />
                    {joinError}
                  </p>
                )}
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedPrivateRoom(null)}
                  className="btn-ghost flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyingPassword || !joinPassword}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {verifyingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  {verifyingPassword ? 'Verifying...' : 'Join Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
