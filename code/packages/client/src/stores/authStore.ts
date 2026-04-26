// REQ-F-AU10: Account auth state management
// REQ-F-AU14: Login with username or email
// REQ-F-AU16: Username as primary identity
// REQ-F-LU07: authReady flag prevents UI flash

import { create } from 'zustand';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/api\/?$/, '');

const USER_PROFILE_KEY = 'tichu_user_profile';

function saveUserProfile(user: AuthUser): void {
  try {
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(user));
  } catch {
    // localStorage full or unavailable — non-critical
  }
}

function loadUserProfile(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.userId === 'string' && typeof parsed.username === 'string') {
      return parsed as AuthUser;
    }
  } catch {
    // Corrupted data — ignore
  }
  return null;
}

function clearAuthStorage(): void {
  localStorage.removeItem('tichu_token');
  localStorage.removeItem('tichu_user_id');
  localStorage.removeItem(USER_PROFILE_KEY);
}

interface AuthUser {
  userId: string;
  username: string;
  email?: string;
  isGuest: boolean;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  // REQ-F-LU07: Prevents flash of guest UI while JWT is being verified
  authReady: boolean;

  // Actions
  initGuest: (userId: string, displayName: string) => Promise<void>;
  register: (params: { userId: string; username: string; email: string; password: string }) => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set, _get) => ({
  user: null,
  token: null,
  loading: false,
  error: null,
  authReady: false,

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
      const user: AuthUser = { userId: data.user.id, username: data.user.displayName, isGuest: data.user.isGuest };
      sessionStorage.setItem('tichu_user_id', user.userId);
      set({ user, loading: false, authReady: true });
    } catch (err: any) {
      set({ error: err.message, loading: false, authReady: true });
    }
  },

  // REQ-F-AU10: Register with username, email, password
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
        username: meData.user.username ?? meData.user.displayName,
        email: meData.user.email,
        isGuest: meData.user.isGuest,
      };
      set({ user, token, loading: false, authReady: true });
      saveUserProfile(user);
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  // REQ-F-AU14: Login with identifier (username or email) + password
  login: async (identifier, password) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Login failed');
      }
      const data = await res.json();
      localStorage.setItem('tichu_token', data.token);
      localStorage.setItem('tichu_user_id', data.userId);
      const user: AuthUser = { userId: data.userId, username: data.username, isGuest: false };
      set({ user, token: data.token, loading: false, authReady: true });
      saveUserProfile(user);
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  logout: () => {
    clearAuthStorage();
    sessionStorage.removeItem('tichu_user_id');
    sessionStorage.removeItem('tichu_player_name');
    set({ user: null, token: null, error: null, authReady: true });
  },

  // REQ-F-LU07: Load auth from storage, set authReady in all terminal paths
  loadFromStorage: () => {
    if (typeof window === 'undefined') {
      set({ authReady: true });
      return;
    }
    const token = localStorage.getItem('tichu_token');
    if (!token) {
      set({ authReady: true });
      return;
    }

    // Optimistic hydration: use cached profile to avoid loading flash
    const cachedUser = loadUserProfile();
    if (cachedUser) {
      set({ user: cachedUser, token, authReady: true });
    }

    // Background verification: confirm token is still valid
    fetch(`${API_BASE}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    }).then(res => {
      if (res.ok) return res.json();
      throw new Error('Token expired');
    }).then(data => {
      const freshUser: AuthUser = {
        userId: data.user.id,
        username: data.user.username ?? data.user.displayName,
        email: data.user.email,
        isGuest: data.user.isGuest,
      };
      set({ user: freshUser, token, authReady: true });
      saveUserProfile(freshUser);
    }).catch(() => {
      clearAuthStorage();
      sessionStorage.removeItem('tichu_user_id');
      set({ user: null, token: null, authReady: true });
    });
  },
}));
