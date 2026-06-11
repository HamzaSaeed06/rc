import { useRef, useState, useCallback, useEffect } from 'react';
import SimplePeer from 'simple-peer';
import { getSocket } from '@/services/socket';

// ─── ICE / TURN Config (reads from .env) ────────────────────────────────────
// Set VITE_TURN_URL, VITE_TURN_USERNAME, VITE_TURN_CREDENTIAL in .env for NAT traversal.
// Without TURN, video may fail on corporate/restricted networks.
function buildIceConfig() {
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  const turnUrl = import.meta.env.VITE_TURN_URL;
  if (turnUrl) {
    iceServers.push({
      urls: turnUrl,
      username: import.meta.env.VITE_TURN_USERNAME || '',
      credential: import.meta.env.VITE_TURN_CREDENTIAL || '',
    });
  }
  return { iceServers };
}

/**
 * useWebRTC — manages peer connections, media tracks, and media-toggle signalling.
 * @param {string} roomId - The current room identifier (used for socket events).
 */
const useWebRTC = (roomId) => {
  const [peers, setPeers] = useState({}); // { socketId: { peer, stream, user } }
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  // Restore last mic/cam state from localStorage so refresh keeps user preference
  const [audioEnabled, setAudioEnabled] = useState(
    () => localStorage.getItem('syncspace_audio_enabled') !== 'false'
  );
  const [videoEnabled, setVideoEnabled] = useState(
    () => localStorage.getItem('syncspace_video_enabled') !== 'false'
  );
  // Tracks remote peers' reported media states
  const [peerStates, setPeerStates] = useState({}); // { socketId: { audioEnabled, videoEnabled } }

  const peersRef = useRef({});
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  const audioRef = useRef(audioEnabled);
  const videoRef = useRef(videoEnabled);

  useEffect(() => { audioRef.current = audioEnabled; }, [audioEnabled]);
  useEffect(() => { videoRef.current = videoEnabled; }, [videoEnabled]);

  // ─── Local Stream ────────────────────────────────────────────────────────────

  const getLocalStream = useCallback(async (video = true, audio = true) => {
    try {
      const savedVideoId = localStorage.getItem('syncspace_cam_id');
      const savedAudioId = localStorage.getItem('syncspace_mic_id');

      const constraints = {
        video: video ? (savedVideoId ? { deviceId: { exact: savedVideoId } } : true) : false,
        audio: audio ? (savedAudioId ? { deviceId: { exact: savedAudioId } } : true) : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Apply saved mute/cam state immediately so refresh feels seamless
      const savedAudio = localStorage.getItem('syncspace_audio_enabled');
      const savedVideo = localStorage.getItem('syncspace_video_enabled');
      if (savedAudio === 'false') {
        stream.getAudioTracks().forEach(t => { t.enabled = false; });
        setAudioEnabled(false);
      }
      if (savedVideo === 'false') {
        stream.getVideoTracks().forEach(t => { t.enabled = false; });
        setVideoEnabled(false);
      }

      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error('[WebRTC] getUserMedia error:', err);
      // Fallback in case the saved device was unplugged
      if (err.name === 'OverconstrainedError' || err.name === 'NotFoundError') {
        localStorage.removeItem('syncspace_cam_id');
        localStorage.removeItem('syncspace_mic_id');
        console.warn('Saved devices not found, falling back to defaults.');
        const fbStream = await navigator.mediaDevices.getUserMedia({ video, audio });
        localStreamRef.current = fbStream;
        setLocalStream(fbStream);
        return fbStream;
      }
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('Camera/microphone access was denied. Please allow permissions in your browser and refresh.');
      }
      if (err.name === 'DevicesNotFoundError') {
        throw new Error('No camera or microphone found. Please connect a device and try again.');
      }
      if (err.name === 'NotReadableError') {
        throw new Error('Camera or microphone is already in use by another application.');
      }
      throw new Error('Could not access camera/microphone. Please check your device settings.');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Live Device Switching ───────────────────────────────────────────────────

  const switchDevice = useCallback(async (type, deviceId) => {
    if (!localStreamRef.current) return;
    try {
      const constraints = type === 'video'
        ? { video: { deviceId: { exact: deviceId } }, audio: false }
        : { video: false, audio: { deviceId: { exact: deviceId } } };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const newTrack = type === 'video' ? newStream.getVideoTracks()[0] : newStream.getAudioTracks()[0];
      const oldTrack = type === 'video' ? localStreamRef.current.getVideoTracks()[0] : localStreamRef.current.getAudioTracks()[0];

      if (oldTrack) {
        oldTrack.stop();
        localStreamRef.current.removeTrack(oldTrack);
      }
      localStreamRef.current.addTrack(newTrack);

      // Force state update to re-render local VideoTile
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

      // Replace track for all active peer connections seamlessly mid-call
      Object.values(peersRef.current).forEach(({ peer }) => {
        if (oldTrack && peer.streams[0]) {
          peer.replaceTrack(oldTrack, newTrack, peer.streams[0]);
        }
      });

      // Save user preference
      localStorage.setItem(`syncspace_${type === 'video' ? 'cam' : 'mic'}_id`, deviceId);

      // Keep mute state synced with the new track
      if (type === 'audio') newTrack.enabled = audioEnabled;
      if (type === 'video') newTrack.enabled = videoEnabled;

    } catch (err) {
      console.error('[WebRTC] switchDevice error:', err);
      throw new Error(`Could not switch ${type} device.`);
    }
  }, [audioEnabled, videoEnabled]);

  // ─── Peer Creation ───────────────────────────────────────────────────────────

  const createPeer = useCallback((targetSocketId, stream, initiator = true) => {
    const socket = getSocket();
    const peer = new SimplePeer({
      initiator,
      trickle: true,
      stream,
      config: buildIceConfig(),
    });

    peer.on('signal', (signal) => {
      if (signal.type === 'offer') {
        socket.emit('webrtc:offer', { targetSocketId, offer: signal });
      } else if (signal.type === 'answer') {
        socket.emit('webrtc:answer', { targetSocketId, answer: signal });
      } else {
        socket.emit('webrtc:ice-candidate', { targetSocketId, candidate: signal });
      }
    });

    peer.on('connect', () => {
      // Send our actual states so this specific peer knows immediately
      socket.emit('media:toggle', { roomId, type: 'audio', enabled: audioRef.current });
      socket.emit('media:toggle', { roomId, type: 'video', enabled: videoRef.current });
    });

    peer.on('stream', (remoteStream) => {
      setPeers((prev) => ({
        ...prev,
        [targetSocketId]: { ...prev[targetSocketId], stream: remoteStream },
      }));
    });

    peer.on('error', (err) => {
      console.error('[WebRTC] Peer error:', err);
      removePeer(targetSocketId);
    });

    peer.on('close', () => removePeer(targetSocketId));

    peersRef.current[targetSocketId] = peer;
    return peer;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addPeer = useCallback(
    (targetSocketId, userInfo, stream) => {
      if (peersRef.current[targetSocketId]) {
        console.warn(`[WebRTC] Peer connection for ${targetSocketId} already exists in addPeer. Destroying old connection.`);
        try {
          peersRef.current[targetSocketId].destroy();
        } catch (e) {
          console.error('[WebRTC] Error destroying old peer:', e);
        }
        delete peersRef.current[targetSocketId];
      }
      const peer = createPeer(targetSocketId, stream, true);
      setPeers((prev) => ({ ...prev, [targetSocketId]: { peer, stream: null, user: userInfo } }));
      // Initialise peer state to both enabled by default
      setPeerStates((prev) => ({
        ...prev,
        [targetSocketId]: { audioEnabled: true, videoEnabled: true },
      }));
      return peer;
    },
    [createPeer],
  );

  const receivePeer = useCallback(
    (targetSocketId, userInfo, offer, stream) => {
      if (peersRef.current[targetSocketId]) {
        console.warn(`[WebRTC] Peer connection for ${targetSocketId} already exists in receivePeer. Destroying old connection.`);
        try {
          peersRef.current[targetSocketId].destroy();
        } catch (e) {
          console.error('[WebRTC] Error destroying old peer:', e);
        }
        delete peersRef.current[targetSocketId];
      }
      const peer = createPeer(targetSocketId, stream, false);
      peer.signal(offer);
      setPeers((prev) => ({ ...prev, [targetSocketId]: { peer, stream: null, user: userInfo } }));
      setPeerStates((prev) => ({
        ...prev,
        [targetSocketId]: { audioEnabled: true, videoEnabled: true },
      }));
      return peer;
    },
    [createPeer],
  );

  // ─── Signal Handlers ─────────────────────────────────────────────────────────

  const handleAnswer = useCallback((socketId, answer) => {
    const peer = peersRef.current[socketId];
    if (peer) peer.signal(answer);
  }, []);

  const handleIceCandidate = useCallback((socketId, candidate) => {
    const peer = peersRef.current[socketId];
    if (peer) peer.signal(candidate);
  }, []);

  const removePeer = useCallback((socketId) => {
    const peer = peersRef.current[socketId];
    if (peer) {
      peer.destroy();
      delete peersRef.current[socketId];
    }
    setPeers((prev) => {
      const updated = { ...prev };
      delete updated[socketId];
      return updated;
    });
    setPeerStates((prev) => {
      const updated = { ...prev };
      delete updated[socketId];
      return updated;
    });
  }, []);

  // ─── Media Toggle ────────────────────────────────────────────────────────────

  const toggleAudio = useCallback(() => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setAudioEnabled(track.enabled);
      localStorage.setItem('syncspace_audio_enabled', String(track.enabled));
      const socket = getSocket();
      socket?.emit('media:toggle', { roomId, type: 'audio', enabled: track.enabled });
    }
  }, [roomId]);

  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setVideoEnabled(track.enabled);
      localStorage.setItem('syncspace_video_enabled', String(track.enabled));
      const socket = getSocket();
      socket?.emit('media:toggle', { roomId, type: 'video', enabled: track.enabled });
    }
  }, [roomId]);

  /**
   * Updates the peerStates map when a remote peer toggles their media.
   * Called from RoomPage when a 'media:toggle' socket event is received.
   * @param {string} socketId
   * @param {'audio'|'video'} type
   * @param {boolean} enabled
   */
  const handleMediaToggle = useCallback((socketId, type, enabled) => {
    setPeerStates((prev) => ({
      ...prev,
      [socketId]: {
        ...(prev[socketId] || { audioEnabled: true, videoEnabled: true }),
        [`${type}Enabled`]: enabled,
      },
    }));
  }, []);

  // ─── Screen Share ─────────────────────────────────────────────────────────────

  const stopScreenShare = useCallback(() => {
    if (!screenStreamRef.current) return;
    const screenTrack = screenStreamRef.current.getVideoTracks()[0];
    screenStreamRef.current.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setScreenStream(null);

    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
    Object.values(peersRef.current).forEach((peer) => {
      if (screenTrack && cameraTrack) {
        try {
          peer.replaceTrack(screenTrack, cameraTrack, localStreamRef.current);
        } catch (e) {
          console.error('[WebRTC] replaceTrack error in stopScreenShare:', e);
          const sender = peer._pc?.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(cameraTrack);
        }
      }
    });

    setIsScreenSharing(false);
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = displayStream;
      setScreenStream(displayStream);
      const screenTrack = displayStream.getVideoTracks()[0];

      // Replace video track in all active peer connections
      const localVideoTrack = localStreamRef.current?.getVideoTracks()[0];
      Object.values(peersRef.current).forEach((peer) => {
        if (localVideoTrack && screenTrack) {
          try {
            peer.replaceTrack(localVideoTrack, screenTrack, localStreamRef.current);
          } catch (e) {
            console.error('[WebRTC] replaceTrack error in startScreenShare:', e);
            const sender = peer._pc?.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) sender.replaceTrack(screenTrack);
          }
        }
      });

      screenTrack.onended = () => {
        stopScreenShare();
        const socket = getSocket();
        socket?.emit('screen:stop', { roomId });
      };
      setIsScreenSharing(true);
      return displayStream;
    } catch (err) {
      console.error('[WebRTC] Screen share error:', err);
      throw err;
    }
  }, [roomId, stopScreenShare]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Cleanup ──────────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    Object.values(peersRef.current).forEach((peer) => peer.destroy());
    peersRef.current = {};
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current = null;
    setPeers({});
    setPeerStates({});
    setLocalStream(null);
    setScreenStream(null);
    setIsScreenSharing(false);
  }, []);

  return {
    peers,
    localStream,
    screenStream,
    isScreenSharing,
    audioEnabled,
    videoEnabled,
    peerStates,
    getLocalStream,
    addPeer,
    receivePeer,
    handleAnswer,
    handleIceCandidate,
    removePeer,
    toggleAudio,
    toggleVideo,
    handleMediaToggle,
    startScreenShare,
    stopScreenShare,
    cleanup,
    switchDevice,
  };
};

export default useWebRTC;
