import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401: refresh token and retry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const apiURL = import.meta.env.VITE_API_URL || '/api/v1';
        const { data } = await axios.post(
          `${apiURL}/auth/refresh-token`,
          {},
          { withCredentials: true }
        );
        const newToken = data.data.accessToken;
        localStorage.setItem('accessToken', newToken);

        // Keep the live socket's auth in sync so reconnects use the fresh token
        const { getSocket } = await import('./socket');
        const sock = getSocket();
        if (sock) sock.auth = { token: newToken };

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch {
        localStorage.removeItem('accessToken');
        // Only redirect if on a protected page — never redirect from public pages
        const path = window.location.pathname;
        const publicPaths = ['/', '/login', '/register'];
        const isPublic = publicPaths.includes(path) || publicPaths.some(p => p !== '/' && path.startsWith(p));
        if (!isPublic) {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
