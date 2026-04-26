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
  return Math.max(0, Math.ceil((localEndTime - Date.now()) / 1000));
}

function getStage(remaining: number, total: number): TimerStage {
  if (total <= 0) return 'blue';
  const ratio = remaining / total;
  if (ratio > 0.5) return 'blue';
  if (ratio > 0.17) return 'amber';
  return 'red';
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
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (turnTimerStartedAt == null || turnTimerDurationMs == null || turnTimerDurationMs <= 0) {
      setRemainingSeconds(0);
      return;
    }

    // Compute immediately on mount / value change
    const initial = computeRemaining(turnTimerStartedAt, turnTimerDurationMs, serverClockOffsetMs);
    setRemainingSeconds(initial);

    if (initial <= 0) return;

    const interval = setInterval(() => {
      const remaining = computeRemaining(turnTimerStartedAt, turnTimerDurationMs, serverClockOffsetMs);
      setRemainingSeconds(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [turnTimerStartedAt, turnTimerDurationMs, serverClockOffsetMs]);

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
