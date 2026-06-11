/**
 * ChatPanel — Google Chat / Slack style
 * Avatar on left, name + time on same row, plain text below (no bubbles)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Paperclip, Loader2, Download,
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
  return <FileText className="w-4 h-4 text-[#9aa0a6]" />;
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ src, onClose }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
      onClick={onClose}>
      <img src={src} alt="Preview"
        className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
        onClick={(e) => e.stopPropagation()} />
      <button onClick={onClose}
        className="absolute top-4 right-4 bg-[#3c4043] text-white rounded-full w-9 h-9 flex items-center justify-center hover:bg-[#5f6368] transition-colors">
        <XIcon className="w-5 h-5" />
      </button>
    </div>
  );
}

// ─── File attachment card ─────────────────────────────────────────────────────

function FileCard({ file, baseUrl }) {
  const [lightbox, setLightbox] = useState(false);
  const fileUrl = file.url?.startsWith('http') ? file.url : `${baseUrl}${file.url}`;

  if (isImage(file.mimeType)) {
    return (
      <>
        <div className="mt-2 cursor-pointer rounded-xl overflow-hidden hover:opacity-90 transition-opacity inline-block"
          onClick={() => setLightbox(true)}>
          <img src={fileUrl} alt={file.originalName}
            className="max-w-[220px] max-h-[160px] object-cover block rounded-xl" />
        </div>
        {lightbox && <Lightbox src={fileUrl} onClose={() => setLightbox(false)} />}
      </>
    );
  }

  if (isVideo(file.mimeType)) {
    return (
      <div className="mt-2 rounded-xl overflow-hidden border border-white/10">
        <video src={fileUrl} controls className="max-w-[220px] block" />
      </div>
    );
  }

  return (
    <a href={fileUrl} download={file.originalName} target="_blank" rel="noreferrer"
      className="mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/4 hover:bg-white/6 transition-colors inline-flex max-w-[220px]">
      <FileTypeIcon mimeType={file.mimeType} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#e8eaed] truncate max-w-[140px]">{file.originalName}</p>
        <p className="text-xs text-[#9aa0a6]">{formatBytes(file.size)}</p>
      </div>
      <Download className="w-4 h-4 text-[#9aa0a6] flex-shrink-0" />
    </a>
  );
}

// ─── Emoji reactions ──────────────────────────────────────────────────────────

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

function ReactionBar({ messageId, userId, onToggle }) {
  return (
    <div className="absolute -top-8 left-10 z-20
      opacity-0 group-hover:opacity-100 transition-opacity duration-150
      flex items-center gap-0.5 bg-[#3c4043] rounded-full px-2 py-1 shadow-xl">
      {EMOJI_LIST.map((emoji) => (
        <button key={emoji} type="button"
          onClick={() => onToggle(messageId, emoji)}
          className="text-sm leading-none px-0.5 hover:scale-125 transition-transform rounded-full">
          {emoji}
        </button>
      ))}
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
    <div className="flex flex-wrap gap-1 mt-1.5 ml-10">
      {Object.entries(grouped).map(([emoji, { count, users }]) => {
        const reacted = reactions.some(r => r.emoji === emoji && (r.user?._id === userId || r.user === userId));
        return (
          <button key={emoji} type="button" onClick={() => onToggle(messageId, emoji)} title={users.join(', ')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition-all
              ${reacted
                ? 'bg-[#8ab4f8]/20 border-[#8ab4f8]/50 text-[#8ab4f8]'
                : 'bg-white/6 border-white/10 text-[#9aa0a6] hover:border-white/20'}`}>
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
    <div className="flex items-center gap-3 my-4 px-4">
      <div className="flex-1 h-px bg-white/8" />
      <span className="text-[10px] text-[#9aa0a6] font-medium whitespace-nowrap px-1">
        {formatDateDivider(date)}
      </span>
      <div className="flex-1 h-px bg-white/8" />
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
    <div className="flex items-center gap-2 px-4 py-1">
      <div className="typing-dots">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      <span className="text-[11px] text-[#9aa0a6] italic">{label}</span>
    </div>
  );
}

// ─── System message ───────────────────────────────────────────────────────────

function SystemMessage({ content }) {
  return (
    <div className="flex items-center justify-center py-1.5 px-4">
      <span className="text-[11px] text-[#9aa0a6] italic bg-white/4 px-3 py-1 rounded-full">
        {content}
      </span>
    </div>
  );
}

// ─── Main ChatPanel ───────────────────────────────────────────────────────────

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

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onReacted = ({ messageId, message }) => {
      setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, reactions: message.reactions } : m));
    };
    socket.on('chat:reacted', onReacted);
    return () => socket.off('chat:reacted', onReacted);
  }, []);

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

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

  // Build render list with date dividers
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
      <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <div className="w-12 h-12 rounded-full bg-[#3c4043] flex items-center justify-center">
              <span className="text-xl">💬</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#e8eaed]">No messages yet</p>
              <p className="text-xs text-[#9aa0a6] mt-1">Messages are end-to-end encrypted</p>
            </div>
          </div>
        )}

        {renderedMessages.map(({ type, msg, date, key }) => {
          if (type === 'divider') return <DateDivider key={key} date={date} />;

          const own = isOwn(msg);
          const isPending = msg._pending;
          const senderColor = getParticipantColor(msg.sender?._id || msg.sender || 'default');
          const senderName = msg.sender?.name || 'Unknown';
          const initials = senderName.charAt(0).toUpperCase();

          if (msg.type === 'system') return <SystemMessage key={key} content={msg.content} />;

          return (
            <div key={key} className="group relative flex items-start gap-3 px-4 py-2 hover:bg-white/4 transition-colors">
              {/* Avatar circle */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5 select-none"
                style={{ background: senderColor.bg, color: senderColor.text }}
                title={senderName}>
                {initials}
              </div>

              {/* Message content */}
              <div className="flex-1 min-w-0">
                {/* Name + time row */}
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-sm font-semibold leading-none"
                    style={{ color: own ? '#8ab4f8' : senderColor.bg }}>
                    {own ? 'You' : senderName}
                  </span>
                  <span className="text-[10px] text-[#9aa0a6] leading-none">
                    {formatTime(msg.createdAt)}
                    {isPending && <span className="ml-1 italic">sending…</span>}
                  </span>
                </div>

                {/* Message text */}
                {msg.type === 'file' ? (
                  <div>
                    {msg.content && (
                      <p className="text-sm text-[#e8eaed] leading-relaxed whitespace-pre-wrap break-words mb-1">
                        {msg.content}
                      </p>
                    )}
                    <FileCard file={msg.file} baseUrl={baseUrl} />
                  </div>
                ) : (
                  <p className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${isPending ? 'text-[#9aa0a6]' : 'text-[#e8eaed]'}`}>
                    {msg.content}
                  </p>
                )}

                {/* Reaction pills */}
                <ReactionPills reactions={msg.reactions} userId={user?._id}
                  onToggle={handleToggleReaction} messageId={msg._id} />
              </div>

              {/* Hover reaction bar */}
              {!isPending && (
                <ReactionBar messageId={msg._id} userId={user?._id} onToggle={handleToggleReaction} />
              )}
            </div>
          );
        })}

        <TypingIndicator typingUsers={typingUsers} />
        <div ref={bottomRef} className="h-2" />
      </div>

      {/* File preview */}
      {filePreview && (
        <div className="mx-3 mb-2 p-2.5 rounded-xl bg-[#3c4043] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {selectedFile?.type.startsWith('image/') ? (
              <img src={filePreview} alt="preview"
                className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-white/8 flex items-center justify-center flex-shrink-0">
                <FileTypeIcon mimeType={selectedFile?.type} />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#e8eaed] truncate max-w-[150px]">{selectedFile?.name}</p>
              <p className="text-[10px] text-[#9aa0a6]">{formatBytes(selectedFile?.size)}</p>
            </div>
          </div>
          <button type="button" onClick={clearFile}
            className="p-1.5 rounded-full hover:bg-white/10 text-[#9aa0a6] hover:text-white flex-shrink-0 transition-colors">
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="px-3 pb-3 pt-1">
        <div className="flex items-end gap-2 bg-[#3c4043] rounded-2xl px-3 py-2 focus-within:ring-1 focus-within:ring-[#8ab4f8]/40 transition-all">
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-lg text-[#9aa0a6] hover:text-white hover:bg-white/8 transition-all flex-shrink-0 self-center">
            <Paperclip className="w-4 h-4" />
          </button>

          <textarea
            ref={inputRef} value={input} onChange={handleInputChange} onKeyDown={handleKeyDown}
            placeholder="Send a message to everyone…"
            rows={1}
            className="flex-1 bg-transparent text-sm text-[#e8eaed] placeholder-[#9aa0a6] resize-none focus:outline-none py-1.5 min-h-[28px] max-h-[100px] leading-relaxed"
            style={{ height: 'auto' }}
            onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`; }}
          />

          <button type="button" onClick={sendMessage} disabled={uploading || (!input.trim() && !selectedFile)}
            className="p-2 rounded-xl transition-all flex-shrink-0 self-center disabled:opacity-30
              bg-[#8ab4f8] hover:bg-[#aecbfa] disabled:bg-[#3c4043] text-[#202124] disabled:text-[#9aa0a6]">
            {uploading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-[#9aa0a6] text-center mt-1.5">Press Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
