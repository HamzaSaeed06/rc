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

  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef  = useRef(null);
  const analyserRef  = useRef(null);
  const animRef      = useRef(null);
  const canvasRef    = useRef(null);   // ← canvas for visualizer

  const [micOn,   setMicOn]   = useState(true);
  const [camOn,   setCamOn]   = useState(false);
  const [roomName, setRoomName] = useState('');
  const [joining,  setJoining]  = useState(false);
  const [camPerm,  setCamPerm]  = useState('unknown');
  const [camError, setCamError] = useState('');

  const avatarColor  = getParticipantColor(user?._id || user?.name || '');
  const avatarInitial = (user?.name || '?').charAt(0).toUpperCase();

  // ── Fetch room name ─────────────────────────────────────────────────────────
  useEffect(() => {
    api.get(`/rooms/${roomId}`)
      .then(r => setRoomName(r.data?.data?.room?.name || 'Meeting'))
      .catch(() => {});
  }, [roomId]);

  // ── Check camera permission ─────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      try {
        const result = await navigator.permissions.query({ name: 'camera' });
        setCamPerm(result.state);
        result.onchange = () => setCamPerm(result.state);
      } catch {
        setCamPerm('prompt');
      }
    };
    check();
  }, []);

  useEffect(() => {
    if (camPerm === 'granted') startCamera();
  }, [camPerm]); // eslint-disable-line

  // ── Pill (capsule) shape helper ──────────────────────────────────────────────
  const drawPill = (ctx, x, y, w, h) => {
    const r = w / 2;
    ctx.beginPath();
    ctx.arc(x + r, y + r,     r, Math.PI, 0);          // top semicircle
    ctx.lineTo(x + w, y + h - r);
    ctx.arc(x + r, y + h - r, r, 0,       Math.PI);    // bottom semicircle
    ctx.closePath();
    ctx.fill();
  };

  // ── Canvas visualizer: 3 white pill bars, sharp (DPR-aware), centered ────────
  const VIZ_CSS = 48;   // canvas CSS size (matches w-12 h-12 container inner)
  const BAR_W   = 6;
  const BAR_GAP = 5;

  const setupCanvas = (canvas) => {
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== VIZ_CSS * dpr) {
      canvas.width  = VIZ_CSS * dpr;
      canvas.height = VIZ_CSS * dpr;
      canvas.style.width  = VIZ_CSS + 'px';
      canvas.style.height = VIZ_CSS + 'px';
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    return ctx;
  };

  const drawVisualizer = useCallback((analyser, dataArray) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx     = setupCanvas(canvas);
    const W       = VIZ_CSS;
    const H       = VIZ_CSS;

    analyser.getByteFrequencyData(dataArray);
    ctx.clearRect(0, 0, W, H);

    const totalW  = 3 * BAR_W + 2 * BAR_GAP;
    const startX  = (W - totalW) / 2;
    const centerY = H / 2;
    const maxHalf = centerY - 6;

    // 3 distinct frequency bins: low / mid / high
    const bins    = dataArray.length;
    const indices = [
      Math.floor(bins * 0.05),
      Math.floor(bins * 0.25),
      Math.floor(bins * 0.55),
    ];

    for (let i = 0; i < 3; i++) {
      const val  = dataArray[indices[i]] / 255;
      const half = Math.max(BAR_W / 2 + 2, Math.round(val * maxHalf));
      const x    = startX + i * (BAR_W + BAR_GAP);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      drawPill(ctx, x, centerY - half, BAR_W, half * 2);
    }

    animRef.current = requestAnimationFrame(() => drawVisualizer(analyser, dataArray));
  }, []); // eslint-disable-line

  const drawSilence = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx    = setupCanvas(canvas);
    const W      = VIZ_CSS;
    const H      = VIZ_CSS;
    ctx.clearRect(0, 0, W, H);

    const totalW  = 3 * BAR_W + 2 * BAR_GAP;
    const startX  = (W - totalW) / 2;
    const centerY = H / 2;
    const minHalf = BAR_W / 2 + 2;   // smallest pill = just a circle

    for (let i = 0; i < 3; i++) {
      const x = startX + i * (BAR_W + BAR_GAP);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      drawPill(ctx, x, centerY - minHalf, BAR_W, minHalf * 2);
    }
  }, []); // eslint-disable-line

  // ── Start audio analyser ────────────────────────────────────────────────────
  const startAudioAnalyser = useCallback((stream) => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} }

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const source   = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize        = 64;   // 32 bins — fast & smooth
      analyser.smoothingTimeConstant = 0.5;  // responsive, not jittery
      analyserRef.current = analyser;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      drawVisualizer(analyser, dataArray);
    } catch {}
  }, [drawVisualizer]);

  const stopAudioAnalyser = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = null;
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} audioCtxRef.current = null; }
    drawSilence();
  }, [drawSilence]);

  // draw silence lines on mount
  useEffect(() => { drawSilence(); }, [drawSilence]);

  // ── Start camera ────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCamError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCamOn(true);
      setCamPerm('granted');
      if (micOn) startAudioAnalyser(stream);
    } catch (err) {
      setCamOn(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCamPerm('denied');
        setCamError('Camera blocked. Click 🔒 in address bar to allow.');
      } else if (err.name === 'NotFoundError') {
        setCamError('No camera found.');
      } else {
        setCamError('Could not access camera.');
      }
    }
  }, [micOn, startAudioAnalyser]);

  // ── Start mic-only ──────────────────────────────────────────────────────────
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

  // ── Toggle mic ──────────────────────────────────────────────────────────────
  const handleToggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = next; });
    if (next && streamRef.current) {
      startAudioAnalyser(streamRef.current);
    } else {
      stopAudioAnalyser();
    }
  };

  // ── Toggle camera ───────────────────────────────────────────────────────────
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

  return (
    <div className="h-screen bg-[#1c1c1c] text-white font-sans flex flex-col overflow-hidden select-none">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
            style={{ background: avatarColor.bg }}>
            {avatarInitial}
          </div>
          <span className="font-semibold text-white text-base">{user?.name}</span>
          {roomName && <span className="text-white/30 text-sm">· {roomName}</span>}
        </div>
        <button className="w-9 h-9 rounded-full flex items-center justify-center text-white/60 hover:bg-white/10 transition-colors">
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>

      {/* Center — video preview */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">

        <div className="relative w-full max-w-2xl aspect-video rounded-2xl overflow-hidden bg-[#111] shadow-2xl">

          {/* Video feed */}
          <video ref={videoRef} autoPlay muted playsInline
            className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${camOn ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          />

          {/* Camera-off overlay */}
          {!camOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6">
              {camPerm === 'denied' ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                    <VideoOff className="w-7 h-7 text-white/60" />
                  </div>
                  <div className="text-center">
                    <p className="text-base font-medium text-white mb-1">Camera is blocked</p>
                    <p className="text-sm text-white/50 max-w-xs">{camError}</p>
                  </div>
                </>
              ) : camPerm === 'prompt' || camPerm === 'unknown' ? (
                <>
                  <p className="text-lg font-medium text-white text-center">
                    Do you want people to see you in the meeting?
                  </p>
                  <button onClick={startCamera}
                    className="px-7 py-2.5 rounded-full bg-[#1a73e8] hover:bg-[#1558c0] text-white font-medium text-sm transition-colors shadow-lg">
                    Allow camera
                  </button>
                </>
              ) : (
                <>
                  <div className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold text-white shadow-xl"
                    style={{ background: avatarColor.bg }}>
                    {avatarInitial}
                  </div>
                  <span className="text-sm text-white/50">{user?.name}</span>
                </>
              )}
            </div>
          )}

          {/* Name badge */}
          <div className="absolute top-3 left-3">
            <span className="text-sm font-semibold text-white drop-shadow-lg">{user?.name}</span>
          </div>

          {/* ── Bottom overlay: visualizer (left) + controls (center) ── */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-12
            bg-gradient-to-t from-black/75 via-black/20 to-transparent
            flex items-end justify-between">

            {/* 🎵 Audio visualizer — dark pill circle, bottom-left */}
            <div className="w-12 h-12 rounded-full bg-[#1e2030] flex items-center justify-center shadow-lg flex-shrink-0 overflow-hidden">
              <canvas
                ref={canvasRef}
                width={48}
                height={48}
                style={{ width: '48px', height: '48px', display: 'block' }}
              />
            </div>

            {/* Mic + Camera — bottom center */}
            <div className="flex items-center gap-3 absolute left-1/2 -translate-x-1/2 bottom-4">
              <button onClick={handleToggleMic}
                title={micOn ? 'Mute' : 'Unmute'}
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all duration-150
                  ${micOn ? 'bg-white/90 text-[#202124] hover:bg-white' : 'bg-[#ea4335] text-white hover:bg-[#d33828]'}`}>
                {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>

              <button onClick={handleToggleCam}
                title={camOn ? 'Turn off camera' : 'Turn on camera'}
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all duration-150 relative
                  ${camOn
                    ? 'bg-white/90 text-[#202124] hover:bg-white'
                    : camPerm === 'denied'
                      ? 'bg-[#5f6368] text-white/60 cursor-not-allowed'
                      : 'bg-[#ea4335] text-white hover:bg-[#d33828]'
                  }`}>
                {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                {!camOn && camPerm !== 'denied' && camPerm !== 'granted' && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-400 flex items-center justify-center text-[9px] font-bold text-black">!</span>
                )}
              </button>
            </div>

            {/* Right spacer */}
            <div className="w-12" />
          </div>
        </div>

        {/* Join button */}
        <div className="mt-7 flex flex-col items-center gap-2">
          <button onClick={handleJoin} disabled={joining}
            className="px-10 py-3 rounded-full bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-60 text-white font-semibold text-sm transition-all shadow-xl hover:shadow-[#4f46e5]/30 flex items-center gap-2">
            {joining ? <><Loader2 className="w-4 h-4 animate-spin" /> Joining…</> : 'Join now'}
          </button>
          <p className="text-xs text-white/30">
            {roomName ? `Joining "${roomName}"` : 'Preparing to join…'}
          </p>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-6 pb-6 pt-2 flex-shrink-0">
        <button className="w-10 h-10 rounded-full bg-[#2e2e2e] hover:bg-[#3a3a3a] flex items-center justify-center transition-colors">
          <MoreHorizontal className="w-4 h-4 text-white/70" />
        </button>
        <button onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#2e2e2e] hover:bg-[#3a3a3a] text-white/70 hover:text-white text-sm transition-colors">
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
