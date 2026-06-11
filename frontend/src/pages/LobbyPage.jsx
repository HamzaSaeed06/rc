import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Mic, MicOff, Video, VideoOff, ChevronDown, Loader2,
} from 'lucide-react';
import { initSocket } from '@/services/socket';
import useAuthStore from '@/store/slices/authStore';
import api from '@/services/api';

// ─── Pre-Join Lobby (like Google Meet) ────────────────────────────────────────
// Shows camera/mic preview + device selector before entering the room.
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

    // Audio Analyzer Effect
    useEffect(() => {
        if (!micOn || !streamRef.current) {
            setVolume(0);
            return;
        }
        let animationId;
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        let source;
        try {
            source = audioCtx.createMediaStreamSource(streamRef.current);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const updateLevel = () => {
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
                setVolume(sum / dataArray.length);
                animationId = requestAnimationFrame(updateLevel);
            };
            updateLevel();
        } catch (e) {
            console.error("Audio analyzer error:", e);
        }

        return () => {
            if (animationId) cancelAnimationFrame(animationId);
            if (audioCtx.state !== 'closed') audioCtx.close();
        };
    }, [micOn, streamRef.current]);

    // Fetch room name
    useEffect(() => {
        api.get(`/rooms/${roomId}`)
            .then(r => setRoomName(r.data?.data?.room?.name || 'Meeting'))
            .catch(() => { });
    }, [roomId]);

    // Enumerate devices
    const loadDevices = useCallback(async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
            setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
            const defaultAudio = devices.find(d => d.kind === 'audioinput');
            const defaultVideo = devices.find(d => d.kind === 'videoinput');
            if (defaultAudio && !selectedAudio) setSelectedAudio(defaultAudio.deviceId);
            if (defaultVideo && !selectedVideo) setSelectedVideo(defaultVideo.deviceId);
        } catch {/* ignore */ }
    }, [selectedAudio, selectedVideo]);

    // Start preview stream with selected devices
    const startPreview = useCallback(async () => {
        setPermError('');
        // Stop any existing stream
        streamRef.current?.getTracks().forEach(t => t.stop());

        try {
            const constraints = {
                video: camOn ? (selectedVideo ? { deviceId: { exact: selectedVideo } } : true) : false,
                audio: micOn ? (selectedAudio ? { deviceId: { exact: selectedAudio } } : true) : false,
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            if (videoRef.current) videoRef.current.srcObject = stream;
            // Enumerate after getting permission (labels become available)
            await loadDevices();
        } catch (err) {
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setPermError('Camera/microphone access was denied. Please allow permissions in your browser settings and refresh this page.');
            } else if (err.name === 'NotFoundError') {
                setPermError('No camera or microphone found. Please connect a device and try again.');
            } else if (err.name === 'NotReadableError') {
                setPermError('Camera or microphone is in use by another application. Please close it and try again.');
            } else {
                setPermError('Could not access camera/microphone. Please check your device settings.');
            }
        }
    }, [camOn, micOn, selectedAudio, selectedVideo, loadDevices]);

    // Initial permission request
    useEffect(() => {
        startPreview();
        return () => streamRef.current?.getTracks().forEach(t => t.stop());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Re-start preview when device selection changes
    useEffect(() => {
        if (selectedAudio || selectedVideo) startPreview();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedAudio, selectedVideo, camOn, micOn]);

    const handleJoin = async () => {
        setJoining(true);

        // Save final selected devices so RoomPage useWebRTC uses them
        if (selectedAudio) localStorage.setItem('syncspace_mic_id', selectedAudio);
        if (selectedVideo) localStorage.setItem('syncspace_cam_id', selectedVideo);

        // Stop the lobby preview — RoomPage will request its own stream
        streamRef.current?.getTracks().forEach(t => t.stop());
        // Ensure socket is initialised before entering the room
        initSocket();
        navigate(`/room/${roomId}`);
    };

    return (
        <div className="min-h-screen bg-[#202124] flex flex-col items-center justify-center p-4">

            {/* Header */}
            <div className="mb-8 text-center">
                <h1 className="text-2xl font-bold text-white">{roomName}</h1>
                <p className="text-sm text-gray-500 mt-1">Check your audio and video before joining</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 w-full max-w-4xl">

                {/* Camera Preview */}
                <div className="flex-1 flex flex-col gap-4">
                    <div className="relative bg-[#111120] rounded-2xl overflow-hidden aspect-video shadow-2xl border border-white/8">
                        {camOn && !permError ? (
                            <video
                                ref={videoRef}
                                autoPlay
                                muted
                                playsInline
                                className="w-full h-full object-cover scale-x-[-1]"
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center flex-col gap-3">
                                <div className="w-20 h-20 rounded-full bg-white/8 flex items-center justify-center text-3xl font-bold text-white">
                                    {user?.name?.charAt(0).toUpperCase() || '?'}
                                </div>
                                <span className="text-sm text-gray-400">{user?.name}</span>
                            </div>
                        )}

                        {/* Quick toggle buttons overlay */}
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
                            <button
                                onClick={() => setMicOn(v => !v)}
                                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all border border-white/5
                  ${micOn ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-[#ea4335] text-white hover:bg-[#d93025]'}`}
                                title={micOn ? 'Mute mic' : 'Unmute mic'}
                            >
                                {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                            </button>
                            <button
                                onClick={() => setCamOn(v => !v)}
                                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all border border-white/5
                  ${camOn ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-[#ea4335] text-white hover:bg-[#d93025]'}`}
                                title={camOn ? 'Stop camera' : 'Start camera'}
                            >
                                {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {/* Permission error */}
                    {permError && (
                        <div className="bg-red-900/30 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
                            {permError}
                        </div>
                    )}
                </div>

                {/* Settings + Join panel */}
                <div className="lg:w-72 flex flex-col gap-4">

                    {/* User info */}
                    <div className="bg-[#111120] border border-white/8 rounded-2xl p-4">
                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Joining as</p>
                        <p className="text-sm font-semibold text-white">{user?.name}</p>
                    </div>

                    {/* Device Selection */}
                    <div className="bg-[#1e1f22] border border-[#3c4043] shadow-md rounded-2xl p-5 flex flex-col gap-4">
                        <p className="text-xs text-[#9aa0a6] uppercase tracking-widest font-semibold flex items-center justify-between">
                            Devices
                            {micOn && (
                                <div className="flex items-center gap-0.5">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="w-1.5 bg-[#8ab4f8] rounded-full transition-all duration-75"
                                            style={{ height: `${Math.max(4, volume * (i * 0.4))}px`, opacity: volume > 5 ? 1 : 0.3 }} />
                                    ))}
                                </div>
                            )}
                        </p>

                        {/* Microphone select */}
                        <div>
                            <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1">
                                <Mic className="w-3 h-3" /> Microphone
                            </label>
                            <div className="relative">
                                <select
                                    value={selectedAudio}
                                    onChange={e => setSelectedAudio(e.target.value)}
                                    className="w-full bg-[#1a1a2a] border border-white/10 text-white text-xs rounded-xl px-3 py-2.5 pr-8 appearance-none focus:outline-none focus:border-indigo-500/50"
                                >
                                    {audioDevices.length === 0 && <option value="">No microphone found</option>}
                                    {audioDevices.map(d => (
                                        <option key={d.deviceId} value={d.deviceId}>
                                            {d.label || `Microphone ${d.deviceId.slice(0, 6)}`}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
                            </div>
                        </div>

                        {/* Camera select */}
                        <div>
                            <label className="text-xs text-gray-400 mb-1 block flex items-center gap-1">
                                <Video className="w-3 h-3" /> Camera
                            </label>
                            <div className="relative">
                                <select
                                    value={selectedVideo}
                                    onChange={e => setSelectedVideo(e.target.value)}
                                    className="w-full bg-[#1a1a2a] border border-white/10 text-white text-xs rounded-xl px-3 py-2.5 pr-8 appearance-none focus:outline-none focus:border-indigo-500/50"
                                >
                                    {videoDevices.length === 0 && <option value="">No camera found</option>}
                                    {videoDevices.map(d => (
                                        <option key={d.deviceId} value={d.deviceId}>
                                            {d.label || `Camera ${d.deviceId.slice(0, 6)}`}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    {/* Join button */}
                    <button
                        onClick={handleJoin}
                        disabled={joining}
                        className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm transition-all duration-200 shadow-lg flex items-center justify-center gap-2"
                    >
                        {joining
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Joining…</>
                            : 'Join Meeting'}
                    </button>

                    <button
                        onClick={() => navigate('/dashboard')}
                        className="w-full py-2.5 rounded-2xl border border-white/10 hover:bg-white/5 text-gray-400 hover:text-white text-sm font-medium transition-colors"
                    >
                        Back
                    </button>
                </div>
            </div>
        </div>
    );
}
