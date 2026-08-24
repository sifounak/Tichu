import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTurnTimer } from '@/hooks/useTurnTimer';

describe('useTurnTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a full timer immediately when the timer start timestamp changes', () => {
    const firstStartedAt = Date.now() - 20_000;
    const { result, rerender } = renderHook(
      ({ startedAt }) => useTurnTimer(startedAt, 30_000, 0),
      { initialProps: { startedAt: firstStartedAt } },
    );

    expect(result.current.remainingSeconds).toBe(10);

    const nextStartedAt = Date.now();
    rerender({ startedAt: nextStartedAt });

    expect(result.current.remainingSeconds).toBe(30);
    expect(result.current.remainingMs).toBe(30_000);
    expect(result.current.totalSeconds).toBe(30);
    expect(result.current.totalMs).toBe(30_000);
    expect(result.current.progressRatio).toBe(1);
    expect(result.current.isActive).toBe(true);
    expect(result.current.stage).toBe('blue');
  });

  it('shows zero and empty progress when the timer runs out', () => {
    const startedAt = Date.now();
    const { result } = renderHook(() => useTurnTimer(startedAt, 30_000, 0));

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(result.current.remainingSeconds).toBe(0);
    expect(result.current.remainingMs).toBe(0);
    expect(result.current.progressRatio).toBe(0);
    expect(result.current.isActive).toBe(true);
    expect(result.current.stage).toBe('red');
  });

  it('uses millisecond progress before the displayed second changes', () => {
    const startedAt = Date.now();
    const { result } = renderHook(() => useTurnTimer(startedAt, 30_000, 0));

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.remainingSeconds).toBe(30);
    expect(result.current.remainingMs).toBe(29_500);
    expect(result.current.progressRatio).toBeCloseTo(29_500 / 30_000);
  });
});
