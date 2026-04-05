// REQ-F-BW01: Bomb consideration window — 2.5s delay after each play
'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useAnimationSettings } from './useAnimationSettings';
import { useUiStore } from '@/stores/uiStore';

interface UseBombWindowOptions {
  send: (msg: Record<string, unknown>) => boolean;
}

/**
 * REQ-F-BW01: Manages the bomb window lifecycle.
 *
 * After each play, a 2.5-second window gives players time to consider
 * playing a bomb. Non-bomb plays are queued during the window and sent when it
 * expires. Bomb plays bypass the window and send immediately.
 *
 * The window is skipped entirely when:
 * - Animation speed is set to 'off'
 */
export function useBombWindow({ send }: UseBombWindowOptions) {
  const { durations, enabled } = useAnimationSettings();
  const bombWindowActive = useUiStore((s) => s.bombWindowActive);
  const bombWindowEndTime = useUiStore((s) => s.bombWindowEndTime);
  const queuedPlay = useUiStore((s) => s.queuedPlay);
  const startBombWindow = useUiStore((s) => s.startBombWindow);
  const clearBombWindow = useUiStore((s) => s.clearBombWindow);
  const clearQueuedPlay = useUiStore((s) => s.clearQueuedPlay);
  const clearSelection = useUiStore((s) => s.clearSelection);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flush queued play and clear window
  const flushQueuedPlay = useCallback(() => {
    const queued = useUiStore.getState().queuedPlay;
    clearBombWindow();
    clearQueuedPlay();
    if (queued) {
      send({ type: 'PLAY_CARDS', ...queued });
      clearSelection();
    }
  }, [send, clearBombWindow, clearQueuedPlay, clearSelection]);

  // Start bomb window — only if animations enabled
  const startWindow = useCallback(() => {
    if (!enabled || durations.bombWindow === 0) return;
    // Clear any existing timer
    if (timerRef.current) clearTimeout(timerRef.current);
    const durationMs = durations.bombWindow * 1000;
    startBombWindow(durationMs);
  }, [durations, enabled, startBombWindow]);

  // Timer effect: schedule flush when bomb window is active
  useEffect(() => {
    if (!bombWindowActive || !bombWindowEndTime) return;
    const remaining = bombWindowEndTime - Date.now();
    if (remaining <= 0) {
      flushQueuedPlay();
      return;
    }
    timerRef.current = setTimeout(flushQueuedPlay, remaining);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [bombWindowActive, bombWindowEndTime, flushQueuedPlay]);

  // Cancel queued play — returns to normal Play button state
  const cancelQueuedPlay = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    clearBombWindow();
    clearQueuedPlay();
  }, [clearBombWindow, clearQueuedPlay]);

  return { startWindow, flushQueuedPlay, cancelQueuedPlay, bombWindowActive, bombWindowEndTime, queuedPlay };
}
