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
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const animRef = useRef(null);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [joining, setJoining] = useState(false);

  // 'unknown' | 'prompt' | 'granted' | 'denied'
  const [camPerm, setCamPerm] = useState('unknown');
  const [camError, setCamError] = useState('');

  // Audio level (0–255 average)
  const [audioLevel, setAudioLevel] = useState(0);

  const avatarColor = getParticipantColor(user?._id || user?.name || '');
  const avatarInitial = (user?.name || '?').charAt(0).toUpperCase();

  // ── Fetch room name ──────────────────────────────────────────────────────────
  useEffect(() => {
    api.get(`/rooms/${roomId}`)
      .then(r => setRoomName(r.data?.data?.room?.name || 'Meeting'))
      .catch(() => {});
  }, [roomId]);

  // ── Check camera permission on mount ────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      try {
        const result = await navigator.permissions.query({ name: 'camera' });
        setCamPerm(result.state); // 'granted' | 'prompt' | 'denied'
        result.onchange = () => setCamPerm(result.state);
      } catch {
        setCamPerm('prompt'); // fallback if permissions API not supported
      }
    };
    check();
  }, []);

  // ── Auto-start camera if already granted ─────────────────────────────────────
  useEffect(() => {
    if (camPerm === 'granted') {
      startCamera();
    }
  }, [camPerm]); // eslint-disable-line

  // ── Audio analyser — runs whenever mic is on ─────────────────────────────────
  const startAudioAnalyser = useCallback((stream) => {
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch {}
    }
    if (animRef.current) cancelAnimationFrame(animRef.current);

    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setAudioLevel(avg);
        animRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {}
  }, []);

  const stopAudioAnalyser = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setAudioLevel(0);
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
    }
  }, []);

  // ── Start camera stream ──────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCamError('');
    try {
      const existing = streamRef.current;
      const audioTrack = existing?.getAudioTracks()[0];

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCamOn(true);
      setCamPerm('granted');

      // Start audio visualiser
      if (micOn) startAudioAnalyser(stream);
    } catch (err) {
      setCamOn(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCamPerm('denied');
        setCamError('Camera access blocked. Enable it from your browser settings (🔒 icon in address bar).');
      } else if (err.name === 'NotFoundError') {
        setCamError('No camera found on this device.');
      } else {
        setCamError('Could not access camera.');
      }
    }
  }, [micOn, startAudioAnalyser]);

  // ── Start mic-only stream (no camera) ───────────────────────────────────────
  const startMicOnly = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      streamRef.current = stream;
      if (micOn) startAudioAnalyser(stream);
    } catch {}
  }, [micOn, startAudioAnalyser]);

  useEffect(() => {
    startMicOnly();
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      stopAudioAnalyser();
    };
  }, []); // eslint-disable-line

  // ── Toggle mic ───────────────────────────────────────────────────────────────
  const handleToggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(t => { t.enabled = next; });
    }
    if (next && streamRef.current) {
      startAudioAnalyser(streamRef.current);
    } else {
      stopAudioAnalyser();
    }
  };

  // ── Toggle camera ────────────────────────────────────────────────────────────
  const handleToggleCam = async () => {
    if (camOn) {
      streamRef.current?.getVideoTracks().forEach(t => t.stop());
      setCamOn(false);
      if (videoRef.current) videoRef.current.srcObject = null;
    } else {
      await startCamera();
    }
  };

  const handleJoin = () => {
    setJoining(true);
    streamRef.current?.getTracks().forEach(t => t.stop());
    stopAudioAnalyser();
    initSocket();
    navigate(`/room/${roomId}`);
  };

  // ── Audio level bars (5 bars) ─────────────────────────────────────────────
  const NUM_BARS = 5;
  const volBars = micOn ? Math.min(NUM_BARS, Math.round((audioLevel / 255) * NUM_BARS * 2)) : 0;
  const barHeights = [6, 10, 14, 10, 6]; // shape: short-tall-short

  return (
    <div className="h-screen bg-[#1c1c1c] text-white font-sans flex flex-col overflow-hidden select-none">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4 z-10 flex-shrink-0">
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

      {/* Center — preview area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">

        {/* Video box */}
        <div className="relative w-full max-w-2xl aspect-video rounded-2xl overflow-hidden bg-[#111] shadow-2xl">

          {/* Live camera feed */}
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${camOn ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          />

          {/* Camera off overlay */}
          {!camOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6">
              {camPerm === 'denied' ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                    <VideoOff className="w-7 h-7 text-white/60" />
                  </div>
                  <div className="text-center">
                    <p className="text-base font-medium text-white mb-1">Camera is blocked</p>
                    <p className="text-sm text-white/50 max-w-xs">{camError || 'Click the 🔒 lock icon in your browser\'s address bar to allow camera access.'}</p>
                  </div>
                </>
              ) : camPerm === 'prompt' || camPerm === 'unknown' ? (
                <>
                  <p className="text-lg font-medium text-white text-center">
                    Do you want people to see you in the meeting?
                  </p>
                  <button
                    onClick={startCamera}
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
                </>
              )}
            </div>
          )}

          {/* Name badge — top left inside video */}
          <div className="absolute top-3 left-3">
            <span className="text-sm font-semibold text-white drop-shadow-lg">{user?.name}</span>
          </div>

          {/* ── BOTTOM OVERLAY: visualizer (left) + controls (center) ── */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-10
            bg-gradient-to-t from-black/70 via-black/20 to-transparent
            flex items-end justify-between">

            {/* Audio frequency visualizer — bottom left */}
            <div className="flex items-end gap-[3px] h-6">
              {barHeights.map((maxH, i) => {
                const active = micOn && i < volBars;
                return (
                  <div
                    key={i}
                    className="w-[5px] rounded-full transition-all duration-75"
                    style={{
                      height: active ? `${maxH}px` : '4px',
                      background: active ? '#ffffff' : 'rgba(255,255,255,0.25)',
                    }}
                  />
                );
              })}
            </div>

            {/* Mic + Camera buttons — bottom center */}
            <div className="flex items-center gap-3 absolute left-1/2 -translate-x-1/2 bottom-4">
              <button
                onClick={handleToggleMic}
                title={micOn ? 'Mute microphone' : 'Unmute microphone'}
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all duration-200
                  ${micOn
                    ? 'bg-white/90 text-[#202124] hover:bg-white'
                    : 'bg-[#ea4335] text-white hover:bg-[#d33828]'
                  }`}
              >
                {micOn ? <Mic className="w-4.5 h-4.5" /> : <MicOff className="w-4.5 h-4.5" />}
              </button>

              <button
                onClick={handleToggleCam}
                title={camOn ? 'Turn off camera' : 'Turn on camera'}
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 relative
                  ${camOn
                    ? 'bg-white/90 text-[#202124] hover:bg-white'
                    : camPerm === 'denied'
                      ? 'bg-[#5f6368] text-white/60 cursor-not-allowed'
                      : 'bg-[#ea4335] text-white hover:bg-[#d33828]'
                  }`}
              >
                {camOn ? <Video className="w-4.5 h-4.5" /> : <VideoOff className="w-4.5 h-4.5" />}
                {!camOn && camPerm !== 'denied' && camPerm !== 'granted' && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-400 flex items-center justify-center text-[9px] font-bold text-black">!</span>
                )}
              </button>
            </div>

            {/* Spacer right */}
            <div className="w-16" />
          </div>
        </div>

        {/* Join button */}
        <div className="mt-7 flex flex-col items-center gap-2">
          <button
            onClick={handleJoin}
            disabled={joining}
            className="px-10 py-3 rounded-full bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-60 text-white font-semibold text-sm transition-all shadow-xl hover:shadow-[#4f46e5]/30 flex items-center gap-2"
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

      {/* Bottom bar — leave + more options only */}
      <div className="flex items-center justify-between px-6 pb-6 pt-2 flex-shrink-0">
        <button className="w-10 h-10 rounded-full bg-[#2e2e2e] hover:bg-[#3a3a3a] flex items-center justify-center transition-colors">
          <MoreHorizontal className="w-4 h-4 text-white/70" />
        </button>

        <button
          onClick={() => navigate('/dashboard')}
          title="Leave"
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#2e2e2e] hover:bg-[#3a3a3a] text-white/70 hover:text-white text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
          </svg>
          Back
        </button>

        <div className="w-10" />
      </div>
    </div>
  );
}
