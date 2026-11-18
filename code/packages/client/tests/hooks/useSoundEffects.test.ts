// Verifies: REQ-F-UP07
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_USER_PREFERENCES, type UserPreferences } from '@tichu/shared';
import { isSoundEnabled, useSoundEffects, type SoundEvent } from '@/hooks/useSoundEffects';
import { usePreferencesStore } from '@/stores/preferencesStore';

const events: SoundEvent[] = ['dragon', 'phoenix', 'dog', 'bomb', 'tichu', 'grandTichu', 'blindGrandTichu', 'yourTurn', 'timerCountdown', 'timerOutOfTime', 'chat'];
describe('sound preferences', () => {
  beforeEach(() => usePreferencesStore.setState({ preferences: { ...DEFAULT_USER_PREFERENCES } }));
  it('master sound controls every sound', () => {
    for (const event of events) {
      expect(isSoundEnabled(event, { ...DEFAULT_USER_PREFERENCES })).toBe(true);
      expect(isSoundEnabled(event, { ...DEFAULT_USER_PREFERENCES, soundEnabled: false })).toBe(false);
    }
  });
  it.each([
    ['cardsAndWagersSound', ['dragon', 'phoenix', 'dog', 'bomb', 'tichu', 'grandTichu', 'blindGrandTichu']],
    ['yourTurnSound', ['yourTurn']], ['timerWarningSound', ['timerCountdown', 'timerOutOfTime']], ['chatSound', ['chat']],
  ] as const)('isolates the %s category', (field, mutedEvents) => {
    for (const event of events) expect(isSoundEnabled(event, { ...DEFAULT_USER_PREFERENCES, [field]: false } as UserPreferences)).toBe(!(mutedEvents as readonly string[]).includes(event));
  });

  it('applies saved switches immediately in HTMLAudio fallback and ignores legacy mute/volume', () => {
    vi.stubGlobal('AudioContext', undefined);
    const play = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('Audio', vi.fn(function () { return { paused: true, ended: false, preload: '', volume: 0, currentTime: 0, play }; }));
    localStorage.setItem('tichu_sound_muted', 'true'); localStorage.setItem('tichu_sound_volume', '0');
    const { result } = renderHook(useSoundEffects);
    act(() => result.current.playSound('chat'));
    expect(play).toHaveBeenCalledTimes(1);
    usePreferencesStore.setState({ preferences: { ...DEFAULT_USER_PREFERENCES, chatSound: false } });
    act(() => result.current.playSound('chat'));
    expect(play).toHaveBeenCalledTimes(1);
    act(() => result.current.playSound('yourTurn'));
    expect(play).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals(); localStorage.clear();
  });

  it('uses the same sound gate for Web Audio playback', async () => {
    const start = vi.fn(); const resume = vi.fn(); const close = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(4) }));
    vi.stubGlobal('AudioContext', vi.fn(function () {
      return { state: 'suspended', destination: {}, createGain: () => ({ gain: { value: 0 }, connect: vi.fn() }),
        decodeAudioData: async () => ({}), createBufferSource: () => ({ buffer: null, connect: vi.fn(), start }), resume, close };
    }));
    const { result, unmount } = renderHook(useSoundEffects);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(events.length));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    act(() => result.current.playSound('timerCountdown'));
    expect(start).toHaveBeenCalledOnce(); expect(resume).toHaveBeenCalledOnce();
    usePreferencesStore.setState({ preferences: { ...DEFAULT_USER_PREFERENCES, timerWarningSound: false } });
    act(() => result.current.playSound('timerOutOfTime'));
    expect(start).toHaveBeenCalledOnce();
    unmount(); expect(close).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
