'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { PreferencesDialog } from './PreferencesDialog';

// REQ-NF-UP01: Synchronize identities immediately, including logout during pending requests.
export function PreferencesController() {
  useEffect(() => {
    const syncAccount = () => {
      const { user, token, authReady } = useAuthStore.getState();
      const account = authReady && user && !user.isGuest && token;
      usePreferencesStore.getState().setAccount(account ? user.userId : null, account ? token : null);
    };
    syncAccount();
    const unsubscribe = useAuthStore.subscribe(syncAccount);
    const refresh = () => {
      const store = usePreferencesStore.getState();
      if (!store.open && !store.saving) void store.load();
    };
    window.addEventListener('focus', refresh);
    return () => { unsubscribe(); window.removeEventListener('focus', refresh); };
  }, []);
  return <PreferencesDialog />;
}
