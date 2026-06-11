import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  MessageSquare, Users, PhoneOff, Hand, LayoutGrid,
  Copy, Check, Shield, Circle, Tv, MoreHorizontal,
  FileText, Pin, PinOff, ChevronDown, X,
  Upload, File, FileSpreadsheet, FileArchive, Settings,
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

// ─── Grid helper — returns grid cols + row count so tiles fill the screen ─────
function getGridLayout(n) {
  if (n <= 1) return { cols: 1, rows: 1 };
  if (n <= 2) return { cols: 2, rows: 1 };
  if (n <= 4) return { cols: 2, rows: 2 };
  if (n <= 6) return { cols: 3, rows: 2 };
  if (n <= 9) return { cols: 3, rows: 3 };
  return { cols: 4, rows: Math.ceil(n / 4) };
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
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
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
                {/* Host transfer button — only visible to current host, not for other hosts */}
                {isHost && !isPeerHost && (
                  <button onClick={() => onMakeHost(pu?._id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-amber-500/20 text-amber-400 transition-all" title="Make host">
                    <ChevronDown className="w-3 h-3 rotate-180" />
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

  // Initial load
  useEffect(() => {
    api.get(`/files/room/${roomId}`).then(r => setFiles(r.data?.data?.files || [])).catch(() => { });
  }, [roomId]);

  // Real-time: listen for file uploads from other participants
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = ({ file }) => {
      if (file) setFiles(prev => [...prev, file]);
    };
    socket.on('file:uploaded', handler);
    return () => socket.off('file:uploaded', handler);
  }, []);

  const handleFiles = async (chosen) => {
    if (!chosen?.length) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', chosen[0]);
      form.append('roomId', roomId);
      const { data } = await api.post('/files/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      const uploaded = data.data.file;
      // Update own list immediately
      setFiles(p => [...p, uploaded]);
      // Notify other participants in real-time
      const socket = getSocket();
      socket?.emit('file:uploaded', { roomId, file: uploaded });
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
function MoreMenu({ onRecord, onWhiteboard, onFiles, isScreenSharing, onStopShare, isHandRaised, onHandRaise, onSettings, onClose }) {
  const items = [
    { icon: <Circle className="w-4 h-4 text-red-400" />, label: 'Record Meeting', action: onRecord },
    { icon: <LayoutGrid className="w-4 h-4 text-gray-300" />, label: 'Open Whiteboard', action: onWhiteboard },
    { icon: <FileText className="w-4 h-4 text-gray-300" />, label: 'Share Files', action: onFiles },
    { icon: <Settings className="w-4 h-4 text-gray-300" />, label: 'Settings', action: onSettings },
    ...(isScreenSharing ? [{ icon: <MonitorOff className="w-4 h-4 text-gray-300" />, label: 'Stop sharing', action: onStopShare }] : []),
    { icon: <Hand className="w-4 h-4 text-gray-300" />, label: isHandRaised ? 'Lower hand' : 'Raise hand', action: onHandRaise },
  ];

  return (
    <div className="absolute top-full mt-3 right-0 w-52 bg-[#1a1a28] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in">
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


// ─── Grid View (Google Meet style — tiles fill the full screen) ───────────────
function GridView({ peers, localStream, screenStream, isScreenSharing, audioEnabled, videoEnabled, peerStates, screenSharingPeers, raisedHands, isHandRaised, user, room, onMute, setPinnedUser, setViewMode }) {
  const peerList = Object.entries(peers);
  const total = peerList.length + 1;
  const isHost = room?.host?._id === user?._id || room?.host === user?._id;
  const { cols, rows } = getGridLayout(total);

  return (
    <div className="flex-1 overflow-hidden p-2 sm:p-4 pb-20">
      <div
        className="w-full h-full grid gap-3 sm:gap-4 place-content-center mx-auto"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          maxWidth: cols > rows ? '100%' : `${cols * 95}vh` // keep roughly reasonable aspect constraints
        }}
      >
        <div className="rounded-2xl overflow-hidden min-h-0">
          <VideoTile stream={isScreenSharing ? screenStream : localStream} user={user} isLocal muted
            videoDisabled={isScreenSharing ? false : !videoEnabled} isHandRaised={isHandRaised}
            audioEnabled={audioEnabled} videoEnabled={videoEnabled}
            onPin={() => { setPinnedUser('local'); setViewMode(VIEW.speaker); }} isHost={isHost} isScreenShare={isScreenSharing} />
        </div>
        {peerList.map(([sid]) => {
          const sharing = screenSharingPeers.has(sid);
          return (
            <div key={sid} className="rounded-2xl overflow-hidden min-h-0">
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

// ─── Settings Modal (Mid-Call Device Selection) ───────────────────────────────
function SettingsModal({ onClose, switchDevice, currentVideoId, currentAudioId, user }) {
  const [audioDevices, setAudioDevices] = useState([]);
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedAudio, setSelectedAudio] = useState(currentAudioId || localStorage.getItem('syncspace_mic_id') || '');
  const [selectedVideo, setSelectedVideo] = useState(currentVideoId || localStorage.getItem('syncspace_cam_id') || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
      setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
    }).catch(() => { });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (selectedVideo !== localStorage.getItem('syncspace_cam_id')) await switchDevice('video', selectedVideo);
      if (selectedAudio !== localStorage.getItem('syncspace_mic_id')) await switchDevice('audio', selectedAudio);
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#111120] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2"><Settings className="w-5 h-5" /> Settings</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-xs text-gray-400 mb-1.5 flex items-center gap-1.5 uppercase tracking-wider"><Mic className="w-3.5 h-3.5" /> Microphone</label>
            <div className="relative">
              <select value={selectedAudio} onChange={e => setSelectedAudio(e.target.value)}
                className="w-full bg-[#1a1a2a] border border-white/10 text-white text-sm rounded-xl px-3 py-3 pr-8 appearance-none focus:outline-none focus:border-primary-500">
                {audioDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 5)}`}</option>)}
                {audioDevices.length === 0 && <option value="">No microphone found</option>}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1.5 flex items-center gap-1.5 uppercase tracking-wider"><Video className="w-3.5 h-3.5" /> Camera</label>
            <div className="relative">
              <select value={selectedVideo} onChange={e => setSelectedVideo(e.target.value)}
                className="w-full bg-[#1a1a2a] border border-white/10 text-white text-sm rounded-xl px-3 py-3 pr-8 appearance-none focus:outline-none focus:border-primary-500">
                {videoDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 5)}`}</option>)}
                {videoDevices.length === 0 && <option value="">No camera found</option>}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:bg-white/5 disabled:opacity-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white shadow-lg disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Speaker View (Google Meet style — 1 large, group on right) ───────────────
function SpeakerView({ peers, localStream, screenStream, isScreenSharing, audioEnabled, videoEnabled, peerStates, screenSharingPeers, raisedHands, isHandRaised, user, room, onMute, pinnedUser, setPinnedUser, hasPanel }) {
  const peerList = Object.entries(peers);
  const isHost = room?.host?._id === user?._id || room?.host === user?._id;

  // Find pinned or sharing or local user
  let mainPeerId = pinnedUser;
  if (!mainPeerId && isScreenSharing) mainPeerId = 'local';
  if (!mainPeerId) {
    const sharingPeer = peerList.find(([sid]) => screenSharingPeers.has(sid));
    if (sharingPeer) mainPeerId = sharingPeer[0];
  }
  if (!mainPeerId) mainPeerId = 'local'; // default to local if nobody pinned and no screen sharing

  const mainIsLocal = mainPeerId === 'local';
  const mainStream = mainIsLocal ? (isScreenSharing ? screenStream : localStream) : peers[mainPeerId]?.stream;
  const mainUser = mainIsLocal ? user : peers[mainPeerId]?.user;
  const mainSharing = mainIsLocal ? isScreenSharing : screenSharingPeers.has(mainPeerId);

  // Group others for the sidebar
  const sidePeers = peerList.filter(([sid]) => sid !== mainPeerId);
  const showLocalInSide = !mainIsLocal;

  // Responsive logic: if there is an active side panel, the right bar might get too cramped,
  // but CSS Flex does a good job scaling it down. Let's make the right bar vertical or horizontal on mobile.
  return (
    <div className="flex-1 overflow-hidden p-2 flex flex-col lg:flex-row gap-2">
      {/* Main dominant view */}
      <div className="flex-1 rounded-2xl overflow-hidden min-h-0 relative bg-dark-900 border border-white/5 shadow-inner">
        <VideoTile stream={mainStream} user={mainUser} isLocal={mainIsLocal} muted={mainIsLocal}
          videoDisabled={mainSharing ? false : (mainIsLocal ? !videoEnabled : peerStates[mainPeerId]?.videoEnabled === false)}
          isHandRaised={mainIsLocal ? isHandRaised : raisedHands[mainPeerId] === true}
          isHost={room?.host?._id === mainUser?._id} isScreenShare={mainSharing} isPinned={true} onPin={() => setPinnedUser(null)} />
      </div>

      {/* Side thumbnail group */}
      <div className={`flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto lg:overflow-x-hidden min-h-[140px] lg:min-h-0
        ${hasPanel ? 'lg:w-44' : 'lg:w-56'} lg:pr-1 custom-scrollbar`}>

        {showLocalInSide && (
          <div className="flex-shrink-0 w-44 lg:w-full aspect-video rounded-xl overflow-hidden bg-dark-900 border border-white/10 hover:border-white/20 transition-colors shadow">
            <VideoTile stream={localStream} user={user} isLocal muted videoDisabled={!videoEnabled} isHandRaised={isHandRaised} audioEnabled={audioEnabled} videoEnabled={videoEnabled} isPinned={false} isHost={isHost} onPin={() => setPinnedUser('local')} />
          </div>
        )}

        {sidePeers.map(([sid]) => {
          const sharing = screenSharingPeers.has(sid);
          return (
            <div key={sid} className="flex-shrink-0 w-44 lg:w-full aspect-video rounded-xl overflow-hidden bg-dark-900 border border-white/10 hover:border-white/20 transition-colors shadow">
              <VideoTile stream={peers[sid]?.stream} user={peers[sid]?.user} muted={false}
                videoDisabled={sharing ? false : peerStates[sid]?.videoEnabled === false}
                isHandRaised={raisedHands[sid] === true} isPinned={false} onPin={() => setPinnedUser(sid)}
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
  const [showSettings, setShowSettings] = useState(false);
  const [pinnedUser, setPinnedUser] = useState(null);
  const [screenSharingPeers, setScreenSharingPeers] = useState(new Set());
  const [viewMode, setViewMode] = useState(VIEW.grid);
  const [showMore, setShowMore] = useState(false);
  // Recording — uses real MediaRecorder API
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const [copied, setCopied] = useState(false);
  const [clockTime, setClockTime] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const [duration, setDuration] = useState('0:00');

  const { toasts, addToast } = useToasts();
  const audioRef = useRef(audioEnabled);
  const moreRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => { audioRef.current = audioEnabled; }, [audioEnabled]);

  // clock — uses room.createdAt so timer survives page refreshes
  useEffect(() => {
    const start = room?.createdAt ? new Date(room.createdAt).getTime() : Date.now();
    const tick = () => {
      setClockTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      const s = Math.floor((Date.now() - start) / 1000);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      setDuration(h > 0
        ? `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
        : `${m}:${sec.toString().padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [room]);

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
        ['room:participants', 'room:user-joined', 'room:user-left', 'webrtc:offer', 'webrtc:answer',
          'webrtc:ice-candidate', 'media:toggle', 'media:force-mute', 'room:host-changed',
          'room:ended', 'room:user-hand-raised', 'screen:started', 'screen:stopped',
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

  // ── Recording (real MediaRecorder) ───────────────────────────────────────────
  const handleRecord = useCallback(() => {
    if (isRecording) {
      // Stop recording and download
      mediaRecorderRef.current?.stop();
    } else {
      // Start recording the local stream
      const stream = localStream;
      if (!stream) { addToast('No local stream to record'); return; }
      try {
        recordedChunksRef.current = [];
        const mr = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
        mr.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
        mr.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `meeting-${roomId}-${Date.now()}.webm`;
          a.click();
          URL.revokeObjectURL(url);
          setIsRecording(false);
          addToast('Recording saved!');
        };
        mr.start(1000); // collect data every 1s
        mediaRecorderRef.current = mr;
        setIsRecording(true);
        addToast('Recording started 🔴');
      } catch (e) {
        addToast('Recording not supported in this browser');
      }
    }
  }, [isRecording, localStream, roomId, addToast]);

  const togglePanel = (p) => setActivePanel(prev => prev === p ? null : p);

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`).catch(() => { });
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
        {/* Left — room info + participant count */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-white leading-tight">{room?.name || 'Meeting'}</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-gray-500 font-mono">{roomId}</span>
              <button onClick={copyLink} className="text-gray-500 hover:text-gray-300 transition-colors" title="Copy link">
                {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
          {/* Live participant count badge */}
          <div className="flex items-center gap-1.5 bg-white/8 border border-white/10 px-2.5 py-1 rounded-full">
            <Users className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-300 font-semibold tabular-nums">{peerList.length + 1}</span>
          </div>
        </div>
        {/* Right — panels, layout, more + meeting timer */}
        <div className="flex items-center gap-2">
          {/* Meeting duration timer */}
          <div className="hidden sm:flex flex-col items-center justify-center px-3 py-1 rounded-xl bg-white/6 border border-white/10 mr-1">
            <span className="text-base font-bold text-white font-mono tracking-wide leading-tight">{duration}</span>
          </div>
          <CtrlBtn onClick={() => togglePanel(PANELS.participants)} active={activePanel === PANELS.participants} title="People (P)">
            <Users className="w-5 h-5" />
          </CtrlBtn>
          <CtrlBtn onClick={() => setViewMode(v => v === VIEW.grid ? VIEW.speaker : VIEW.grid)} active={viewMode === VIEW.speaker} title="Toggle view (G)">
            {viewMode === VIEW.grid ? <Tv className="w-5 h-5" /> : <LayoutGrid className="w-5 h-5" />}
          </CtrlBtn>
          <CtrlBtn onClick={() => togglePanel(PANELS.files)} active={activePanel === PANELS.files} title="Shared files">
            <FileText className="w-5 h-5" />
          </CtrlBtn>
          <CtrlBtn onClick={() => setShowSettings(true)} title="Settings" className="hidden sm:flex" id="settings-btn">
            <Settings className="w-5 h-5" />
          </CtrlBtn>
          {/* More ⋯ */}
          <div className="relative" ref={moreRef}>
            <CtrlBtn onClick={() => setShowMore(v => !v)} active={showMore} title="More options">
              <MoreHorizontal className="w-5 h-5" />
            </CtrlBtn>
            {showMore && (
              <MoreMenu
                onRecord={handleRecord}
                onWhiteboard={() => togglePanel(PANELS.whiteboard)}
                onFiles={() => togglePanel(PANELS.files)}
                isScreenSharing={isScreenSharing}
                onStopShare={handleScreenShare}
                isHandRaised={isHandRaised}
                onHandRaise={handleHandRaise}
                onSettings={() => setShowSettings(true)}
                onClose={() => setShowMore(false)}
              />
            )}
          </div>
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

        {/* Side panel — slides in from right like Google Meet */}
        {activePanel && (
          <aside className="w-80 border-l border-white/8 flex flex-col flex-shrink-0 bg-[#0f0f18] animate-slide-right">
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
                  videoEnabled={videoEnabled} onMute={handleMute}
                  onMakeHost={(uid) => getSocket()?.emit('room:change-host', { roomId, newHostUserId: uid })} />
              )}
              {activePanel === PANELS.files && <FilesPanel roomId={roomId} />}
            </div>
          </aside>
        )}
      </div>

      {/* ══ BOTTOM BAR ════════════════════════════════════════════════════════ */}
      <footer className="flex items-center justify-between py-4 px-6 flex-shrink-0 bg-[#0a0a0f]">

        {/* Left — current clock time */}
        <div className="hidden sm:flex flex-col gap-0 w-40 justify-center">
          <span className="text-base font-bold text-white font-mono tracking-wide leading-tight">{clockTime}</span>
        </div>

        {/* Center group — media controls + chat + leave (contained, no overflow) */}
        <div className="flex items-center gap-2 overflow-x-auto max-w-full flex-shrink min-w-0 px-1">
          <CtrlBtn onClick={toggleAudio} danger={!audioEnabled} title={audioEnabled ? 'Mute (M)' : 'Unmute (M)'}>
            {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </CtrlBtn>
          <CtrlBtn onClick={toggleVideo} danger={!videoEnabled} title={videoEnabled ? 'Stop camera (V)' : 'Start camera (V)'}>
            {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </CtrlBtn>
          <CtrlBtn onClick={handleScreenShare} danger={isScreenSharing} title={isScreenSharing ? 'Stop sharing (S)' : 'Share screen (S)'}>
            {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </CtrlBtn>
          <CtrlBtn onClick={handleHandRaise} active={isHandRaised} title="Raise hand (H)">
            <Hand className="w-5 h-5" />
          </CtrlBtn>
          <CtrlBtn onClick={() => togglePanel(PANELS.chat)} active={activePanel === PANELS.chat} title="Chat (C)">
            <MessageSquare className="w-5 h-5" />
          </CtrlBtn>

          {/* Separator */}
          <div className="w-px h-6 bg-white/10 mx-2 hidden sm:block flex-shrink-0"></div>

          <button
            onClick={() => setShowLeave(true)}
            className="flex items-center gap-2 px-6 h-10 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-all duration-200 shadow-lg flex-shrink-0"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Leave</span>
          </button>
        </div>

        {/* Right — spacer to balance left */}
        <div className="hidden sm:block w-40" />
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
