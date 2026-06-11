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
    try {
      const source = audioCtx.createMediaStreamSource(streamRef.current);
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
  }, [micOn]);

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
        setPermError('Camera/mic access denied. Allow permissions and refresh.');
      else if (err.name === 'NotFoundError')
        setPermError('No camera or microphone found.');
      else if (err.name === 'NotReadableError')
        setPermError('Camera or mic is already in use by another app.');
      else
        setPermError('Could not access camera/mic. Check your device settings.');
    }
  }, [camOn, micOn, selectedAudio, selectedVideo, loadDevices]);

  useEffect(() => {
    startPreview();
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, []); // eslint-disable-line

  useEffect(() => {
    if (selectedAudio || selectedVideo) startPreview();
  }, [selectedAudio, selectedVideo, camOn, micOn]); // eslint-disable-line

  const handleJoin = () => {
    setJoining(true);
    if (selectedAudio) localStorage.setItem('syncspace_mic_id', selectedAudio);
    if (selectedVideo) localStorage.setItem('syncspace_cam_id', selectedVideo);
    streamRef.current?.getTracks().forEach(t => t.stop());
    initSocket();
    navigate(`/room/${roomId}`);
  };

  const volBars = Math.min(5, Math.floor(volume / 8));

  return (
    <div className="min-h-screen bg-[#202124] text-white font-sans flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-3 border-b border-[#3c4043]">
        <button onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1.5 text-sm text-[#9aa0a6] hover:text-white transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#4f46e5] rounded-lg flex items-center justify-center">
            <Video className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-semibold text-white">{roomName || 'Meeting'}</span>
        </div>
        <div className="w-16" />
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-3xl">
          <h1 className="text-xl font-bold text-white text-center mb-2">Ready to join?</h1>
          <p className="text-sm text-[#9aa0a6] text-center mb-8">Set up your audio and video before entering</p>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Camera preview */}
            <div className="flex-1 flex flex-col gap-3">
              <div className="relative bg-[#303134] rounded-2xl overflow-hidden aspect-video border border-[#5f6368]/30">
                {camOn && !permError ? (
                  <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-xl"
                      style={{ background: avatarColor.bg }}>
                      {user?.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <span className="text-sm text-[#9aa0a6]">{user?.name}</span>
                  </div>
                )}
                {/* Controls overlay */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
                  <button onClick={() => setMicOn(v => !v)}
                    className={`w-11 h-11 rounded-full flex items-center justify-center shadow-xl transition-all
                      ${micOn ? 'bg-[#3c4043]/80 text-white hover:bg-[#3c4043]' : 'bg-red-600 text-white hover:bg-red-700'}`}>
                    {micOn ? <Mic className="w-4.5 h-4.5" /> : <MicOff className="w-4.5 h-4.5" />}
                  </button>
                  <button onClick={() => setCamOn(v => !v)}
                    className={`w-11 h-11 rounded-full flex items-center justify-center shadow-xl transition-all
                      ${camOn ? 'bg-[#3c4043]/80 text-white hover:bg-[#3c4043]' : 'bg-red-600 text-white hover:bg-red-700'}`}>
                    {camOn ? <Video className="w-4.5 h-4.5" /> : <VideoOff className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>
              {permError && (
                <div className="bg-red-900/20 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300">
                  ⚠️ {permError}
                </div>
              )}
            </div>

            {/* Settings panel */}
            <div className="lg:w-64 flex flex-col gap-3">
              {/* User card */}
              <div className="bg-[#303134] border border-[#5f6368]/30 rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ background: avatarColor.bg }}>
                  {user?.name?.charAt(0).toUpperCase() || '?'}
                </div>
                <div>
                  <p className="text-[10px] text-[#9aa0a6] uppercase tracking-widest">Joining as</p>
                  <p className="text-sm font-semibold text-white">{user?.name}</p>
                </div>
              </div>

              {/* Device pickers */}
              <div className="bg-[#303134] border border-[#5f6368]/30 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-[#9aa0a6] uppercase tracking-widest">Devices</p>
                  {micOn && (
                    <div className="flex items-end gap-0.5 h-4">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="w-1 rounded-full transition-all duration-75"
                          style={{ height: i <= volBars ? `${Math.min(16, 4 + i * 3)}px` : '4px', background: i <= volBars ? '#4f46e5' : '#3c4043' }} />
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-[11px] text-[#9aa0a6] mb-1 flex items-center gap-1.5"><Mic className="w-3 h-3" /> Microphone</label>
                  <div className="relative">
                    <select value={selectedAudio} onChange={e => setSelectedAudio(e.target.value)}
                      className="w-full bg-[#202124] border border-[#5f6368] text-white text-xs rounded-lg px-3 py-2 pr-7 appearance-none focus:outline-none focus:border-[#8ab4f8] transition-colors">
                      {audioDevices.length === 0 && <option value="">No microphone found</option>}
                      {audioDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0, 5)}`}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#9aa0a6] pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-[#9aa0a6] mb-1 flex items-center gap-1.5"><Video className="w-3 h-3" /> Camera</label>
                  <div className="relative">
                    <select value={selectedVideo} onChange={e => setSelectedVideo(e.target.value)}
                      className="w-full bg-[#202124] border border-[#5f6368] text-white text-xs rounded-lg px-3 py-2 pr-7 appearance-none focus:outline-none focus:border-[#8ab4f8] transition-colors">
                      {videoDevices.length === 0 && <option value="">No camera found</option>}
                      {videoDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 5)}`}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#9aa0a6] pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Status row */}
              <div className="bg-[#303134] border border-[#5f6368]/30 rounded-xl p-3 flex items-center justify-around">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${micOn ? 'bg-green-500/15' : 'bg-red-500/15'}`}>
                    {micOn ? <Mic className="w-3.5 h-3.5 text-green-400" /> : <MicOff className="w-3.5 h-3.5 text-red-400" />}
                  </div>
                  <span className="text-[10px] text-[#9aa0a6]">{micOn ? 'On' : 'Off'}</span>
                </div>
                <div className="w-px h-8 bg-[#3c4043]" />
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${camOn ? 'bg-green-500/15' : 'bg-red-500/15'}`}>
                    {camOn ? <Video className="w-3.5 h-3.5 text-green-400" /> : <VideoOff className="w-3.5 h-3.5 text-red-400" />}
                  </div>
                  <span className="text-[10px] text-[#9aa0a6]">{camOn ? 'On' : 'Off'}</span>
                </div>
              </div>

              {/* Join button */}
              <button onClick={handleJoin} disabled={joining}
                className="w-full py-3 rounded-xl bg-[#4f46e5] hover:bg-[#4338ca] disabled:opacity-60 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2">
                {joining ? <><Loader2 className="w-4 h-4 animate-spin" /> Joining…</> : 'Join now'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
