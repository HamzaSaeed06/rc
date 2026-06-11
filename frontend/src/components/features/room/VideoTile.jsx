import { useEffect, useState, useRef } from 'react';
import {
  MicOff, Hand, Pin, PinOff, Volume2, VolumeX, Mic,
  Video, VideoOff, Crown, Monitor,
} from 'lucide-react';
import useAudioAnalyser from '@/hooks/useAudioAnalyser';
import { getParticipantColor } from '@/utils/participantColors';

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
  const { isSpeaking } = useAudioAnalyser(muted ? null : stream);

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
      className={`relative bg-dark-850 rounded-xl overflow-hidden w-full h-full flex items-center justify-center group transition-all duration-300 ${isSpeakingActive ? 'speaking-ring' : ''}`}
      style={!isSpeakingActive && isPinned ? { boxShadow: `0 0 0 3px ${color.bg}` } : {}}
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
          className="absolute inset-0 flex flex-col items-center justify-center gap-3"
          style={{ background: `linear-gradient(135deg, ${color.bg}22, #0f0f15)` }}
        >
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-2xl font-bold select-none shadow-xl border-2"
            style={{ background: color.bg, borderColor: `${color.bg}80`, color: color.text }}
          >
            {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
          </div>
          <span className="text-sm font-medium text-gray-300 tracking-wide">
            {isLocal ? 'You' : user?.name || 'Participant'}
          </span>
        </div>
      )}

      {/* Hand raised badge */}
      {isHandRaised && (
        <div className="absolute top-2 right-2 z-20 animate-bounce-soft">
          <div className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1 border border-amber-400">
            <Hand className="w-3 h-3" />
            <span>✋</span>
          </div>
        </div>
      )}

      {/* Speaking pulse */}
      {isSpeakingActive && (
        <div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-dark-900/70 backdrop-blur-sm px-2 py-1 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" />
          <span className="text-[10px] text-green-400 font-medium">Speaking</span>
        </div>
      )}

      {/* Hover controls */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute top-2 right-2 flex items-center gap-1 z-30">
        {!isLocal ? (
          <div className="flex items-center gap-1 bg-dark-900/85 backdrop-blur-sm p-1 rounded-lg border border-dark-600 shadow-lg">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsLocallyMuted((v) => !v); }}
              className={`p-1.5 rounded-md hover:bg-dark-700 transition-colors ${isLocallyMuted ? 'text-red-400' : 'text-gray-300'}`}
              title={isLocallyMuted ? 'Unmute locally' : 'Mute locally'}
            >
              {isLocallyMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            {isCurrentUserHost && onMuteParticipant && !showMicOff && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onMuteParticipant(); }}
                className="p-1.5 rounded-md hover:bg-red-900/50 text-red-400 hover:text-red-300 transition-colors"
                title="Mute for everyone"
              >
                <MicOff className="w-3.5 h-3.5" />
              </button>
            )}
            {onPin && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onPin(); }}
                className={`p-1.5 rounded-md hover:bg-dark-700 transition-colors ${isPinned ? 'text-primary-400' : 'text-gray-300'}`}
                title={isPinned ? 'Unpin' : 'Pin to stage'}
              >
                {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1 bg-dark-900/85 backdrop-blur-sm p-1 rounded-lg border border-dark-600 shadow-lg">
            {onToggleAudio && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleAudio(); }}
                className={`p-1.5 rounded-md hover:bg-dark-700 transition-colors ${audioEnabled ? 'text-gray-300' : 'text-red-400'}`}
                title={audioEnabled ? 'Mute mic' : 'Unmute mic'}
              >
                {audioEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
              </button>
            )}
            {onToggleVideo && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleVideo(); }}
                className={`p-1.5 rounded-md hover:bg-dark-700 transition-colors ${videoEnabled ? 'text-gray-300' : 'text-red-400'}`}
                title={videoEnabled ? 'Stop camera' : 'Start camera'}
              >
                {videoEnabled ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
              </button>
            )}
            {onPin && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onPin(); }}
                className={`p-1.5 rounded-md hover:bg-dark-700 transition-colors ${isPinned ? 'text-primary-400' : 'text-gray-300'}`}
                title={isPinned ? 'Unpin' : 'Pin to stage'}
              >
                {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom info bar */}
      <div className="absolute bottom-0 left-0 right-0 z-10 px-2 py-1.5 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="text-xs px-2 py-0.5 rounded-full font-semibold shadow truncate max-w-[120px]"
            style={{ background: `${color.bg}cc`, color: color.text }}
          >
            {isLocal ? `You${isHost ? ' · Host' : ''}` : user?.name || 'Participant'}
          </span>
          {isHost && !isLocal && <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" />}
        </div>
        <div className="flex-shrink-0">
          {showMicOff ? (
            <span className="bg-red-600/90 p-1 rounded-full shadow flex">
              <MicOff className="w-2.5 h-2.5 text-white" />
            </span>
          ) : (
            <span className="bg-dark-800/60 p-1 rounded-full">
              <Mic className="w-2.5 h-2.5 text-green-400" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
