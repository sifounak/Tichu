// Verifies: REQ-F-EC01, REQ-F-EC02, REQ-F-EC03, REQ-F-GC01–GC10

import { describe, it, expect } from 'vitest';
import { RoundEventTracker } from '../../src/game/round-event-tracker.js';
import type { GameMachineContext } from '../../src/game/game-state-machine.js';
import type { Seat, RoundState, GameCard, TrickState, PlayerState, TichuCall, GameConfig } from '@tichu/shared';
import { GamePhase, CombinationType } from '@tichu/shared';

// ─── Helpers ─────────────────────────────────────────────────────────

function card(kind: string, rank?: number, suit?: string, id = 1): GameCard {
  if (kind === 'dragon') return { id, card: { kind: 'dragon' } } as GameCard;
  if (kind === 'phoenix') return { id, card: { kind: 'phoenix' } } as GameCard;
  if (kind === 'dog') return { id, card: { kind: 'dog' } } as GameCard;
  if (kind === 'mahjong') return { id, card: { kind: 'mahjong' } } as GameCard;
  return { id, card: { kind: 'standard', rank: rank ?? 5, suit: suit ?? 'jade' } } as GameCard;
}

function makePlayerState(seat: Seat, overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    seat,
    hand: [],
    tricksWon: [],
    tipiCall: 'none' as TichuCall,
    hasPlayed: false,
    finishOrder: null,
    passedCards: { to: { north: null as any, east: null as any, south: null as any, west: null as any }, received: false },
    ...overrides,
  };
}

function makeRound(overrides: Partial<RoundState> = {}): RoundState {
  return {
    roundNumber: 1,
    phase: GamePhase.Playing,
    players: {
      north: makePlayerState('north'),
      east: makePlayerState('east'),
      south: makePlayerState('south'),
      west: makePlayerState('west'),
    },
    currentTrick: null,
    currentTurn: null,
    mahjongWish: null,
    wishFulfilled: false,
    finishOrder: [],
    dragonGiftPending: null,
    dragonGiftedTo: null,
    lastDogPlay: null,
    bombsPerTeam: { northSouth: 0, eastWest: 0 },
    ...overrides,
  };
}

const defaultConfig: GameConfig = {
  targetScore: 1000,
  turnTimerSeconds: null,
  spectatorsAllowed: true,
  isPrivate: false,
};

function makeContext(round: RoundState | null, overrides: Partial<GameMachineContext> = {}): GameMachineContext {
  return {
    gameId: 'test',
    config: defaultConfig,
    seats: { north: true, east: true, south: true, west: true },
    scores: { northSouth: 0, eastWest: 0 },
    roundHistory: [],
    currentRound: round,
    grandTichuDecisions: new Set(),
    cardPassDecisions: new Set(),
    winner: null,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('RoundEventTracker', () => {
  it('should initialize with blank summaries after reset', () => {
    const tracker = new RoundEventTracker();
    tracker.reset(1);
    const summaries = tracker.getSummaries();
    expect(summaries.size).toBe(4);
    expect(summaries.get('north')!.seat).toBe('north');
    expect(summaries.get('north')!.roundNumber).toBe(1);
  });

  // Verifies: REQ-F-EC03
  describe('initial hand capture', () => {
    it('should detect bombs in first 8 cards', () => {
      const tracker = new RoundEventTracker();
      const round = makeRound({
        phase: GamePhase.GrandTichuDecision,
        players: {
          north: makePlayerState('north', {
            hand: [
              card('standard', 5, 'jade', 1),
              card('standard', 5, 'pagoda', 2),
              card('standard', 5, 'star', 3),
              card('standard', 5, 'sword', 4),
              card('standard', 7, 'jade', 5),
              card('standard', 8, 'jade', 6),
              card('standard', 9, 'jade', 7),
              card('standard', 10, 'jade', 8),
            ],
          }),
          east: makePlayerState('east'),
          south: makePlayerState('south'),
          west: makePlayerState('west'),
        },
      });

      tracker.onStateChange(makeContext(round));
      const summary = tracker.getSummaries().get('north')!;
      expect(summary.bombsInFirst8).toBeGreaterThan(0);
    });
  });

  // Verifies: REQ-F-GC02, REQ-F-GC05
  describe('pass tracking', () => {
    it('should detect special cards received in pass', () => {
      const tracker = new RoundEventTracker();
      tracker.reset(1);

      // First state: card passing phase
      const passingRound = makeRound({ phase: GamePhase.CardPassing });
      tracker.onStateChange(makeContext(passingRound));

      // Transition to playing: east passed dragon to north
      const playingRound = makeRound({
        phase: GamePhase.Playing,
        players: {
          north: makePlayerState('north', {
            hand: [card('dragon', undefined, undefined, 100), card('standard', 5, 'jade', 1)],
            passedCards: { to: { north: null as any, east: null as any, south: null as any, west: null as any }, received: true },
          }),
          east: makePlayerState('east', {
            passedCards: { to: { north: card('dragon', undefined, undefined, 100), east: null as any, south: null as any, west: null as any }, received: true },
          }),
          south: makePlayerState('south', {
            passedCards: { to: { north: null as any, east: null as any, south: null as any, west: null as any }, received: true },
          }),
          west: makePlayerState('west', {
            passedCards: { to: { north: null as any, east: null as any, south: null as any, west: null as any }, received: true },
          }),
        },
      });
      tracker.onStateChange(makeContext(playingRound));

      const northSummary = tracker.getSummaries().get('north')!;
      expect(northSummary.dragonReceivedInPass).toBe(true);
      expect(northSummary.hadDragon).toBe(true);
    });

    it('should track dog given to partner vs opponent', () => {
      const tracker = new RoundEventTracker();
      tracker.reset(1);

      const passingRound = makeRound({ phase: GamePhase.CardPassing });
      tracker.onStateChange(makeContext(passingRound));

      // North passes dog to south (partner)
      const playingRound = makeRound({
        phase: GamePhase.Playing,
        players: {
          north: makePlayerState('north', {
            passedCards: { to: { north: null as any, east: null as any, south: card('dog', undefined, undefined, 200), west: null as any }, received: true },
          }),
          east: makePlayerState('east', {
            passedCards: { to: { north: null as any, east: null as any, south: null as any, west: null as any }, received: true },
          }),
          south: makePlayerState('south', {
            passedCards: { to: { north: null as any, east: null as any, south: null as any, west: null as any }, received: true },
          }),
          west: makePlayerState('west', {
            passedCards: { to: { north: null as any, east: null as any, south: null as any, west: null as any }, received: true },
          }),
        },
      });
      tracker.onStateChange(makeContext(playingRound));

      const northSummary = tracker.getSummaries().get('north')!;
      expect(northSummary.dogGivenToPartner).toBe(true);
      expect(northSummary.dogGivenToOpponent).toBe(false);
    });
  });

  // Verifies: REQ-F-GC07
  describe('bomb detection', () => {
    it('should detect bomb plays and classify by size', () => {
      const tracker = new RoundEventTracker();
      tracker.reset(1);

      // State before bomb
      const before = makeRound({
        phase: GamePhase.Playing,
        currentTrick: {
          plays: [],
          passes: [],
          leadSeat: 'north',
          currentWinner: 'north',
        },
      });
      tracker.onStateChange(makeContext(before));

      // State after 4-card bomb played
      const after = makeRound({
        phase: GamePhase.Playing,
        currentTrick: {
          plays: [{
            seat: 'north',
            combination: {
              type: CombinationType.FourBomb,
              cards: [card('standard', 8, 'jade', 1), card('standard', 8, 'pagoda', 2), card('standard', 8, 'star', 3), card('standard', 8, 'sword', 4)],
              isBomb: true,
              rank: 8,
            },
          }],
          passes: [],
          leadSeat: 'north',
          currentWinner: 'north',
        },
      });
      tracker.onStateChange(makeContext(after));

      const summary = tracker.getSummaries().get('north')!;
      expect(summary.bombsPlayed).toBe(1);
      expect(summary.fourCardBombs).toBe(1);
    });
  });

  // Verifies: REQ-F-GC08
  describe('over-bombed', () => {
    it('should detect when a bomb is over-bombed by opponent', () => {
      const tracker = new RoundEventTracker();
      tracker.reset(1);

      // State with one bomb played by north
      const oneBomb = makeRound({
        phase: GamePhase.Playing,
        currentTrick: {
          plays: [{
            seat: 'north',
            combination: {
              type: CombinationType.FourBomb,
              cards: [card('standard', 5, 'jade', 1), card('standard', 5, 'pagoda', 2), card('standard', 5, 'star', 3), card('standard', 5, 'sword', 4)],
              isBomb: true,
              rank: 5,
            },
          }],
          passes: [],
          leadSeat: 'east',
          currentWinner: 'north',
        },
      });
      tracker.onStateChange(makeContext(oneBomb));

      // East over-bombs north
      const twoBombs = makeRound({
        phase: GamePhase.Playing,
        currentTrick: {
          plays: [
            oneBomb.currentTrick!.plays[0],
            {
              seat: 'east',
              combination: {
                type: CombinationType.FourBomb,
                cards: [card('standard', 10, 'jade', 5), card('standard', 10, 'pagoda', 6), card('standard', 10, 'star', 7), card('standard', 10, 'sword', 8)],
                isBomb: true,
                rank: 10,
              },
            },
          ],
          passes: [],
          leadSeat: 'east',
          currentWinner: 'east',
        },
      });
      tracker.onStateChange(makeContext(twoBombs));

      const northSummary = tracker.getSummaries().get('north')!;
      expect(northSummary.overBombed).toBe(1);
      const eastSummary = tracker.getSummaries().get('east')!;
      expect(eastSummary.bombsPlayed).toBe(1);
    });
  });

  // Verifies: REQ-F-GC06
  describe('dog for Tichu partner', () => {
    it('should detect dog played for Tichu partner', () => {
      const tracker = new RoundEventTracker();
      tracker.reset(1);

      // Before: no dog play
      const before = makeRound({
        phase: GamePhase.Playing,
        players: {
          north: makePlayerState('north'),
          east: makePlayerState('east'),
          south: makePlayerState('south', { tipiCall: 'tichu' }),
          west: makePlayerState('west'),
        },
      });
      tracker.onStateChange(makeContext(before));

      // After: north played dog, it goes to south (partner)
      const after = makeRound({
        phase: GamePhase.Playing,
        players: {
          north: makePlayerState('north'),
          east: makePlayerState('east'),
          south: makePlayerState('south', { tipiCall: 'tichu' }),
          west: makePlayerState('west'),
        },
        lastDogPlay: { fromSeat: 'north', toSeat: 'south' },
      });
      tracker.onStateChange(makeContext(after));

      const summary = tracker.getSummaries().get('north')!;
      expect(summary.dogPlayedForTichuPartner).toBe(1);
    });
  });

  // Verifies: REQ-F-GC10
  describe('"The Tichu" straight', () => {
    it('should detect a 13-card straight', () => {
      const tracker = new RoundEventTracker();
      tracker.reset(1);

      const before = makeRound({
        phase: GamePhase.Playing,
        currentTrick: { plays: [], passes: [], leadSeat: 'north', currentWinner: 'north' },
      });
      tracker.onStateChange(makeContext(before));

      // 13-card straight
      const cards: GameCard[] = [];
      for (let i = 1; i <= 13; i++) {
        cards.push(card('standard', i + 1, 'jade', i)); // ranks 2-14
      }
      // Replace rank 1 with mahjong
      cards[0] = card('mahjong', undefined, undefined, 100);

      const after = makeRound({
        phase: GamePhase.Playing,
        currentTrick: {
          plays: [{
            seat: 'north',
            combination: {
              type: CombinationType.Straight,
              cards,
              isBomb: false,
              rank: 14,
            },
          }],
          passes: [],
          leadSeat: 'north',
          currentWinner: 'north',
        },
      });
      tracker.onStateChange(makeContext(after));

      const summary = tracker.getSummaries().get('north')!;
      expect(summary.theTichuClean).toBe(1);
    });
  });

  // Verifies: REQ-F-GC03
  describe('Dragon trick win', () => {
    it('should detect Dragon trick wins', () => {
      const tracker = new RoundEventTracker();
      tracker.reset(1);

      // Trick with Dragon play, currentWinner = north
      const withTrick = makeRound({
        phase: GamePhase.Playing,
        currentTrick: {
          plays: [{
            seat: 'north',
            combination: {
              type: CombinationType.Single,
              cards: [card('dragon', undefined, undefined, 99)],
              isBomb: false,
              rank: 15,
            },
          }],
          passes: ['east', 'south', 'west'] as Seat[],
          leadSeat: 'north',
          currentWinner: 'north',
        },
      });
      tracker.onStateChange(makeContext(withTrick));

      // Trick completes — new trick or null
      const afterTrick = makeRound({
        phase: GamePhase.Playing,
        currentTrick: null,
      });
      tracker.onStateChange(makeContext(afterTrick));

      const summary = tracker.getSummaries().get('north')!;
      expect(summary.dragonTrickWins).toBe(1);
    });
  });
});
