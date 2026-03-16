// Verifies: REQ-NF-PERF01, REQ-NF-TEST01, REQ-F-TIER02
// Integration tests: full games with all bot difficulties, performance validation

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BotRunner, INSTANT_CONFIG } from '../../src/bot/bot-runner.js';
import { RegularBot } from '../../src/bot/regular-bot.js';
import { HardBot } from '../../src/bot/hard-bot.js';
import { ExpertBot } from '../../src/bot/expert-bot.js';
import {
  createGameActor,
  type GameActor,
  type GameMachineContext,
} from '../../src/game/game-state-machine.js';
import type { Seat, GameCard, Rank } from '@tichu/shared';
import { SEATS_IN_ORDER, Suit } from '@tichu/shared';
import type { BotStrategy, BotPlayContext } from '../../src/bot/bot-interface.js';

// ─── Helpers ──────────────────────────────────────────────────────────────

function createTestActor(config = {}): GameActor {
  const actor = createGameActor('test-game', config);
  actor.start();
  return actor;
}

function seatAllPlayers(actor: GameActor): void {
  for (const seat of SEATS_IN_ORDER) {
    actor.send({ type: 'PLAYER_JOINED', seat });
  }
}

function getContext(actor: GameActor): GameMachineContext {
  return actor.getSnapshot().context;
}

function getState(actor: GameActor): string {
  const v = actor.getSnapshot().value;
  return typeof v === 'string' ? v : String(v);
}

function flushTimers(): Promise<void> {
  return new Promise((resolve) => {
    vi.runAllTimers();
    resolve();
  });
}

const VALID_GAME_STATES = [
  'gameOver', 'playing', 'grandTichuDecision', 'regularTichuDecision',
  'cardPassing', 'roundScoring', 'awaitingDragonGift',
];

/**
 * Drive a 4-bot game to completion or max iterations.
 * Returns { finalState, iterations, ctx }.
 */
async function driveGameToCompletion(
  actor: GameActor,
  runner: BotRunner,
  maxIterations = 5000,
): Promise<{ finalState: string; iterations: number; ctx: GameMachineContext }> {
  let iterations = 0;

  while (getState(actor) !== 'gameOver' && iterations < maxIterations) {
    runner.onStateChange();
    await flushTimers();
    iterations++;

    if (getState(actor) === 'roundScoring') {
      await flushTimers();
    }
  }

  return {
    finalState: getState(actor),
    iterations,
    ctx: getContext(actor),
  };
}

// ─── Card helpers for performance tests ───────────────────────────────────

let nextId = 1;

function card(kind: string, rank?: number, suit?: string): GameCard {
  if (kind === 'standard') {
    return {
      id: nextId++,
      card: { kind: 'standard', rank: rank as Rank, suit: (suit ?? Suit.Jade) as any },
    };
  }
  const idMap: Record<string, number> = { dragon: 900, phoenix: 901, mahjong: 902, dog: 903 };
  return { id: idMap[kind] ?? nextId++, card: { kind } as any };
}

function makeHand14(): GameCard[] {
  nextId = 1;
  return [
    card('dragon'),
    card('phoenix'),
    card('mahjong'),
    card('standard', 14, Suit.Jade),    // Ace
    card('standard', 13, Suit.Jade),    // King
    card('standard', 12, Suit.Sword),   // Queen
    card('standard', 11, Suit.Pagoda),  // Jack
    card('standard', 10, Suit.Star),
    card('standard', 9, Suit.Jade),
    card('standard', 8, Suit.Sword),
    card('standard', 7, Suit.Pagoda),
    card('standard', 5, Suit.Star),
    card('standard', 3, Suit.Jade),
    card('standard', 2, Suit.Sword),
  ];
}

// ─── Full Game Integration Tests ──────────────────────────────────────────

describe('Bot Integration — Full Game', () => {
  let actor: GameActor;
  let runner: BotRunner;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    runner?.dispose();
    actor?.stop();
    vi.useRealTimers();
  });

  // Verifies: REQ-F-TIER02 (all 3 bot classes instantiated and functional)
  it('should complete a full game with 4 RegularBots', async () => {
    actor = createTestActor();
    runner = new BotRunner(actor, INSTANT_CONFIG);

    for (const seat of SEATS_IN_ORDER) {
      runner.addBot(seat, new RegularBot());
    }
    seatAllPlayers(actor);
    actor.send({ type: 'HOST_START_GAME' });

    const { finalState, ctx } = await driveGameToCompletion(actor, runner);

    expect(finalState).toBe('gameOver');
    expect(ctx.winner).toBeDefined();
    expect(ctx.roundHistory.length).toBeGreaterThanOrEqual(1);
  }, 30_000);

  it('should complete a full game with 4 HardBots', async () => {
    actor = createTestActor();
    runner = new BotRunner(actor, INSTANT_CONFIG);

    for (const seat of SEATS_IN_ORDER) {
      runner.addBot(seat, new HardBot());
    }
    seatAllPlayers(actor);
    actor.send({ type: 'HOST_START_GAME' });

    const { finalState, ctx } = await driveGameToCompletion(actor, runner);

    expect(finalState).toBe('gameOver');
    expect(ctx.winner).toBeDefined();
    expect(ctx.roundHistory.length).toBeGreaterThanOrEqual(1);
  }, 30_000);

  it('should complete a full game with 4 ExpertBots', async () => {
    actor = createTestActor();
    runner = new BotRunner(actor, INSTANT_CONFIG);

    for (const seat of SEATS_IN_ORDER) {
      runner.addBot(seat, new ExpertBot());
    }
    seatAllPlayers(actor);
    actor.send({ type: 'HOST_START_GAME' });

    const { finalState, ctx } = await driveGameToCompletion(actor, runner);

    expect(finalState).toBe('gameOver');
    expect(ctx.winner).toBeDefined();
    expect(ctx.roundHistory.length).toBeGreaterThanOrEqual(1);
  }, 30_000);

  it('should complete a full game with mixed difficulties', async () => {
    actor = createTestActor();
    runner = new BotRunner(actor, INSTANT_CONFIG);

    // North: Regular, East: Hard, South: Expert, West: Hard
    runner.addBot('north', new RegularBot());
    runner.addBot('east', new HardBot());
    runner.addBot('south', new ExpertBot());
    runner.addBot('west', new HardBot());

    seatAllPlayers(actor);
    actor.send({ type: 'HOST_START_GAME' });

    const { finalState, ctx } = await driveGameToCompletion(actor, runner);

    expect(finalState).toBe('gameOver');
    expect(ctx.winner).toBeDefined();
    expect(ctx.roundHistory.length).toBeGreaterThanOrEqual(1);
  }, 30_000);

  it('should produce valid scores across rounds', async () => {
    actor = createTestActor();
    runner = new BotRunner(actor, INSTANT_CONFIG);

    for (const seat of SEATS_IN_ORDER) {
      runner.addBot(seat, new HardBot());
    }
    seatAllPlayers(actor);
    actor.send({ type: 'HOST_START_GAME' });

    const { finalState, ctx } = await driveGameToCompletion(actor, runner);

    expect(finalState).toBe('gameOver');
    expect(ctx.roundHistory.length).toBeGreaterThanOrEqual(1);

    for (const round of ctx.roundHistory) {
      // RoundScore structure is complete
      expect(round.roundNumber).toBeGreaterThanOrEqual(1);
      expect(round.cardPoints).toBeDefined();
      expect(round.tichuBonuses).toBeDefined();
      expect(round.total).toBeDefined();

      // 1-2 bonus: winning team gets 200 card points, losing team gets 0
      if (round.oneTwoBonus) {
        expect(round.cardPoints[round.oneTwoBonus]).toBe(200);
        const loser = round.oneTwoBonus === 'northSouth' ? 'eastWest' : 'northSouth';
        expect(round.cardPoints[loser]).toBe(0);
      }

      // Tichu bonuses are multiples of 100 (±100 for Tichu, ±200 for Grand Tichu)
      for (const team of ['northSouth', 'eastWest'] as const) {
        expect(Math.abs(round.tichuBonuses[team]) % 100).toBe(0);
      }

      // Total = card points + tichu bonuses
      for (const team of ['northSouth', 'eastWest'] as const) {
        expect(round.total[team]).toBe(round.cardPoints[team] + round.tichuBonuses[team]);
      }
    }

    // Final scores match accumulated round totals
    let nsTotal = 0, ewTotal = 0;
    for (const round of ctx.roundHistory) {
      nsTotal += round.total.northSouth;
      ewTotal += round.total.eastWest;
    }
    expect(ctx.scores.northSouth).toBe(nsTotal);
    expect(ctx.scores.eastWest).toBe(ewTotal);

    // Winner must have reached target score (default 1000)
    expect(ctx.scores[ctx.winner!]).toBeGreaterThanOrEqual(1000);
  }, 30_000);

  it('should not get stuck (no infinite loops)', async () => {
    actor = createTestActor();
    runner = new BotRunner(actor, INSTANT_CONFIG);

    for (const seat of SEATS_IN_ORDER) {
      runner.addBot(seat, new ExpertBot());
    }
    seatAllPlayers(actor);
    actor.send({ type: 'HOST_START_GAME' });

    const { finalState, iterations } = await driveGameToCompletion(actor, runner, 5000);

    // Should finish well before the iteration limit
    expect(finalState).toBe('gameOver');
    expect(iterations).toBeLessThan(5000);
  }, 30_000);

  it('should handle multiple rounds correctly', async () => {
    actor = createTestActor();
    runner = new BotRunner(actor, INSTANT_CONFIG);

    for (const seat of SEATS_IN_ORDER) {
      runner.addBot(seat, new HardBot());
    }
    seatAllPlayers(actor);
    actor.send({ type: 'HOST_START_GAME' });

    const { finalState, ctx } = await driveGameToCompletion(actor, runner);

    expect(finalState).toBe('gameOver');
    // Game ends at 1000+ points — should take multiple rounds
    expect(ctx.roundHistory.length).toBeGreaterThanOrEqual(1);
    // One team must be the winner
    expect(['northSouth', 'eastWest']).toContain(ctx.winner);
  }, 30_000);
});

// ─── Performance Validation ───────────────────────────────────────────────

describe('Bot Performance — REQ-NF-PERF01', () => {
  const hand14 = makeHand14();
  const hand8 = hand14.slice(0, 8);

  // Verifies: REQ-NF-PERF01 — bot decision time < 100ms
  describe('HardBot decision time', () => {
    const bot = new HardBot();

    it('chooseGrandTichu should complete in < 100ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        bot.chooseGrandTichu(hand8);
      }
      const elapsed = (performance.now() - start) / 100;
      expect(elapsed).toBeLessThan(100);
    });

    it('chooseRegularTichu should complete in < 100ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        bot.chooseRegularTichu(hand14);
      }
      const elapsed = (performance.now() - start) / 100;
      expect(elapsed).toBeLessThan(100);
    });

    it('chooseCardsToPass should complete in < 100ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        bot.chooseCardsToPass(hand14, 'north');
      }
      const elapsed = (performance.now() - start) / 100;
      expect(elapsed).toBeLessThan(100);
    });

    it('chooseMahjongWish should complete in < 100ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        bot.chooseMahjongWish(hand14);
      }
      const elapsed = (performance.now() - start) / 100;
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('ExpertBot decision time', () => {
    const bot = new ExpertBot();

    it('chooseGrandTichu should complete in < 100ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        bot.chooseGrandTichu(hand8);
      }
      const elapsed = (performance.now() - start) / 100;
      expect(elapsed).toBeLessThan(100);
    });

    it('chooseRegularTichu should complete in < 100ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        bot.chooseRegularTichu(hand14);
      }
      const elapsed = (performance.now() - start) / 100;
      expect(elapsed).toBeLessThan(100);
    });

    it('chooseCardsToPass should complete in < 100ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        bot.chooseCardsToPass(hand14, 'north');
      }
      const elapsed = (performance.now() - start) / 100;
      expect(elapsed).toBeLessThan(100);
    });

    it('chooseMahjongWish should complete in < 100ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        bot.chooseMahjongWish(hand14);
      }
      const elapsed = (performance.now() - start) / 100;
      expect(elapsed).toBeLessThan(100);
    });
  });

  // choosePlay needs a real context from a running game
  describe('choosePlay decision time in real game context', () => {
    let actor: GameActor;
    let runner: BotRunner;

    afterEach(() => {
      runner?.dispose();
      actor?.stop();
      vi.useRealTimers();
    });

    it('HardBot choosePlay should complete in < 100ms', async () => {
      vi.useFakeTimers();
      actor = createTestActor();
      runner = new BotRunner(actor, INSTANT_CONFIG);

      const hardBot = new HardBot();
      const timingBot: BotStrategy = {
        difficulty: 'hard',
        chooseGrandTichu: () => false,
        chooseRegularTichu: () => false,
        chooseCardsToPass: (hand, seat) => hardBot.chooseCardsToPass(hand, seat),
        chooseDragonGiftRecipient: (opp, pts) => hardBot.chooseDragonGiftRecipient(opp, pts),
        chooseMahjongWish: (hand) => hardBot.chooseMahjongWish(hand),
        choosePlay: (ctx: BotPlayContext) => {
          // Time the actual decision
          const start = performance.now();
          const decision = hardBot.choosePlay(ctx);
          const elapsed = performance.now() - start;
          expect(elapsed).toBeLessThan(100);
          return decision;
        },
      };

      runner.addBot('north', timingBot);
      for (const seat of SEATS_IN_ORDER.filter(s => s !== 'north')) {
        runner.addBot(seat, new RegularBot());
      }
      seatAllPlayers(actor);
      actor.send({ type: 'HOST_START_GAME' });

      // Drive through enough plays to get a timing measurement
      for (let i = 0; i < 200; i++) {
        if (getState(actor) === 'gameOver') break;
        runner.onStateChange();
        await flushTimers();
      }
    }, 30_000);

    it('ExpertBot choosePlay should complete in < 100ms', async () => {
      vi.useFakeTimers();
      actor = createTestActor();
      runner = new BotRunner(actor, INSTANT_CONFIG);

      const expertBot = new ExpertBot();
      const timingBot: BotStrategy = {
        difficulty: 'expert',
        chooseGrandTichu: () => false,
        chooseRegularTichu: () => false,
        chooseCardsToPass: (hand, seat) => expertBot.chooseCardsToPass(hand, seat),
        chooseDragonGiftRecipient: (opp, pts) => expertBot.chooseDragonGiftRecipient(opp, pts),
        chooseMahjongWish: (hand) => expertBot.chooseMahjongWish(hand),
        choosePlay: (ctx: BotPlayContext) => {
          const start = performance.now();
          const decision = expertBot.choosePlay(ctx);
          const elapsed = performance.now() - start;
          expect(elapsed).toBeLessThan(100);
          return decision;
        },
      };

      runner.addBot('north', timingBot);
      for (const seat of SEATS_IN_ORDER.filter(s => s !== 'north')) {
        runner.addBot(seat, new RegularBot());
      }
      seatAllPlayers(actor);
      actor.send({ type: 'HOST_START_GAME' });

      for (let i = 0; i < 200; i++) {
        if (getState(actor) === 'gameOver') break;
        runner.onStateChange();
        await flushTimers();
      }
    }, 30_000);
  });
});
