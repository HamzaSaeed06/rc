import { useEffect, useRef, useState } from 'react';

/**
 * Google Meet–style audio analyser.
 * - Highpass filter at 350 Hz (kills fan/breathing noise)
 * - fftSize 256, smoothingTimeConstant 0.25 (organic fast drops)
 * - Speech frequency ranges: low 350–700 Hz, mid 700–1400 Hz, high 1400–2800 Hz
 * - Noise gate: values below threshold are zeroed out
 * - Independent per-bar smoothing (smooth factor 0.3, like Meet reference)
 * - bars[0]=mid (left), bars[1]=low (center — tallest), bars[2]=high (right)
 */
const NOISE_GATE   = 50;
const SMOOTH_K     = 0.3;

const useAudioAnalyser = (stream) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [bars, setBars]             = useState([0, 0, 0]);

  const audioCtxRef = useRef(null);
  const rafRef      = useRef(null);
  const smoothRef   = useRef([0, 0, 0]);   // independent smoothing — no re-render

  useEffect(() => {
    const cleanup = () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
      smoothRef.current = [0, 0, 0];
      setIsSpeaking(false);
      setBars([0, 0, 0]);
    };

    if (!stream) { cleanup(); return; }
    if (!stream.getAudioTracks().length) { cleanup(); return; }

    let cancelled = false;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;

      // Highpass filter — kills everything below 350 Hz
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 350;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize             = 256;
      analyser.smoothingTimeConstant = 0.25;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(filter);
      filter.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const hzPerBin  = audioCtx.sampleRate / analyser.fftSize;

      const tick = () => {
        if (cancelled) return;
        analyser.getByteFrequencyData(dataArray);

        let loS=0, miS=0, hiS=0, loN=0, miN=0, hiN=0;
        for (let i = 0; i < dataArray.length; i++) {
          const hz = i * hzPerBin;
          if      (hz >= 350  && hz < 700)  { loS += dataArray[i]; loN++; }
          else if (hz >= 700  && hz < 1400) { miS += dataArray[i]; miN++; }
          else if (hz >= 1400 && hz < 2800) { hiS += dataArray[i]; hiN++; }
        }

        let lo = loN > 0 ? loS / loN : 0;
        let mi = miN > 0 ? miS / miN : 0;
        let hi = hiN > 0 ? hiS / hiN : 0;

        // Noise gate
        const NG = NOISE_GATE;
        lo = lo > NG ? (lo - NG) / (255 - NG) : 0;
        mi = mi > NG ? (mi - NG) / (255 - NG) : 0;
        hi = hi > NG ? (hi - NG) / (255 - NG) : 0;

        // Independent per-bar smoothing
        const s = smoothRef.current;
        s[0] += (mi - s[0]) * SMOOTH_K;   // left  = mid freq
        s[1] += (lo - s[1]) * SMOOTH_K;   // center = low freq (tallest bar)
        s[2] += (hi - s[2]) * SMOOTH_K;   // right  = high freq

        setIsSpeaking((s[0] + s[1] + s[2]) / 3 > 0.02);
        setBars([s[0], s[1], s[2]]);
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.error('[useAudioAnalyser]', err);
    }

    return () => { cancelled = true; cleanup(); };
  }, [stream]);

  return { isSpeaking, bars };
};

export default useAudioAnalyser;
