// Verifies: REQ-F-UP02, REQ-NF-UP01
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_USER_PREFERENCES } from '@tichu/shared';
import { PreferencesController } from '@/components/preferences/PreferencesController';
import { useAuthStore } from '@/stores/authStore';
import { usePreferencesStore } from '@/stores/preferencesStore';

describe('Preferences account lifecycle', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null, authReady: true });
    usePreferencesStore.getState().setAccount(null, null);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ preferences: DEFAULT_USER_PREFERENCES }) }));
  });
  it('loads on login, refreshes only when closed, and clears on logout', async () => {
    const { unmount } = render(<PreferencesController />);
    act(() => useAuthStore.setState({ user: { userId: 'alice', username: 'Alice', isGuest: false }, token: 'token', authReady: true }));
    await waitFor(() => expect(usePreferencesStore.getState().loading).toBe(false));
    expect(fetch).toHaveBeenCalledOnce();
    fireEvent(window, new Event('focus'));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await act(() => usePreferencesStore.getState().openDialog());
    const count = vi.mocked(fetch).mock.calls.length;
    fireEvent(window, new Event('focus'));
    expect(fetch).toHaveBeenCalledTimes(count);
    act(() => useAuthStore.setState({ user: null, token: null }));
    expect(usePreferencesStore.getState().userId).toBeNull();
    expect(usePreferencesStore.getState().open).toBe(false);
    unmount();
    fireEvent(window, new Event('focus'));
    expect(fetch).toHaveBeenCalledTimes(count);
  });
  it('does not load guest preferences', () => {
    useAuthStore.setState({ user: { userId: 'guest', username: 'Guest', isGuest: true }, token: null });
    render(<PreferencesController />);
    expect(fetch).not.toHaveBeenCalled();
  });
});
