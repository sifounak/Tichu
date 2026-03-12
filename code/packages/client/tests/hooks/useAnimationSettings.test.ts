// Verifies: REQ-NF-U02 — Configurable animation speed + prefers-reduced-motion
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAnimationSettings } from '@/hooks/useAnimationSettings';
import { useUiStore } from '@/stores/uiStore';

describe('useAnimationSettings (REQ-NF-U02)', () => {
  beforeEach(() => {
    useUiStore.setState({ animationSpeed: 'normal' });
  });

  it('returns enabled=true and 1x multiplier at normal speed', () => {
    const { result } = renderHook(() => useAnimationSettings());
    expect(result.current.enabled).toBe(true);
    expect(result.current.multiplier).toBe(1);
    expect(result.current.durations.cardDeal).toBe(0.3);
  });

  it('returns 1.5x durations at slow speed', () => {
    useUiStore.setState({ animationSpeed: 'slow' });
    const { result } = renderHook(() => useAnimationSettings());
    expect(result.current.multiplier).toBe(1.5);
    expect(result.current.durations.cardDeal).toBeCloseTo(0.45);
    expect(result.current.durations.cardPlay).toBeCloseTo(0.375);
  });

  it('returns 0.5x durations at fast speed', () => {
    useUiStore.setState({ animationSpeed: 'fast' });
    const { result } = renderHook(() => useAnimationSettings());
    expect(result.current.multiplier).toBe(0.5);
    expect(result.current.durations.cardDeal).toBe(0.15);
  });

  it('returns enabled=false and 0 durations when off', () => {
    useUiStore.setState({ animationSpeed: 'off' });
    const { result } = renderHook(() => useAnimationSettings());
    expect(result.current.enabled).toBe(false);
    expect(result.current.multiplier).toBe(0);
    expect(result.current.durations.cardDeal).toBe(0);
    expect(result.current.durations.bombEffect).toBe(0);
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
