import { useRef, useEffect } from 'react';

/**
 * AudioVisCanvas — 3 vertical white pill bars that grow UP+DOWN from center.
 * bars: [b0, b1, b2]  values 0..1 (low / mid / high frequency energy)
 * size: CSS display size in px (canvas buffer = size × 2 for sharpness)
 */
export default function AudioVisCanvas({ bars = [0, 0, 0], size = 36 }) {
  const canvasRef = useRef(null);
  const animRef  = useRef(null);
  const barsRef  = useRef(bars);

  useEffect(() => { barsRef.current = bars; }, [bars]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const BUF   = size * 2;
    const BW    = Math.round(BUF * 0.111);   // bar width  (~8px at buf=72)
    const BG    = Math.round(BUF * 0.083);   // bar gap    (~6px at buf=72)
    const BR    = BW / 2;                     // pill radius
    const CY    = BUF / 2;
    const total = 3 * BW + 2 * BG;
    const sx    = (BUF - total) / 2;          // start x

    // Center X of each bar
    const BAR_CX = [sx + BR, sx + BW + BG + BR, sx + 2 * (BW + BG) + BR];
    const MAXH   = Math.round(CY * 0.70);         // max half-height = 70% of radius (well inside circle)
    const MINH   = BR + 1;                        // min half-height (dot)

    const fillVPill = (ctx, cx, cy, half) => {
      const r    = BR;
      const ytop = cy - half;
      const ybot = cy + half;
      ctx.beginPath();
      ctx.arc(cx, ytop + r, r, Math.PI, 0,       false); // top cap
      ctx.lineTo(cx + r, ybot - r);
      ctx.arc(cx, ybot - r, r, 0,       Math.PI, false); // bottom cap
      ctx.closePath();
      ctx.fill();
    };

    const draw = () => {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, BUF, BUF);
      const b = barsRef.current;
      for (let i = 0; i < 3; i++) {
        const half = Math.max(MINH, Math.round(b[i] * MAXH));
        ctx.fillStyle = b[i] > 0.05 ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.28)';
        fillVPill(ctx, BAR_CX[i], CY, half);
      }
      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [size]); // eslint-disable-line

  return (
    <canvas
      ref={canvasRef}
      width={size * 2}
      height={size * 2}
      style={{ width: `${size}px`, height: `${size}px`, display: 'block' }}
    />
  );
}
