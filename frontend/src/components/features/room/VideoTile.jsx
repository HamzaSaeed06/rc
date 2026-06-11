import { useEffect, useState, useRef } from 'react';
import {
  MicOff, Hand, Pin, PinOff, Volume2, VolumeX, Mic,
  Video, VideoOff, Crown, Monitor,
} from 'lucide-react';
import useAudioAnalyser from '@/hooks/useAudioAnalyser';
import AudioVisCanvas from '@/components/features/room/AudioVisCanvas';
import { getParticipantColor } from '@/utils/participantColors';

// ─── Hand raise badge — bounces then settles ────────────────────────────────
function HandRaiseBadge() {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    const t = setTimeout(() => setSettled(true), 2500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className={`absolute top-3 left-3 z-20 transition-all ${settled ? '' : 'animate-bounce'}`}>
      <div className="bg-amber-500 text-white p-2 rounded-full shadow-2xl border border-amber-400/60 select-none">
        <Hand className="w-4 h-4" />
      </div>
    </div>
  );
}

export default function VideoTile({
  stream,
  user,
  muted = false,
  isLocal = false,
  videoDisabled = false,
  isHandRaised = false,
  isPinned = false,
  onPin = null,
  audioEnabled = true,
  videoEnabled = true,
  onToggleAudio = null,
  onToggleVideo = null,
  isCurrentUserHost = false,
  onMuteParticipant = null,
  isHost = false,
  isScreenShare = false,
  isPip = false,
}) {
  const [isLocallyMuted, setIsLocallyMuted] = useState(false);
  const videoRef = useRef(null);
  const { isSpeaking, bars } = useAudioAnalyser(muted ? null : stream);

  const color = getParticipantColor(user?._id || user?.id || user?.name || 'default');

  const hasVideoTrack = Boolean(stream?.getVideoTracks().length);
  const hasAudioTrack = Boolean(stream?.getAudioTracks().length);
  const audioTrackEnabled = stream?.getAudioTracks()[0]?.enabled ?? false;

  const isVideoActive = Boolean(stream && !videoDisabled && hasVideoTrack);
  const showMicOff = isLocal ? !audioEnabled : (hasAudioTrack ? !audioTrackEnabled : false);
  const isMuted = muted || isLocallyMuted;

  const isSpeakingActive = isSpeaking && !isMuted && !showMicOff;

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream || null;
    }
  }, [stream]);

  // PiP mode — minimal tile for self-camera when screen sharing
  if (isPip) {
    return (
      <div className="relative w-full h-full bg-dark-850 flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${isVideoActive ? 'block' : 'hidden'}`}
        />
        {!isVideoActive && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${color.bg}33, #0f0f15)` }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: color.bg, color: color.text }}
            >
              {user?.name?.charAt(0).toUpperCase() || '?'}
            </div>
          </div>
        )}
        <div className="absolute bottom-1 left-2 right-2 flex items-center justify-between">
          <span className="text-[9px] text-white/80 font-medium truncate">Camera</span>
          {showMicOff && (
            <span className="bg-red-600/90 p-0.5 rounded-full flex">
              <MicOff className="w-2 h-2 text-white" />
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative bg-[#3c4043] rounded-2xl overflow-hidden w-full h-full flex items-center justify-center group transition-all duration-300"
      style={{
        boxShadow: (isSpeakingActive && isVideoActive)
          ? `0 0 0 3px ${color.bg}, 0 0 16px 4px ${color.bg}40`
          : isPinned ? `0 0 0 3px ${color.bg}` : 'none',
        animation: (isSpeakingActive && isVideoActive) ? 'speakingPulse 1.5s ease-in-out infinite' : 'none'
      }}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        className={`w-full h-full object-cover ${isVideoActive ? 'block' : 'hidden'}`}
      />

      {/* Screen share overlay badge */}
      {isScreenShare && isVideoActive && (
        <div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-primary-600/90 backdrop-blur-sm px-2 py-1 rounded-full shadow">
          <Monitor className="w-3 h-3 text-white" />
          <span className="text-[10px] text-white font-semibold">
            {isLocal ? 'Your screen' : 'Presenting'}
          </span>
        </div>
      )}

      {/* Avatar fallback */}
      {!isVideoActive && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#3c4043]"
        >
          <div
            className="rounded-full flex items-center justify-center font-bold select-none transition-all duration-300"
            style={{
              width: 'var(--av-size)',
              height: 'var(--av-size)',
              fontSize: 'calc(var(--av-size) * 0.45)', // Dynamic font size based on container
              '--av-size': 'min(120px, 40vw)', // Responsive max size
              background: color.bg,
              color: color.text,
              boxShadow: isSpeakingActive ? `0 0 0 6px ${color.bg}60, 0 0 20px ${color.bg}40` : undefined
            }}
          >
            {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
          </div>
          <span className="text-sm font-medium text-gray-300 tracking-wide mt-2">
            {isLocal ? 'You' : user?.name || 'Participant'}
          </span>
        </div>
      )}

      {/* Hand raised badge — icon only, bounce settles to static after 3s */}
      {isHandRaised && <HandRaiseBadge />}


      {/* Hover controls */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute top-3 right-3 flex items-center gap-1.5 z-30">
        <div className="flex items-center gap-1 bg-dark-900/85 backdrop-blur-sm px-2 py-1.5 rounded-xl border border-dark-600 shadow-lg">
          <span className="text-xs font-semibold text-white mr-1 px-1 border-r border-white/20">
            {isLocal ? 'You' : user?.name || 'Participant'}
          </span>
          {!isLocal ? (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsLocallyMuted((v) => !v); }}
                className={`p-2 rounded-lg hover:bg-dark-700 transition-colors ${isLocallyMuted ? 'text-red-400' : 'text-gray-300'}`}
                title={isLocallyMuted ? 'Unmute locally' : 'Mute locally'}
              >
                {isLocallyMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              {isCurrentUserHost && onMuteParticipant && !showMicOff && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onMuteParticipant(); }}
                  className="p-2 rounded-lg hover:bg-red-900/50 text-red-400 hover:text-red-300 transition-colors"
                  title="Mute for everyone"
                >
                  <MicOff className="w-4 h-4" />
                </button>
              )}
              {onPin && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onPin(); }}
                  className={`p-2 rounded-lg hover:bg-dark-700 transition-colors ${isPinned ? 'text-primary-400' : 'text-gray-300'}`}
                  title={isPinned ? 'Unpin' : 'Pin to stage'}
                >
                  {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                </button>
              )}
            </>
          ) : (
            <>
              {onToggleAudio && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onToggleAudio(); }}
                  className={`p-2 rounded-lg hover:bg-dark-700 transition-colors ${audioEnabled ? 'text-gray-300' : 'text-red-400'}`}
                  title={audioEnabled ? 'Mute mic' : 'Unmute mic'}
                >
                  {audioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>
              )}
              {onToggleVideo && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onToggleVideo(); }}
                  className={`p-2 rounded-lg hover:bg-dark-700 transition-colors ${videoEnabled ? 'text-gray-300' : 'text-red-400'}`}
                  title={videoEnabled ? 'Stop camera' : 'Start camera'}
                >
                  {videoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </button>
              )}
              {onPin && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onPin(); }}
                  className={`p-2 rounded-lg hover:bg-dark-700 transition-colors ${isPinned ? 'text-primary-400' : 'text-gray-300'}`}
                  title={isPinned ? 'Unpin' : 'Pin to stage'}
                >
                  {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 🎵 Audio visualizer circle — bottom-left, always visible when audio active */}
      {!showMicOff && (
        <div className="absolute bottom-3 left-3 z-10 w-9 h-9 rounded-full bg-[#1e2030] flex items-center justify-center shadow-lg shrink-0 overflow-hidden">
          <AudioVisCanvas bars={bars} size={36} />
        </div>
      )}

      {/* Bottom info pill — name + mic-off icon */}
      <div className={`absolute bottom-3 z-10 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-2.5 py-1.5 rounded-lg shadow-md max-w-[calc(100%-80px)] ${showMicOff ? 'left-3' : 'left-14'}`}>
        {showMicOff && (
          <div className="bg-[#ea4335] rounded-full p-0.5 shadow shrink-0">
            <MicOff className="w-3.5 h-3.5 text-white" />
          </div>
        )}
        <span className="text-xs sm:text-sm font-medium text-white truncate shadow-sm tracking-wide">
          {isLocal ? `You${isHost ? ' (Host)' : ''}` : user?.name || 'Participant'}
        </span>
        {isHost && !isLocal && <Crown className="w-3 h-3 text-amber-400 shrink-0 ml-0.5" />}
      </div>
    </div>
  );
}
