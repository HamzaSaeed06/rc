import { io } from 'socket.io-client';

let socket = null;

export const initSocket = () => {
  const token = localStorage.getItem('accessToken');
  if (!token) return null;

  if (socket?.connected) return socket;

  const socketUrl = import.meta.env.VITE_SOCKET_URL || '/';
  socket = io(socketUrl, {
    // Use a callback so every reconnect reads the *current* (possibly refreshed)
    // access token from localStorage instead of a stale captured value.
    auth: (cb) => cb({ token: localStorage.getItem('accessToken') }),
    // Include polling as a fallback for corporate networks/proxies that block WebSocket.
    transports: ['polling', 'websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => console.info('[Socket] Connected:', socket.id));
  socket.on('disconnect', (reason) => console.warn('[Socket] Disconnected:', reason));
  socket.on('connect_error', (err) => console.error('[Socket] Error:', err.message));

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
