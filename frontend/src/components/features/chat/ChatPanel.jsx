/**
 * ChatPanel.jsx
 *
 * WhatsApp-style chat panel:
 * ─ Own messages: right-aligned dark-green bubble
 * ─ Others: left-aligned dark bubble with sender name
 * ─ Date dividers (Today / Yesterday / date)
 * ─ Typing indicator: 3 animated dots (WhatsApp style)
 * ─ Emoji reactions: hover to see bar, click to toggle, pill count below bubble
 * ─ Double-tick: grey = sent, blue = confirmed
 * ─ File support: image (lightbox), video (inline), generic (download card)
 * ─ Participant colors on sender avatars
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
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <img
        src={src}
        alt="Preview"
        className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        className="absolute top-4 right-4 bg-dark-700 border border-dark-600 text-white rounded-full w-9 h-9 flex items-center justify-center hover:bg-dark-600 transition-colors"
      >
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
        <div
          className="cursor-pointer rounded-xl overflow-hidden border border-white/10 hover:opacity-90 transition-opacity"
          onClick={() => setLightbox(true)}
        >
          <img
            src={fileUrl}
            alt={file.originalName}
            className="max-w-[220px] max-h-[200px] object-cover block"
          />
        </div>
        {lightbox && <Lightbox src={fileUrl} onClose={() => setLightbox(false)} />}
      </>
    );
  }

  if (isVideo(file.mimeType)) {
    return (
      <div className="rounded-xl overflow-hidden border border-white/10">
        <video
          src={fileUrl}
          controls
          className="max-w-[240px] block"
        />
      </div>
    );
  }

  return (
    <a
      href={fileUrl}
      download={file.originalName}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors
        ${own
          ? 'border-white/20 hover:border-white/30 bg-white/10'
          : 'border-dark-500 hover:border-dark-400 bg-dark-700'}`}
    >
      <FileTypeIcon mimeType={file.mimeType} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-white truncate max-w-[160px]">{file.originalName}</p>
        <p className="text-xs text-white/60">{formatBytes(file.size)}</p>
      </div>
      <Download className="w-4 h-4 text-white/60 flex-shrink-0 ml-1" />
    </a>
  );
}

// ─── Reaction emoji bar (on hover) ───────────────────────────────────────────

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

function ReactionBar({ messageId, reactions, userId, onToggle, own }) {
  return (
    <div
      className={`absolute -top-8 ${own ? 'right-2' : 'left-2'} z-20
        opacity-0 group-hover:opacity-100 transition-opacity duration-150
        flex items-center gap-0.5 bg-dark-800 border border-dark-600 rounded-full px-2 py-1 shadow-xl`}
    >
      {EMOJI_LIST.map((emoji) => {
        const reacted = reactions?.some(
          (r) => r.emoji === emoji && (r.user?._id === userId || r.user === userId)
        );
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onToggle(messageId, emoji)}
            className={`text-base leading-none px-0.5 hover:scale-125 transition-transform rounded-full
              ${reacted ? 'bg-primary-600/30' : ''}`}
          >
            {emoji}
          </button>
        );
      })}
    </div>
  );
}

// ─── Reaction pills (below bubble) ───────────────────────────────────────────

function ReactionPills({ reactions, userId, onToggle, messageId }) {
  if (!reactions?.length) return null;

  const grouped = reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, users: [] };
    acc[r.emoji].count += 1;
    acc[r.emoji].users.push(r.user?.name || 'Someone');
    return acc;
  }, {});

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {Object.entries(grouped).map(([emoji, { count, users }]) => {
        const reacted = reactions.some(
          (r) => r.emoji === emoji && (r.user?._id === userId || r.user === userId)
        );
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onToggle(messageId, emoji)}
            title={users.join(', ')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition-all animate-reaction-pop
              ${reacted
                ? 'bg-primary-600/25 border-primary-500/60 text-primary-200'
                : 'bg-dark-700 border-dark-600 text-gray-400 hover:border-dark-500'}`}
          >
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
      <div className="flex-1 h-px bg-dark-600/60" />
      <span className="text-[10px] text-gray-500 font-medium bg-dark-800 px-3 py-1 rounded-full border border-dark-600/60 whitespace-nowrap">
        {formatDateDivider(date)}
      </span>
      <div className="flex-1 h-px bg-dark-600/60" />
    </div>
  );
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────

function TypingIndicator({ typingUsers }) {
  const names = Object.values(typingUsers);
  if (!names.length) return null;

  const label = names.length === 1
    ? `${names[0]} is typing`
    : names.length === 2
    ? `${names[0]} and ${names[1]} are typing`
    : 'Several people are typing';

  return (
    <div className="flex items-center gap-2 px-4 py-2 animate-fade-in">
      <div className="typing-dots">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      <span className="text-[11px] text-gray-500 italic">{label}</span>
    </div>
  );
}

// ─── Main ChatPanel ────────────────────────────────────────────────────────────

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

  const isOwn = useCallback(
    (msg) => msg.sender?._id === user?._id || msg.sender === user?._id,
    [user]
  );

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (filePreview?.startsWith('blob:')) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  // ── Socket: history ──────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onHistory = async ({ messages: history }) => {
      const decrypted = await Promise.all(
        (history || []).map(async (m) =>
          m.type === 'text' && m.content
            ? { ...m, content: await decryptMessage(m.content, roomId) }
            : m
        )
      );
      setMessages(decrypted);
    };

    socket.on('chat:history', onHistory);
    socket.emit('chat:get-history', { roomId });
    return () => socket.off('chat:history', onHistory);
  }, [roomId]);

  // ── Socket: incoming messages ────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onMessage = async ({ message, clientMsgId }) => {
      let msg = { ...message };
      if (msg.type === 'text' && msg.content) {
        msg.content = await decryptMessage(msg.content, roomId);
      }
      setMessages((prev) => {
        if (clientMsgId) {
          const idx = prev.findIndex((m) => m._id === clientMsgId);
          if (idx > -1) {
            const next = [...prev];
            next[idx] = msg;
            return next;
          }
        }
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
      if (clientMsgId) {
        setPendingIds((ids) => { const n = new Set(ids); n.delete(clientMsgId); return n; });
      }
    };

    socket.on('chat:message', onMessage);
    return () => socket.off('chat:message', onMessage);
  }, [roomId]);

  // ── Socket: reactions ────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onReacted = ({ messageId, message }) => {
      setMessages((prev) =>
        prev.map((m) => m._id === messageId ? { ...m, reactions: message.reactions } : m)
      );
    };
    socket.on('chat:reacted', onReacted);
    return () => socket.off('chat:reacted', onReacted);
  }, []);

  // ── Socket: typing ───────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onTyping = ({ userId, name, isTyping: t }) => {
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (t) next[userId] = name;
        else delete next[userId];
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

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const socket = getSocket();
    if (!socket) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit('chat:typing', { roomId, isTyping: true });
    }
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('chat:typing', { roomId, isTyping: false });
    }, 1500);
  };

  const sendMessage = async (e) => {
    e?.preventDefault();
    const hasText = Boolean(input.trim());
    const hasFile = Boolean(selectedFile);
    if (!hasText && !hasFile) return;

    const socket = getSocket();
    if (!socket) return;

    // Clear typing
    clearTimeout(typingTimeoutRef.current);
    setIsTyping(false);
    socket.emit('chat:typing', { roomId, isTyping: false });

    if (hasFile) {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('roomId', roomId);
        if (hasText) {
          formData.append('content', await encryptMessage(input.trim(), roomId));
        }
        await api.post('/files/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        setInput('');
        clearFile();
      } catch (err) {
        console.error('[Chat] Upload error:', err);
      } finally {
        setUploading(false);
      }
    } else {
      const tempId = `temp-${Date.now()}`;
      const tempMsg = {
        _id: tempId, type: 'text', content: input.trim(),
        sender: user, createdAt: new Date().toISOString(), _pending: true,
      };
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleToggleReaction = (messageId, emoji) => {
    getSocket()?.emit('chat:react', { roomId, messageId, emoji });
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (filePreview?.startsWith('blob:')) URL.revokeObjectURL(filePreview);
    setSelectedFile(file);
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      setFilePreview(URL.createObjectURL(file));
    } else {
      setFilePreview(file.name);
    }
  };

  const clearFile = () => {
    if (filePreview?.startsWith('blob:')) URL.revokeObjectURL(filePreview);
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Group messages by sender + date ──────────────────────────────────────────
  // We render a date divider when date changes between consecutive messages
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

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-dark-900">
      {/* Messages list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 custom-scrollbar">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center pb-8">
            <div className="w-12 h-12 rounded-full bg-dark-700 flex items-center justify-center">
              <span className="text-2xl">💬</span>
            </div>
            <p className="text-sm text-gray-500">No messages yet.</p>
            <p className="text-xs text-gray-600">Say hello! 👋</p>
          </div>
        )}

        {renderedMessages.map(({ type, msg, date, key }) => {
          if (type === 'divider') {
            return <DateDivider key={key} date={date} />;
          }

          const own = isOwn(msg);
          const isPending = msg._pending;
          const senderColor = getParticipantColor(msg.sender?._id || msg.sender || 'default');

          return (
            <div
              key={key}
              className={`flex gap-2 mb-1 relative group ${own ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Sender avatar (others only) */}
              {!own && (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 self-end mb-0.5"
                  style={{ background: senderColor.bg, color: senderColor.text }}
                  title={msg.sender?.name}
                >
                  {msg.sender?.name?.charAt(0).toUpperCase() || '?'}
                </div>
              )}

              {/* Bubble + meta */}
              <div className={`max-w-[78%] flex flex-col gap-0.5 ${own ? 'items-end' : 'items-start'}`}>
                {/* Sender name (others) */}
                {!own && (
                  <span
                    className="text-[11px] font-semibold ml-2"
                    style={{ color: senderColor.bg }}
                  >
                    {msg.sender?.name}
                  </span>
                )}

                {/* Bubble (relative so ReactionBar positions correctly above it) */}
                <div
                  className={`relative px-3 py-2 text-sm shadow-sm
                    ${own
                      ? `rounded-2xl rounded-br-sm ${isPending ? 'opacity-60' : ''}`
                      : 'rounded-2xl rounded-bl-sm bg-dark-700 text-gray-100'
                    }`}
                  style={own
                    ? { background: isPending ? '#1a4a3a' : '#075E54', color: '#e9fffd' }
                    : {}}
                >
                  {/* Reaction hover bar — above bubble, anchored to this relative div */}
                  {!isPending && (
                    <ReactionBar
                      messageId={msg._id}
                      reactions={msg.reactions}
                      userId={user?._id}
                      onToggle={handleToggleReaction}
                      own={own}
                    />
                  )}
                  {msg.type === 'file' ? (
                    <div className="flex flex-col gap-1.5">
                      <FileBubble file={msg.file} own={own} baseUrl={baseUrl} />
                      {msg.content && (
                        <span className="text-xs text-white/80 break-words whitespace-pre-wrap">
                          {msg.content}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="break-words whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </span>
                  )}

                  {/* Timestamp + tick (inside bubble, bottom-right) */}
                  <div className={`flex items-center gap-1 mt-0.5 ${own ? 'justify-end' : 'justify-start'}`}>
                    <span className={`text-[10px] ${own ? 'text-emerald-200/60' : 'text-gray-500'}`}>
                      {formatTime(msg.createdAt)}
                    </span>
                    {own && (
                      <CheckCheck
                        className={`w-3 h-3 flex-shrink-0 ${isPending ? 'text-emerald-200/40' : 'text-emerald-300'}`}
                      />
                    )}
                  </div>
                  </div>

                {/* Reaction pills */}
                <ReactionPills
                  reactions={msg.reactions}
                  userId={user?._id}
                  onToggle={handleToggleReaction}
                  messageId={msg._id}
                />
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        <TypingIndicator typingUsers={typingUsers} />

        <div ref={bottomRef} className="h-1" />
      </div>

      {/* File preview */}
      {filePreview && (
        <div className="mx-3 mb-2 p-2 rounded-xl bg-dark-700 border border-dark-600 flex items-center justify-between gap-2 animate-fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            {selectedFile?.type.startsWith('image/') ? (
              <img
                src={filePreview}
                alt="preview"
                className="w-10 h-10 rounded-lg object-cover border border-dark-500 flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-dark-600 flex items-center justify-center flex-shrink-0">
                <FileTypeIcon mimeType={selectedFile?.type} />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate max-w-[180px]">{selectedFile?.name}</p>
              <p className="text-[10px] text-gray-400">{formatBytes(selectedFile?.size)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={clearFile}
            className="p-1.5 rounded-full bg-dark-600 hover:bg-dark-500 text-gray-400 hover:text-white flex-shrink-0 transition-colors"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="px-3 pb-3 pt-2 border-t border-dark-700/60">
        <div className="flex items-end gap-2 bg-dark-700 rounded-2xl px-3 py-2 border border-dark-600 focus-within:border-primary-500/50 transition-colors">
          {/* Attach */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-1.5 text-gray-400 hover:text-white transition-colors flex-shrink-0 self-end mb-0.5"
            title="Attach file"
          >
            {uploading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Paperclip className="w-4 h-4" />
            }
          </button>

          {/* Text input */}
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={selectedFile ? 'Add a caption…' : 'Type a message…'}
            disabled={uploading}
            maxLength={2000}
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 resize-none outline-none leading-relaxed max-h-24 overflow-y-auto custom-scrollbar py-0.5"
            style={{ minHeight: '22px' }}
          />

          {/* Send */}
          <button
            type="button"
            onClick={sendMessage}
            disabled={uploading || (!input.trim() && !selectedFile)}
            className="p-1.5 rounded-full bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0 self-end mb-0.5"
            title="Send (Enter)"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-gray-600 text-center mt-1">Enter to send · Shift+Enter for newline</p>
      </div>
    </div>
  );
}
