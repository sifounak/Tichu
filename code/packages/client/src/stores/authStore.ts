// REQ-F-AU01: Guest access state management
// REQ-F-AU02: Account auth state management

import { create } from 'zustand';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface AuthUser {
  userId: string;
  displayName: string;
  email?: string;
  isGuest: boolean;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;

  // Actions
  initGuest: (userId: string, displayName: string) => Promise<void>;
  register: (params: { userId: string; email: string; password: string; displayName: string }) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  loading: false,
  error: null,

  initGuest: async (userId, displayName) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/auth/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, displayName }),
      });
      if (!res.ok) throw new Error('Failed to initialize guest');
      const data = await res.json();
      const user: AuthUser = { userId: data.user.id, displayName: data.user.displayName, isGuest: data.user.isGuest };
      sessionStorage.setItem('tichu_user_id', user.userId);
      set({ user, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  register: async (params) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Registration failed');
      }
      const data = await res.json();
      const token = data.token;
      localStorage.setItem('tichu_token', token);
      localStorage.setItem('tichu_user_id', data.userId);

      // Fetch full user info
      const meRes = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const meData = await meRes.json();
      const user: AuthUser = {
        userId: meData.user.id,
        displayName: meData.user.displayName,
        email: meData.user.email,
        isGuest: meData.user.isGuest,
      };
      set({ user, token, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Login failed');
      }
      const data = await res.json();
      localStorage.setItem('tichu_token', data.token);
      localStorage.setItem('tichu_user_id', data.userId);
      const user: AuthUser = { userId: data.userId, displayName: data.displayName, email, isGuest: false };
      set({ user, token: data.token, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('tichu_token');
    localStorage.removeItem('tichu_user_id');
    set({ user: null, token: null, error: null });
  },

  loadFromStorage: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('tichu_token');
    if (token) {
      // Verify token by fetching /me
      fetch(`${API_BASE}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      }).then(res => {
        if (res.ok) return res.json();
        throw new Error('Token expired');
      }).then(data => {
        set({
          user: {
            userId: data.user.id,
            displayName: data.user.displayName,
            email: data.user.email,
            isGuest: data.user.isGuest,
          },
          token,
        });
      }).catch(() => {
        localStorage.removeItem('tichu_token');
        localStorage.removeItem('tichu_user_id');
        set({ token: null });
      });
    }
  },
}));
