import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  MessageSquare, Users, PhoneOff, Hand, LayoutGrid,
  Copy, Check, Shield, Circle, Tv, MoreHorizontal,
  FileText, Pin, PinOff, ChevronDown, X,
  Upload, File, FileSpreadsheet, FileArchive,
} from 'lucide-react';
import { getSocket } from '@/services/socket';
import useWebRTC from '@/hooks/useWebRTC';
import useAuthStore from '@/store/slices/authStore';
import VideoTile from '@/components/features/room/VideoTile';
import ChatPanel from '@/components/features/chat/ChatPanel';
import Whiteboard from '@/components/features/whiteboard/Whiteboard';
import api from '@/services/api';
import { getParticipantColor } from '@/utils/participantColors';

const VIEW = { grid: 'grid', speaker: 'speaker' };
const PANELS = { chat: 'chat', participants: 'participants', whiteboard: 'whiteboard', files: 'files' };

// ─── Grid helper ──────────────────────────────────────────────────────────────
function gridClass(n) {
  if (n <= 1) return 'grid-cols-1';
  if (n <= 2) return 'grid-cols-2';
  if (n <= 4) return 'grid-cols-2';
  if (n <= 6) return 'grid-cols-3';
  return 'grid-cols-4';
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);
  return { toasts, addToast: add };
}

function ToastList({ toasts }) {
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`text-xs font-semibold px-4 py-2 rounded-full shadow-xl border backdrop-blur-md animate-fade-in
          ${t.type === 'join' ? 'bg-green-900/80 border-green-500/40 text-green-300'
          : t.type === 'leave' ? 'bg-red-900/80 border-red-500/40 text-red-300'
          : 'bg-[#1e1e2e]/90 border-white/10 text-white'}`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Av({ userId, name, size = 8 }) {
  const c = getParticipantColor(userId || name || 'x');
  return (
    <div style={{ background: c.bg, color: c.text, width: `${size * 4}px`, height: `${size * 4}px` }}
      className="rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Leave modal ──────────────────────────────────────────────────────────────
function LeaveModal({ isHost, onEnd, onLeave, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-[#1a1a2a] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold text-white mb-1">{isHost ? 'Leave or end?' : 'Leave meeting?'}</h3>
        <p className="text-sm text-gray-400 mb-5">{isHost ? 'You can end for everyone or just leave.' : 'Others will continue the meeting.'}</p>
        <div className="flex flex-col gap-2">
          {isHost && <button onClick={onEnd} className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors">End for Everyone</button>}
          <button onClick={onLeave} className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${isHost ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}>{isHost ? 'Leave (pass host)' : 'Leave'}</button>
          <button onClick={onCancel} className="w-full py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-gray-300 text-sm font-semibold transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Participants Panel ───────────────────────────────────────────────────────
function ParticipantsPanel({ user, room, peers, peerStates, raisedHands, isHandRaised, audioEnabled, videoEnabled, onMute, onMakeHost }) {
  const isHost = room?.host?._id === user?._id || room?.host === user?._id;
  const peerList = Object.entries(peers);
  const total = peerList.length + 1;

  return (
    <div className="flex flex-col h-full bg-[#0f0f18]">
      <div className="px-5 py-4 border-b border-white/8">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{total} participant{total !== 1 ? 's' : ''}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 custom-scrollbar">
        {/* Self */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors">
          <Av userId={user?._id} name={user?.name} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-white truncate">{user?.name}</span>
              <span className="text-[10px] text-gray-500 bg-white/8 px-1.5 py-0.5 rounded-full">You</span>
              {isHost && <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full">Host</span>}
              {isHandRaised && <span>✋</span>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!audioEnabled && <div className="p-1 rounded-full bg-red-500/15"><MicOff className="w-3 h-3 text-red-400" /></div>}
            {!videoEnabled && <div className="p-1 rounded-full bg-red-500/15"><VideoOff className="w-3 h-3 text-red-400" /></div>}
          </div>
        </div>
        {/* Peers */}
        {peerList.map(([sid, { user: pu }]) => {
          const audioOff = peerStates[sid]?.audioEnabled === false;
          const videoOff = peerStates[sid]?.videoEnabled === false;
          const hand = raisedHands[sid] === true;
          const isPeerHost = room?.host?._id === pu?._id || room?.host === pu?._id;
          return (
            <div key={sid} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors group">
              <Av userId={pu?._id} name={pu?.name} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-white truncate">{pu?.name || 'Participant'}</span>
                  {isPeerHost && <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full">Host</span>}
                  {hand && <span>✋</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {audioOff && <div className="p-1 rounded-full bg-red-500/15"><MicOff className="w-3 h-3 text-red-400" /></div>}
                {videoOff && <div className="p-1 rounded-full bg-red-500/15"><VideoOff className="w-3 h-3 text-red-400" /></div>}
                {isHost && !audioOff && (
                  <button onClick={() => onMute(sid)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-red-500/20 text-red-400 transition-all" title="Mute">
                    <MicOff className="w-3 h-3" />
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

// ─── Files Panel ──────────────────────────────────────────────────────────────
function fileIcon(name) {
  const ext = name?.split('.').pop()?.toLowerCase();
  if (['pdf'].includes(ext)) return <FileText className="w-5 h-5 text-red-400" />;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet className="w-5 h-5 text-green-400" />;
  if (['zip', 'rar', 'tar', 'gz'].includes(ext)) return <FileArchive className="w-5 h-5 text-amber-400" />;
  return <File className="w-5 h-5 text-blue-400" />;
}

function FilesPanel({ roomId }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef();

  useEffect(() => {
    api.get(`/files/room/${roomId}`).then(r => setFiles(r.data?.data?.files || [])).catch(() => {});
  }, [roomId]);

  const handleFiles = async (chosen) => {
    if (!chosen?.length) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', chosen[0]);
      form.append('roomId', roomId);
      const { data } = await api.post('/files/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setFiles(p => [...p, data.data.file]);
    } catch { /* silent */ } finally { setUploading(false); }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const fmtSize = (b) => {
    if (!b) return '';
    if (b < 1024) return `${b} B`;
    if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1048576).toFixed(1)} MB`;
  };

  const fmtTime = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-[#0f0f18]">
      <div className="px-5 py-4 border-b border-white/8">
        <p className="text-sm font-bold text-white">Shared Files</p>
        <p className="text-xs text-gray-500 mt-0.5">{files.length} file{files.length !== 1 ? 's' : ''}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar flex flex-col gap-3">
        {/* Upload zone */}
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border border-dashed border-white/20 rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-white/40 hover:bg-white/3 transition-all"
        >
          <div className="w-10 h-10 rounded-full bg-white/8 flex items-center justify-center">
            <Upload className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-white">{uploading ? 'Uploading…' : 'Share a file'}</p>
          <p className="text-xs text-gray-500 text-center">Drag &amp; drop or click to browse</p>
          <input ref={inputRef} type="file" className="hidden" onChange={e => handleFiles(e.target.files)} />
        </div>

        {/* File list */}
        {files.map((f, i) => (
          <a key={i} href={`/uploads/${f.fileName || f.file?.fileName}`} download target="_blank" rel="noreferrer"
            className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 hover:bg-white/9 border border-white/8 transition-all">
            <div className="flex-shrink-0">{fileIcon(f.originalName || f.file?.originalName)}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{f.originalName || f.file?.originalName || 'File'}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {fmtSize(f.size || f.file?.size)}
                {f.uploadedBy?.name && ` · ${f.uploadedBy.name}`}
                {f.createdAt && ` · ${fmtTime(f.createdAt)}`}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── More dropdown ────────────────────────────────────────────────────────────
function MoreMenu({ onRecord, onWhiteboard, onFiles, isScreenSharing, onStopShare, isHandRaised, onHandRaise, onClose }) {
  const items = [
    { icon: <Circle className="w-4 h-4 text-red-400" />, label: 'Record Meeting', action: onRecord },
    { icon: <LayoutGrid className="w-4 h-4 text-gray-300" />, label: 'Open Whiteboard', action: onWhiteboard },
    { icon: <FileText className="w-4 h-4 text-gray-300" />, label: 'Share Files', action: onFiles },
    ...(isScreenSharing ? [{ icon: <MonitorOff className="w-4 h-4 text-gray-300" />, label: 'Stop sharing', action: onStopShare }] : []),
    { icon: <Hand className="w-4 h-4 text-gray-300" />, label: isHandRaised ? 'Lower hand' : 'Raise hand', action: onHandRaise },
  ];

  return (
    <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-52 bg-[#1a1a28] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in">
      {items.map((item, i) => (
        <button key={i} onClick={() => { item.action?.(); onClose(); }}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-200 hover:bg-white/8 transition-colors text-left">
          {item.icon}
          <span className="font-medium">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Control button ───────────────────────────────────────────────────────────
function CtrlBtn({ onClick, active, danger, title, children, badge }) {
  return (
    <div className="relative flex flex-col items-center gap-1">
      <button
        onClick={onClick}
        title={title}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 relative
          ${danger ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
          : active ? 'bg-white/20 text-white hover:bg-white/25'
          : 'bg-[#23233a] text-gray-200 hover:bg-[#2e2e48]'}`}
      >
        {children}
        {badge && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary-500 rounded-full text-[9px] font-bold flex items-center justify-center text-white">
            {badge}
          </span>
        )}
      </button>
    </div>
  );
}

// ─── Speaker View ─────────────────────────────────────────────────────────────
function SpeakerView({ peers, localStream, screenStream, isScreenSharing, audioEnabled, videoEnabled, peerStates, screenSharingPeers, raisedHands, isHandRaised, pinnedUser, setPinnedUser, user, room, onMute, hasPanel }) {
  const peerList = Object.entries(peers);
  const isHost = room?.host?._id === user?._id || room?.host === user?._id;

  const anySharer = [...screenSharingPeers][0];
  const mainId = pinnedUser || anySharer || (peerList.length > 0 ? peerList[0][0] : 'local');
  const isLocal = mainId === 'local';
  const mainStream = isLocal ? (isScreenSharing ? screenStream : localStream) : peers[mainId]?.stream;
  const mainUser = isLocal ? user : peers[mainId]?.user;
  const mainScreenShare = isLocal ? isScreenSharing : screenSharingPeers.has(mainId);
  const mainVidOff = isLocal ? (isScreenSharing ? false : !videoEnabled) : (screenSharingPeers.has(mainId) ? false : peerStates[mainId]?.videoEnabled === false);
  const sidebarPeers = peerList.filter(([sid]) => sid !== mainId);
  const showLocalSidebar = !isLocal;
  const sideRight = !hasPanel;

  return (
    <div className={`flex-1 overflow-hidden p-3 flex gap-3 ${sideRight ? 'flex-row' : 'flex-col'}`}>
      {/* Main */}
      <div className="flex-1 min-h-0 min-w-0 rounded-2xl overflow-hidden relative bg-[#0f0f18] shadow-2xl">
        <VideoTile
          stream={mainStream} user={mainUser} isLocal={isLocal} muted={isLocal}
          videoDisabled={mainVidOff} isHandRaised={isLocal ? isHandRaised : raisedHands[mainId] === true}
          isPinned={pinnedUser === mainId} onPin={() => setPinnedUser(pinnedUser === mainId ? null : mainId)}
          audioEnabled={audioEnabled} videoEnabled={videoEnabled}
          isCurrentUserHost={isHost} onMuteParticipant={!isLocal ? () => onMute(mainId) : undefined}
          isHost={isLocal ? isHost : (room?.host?._id === mainUser?._id)} isScreenShare={mainScreenShare}
        />
        {isLocal && isScreenSharing && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold px-4 py-1.5 rounded-full border border-white/15 z-20 flex items-center gap-2">
            <Monitor className="w-3.5 h-3.5 text-primary-400" /> You are presenting
          </div>
        )}
        {pinnedUser === mainId && (
          <div className="absolute top-3 left-3 bg-primary-600 text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 z-20">
            <Pin className="w-2.5 h-2.5" /> Pinned
          </div>
        )}
        {/* PiP self-camera when presenting */}
        {isLocal && isScreenSharing && localStream && (
          <div className="absolute bottom-4 right-4 w-36 aspect-video rounded-xl overflow-hidden border-2 border-primary-500/50 shadow-2xl z-30 bg-[#0f0f18]">
            <VideoTile stream={localStream} user={user} isLocal muted videoDisabled={!videoEnabled} audioEnabled={audioEnabled} videoEnabled={videoEnabled} isHost={isHost} isPip />
          </div>
        )}
      </div>
      {/* Sidebar */}
      {(sidebarPeers.length > 0 || showLocalSidebar) && (
        <div className={`flex gap-2 custom-scrollbar flex-shrink-0
          ${sideRight ? 'flex-col w-44 overflow-y-auto overflow-x-hidden' : 'flex-row h-32 overflow-x-auto overflow-y-hidden'}`}>
          {showLocalSidebar && (
            <div onClick={() => setPinnedUser(pinnedUser === 'local' ? null : 'local')}
              className={`flex-shrink-0 rounded-xl overflow-hidden cursor-pointer border-2 transition-all
                ${sideRight ? 'w-full aspect-video' : 'h-full aspect-video'}
                ${pinnedUser === 'local' ? 'border-primary-500' : 'border-white/10 hover:border-white/25'}`}>
              <VideoTile stream={localStream} user={user} isLocal muted videoDisabled={!videoEnabled} isHandRaised={isHandRaised} audioEnabled={audioEnabled} videoEnabled={videoEnabled} isPinned={pinnedUser === 'local'} isHost={isHost} />
            </div>
          )}
          {sidebarPeers.map(([sid]) => {
            const sharing = screenSharingPeers.has(sid);
            return (
              <div key={sid} onClick={() => setPinnedUser(sid === pinnedUser ? null : sid)}
                className={`flex-shrink-0 rounded-xl overflow-hidden cursor-pointer border-2 transition-all
                  ${sideRight ? 'w-full aspect-video' : 'h-full aspect-video'}
                  ${pinnedUser === sid ? 'border-primary-500' : 'border-white/10 hover:border-white/25'}`}>
                <VideoTile stream={peers[sid]?.stream} user={peers[sid]?.user} muted={false}
                  videoDisabled={sharing ? false : peerStates[sid]?.videoEnabled === false}
                  isHandRaised={raisedHands[sid] === true} isPinned={pinnedUser === sid}
                  isCurrentUserHost={isHost} onMuteParticipant={() => onMute(sid)}
                  isHost={room?.host?._id === peers[sid]?.user?._id} isScreenShare={sharing} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Grid View ────────────────────────────────────────────────────────────────
function GridView({ peers, localStream, screenStream, isScreenSharing, audioEnabled, videoEnabled, peerStates, screenSharingPeers, raisedHands, isHandRaised, user, room, onMute, setPinnedUser, setViewMode }) {
  const peerList = Object.entries(peers);
  const total = peerList.length + 1;
  const isHost = room?.host?._id === user?._id || room?.host === user?._id;

  return (
    <div className="flex-1 overflow-y-auto p-3 flex items-center justify-center custom-scrollbar">
      <div className={`grid gap-3 w-full h-full ${gridClass(total)}`}>
        <div className="aspect-video w-full rounded-2xl overflow-hidden">
          <VideoTile stream={isScreenSharing ? screenStream : localStream} user={user} isLocal muted
            videoDisabled={isScreenSharing ? false : !videoEnabled} isHandRaised={isHandRaised}
            audioEnabled={audioEnabled} videoEnabled={videoEnabled}
            onPin={() => { setPinnedUser('local'); setViewMode(VIEW.speaker); }} isHost={isHost} isScreenShare={isScreenSharing} />
        </div>
        {peerList.map(([sid]) => {
          const sharing = screenSharingPeers.has(sid);
          return (
            <div key={sid} className="aspect-video w-full rounded-2xl overflow-hidden">
              <VideoTile stream={peers[sid]?.stream} user={peers[sid]?.user} muted={false}
                videoDisabled={sharing ? false : peerStates[sid]?.videoEnabled === false}
                isHandRaised={raisedHands[sid] === true}
                onPin={() => { setPinnedUser(sid); setViewMode(VIEW.speaker); }}
                isCurrentUserHost={isHost} onMuteParticipant={() => onMute(sid)}
                isHost={room?.host?._id === peers[sid]?.user?._id} isScreenShare={sharing} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePanel, setActivePanel] = useState(null);
  const [raisedHands, setRaisedHands] = useState({});
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [showLeave, setShowLeave] = useState(false);
  const [pinnedUser, setPinnedUser] = useState(null);
  const [screenSharingPeers, setScreenSharingPeers] = useState(new Set());
  const [viewMode, setViewMode] = useState(VIEW.grid);
  const [showMore, setShowMore] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [copied, setCopied] = useState(false);
  const [clockTime, setClockTime] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const [meetingStart] = useState(() => Date.now());
  const [duration, setDuration] = useState('0:00');

  const { toasts, addToast } = useToasts();
  const audioRef = useRef(audioEnabled);
  const moreRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => { audioRef.current = audioEnabled; }, [audioEnabled]);

  // clock
  useEffect(() => {
    const id = setInterval(() => {
      setClockTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      const s = Math.floor((Date.now() - meetingStart) / 1000);
      setDuration(`${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(id);
  }, [meetingStart]);

  // close more menu on outside click
  useEffect(() => {
    const h = (e) => { if (moreRef.current && !moreRef.current.contains(e.target)) setShowMore(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // keyboard shortcuts
  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const k = e.key.toUpperCase();
      if (k === 'M') toggleAudio();
      else if (k === 'V') toggleVideo();
      else if (k === 'S') handleScreenShare();
      else if (k === 'H') handleHandRaise();
      else if (k === 'C') setActivePanel(p => p === PANELS.chat ? null : PANELS.chat);
      else if (k === 'P') setActivePanel(p => p === PANELS.participants ? null : PANELS.participants);
      else if (k === 'G') setViewMode(v => v === VIEW.grid ? VIEW.speaker : VIEW.grid);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toggleAudio, toggleVideo]);

  // ── Room init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { data } = await api.get(`/rooms/${roomId}`);
        if (!live) return;
        setRoom(data.data.room);
        const stream = await getLocalStream();
        const socket = getSocket();
        if (!socket) return;
        bindSocket(socket, stream);
        socket.emit('room:join', { roomId });
      } catch (err) {
        if (live) setError(err.response?.data?.message || 'Failed to join');
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
      const socket = getSocket();
      if (socket) {
        socket.emit('room:leave', { roomId });
        ['room:participants','room:user-joined','room:user-left','webrtc:offer','webrtc:answer',
          'webrtc:ice-candidate','media:toggle','media:force-mute','room:host-changed',
          'room:ended','room:user-hand-raised','screen:started','screen:stopped',
        ].forEach(ev => socket.off(ev));
      }
      cleanup();
    };
  }, [roomId]); // eslint-disable-line

  const bindSocket = (socket, stream) => {
    socket.on('room:participants', ({ participants }) => {
      participants.forEach(({ user: u, socketId: sid }) => {
        if (sid !== socket.id) addPeer(sid, u, stream);
      });
    });
    socket.on('room:user-joined', ({ name }) => addToast(`${name} joined`, 'join'));
    socket.on('room:user-left', ({ socketId, name }) => {
      addToast(`${name || 'Participant'} left`, 'leave');
      removePeer(socketId);
      setScreenSharingPeers(p => { const n = new Set(p); n.delete(socketId); return n; });
      setPinnedUser(p => p === socketId ? null : p);
    });
    socket.on('webrtc:offer', ({ offer, fromSocketId, from }) => receivePeer(fromSocketId, from, offer, stream));
    socket.on('webrtc:answer', ({ answer, fromSocketId }) => handleAnswer(fromSocketId, answer));
    socket.on('webrtc:ice-candidate', ({ candidate, fromSocketId }) => handleIceCandidate(fromSocketId, candidate));
    socket.on('media:toggle', ({ socketId, type, enabled }) => handleMediaToggle(socketId, type, enabled));
    socket.on('room:host-changed', ({ hostId, hostName }) => {
      setRoom(p => p ? { ...p, host: { ...p.host, _id: hostId, name: hostName } } : p);
      addToast(`${hostName} is now the host`);
    });
    socket.on('room:ended', () => { addToast('Meeting ended by host', 'leave'); setTimeout(() => navigate('/dashboard'), 1500); });
    socket.on('room:user-hand-raised', ({ socketId, name, isRaised }) => {
      setRaisedHands(p => ({ ...p, [socketId]: isRaised }));
      if (isRaised) addToast(`${name} raised their hand ✋`);
    });
    socket.on('screen:started', ({ socketId, name }) => {
      setScreenSharingPeers(p => { const n = new Set(p); n.add(socketId); return n; });
      setViewMode(VIEW.speaker); setPinnedUser(socketId);
      addToast(`${name || 'Someone'} is presenting`);
    });
    socket.on('screen:stopped', ({ socketId }) => {
      setScreenSharingPeers(p => { const n = new Set(p); n.delete(socketId); return n; });
      setPinnedUser(p => p === socketId ? null : p);
    });
    socket.on('media:force-mute', ({ type }) => {
      if (type === 'audio' && audioRef.current) { toggleAudio(); addToast('You were muted by the host'); }
    });
  };

  // ── Actions ──────────────────────────────────────────────────────────────────
  const handleMute = (sid) => getSocket()?.emit('room:mute-participant', { roomId, targetSocketId: sid });

  const handleScreenShare = async () => {
    const socket = getSocket();
    if (isScreenSharing) {
      stopScreenShare(); socket?.emit('screen:stop', { roomId });
      if (pinnedUser === 'local') setPinnedUser(null);
    } else {
      try {
        await startScreenShare(); socket?.emit('screen:start', { roomId });
        setViewMode(VIEW.speaker); setPinnedUser('local');
      } catch { addToast('Screen share cancelled'); }
    }
  };

  const handleHandRaise = () => {
    const socket = getSocket(); if (!socket) return;
    const next = !isHandRaised;
    setIsHandRaised(next);
    setRaisedHands(p => ({ ...p, [socket.id]: next }));
    socket.emit('room:raise-hand', { roomId, isRaised: next });
    if (next) addToast('Hand raised ✋');
  };

  const handleEndRoom = async () => {
    try { await api.patch(`/rooms/${roomId}/end`); navigate('/dashboard'); }
    catch { addToast('Failed to end meeting'); }
  };

  const togglePanel = (p) => setActivePanel(prev => prev === p ? null : p);

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const isHost = room?.host?._id === user?._id || room?.host === user?._id;
  const peerList = Object.entries(peers);
  const panelTitle = { chat: 'Chat', participants: `People (${peerList.length + 1})`, whiteboard: 'Whiteboard', files: 'Shared Files' };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center"><div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" /><p className="text-gray-500 text-sm">Joining…</p></div>
    </div>
  );
  if (error) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="glass-card p-8 max-w-sm w-full text-center"><p className="text-red-400 mb-4 text-sm">{error}</p><button onClick={() => navigate('/dashboard')} className="btn-primary">Back</button></div>
    </div>
  );

  return (
    <div ref={containerRef} className="h-screen bg-[#0a0a0f] flex flex-col overflow-hidden select-none">

      {/* ══ TOP BAR ══════════════════════════════════════════════════════════ */}
      <header className="flex items-center justify-between px-5 py-3 flex-shrink-0 bg-[#0a0a0f]">
        {/* Left — room info */}
        <div className="flex flex-col">
          <span className="text-sm font-bold text-white leading-tight">{room?.name || 'Meeting'}</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-gray-500 font-mono">{roomId}</span>
            <button onClick={copyLink} className="text-gray-500 hover:text-gray-300 transition-colors" title="Copy link">
              {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>
        {/* Right — encrypted + timer */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 border border-green-500/30 bg-green-500/8 px-2.5 py-1 rounded-full">
            <Shield className="w-3 h-3 text-green-400" />
            <span className="text-xs text-green-400 font-medium">Encrypted</span>
          </div>
          <span className="text-sm font-mono font-bold text-white tabular-nums min-w-[40px] text-right">{duration}</span>
        </div>
      </header>

      {/* ══ BODY ═════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video area */}
        <div className="flex flex-1 overflow-hidden">
          {viewMode === VIEW.grid ? (
            <GridView peers={peers} localStream={localStream} screenStream={screenStream}
              isScreenSharing={isScreenSharing} audioEnabled={audioEnabled} videoEnabled={videoEnabled}
              peerStates={peerStates} screenSharingPeers={screenSharingPeers} raisedHands={raisedHands}
              isHandRaised={isHandRaised} user={user} room={room} onMute={handleMute}
              setPinnedUser={setPinnedUser} setViewMode={setViewMode} />
          ) : (
            <SpeakerView peers={peers} localStream={localStream} screenStream={screenStream}
              isScreenSharing={isScreenSharing} audioEnabled={audioEnabled} videoEnabled={videoEnabled}
              peerStates={peerStates} screenSharingPeers={screenSharingPeers} raisedHands={raisedHands}
              isHandRaised={isHandRaised} pinnedUser={pinnedUser} setPinnedUser={setPinnedUser}
              user={user} room={room} onMute={handleMute} hasPanel={activePanel !== null} />
          )}
        </div>

        {/* Side panel */}
        {activePanel && (
          <aside className="w-80 border-l border-white/8 flex flex-col flex-shrink-0 bg-[#0f0f18] animate-slide-up">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/8 flex-shrink-0">
              <h2 className="text-sm font-bold text-white">{panelTitle[activePanel]}</h2>
              <button onClick={() => setActivePanel(null)} className="p-1.5 rounded-lg hover:bg-white/8 text-gray-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {activePanel === PANELS.chat && <ChatPanel roomId={roomId} />}
              {activePanel === PANELS.whiteboard && <Whiteboard roomId={roomId} />}
              {activePanel === PANELS.participants && (
                <ParticipantsPanel user={user} room={room} peers={peers} peerStates={peerStates}
                  raisedHands={raisedHands} isHandRaised={isHandRaised} audioEnabled={audioEnabled}
                  videoEnabled={videoEnabled} onMute={handleMute} onMakeHost={(uid) => getSocket()?.emit('room:change-host', { roomId, newHostUserId: uid })} />
              )}
              {activePanel === PANELS.files && <FilesPanel roomId={roomId} />}
            </div>
          </aside>
        )}
      </div>

      {/* ══ BOTTOM BAR ═══════════════════════════════════════════════════════ */}
      <footer className="flex items-center justify-center py-4 px-6 flex-shrink-0 bg-[#0a0a0f]">
        <div className="flex items-center gap-2">

          {/* Mic */}
          <CtrlBtn onClick={toggleAudio} danger={!audioEnabled} title={audioEnabled ? 'Mute (M)' : 'Unmute (M)'}>
            {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </CtrlBtn>

          {/* Camera */}
          <CtrlBtn onClick={toggleVideo} danger={!videoEnabled} title={videoEnabled ? 'Stop camera (V)' : 'Start camera (V)'}>
            {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </CtrlBtn>

          {/* Screen share */}
          <CtrlBtn onClick={handleScreenShare} danger={isScreenSharing} active={false} title={isScreenSharing ? 'Stop sharing (S)' : 'Share screen (S)'}>
            {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </CtrlBtn>

          {/* Raise hand */}
          <CtrlBtn onClick={handleHandRaise} active={isHandRaised} title="Raise hand (H)">
            <Hand className="w-5 h-5" />
          </CtrlBtn>

          {/* Chat */}
          <CtrlBtn onClick={() => togglePanel(PANELS.chat)} active={activePanel === PANELS.chat} title="Chat (C)">
            <MessageSquare className="w-5 h-5" />
          </CtrlBtn>

          {/* Participants */}
          <CtrlBtn onClick={() => togglePanel(PANELS.participants)} active={activePanel === PANELS.participants} title="People (P)">
            <Users className="w-5 h-5" />
          </CtrlBtn>

          {/* Layout */}
          <CtrlBtn onClick={() => setViewMode(v => v === VIEW.grid ? VIEW.speaker : VIEW.grid)} active={viewMode === VIEW.speaker} title="Toggle view (G)">
            {viewMode === VIEW.grid ? <Tv className="w-5 h-5" /> : <LayoutGrid className="w-5 h-5" />}
          </CtrlBtn>

          {/* Files */}
          <CtrlBtn onClick={() => togglePanel(PANELS.files)} active={activePanel === PANELS.files} title="Shared files">
            <FileText className="w-5 h-5" />
          </CtrlBtn>

          {/* More ⋯ */}
          <div className="relative" ref={moreRef}>
            <CtrlBtn onClick={() => setShowMore(v => !v)} active={showMore} title="More options">
              <MoreHorizontal className="w-5 h-5" />
            </CtrlBtn>
            {showMore && (
              <MoreMenu
                onRecord={() => { setIsRecording(r => !r); addToast(isRecording ? 'Recording stopped' : 'Recording started'); }}
                onWhiteboard={() => togglePanel(PANELS.whiteboard)}
                onFiles={() => togglePanel(PANELS.files)}
                isScreenSharing={isScreenSharing}
                onStopShare={handleScreenShare}
                isHandRaised={isHandRaised}
                onHandRaise={handleHandRaise}
                onClose={() => setShowMore(false)}
              />
            )}
          </div>

          {/* Spacer */}
          <div className="w-px h-8 bg-white/10 mx-1" />

          {/* Leave */}
          <button
            onClick={() => setShowLeave(true)}
            className="flex items-center gap-2 px-5 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-all duration-200 shadow-lg"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Leave</span>
          </button>
        </div>

        {/* Clock */}
        <div className="absolute right-6 text-xs text-gray-600 font-mono hidden sm:block">{clockTime}</div>
      </footer>

      {/* ══ OVERLAYS ══════════════════════════════════════════════════════════ */}
      <ToastList toasts={toasts} />

      {showLeave && (
        <LeaveModal
          isHost={isHost}
          onEnd={() => { setShowLeave(false); handleEndRoom(); }}
          onLeave={() => { setShowLeave(false); navigate('/dashboard'); }}
          onCancel={() => setShowLeave(false)}
        />
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-red-600/90 backdrop-blur-sm text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg z-50 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
          Recording
        </div>
      )}
    </div>
  );
}
