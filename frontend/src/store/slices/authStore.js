import { create } from 'zustand';
import api from '../../services/api.js';
import { initSocket, disconnectSocket } from '../../services/socket.js';

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  initialize: async () => {
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.data.user, isAuthenticated: true, isLoading: false });
      // Defer socket init to the next tick so any refreshed token is fully
      // written to localStorage by the axios interceptor before socket reads it.
      setTimeout(initSocket, 0);
    } catch {
      localStorage.removeItem('accessToken');
      set({ isLoading: false });
    }
  },

  register: async (credentials) => {
    const { data } = await api.post('/auth/register', credentials);
    const { user, accessToken } = data.data;
    localStorage.setItem('accessToken', accessToken);
    set({ user, isAuthenticated: true });
    initSocket();
    return user;
  },

  login: async (credentials) => {
    const { data } = await api.post('/auth/login', credentials);
    const { user, accessToken } = data.data;
    localStorage.setItem('accessToken', accessToken);
    set({ user, isAuthenticated: true });
    initSocket();
    return user;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('accessToken');
      disconnectSocket();
      set({ user: null, isAuthenticated: false });
    }
  },
}));

export default useAuthStore;
