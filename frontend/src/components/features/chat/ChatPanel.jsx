/**
 * ChatPanel — "In-call messages" style
 * Colored circle avatars, sender name above bubble,
 * reactions, file uploads, typing indicator.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Paperclip, Loader2, Download, CheckCheck,
  FileText, FileSpreadsheet, FileArchive, Film, Image as ImageIcon, X as XIcon,
} from 'lucide-react';
import { getSocket } from '@/services/socket';
import api from '@/services/api';
import useAuthStore from '@/store/slices/authStore';
import { encryptMessage, decryptMessage } from '@/utils/crypto';
import { getParticipantColor } from '@/utils/participantColors';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isImage = (m) => m?.startsWith('image/');
const isVideo = (m) => m?.startsWith('video/');

const formatBytes = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const formatTime = (date) =>
  new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatDateDivider = (date) => {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' });
};

// ─── File type icon ───────────────────────────────────────────────────────────

function FileTypeIcon({ mimeType }) {
  if (isImage(mimeType)) return <ImageIcon className="w-4 h-4 text-blue-400" />;
  if (isVideo(mimeType)) return <Film className="w-4 h-4 text-purple-400" />;
  if (mimeType === 'application/pdf') return <FileText className="w-4 h-4 text-red-400" />;
  if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel'))
    return <FileSpreadsheet className="w-4 h-4 text-green-400" />;
  if (mimeType?.includes('zip')) return <FileArchive className="w-4 h-4 text-yellow-400" />;
  return <FileText className="w-4 h-4 text-gray-400" />;
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ src, onClose }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <img src={src} alt="Preview"
        className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
        onClick={(e) => e.stopPropagation()} />
      <button onClick={onClose}
        className="absolute top-4 right-4 bg-[#202124] border border-white/10 text-white rounded-full w-9 h-9 flex items-center justify-center hover:bg-[#22223a] transition-colors">
        <XIcon className="w-5 h-5" />
      </button>
    </div>
  );
}

// ─── File Bubble ──────────────────────────────────────────────────────────────

function FileBubble({ file, own, baseUrl }) {
  const [lightbox, setLightbox] = useState(false);
  const fileUrl = file.url?.startsWith('http') ? file.url : `${baseUrl}${file.url}`;

  if (isImage(file.mimeType)) {
    return (
      <>
        <div className="cursor-pointer rounded-xl overflow-hidden border border-white/10 hover:opacity-90 transition-opacity"
          onClick={() => setLightbox(true)}>
          <img src={fileUrl} alt={file.originalName}
            className="max-w-[200px] max-h-[180px] object-cover block" />
        </div>
        {lightbox && <Lightbox src={fileUrl} onClose={() => setLightbox(false)} />}
      </>
    );
  }

  if (isVideo(file.mimeType)) {
    return (
      <div className="rounded-xl overflow-hidden border border-white/10">
        <video src={fileUrl} controls className="max-w-[220px] block" />
      </div>
    );
  }

  return (
    <a href={fileUrl} download={file.originalName} target="_blank" rel="noreferrer"
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors
        ${own ? 'border-white/15 hover:border-white/25 bg-white/8' : 'border-white/10 hover:border-white/15 bg-white/6'}`}>
      <FileTypeIcon mimeType={file.mimeType} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-white truncate max-w-[140px]">{file.originalName}</p>
        <p className="text-xs text-white/50">{formatBytes(file.size)}</p>
      </div>
      <Download className="w-4 h-4 text-white/40 flex-shrink-0" />
    </a>
  );
}

// ─── Emoji reactions ──────────────────────────────────────────────────────────

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

function ReactionBar({ messageId, reactions, userId, onToggle, own }) {
  return (
    <div className={`absolute -top-9 ${own ? 'right-0' : 'left-0'} z-20
      opacity-0 group-hover:opacity-100 transition-opacity duration-150
      flex items-center gap-0.5 bg-[#1e1e2e] border border-white/12 rounded-full px-2 py-1.5 shadow-xl backdrop-blur-sm`}>
      {EMOJI_LIST.map((emoji) => {
        const reacted = reactions?.some(r => r.emoji === emoji && (r.user?._id === userId || r.user === userId));
        return (
          <button key={emoji} type="button"
            onClick={() => onToggle(messageId, emoji)}
            className={`text-base leading-none px-1 hover:scale-125 transition-transform rounded-full ${reacted ? 'bg-indigo-600/30' : ''}`}>
            {emoji}
          </button>
        );
      })}
    </div>
  );
}

function ReactionPills({ reactions, userId, onToggle, messageId }) {
  if (!reactions?.length) return null;
  const grouped = reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, users: [] };
    acc[r.emoji].count += 1;
    acc[r.emoji].users.push(r.user?.name || 'Someone');
    return acc;
  }, {});

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {Object.entries(grouped).map(([emoji, { count, users }]) => {
        const reacted = reactions.some(r => r.emoji === emoji && (r.user?._id === userId || r.user === userId));
        return (
          <button key={emoji} type="button" onClick={() => onToggle(messageId, emoji)} title={users.join(', ')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition-all
              ${reacted
                ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-200'
                : 'bg-white/6 border-white/10 text-gray-400 hover:border-white/20'}`}>
            <span>{emoji}</span>
            <span className="font-semibold">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Date Divider ─────────────────────────────────────────────────────────────

function DateDivider({ date }) {
  return (
    <div className="flex items-center gap-3 my-4 px-2">
      <div className="flex-1 h-px bg-white/6" />
      <span className="text-[10px] text-gray-600 font-medium px-3 py-1 bg-[#15151e] rounded-full border border-white/6 whitespace-nowrap">
        {formatDateDivider(date)}
      </span>
      <div className="flex-1 h-px bg-white/6" />
    </div>
  );
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────

function TypingIndicator({ typingUsers }) {
  const names = Object.values(typingUsers);
  if (!names.length) return null;
  const label = names.length === 1 ? `${names[0]} is typing`
    : names.length === 2 ? `${names[0]} and ${names[1]} are typing`
      : 'Several people are typing';

  return (
    <div className="flex items-center gap-2.5 px-4 py-2 animate-fade-in">
      <div className="typing-dots">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      <span className="text-[11px] text-gray-500 italic">{label}</span>
    </div>
  );
}

// ─── System message ───────────────────────────────────────────────────────────

function SystemMessage({ content }) {
  return (
    <div className="flex items-center justify-center py-1.5">
      <span className="text-[11px] text-gray-600 italic bg-white/4 px-3 py-1 rounded-full border border-white/6">
        {content}
      </span>
    </div>
  );
}

// ─── Main ChatPanel ─────────────────────────────────────────────────────────

export default function ChatPanel({ roomId }) {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState([]);
  const [pendingIds, setPendingIds] = useState(new Set());
  const [input, setInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const [isTyping, setIsTyping] = useState(false);

  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  const baseUrl = (import.meta.env.VITE_API_URL || '/api/v1').replace('/api/v1', '');

  const isOwn = useCallback((msg) => msg.sender?._id === user?._id || msg.sender === user?._id, [user]);

  useEffect(() => {
    return () => { if (filePreview?.startsWith('blob:')) URL.revokeObjectURL(filePreview); };
  }, [filePreview]);

  // Chat history
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onHistory = async ({ messages: history }) => {
      const decrypted = await Promise.all(
        (history || []).map(async (m) =>
          m.type === 'text' && m.content ? { ...m, content: await decryptMessage(m.content, roomId) } : m
        )
      );
      setMessages(decrypted);
    };
    socket.on('chat:history', onHistory);
    socket.emit('chat:get-history', { roomId });
    return () => socket.off('chat:history', onHistory);
  }, [roomId]);

  // Incoming messages
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onMessage = async ({ message, clientMsgId }) => {
      let msg = { ...message };
      if (msg.type === 'text' && msg.content) msg.content = await decryptMessage(msg.content, roomId);
      setMessages((prev) => {
        if (clientMsgId) {
          const idx = prev.findIndex((m) => m._id === clientMsgId);
          if (idx > -1) { const next = [...prev]; next[idx] = msg; return next; }
        }
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
      if (clientMsgId) setPendingIds((ids) => { const n = new Set(ids); n.delete(clientMsgId); return n; });
    };
    socket.on('chat:message', onMessage);
    return () => socket.off('chat:message', onMessage);
  }, [roomId]);

  // Reactions
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onReacted = ({ messageId, message }) => {
      setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, reactions: message.reactions } : m));
    };
    socket.on('chat:reacted', onReacted);
    return () => socket.off('chat:reacted', onReacted);
  }, []);

  // Typing
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onTyping = ({ userId, name, isTyping: t }) => {
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (t) next[userId] = name; else delete next[userId];
        return next;
      });
    };
    socket.on('chat:typing', onTyping);
    return () => socket.off('chat:typing', onTyping);
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const socket = getSocket();
    if (!socket) return;
    if (!isTyping) { setIsTyping(true); socket.emit('chat:typing', { roomId, isTyping: true }); }
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false); socket.emit('chat:typing', { roomId, isTyping: false });
    }, 1500);
  };

  const sendMessage = async (e) => {
    e?.preventDefault();
    const hasText = Boolean(input.trim());
    const hasFile = Boolean(selectedFile);
    if (!hasText && !hasFile) return;
    const socket = getSocket();
    if (!socket) return;
    clearTimeout(typingTimeoutRef.current);
    setIsTyping(false);
    socket.emit('chat:typing', { roomId, isTyping: false });

    if (hasFile) {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('roomId', roomId);
        if (hasText) formData.append('content', await encryptMessage(input.trim(), roomId));
        await api.post('/files/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        setInput('');
        clearFile();
      } catch (err) {
        console.error('[Chat] Upload error:', err);
      } finally { setUploading(false); }
    } else {
      const tempId = `temp-${Date.now()}`;
      const tempMsg = { _id: tempId, type: 'text', content: input.trim(), sender: user, createdAt: new Date().toISOString(), _pending: true };
      setMessages((prev) => [...prev, tempMsg]);
      setPendingIds((ids) => new Set([...ids, tempId]));
      const encrypted = await encryptMessage(input.trim(), roomId);
      socket.emit('chat:message', { roomId, content: encrypted, clientMsgId: tempId });
      setInput('');
      setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m._id !== tempId));
        setPendingIds((ids) => { const n = new Set(ids); n.delete(tempId); return n; });
      }, 5000);
    }
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleToggleReaction = (messageId, emoji) => {
    getSocket()?.emit('chat:react', { roomId, messageId, emoji });
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (filePreview?.startsWith('blob:')) URL.revokeObjectURL(filePreview);
    setSelectedFile(file);
    setFilePreview(file.type.startsWith('image/') || file.type.startsWith('video/')
      ? URL.createObjectURL(file) : file.name);
  };

  const clearFile = () => {
    if (filePreview?.startsWith('blob:')) URL.revokeObjectURL(filePreview);
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Build render list
  const renderedMessages = [];
  let lastDate = null;
  messages.forEach((msg, idx) => {
    const msgDate = new Date(msg.createdAt).toDateString();
    if (msgDate !== lastDate) {
      renderedMessages.push({ type: 'divider', date: msg.createdAt, key: `div-${idx}` });
      lastDate = msgDate;
    }
    renderedMessages.push({ type: 'message', msg, key: msg._id });
  });

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-[#282a2d]">
      {/* Messages list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 custom-scrollbar space-y-0.5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center pb-8">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 flex items-center justify-center border border-indigo-500/20">
              <span className="text-2xl">💬</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-400">Start the conversation</p>
              <p className="text-xs text-gray-600 mt-1">Messages are end-to-end encrypted.</p>
            </div>
          </div>
        )}

        {renderedMessages.map(({ type, msg, date, key }) => {
          if (type === 'divider') return <DateDivider key={key} date={date} />;

          const own = isOwn(msg);
          const isPending = msg._pending;
          const senderColor = getParticipantColor(msg.sender?._id || msg.sender || 'default');

          if (msg.type === 'system') return <SystemMessage key={key} content={msg.content} />;

          return (
            <div key={key} className={`flex gap-2.5 mb-2 relative group ${own ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* Avatar (others only) */}
              {!own && (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 self-end mb-0.5 shadow-sm"
                  style={{ background: senderColor.bg, color: senderColor.text }}
                  title={msg.sender?.name}>
                  {msg.sender?.name?.charAt(0).toUpperCase() || '?'}
                </div>
              )}

              {/* Content */}
              <div className={`max-w-[80%] flex flex-col gap-0.5 ${own ? 'items-end' : 'items-start'}`}>
                {/* Sender name */}
                {!own && (
                  <span className="text-[11px] font-semibold px-1 leading-none mb-1"
                    style={{ color: senderColor.bg }}>
                    {msg.sender?.name}
                  </span>
                )}

                {/* Bubble */}
                <div className={`relative px-3 py-2.5 text-sm shadow-sm transition-all
                  ${own
                    ? `rounded-2xl rounded-br-none ${isPending ? 'opacity-60' : ''}`
                    : 'rounded-2xl rounded-bl-none bg-[#1e1e2e] border border-white/8 text-gray-100'}`}
                  style={own ? { background: isPending ? '#1a2740' : '#1e3a5f', color: '#e2efff', borderRadius: '18px 18px 4px 18px' } : { borderRadius: '4px 18px 18px 18px' }}>

                  {/* Hover reaction bar */}
                  {!isPending && (
                    <ReactionBar messageId={msg._id} reactions={msg.reactions}
                      userId={user?._id} onToggle={handleToggleReaction} own={own} />
                  )}

                  {msg.type === 'file' ? (
                    <div className="flex flex-col gap-1.5">
                      <FileBubble file={msg.file} own={own} baseUrl={baseUrl} />
                      {msg.content && <span className="text-xs text-white/75 break-words whitespace-pre-wrap mt-1">{msg.content}</span>}
                    </div>
                  ) : (
                    <span className="break-words whitespace-pre-wrap leading-relaxed">{msg.content}</span>
                  )}

                  {/* Timestamp + tick */}
                  <div className={`flex items-center gap-1 mt-1 ${own ? 'justify-end' : 'justify-start'}`}>
                    <span className={`text-[10px] ${own ? 'text-blue-200/50' : 'text-gray-600'}`}>
                      {formatTime(msg.createdAt)}
                    </span>
                    {own && (
                      <CheckCheck className={`w-3 h-3 flex-shrink-0 ${isPending ? 'text-blue-300/40' : 'text-blue-300'}`} />
                    )}
                  </div>
                </div>

                {/* Reaction pills */}
                <ReactionPills reactions={msg.reactions} userId={user?._id}
                  onToggle={handleToggleReaction} messageId={msg._id} />
              </div>
            </div>
          );
        })}

        <TypingIndicator typingUsers={typingUsers} />
        <div ref={bottomRef} className="h-1" />
      </div>

      {/* File preview */}
      {filePreview && (
        <div className="mx-3 mb-2 p-2.5 rounded-xl bg-white/6 border border-white/10 flex items-center justify-between gap-2 animate-fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            {selectedFile?.type.startsWith('image/') ? (
              <img src={filePreview} alt="preview"
                className="w-10 h-10 rounded-lg object-cover border border-white/10 flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-white/8 flex items-center justify-center flex-shrink-0">
                <FileTypeIcon mimeType={selectedFile?.type} />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate max-w-[160px]">{selectedFile?.name}</p>
              <p className="text-[10px] text-gray-500">{formatBytes(selectedFile?.size)}</p>
            </div>
          </div>
          <button type="button" onClick={clearFile}
            className="p-1.5 rounded-full bg-white/8 hover:bg-white/15 text-gray-400 hover:text-white flex-shrink-0 transition-colors">
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="px-3 pb-3 pt-2 border-t border-white/6">
        <div className="flex items-end gap-2 bg-[#1e1e2e] rounded-2xl px-3 py-2 border border-white/8 focus-within:border-indigo-500/40 transition-colors">
          {/* Attach */}
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/8 transition-all flex-shrink-0 self-center">
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Text input */}
          <textarea ref={inputRef} value={input} onChange={handleInputChange} onKeyDown={handleKeyDown}
            placeholder="Send a message…"
            rows={1}
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 resize-none focus:outline-none py-1 min-h-[28px] max-h-[100px] leading-relaxed"
            style={{ height: 'auto' }}
            onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`; }}
          />

          {/* Send */}
          <button type="button" onClick={sendMessage}
            disabled={uploading || (!input.trim() && !selectedFile)}
            className="p-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all flex-shrink-0 self-center shadow-md">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-gray-700 text-center mt-1.5">End-to-end encrypted · Press Enter to send</p>
      </div>
    </div>
  );
}
