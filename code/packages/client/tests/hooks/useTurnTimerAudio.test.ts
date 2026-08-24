import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTurnTimerAudio } from '@/hooks/useTurnTimerAudio';
import type { SoundEvent } from '@/hooks/useSoundEffects';

describe('useTurnTimerAudio', () => {
  const baseProps = {
    enabled: true,
    remainingSeconds: 11,
    totalSeconds: 30,
    turnTimerStartedAt: 1_000,
    turnTimerDurationMs: 30_000,
    playSound: vi.fn<(event: SoundEvent) => void>(),
  };

  it('plays countdown beeps at the requested remaining seconds once per timer', () => {
    const playSound = vi.fn<(event: SoundEvent) => void>();
    const { rerender } = renderHook(
      (props: typeof baseProps) => useTurnTimerAudio(props),
      { initialProps: { ...baseProps, playSound } },
    );

    for (const remainingSeconds of [10, 10, 5, 4, 3, 2, 1]) {
      rerender({ ...baseProps, remainingSeconds, playSound });
    }

    expect(playSound).toHaveBeenCalledTimes(6);
    expect(playSound).toHaveBeenNthCalledWith(1, 'timerCountdown');
    expect(playSound).toHaveBeenNthCalledWith(6, 'timerCountdown');
  });

  it('plays out-of-time once when the active timer reaches zero', () => {
    const playSound = vi.fn<(event: SoundEvent) => void>();
    const { rerender } = renderHook(
      (props: typeof baseProps) => useTurnTimerAudio(props),
      { initialProps: { ...baseProps, remainingSeconds: 1, playSound } },
    );

    rerender({ ...baseProps, remainingSeconds: 0, playSound });
    rerender({ ...baseProps, remainingSeconds: 0, playSound });

    expect(playSound).toHaveBeenCalledTimes(2);
    expect(playSound).toHaveBeenNthCalledWith(1, 'timerCountdown');
    expect(playSound).toHaveBeenNthCalledWith(2, 'timerOutOfTime');
  });

  it('does not play sounds while disabled', () => {
    const playSound = vi.fn<(event: SoundEvent) => void>();

    renderHook(() => useTurnTimerAudio({
      ...baseProps,
      enabled: false,
      remainingSeconds: 10,
      playSound,
    }));

    expect(playSound).not.toHaveBeenCalled();
  });

  it('allows countdown beeps again when a new timer starts', () => {
    const playSound = vi.fn<(event: SoundEvent) => void>();
    const { rerender } = renderHook(
      (props: typeof baseProps) => useTurnTimerAudio(props),
      { initialProps: { ...baseProps, remainingSeconds: 10, playSound } },
    );

    rerender({ ...baseProps, remainingSeconds: 10, turnTimerStartedAt: 2_000, playSound });

    expect(playSound).toHaveBeenCalledTimes(2);
    expect(playSound).toHaveBeenNthCalledWith(1, 'timerCountdown');
    expect(playSound).toHaveBeenNthCalledWith(2, 'timerCountdown');
  });
});
