// Verifies animation durations are available
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAnimationSettings } from '@/hooks/useAnimationSettings';

describe('useAnimationSettings', () => {
  it('returns enabled=true and 1x multiplier', () => {
    const { result } = renderHook(() => useAnimationSettings());
    expect(result.current.enabled).toBe(true);
    expect(result.current.multiplier).toBe(1);
    expect(result.current.durations.cardDeal).toBe(0.3);
  });

  it('has all required duration keys', () => {
    const { result } = renderHook(() => useAnimationSettings());
    const keys = Object.keys(result.current.durations);
    expect(keys).toContain('cardDeal');
    expect(keys).toContain('cardDealStagger');
    expect(keys).toContain('cardPlay');
    expect(keys).toContain('trickSweep');
    expect(keys).toContain('tichuBanner');
    expect(keys).toContain('scoreTally');
    expect(keys).toContain('invalidShake');
    expect(keys).toContain('bombEffect');
  });
});
