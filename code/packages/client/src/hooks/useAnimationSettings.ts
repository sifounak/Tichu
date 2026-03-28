// Animation durations (fixed at normal speed)
'use client';

export interface AnimationDurations {
  cardDeal: number;      // 300ms base, 80ms stagger
  cardDealStagger: number;
  cardPlay: number;      // 250ms
  cardLift: number;      // 150ms
  trickSweep: number;    // 400ms
  tichuBanner: number;   // 500ms
  tichuDismiss: number;  // 1000ms
  scoreTally: number;    // 1000ms
  invalidShake: number;  // 300ms
  bombEffect: number;    // 600ms
  cardPass: number;      // 400ms
  bombWindow: number;    // REQ-F-BW01: 2000ms bomb consideration window
}

const DURATIONS: AnimationDurations = {
  cardDeal: 0.3,
  cardDealStagger: 0.08,
  cardPlay: 0.25,
  cardLift: 0.15,
  trickSweep: 0.4,
  tichuBanner: 0.5,
  tichuDismiss: 1,
  scoreTally: 1,
  invalidShake: 0.3,
  bombEffect: 0.6,
  cardPass: 0.4,
  bombWindow: 2.0,
};

const RESULT = { durations: DURATIONS, enabled: true, multiplier: 1 };

export function useAnimationSettings() {
  return RESULT;
}
