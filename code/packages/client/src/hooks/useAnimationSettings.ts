// REQ-NF-U02: Configurable animation speed + prefers-reduced-motion
'use client';

import { useMemo } from 'react';
import { useUiStore } from '@/stores/uiStore';

/** Speed multipliers for each setting */
const SPEED_MULTIPLIERS: Record<string, number> = {
  slow: 1.5,
  normal: 1.0,
  fast: 0.5,
  off: 0,
};

export interface AnimationDurations {
  cardDeal: number;      // 300ms base, 80ms stagger
  cardDealStagger: number;
  cardPlay: number;      // 250ms
  cardLift: number;      // 150ms
  trickSweep: number;    // 400ms
  tichuBanner: number;   // 500ms
  tichuDismiss: number;  // 2000ms
  scoreTally: number;    // 1000ms
  invalidShake: number;  // 300ms
  bombEffect: number;    // 600ms
  cardPass: number;      // 400ms
}

const BASE_DURATIONS: AnimationDurations = {
  cardDeal: 0.3,
  cardDealStagger: 0.08,
  cardPlay: 0.25,
  cardLift: 0.15,
  trickSweep: 0.4,
  tichuBanner: 0.5,
  tichuDismiss: 2,
  scoreTally: 1,
  invalidShake: 0.3,
  bombEffect: 0.6,
  cardPass: 0.4,
};

export function useAnimationSettings() {
  const animationSpeed = useUiStore((s) => s.animationSpeed);

  return useMemo(() => {
    const mul = SPEED_MULTIPLIERS[animationSpeed] ?? 1;
    const durations = {} as AnimationDurations;
    for (const [key, base] of Object.entries(BASE_DURATIONS)) {
      (durations as Record<string, number>)[key] = base * mul;
    }
    return {
      durations,
      enabled: animationSpeed !== 'off',
      multiplier: mul,
    };
  }, [animationSpeed]);
}
