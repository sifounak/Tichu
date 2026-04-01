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
      // REQ-F-CS10: Per-size bomb tracking
      expect(summary.bombSize4).toBe(1);
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
      // REQ-F-CS16: Over-bomb direction split
      expect(northSummary.youWereOverBombed).toBe(1);
      expect(northSummary.youOverBombed).toBe(0);
      const eastSummary = tracker.getSummaries().get('east')!;
      expect(eastSummary.bombsPlayed).toBe(1);
      expect(eastSummary.youOverBombed).toBe(1);
      expect(eastSummary.youWereOverBombed).toBe(0);
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

  // Verifies: REQ-F-CS03
  describe('Phoenix play type tracking', () => {
    it('should detect Phoenix used as single', () => {
      const tracker = new RoundEventTracker();
      tracker.reset(1);

      const before = makeRound({
        currentTrick: { plays: [], passes: [], leadSeat: 'north', currentWinner: 'north' },
      });
      tracker.onStateChange(makeContext(before));

      const after = makeRound({
        currentTrick: {
          plays: [{
            seat: 'north',
            combination: {
              type: CombinationType.Single,
              cards: [card('phoenix', undefined, undefined, 50)],
              isBomb: false,
              rank: 10,
            },
          }],
          passes: [],
          leadSeat: 'north',
          currentWinner: 'north',
        },
      });
      tracker.onStateChange(makeContext(after));

      const summary = tracker.getSummaries().get('north')!;
      expect(summary.phoenixUsedAsSingle).toBe(1);
    });

    it('should detect Phoenix used in straight and track longest', () => {
      const tracker = new RoundEventTracker();
      tracker.reset(1);

      const before = makeRound({
        currentTrick: { plays: [], passes: [], leadSeat: 'north', currentWinner: 'north' },
      });
      tracker.onStateChange(makeContext(before));

      const straightCards = [
        card('standard', 3, 'jade', 1),
        card('standard', 4, 'pagoda', 2),
        card('phoenix', undefined, undefined, 50),
        card('standard', 6, 'jade', 3),
        card('standard', 7, 'star', 4),
        card('standard', 8, 'sword', 5),
        card('standard', 9, 'jade', 6),
      ];

      const after = makeRound({
        currentTrick: {
          plays: [{
            seat: 'north',
            combination: {
              type: CombinationType.Straight,
              cards: straightCards,
              isBomb: false,
              rank: 9,
              length: 7,
            },
          }],
          passes: [],
          leadSeat: 'north',
          currentWinner: 'north',
        },
      });
      tracker.onStateChange(makeContext(after));

      const summary = tracker.getSummaries().get('north')!;
      expect(summary.phoenixUsedInStraight).toBe(1);
      expect(summary.longestStraightWithPhoenix).toBe(7);
    });

    it('should detect Phoenix used for pair', () => {
      const tracker = new RoundEventTracker();
      tracker.reset(1);

      const before = makeRound({
        currentTrick: { plays: [], passes: [], leadSeat: 'north', currentWinner: 'north' },
      });
      tracker.onStateChange(makeContext(before));

      const after = makeRound({
        currentTrick: {
          plays: [{
            seat: 'north',
            combination: {
              type: CombinationType.Pair,
              cards: [card('standard', 8, 'jade', 1), card('phoenix', undefined, undefined, 50)],
              isBomb: false,
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
      expect(summary.phoenixUsedForPair).toBe(1);
    });
  });

  // Verifies: REQ-F-CS06
  describe('Dog control tracking', () => {
    it('should classify dog control to partner', () => {
      const tracker = new RoundEventTracker();
      tracker.reset(1);

      const before = makeRound();
      tracker.onStateChange(makeContext(before));

      const after = makeRound({
        lastDogPlay: { fromSeat: 'north', toSeat: 'south' },
      });
      tracker.onStateChange(makeContext(after));

      const summary = tracker.getSummaries().get('north')!;
      expect(summary.dogControlToPartner).toBe(1);
      expect(summary.dogControlToOpponent).toBe(0);
      expect(summary.dogControlToSelf).toBe(0);
    });

    it('should classify dog control to opponent', () => {
      const tracker = new RoundEventTracker();
      tracker.reset(1);

      const before = makeRound();
      tracker.onStateChange(makeContext(before));

      const after = makeRound({
        lastDogPlay: { fromSeat: 'north', toSeat: 'east' },
      });
      tracker.onStateChange(makeContext(after));

      const summary = tracker.getSummaries().get('north')!;
      expect(summary.dogControlToOpponent).toBe(1);
    });

    it('should classify dog control to self', () => {
      const tracker = new RoundEventTracker();
      tracker.reset(1);

      const before = makeRound();
      tracker.onStateChange(makeContext(before));

      const after = makeRound({
        lastDogPlay: { fromSeat: 'north', toSeat: 'north' },
      });
      tracker.onStateChange(makeContext(after));

      const summary = tracker.getSummaries().get('north')!;
      expect(summary.dogControlToSelf).toBe(1);
    });
  });

  // Verifies: REQ-F-CS07
  describe('Dog stuck as last card', () => {
    it('should detect when Dog is the only card in hand', () => {
      const tracker = new RoundEventTracker();
      tracker.reset(1);

      const before = makeRound({
        players: {
          north: makePlayerState('north', { hand: [card('dog', undefined, undefined, 1), card('standard', 5, 'jade', 2)] }),
          east: makePlayerState('east'),
          south: makePlayerState('south'),
          west: makePlayerState('west'),
        },
      });
      tracker.onStateChange(makeContext(before));

      const after = makeRound({
        players: {
          north: makePlayerState('north', { hand: [card('dog', undefined, undefined, 1)] }),
          east: makePlayerState('east'),
          south: makePlayerState('south'),
          west: makePlayerState('west'),
        },
      });
      tracker.onStateChange(makeContext(after));

      const summary = tracker.getSummaries().get('north')!;
      expect(summary.dogStuckAsLastCard).toBe(1);
    });

    it('should only count once per round per player', () => {
      const tracker = new RoundEventTracker();
      tracker.reset(1);

      const stuck = makeRound({
        players: {
          north: makePlayerState('north', { hand: [card('dog', undefined, undefined, 1)] }),
          east: makePlayerState('east'),
          south: makePlayerState('south'),
          west: makePlayerState('west'),
        },
      });
      // Simulate multiple state changes while stuck
      tracker.onStateChange(makeContext(stuck));
      tracker.onStateChange(makeContext(stuck));

      const summary = tracker.getSummaries().get('north')!;
      expect(summary.dogStuckAsLastCard).toBe(1);
    });
  });

  // Verifies: REQ-F-CS10
  describe('Per-size bomb tracking', () => {
    it('should track a 5-card straight flush bomb', () => {
      const tracker = new RoundEventTracker();
      tracker.reset(1);

      const before = makeRound({
        currentTrick: { plays: [], passes: [], leadSeat: 'north', currentWinner: 'north' },
      });
      tracker.onStateChange(makeContext(before));

      const sfCards = [
        card('standard', 5, 'jade', 1),
        card('standard', 6, 'jade', 2),
        card('standard', 7, 'jade', 3),
        card('standard', 8, 'jade', 4),
        card('standard', 9, 'jade', 5),
      ];

      const after = makeRound({
        currentTrick: {
          plays: [{
            seat: 'north',
            combination: {
              type: CombinationType.StraightFlushBomb,
              cards: sfCards,
              isBomb: true,
              rank: 9,
              length: 5,
            },
          }],
          passes: [],
          leadSeat: 'north',
          currentWinner: 'north',
        },
      });
      tracker.onStateChange(makeContext(after));

      const summary = tracker.getSummaries().get('north')!;
      expect(summary.bombSize5).toBe(1);
      expect(summary.bombSize4).toBe(0);
    });
  });

  // Verifies: REQ-F-CS13
  describe('Conflicting bombs', () => {
    it('should detect conflict between 4-of-a-kind and straight flush sharing a card', () => {
      const tracker = new RoundEventTracker();
      tracker.reset(1);

      const passingRound = makeRound({ phase: GamePhase.CardPassing });
      tracker.onStateChange(makeContext(passingRound));

      // Hand with J-bomb + 8-J straight flush in jade (J is shared)
      // J-bomb: J jade, J pagoda, J star, J sword
      // Straight flush: 8j, 9j, 10j, Jj, Qj — removing Jj leaves 8,9,10,Q = broken (not consecutive)
      const hand = [
        card('standard', 11, 'jade', 1),    // J jade
        card('standard', 11, 'pagoda', 2),   // J pagoda
        card('standard', 11, 'star', 3),     // J star
        card('standard', 11, 'sword', 4),    // J sword
        card('standard', 8, 'jade', 5),      // 8 jade
        card('standard', 9, 'jade', 6),      // 9 jade
        card('standard', 10, 'jade', 7),     // 10 jade
        card('standard', 12, 'jade', 8),     // Q jade
        card('standard', 3, 'pagoda', 9),
        card('standard', 4, 'pagoda', 10),
        card('standard', 5, 'star', 11),
        card('standard', 6, 'star', 12),
        card('standard', 7, 'sword', 13),
        card('phoenix', undefined, undefined, 14),
      ];

      const playingRound = makeRound({
        phase: GamePhase.Playing,
        players: {
          north: makePlayerState('north', {
            hand,
            passedCards: { to: { north: null as any, east: null as any, south: null as any, west: null as any }, received: true },
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

      const summary = tracker.getSummaries().get('north')!;
      expect(summary.conflictingBombs).toBe(1);
    });

    it('should not count conflict when removing rank leaves valid 5+ flush', () => {
      const tracker = new RoundEventTracker();
      tracker.reset(1);

      const passingRound = makeRound({ phase: GamePhase.CardPassing });
      tracker.onStateChange(makeContext(passingRound));

      // 9-bomb + 8-A jade flush (7 cards). Removing 9 leaves 8,10,11,12,13,14 = 10-14 is 5 consecutive
      const hand = [
        card('standard', 9, 'jade', 1),
        card('standard', 9, 'pagoda', 2),
        card('standard', 9, 'star', 3),
        card('standard', 9, 'sword', 4),
        card('standard', 8, 'jade', 5),
        card('standard', 10, 'jade', 6),
        card('standard', 11, 'jade', 7),
        card('standard', 12, 'jade', 8),
        card('standard', 13, 'jade', 9),
        card('standard', 14, 'jade', 10),
        card('standard', 3, 'pagoda', 11),
        card('standard', 4, 'star', 12),
        card('standard', 5, 'sword', 13),
        card('phoenix', undefined, undefined, 14),
      ];

      const playingRound = makeRound({
        phase: GamePhase.Playing,
        players: {
          north: makePlayerState('north', {
            hand,
            passedCards: { to: { north: null as any, east: null as any, south: null as any, west: null as any }, received: true },
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

      const summary = tracker.getSummaries().get('north')!;
      expect(summary.conflictingBombs).toBe(0);
    });
  });

  // Verifies: REQ-F-CS19
  describe('Extended pass tracking', () => {
    it('should track gave direction for dragon/phoenix/ace/mahjong', () => {
      const tracker = new RoundEventTracker();
      tracker.reset(1);

      const passingRound = makeRound({ phase: GamePhase.CardPassing });
      tracker.onStateChange(makeContext(passingRound));

      // North gives dragon to east, phoenix to south, ace to west
      const playingRound = makeRound({
        phase: GamePhase.Playing,
        players: {
          north: makePlayerState('north', {
            passedCards: {
              to: {
                north: null as any,
                east: card('dragon', undefined, undefined, 100),
                south: card('phoenix', undefined, undefined, 101),
                west: card('standard', 14, 'jade', 102),
              },
              received: true,
            },
          }),
          east: makePlayerState('east', {
            hand: [card('dragon', undefined, undefined, 100)],
            passedCards: { to: { north: null as any, east: null as any, south: null as any, west: null as any }, received: true },
          }),
          south: makePlayerState('south', {
            hand: [card('phoenix', undefined, undefined, 101)],
            passedCards: { to: { north: null as any, east: null as any, south: null as any, west: null as any }, received: true },
          }),
          west: makePlayerState('west', {
            hand: [card('standard', 14, 'jade', 102)],
            passedCards: { to: { north: null as any, east: null as any, south: null as any, west: null as any }, received: true },
          }),
        },
      });
      tracker.onStateChange(makeContext(playingRound));

      const summary = tracker.getSummaries().get('north')!;
      expect(summary.dragonGivenInPass).toBe(true);
      expect(summary.phoenixGivenInPass).toBe(true);
      expect(summary.aceGivenInPass).toBe(true);
    });

    it('should track mahjong received in pass', () => {
      const tracker = new RoundEventTracker();
      tracker.reset(1);

      const passingRound = makeRound({ phase: GamePhase.CardPassing });
      tracker.onStateChange(makeContext(passingRound));

      // East passes mahjong to north
      const playingRound = makeRound({
        phase: GamePhase.Playing,
        players: {
          north: makePlayerState('north', {
            hand: [card('mahjong', undefined, undefined, 100)],
            passedCards: { to: { north: null as any, east: null as any, south: null as any, west: null as any }, received: true },
          }),
          east: makePlayerState('east', {
            passedCards: { to: { north: card('mahjong', undefined, undefined, 100), east: null as any, south: null as any, west: null as any }, received: true },
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

      const summary = tracker.getSummaries().get('north')!;
      expect(summary.mahjongReceivedInPass).toBe(true);
    });
  });

  // Verifies: REQ-F-CS20
  describe('Bomb completion in pass', () => {
    it('should detect when received card completes a 4-of-a-kind', () => {
      const tracker = new RoundEventTracker();
      tracker.reset(1);

      const passingRound = makeRound({ phase: GamePhase.CardPassing });
      tracker.onStateChange(makeContext(passingRound));

      // North's hand has 3 fives + receives 4th five from south (partner)
      const playingRound = makeRound({
        phase: GamePhase.Playing,
        players: {
          north: makePlayerState('north', {
            hand: [
              card('standard', 5, 'jade', 1),
              card('standard', 5, 'pagoda', 2),
              card('standard', 5, 'star', 3),
              card('standard', 5, 'sword', 4), // received from south
              card('standard', 8, 'jade', 5),
            ],
            passedCards: { to: { north: null as any, east: null as any, south: null as any, west: null as any }, received: true },
          }),
          east: makePlayerState('east', {
            passedCards: { to: { north: null as any, east: null as any, south: null as any, west: null as any }, received: true },
          }),
          south: makePlayerState('south', {
            passedCards: {
              to: { north: card('standard', 5, 'sword', 4), east: null as any, south: null as any, west: null as any },
              received: true,
            },
          }),
          west: makePlayerState('west', {
            passedCards: { to: { north: null as any, east: null as any, south: null as any, west: null as any }, received: true },
          }),
        },
      });
      tracker.onStateChange(makeContext(playingRound));

      const summary = tracker.getSummaries().get('north')!;
      expect(summary.bombReceivedFromPartnerInPass).toBe(true);
    });
  });
});
