// REQ-F-BW01: Bomb consideration window — 2s delay after each play while humans are active
'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useAnimationSettings } from './useAnimationSettings';
import { useUiStore } from '@/stores/uiStore';

interface UseBombWindowOptions {
  send: (msg: Record<string, unknown>) => boolean;
  anyHumanActive: boolean;
}

/**
 * REQ-F-BW01: Manages the bomb window lifecycle.
 *
 * After each play, a 2-second window gives the human player time to consider
 * playing a bomb. Non-bomb plays are queued during the window and sent when it
 * expires. Bomb plays bypass the window and send immediately.
 *
 * The window is skipped entirely when:
 * - All human players have finished (only bots remain with cards)
 * - Animation speed is set to 'off'
 */
export function useBombWindow({ send, anyHumanActive }: UseBombWindowOptions) {
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

  // Start bomb window — only if animations enabled and a human is still active
  const startWindow = useCallback(() => {
    if (!enabled || durations.bombWindow === 0 || !anyHumanActive) return;
    // Clear any existing timer
    if (timerRef.current) clearTimeout(timerRef.current);
    const durationMs = durations.bombWindow * 1000;
    startBombWindow(durationMs);
  }, [durations, enabled, anyHumanActive, startBombWindow]);

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

  return { startWindow, flushQueuedPlay, bombWindowActive, queuedPlay };
}
