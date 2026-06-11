import { useRef, useEffect, useState, useCallback } from 'react';
import {
  Pen, Eraser, Trash2, Minus, Plus, Download, Square, Circle,
} from 'lucide-react';
import { getSocket } from '@/services/socket';

const COLORS = ['#ffffff', '#6366f1', '#ef4444', '#22c55e', '#f59e0b', '#06b6d4', '#ec4899'];

// ─── Drawing Utilities ────────────────────────────────────────────────────────

/**
 * Draw a single data object onto the canvas context.
 * Supports tools: pen, eraser, line, rect, circle.
 */
const drawShape = (ctx, data) => {
  const { x0, y0, x1, y1, color, lineWidth, eraser, tool } = data;

  ctx.beginPath();
  ctx.strokeStyle = eraser ? 'rgba(0,0,0,1)' : color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = eraser ? 'destination-out' : 'source-over';

  switch (tool) {
    case 'line':
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      break;
    case 'rect':
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      break;
    case 'circle': {
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const r = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2) / 2;
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'pen':
    case 'eraser':
    default:
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      break;
  }

  ctx.globalCompositeOperation = 'source-over';
};

const fillBackground = (ctx, canvas) => {
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#111118';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Whiteboard({ roomId }) {
  const canvasRef = useRef(null);
  const snapshotRef = useRef(null);   // ImageData snapshot taken at mousedown for shape preview
  const isDrawing = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const lastPos = useRef({ x: 0, y: 0 }); // used for pen/eraser

  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#ffffff');
  const [lineWidth, setLineWidth] = useState(3);

  // ─── Canvas Init ────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    fillBackground(ctx, canvas);
  }, []);

  // ─── Socket Listeners ───────────────────────────────────────────────────────

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleDraw = ({ drawData }) => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      drawShape(ctx, drawData);
    };

    const handleClear = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      fillBackground(ctx, canvas);
    };

    const handleHistory = ({ strokes }) => {
      if (!strokes?.length) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      fillBackground(ctx, canvas);
      strokes.forEach((drawData) => drawShape(ctx, drawData));
    };

    socket.on('whiteboard:draw', handleDraw);
    socket.on('whiteboard:clear', handleClear);
    socket.on('whiteboard:history', handleHistory);

    return () => {
      socket.off('whiteboard:draw', handleDraw);
      socket.off('whiteboard:clear', handleClear);
      socket.off('whiteboard:history', handleHistory);
    };
  }, []);

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    if (e.touches) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const emitDraw = useCallback(
    (drawData) => {
      const socket = getSocket();
      socket?.emit('whiteboard:draw', { roomId, drawData });
    },
    [roomId],
  );

  const isShapeTool = (t) => ['line', 'rect', 'circle'].includes(t);

  // ─── Mouse / Touch Handlers ──────────────────────────────────────────────────

  const onMouseDown = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);

    isDrawing.current = true;
    startPos.current = pos;
    lastPos.current = pos;

    if (isShapeTool(tool)) {
      // Save canvas snapshot so we can restore it during preview
      snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
  };

  const onMouseMove = (e) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);

    if (isShapeTool(tool)) {
      // Restore snapshot then draw shape preview (no emit yet)
      if (snapshotRef.current) {
        ctx.putImageData(snapshotRef.current, 0, 0);
      }
      drawShape(ctx, {
        x0: startPos.current.x,
        y0: startPos.current.y,
        x1: pos.x,
        y1: pos.y,
        color,
        lineWidth,
        eraser: false,
        tool,
      });
    } else {
      // Pen / eraser: continuous drawing
      const drawData = {
        x0: lastPos.current.x,
        y0: lastPos.current.y,
        x1: pos.x,
        y1: pos.y,
        color,
        lineWidth: tool === 'eraser' ? lineWidth * 5 : lineWidth,
        eraser: tool === 'eraser',
        tool,
      };
      drawShape(ctx, drawData);
      emitDraw(drawData);
      lastPos.current = pos;
    }
  };

  const onMouseUp = (e) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (isShapeTool(tool)) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const pos = getPos(e, canvas);

      // Restore snapshot, commit final shape, and emit
      if (snapshotRef.current) {
        ctx.putImageData(snapshotRef.current, 0, 0);
        snapshotRef.current = null;
      }

      const drawData = {
        x0: startPos.current.x,
        y0: startPos.current.y,
        x1: pos.x,
        y1: pos.y,
        color,
        lineWidth,
        eraser: false,
        tool,
      };
      drawShape(ctx, drawData);
      emitDraw(drawData);
    }
  };

  // ─── Clear Canvas ────────────────────────────────────────────────────────────

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    fillBackground(ctx, canvas);
    getSocket()?.emit('whiteboard:clear', { roomId });
  };

  // ─── Download ────────────────────────────────────────────────────────────────

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = 'whiteboard.png';
    link.click();
  };

  // ─── Toolbar tools config ─────────────────────────────────────────────────────

  const tools = [
    { id: 'pen', icon: Pen, label: 'Pen' },
    { id: 'eraser', icon: Eraser, label: 'Eraser' },
    { id: 'line', icon: Minus, label: 'Line' },
    { id: 'rect', icon: Square, label: 'Rectangle' },
    { id: 'circle', icon: Circle, label: 'Circle' },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-dark-600 flex-wrap">
        {/* Tool select */}
        <div className="flex items-center gap-1 bg-dark-700 rounded-lg p-1">
          {tools.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setTool(id)}
              title={label}
              className={`icon-btn ${
                tool === id ? 'bg-primary-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>

        {/* Colors */}
        <div className="flex items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => { setColor(c); if (tool === 'eraser') setTool('pen'); }}
              title={c}
              className={`w-5 h-5 rounded-full border-2 transition-transform ${
                color === c && tool !== 'eraser' ? 'border-white scale-125' : 'border-transparent'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        {/* Stroke width */}
        <div className="flex items-center gap-1 bg-dark-700 rounded-lg px-2 py-1">
          <button
            onClick={() => setLineWidth((w) => Math.max(1, w - 1))}
            className="text-gray-400 hover:text-white"
            title="Decrease stroke"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-xs text-gray-300 w-4 text-center">{lineWidth}</span>
          <button
            onClick={() => setLineWidth((w) => Math.min(20, w + 1))}
            className="text-gray-400 hover:text-white"
            title="Increase stroke"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={downloadCanvas}
            className="icon-btn text-gray-400 hover:text-white hover:bg-dark-700"
            title="Download whiteboard"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={clearCanvas}
            className="icon-btn text-red-400 hover:bg-red-500 hover:bg-opacity-20"
            title="Clear canvas"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onMouseDown}
          onTouchMove={onMouseMove}
          onTouchEnd={onMouseUp}
        />
      </div>
    </div>
  );
}
