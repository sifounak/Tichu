import { describe, it, expect } from 'vitest';
import { RoundEventTracker } from '../../src/game/round-event-tracker.js';

describe('RoundEventTracker serialization', () => {
  it('round-trips an empty tracker', () => {
    const tracker = new RoundEventTracker();
    const snapshot = tracker.serialize();
    const restored = RoundEventTracker.restore(snapshot);
    expect(restored.serialize()).toEqual(snapshot);
  });

  it('preserves summaries and round number', () => {
    const tracker = new RoundEventTracker();
    tracker.reset(3);
    const snapshot = tracker.serialize();
    expect(snapshot.currentRoundNumber).toBe(3);
    const restored = RoundEventTracker.restore(snapshot);
    expect(restored.serialize().currentRoundNumber).toBe(3);
  });
});
