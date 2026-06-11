import { useEffect, useRef, useState } from 'react';

/**
 * Analyses a MediaStream's audio level and returns isSpeaking boolean.
 * @param {MediaStream|null} stream - The media stream to analyse.
 * @param {number} threshold - Average frequency amplitude above which speaking is detected (default 15).
 * @returns {{ isSpeaking: boolean }}
 */
const useAudioAnalyser = (stream, threshold = 15) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    // Clean up previous context/animation before setting up new one
    const cleanup = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      analyserRef.current = null;
      setIsSpeaking(false);
    };

    if (!stream) {
      cleanup();
      return;
    }

    // Only analyse if there are audio tracks
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) {
      cleanup();
      return;
    }

    let cancelled = false;

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (cancelled) return;
        analyser.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((acc, val) => acc + val, 0);
        const avg = sum / dataArray.length;
        setIsSpeaking(avg > threshold);
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error('[useAudioAnalyser] Failed to create AudioContext:', err);
    }

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [stream, threshold]);

  return { isSpeaking };
};

export default useAudioAnalyser;
