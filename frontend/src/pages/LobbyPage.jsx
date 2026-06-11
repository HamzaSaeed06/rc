import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Video, VideoOff, ChevronDown, Loader2, ArrowLeft } from 'lucide-react';
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

  const [audioDevices, setAudioDevices] = useState([]);
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedAudio, setSelectedAudio] = useState(() => localStorage.getItem('syncspace_mic_id') || '');
  const [selectedVideo, setSelectedVideo] = useState(() => localStorage.getItem('syncspace_cam_id') || '');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [permError, setPermError] = useState('');
  const [roomName, setRoomName] = useState('');
  const [joining, setJoining] = useState(false);
  const [volume, setVolume] = useState(0);

  const avatarColor = getParticipantColor(user?._id || user?.name || '');

  // Audio analyser
  useEffect(() => {
    if (!micOn || !streamRef.current) { setVolume(0); return; }
    let animId;
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    let source;
    try {
      source = audioCtx.createMediaStreamSource(streamRef.current);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        setVolume(sum / data.length);
        animId = requestAnimationFrame(tick);
      };
      tick();
    } catch { }
    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (audioCtx.state !== 'closed') audioCtx.close();
    };
  }, [micOn, streamRef.current]);

  // Fetch room name
  useEffect(() => {
    api.get(`/rooms/${roomId}`)
      .then(r => setRoomName(r.data?.data?.room?.name || 'Meeting'))
      .catch(() => { });
  }, [roomId]);

  const loadDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
      setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
      if (!selectedAudio) {
        const def = devices.find(d => d.kind === 'audioinput');
        if (def) setSelectedAudio(def.deviceId);
      }
      if (!selectedVideo) {
        const def = devices.find(d => d.kind === 'videoinput');
        if (def) setSelectedVideo(def.deviceId);
      }
    } catch { }
  }, [selectedAudio, selectedVideo]);

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
      await loadDevices();
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
        setPermError('Camera/microphone access was denied. Please allow permissions in your browser settings and refresh.');
      else if (err.name === 'NotFoundError')
        setPermError('No camera or microphone found. Please connect a device and try again.');
      else if (err.name === 'NotReadableError')
        setPermError('Camera or microphone is in use by another app. Please close it and try again.');
      else
        setPermError('Could not access camera/microphone. Please check your device settings.');
    }
  }, [camOn, micOn, selectedAudio, selectedVideo, loadDevices]);

  useEffect(() => {
    startPreview();
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  useEffect(() => {
    if (selectedAudio || selectedVideo) startPreview();
  }, [selectedAudio, selectedVideo, camOn, micOn]);

  const handleJoin = async () => {
    setJoining(true);
    if (selectedAudio) localStorage.setItem('syncspace_mic_id', selectedAudio);
    if (selectedVideo) localStorage.setItem('syncspace_cam_id', selectedVideo);
    streamRef.current?.getTracks().forEach(t => t.stop());
    initSocket();
    navigate(`/room/${roomId}`);
  };

  const volBars = Math.min(5, Math.floor(volume / 8));

  return (
    <div className="min-h-screen bg-[#0e0e16] flex flex-col items-center justify-center p-4">

      {/* Header */}
      <div className="w-full max-w-4xl mb-8">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-4">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to dashboard
        </button>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">{roomName || 'Meeting'}</h1>
          <p className="text-sm text-gray-500 mt-1">Set up your audio and video before joining</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 w-full max-w-4xl">

        {/* Camera Preview */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="relative bg-[#141420] rounded-3xl overflow-hidden aspect-video shadow-2xl border border-white/8">
            {camOn && !permError ? (
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center flex-col gap-3 bg-[#141420]">
                <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-xl"
                  style={{ background: avatarColor.bg }}>
                  {user?.name?.charAt(0).toUpperCase() || '?'}
                </div>
                <span className="text-sm text-gray-400">{user?.name}</span>
              </div>
            )}

            {/* Camera off overlay */}
            {!camOn && !permError && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600/90 backdrop-blur-sm px-2.5 py-1 rounded-full">
                <VideoOff className="w-3 h-3 text-white" />
                <span className="text-[10px] text-white font-semibold">Camera off</span>
              </div>
            )}

            {/* Toggle buttons overlay */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
              <button onClick={() => setMicOn(v => !v)}
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all border border-white/10 backdrop-blur-sm
                  ${micOn ? 'bg-black/40 text-white hover:bg-black/60' : 'bg-red-600 text-white hover:bg-red-700'}`}
                title={micOn ? 'Mute mic' : 'Unmute mic'}>
                {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>
              <button onClick={() => setCamOn(v => !v)}
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all border border-white/10 backdrop-blur-sm
                  ${camOn ? 'bg-black/40 text-white hover:bg-black/60' : 'bg-red-600 text-white hover:bg-red-700'}`}
                title={camOn ? 'Stop camera' : 'Start camera'}>
                {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {permError && (
            <div className="bg-red-900/30 border border-red-500/30 rounded-2xl px-4 py-3 text-sm text-red-300">
              ⚠️ {permError}
            </div>
          )}
        </div>

        {/* Settings + Join panel */}
        <div className="lg:w-72 flex flex-col gap-4">

          {/* User info card */}
          <div className="bg-[#141420] border border-white/8 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 shadow"
              style={{ background: avatarColor.bg }}>
              {user?.name?.charAt(0).toUpperCase() || '?'}
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Joining as</p>
              <p className="text-sm font-semibold text-white">{user?.name}</p>
            </div>
          </div>

          {/* Device Selection */}
          <div className="bg-[#141420] border border-white/8 rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Devices</p>
              {micOn && (
                <div className="flex items-end gap-0.5 h-4">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="w-1 rounded-full transition-all duration-75"
                      style={{
                        height: i <= volBars ? `${Math.min(16, 4 + i * 3)}px` : '4px',
                        background: i <= volBars ? '#6366f1' : 'rgba(255,255,255,0.15)',
                      }} />
                  ))}
                </div>
              )}
            </div>

            {/* Microphone */}
            <div>
              <label className="text-xs text-gray-500 mb-1.5 flex items-center gap-1.5 font-medium">
                <Mic className="w-3 h-3" /> Microphone
              </label>
              <div className="relative">
                <select value={selectedAudio} onChange={e => setSelectedAudio(e.target.value)}
                  className="w-full bg-[#1a1a26] border border-white/10 text-white text-xs rounded-xl px-3 py-2.5 pr-8 appearance-none focus:outline-none focus:border-indigo-500/50 transition-all">
                  {audioDevices.length === 0 && <option value="">No microphone found</option>}
                  {audioDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 6)}`}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
              </div>
            </div>

            {/* Camera */}
            <div>
              <label className="text-xs text-gray-500 mb-1.5 flex items-center gap-1.5 font-medium">
                <Video className="w-3 h-3" /> Camera
              </label>
              <div className="relative">
                <select value={selectedVideo} onChange={e => setSelectedVideo(e.target.value)}
                  className="w-full bg-[#1a1a26] border border-white/10 text-white text-xs rounded-xl px-3 py-2.5 pr-8 appearance-none focus:outline-none focus:border-indigo-500/50 transition-all">
                  {videoDevices.length === 0 && <option value="">No camera found</option>}
                  {videoDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 6)}`}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Status indicators */}
          <div className="bg-[#141420] border border-white/8 rounded-2xl p-4 flex items-center justify-around">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${micOn ? 'bg-green-500/15' : 'bg-red-500/15'}`}>
                {micOn ? <Mic className="w-4 h-4 text-green-400" /> : <MicOff className="w-4 h-4 text-red-400" />}
              </div>
              <span className="text-[10px] text-gray-500 font-medium">{micOn ? 'Mic on' : 'Mic off'}</span>
            </div>
            <div className="w-px h-8 bg-white/8" />
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${camOn ? 'bg-green-500/15' : 'bg-red-500/15'}`}>
                {camOn ? <Video className="w-4 h-4 text-green-400" /> : <VideoOff className="w-4 h-4 text-red-400" />}
              </div>
              <span className="text-[10px] text-gray-500 font-medium">{camOn ? 'Camera on' : 'Camera off'}</span>
            </div>
          </div>

          {/* Join button */}
          <button onClick={handleJoin} disabled={joining}
            className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99]">
            {joining ? <><Loader2 className="w-4 h-4 animate-spin" /> Joining…</> : 'Join Meeting'}
          </button>
        </div>
      </div>
    </div>
  );
}
