import { create } from 'zustand';
import {
  api,
  setStoredToken,
  setStoredRefreshToken,
  clearStoredTokens,
  getStoredToken,
} from '../lib/api';
import type { Player } from '@economy-game/shared';

interface AuthState {
  player: Player | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  setPlayer: (player: Player) => void;
  clearError: () => void;
}

type AuthStore = AuthState & AuthActions;

// Server returns access_token (not token) and no player object
interface AuthResponse {
  access_token: string;
  refresh_token: string;
  player_id: string;
  username: string;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  player: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<AuthResponse>('/auth/login', {
        email,
        password,
      });
      await setStoredToken(response.access_token);
      await setStoredRefreshToken(response.refresh_token);
      // Fetch player profile after storing token
      const player = await api.get<Player>('/players/me');
      set({
        player,
        token: response.access_token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      set({ isLoading: false, error: message, isAuthenticated: false });
      throw err;
    }
  },

  register: async (email: string, username: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.post('/auth/register', { email, username, password });
      set({ isLoading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore errors on logout
    }
    await clearStoredTokens();
    set({
      player: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  },

  refreshSession: async () => {
    set({ isLoading: true });
    try {
      const storedToken = await getStoredToken();
      if (!storedToken) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      const player = await api.get<Player>('/players/me');
      set({
        player,
        token: storedToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      await clearStoredTokens();
      set({
        player: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  setPlayer: (player: Player) => {
    set({ player });
  },

  clearError: () => {
    set({ error: null });
  },
}));
