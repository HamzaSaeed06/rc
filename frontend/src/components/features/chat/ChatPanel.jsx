/**
 * ChatPanel — Google Chat / Slack style
 * Avatar + name + time row, plain text (no bubbles)
 * Message hover: emoji bar + copy/reply/more
 * Mobile: long-press menu
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Paperclip, Loader2, Download,
  FileText, FileSpreadsheet, FileArchive, Film, Image as ImageIcon, X as XIcon,
  MoreHorizontal, Copy, CornerUpLeft, Check, ChevronDown,
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
      className="mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/4 hover:bg-white/6 transition-colors max-w-[220px]">
      <FileTypeIcon mimeType={file.mimeType} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#e8eaed] truncate max-w-[140px]">{file.originalName}</p>
        <p className="text-xs text-[#9aa0a6]">{formatBytes(file.size)}</p>
      </div>
      <Download className="w-4 h-4 text-[#9aa0a6] flex-shrink-0" />
    </a>
  );
}

// ─── Full emoji picker ────────────────────────────────────────────────────────

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const ALL_EMOJIS = [
  '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😉','😊','😇','🥰','😍','🤩','😘','😋','😜','🤪','😝',
  '🤑','🤗','🤔','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','😴','😷','🤒','🤕','🤢','🤧',
  '🥵','🥶','😵','🤯','🤠','🥳','😎','🤓','😕','😟','😮‍💨','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭',
  '😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','💩','🤡','👻','🤖','👽',
  '👋','🤚','✋','🖖','👌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👍','👎','✊','👊','👏',
  '🙌','👐','🤲','🤝','🙏','💪','🦾','🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👀','👁️','👅',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️',
  '🔥','✨','🌟','⭐','💫','🎉','🎊','🎈','🎁','🎀','🏆','🥇','🎮','🎲','🎯','🎵','🎶','🎤','🎧','🎸',
  '🌈','☀️','🌙','🌤️','⛅','🌊','🌺','🌸','🍀','🌴','🐶','🐱','🐭','🐰','🦊','🐻','🐼','🐨','🐯','🦁',
  '🍕','🍔','🍟','🌮','🍜','🍣','🍦','🍰','🎂','🍫','🍬','🍭','🥤','☕','🍵','🍺','🥂','🍾','🎃','🎄',
];

function FullEmojiPicker({ onSelect, onClose, anchorRef }) {
  const pickerRef = useRef(null);
  useEffect(() => {
    const h = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target) &&
          anchorRef?.current && !anchorRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose, anchorRef]);

  return (
    <div ref={pickerRef}
      className="absolute bottom-full right-0 mb-2 w-72 bg-[#303134] rounded-2xl shadow-2xl border border-white/10 z-50 overflow-hidden"
      onClick={(e) => e.stopPropagation()}>
      <div className="px-3 py-2 border-b border-white/8">
        <p className="text-[11px] text-[#9aa0a6] font-medium">Reactions</p>
      </div>
      <div className="grid grid-cols-10 gap-0.5 p-2 max-h-52 overflow-y-auto custom-scrollbar">
        {ALL_EMOJIS.map((emoji, i) => (
          <button key={i} type="button" onClick={() => { onSelect(emoji); onClose(); }}
            className="w-7 h-7 flex items-center justify-center text-lg hover:bg-white/10 rounded-lg transition-all hover:scale-125">
            {emoji}
          </button>
        ))}
      </div>
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
    <div className="flex flex-wrap gap-1 mt-1.5 ml-12">
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

// ─── Message hover actions bar (WhatsApp style) ───────────────────────────────

function MessageActions({ msg, userId, onReact, onReply, visible, onMore, showMore, onCloseMore }) {
  const plusRef = useRef(null);
  if (!visible) return null;

  return (
    <div className="absolute right-2 -top-7 z-20 animate-fade-in" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-0.5 bg-[#1f2023] rounded-full px-1.5 py-1 shadow-2xl border border-white/10">
        {EMOJI_LIST.map(emoji => (
          <button key={emoji} type="button" onClick={() => onReact(msg._id, emoji)}
            className="w-7 h-7 flex items-center justify-center text-base hover:scale-125 transition-all rounded-full hover:bg-white/10">
            {emoji}
          </button>
        ))}
        <div className="w-px h-4 bg-white/15 mx-0.5" />
        <button type="button" onClick={() => onReply(msg)}
          className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 text-[#9aa0a6] hover:text-white transition-colors" title="Reply">
          <CornerUpLeft className="w-3.5 h-3.5" />
        </button>
        <div className="relative" ref={plusRef}>
          <button type="button" onClick={onMore}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 text-[#9aa0a6] hover:text-white transition-colors font-bold text-sm" title="More reactions">
            +
          </button>
          {showMore && (
            <FullEmojiPicker
              onSelect={(emoji) => onReact(msg._id, emoji)}
              onClose={onCloseMore}
              anchorRef={plusRef}
            />
          )}
        </div>
      </div>
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

// ─── Reply quote indicator ─────────────────────────────────────────────────────

function ReplyQuote({ msg, onClear }) {
  if (!msg) return null;
  const name = msg.sender?.name || 'Unknown';
  const preview = msg.type === 'file' ? (msg.file?.originalName || 'File') : (msg.content?.slice(0, 60) || '');
  return (
    <div className="mx-3 mb-1 px-3 py-2 rounded-t-2xl bg-[#3c4043] border-l-2 border-[#8ab4f8] flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-[#8ab4f8] mb-0.5">{name}</p>
        <p className="text-xs text-[#9aa0a6] truncate">{preview}</p>
      </div>
      <button onClick={onClear} className="text-[#9aa0a6] hover:text-white flex-shrink-0 mt-0.5">
        <XIcon className="w-3.5 h-3.5" />
      </button>
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
  const [hoveredMsgId, setHoveredMsgId] = useState(null);
  const [moreEmojiMsgId, setMoreEmojiMsgId] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  // Mobile long-press
  const longPressRef = useRef(null);
  const [mobileMsgMenu, setMobileMsgMenu] = useState(null);

  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMsgBanner, setNewMsgBanner] = useState(null);
  const [newMsgCount, setNewMsgCount] = useState(0);

  const bottomRef = useRef(null);
  const scrollRef = useRef(null);
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

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setIsAtBottom(atBottom);
    if (atBottom) { setNewMsgCount(0); setNewMsgBanner(null); }
  }, []);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsAtBottom(true);
    setNewMsgCount(0);
    setNewMsgBanner(null);
  }, []);

  useEffect(() => {
    if (isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      const last = messages[messages.length - 1];
      if (last && !last._pending) {
        setNewMsgCount(c => c + 1);
        setNewMsgBanner(last);
      }
    }
  }, [messages.length]);

  useEffect(() => {
    if (isAtBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [typingUsers, isAtBottom]);

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
    setReplyTo(null);

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
      const replyRef = replyTo ? { id: replyTo._id, name: replyTo.sender?.name, preview: replyTo.content?.slice(0, 60) } : undefined;
      const tempMsg = { _id: tempId, type: 'text', content: input.trim(), sender: user, createdAt: new Date().toISOString(), _pending: true, replyTo: replyRef };
      setMessages((prev) => [...prev, tempMsg]);
      setPendingIds((ids) => new Set([...ids, tempId]));
      const encrypted = await encryptMessage(input.trim(), roomId);
      socket.emit('chat:message', { roomId, content: encrypted, clientMsgId: tempId, replyTo: replyRef });
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

  const handleInlineCopy = useCallback((msg) => {
    const text = msg.type === 'file' ? (msg.content || msg.file?.originalName || '') : (msg.content || '');
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedMsgId(msg._id);
    setTimeout(() => setCopiedMsgId(id => id === msg._id ? null : id), 2000);
  }, []);

  // Mobile long press
  const handleTouchStart = (msgId) => {
    longPressRef.current = setTimeout(() => { setMobileMsgMenu(msgId); }, 500);
  };
  const handleTouchEnd = () => {
    clearTimeout(longPressRef.current);
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
    <div className="flex flex-col h-full bg-[#282a2d]"
      onClick={() => { setHoveredMsgId(null); setMoreEmojiMsgId(null); setMobileMsgMenu(null); }}>

      {/* Messages list */}
      <div className="relative flex-1 overflow-hidden flex flex-col">

        {/* New message banner — shows when scrolled away and new message arrives */}
        {newMsgBanner && !isAtBottom && (
          <button type="button" onClick={scrollToBottom}
            className="absolute top-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#1f2023] border border-white/15 shadow-xl max-w-[90%] hover:bg-[#2a2c2f] transition-colors animate-fade-in">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#8ab4f8] flex items-center justify-center text-[10px] font-bold text-[#202124]">
              {newMsgCount > 9 ? '9+' : newMsgCount}
            </span>
            <span className="text-xs text-[#e8eaed] truncate max-w-[160px]">
              {newMsgBanner.sender?.name || 'Someone'}: {newMsgBanner.content?.slice(0, 40) || 'sent a file'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#9aa0a6] flex-shrink-0" />
          </button>
        )}

        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto py-2 custom-scrollbar">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6" style={{ minHeight: '200px' }}>
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
          const isHovered = hoveredMsgId === msg._id;
          const isMobileMenuOpen = mobileMsgMenu === msg._id;

          if (msg.type === 'system') return <SystemMessage key={key} content={msg.content} />;

          /* ── own messages: right side | others: left side ── */
          return own ? (
            /* ── MY MESSAGE (right) ── */
            <div key={key}
              className="group relative flex justify-end items-end gap-2 px-3 pt-1.5 pb-1"
              onMouseLeave={() => { setHoveredMsgId(null); setMoreEmojiMsgId(null); }}
              onTouchStart={() => handleTouchStart(msg._id)}
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchEnd}
            >
              <div className="flex flex-col items-end max-w-[72%]">
                {/* Time */}
                <span className="text-[10px] text-[#9aa0a6] mb-1 pr-1">
                  {formatTime(msg.createdAt)}
                  {isPending && <span className="ml-1 italic opacity-70">sending…</span>}
                </span>

                {/* Reply quote */}
                {msg.replyTo && (
                  <div className="mb-1 px-2 py-1.5 rounded-xl bg-white/6 border-l-2 border-[#8ab4f8]/60 max-w-full self-end">
                    <p className="text-[10px] font-semibold text-[#8ab4f8] mb-0.5">{msg.replyTo.name}</p>
                    <p className="text-xs text-[#9aa0a6] truncate">{msg.replyTo.preview}</p>
                  </div>
                )}

                {/* Bubble + ▼ arrow row */}
                <div className="flex items-center gap-1.5">
                  {/* ▼ arrow — appears on hover, opens emoji bar on click */}
                  {!isPending && (
                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); setHoveredMsgId(h => h === msg._id ? null : msg._id); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 w-6 h-6 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center text-[#9aa0a6] hover:text-white"
                      title="React">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <div className={`relative inline-block px-3 py-2 rounded-2xl rounded-tr-sm
                    bg-[#1a73e8] text-white ${isPending ? 'opacity-60' : ''}`}>
                    {msg.type === 'file' ? (
                      <>
                        {msg.content && <p className="text-sm leading-relaxed whitespace-pre-wrap break-words mb-1">{msg.content}</p>}
                        <FileCard file={msg.file} baseUrl={baseUrl} />
                      </>
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words select-text">{msg.content}</p>
                    )}
                  </div>
                </div>

                {/* Copy button — below bubble, fades in on hover */}
                {!isPending && (
                  <button type="button"
                    onClick={(e) => { e.stopPropagation(); handleInlineCopy(msg); }}
                    className="flex items-center gap-1 mt-0.5 mr-0.5 px-2 py-0.5 rounded-full text-[10px]
                      opacity-0 group-hover:opacity-100 transition-opacity duration-150
                      text-[#9aa0a6] hover:text-white hover:bg-white/10"
                    title="Copy">
                    {copiedMsgId === msg._id
                      ? <><Check className="w-3 h-3 text-green-400" /><span className="text-green-400">Copied!</span></>
                      : <><Copy className="w-3 h-3" /><span>Copy</span></>}
                  </button>
                )}

                {/* Reaction pills */}
                <ReactionPills reactions={msg.reactions} userId={user?._id}
                  onToggle={handleToggleReaction} messageId={msg._id} />
              </div>

              {/* Emoji bar */}
              {!isPending && (
                <MessageActions msg={msg} userId={user?._id}
                  onReact={handleToggleReaction}
                  onReply={(m) => { setReplyTo(m); inputRef.current?.focus(); }}
                  visible={isHovered}
                  onMore={() => setMoreEmojiMsgId(moreEmojiMsgId === msg._id ? null : msg._id)}
                  showMore={moreEmojiMsgId === msg._id}
                  onCloseMore={() => setMoreEmojiMsgId(null)}
                />
              )}

              {/* Own avatar — right side */}
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mb-0.5 select-none"
                style={{ background: senderColor.bg, color: senderColor.text }} title="You">
                {initials}
              </div>
            </div>
          ) : (
            /* ── OTHERS' MESSAGE (left) ── */
            <div key={key}
              className="group relative flex items-start gap-2.5 px-3 pt-2 pb-1"
              onMouseLeave={() => { setHoveredMsgId(null); setMoreEmojiMsgId(null); }}
              onTouchStart={() => handleTouchStart(msg._id)}
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchEnd}
            >
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 select-none"
                style={{ background: senderColor.bg, color: senderColor.text }} title={senderName}>
                {initials}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Name + time */}
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-sm font-semibold leading-none text-[#e8eaed]">{senderName}</span>
                  <span className="text-[10px] text-[#9aa0a6] leading-none">
                    {formatTime(msg.createdAt)}
                    {isPending && <span className="ml-1 italic opacity-70">sending…</span>}
                  </span>
                </div>

                {/* Reply quote */}
                {msg.replyTo && (
                  <div className="mb-1 px-2 py-1.5 rounded-xl bg-white/6 border-l-2 border-[#8ab4f8]/60 max-w-[85%]">
                    <p className="text-[10px] font-semibold text-[#8ab4f8] mb-0.5">{msg.replyTo.name}</p>
                    <p className="text-xs text-[#9aa0a6] truncate">{msg.replyTo.preview}</p>
                  </div>
                )}

                {/* Bubble + ▼ arrow row */}
                <div className="flex items-center gap-1.5">
                  <div className={`relative inline-block px-3 py-2 rounded-2xl rounded-tl-sm
                    bg-[#3a3d42] text-[#e8eaed] ${isPending ? 'opacity-60' : ''}`}>
                    {msg.type === 'file' ? (
                      <>
                        {msg.content && <p className="text-sm leading-relaxed whitespace-pre-wrap break-words mb-1">{msg.content}</p>}
                        <FileCard file={msg.file} baseUrl={baseUrl} />
                      </>
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words select-text">{msg.content}</p>
                    )}
                  </div>
                  {/* ▼ arrow — appears on hover, opens emoji bar on click */}
                  {!isPending && (
                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); setHoveredMsgId(h => h === msg._id ? null : msg._id); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 w-6 h-6 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center text-[#9aa0a6] hover:text-white flex-shrink-0"
                      title="React">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Copy button — below bubble, fades in on hover */}
                {!isPending && (
                  <button type="button"
                    onClick={(e) => { e.stopPropagation(); handleInlineCopy(msg); }}
                    className="flex items-center gap-1 mt-0.5 ml-0.5 px-2 py-0.5 rounded-full text-[10px]
                      opacity-0 group-hover:opacity-100 transition-opacity duration-150
                      text-[#9aa0a6] hover:text-white hover:bg-white/10"
                    title="Copy">
                    {copiedMsgId === msg._id
                      ? <><Check className="w-3 h-3 text-green-400" /><span className="text-green-400">Copied!</span></>
                      : <><Copy className="w-3 h-3" /><span>Copy</span></>}
                  </button>
                )}

                {/* Reaction pills */}
                <ReactionPills reactions={msg.reactions} userId={user?._id}
                  onToggle={handleToggleReaction} messageId={msg._id} />
              </div>

              {/* Emoji bar */}
              {!isPending && (
                <MessageActions msg={msg} userId={user?._id}
                  onReact={handleToggleReaction}
                  onReply={(m) => { setReplyTo(m); inputRef.current?.focus(); }}
                  visible={isHovered}
                  onMore={() => setMoreEmojiMsgId(moreEmojiMsgId === msg._id ? null : msg._id)}
                  showMore={moreEmojiMsgId === msg._id}
                  onCloseMore={() => setMoreEmojiMsgId(null)}
                />
              )}

              {/* Mobile long-press menu */}
              {isMobileMenuOpen && (
                <div className="absolute left-12 top-0 z-30 bg-[#303134] rounded-2xl shadow-2xl py-2 min-w-[200px] border border-white/8">
                  <p className="px-4 py-1 text-[10px] text-[#9aa0a6] uppercase tracking-widest">React</p>
                  <div className="flex gap-1.5 px-4 py-2">
                    {EMOJI_LIST.map(emoji => (
                      <button key={emoji} type="button"
                        onClick={() => { handleToggleReaction(msg._id, emoji); setMobileMsgMenu(null); }}
                        className="text-xl hover:scale-125 transition-transform">
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <div className="h-px bg-white/8 mx-2 my-1" />
                  <button onClick={() => { setReplyTo(msg); inputRef.current?.focus(); setMobileMsgMenu(null); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#e8eaed] hover:bg-white/8">
                    <CornerUpLeft className="w-4 h-4 text-[#9aa0a6]" /> Reply
                  </button>
                  <button onClick={() => { handleInlineCopy(msg); setMobileMsgMenu(null); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#e8eaed] hover:bg-white/8">
                    <Copy className="w-4 h-4 text-[#9aa0a6]" /> Copy text
                  </button>
                </div>
              )}
            </div>
          );
        })}

        <TypingIndicator typingUsers={typingUsers} />
        <div ref={bottomRef} className="h-2" />
        </div>

        {/* Scroll-to-bottom floating button */}
        {!isAtBottom && (
          <button type="button" onClick={scrollToBottom}
            className="absolute bottom-3 right-3 z-20 w-9 h-9 rounded-full bg-[#3c4043] hover:bg-[#4a4d51] border border-white/15 shadow-xl flex items-center justify-center text-white transition-all animate-fade-in">
            {newMsgCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#8ab4f8] flex items-center justify-center text-[9px] font-bold text-[#202124]">
                {newMsgCount > 9 ? '9+' : newMsgCount}
              </span>
            )}
            <ChevronDown className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Reply quote preview */}
      <ReplyQuote msg={replyTo} onClear={() => setReplyTo(null)} />

      {/* File preview */}
      {filePreview && (
        <div className="mx-3 mb-2 p-2.5 rounded-2xl bg-[#3c4043] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {selectedFile?.type.startsWith('image/') ? (
              <img src={filePreview} alt="preview"
                className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center flex-shrink-0">
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

      {/* Input area — pill container */}
      <div className="px-3 pb-3 pt-1">
        <div className="flex items-end gap-2 bg-[#3c4043] rounded-[28px] px-3 py-2 focus-within:ring-2 focus-within:ring-[#8ab4f8]/30 transition-all">
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
          {/* Attach button — pill */}
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/8 hover:bg-white/15 text-[#9aa0a6] hover:text-white transition-all flex-shrink-0 self-end mb-0.5">
            <Paperclip className="w-3.5 h-3.5" />
          </button>

          {/* Textarea */}
          <textarea
            ref={inputRef} value={input} onChange={handleInputChange} onKeyDown={handleKeyDown}
            placeholder="Message everyone…"
            rows={1}
            className="flex-1 bg-transparent text-sm text-[#e8eaed] placeholder-[#9aa0a6] resize-none focus:outline-none py-1.5 min-h-[28px] max-h-[100px] leading-relaxed"
            style={{ height: 'auto' }}
            onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`; }}
          />

          {/* Send button — pill */}
          <button type="button" onClick={sendMessage} disabled={uploading || (!input.trim() && !selectedFile)}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-all flex-shrink-0 self-end mb-0.5 disabled:opacity-30
              bg-[#8ab4f8] hover:bg-[#aecbfa] disabled:bg-white/10 text-[#202124] disabled:text-[#9aa0a6]">
            {uploading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
