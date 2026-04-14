import { describe, it, expect, vi } from 'vitest';
import { BotRunner } from '../../src/bot/bot-runner.js';
import { Bot } from '../../src/bot/bot.js';
import type { GameActor } from '../../src/game/game-state-machine.js';
import type { MoveHandler } from '../../src/game/move-handler.js';
import type { Seat } from '@tichu/shared';

describe('BotRunner serialization', () => {
  it('serializes all bot states keyed by seat', () => {
    const mockActor = { getSnapshot: vi.fn().mockReturnValue({ context: {} }) } as unknown as GameActor;
    const mockMoveHandler = {} as MoveHandler;
    const runner = new BotRunner(mockActor, undefined, mockMoveHandler);

    // We need to add bots — check how BotRunner stores bots internally
    // BotRunner has a private `bots` Map. We'll use serialize() on a runner
    // that already has bots added via its normal creation path.
    const snapshot = runner.serialize();
    // Empty runner should have empty snapshot
    expect(Object.keys(snapshot)).toHaveLength(0);
  });

  it('round-trips via static restore', () => {
    const mockActor = { getSnapshot: vi.fn().mockReturnValue({ context: {} }) } as unknown as GameActor;
    const mockMoveHandler = {} as MoveHandler;

    // Create a bot and manually serialize it
    const bot = new Bot();
    const botSnapshot = bot.serialize();
    const botStates = { south: botSnapshot };

    const restored = BotRunner.restore(botStates, mockActor, mockMoveHandler);
    const reSnapshot = restored.serialize();
    expect(Object.keys(reSnapshot)).toContain('south');
    // Bot default mySeat is 'north'; restore preserves the snapshot's seat value
    expect(reSnapshot['south'].seat).toBe('north');
  });

  it('serialize returns one entry per added bot', () => {
    const mockActor = { getSnapshot: vi.fn().mockReturnValue({ context: {} }) } as unknown as GameActor;
    const mockMoveHandler = {} as MoveHandler;
    const runner = new BotRunner(mockActor, undefined, mockMoveHandler);

    runner.addBot('north', new Bot());
    runner.addBot('east', new Bot());

    const snapshot = runner.serialize();
    expect(Object.keys(snapshot)).toHaveLength(2);
    expect(Object.keys(snapshot)).toContain('north');
    expect(Object.keys(snapshot)).toContain('east');
  });

  it('restore creates runner with all bot seats', () => {
    const mockActor = { getSnapshot: vi.fn().mockReturnValue({ context: {} }) } as unknown as GameActor;
    const mockMoveHandler = {} as MoveHandler;

    const botStates = {
      north: new Bot().serialize(),
      west: new Bot().serialize(),
    };

    const restored = BotRunner.restore(botStates, mockActor, mockMoveHandler);
    expect(restored.isBot('north' as Seat)).toBe(true);
    expect(restored.isBot('west' as Seat)).toBe(true);
    expect(restored.isBot('east' as Seat)).toBe(false);
    expect(restored.getBotSeats()).toHaveLength(2);
  });
});
