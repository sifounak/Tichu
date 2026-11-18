// Verifies: REQ-F-UP01, UP03, REQ-NF-UP01
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { DEFAULT_USER_PREFERENCES } from '@tichu/shared';
import { usePreferencesStore } from '@/stores/preferencesStore';

const response = (preferences = DEFAULT_USER_PREFERENCES) => ({ ok: true, json: async () => ({ preferences }) });
const store = () => usePreferencesStore.getState();

describe('preferences store', () => {
  beforeEach(() => {
    store().setAccount(null, null);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response()));
  });
  async function account() {
    store().setAccount('alice', 'alice-token');
    await waitFor(() => expect(store().loading).toBe(false));
  }

  it('loads preferences and preserves saved values until the draft is saved', async () => {
    await account();
    await store().openDialog();
    store().updateDraft({ cardOrder: 'ascending', chatSound: false });
    expect(store().preferences).toEqual(DEFAULT_USER_PREFERENCES);
    const draft = store().draft!;
    vi.mocked(fetch).mockResolvedValueOnce(response(draft) as Response);
    expect(await store().save()).toBe(true);
    expect(store().preferences).toEqual(draft);
    expect(store().open).toBe(false);
    expect(vi.mocked(fetch).mock.lastCall?.[1]).toMatchObject({ method: 'PUT', body: JSON.stringify(draft) });
  });

  it('discards drafts on close and reloads server values on reopening', async () => {
    await account();
    await store().openDialog();
    store().updateDraft({ soundEnabled: false });
    store().closeDialog();
    expect(store().draft).toBeNull();
    await store().openDialog();
    expect(store().draft).toEqual(DEFAULT_USER_PREFERENCES);
  });

  it('retains a failed save draft and permits retry without applying it', async () => {
    await account();
    await store().openDialog();
    store().updateDraft({ cardOverlap: 'leftOnTop' });
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    expect(await store().save()).toBe(false);
    expect(store().open).toBe(true);
    expect(store().draft?.cardOverlap).toBe('leftOnTop');
    expect(store().preferences).toEqual(DEFAULT_USER_PREFERENCES);
    expect(store().error).toContain('retry Save');
    vi.mocked(fetch).mockResolvedValueOnce(response(store().draft!) as Response);
    expect(await store().save()).toBe(true);
  });

  it('blocks editing and duplicate saves while saving', async () => {
    await account();
    await store().openDialog();
    store().updateDraft({ cardOrder: 'ascending' });
    const draft = store().draft!;
    let finish!: (res: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const saving = store().save();
    store().closeDialog();
    store().updateDraft({ cardOrder: 'descending' });
    expect(await store().save()).toBe(false);
    expect(await store().load()).toBeNull();
    expect(store().open).toBe(true);
    expect(store().draft).toEqual(draft);
    finish(response(draft) as Response);
    await saving;
  });

  it('ignores stale load responses after another account loads', async () => {
    let finish!: (res: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    store().setAccount('alice', 'alice-token');
    store().setAccount('bob', 'bob-token');
    await waitFor(() => expect(store().loading).toBe(false));
    finish(response({ ...DEFAULT_USER_PREFERENCES, soundEnabled: false }) as Response);
    await Promise.resolve(); await Promise.resolve();
    expect(store().userId).toBe('bob');
    expect(store().preferences.soundEnabled).toBe(true);
  });

  it('ignores save responses after logout, including failures', async () => {
    await account();
    await store().openDialog();
    store().updateDraft({ soundEnabled: false });
    let fail!: (reason: Error) => void;
    vi.mocked(fetch).mockReturnValueOnce(new Promise((_, reject) => { fail = reject; }));
    const saving = store().save();
    store().setAccount(null, null);
    fail(new Error('offline'));
    expect(await saving).toBe(false);
    expect(store().error).toBeNull();
    expect(store().preferences).toEqual(DEFAULT_USER_PREFERENCES);
    expect(await store().load()).toBeNull();
    expect(await store().save()).toBe(false);
    await store().openDialog();
    expect(store().open).toBe(false);
    store().updateDraft({ soundEnabled: false });
    expect(store().draft).toBeNull();
  });

  it('does not allow editing after failed loading and can retry', async () => {
    await account();
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
    await store().openDialog();
    expect(store().draft).toBeNull();
    expect(store().error).toContain('load');
    await store().openDialog();
    expect(store().draft).toEqual(DEFAULT_USER_PREFERENCES);
    store().setAccount('alice', 'alice-token');
    expect(store().draft).not.toBeNull();
  });
});
