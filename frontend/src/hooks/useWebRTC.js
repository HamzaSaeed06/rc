import { useRef, useState, useCallback } from 'react';
import SimplePeer from 'simple-peer';
import { getSocket } from '@/services/socket';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

/**
 * useWebRTC — manages peer connections, media tracks, and media-toggle signalling.
 * @param {string} roomId - The current room identifier (used for socket events).
 */
const useWebRTC = (roomId) => {
  const [peers, setPeers] = useState({}); // { socketId: { peer, stream, user } }
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  // Tracks remote peers' reported media states
  const [peerStates, setPeerStates] = useState({}); // { socketId: { audioEnabled, videoEnabled } }

  const peersRef = useRef({});
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  // ─── Local Stream ────────────────────────────────────────────────────────────

  const getLocalStream = useCallback(async (video = true, audio = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error('[WebRTC] getUserMedia error:', err);
      throw err;
    }
  }, []);

  // ─── Peer Creation ───────────────────────────────────────────────────────────

  const createPeer = useCallback((targetSocketId, stream, initiator = true) => {
    const socket = getSocket();
    const peer = new SimplePeer({
      initiator,
      trickle: true,
      stream,
      config: ICE_SERVERS,
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
  };
};

export default useWebRTC;
