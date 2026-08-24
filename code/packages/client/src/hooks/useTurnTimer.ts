// REQ-F-TT06: Client-side turn timer countdown hook

import { useState, useEffect } from 'react';

export type TimerStage = 'blue' | 'amber' | 'red';

export interface TurnTimerState {
  remainingMs: number;
  totalMs: number;
  remainingSeconds: number;
  totalSeconds: number;
  progressRatio: number;
  isActive: boolean;
  stage: TimerStage;
}

const INACTIVE: TurnTimerState = {
  remainingMs: 0,
  totalMs: 0,
  remainingSeconds: 0,
  totalSeconds: 0,
  progressRatio: 0,
  isActive: false,
  stage: 'blue',
};

function computeRemainingMs(startedAt: number, durationMs: number, clockOffsetMs: number): number {
  // Adjust server timestamp to local time by subtracting clock offset
  const localEndTime = startedAt + durationMs - clockOffsetMs;
  return Math.min(durationMs, Math.max(0, localEndTime - Date.now()));
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

  return computeRemainingMs(turnTimerStartedAt, turnTimerDurationMs, serverClockOffsetMs);
}

/**
 * REQ-F-TT06: Computes a local countdown from server-provided timer timestamps.
 *
 * Runs a short interval that derives remaining time from server timestamps.
 * Resets when turnTimerStartedAt changes.
 */
export function useTurnTimer(
  turnTimerStartedAt: number | null | undefined,
  turnTimerDurationMs: number | null | undefined,
  serverClockOffsetMs: number = 0,
): TurnTimerState {
  const timerKey = getTimerKey(turnTimerStartedAt, turnTimerDurationMs, serverClockOffsetMs);
  const [timerState, setTimerState] = useState(() => ({
    key: timerKey,
    remainingMs: getInitialRemaining(turnTimerStartedAt, turnTimerDurationMs, serverClockOffsetMs),
  }));

  const remainingMs = timerState.key === timerKey
    ? timerState.remainingMs
    : getInitialRemaining(turnTimerStartedAt, turnTimerDurationMs, serverClockOffsetMs);

  useEffect(() => {
    if (turnTimerStartedAt == null || turnTimerDurationMs == null || turnTimerDurationMs <= 0) {
      setTimerState({ key: timerKey, remainingMs: 0 });
      return;
    }

    // Compute immediately on mount / value change
    const initial = computeRemainingMs(turnTimerStartedAt, turnTimerDurationMs, serverClockOffsetMs);
    setTimerState({ key: timerKey, remainingMs: initial });

    if (initial <= 0) return;

    const interval = setInterval(() => {
      const remaining = computeRemainingMs(turnTimerStartedAt, turnTimerDurationMs, serverClockOffsetMs);
      setTimerState({ key: timerKey, remainingMs: remaining });
      if (remaining <= 0) clearInterval(interval);
    }, 100);

    return () => clearInterval(interval);
  }, [turnTimerStartedAt, turnTimerDurationMs, serverClockOffsetMs, timerKey]);

  if (turnTimerStartedAt == null || turnTimerDurationMs == null || turnTimerDurationMs <= 0) {
    return INACTIVE;
  }

  const totalMs = turnTimerDurationMs;
  const progressRatio = Math.min(1, Math.max(0, remainingMs / totalMs));
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const totalSeconds = Math.ceil(turnTimerDurationMs / 1000);

  return {
    remainingMs,
    totalMs,
    remainingSeconds,
    totalSeconds,
    progressRatio,
    isActive: true,
    stage: getStage(remainingSeconds, totalSeconds),
  };
}
