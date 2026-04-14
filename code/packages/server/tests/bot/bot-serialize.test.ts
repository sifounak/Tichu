import { describe, it, expect } from 'vitest';
import { Bot } from '../../src/bot/bot.js';

describe('Bot serialization', () => {
  it('round-trips a fresh bot', () => {
    const bot = new Bot();
    const snapshot = bot.serialize();
    const restored = Bot.restore(snapshot);
    expect(restored.serialize()).toEqual(snapshot);
  });

  it('preserves seat and strategic state', () => {
    const bot = new Bot();
    bot.setContext(
      { roundNumber: 2 } as any,
      { northSouth: 300, eastWest: 150 },
      1000,
    );
    const snapshot = bot.serialize();
    expect(snapshot.gameScores).toEqual({ northSouth: 300, eastWest: 150 });
    expect(snapshot.targetScore).toBe(1000);
    const restored = Bot.restore(snapshot);
    expect(restored.getGameScores()).toEqual({ northSouth: 300, eastWest: 150 });
    expect(restored.getTargetScore()).toBe(1000);
  });

  it('preserves card tracker state through bot', () => {
    const bot = new Bot();
    const snapshot = bot.serialize();
    snapshot.cardTracker.dragonPlayed = true;
    const restored = Bot.restore(snapshot);
    expect(restored.getCardTracker().isDragonPlayed()).toBe(true);
  });
});
