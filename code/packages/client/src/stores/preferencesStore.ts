'use client';

import { create } from 'zustand';
import { DEFAULT_USER_PREFERENCES, UserPreferencesSchema, type UserPreferences } from '@tichu/shared';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/api\/?$/, '');
let requestVersion = 0;

interface PreferencesState {
  userId: string | null;
  token: string | null;
  preferences: UserPreferences;
  draft: UserPreferences | null;
  open: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  setAccount: (userId: string | null, token: string | null) => void;
  load: () => Promise<UserPreferences | null>;
  openDialog: () => Promise<void>;
  closeDialog: () => void;
  updateDraft: (changes: Partial<UserPreferences>) => void;
  save: () => Promise<boolean>;
}

// REQ-F-UP03, REQ-NF-UP01: Drafts never change saved preferences. Ignore stale account requests.
export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  userId: null, token: null, preferences: { ...DEFAULT_USER_PREFERENCES }, draft: null,
  open: false, loading: false, saving: false, error: null,
  setAccount: (userId, token) => {
    if (get().userId === userId && get().token === token) return;
    requestVersion++;
    set({ userId, token, preferences: { ...DEFAULT_USER_PREFERENCES }, draft: null,
      open: false, loading: false, saving: false, error: null });
    if (userId && token) void get().load();
  },
  load: async () => {
    const { userId, token, saving } = get();
    if (!userId || !token || saving) return null;
    const version = ++requestVersion;
    set({ loading: true, error: null });
    try {
      const response = await fetch(`${API_BASE}/api/users/me/preferences`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Could not load preferences. Please retry.');
      const preferences = UserPreferencesSchema.parse((await response.json()).preferences);
      if (version !== requestVersion) return null;
      set({ preferences, loading: false });
      return preferences;
    } catch {
      if (version === requestVersion) set({ loading: false, error: 'Could not load preferences. Please retry.' });
      return null;
    }
  },
  openDialog: async () => {
    if (!get().userId || !get().token || get().saving) return;
    set({ open: true, draft: null, error: null });
    const preferences = await get().load();
    if (preferences && get().open) set({ draft: { ...preferences } });
  },
  closeDialog: () => {
    if (!get().saving) set({ open: false, draft: null, error: null });
  },
  updateDraft: (changes) => {
    const { draft, saving } = get();
    if (draft && !saving) set({ draft: { ...draft, ...changes }, error: null });
  },
  save: async () => {
    const { userId, token, draft, saving } = get();
    if (!userId || !token || !draft || saving) return false;
    const version = ++requestVersion;
    set({ saving: true, error: null });
    try {
      const response = await fetch(`${API_BASE}/api/users/me/preferences`, {
        method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!response.ok) throw new Error('Could not save preferences');
      const preferences = UserPreferencesSchema.parse((await response.json()).preferences);
      if (version !== requestVersion) return false;
      set({ preferences, draft: null, open: false, saving: false });
      return true;
    } catch {
      if (version === requestVersion) set({ saving: false, error: 'Could not save preferences. Your changes are still here; please retry Save.' });
      return false;
    }
  },
}));
