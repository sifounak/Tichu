// REQ-F-TT06: Client-side turn timer countdown hook

import { useState, useEffect } from 'react';

export type TimerStage = 'blue' | 'amber' | 'red';

export interface TurnTimerState {
  remainingSeconds: number;
  totalSeconds: number;
  isActive: boolean;
  stage: TimerStage;
}

const INACTIVE: TurnTimerState = {
  remainingSeconds: 0,
  totalSeconds: 0,
  isActive: false,
  stage: 'blue',
};

function computeRemaining(startedAt: number, durationMs: number, clockOffsetMs: number): number {
  // Adjust server timestamp to local time by subtracting clock offset
  const localEndTime = startedAt + durationMs - clockOffsetMs;
  const remainingMs = Math.min(durationMs, Math.max(0, localEndTime - Date.now()));
  return Math.ceil(remainingMs / 1000);
}

function getStage(remaining: number, total: number): TimerStage {
  if (total <= 0) return 'blue';
  if (remaining > 15) return 'blue';
  if (remaining > 5) return 'amber';
  return 'red';
}

function getTimerKey(
  turnTimerStartedAt: number | null | undefined,
  turnTimerDurationMs: number | null | undefined,
  serverClockOffsetMs: number,
): string {
  return `${turnTimerStartedAt ?? 'none'}:${turnTimerDurationMs ?? 'none'}:${serverClockOffsetMs}`;
}

function getInitialRemaining(
  turnTimerStartedAt: number | null | undefined,
  turnTimerDurationMs: number | null | undefined,
  serverClockOffsetMs: number,
): number {
  if (turnTimerStartedAt == null || turnTimerDurationMs == null || turnTimerDurationMs <= 0) {
    return 0;
  }

  return computeRemaining(turnTimerStartedAt, turnTimerDurationMs, serverClockOffsetMs);
}

/**
 * REQ-F-TT06: Computes a local countdown from server-provided timer timestamps.
 *
 * Runs a 1-second interval that derives remaining time from
 * `Date.now() - turnTimerStartedAt`. Resets when turnTimerStartedAt changes.
 */
export function useTurnTimer(
  turnTimerStartedAt: number | null | undefined,
  turnTimerDurationMs: number | null | undefined,
  serverClockOffsetMs: number = 0,
): TurnTimerState {
  const timerKey = getTimerKey(turnTimerStartedAt, turnTimerDurationMs, serverClockOffsetMs);
  const [timerState, setTimerState] = useState(() => ({
    key: timerKey,
    remainingSeconds: getInitialRemaining(turnTimerStartedAt, turnTimerDurationMs, serverClockOffsetMs),
  }));

  const remainingSeconds = timerState.key === timerKey
    ? timerState.remainingSeconds
    : getInitialRemaining(turnTimerStartedAt, turnTimerDurationMs, serverClockOffsetMs);

  useEffect(() => {
    if (turnTimerStartedAt == null || turnTimerDurationMs == null || turnTimerDurationMs <= 0) {
      setTimerState({ key: timerKey, remainingSeconds: 0 });
      return;
    }

    // Compute immediately on mount / value change
    const initial = computeRemaining(turnTimerStartedAt, turnTimerDurationMs, serverClockOffsetMs);
    setTimerState({ key: timerKey, remainingSeconds: initial });

    if (initial <= 0) return;

    const interval = setInterval(() => {
      const remaining = computeRemaining(turnTimerStartedAt, turnTimerDurationMs, serverClockOffsetMs);
      setTimerState({ key: timerKey, remainingSeconds: remaining });
      if (remaining <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [turnTimerStartedAt, turnTimerDurationMs, serverClockOffsetMs, timerKey]);

  if (turnTimerStartedAt == null || turnTimerDurationMs == null || turnTimerDurationMs <= 0) {
    return INACTIVE;
  }

  const totalSeconds = Math.ceil(turnTimerDurationMs / 1000);

  return {
    remainingSeconds,
    totalSeconds,
    isActive: remainingSeconds > 0,
    stage: getStage(remainingSeconds, totalSeconds),
  };
}
