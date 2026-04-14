import { describe, it, expect } from 'vitest';
import { CardTracker } from '../../src/bot/card-tracker.js';

describe('CardTracker serialization', () => {
  it('round-trips an empty tracker', () => {
    const tracker = new CardTracker();
    const snapshot = tracker.serialize();
    const restored = CardTracker.restore(snapshot);
    expect(restored.isDragonPlayed()).toBe(false);
    expect(restored.isPhoenixUnaccounted()).toBe(true);
    expect(restored.getTop10Status()).toEqual(tracker.getTop10Status());
  });

  it('round-trips a tracker with played cards', () => {
    const tracker = new CardTracker();
    const snapshot = tracker.serialize();
    snapshot.dragonPlayed = true;
    snapshot.dragonPlayedBy = 'north';
    snapshot.processedCardIds = [1, 2, 3];
    snapshot.playedByRank = { '14': { count: 2, bySeat: ['north', 'east'] } };
    const restored = CardTracker.restore(snapshot);
    expect(restored.isDragonPlayed()).toBe(true);
    const reSnapshot = restored.serialize();
    expect(reSnapshot.dragonPlayed).toBe(true);
    expect(reSnapshot.dragonPlayedBy).toBe('north');
    expect(reSnapshot.processedCardIds).toEqual([1, 2, 3]);
  });
});
