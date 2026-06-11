import { useEffect, useRef, useState } from 'react';

const useAudioAnalyser = (stream, threshold = 15) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [bars, setBars] = useState([0, 0, 0]);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const cleanup = () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
      analyserRef.current = null;
      setIsSpeaking(false);
      setBars([0, 0, 0]);
    };

    if (!stream) { cleanup(); return; }
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) { cleanup(); return; }

    let cancelled = false;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (cancelled) return;
        analyser.getByteFrequencyData(dataArray);
        const len = dataArray.length;
        const third = Math.floor(len / 3);

        const slice = (start, end) => {
          let sum = 0;
          for (let i = start; i < end; i++) sum += dataArray[i];
          return sum / (end - start) / 255;
        };

        const b0 = slice(0, third);
        const b1 = slice(third, 2 * third);
        const b2 = slice(2 * third, len);

        const avg = (b0 + b1 + b2) / 3;
        setIsSpeaking(avg * 255 > threshold);
        setBars([b0, b1, b2]);
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error('[useAudioAnalyser] Failed to create AudioContext:', err);
    }

    return () => { cancelled = true; cleanup(); };
  }, [stream, threshold]);

  return { isSpeaking, bars };
};

export default useAudioAnalyser;
