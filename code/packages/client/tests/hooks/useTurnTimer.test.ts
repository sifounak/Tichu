import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
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
    expect(result.current.totalSeconds).toBe(30);
    expect(result.current.isActive).toBe(true);
    expect(result.current.stage).toBe('blue');
  });
});
