import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Video, VideoOff, Loader2, MoreVertical, MoreHorizontal } from 'lucide-react';
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
  const [camOn, setCamOn] = useState(false);
  const [permError, setPermError] = useState('');
  const [roomName, setRoomName] = useState('');
  const [joining, setJoining] = useState(false);
  const [camPermAsked, setCamPermAsked] = useState(false);

  const avatarColor = getParticipantColor(user?._id || user?.name || '');
  const avatarInitial = (user?.name || '?').charAt(0).toUpperCase();

  useEffect(() => {
    api.get(`/rooms/${roomId}`)
      .then(r => setRoomName(r.data?.data?.room?.name || 'Meeting'))
      .catch(() => {});
  }, [roomId]);

  const startStream = useCallback(async (withVideo) => {
    setPermError('');
    streamRef.current?.getTracks().forEach(t => t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: withVideo ? (selectedVideo ? { deviceId: { exact: selectedVideo } } : true) : false,
        audio: micOn ? (selectedAudio ? { deviceId: { exact: selectedAudio } } : true) : true,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setCamOn(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
        setPermError('Camera access denied.');
      else if (err.name === 'NotFoundError')
        setPermError('No camera found.');
      else
        setPermError('Could not access camera.');
    }
  }, [micOn, selectedAudio, selectedVideo]);

  useEffect(() => {
    startStream(false);
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, []); // eslint-disable-line

  const handleAllowCamera = async () => {
    setCamPermAsked(true);
    setCamOn(true);
    await startStream(true);
  };

  const handleToggleCam = async () => {
    const next = !camOn;
    setCamOn(next);
    await startStream(next);
  };

  const handleToggleMic = () => {
    setMicOn(v => !v);
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(t => { t.enabled = !micOn; });
    }
  };

  const handleJoin = () => {
    setJoining(true);
    streamRef.current?.getTracks().forEach(t => t.stop());
    initSocket();
    navigate(`/room/${roomId}`);
  };

  return (
    <div className="h-screen bg-[#1c1c1c] text-white font-sans flex flex-col overflow-hidden select-none">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4 z-10">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
            style={{ background: avatarColor.bg }}
          >
            {avatarInitial}
          </div>
          <span className="font-semibold text-white text-base">{user?.name}</span>
          {roomName && (
            <span className="text-white/30 text-sm">· {roomName}</span>
          )}
        </div>
        <button className="w-9 h-9 rounded-full flex items-center justify-center text-white/60 hover:bg-white/10 transition-colors">
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      {/* Center content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 relative">

        {/* Camera preview OR dark placeholder */}
        {camOn && !permError ? (
          <div className="relative w-full max-w-2xl aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1]"
            />
            <div className="absolute top-3 left-3">
              <span className="text-sm font-semibold text-white drop-shadow-lg">{user?.name}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-6 w-full max-w-2xl aspect-video rounded-2xl bg-[#111] shadow-2xl">
            {!camPermAsked ? (
              <>
                <p className="text-xl font-medium text-white text-center px-6">
                  Do you want people to see you in the meeting?
                </p>
                <button
                  onClick={handleAllowCamera}
                  className="px-7 py-2.5 rounded-full bg-[#1a73e8] hover:bg-[#1558c0] text-white font-medium text-sm transition-colors shadow-lg"
                >
                  Allow camera
                </button>
              </>
            ) : (
              <>
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold text-white shadow-xl"
                  style={{ background: avatarColor.bg }}
                >
                  {avatarInitial}
                </div>
                <span className="text-sm text-white/50">{user?.name}</span>
                {permError && (
                  <p className="text-xs text-red-400">{permError}</p>
                )}
              </>
            )}
          </div>
        )}

        {/* Join button — below preview */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            onClick={handleJoin}
            disabled={joining}
            className="px-10 py-3 rounded-full bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-60 text-white font-semibold text-sm transition-all shadow-xl hover:shadow-[#4f46e5]/40 flex items-center gap-2"
          >
            {joining
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Joining…</>
              : 'Join now'
            }
          </button>
          <p className="text-xs text-white/30">
            {roomName ? `Joining "${roomName}"` : 'Preparing to join…'}
          </p>
        </div>
      </div>

      {/* Bottom controls bar */}
      <div className="flex items-center justify-between px-6 pb-8 pt-2">

        {/* Left — more options */}
        <button className="w-10 h-10 rounded-full bg-[#2e2e2e] hover:bg-[#3a3a3a] flex items-center justify-center transition-colors">
          <MoreHorizontal className="w-4 h-4 text-white/70" />
        </button>

        {/* Center — mic + cam */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleToggleMic}
            title={micOn ? 'Mute microphone' : 'Unmute microphone'}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200
              ${micOn
                ? 'bg-[#e8eaed] text-[#202124] hover:bg-white'
                : 'bg-[#ea4335] text-white hover:bg-[#d33828]'
              }`}
          >
            {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          <button
            onClick={handleToggleCam}
            title={camOn ? 'Turn off camera' : 'Turn on camera'}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 relative
              ${camOn
                ? 'bg-[#e8eaed] text-[#202124] hover:bg-white'
                : 'bg-[#ea4335] text-white hover:bg-[#d33828]'
              }`}
          >
            {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            {!camPermAsked && !camOn && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-400 flex items-center justify-center text-[9px] font-bold text-black">!</span>
            )}
          </button>

          <button
            onClick={() => navigate('/dashboard')}
            title="Leave"
            className="w-14 h-14 rounded-full bg-[#2e2e2e] hover:bg-[#3a3a3a] flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
            </svg>
          </button>
        </div>

        {/* Right — spacer */}
        <div className="w-10" />
      </div>
    </div>
  );
}
