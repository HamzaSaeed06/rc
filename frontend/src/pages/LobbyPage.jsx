import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Video, VideoOff, Loader2, ArrowLeft } from 'lucide-react';
import { initSocket } from '@/services/socket';
import useAuthStore from '@/store/slices/authStore';
import api from '@/services/api';
import { getParticipantColor } from '@/utils/participantColors';

export default function LobbyPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [selectedAudio] = useState(() => localStorage.getItem('syncspace_mic_id') || '');
  const [selectedVideo] = useState(() => localStorage.getItem('syncspace_cam_id') || '');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [permError, setPermError] = useState('');
  const [roomName, setRoomName] = useState('');
  const [joining, setJoining] = useState(false);

  const avatarColor = getParticipantColor(user?._id || user?.name || '');
  const avatarInitial = (user?.name || '?').charAt(0).toUpperCase();

  useEffect(() => {
    api.get(`/rooms/${roomId}`)
      .then(r => setRoomName(r.data?.data?.room?.name || 'Meeting'))
      .catch(() => {});
  }, [roomId]);

  const startPreview = useCallback(async () => {
    setPermError('');
    streamRef.current?.getTracks().forEach(t => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: camOn ? (selectedVideo ? { deviceId: { exact: selectedVideo } } : true) : false,
        audio: micOn ? (selectedAudio ? { deviceId: { exact: selectedAudio } } : true) : false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
        setPermError('Camera/mic access denied. Please allow permissions.');
      else if (err.name === 'NotFoundError')
        setPermError('No camera or microphone found.');
      else if (err.name === 'NotReadableError')
        setPermError('Camera or mic is already in use by another app.');
      else
        setPermError('Could not access camera/mic.');
    }
  }, [camOn, micOn, selectedAudio, selectedVideo]);

  useEffect(() => {
    startPreview();
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, []); // eslint-disable-line

  useEffect(() => {
    startPreview();
  }, [camOn, micOn]); // eslint-disable-line

  const handleJoin = () => {
    setJoining(true);
    streamRef.current?.getTracks().forEach(t => t.stop());
    initSocket();
    navigate(`/room/${roomId}`);
  };

  return (
    <div className="h-screen bg-[#1a1a1a] text-white font-sans flex flex-col overflow-hidden">

      {/* Top bar — minimal */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#4f46e5] rounded-lg flex items-center justify-center">
            <Video className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-white text-sm">SyncSpace</span>
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1.5 text-sm text-white/60 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
      </div>

      {/* Main — full height split */}
      <div className="flex-1 flex flex-col lg:flex-row">

        {/* Left — video preview (full area) */}
        <div className="flex-1 relative flex items-center justify-center bg-[#111] lg:rounded-none">

          {/* Video or avatar */}
          {camOn && !permError ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1]"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 w-full h-full">
              <div
                className="w-28 h-28 rounded-full flex items-center justify-center text-5xl font-bold text-white shadow-2xl"
                style={{ background: avatarColor.bg }}
              >
                {avatarInitial}
              </div>
              <span className="text-base text-white/70">{user?.name}</span>
              {permError && (
                <div className="mt-2 bg-red-900/30 border border-red-500/30 rounded-xl px-4 py-2.5 text-sm text-red-300 max-w-xs text-center">
                  ⚠️ {permError}
                </div>
              )}
            </div>
          )}

          {/* User name — top left of video */}
          <div className="absolute top-16 left-5">
            <span className="text-sm font-semibold text-white drop-shadow-lg">{user?.name}</span>
          </div>

          {/* Control buttons — bottom center of video */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4">
            <button
              onClick={() => setMicOn(v => !v)}
              title={micOn ? 'Mute' : 'Unmute'}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 border-2
                ${micOn
                  ? 'bg-white/90 text-[#202124] border-white hover:bg-white'
                  : 'bg-red-600 text-white border-red-500 hover:bg-red-700'
                }`}
            >
              {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>

            <button
              onClick={() => setCamOn(v => !v)}
              title={camOn ? 'Turn off camera' : 'Turn on camera'}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 border-2
                ${camOn
                  ? 'bg-white/90 text-[#202124] border-white hover:bg-white'
                  : 'bg-red-600 text-white border-red-500 hover:bg-red-700'
                }`}
            >
              {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Right — join panel */}
        <div className="lg:w-80 flex flex-col items-center justify-center px-8 py-10 gap-6 bg-[#202124] border-t lg:border-t-0 lg:border-l border-white/10">

          {/* Room info */}
          <div className="text-center">
            <p className="text-xs text-white/40 uppercase tracking-widest mb-1">Ready to join</p>
            <h1 className="text-xl font-bold text-white">{roomName || 'Meeting'}</h1>
          </div>

          {/* User card */}
          <div className="flex items-center gap-3 w-full bg-white/5 rounded-2xl px-4 py-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ background: avatarColor.bg }}
            >
              {avatarInitial}
            </div>
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider">Joining as</p>
              <p className="text-sm font-semibold text-white">{user?.name}</p>
            </div>
          </div>

          {/* Mic / Cam status pills */}
          <div className="flex items-center gap-2 w-full justify-center">
            <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
              ${micOn ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
              {micOn ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
              {micOn ? 'Mic on' : 'Mic off'}
            </span>
            <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
              ${camOn ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
              {camOn ? <Video className="w-3 h-3" /> : <VideoOff className="w-3 h-3" />}
              {camOn ? 'Camera on' : 'Camera off'}
            </span>
          </div>

          {/* Join button */}
          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full py-3 rounded-xl bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-60 text-white font-semibold text-sm transition-all shadow-lg hover:shadow-[#4f46e5]/30 flex items-center justify-center gap-2"
          >
            {joining
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Joining…</>
              : 'Join now'
            }
          </button>
        </div>
      </div>
    </div>
  );
}
