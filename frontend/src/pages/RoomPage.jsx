/**
 * RoomPage.jsx
 *
 * Google Meet–style video conferencing room.
 * ─ Grid View  : equal n×n tiles
 * ─ Speaker View: 1 main stage + filmstrip sidebar
 * ─ Participants panel: Google Meet style with host controls
 * ─ Screen share auto-focus
 * ─ Deterministic participant colors (consistent everywhere)
 * ─ Speaking indicator, hand-raise badge, emoji reactions
 * ─ WhatsApp-style chat via ChatPanel
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  MessageSquare, PenTool, PhoneOff, Users, X, Hand,
  Crown, LayoutGrid, Tv, Smile, Pin, ChevronDown,
} from 'lucide-react';
import { getSocket } from '@/services/socket';
import useWebRTC from '@/hooks/useWebRTC';
import useAuthStore from '@/store/slices/authStore';
import VideoTile from '@/components/features/room/VideoTile';
import ChatPanel from '@/components/features/chat/ChatPanel';
import Whiteboard from '@/components/features/whiteboard/Whiteboard';
import api from '@/services/api';
import { getParticipantColor } from '@/utils/participantColors';

// ─── Constants ────────────────────────────────────────────────────────────────

const PANELS = { chat: 'chat', whiteboard: 'whiteboard', participants: 'participants' };
const VIEW = { grid: 'grid', speaker: 'speaker' };
const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '😮', '👏'];

// ─── Grid column helper ────────────────────────────────────────────────────────

function gridClass(count) {
  if (count <= 1) return 'grid-cols-1';
  if (count === 2) return 'grid-cols-2';
  if (count <= 4) return 'grid-cols-2';
  if (count <= 6) return 'grid-cols-3';
  return 'grid-cols-4';
}

// ─── Toast Hook ───────────────────────────────────────────────────────────────

function useToasts() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  }, []);
  return { toasts, addToast: add };
}

// ─── Avatar chip component ────────────────────────────────────────────────────

function Avatar({ userId, name, size = 'md' }) {
  const color = getParticipantColor(userId || name || 'default');
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'lg' ? 'w-11 h-11 text-base' : 'w-9 h-9 text-sm';
  return (
    <div
      className={`${sz} rounded-full flex items-center justify-center font-bold flex-shrink-0 shadow`}
      style={{ background: color.bg, color: color.text }}
    >
      {name ? name.charAt(0).toUpperCase() : '?'}
    </div>
  );
}

// ─── Toast List ───────────────────────────────────────────────────────────────

function ToastList({ toasts }) {
  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-xs">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-semibold
            backdrop-blur-md animate-slide-up pointer-events-auto bg-dark-800
            ${t.type === 'join' ? 'border-green-500 text-green-400'
            : t.type === 'leave' ? 'border-red-500 text-red-400'
            : 'border-primary-500 text-primary-400'}`}
        >
          <span className={`w-2 h-2 rounded-full flex-shrink-0
            ${t.type === 'join' ? 'bg-green-500 animate-ping'
            : t.type === 'leave' ? 'bg-red-500'
            : 'bg-primary-500'}`} />
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─── Floating reaction bubble ─────────────────────────────────────────────────

function FloatingReaction({ emoji }) {
  return (
    <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 pointer-events-none select-none animate-float-up text-5xl">
      {emoji}
    </div>
  );
}

// ─── Participants Panel (Google Meet Style) ───────────────────────────────────

function ParticipantsPanel({
  user, room, peers, peerStates, raisedHands,
  isHandRaised, audioEnabled, videoEnabled,
  onMuteParticipant, onMakeHost,
}) {
  const isHost = room?.host?._id === user?._id || room?.host === user?._id;
  const peerList = Object.entries(peers);
  const total = peerList.length + 1;

  return (
    <div className="flex flex-col h-full">
      {/* Header count */}
      <div className="px-4 py-3 border-b border-dark-700">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {total} participant{total !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">

        {/* ── Self ── */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-dark-700/60 transition-colors group">
          <Avatar userId={user?._id} name={user?.name} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold text-white truncate">{user?.name}</span>
              <span className="text-[10px] text-gray-500 bg-dark-600 px-1.5 py-0.5 rounded-full">You</span>
              {isHost && <Crown className="w-3.5 h-3.5 text-amber-400" title="Host" />}
              {isHandRaised && <span className="text-sm animate-bounce-soft">✋</span>}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className={`p-1 rounded-full ${audioEnabled ? 'text-gray-400' : 'bg-red-500/20 text-red-400'}`}>
              {audioEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            </div>
            <div className={`p-1 rounded-full ${videoEnabled ? 'text-gray-400' : 'bg-red-500/20 text-red-400'}`}>
              {videoEnabled ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
            </div>
          </div>
        </div>

        {/* ── Remote peers ── */}
        {peerList.map(([socketId, { user: peerUser }]) => {
          const peerColor = getParticipantColor(peerUser?._id || peerUser?.name);
          const isAudioOff = peerStates[socketId]?.audioEnabled === false;
          const isVideoOff = peerStates[socketId]?.videoEnabled === false;
          const handRaised = raisedHands[socketId] === true;
          const isPeerHost = room?.host?._id === peerUser?._id || room?.host === peerUser?._id;

          return (
            <div
              key={socketId}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-dark-700/60 transition-colors group"
            >
              {/* Colored avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 shadow"
                style={{ background: peerColor.bg, color: peerColor.text }}
              >
                {peerUser?.name?.charAt(0).toUpperCase() || '?'}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm text-white truncate font-medium">{peerUser?.name || 'Participant'}</span>
                  {isPeerHost && <Crown className="w-3.5 h-3.5 text-amber-400" title="Host" />}
                  {handRaised && <span className="text-sm animate-bounce-soft">✋</span>}
                </div>
              </div>

              {/* Status icons */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <div className={`p-1 rounded-full ${isAudioOff ? 'bg-red-500/20 text-red-400' : 'text-gray-500'}`}>
                  {isAudioOff ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </div>
                <div className={`p-1 rounded-full ${isVideoOff ? 'bg-red-500/20 text-red-400' : 'text-gray-500'}`}>
                  {isVideoOff ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                </div>

                {/* Host actions (on hover) */}
                {isHost && !isAudioOff && (
                  <button
                    onClick={() => onMuteParticipant(socketId)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-red-500/20 text-red-400 transition-all"
                    title="Mute for everyone"
                  >
                    <MicOff className="w-3.5 h-3.5" />
                  </button>
                )}
                {isHost && !isPeerHost && (
                  <button
                    onClick={() => onMakeHost(peerUser?._id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-amber-500/20 text-amber-400 transition-all"
                    title="Make host"
                  >
                    <Crown className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Leave Modal ──────────────────────────────────────────────────────────────

function LeaveModal({ isHost, onEndForAll, onLeave, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-slide-up">
        <h3 className="text-lg font-bold text-white mb-2">
          {isHost ? 'Leave or End Meeting?' : 'Leave Meeting?'}
        </h3>
        <p className="text-sm text-gray-400 mb-6">
          {isHost
            ? 'You can end this meeting for everyone, or leave and pass host to another participant.'
            : 'Are you sure you want to leave this meeting?'}
        </p>
        <div className="flex flex-col gap-2.5">
          {isHost && (
            <button
              onClick={onEndForAll}
              className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
            >
              End for Everyone
            </button>
          )}
          <button
            onClick={onLeave}
            className={`w-full py-2.5 px-4 rounded-xl text-white text-sm font-semibold transition-colors ${
              isHost ? 'bg-dark-600 hover:bg-dark-500' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isHost ? 'Leave (pass host)' : 'Leave Meeting'}
          </button>
          <button
            onClick={onCancel}
            className="w-full py-2.5 px-4 rounded-xl border border-dark-600 hover:bg-dark-700 text-gray-300 text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Speaker View ─────────────────────────────────────────────────────────────

function SpeakerView({
  peers, localStream, screenStream, isScreenSharing,
  audioEnabled, videoEnabled, peerStates, screenSharingPeers,
  raisedHands, isHandRaised, pinnedUser, setPinnedUser, user,
  room, toggleAudio, toggleVideo, handleMuteParticipant, hasPanel,
}) {
  const peerList = Object.entries(peers);
  const isCurrentUserHost = room?.host?._id === user?._id || room?.host === user?._id;

  // Determine main stage
  const anyScreenSharer = [...screenSharingPeers][0];
  const defaultMain = pinnedUser || anyScreenSharer || (peerList.length > 0 ? peerList[0][0] : 'local');
  const mainId = defaultMain;
  const isMainLocal = mainId === 'local';

  const mainStream = isMainLocal
    ? (isScreenSharing ? screenStream : localStream)
    : peers[mainId]?.stream;
  const mainUser = isMainLocal ? user : peers[mainId]?.user;
  const mainVideoDisabled = isMainLocal
    ? (isScreenSharing ? false : !videoEnabled)
    : (screenSharingPeers.has(mainId) ? false : peerStates[mainId]?.videoEnabled === false);
  const mainIsHandRaised = isMainLocal ? isHandRaised : (raisedHands[mainId] === true);
  const mainIsHost = isMainLocal
    ? isCurrentUserHost
    : (room?.host?._id === mainUser?._id || room?.host === mainUser?._id);

  // Sidebar: everyone except main
  const sidebarPeers = peerList.filter(([sid]) => sid !== mainId);
  const showLocalInSidebar = !isMainLocal;

  // Layout: right sidebar when no panel, bottom filmstrip when panel open
  const sidebarIsRight = !hasPanel;

  const renderSidebarTile = (socketId) => {
    const isPeerSharingScreen = screenSharingPeers.has(socketId);
    const isActive = pinnedUser === socketId;
    return (
      <div
        key={socketId}
        onClick={() => setPinnedUser(socketId === pinnedUser ? null : socketId)}
        className={`flex-shrink-0 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 border-2
          ${sidebarIsRight ? 'w-full aspect-video' : 'h-full aspect-video'}
          ${isActive ? 'border-primary-500' : 'border-dark-600 hover:border-dark-500'}`}
      >
        <VideoTile
          stream={peers[socketId]?.stream}
          user={peers[socketId]?.user}
          muted={false}
          videoDisabled={isPeerSharingScreen ? false : peerStates[socketId]?.videoEnabled === false}
          isHandRaised={raisedHands[socketId] === true}
          isPinned={isActive}
          onPin={() => setPinnedUser(socketId === pinnedUser ? null : socketId)}
          isCurrentUserHost={isCurrentUserHost}
          onMuteParticipant={() => handleMuteParticipant(socketId)}
          isHost={room?.host?._id === peers[socketId]?.user?._id}
        />
      </div>
    );
  };

  const localSidebarTile = (
    <div
      onClick={() => setPinnedUser(pinnedUser === 'local' ? null : 'local')}
      className={`flex-shrink-0 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 border-2
        ${sidebarIsRight ? 'w-full aspect-video' : 'h-full aspect-video'}
        ${pinnedUser === 'local' ? 'border-primary-500' : 'border-dark-600 hover:border-dark-500'}`}
    >
      <VideoTile
        stream={isScreenSharing ? screenStream : localStream}
        user={user}
        isLocal
        muted
        videoDisabled={isScreenSharing ? false : !videoEnabled}
        isHandRaised={isHandRaised}
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        isPinned={pinnedUser === 'local'}
        onPin={() => setPinnedUser(pinnedUser === 'local' ? null : 'local')}
        isHost={isCurrentUserHost}
      />
    </div>
  );

  return (
    <div className={`flex-1 overflow-hidden p-3 flex gap-3 ${sidebarIsRight ? 'flex-row' : 'flex-col'}`}>
      {/* Main stage */}
      <div className="flex-1 min-h-0 min-w-0 rounded-2xl overflow-hidden relative bg-dark-850 border border-dark-700 shadow-2xl">
        <VideoTile
          stream={mainStream}
          user={mainUser}
          isLocal={isMainLocal}
          muted={isMainLocal}
          videoDisabled={mainVideoDisabled}
          isHandRaised={mainIsHandRaised}
          isPinned={pinnedUser === mainId}
          onPin={() => setPinnedUser(pinnedUser === mainId ? null : mainId)}
          audioEnabled={audioEnabled}
          videoEnabled={videoEnabled}
          isCurrentUserHost={isCurrentUserHost}
          onMuteParticipant={!isMainLocal ? () => handleMuteParticipant(mainId) : undefined}
          isHost={mainIsHost}
        />
        {/* Pinned indicator */}
        {pinnedUser === mainId && (
          <div className="absolute top-3 left-3 bg-primary-600 text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow z-20">
            <Pin className="w-2.5 h-2.5" /> Pinned
          </div>
        )}
      </div>

      {/* Sidebar / Filmstrip */}
      {(sidebarPeers.length > 0 || showLocalInSidebar) && (
        <div
          className={`flex gap-2 custom-scrollbar flex-shrink-0
            ${sidebarIsRight
              ? 'flex-col w-48 xl:w-56 overflow-y-auto overflow-x-hidden'
              : 'flex-row h-32 sm:h-36 overflow-x-auto overflow-y-hidden'}`}
        >
          {showLocalInSidebar && localSidebarTile}
          {sidebarPeers.map(([sid]) => renderSidebarTile(sid))}
        </div>
      )}
    </div>
  );
}

// ─── Grid View ────────────────────────────────────────────────────────────────

function GridView({
  peers, localStream, screenStream, isScreenSharing,
  audioEnabled, videoEnabled, peerStates, screenSharingPeers,
  raisedHands, isHandRaised, user, room,
  toggleAudio, toggleVideo, handleMuteParticipant, setPinnedUser, setViewMode,
}) {
  const peerList = Object.entries(peers);
  const total = peerList.length + 1;
  const isCurrentUserHost = room?.host?._id === user?._id || room?.host === user?._id;

  return (
    <div className="flex-1 overflow-y-auto p-3 flex items-center justify-center custom-scrollbar">
      <div className={`grid gap-3 w-full h-full ${gridClass(total)}`}>
        {/* Self */}
        <div className="aspect-video w-full rounded-2xl overflow-hidden">
          <VideoTile
            stream={isScreenSharing ? screenStream : localStream}
            user={user}
            isLocal
            muted
            videoDisabled={isScreenSharing ? false : !videoEnabled}
            isHandRaised={isHandRaised}
            audioEnabled={audioEnabled}
            videoEnabled={videoEnabled}
            onPin={() => { setPinnedUser('local'); setViewMode(VIEW.speaker); }}
            isHost={isCurrentUserHost}
          />
        </div>

        {/* Remote peers */}
        {peerList.map(([socketId, { stream }]) => {
          const isPeerSharingScreen = screenSharingPeers.has(socketId);
          return (
            <div key={socketId} className="aspect-video w-full rounded-2xl overflow-hidden">
              <VideoTile
                stream={stream}
                user={peers[socketId]?.user}
                muted={false}
                videoDisabled={isPeerSharingScreen ? false : peerStates[socketId]?.videoEnabled === false}
                isHandRaised={raisedHands[socketId] === true}
                onPin={() => { setPinnedUser(socketId); setViewMode(VIEW.speaker); }}
                isCurrentUserHost={isCurrentUserHost}
                onMuteParticipant={() => handleMuteParticipant(socketId)}
                isHost={room?.host?._id === peers[socketId]?.user?._id}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Participant name chips for top bar ───────────────────────────────────────

function ParticipantChips({ user, peers, onClick }) {
  const peerList = Object.entries(peers);
  const allUsers = [
    { id: user?._id, name: user?.name, isSelf: true },
    ...peerList.map(([, { user: u }]) => ({ id: u?._id, name: u?.name, isSelf: false })),
  ];
  const max = 3;
  const visible = allUsers.slice(0, max);
  const remaining = allUsers.length - max;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 hover:bg-dark-700/60 px-2 py-1 rounded-lg transition-colors"
      title="Show participants"
    >
      {/* Avatar stack */}
      <div className="flex -space-x-2">
        {visible.map((u, i) => {
          const color = getParticipantColor(u.id || u.name);
          return (
            <div
              key={i}
              className="w-6 h-6 rounded-full border-2 border-dark-900 flex items-center justify-center text-[10px] font-bold"
              style={{ background: color.bg, color: color.text, zIndex: visible.length - i }}
              title={u.isSelf ? `${u.name} (You)` : u.name}
            >
              {u.name?.charAt(0).toUpperCase() || '?'}
            </div>
          );
        })}
      </div>
      <span className="text-xs text-gray-400 ml-1">
        {allUsers.length} {allUsers.length === 1 ? 'participant' : 'participants'}
        {remaining > 0 ? ` (+${remaining})` : ''}
      </span>
      <ChevronDown className="w-3 h-3 text-gray-500" />
    </button>
  );
}

// ─── Main RoomPage ────────────────────────────────────────────────────────────

export default function RoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const {
    peers, localStream, screenStream, isScreenSharing,
    audioEnabled, videoEnabled, peerStates, handleMediaToggle,
    getLocalStream, addPeer, receivePeer, handleAnswer, handleIceCandidate,
    removePeer, toggleAudio, toggleVideo, startScreenShare, stopScreenShare, cleanup,
  } = useWebRTC(roomId);

  const [room, setRoom] = useState(null);
  const [activePanel, setActivePanel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [raisedHands, setRaisedHands] = useState({});
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [pinnedUser, setPinnedUser] = useState(null);
  const [screenSharingPeers, setScreenSharingPeers] = useState(new Set());
  const [viewMode, setViewMode] = useState(VIEW.grid);
  const [floatingReaction, setFloatingReaction] = useState(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const [clockTime, setClockTime] = useState(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
  const [meetingStart] = useState(() => Date.now());
  const [duration, setDuration] = useState('0:00');

  const { toasts, addToast } = useToasts();
  const audioEnabledRef = useRef(audioEnabled);
  const reactionPickerRef = useRef(null);

  useEffect(() => { audioEnabledRef.current = audioEnabled; }, [audioEnabled]);

  useEffect(() => {
    const id = setInterval(() => {
      setClockTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      const elapsed = Math.floor((Date.now() - meetingStart) / 1000);
      const m = Math.floor(elapsed / 60);
      const s = elapsed % 60;
      setDuration(`${m}:${s.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(id);
  }, [meetingStart]);

  // Close reaction picker on outside click
  useEffect(() => {
    const h = (e) => {
      if (reactionPickerRef.current && !reactionPickerRef.current.contains(e.target)) {
        setShowReactionPicker(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ─── Room init ──────────────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data } = await api.get(`/rooms/${roomId}`);
        if (!mounted) return;
        setRoom(data.data.room);

        const stream = await getLocalStream();
        const socket = getSocket();
        if (!socket) return;

        setupSocketListeners(socket, stream);
        socket.emit('room:join', { roomId });
      } catch (err) {
        if (mounted) setError(err.response?.data?.message || 'Failed to join room');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;
      const socket = getSocket();
      if (socket) {
        socket.emit('room:leave', { roomId });
        [
          'room:participants', 'room:user-joined', 'room:user-left',
          'webrtc:offer', 'webrtc:answer', 'webrtc:ice-candidate',
          'media:toggle', 'media:force-mute', 'room:host-changed',
          'room:ended', 'room:user-hand-raised', 'screen:started', 'screen:stopped',
        ].forEach((ev) => socket.off(ev));
      }
      cleanup();
    };
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Socket listeners ───────────────────────────────────────────────────────

  const setupSocketListeners = (socket, stream) => {
    socket.on('room:participants', ({ participants: existing }) => {
      existing.forEach(({ user: u, socketId: sid }) => {
        if (sid !== socket.id) addPeer(sid, u, stream);
      });
    });

    socket.on('room:user-joined', ({ userId, name, avatar, socketId }) => {
      addToast(`${name} joined`, 'join');
    });

    socket.on('room:user-left', ({ socketId, name }) => {
      addToast(`${name || 'A participant'} left`, 'leave');
      removePeer(socketId);
      setScreenSharingPeers((prev) => { const n = new Set(prev); n.delete(socketId); return n; });
      setPinnedUser((prev) => (prev === socketId ? null : prev));
    });

    socket.on('webrtc:offer', ({ offer, fromSocketId, from }) => {
      receivePeer(fromSocketId, from, offer, stream);
    });

    socket.on('webrtc:answer', ({ answer, fromSocketId }) => {
      handleAnswer(fromSocketId, answer);
    });

    socket.on('webrtc:ice-candidate', ({ candidate, fromSocketId }) => {
      handleIceCandidate(fromSocketId, candidate);
    });

    socket.on('media:toggle', ({ socketId, type, enabled }) => {
      handleMediaToggle(socketId, type, enabled);
    });

    socket.on('room:host-changed', ({ hostId, hostName }) => {
      setRoom((prev) => prev ? { ...prev, host: { ...prev.host, _id: hostId, name: hostName } } : prev);
      addToast(`${hostName} is now the host`, 'info');
    });

    socket.on('room:ended', () => {
      addToast('The host has ended this meeting', 'leave');
      setTimeout(() => navigate('/dashboard'), 1500);
    });

    socket.on('room:user-hand-raised', ({ socketId, name, isRaised }) => {
      setRaisedHands((prev) => ({ ...prev, [socketId]: isRaised }));
      if (isRaised) addToast(`${name} raised their hand ✋`, 'info');
    });

    socket.on('screen:started', ({ socketId, name }) => {
      setScreenSharingPeers((prev) => { const n = new Set(prev); n.add(socketId); return n; });
      setViewMode(VIEW.speaker);
      setPinnedUser(socketId);
      addToast(`${name || 'Someone'} started screen sharing`, 'info');
    });

    socket.on('screen:stopped', ({ socketId }) => {
      setScreenSharingPeers((prev) => { const n = new Set(prev); n.delete(socketId); return n; });
      setPinnedUser((prev) => (prev === socketId ? null : prev));
    });

    socket.on('media:force-mute', ({ type }) => {
      if (type === 'audio' && audioEnabledRef.current) {
        toggleAudio();
        addToast('You have been muted by the host', 'info');
      }
    });
  };

  // ─── Actions ────────────────────────────────────────────────────────────────

  const handleMuteParticipant = (targetSocketId) => {
    getSocket()?.emit('room:mute-participant', { roomId, targetSocketId });
  };

  const handleScreenShare = async () => {
    const socket = getSocket();
    if (isScreenSharing) {
      stopScreenShare();
      socket?.emit('screen:stop', { roomId });
      if (pinnedUser === 'local') setPinnedUser(null);
    } else {
      try {
        await startScreenShare();
        socket?.emit('screen:start', { roomId });
        setViewMode(VIEW.speaker);
        setPinnedUser('local');
      } catch {
        addToast('Screen share was cancelled', 'info');
      }
    }
  };

  const toggleHandRaise = () => {
    const socket = getSocket();
    if (!socket) return;
    const next = !isHandRaised;
    setIsHandRaised(next);
    setRaisedHands((prev) => ({ ...prev, [socket.id]: next }));
    socket.emit('room:raise-hand', { roomId, isRaised: next });
    if (next) addToast('Hand raised ✋ — everyone can see', 'info');
  };

  const sendFloatingReaction = (emoji) => {
    setFloatingReaction(emoji);
    setShowReactionPicker(false);
    setTimeout(() => setFloatingReaction(null), 2600);
  };

  const handleMakeHost = (newHostUserId) => {
    getSocket()?.emit('room:change-host', { roomId, newHostUserId });
  };

  const handleEndRoom = async () => {
    try {
      await api.patch(`/rooms/${roomId}/end`);
      navigate('/dashboard');
    } catch {
      addToast('Failed to end meeting', 'info');
    }
  };

  const togglePanel = (panel) => setActivePanel((prev) => (prev === panel ? null : panel));

  // ─── Derived ────────────────────────────────────────────────────────────────

  const isCurrentUserHost = room?.host?._id === user?._id || room?.host === user?._id;
  const peerList = Object.entries(peers);

  // ─── Loading / Error ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Joining room...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
        <div className="glass-card p-8 max-w-sm w-full text-center">
          <p className="text-red-400 mb-5 text-sm">{error}</p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ─── Main render ────────────────────────────────────────────────────────────

  return (
    <div className="h-screen bg-dark-900 flex flex-col overflow-hidden select-none">

      {/* ════════════════ TOP BAR ════════════════ */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-dark-700/80 flex-shrink-0 bg-dark-900/95 backdrop-blur-sm z-10 gap-3">

        {/* Left: Room name + participant chips */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0 flex-shrink-0">
            <h1 className="text-sm font-bold text-white truncate max-w-[150px]">{room?.name}</h1>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-gray-500 font-medium">Live</span>
            </div>
          </div>

          <div className="w-px h-6 bg-dark-700 self-center" />

          {/* Participant chips */}
          <ParticipantChips
            user={user}
            peers={peers}
            onClick={() => togglePanel(PANELS.participants)}
          />
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* View toggle */}
          <button
            id="btn-view-toggle"
            onClick={() => setViewMode((v) => v === VIEW.grid ? VIEW.speaker : VIEW.grid)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border border-dark-600 bg-dark-800 text-gray-400 hover:bg-dark-700 hover:text-white`}
            title={viewMode === VIEW.grid ? 'Switch to Speaker view' : 'Switch to Grid view'}
          >
            {viewMode === VIEW.grid ? <Tv className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
          </button>

          {/* Panel buttons */}
          {[
            { id: PANELS.chat, icon: MessageSquare, label: 'Chat' },
            { id: PANELS.whiteboard, icon: PenTool, label: 'Board' },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              id={`btn-panel-${id}`}
              onClick={() => togglePanel(id)}
              className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all border
                ${activePanel === id
                  ? 'bg-primary-600/25 border-primary-500 text-primary-300'
                  : 'bg-dark-800 border-dark-600 text-gray-400 hover:bg-dark-700 hover:text-white'}`}
              title={label}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      </header>

      {/* ════════════════ BODY ════════════════ */}
      <div className="flex flex-1 overflow-hidden">

        {/* Video area */}
        <div className="flex flex-1 overflow-hidden">
          {viewMode === VIEW.grid ? (
            <GridView
              peers={peers}
              localStream={localStream}
              screenStream={screenStream}
              isScreenSharing={isScreenSharing}
              audioEnabled={audioEnabled}
              videoEnabled={videoEnabled}
              peerStates={peerStates}
              screenSharingPeers={screenSharingPeers}
              raisedHands={raisedHands}
              isHandRaised={isHandRaised}
              user={user}
              room={room}
              toggleAudio={toggleAudio}
              toggleVideo={toggleVideo}
              handleMuteParticipant={handleMuteParticipant}
              setPinnedUser={setPinnedUser}
              setViewMode={setViewMode}
            />
          ) : (
            <SpeakerView
              peers={peers}
              localStream={localStream}
              screenStream={screenStream}
              isScreenSharing={isScreenSharing}
              audioEnabled={audioEnabled}
              videoEnabled={videoEnabled}
              peerStates={peerStates}
              screenSharingPeers={screenSharingPeers}
              raisedHands={raisedHands}
              isHandRaised={isHandRaised}
              pinnedUser={pinnedUser}
              setPinnedUser={setPinnedUser}
              user={user}
              room={room}
              toggleAudio={toggleAudio}
              toggleVideo={toggleVideo}
              handleMuteParticipant={handleMuteParticipant}
              hasPanel={activePanel !== null}
            />
          )}
        </div>

        {/* Side Panel */}
        {activePanel && (
          <aside className="w-80 border-l border-dark-700/80 flex flex-col flex-shrink-0 bg-dark-900 animate-slide-up">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700/80 flex-shrink-0">
              <h2 className="text-sm font-semibold text-white">
                {activePanel === PANELS.participants ? `People (${peerList.length + 1})`
                  : activePanel === PANELS.chat ? 'Chat'
                  : 'Whiteboard'}
              </h2>
              <button
                onClick={() => setActivePanel(null)}
                className="icon-btn text-gray-400 hover:text-white hover:bg-dark-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-hidden">
              {activePanel === PANELS.chat && <ChatPanel roomId={roomId} />}
              {activePanel === PANELS.whiteboard && <Whiteboard roomId={roomId} />}
              {activePanel === PANELS.participants && (
                <ParticipantsPanel
                  user={user}
                  room={room}
                  peers={peers}
                  peerStates={peerStates}
                  raisedHands={raisedHands}
                  isHandRaised={isHandRaised}
                  audioEnabled={audioEnabled}
                  videoEnabled={videoEnabled}
                  onMuteParticipant={handleMuteParticipant}
                  onMakeHost={handleMakeHost}
                />
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ════════════════ BOTTOM BAR ════════════════ */}
      <footer className="relative flex items-center justify-center py-4 px-6 border-t border-dark-700/80 flex-shrink-0 bg-dark-900/95 backdrop-blur-sm">

        {/* Center: Controls */}
        <div className="flex items-center gap-3">
          {/* Mic */}
          <button
            id="btn-mic"
            onClick={toggleAudio}
            title={audioEnabled ? 'Mute mic' : 'Unmute mic'}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-md
              ${audioEnabled 
                ? 'bg-dark-700 hover:bg-dark-600 text-white' 
                : 'bg-red-600 hover:bg-red-700 text-white shadow-red-900/20'}`}
          >
            {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          {/* Camera */}
          <button
            id="btn-camera"
            onClick={toggleVideo}
            title={videoEnabled ? 'Stop camera' : 'Start camera'}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-md
              ${videoEnabled 
                ? 'bg-dark-700 hover:bg-dark-600 text-white' 
                : 'bg-red-600 hover:bg-red-700 text-white shadow-red-900/20'}`}
          >
            {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          {/* Screen share */}
          <button
            id="btn-screen"
            onClick={handleScreenShare}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-md
              ${isScreenSharing
                ? 'bg-primary-600 hover:bg-primary-700 text-white ring-2 ring-primary-400/50'
                : 'bg-dark-700 hover:bg-dark-600 text-white'}`}
          >
            {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </button>

          {/* Hand raise */}
          <button
            id="btn-hand"
            onClick={toggleHandRaise}
            title={isHandRaised ? 'Lower hand' : 'Raise hand'}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-md
              ${isHandRaised
                ? 'bg-amber-500 hover:bg-amber-600 text-white ring-2 ring-amber-400/50'
                : 'bg-dark-700 hover:bg-dark-600 text-gray-300'}`}
          >
            <Hand className="w-5 h-5" />
          </button>

          {/* Reactions */}
          <div className="relative" ref={reactionPickerRef}>
            <button
              id="btn-reactions"
              onClick={() => setShowReactionPicker((v) => !v)}
              title="Send reaction"
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-md
                ${showReactionPicker ? 'bg-primary-600 text-white' : 'bg-dark-700 hover:bg-dark-600 text-gray-300'}`}
            >
              <Smile className="w-5 h-5" />
            </button>

            {showReactionPicker && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-dark-700 border border-dark-600 rounded-2xl px-3 py-2.5 flex items-center gap-2 shadow-2xl z-50 animate-slide-up">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => sendFloatingReaction(emoji)}
                    className="text-2xl hover:scale-125 transition-transform duration-150 leading-none p-1"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Leave */}
          <button
            id="btn-leave"
            onClick={() => setShowLeaveModal(true)}
            title="Leave meeting"
            className="w-16 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all duration-200 shadow-lg shadow-red-950/20"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>

        {/* Right: Clock + Duration */}
        <div className="absolute right-6 hidden sm:flex flex-col items-end text-xs text-gray-500 font-medium select-none">
          <span>{clockTime}</span>
          <span className="text-[10px] text-gray-600">{duration}</span>
        </div>
      </footer>

      {/* ════════════════ OVERLAYS ════════════════ */}
      <ToastList toasts={toasts} />
      {floatingReaction && <FloatingReaction emoji={floatingReaction} />}

      {showLeaveModal && (
        <LeaveModal
          isHost={isCurrentUserHost}
          onEndForAll={() => { setShowLeaveModal(false); handleEndRoom(); }}
          onLeave={() => { setShowLeaveModal(false); navigate('/dashboard'); }}
          onCancel={() => setShowLeaveModal(false)}
        />
      )}
    </div>
  );
}
