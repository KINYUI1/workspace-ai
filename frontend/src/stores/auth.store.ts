import { create } from 'zustand';
import { api } from '@/services/api';
import { connectSocket, disconnectSocket } from '@/services/socket';
import { clearCache } from '@/services/cache';

interface AuthState {
  token: string | null;
  user: { id: string; email: string; name: string } | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  desktopLogin: () => Promise<void>;
  logout: () => void;
  restoreSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const res = await api.login(email, password);
      const { token, user } = res.data!;
      api.setToken(token);
      localStorage.setItem('token', token);
      connectSocket(token);
      set({ token, user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (email, password, name) => {
    set({ isLoading: true });
    try {
      const res = await api.register(email, password, name);
      const { token, user } = res.data!;
      api.setToken(token);
      localStorage.setItem('token', token);
      connectSocket(token);
      set({ token, user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  /**
   * Desktop mode: auto-login by fetching a token from the local server.
   * No credentials needed — single-user local app.
   */
  desktopLogin: async () => {
    set({ isLoading: true });
    try {
      const res = await api.getDesktopToken();
      const { token, user } = res.data!;
      api.setToken(token);
      connectSocket(token);
      set({ token, user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      // Retry after a short delay (server might still be starting)
      setTimeout(async () => {
        try {
          const res = await api.getDesktopToken();
          const { token, user } = res.data!;
          api.setToken(token);
          connectSocket(token);
          set({ token, user, isAuthenticated: true, isLoading: false });
        } catch {
          set({ isLoading: false });
        }
      }, 2000);
    }
  },

  logout: () => {
    api.setToken(null);
    localStorage.removeItem('token');
    disconnectSocket();
    clearCache();
    set({ token: null, user: null, isAuthenticated: false });
  },

  restoreSession: () => {
    const token = localStorage.getItem('token');
    if (token) {
      api.setToken(token);
      connectSocket(token);
      // Fetch profile to validate token
      api
        .getProfile()
        .then((res) => {
          set({ token, user: res.data!, isAuthenticated: true });
        })
        .catch(() => {
          localStorage.removeItem('token');
          set({ token: null, user: null, isAuthenticated: false });
        });
    }
  },
}));
