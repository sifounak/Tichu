import { useEffect, useRef } from 'react';
import type { SoundEvent } from './useSoundEffects';

const COUNTDOWN_BEEP_SECONDS = new Set([10, 5, 4, 3, 2, 1]);

export interface UseTurnTimerAudioOptions {
  enabled: boolean;
  remainingSeconds: number;
  totalSeconds: number;
  turnTimerStartedAt: number | null | undefined;
  turnTimerDurationMs: number | null | undefined;
  playSound: (event: SoundEvent) => void;
  playOutOfTime?: boolean;
}

function getTimerAudioKey(
  turnTimerStartedAt: number | null | undefined,
  turnTimerDurationMs: number | null | undefined,
): string {
  return `${turnTimerStartedAt ?? 'none'}:${turnTimerDurationMs ?? 'none'}`;
}

export function useTurnTimerAudio({
  enabled,
  remainingSeconds,
  totalSeconds,
  turnTimerStartedAt,
  turnTimerDurationMs,
  playSound,
  playOutOfTime = true,
}: UseTurnTimerAudioOptions): void {
  const timerKey = getTimerAudioKey(turnTimerStartedAt, turnTimerDurationMs);
  const previousTimerKeyRef = useRef(timerKey);
  const playedCountdownSecondsRef = useRef<Set<number>>(new Set());
  const playedOutOfTimeRef = useRef(false);

  useEffect(() => {
    if (previousTimerKeyRef.current !== timerKey) {
      previousTimerKeyRef.current = timerKey;
      playedCountdownSecondsRef.current = new Set();
      playedOutOfTimeRef.current = false;
    }

    if (!enabled || totalSeconds <= 0 || turnTimerStartedAt == null || turnTimerDurationMs == null) {
      return;
    }

    if (remainingSeconds <= 0) {
      if (playOutOfTime && !playedOutOfTimeRef.current) {
        playedOutOfTimeRef.current = true;
        playSound('timerOutOfTime');
      }
      return;
    }

    if (
      COUNTDOWN_BEEP_SECONDS.has(remainingSeconds) &&
      !playedCountdownSecondsRef.current.has(remainingSeconds)
    ) {
      playedCountdownSecondsRef.current.add(remainingSeconds);
      playSound('timerCountdown');
    }
  }, [
    enabled,
    playSound,
    playOutOfTime,
    remainingSeconds,
    timerKey,
    totalSeconds,
    turnTimerDurationMs,
    turnTimerStartedAt,
  ]);
}
