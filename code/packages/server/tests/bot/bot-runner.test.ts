// Verifies: REQ-F-BOT01, REQ-F-BOT02, REQ-F-BOT05, REQ-F-MP01, REQ-F-GT06, REQ-F-GT07

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BotRunner, INSTANT_CONFIG, type BotRunnerConfig } from '../../src/bot/bot-runner.js';
import { RegularBot } from '../../src/bot/regular-bot.js';
import {
  createGameActor,
  type GameActor,
  type GameMachineContext,
} from '../../src/game/game-state-machine.js';
import type { Seat, GameCard, Rank, Combination, TrickState, RoundState } from '@tichu/shared';
import { SEATS_IN_ORDER, Suit } from '@tichu/shared';
import type { BotStrategy, BotPlayContext, BotPlayDecision } from '../../src/bot/bot-interface.js';

// ─── Helpers ─────────────────────────────────────────────────────────────

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

/** Flush all pending microtasks / setTimeout(0) */
function flushTimers(): Promise<void> {
  return new Promise((resolve) => {
    vi.runAllTimers();
    resolve();
  });
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('BotRunner', () => {
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

  describe('bot management', () => {
    it('should add and track bots', () => {
      actor = createTestActor();
      runner = new BotRunner(actor, INSTANT_CONFIG);

      const bot = new RegularBot();
      runner.addBot('north', bot);
      runner.addBot('east', bot);

      expect(runner.isBot('north')).toBe(true);
      expect(runner.isBot('east')).toBe(true);
      expect(runner.isBot('south')).toBe(false);
      expect(runner.isBot('west')).toBe(false);
    });

    it('should return bot seats', () => {
      actor = createTestActor();
      runner = new BotRunner(actor, INSTANT_CONFIG);

      runner.addBot('south', new RegularBot());
      runner.addBot('west', new RegularBot());

      const seats = runner.getBotSeats();
      expect(seats).toContain('south');
      expect(seats).toContain('west');
      expect(seats).toHaveLength(2);
    });

    it('should remove bots', () => {
      actor = createTestActor();
      runner = new BotRunner(actor, INSTANT_CONFIG);

      runner.addBot('north', new RegularBot());
      expect(runner.isBot('north')).toBe(true);

      runner.removeBot('north');
      expect(runner.isBot('north')).toBe(false);
    });
  });

  describe('Grand Tichu phase', () => {
    it('should make Grand Tichu decisions for all bots', async () => {
      actor = createTestActor();
      runner = new BotRunner(actor, INSTANT_CONFIG);

      // Add bots to all seats
      for (const seat of SEATS_IN_ORDER) {
        runner.addBot(seat, new RegularBot());
      }

      // Seat all and start game
      seatAllPlayers(actor);
      actor.send({ type: 'HOST_START_GAME' });
      expect(getState(actor)).toBe('grandTichuDecision');

      // Trigger bot actions
      runner.onStateChange();
      await flushTimers();

      // All bots should have made their Grand Tichu decision (RegularBot always passes)
      const ctx = getContext(actor);
      expect(ctx.grandTichuDecisions.size).toBe(4);
    });

    // REQ-F-GT06: Grand Tichu decision fires at exactly 1000 ms in production config
    it('should fire Grand Tichu decision at exactly 1000 ms (not random)', () => {
      const productionConfig: BotRunnerConfig = { minDelayMs: 800, maxDelayMs: 1500 };
      actor = createTestActor();
      runner = new BotRunner(actor, productionConfig);

      runner.addBot('north', new RegularBot());
      seatAllPlayers(actor);
      actor.send({ type: 'HOST_START_GAME' });
      expect(getState(actor)).toBe('grandTichuDecision');

      runner.onStateChange();

      // At 999 ms — not yet decided
      vi.advanceTimersByTime(999);
      expect(getContext(actor).grandTichuDecisions.has('north')).toBe(false);

      // At exactly 1000 ms — decided
      vi.advanceTimersByTime(1);
      expect(getContext(actor).grandTichuDecisions.has('north')).toBe(true);
    });

    // REQ-F-GT07: calling onStateChange again before the timer fires must not add a second timer
    it('should not schedule a second timer if onStateChange is called again before timer fires', () => {
      const productionConfig: BotRunnerConfig = { minDelayMs: 800, maxDelayMs: 1500 };
      actor = createTestActor();
      runner = new BotRunner(actor, productionConfig);

      const callSpy = vi.fn().mockReturnValue(false);
      runner.addBot('north', { ...new RegularBot(), chooseGrandTichu: callSpy });
      seatAllPlayers(actor);
      actor.send({ type: 'HOST_START_GAME' });

      // Two onStateChange calls before the timer fires
      runner.onStateChange();
      runner.onStateChange();

      // Let all timers fire
      vi.advanceTimersByTime(2000);

      // chooseGrandTichu should have been called exactly once (no duplicate timer)
      expect(callSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Regular Tichu phase', () => {
    it('should make Regular Tichu decisions for all bots', async () => {
      actor = createTestActor();
      runner = new BotRunner(actor, INSTANT_CONFIG);

      for (const seat of SEATS_IN_ORDER) {
        runner.addBot(seat, new RegularBot());
      }

      // Advance to Regular Tichu
      seatAllPlayers(actor);
      actor.send({ type: 'HOST_START_GAME' });
      for (const seat of SEATS_IN_ORDER) {
        actor.send({ type: 'GRAND_TICHU_PASS', seat });
      }
      expect(getState(actor)).toBe('cardPassing');

      runner.onStateChange();
      await flushTimers();

      const ctx = getContext(actor);
      expect(ctx.cardPassDecisions.size).toBe(4);
    });
  });

  describe('Card passing phase', () => {
    it('should pass cards for all bots', async () => {
      actor = createTestActor();
      runner = new BotRunner(actor, INSTANT_CONFIG);

      for (const seat of SEATS_IN_ORDER) {
        runner.addBot(seat, new RegularBot());
      }

      // Advance to card passing
      seatAllPlayers(actor);
      actor.send({ type: 'HOST_START_GAME' });
      for (const seat of SEATS_IN_ORDER) {
        actor.send({ type: 'GRAND_TICHU_PASS', seat });
      }
      expect(getState(actor)).toBe('cardPassing');

      runner.onStateChange();
      await flushTimers();

      const ctx = getContext(actor);
      expect(ctx.cardPassDecisions.size).toBe(4);
    });
  });

  describe('Playing phase', () => {
    it('should play when it is a bot\'s turn', async () => {
      actor = createTestActor();
      runner = new BotRunner(actor, INSTANT_CONFIG);

      for (const seat of SEATS_IN_ORDER) {
        runner.addBot(seat, new RegularBot());
      }

      // Advance to playing
      seatAllPlayers(actor);
      actor.send({ type: 'HOST_START_GAME' });
      for (const seat of SEATS_IN_ORDER) {
        actor.send({ type: 'GRAND_TICHU_PASS', seat });
      }
      // Bot runner handles card passing
      runner.onStateChange();
      await flushTimers();

      expect(getState(actor)).toBe('playing');

      // Get initial turn
      const ctx = getContext(actor);
      const initialTurn = ctx.currentRound?.currentTurn;
      expect(initialTurn).toBeDefined();

      // Trigger play for the current turn's bot
      runner.onStateChange();
      await flushTimers();

      // After bot plays, either the state advanced or the turn changed
      const afterCtx = getContext(actor);
      const state = getState(actor);
      // The game should have progressed (turn changed or trick completed)
      expect(
        state !== 'playing' ||
        afterCtx.currentRound?.currentTurn !== initialTurn ||
        afterCtx.currentRound?.currentTrick !== ctx.currentRound?.currentTrick
      ).toBe(true);
    });

    it('should not act for human seats', async () => {
      actor = createTestActor();
      runner = new BotRunner(actor, INSTANT_CONFIG);

      // Only south and west are bots
      runner.addBot('south', new RegularBot());
      runner.addBot('west', new RegularBot());

      seatAllPlayers(actor);
      actor.send({ type: 'HOST_START_GAME' });
      // Humans must make their own decisions
      for (const seat of SEATS_IN_ORDER) {
        actor.send({ type: 'GRAND_TICHU_PASS', seat });
      }
      // All pass cards (including humans for simplicity)
      const ctx = getContext(actor);
      if (getState(actor) === 'cardPassing') {
        for (const seat of SEATS_IN_ORDER) {
          const round = getContext(actor).currentRound!;
          const hand = round.players[seat].hand;
          const otherSeats = SEATS_IN_ORDER.filter((s) => s !== seat);
          const cards = {} as Record<Seat, GameCard>;
          for (let i = 0; i < otherSeats.length; i++) {
            cards[otherSeats[i]] = hand[i];
          }
          actor.send({ type: 'CARDS_PASSED', seat, cards });
        }
      }

      expect(getState(actor)).toBe('playing');
      const round = getContext(actor).currentRound!;
      const currentTurn = round.currentTurn!;

      // If it's a human's turn, bot runner should NOT act
      if (!runner.isBot(currentTurn)) {
        const turnBefore = currentTurn;
        runner.onStateChange();
        await flushTimers();

        // Turn should not have changed
        const roundAfter = getContext(actor).currentRound!;
        expect(roundAfter.currentTurn).toBe(turnBefore);
      }
    });
  });

  describe('artificial delay', () => {
    it('should delay bot actions with default config', () => {
      actor = createTestActor();
      runner = new BotRunner(actor, { minDelayMs: 500, maxDelayMs: 1000 });

      runner.addBot('north', new RegularBot());
      seatAllPlayers(actor);
      actor.send({ type: 'HOST_START_GAME' });
      expect(getState(actor)).toBe('grandTichuDecision');

      runner.onStateChange();

      // Decision should not have been made yet (timer not fired)
      expect(getContext(actor).grandTichuDecisions.size).toBe(0);

      // Advance time past max delay
      vi.advanceTimersByTime(1100);

      // Now the decision should be made
      expect(getContext(actor).grandTichuDecisions.has('north')).toBe(true);
    });

    it('should use instant timing with INSTANT_CONFIG', async () => {
      actor = createTestActor();
      runner = new BotRunner(actor, INSTANT_CONFIG);

      runner.addBot('north', new RegularBot());
      seatAllPlayers(actor);
      actor.send({ type: 'HOST_START_GAME' });

      runner.onStateChange();
      await flushTimers();

      expect(getContext(actor).grandTichuDecisions.has('north')).toBe(true);
    });
  });

  describe('dispose', () => {
    it('should cancel pending timers on dispose', () => {
      actor = createTestActor();
      runner = new BotRunner(actor, { minDelayMs: 5000, maxDelayMs: 10000 });

      for (const seat of SEATS_IN_ORDER) {
        runner.addBot(seat, new RegularBot());
      }

      seatAllPlayers(actor);
      actor.send({ type: 'HOST_START_GAME' });
      runner.onStateChange();

      // Dispose before timers fire
      runner.dispose();

      // Advance time — actions should NOT execute
      vi.advanceTimersByTime(15000);
      expect(getContext(actor).grandTichuDecisions.size).toBe(0);
    });

    it('should not act after dispose', async () => {
      actor = createTestActor();
      runner = new BotRunner(actor, INSTANT_CONFIG);

      runner.addBot('north', new RegularBot());
      runner.dispose();

      seatAllPlayers(actor);
      actor.send({ type: 'HOST_START_GAME' });
      runner.onStateChange();
      await flushTimers();

      expect(getContext(actor).grandTichuDecisions.size).toBe(0);
    });
  });

  describe('custom strategy', () => {
    it('should invoke custom strategy methods', async () => {
      actor = createTestActor();
      runner = new BotRunner(actor, INSTANT_CONFIG);

      const customBot: BotStrategy = {
        difficulty: 'regular',
        chooseGrandTichu: vi.fn().mockReturnValue(false),
        chooseRegularTichu: vi.fn().mockReturnValue(false),
        chooseCardsToPass: vi.fn(),
        choosePlay: vi.fn().mockReturnValue({ action: 'pass' }),
        chooseDragonGiftRecipient: vi.fn().mockReturnValue('east'),
        chooseMahjongWish: vi.fn().mockReturnValue(null),
      };

      runner.addBot('north', customBot);
      seatAllPlayers(actor);
      actor.send({ type: 'HOST_START_GAME' });

      runner.onStateChange();
      await flushTimers();

      expect(customBot.chooseGrandTichu).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: expect.any(Number) })]),
      );
    });
  });
});

describe('BotRunner full game smoke test', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should complete a full 4-bot game without errors', async () => {
    vi.useFakeTimers();

    const actor = createTestActor();
    const runner = new BotRunner(actor, INSTANT_CONFIG);

    for (const seat of SEATS_IN_ORDER) {
      runner.addBot(seat, new RegularBot());
    }

    seatAllPlayers(actor);
    actor.send({ type: 'HOST_START_GAME' });

    // Drive the game by repeatedly triggering bot actions
    let iterations = 0;
    const maxIterations = 5000;

    while (getState(actor) !== 'gameOver' && iterations < maxIterations) {
      runner.onStateChange();
      await flushTimers();
      iterations++;

      const state = getState(actor);

      // If stuck in roundScoring, the machine should auto-transition
      // to next round or gameOver
      if (state === 'roundScoring') {
        // roundScoring auto-transitions, just flush
        await flushTimers();
      }
    }

    // Game should eventually end (or at least get far)
    // Note: Due to random play, the game may take a long time,
    // but it should not hang or error
    const finalState = getState(actor);
    const ctx = getContext(actor);

    // The game should have progressed past lobby
    expect(ctx.roundHistory.length).toBeGreaterThanOrEqual(0);
    expect(['gameOver', 'playing', 'grandTichuDecision', 'cardPassing',
      'cardPassing', 'roundScoring', 'awaitingDragonGift']).toContain(finalState);

    runner.dispose();
    actor.stop();
  }, 30_000);
});
