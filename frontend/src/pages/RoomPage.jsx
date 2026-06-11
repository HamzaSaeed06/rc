import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  MessageSquare, Users, PhoneOff, Hand, Copy, Check,
  Circle, MoreHorizontal, FileText, X, Upload, File,
  FileSpreadsheet, FileArchive, Settings, ChevronDown, Pin, PinOff,
  Volume2, VolumeX, Crown, LayoutGrid,
} from 'lucide-react';
import { getSocket } from '@/services/socket';
import useWebRTC from '@/hooks/useWebRTC';
import useAuthStore from '@/store/slices/authStore';
import VideoTile from '@/components/features/room/VideoTile';
import ChatPanel from '@/components/features/chat/ChatPanel';
import Whiteboard from '@/components/features/whiteboard/Whiteboard';
import api from '@/services/api';
import { getParticipantColor } from '@/utils/participantColors';

// ─── Layout modes ──────────────────────────────────────────────────────────────
const LAYOUT = {
  auto: 'auto',
  tiled: 'tiled',
  spotlight: 'spotlight',
  sidebar: 'sidebar',
};

const LAYOUT_DEFS = [
  {
    id: LAYOUT.auto,
    label: 'Auto',
    sublabel: 'Dynamic',
    icon: (
      <svg viewBox="0 0 36 24" fill="none" className="w-9 h-6">
        <rect x="1" y="1" width="16" height="10" rx="2" fill="currentColor" opacity=".6"/>
        <rect x="19" y="1" width="16" height="10" rx="2" fill="currentColor" opacity=".6"/>
        <rect x="1" y="13" width="16" height="10" rx="2" fill="currentColor" opacity=".3"/>
        <rect x="19" y="13" width="16" height="10" rx="2" fill="currentColor" opacity=".3"/>
      </svg>
    ),
  },
  {
    id: LAYOUT.tiled,
    label: 'Tiled',
    sublabel: 'Legacy',
    icon: (
      <svg viewBox="0 0 36 24" fill="none" className="w-9 h-6">
        <rect x="1" y="1" width="10" height="7" rx="1.5" fill="currentColor" opacity=".6"/>
        <rect x="13" y="1" width="10" height="7" rx="1.5" fill="currentColor" opacity=".6"/>
        <rect x="25" y="1" width="10" height="7" rx="1.5" fill="currentColor" opacity=".6"/>
        <rect x="1" y="10" width="10" height="7" rx="1.5" fill="currentColor" opacity=".5"/>
        <rect x="13" y="10" width="10" height="7" rx="1.5" fill="currentColor" opacity=".5"/>
        <rect x="25" y="10" width="10" height="7" rx="1.5" fill="currentColor" opacity=".5"/>
        <rect x="1" y="19" width="10" height="4" rx="1.5" fill="currentColor" opacity=".3"/>
        <rect x="13" y="19" width="10" height="4" rx="1.5" fill="currentColor" opacity=".3"/>
        <rect x="25" y="19" width="10" height="4" rx="1.5" fill="currentColor" opacity=".3"/>
      </svg>
    ),
  },
  {
    id: LAYOUT.spotlight,
    label: 'Spotlight',
    sublabel: 'Speaker',
    icon: (
      <svg viewBox="0 0 36 24" fill="none" className="w-9 h-6">
        <rect x="1" y="1" width="26" height="22" rx="2" fill="currentColor" opacity=".7"/>
        <rect x="29" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".4"/>
        <rect x="29" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".4"/>
        <rect x="29" y="17" width="6" height="6" rx="1.5" fill="currentColor" opacity=".4"/>
      </svg>
    ),
  },
  {
    id: LAYOUT.sidebar,
    label: 'Sidebar',
    sublabel: 'Side view',
    icon: (
      <svg viewBox="0 0 36 24" fill="none" className="w-9 h-6">
        <rect x="1" y="1" width="22" height="22" rx="2" fill="currentColor" opacity=".7"/>
        <rect x="25" y="1" width="10" height="5" rx="1.5" fill="currentColor" opacity=".4"/>
        <rect x="25" y="8" width="10" height="5" rx="1.5" fill="currentColor" opacity=".4"/>
        <rect x="25" y="15" width="10" height="5" rx="1.5" fill="currentColor" opacity=".4"/>
      </svg>
    ),
  },
];

const PANELS = { chat: 'chat', participants: 'participants', whiteboard: 'whiteboard', files: 'files' };

function getGridLayout(n) {
  if (n <= 1) return { cols: 1, rows: 1 };
  if (n <= 2) return { cols: 2, rows: 1 };
  if (n <= 4) return { cols: 2, rows: 2 };
  if (n <= 6) return { cols: 3, rows: 2 };
  if (n <= 9) return { cols: 3, rows: 3 };
  return { cols: 4, rows: Math.ceil(n / 4) };
}

// ─── Notification Sounds (Web Audio API) ──────────────────────────────────────
function useNotificationSounds() {
  const ctxRef = useRef(null);

  const getCtx = () => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctxRef.current.state === 'suspended') ctxRef.current.resume();
    return ctxRef.current;
  };

  const playTone = (frequency, duration, gainVal, type = 'sine', startTime, ctx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(gainVal, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration);
  };

  const playJoinSound = useCallback(() => {
    try {
      const ctx = getCtx();
      const t = ctx.currentTime;
      playTone(880, 0.15, 0.18, 'sine', t, ctx);
      playTone(1109, 0.22, 0.14, 'sine', t + 0.12, ctx);
    } catch { }
  }, []);

  const playHandRaiseSound = useCallback(() => {
    try {
      const ctx = getCtx();
      const t = ctx.currentTime;
      playTone(660, 0.12, 0.16, 'sine', t, ctx);
      playTone(880, 0.12, 0.14, 'sine', t + 0.1, ctx);
      playTone(1046, 0.20, 0.12, 'sine', t + 0.2, ctx);
    } catch { }
  }, []);

  return { playJoinSound, playHandRaiseSound };
}

// ─── Toast ─────────────────────────────────────────────────────────────────────
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
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`text-xs font-semibold px-4 py-2 rounded-full shadow-xl border backdrop-blur-md animate-fade-in
          ${t.type === 'join' ? 'bg-green-900/80 border-green-500/40 text-green-300'
            : t.type === 'leave' ? 'bg-red-900/80 border-red-500/40 text-red-300'
              : 'bg-[#303134]/90 border-white/10 text-white'}`}>
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
      className="rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-md">
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Leave Modal ──────────────────────────────────────────────────────────────
function LeaveModal({ isHost, onEnd, onLeave, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[300] p-4 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-[#202124] border border-white/12 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold text-white mb-1">{isHost ? 'Leave or end?' : 'Leave meeting?'}</h3>
        <p className="text-sm text-gray-400 mb-5">{isHost ? 'You can end for everyone or just leave.' : 'Others will continue the meeting.'}</p>
        <div className="flex flex-col gap-2">
          {isHost && <button onClick={onEnd} className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors">End for Everyone</button>}
          <button onClick={onLeave} className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${isHost ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}>{isHost ? 'Leave (pass host)' : 'Leave'}</button>
          <button onClick={onCancel} className="w-full py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-gray-300 text-sm font-semibold transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Layout Picker Modal ──────────────────────────────────────────────────────
function LayoutPicker({ current, onChange, onClose }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center pb-24" onClick={onClose}>
      <div className="bg-[#202124] border border-white/12 rounded-2xl p-5 w-full max-w-sm shadow-2xl animate-slide-up mx-4"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white">Change layout</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 text-gray-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-1.5">
          {LAYOUT_DEFS.map((l) => (
            <button key={l.id}
              onClick={() => { onChange(l.id); onClose(); }}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all text-left
                ${current === l.id
                  ? 'bg-indigo-600/20 border border-indigo-500/40 text-white'
                  : 'hover:bg-white/6 border border-transparent text-gray-300'}`}>
              <div className={`flex-shrink-0 ${current === l.id ? 'text-indigo-400' : 'text-gray-500'}`}>
                {l.icon}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold leading-tight">{l.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{l.sublabel}</div>
              </div>
              {current === l.id && (
                <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
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
    <div className="flex flex-col h-full bg-[#282a2d]">
      <div className="px-5 py-4 border-b border-white/8">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{total} participant{total !== 1 ? 's' : ''}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 custom-scrollbar">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors">
          <Av userId={user?._id} name={user?.name} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
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
        {peerList.map(([sid, { user: pu }]) => {
          const audioOff = peerStates[sid]?.audioEnabled === false;
          const videoOff = peerStates[sid]?.videoEnabled === false;
          const hand = raisedHands[sid] === true;
          const isPeerHost = room?.host?._id === pu?._id || room?.host === pu?._id;
          return (
            <div key={sid} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors group">
              <Av userId={pu?._id} name={pu?.name} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
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
                {isHost && !isPeerHost && (
                  <button onClick={() => onMakeHost(pu?._id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-amber-500/20 text-amber-400 transition-all" title="Make host">
                    <Crown className="w-3 h-3" />
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
  return <File className="w-5 h-5 text-indigo-400" />;
}

function FilesPanel({ roomId }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const inputRef = useRef();

  useEffect(() => {
    api.get(`/files/room/${roomId}`)
      .then(r => setFiles(r.data?.data?.files || []))
      .catch(() => { });
  }, [roomId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = ({ file }) => {
      if (file) setFiles(prev => {
        const already = prev.some(f => (f._id || f.id) === (file._id || file.id));
        return already ? prev : [...prev, file];
      });
    };
    socket.on('file:uploaded', handler);
    return () => socket.off('file:uploaded', handler);
  }, []);

  const handleFiles = async (chosen) => {
    if (!chosen?.length) return;
    const file = chosen[0];
    setUploading(true);
    setUploadError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('roomId', roomId);
      const { data } = await api.post('/files/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      const uploaded = data?.data?.file || data?.data;
      if (uploaded) {
        setFiles(p => {
          const already = p.some(f => (f._id || f.id) === (uploaded._id || uploaded.id));
          return already ? p : [...p, uploaded];
        });
        const socket = getSocket();
        socket?.emit('file:uploaded', { roomId, file: uploaded });
      }
    } catch (err) {
      setUploadError(err.response?.data?.message || 'Upload failed. Try again.');
    } finally { setUploading(false); }
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

  const fmtTime = (d) => d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  const getFileName = (f) => f.originalName || f.file?.originalName || f.fileName || f.file?.fileName || 'File';
  const getFilePath = (f) => f.fileName || f.file?.fileName || '';

  return (
    <div className="flex flex-col h-full bg-[#282a2d]">
      <div className="px-5 py-4 border-b border-white/8">
        <p className="text-sm font-bold text-white">Shared Files</p>
        <p className="text-xs text-gray-500 mt-0.5">{files.length} file{files.length !== 1 ? 's' : ''}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar flex flex-col gap-3">
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => !uploading && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-2 transition-all
            ${uploading ? 'border-indigo-500/40 bg-indigo-500/5 cursor-wait' : 'border-white/15 cursor-pointer hover:border-indigo-500/40 hover:bg-indigo-500/5'}`}
        >
          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${uploading ? 'bg-indigo-500/20' : 'bg-white/8'}`}>
            <Upload className={`w-5 h-5 ${uploading ? 'text-indigo-400 animate-bounce' : 'text-gray-400'}`} />
          </div>
          <p className="text-sm font-semibold text-white">{uploading ? 'Uploading…' : 'Share a file'}</p>
          <p className="text-xs text-gray-500 text-center">Drag & drop or click to browse · Max 50MB</p>
          <input ref={inputRef} type="file" className="hidden" onChange={e => handleFiles(e.target.files)} />
        </div>

        {uploadError && (
          <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2.5 text-xs text-red-400">
            {uploadError}
          </div>
        )}

        {files.map((f, i) => (
          <a key={f._id || f.id || i}
            href={getFilePath(f) ? `/uploads/${getFilePath(f)}` : '#'}
            download={getFileName(f)} target="_blank" rel="noreferrer"
            className="flex items-center gap-3 p-3.5 rounded-xl bg-white/5 hover:bg-white/8 border border-white/8 hover:border-white/14 transition-all">
            <div className="flex-shrink-0">{fileIcon(getFileName(f))}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{getFileName(f)}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {fmtSize(f.size || f.file?.size)}
                {(f.uploadedBy?.name || f.sender?.name) && ` · ${f.uploadedBy?.name || f.sender?.name}`}
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
function MoreMenu({ onRecord, isRecording, onWhiteboard, onFiles, isScreenSharing, onStopShare, isHandRaised, onHandRaise, onSettings, onClose }) {
  const items = [
    { icon: <Circle className={`w-4 h-4 ${isRecording ? 'text-red-400 animate-pulse' : 'text-gray-300'}`} />, label: isRecording ? 'Stop Recording' : 'Record Meeting', action: onRecord },
    { icon: <LayoutGrid className="w-4 h-4 text-gray-300" />, label: 'Open Whiteboard', action: onWhiteboard },
    { icon: <FileText className="w-4 h-4 text-gray-300" />, label: 'Share Files', action: onFiles },
    { icon: <Hand className="w-4 h-4 text-gray-300" />, label: isHandRaised ? 'Lower Hand' : 'Raise Hand', action: onHandRaise },
    ...(isScreenSharing ? [{ icon: <MonitorOff className="w-4 h-4 text-orange-400" />, label: 'Stop Sharing Screen', action: onStopShare }] : []),
    { icon: <Settings className="w-4 h-4 text-gray-300" />, label: 'Settings', action: onSettings },
  ];

  return (
    <div className="fixed bottom-20 right-6 w-56 bg-[#303134] border border-white/12 rounded-2xl shadow-2xl overflow-hidden z-[400] animate-slide-up">
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

// ─── Settings Modal ───────────────────────────────────────────────────────────
function SettingsModal({ onClose, switchDevice, currentVideoId, currentAudioId }) {
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
    } catch { }
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#303134] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-6 animate-scale-in">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2"><Settings className="w-5 h-5" /> Settings</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-5">
          <div>
            <label className="text-xs text-gray-400 mb-2 flex items-center gap-1.5 uppercase tracking-wider font-semibold"><Mic className="w-3.5 h-3.5" /> Microphone</label>
            <div className="relative">
              <select value={selectedAudio} onChange={e => setSelectedAudio(e.target.value)}
                className="w-full bg-[#202124] border border-white/10 text-white text-sm rounded-xl px-3 py-3 pr-8 appearance-none focus:outline-none focus:border-indigo-500/50">
                {audioDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 5)}`}</option>)}
                {audioDevices.length === 0 && <option value="">No microphone found</option>}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-2 flex items-center gap-1.5 uppercase tracking-wider font-semibold"><Video className="w-3.5 h-3.5" /> Camera</label>
            <div className="relative">
              <select value={selectedVideo} onChange={e => setSelectedVideo(e.target.value)}
                className="w-full bg-[#202124] border border-white/10 text-white text-sm rounded-xl px-3 py-3 pr-8 appearance-none focus:outline-none focus:border-indigo-500/50">
                {videoDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 5)}`}</option>)}
                {videoDevices.length === 0 && <option value="">No camera found</option>}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>
        <div className="mt-8 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:bg-white/5 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Control button ───────────────────────────────────────────────────────────
function CtrlBtn({ onClick, active, danger, title, children, badge, label }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button onClick={onClick} title={title}
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 relative
          ${danger ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30 ring-1 ring-red-500/30'
            : active ? 'bg-indigo-600/25 text-indigo-300 hover:bg-indigo-600/35 ring-1 ring-indigo-500/40'
              : 'bg-white/8 text-gray-200 hover:bg-white/14 hover:text-white'}`}
      >
        {children}
        {badge > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-indigo-500 rounded-full text-[9px] font-bold flex items-center justify-center text-white">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </button>
      {label && <span className="text-[10px] text-gray-500 font-medium leading-none">{label}</span>}
    </div>
  );
}

// ─── Grid View ────────────────────────────────────────────────────────────────
function GridView({ peers, localStream, screenStream, isScreenSharing, audioEnabled, videoEnabled, peerStates, screenSharingPeers, raisedHands, isHandRaised, user, room, onMute, setPinnedUser, setLayout }) {
  const peerList = Object.entries(peers);
  const total = peerList.length + 1;
  const isHost = room?.host?._id === user?._id || room?.host === user?._id;
  const { cols, rows } = getGridLayout(total);

  return (
    <div className="flex-1 overflow-hidden p-2 sm:p-3 pb-20">
      <div className="w-full h-full grid gap-2 sm:gap-3 place-content-center mx-auto"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}>
        <div className="rounded-2xl overflow-hidden min-h-0">
          <VideoTile stream={isScreenSharing ? screenStream : localStream} user={user} isLocal muted
            videoDisabled={isScreenSharing ? false : !videoEnabled}
            isHandRaised={isHandRaised} audioEnabled={audioEnabled} videoEnabled={videoEnabled}
            onPin={() => { setPinnedUser('local'); setLayout(LAYOUT.spotlight); }}
            isHost={isHost} isScreenShare={isScreenSharing} />
        </div>
        {peerList.map(([sid]) => {
          const sharing = screenSharingPeers.has(sid);
          return (
            <div key={sid} className="rounded-2xl overflow-hidden min-h-0">
              <VideoTile stream={peers[sid]?.stream} user={peers[sid]?.user} muted={false}
                videoDisabled={sharing ? false : peerStates[sid]?.videoEnabled === false}
                isHandRaised={raisedHands[sid] === true}
                onPin={() => { setPinnedUser(sid); setLayout(LAYOUT.spotlight); }}
                isCurrentUserHost={isHost} onMuteParticipant={() => onMute(sid)}
                isHost={room?.host?._id === peers[sid]?.user?._id} isScreenShare={sharing} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Speaker View ─────────────────────────────────────────────────────────────
function SpeakerView({ peers, localStream, screenStream, isScreenSharing, audioEnabled, videoEnabled, peerStates, screenSharingPeers, raisedHands, isHandRaised, user, room, onMute, pinnedUser, setPinnedUser, hasPanel, layout }) {
  const peerList = Object.entries(peers);
  const isHost = room?.host?._id === user?._id || room?.host === user?._id;

  let mainPeerId = pinnedUser;
  if (!mainPeerId && isScreenSharing) mainPeerId = 'local';
  if (!mainPeerId) {
    const sharingPeer = peerList.find(([sid]) => screenSharingPeers.has(sid));
    if (sharingPeer) mainPeerId = sharingPeer[0];
  }
  if (!mainPeerId) mainPeerId = 'local';

  const mainIsLocal = mainPeerId === 'local';
  const mainStream = mainIsLocal ? (isScreenSharing ? screenStream : localStream) : peers[mainPeerId]?.stream;
  const mainUser = mainIsLocal ? user : peers[mainPeerId]?.user;
  const mainSharing = mainIsLocal ? isScreenSharing : screenSharingPeers.has(mainPeerId);

  const sidePeers = peerList.filter(([sid]) => sid !== mainPeerId);
  const showLocalInSide = !mainIsLocal;
  const isHorizontalSide = layout === LAYOUT.sidebar;

  return (
    <div className={`flex-1 overflow-hidden p-2 flex ${isHorizontalSide ? 'flex-col' : 'flex-col lg:flex-row'} gap-2`}>
      <div className="flex-1 rounded-2xl overflow-hidden min-h-0 relative bg-[#303134] border border-white/5 shadow-inner">
        <VideoTile stream={mainStream} user={mainUser} isLocal={mainIsLocal} muted={mainIsLocal}
          videoDisabled={mainSharing ? false : (mainIsLocal ? !videoEnabled : peerStates[mainPeerId]?.videoEnabled === false)}
          isHandRaised={mainIsLocal ? isHandRaised : raisedHands[mainPeerId] === true}
          audioEnabled={mainIsLocal ? audioEnabled : undefined}
          videoEnabled={mainIsLocal ? videoEnabled : undefined}
          isCurrentUserHost={isHost} onMuteParticipant={!mainIsLocal ? () => onMute(mainPeerId) : undefined}
          isHost={mainIsLocal ? isHost : room?.host?._id === mainUser?._id}
          isScreenShare={mainSharing} isPinned={true} onPin={() => setPinnedUser(null)} />
      </div>

      <div className={`flex gap-2 ${isHorizontalSide ? 'flex-row overflow-x-auto h-28' : 'lg:flex-col lg:w-44 overflow-x-auto lg:overflow-y-auto lg:overflow-x-hidden lg:min-h-0 min-h-[120px]'} lg:pr-1 custom-scrollbar`}>
        {showLocalInSide && (
          <div className="flex-shrink-0 w-40 lg:w-full aspect-video rounded-xl overflow-hidden bg-[#303134] border border-white/10 hover:border-white/20 transition-colors">
            <VideoTile stream={localStream} user={user} isLocal muted videoDisabled={!videoEnabled}
              isHandRaised={isHandRaised} audioEnabled={audioEnabled} videoEnabled={videoEnabled}
              isPinned={false} isHost={isHost} onPin={() => setPinnedUser('local')} />
          </div>
        )}
        {sidePeers.map(([sid]) => {
          const sharing = screenSharingPeers.has(sid);
          return (
            <div key={sid} className="flex-shrink-0 w-40 lg:w-full aspect-video rounded-xl overflow-hidden bg-[#303134] border border-white/10 hover:border-white/20 transition-colors">
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
// MAIN ROOM PAGE
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
    switchDevice,
  } = useWebRTC(roomId);

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePanel, setActivePanel] = useState(null);
  const [raisedHands, setRaisedHands] = useState({});
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [showLeave, setShowLeave] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showLayoutPicker, setShowLayoutPicker] = useState(false);
  const [pinnedUser, setPinnedUser] = useState(null);
  const [screenSharingPeers, setScreenSharingPeers] = useState(new Set());
  const [layout, setLayout] = useState(LAYOUT.auto);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const [copied, setCopied] = useState(false);
  const [clockTime, setClockTime] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const [duration, setDuration] = useState('0:00');
  const [unreadChat, setUnreadChat] = useState(0);

  const { toasts, addToast } = useToasts();
  const { playJoinSound, playHandRaiseSound } = useNotificationSounds();
  const soundJoinRef = useRef(playJoinSound);
  const soundHandRef = useRef(playHandRaiseSound);
  useEffect(() => { soundJoinRef.current = playJoinSound; }, [playJoinSound]);
  useEffect(() => { soundHandRef.current = playHandRaiseSound; }, [playHandRaiseSound]);
  const audioRef = useRef(audioEnabled);
  const moreRef = useRef(null);

  useEffect(() => { audioRef.current = audioEnabled; }, [audioEnabled]);

  // Clock
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

  // Close more/layout on outside click
  useEffect(() => {
    const h = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setShowMore(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Track unread chat messages
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = () => {
      if (activePanel !== PANELS.chat) setUnreadChat(n => n + 1);
    };
    socket.on('chat:message', handler);
    return () => socket.off('chat:message', handler);
  }, [activePanel]);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const k = e.key.toUpperCase();
      if (k === 'M') toggleAudio();
      else if (k === 'V') toggleVideo();
      else if (k === 'S') handleScreenShare();
      else if (k === 'H') handleHandRaise();
      else if (k === 'C') togglePanel(PANELS.chat);
      else if (k === 'P') togglePanel(PANELS.participants);
      else if (k === 'L') setShowLayoutPicker(v => !v);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toggleAudio, toggleVideo]);

  // Room init
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
    socket.on('room:user-joined', ({ name }) => { soundJoinRef.current?.(); addToast(`${name} joined`, 'join'); });
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
      if (isRaised) { soundHandRef.current?.(); addToast(`${name} raised their hand ✋`); }
    });
    socket.on('screen:started', ({ socketId, name }) => {
      setScreenSharingPeers(p => { const n = new Set(p); n.add(socketId); return n; });
      setLayout(LAYOUT.spotlight); setPinnedUser(socketId);
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
        setLayout(LAYOUT.spotlight); setPinnedUser('local');
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

  const handleRecord = useCallback(() => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
    } else {
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
          a.href = url; a.download = `meeting-${roomId}-${Date.now()}.webm`;
          a.click(); URL.revokeObjectURL(url);
          setIsRecording(false); addToast('Recording saved!');
        };
        mr.start(1000); mediaRecorderRef.current = mr; setIsRecording(true); addToast('Recording started 🔴');
      } catch { addToast('Recording not supported in this browser'); }
    }
  }, [isRecording, localStream, roomId, addToast]);

  const togglePanel = (p) => {
    setActivePanel(prev => prev === p ? null : p);
    if (p === PANELS.chat) setUnreadChat(0);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`).catch(() => { });
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const handleLayoutChange = (newLayout) => {
    setLayout(newLayout);
    if (newLayout === LAYOUT.auto || newLayout === LAYOUT.tiled) {
      setPinnedUser(null);
    }
  };

  const isHost = room?.host?._id === user?._id || room?.host === user?._id;
  const peerList = Object.entries(peers);
  const isGridLayout = layout === LAYOUT.auto || layout === LAYOUT.tiled;

  const panelTitle = {
    chat: 'In-call messages',
    participants: `People (${peerList.length + 1})`,
    whiteboard: 'Whiteboard',
    files: 'Shared Files',
  };

  if (loading) return (
    <div className="min-h-screen bg-[#202124] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Joining meeting…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#202124] flex items-center justify-center p-4">
      <div className="bg-[#303134] border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center">
        <p className="text-red-400 mb-4 text-sm">{error}</p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary">Back to dashboard</button>
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-[#202124] flex flex-col overflow-hidden select-none">

      {/* ══ TOP BAR ══════════════════════════════════════════════════════════ */}
      <header className="flex items-center justify-between px-4 py-2.5 flex-shrink-0 bg-[#202124] border-b border-white/6">
        {/* Left — room info */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-white leading-tight">{room?.name || 'Meeting'}</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-gray-600 font-mono">{roomId}</span>
              <button onClick={copyLink} className="text-gray-600 hover:text-gray-400 transition-colors" title="Copy link">
                {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-white/6 border border-white/10 px-2.5 py-1 rounded-full">
            <Users className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-300 font-semibold tabular-nums">{peerList.length + 1}</span>
          </div>
        </div>

        {/* Right — duration + panels + more */}
        <div className="flex items-center gap-1.5">
          <div className="hidden sm:flex items-center px-3 py-1.5 rounded-xl bg-white/5 border border-white/8">
            <span className="text-sm font-bold text-white font-mono tracking-wide">{duration}</span>
          </div>
          <CtrlBtn onClick={() => togglePanel(PANELS.participants)} active={activePanel === PANELS.participants} title="People (P)">
            <Users className="w-5 h-5" />
          </CtrlBtn>
          <CtrlBtn onClick={() => togglePanel(PANELS.files)} active={activePanel === PANELS.files} title="Shared files">
            <FileText className="w-5 h-5" />
          </CtrlBtn>
          <CtrlBtn onClick={() => setShowSettings(true)} title="Settings">
            <Settings className="w-5 h-5" />
          </CtrlBtn>
          {/* More ⋯ */}
          <div ref={moreRef} className="relative">
            <CtrlBtn onClick={() => setShowMore(v => !v)} active={showMore} title="More options">
              <MoreHorizontal className="w-5 h-5" />
            </CtrlBtn>
          </div>
        </div>
      </header>

      {/* ══ BODY ═════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video area */}
        <div className="flex flex-1 overflow-hidden">
          {isGridLayout ? (
            <GridView peers={peers} localStream={localStream} screenStream={screenStream}
              isScreenSharing={isScreenSharing} audioEnabled={audioEnabled} videoEnabled={videoEnabled}
              peerStates={peerStates} screenSharingPeers={screenSharingPeers} raisedHands={raisedHands}
              isHandRaised={isHandRaised} user={user} room={room} onMute={handleMute}
              setPinnedUser={setPinnedUser} setLayout={setLayout} />
          ) : (
            <SpeakerView peers={peers} localStream={localStream} screenStream={screenStream}
              isScreenSharing={isScreenSharing} audioEnabled={audioEnabled} videoEnabled={videoEnabled}
              peerStates={peerStates} screenSharingPeers={screenSharingPeers} raisedHands={raisedHands}
              isHandRaised={isHandRaised} pinnedUser={pinnedUser} setPinnedUser={setPinnedUser}
              user={user} room={room} onMute={handleMute} hasPanel={activePanel !== null} layout={layout} />
          )}
        </div>

        {/* Side panel — overlay on mobile, inline on desktop */}
        {activePanel && (
          <>
            {/* Mobile overlay backdrop */}
            <div className="fixed inset-0 bg-black/50 z-40 sm:hidden" onClick={() => setActivePanel(null)} />
            <aside className="fixed right-0 top-0 bottom-0 w-full max-w-xs sm:relative sm:w-80 sm:max-w-none border-l border-white/8 flex flex-col flex-shrink-0 bg-[#282a2d] animate-slide-right z-50 sm:z-auto">
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
          </>
        )}
      </div>

      {/* ══ BOTTOM BAR ════════════════════════════════════════════════════════ */}
      <footer className="flex items-center justify-between py-2 sm:py-3 px-2 sm:px-4 flex-shrink-0 bg-[#202124] border-t border-white/6 gap-1">

        {/* Left — clock */}
        <div className="hidden md:flex flex-col w-28 justify-center flex-shrink-0">
          <span className="text-sm font-bold text-white font-mono">{clockTime}</span>
          {isRecording && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
              <span className="text-[10px] text-red-400 font-semibold">REC</span>
            </div>
          )}
        </div>

        {/* Center — main controls */}
        <div className="flex items-center gap-1 sm:gap-2 flex-1 justify-center overflow-x-auto scrollbar-none px-1 py-0.5">
          <CtrlBtn onClick={toggleAudio} danger={!audioEnabled} title={audioEnabled ? 'Mute (M)' : 'Unmute (M)'} label={audioEnabled ? 'Mic' : 'Muted'}>
            {audioEnabled ? <Mic className="w-4 h-4 sm:w-5 sm:h-5" /> : <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />}
          </CtrlBtn>
          <CtrlBtn onClick={toggleVideo} danger={!videoEnabled} title={videoEnabled ? 'Stop camera (V)' : 'Start camera (V)'} label={videoEnabled ? 'Cam' : 'No cam'}>
            {videoEnabled ? <Video className="w-4 h-4 sm:w-5 sm:h-5" /> : <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" />}
          </CtrlBtn>
          <CtrlBtn onClick={handleScreenShare} active={isScreenSharing} title={isScreenSharing ? 'Stop sharing (S)' : 'Share screen (S)'} label="Share">
            {isScreenSharing ? <MonitorOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Monitor className="w-4 h-4 sm:w-5 sm:h-5" />}
          </CtrlBtn>
          <CtrlBtn onClick={handleHandRaise} active={isHandRaised} title="Raise hand (H)" label="Hand">
            <Hand className="w-4 h-4 sm:w-5 sm:h-5" />
          </CtrlBtn>
          <CtrlBtn onClick={() => togglePanel(PANELS.chat)} active={activePanel === PANELS.chat} title="Chat (C)"
            badge={activePanel !== PANELS.chat ? unreadChat : 0} label="Chat">
            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
          </CtrlBtn>

          {/* Layout picker button */}
          <CtrlBtn onClick={() => setShowLayoutPicker(v => !v)} active={showLayoutPicker} title="Change layout (L)" label="Layout">
            <LayoutGrid className="w-4 h-4 sm:w-5 sm:h-5" />
          </CtrlBtn>

          {/* Separator */}
          <div className="w-px h-6 bg-white/10 mx-0.5 sm:mx-1 flex-shrink-0" />

          {/* Leave */}
          <button onClick={() => setShowLeave(true)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 h-10 sm:h-12 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-all shadow-lg shadow-red-600/20 flex-shrink-0">
            <PhoneOff className="w-4 h-4" />
            <span className="hidden sm:block">Leave</span>
          </button>
        </div>

        {/* Right — spacer */}
        <div className="hidden md:block w-28 flex-shrink-0" />
      </footer>

      {/* ══ OVERLAYS ══════════════════════════════════════════════════════════ */}
      <ToastList toasts={toasts} />

      {/* More menu - fixed above bottom bar */}
      {showMore && (
        <MoreMenu
          onRecord={handleRecord}
          isRecording={isRecording}
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

      {/* Layout picker */}
      {showLayoutPicker && (
        <LayoutPicker current={layout} onChange={handleLayoutChange} onClose={() => setShowLayoutPicker(false)} />
      )}

      {showLeave && (
        <LeaveModal isHost={isHost}
          onEnd={() => { setShowLeave(false); handleEndRoom(); }}
          onLeave={() => { setShowLeave(false); navigate('/dashboard'); }}
          onCancel={() => setShowLeave(false)} />
      )}

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} switchDevice={switchDevice}
          currentVideoId={localStorage.getItem('syncspace_cam_id')}
          currentAudioId={localStorage.getItem('syncspace_mic_id')} />
      )}
    </div>
  );
}
