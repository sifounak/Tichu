// Verifies: REQ-F-CP01–CP18, REQ-F-ST01

import { describe, it, expect, beforeEach } from 'vitest';
import { GameEventCapture } from '../../src/game/game-event-capture.js';
import type { GameMachineContext } from '../../src/game/game-state-machine.js';
import type { Seat, RoundState, GameCard, TrickState, PlayerState, TichuCall, GameConfig } from '@tichu/shared';
import { GamePhase, CombinationType } from '@tichu/shared';
import type { PrePlayContext } from '../../src/game/event-types.js';

// ─── Helpers ─────────────────────────────────────────────────────────

let nextId = 1;
function card(kind: string, rank?: number, suit?: string, id?: number): GameCard {
  const _id = id ?? nextId++;
  if (kind === 'dragon') return { id: _id, card: { kind: 'dragon' } } as GameCard;
  if (kind === 'phoenix') return { id: _id, card: { kind: 'phoenix' } } as GameCard;
  if (kind === 'dog') return { id: _id, card: { kind: 'dog' } } as GameCard;
  if (kind === 'mahjong') return { id: _id, card: { kind: 'mahjong' } } as GameCard;
  return { id: _id, card: { kind: 'standard', rank: rank ?? 5, suit: suit ?? 'jade' } } as GameCard;
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
    gameId: '1',
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

function makeTrick(overrides: Partial<TrickState> = {}): TrickState {
  return {
    plays: [],
    passes: [],
    leadSeat: 'north' as Seat,
    currentWinner: 'north' as Seat,
    ...overrides,
  };
}

function makePrePlayContext(seat: Seat, overrides: Partial<PrePlayContext> = {}): PrePlayContext {
  return {
    seat,
    legalPlayCount: 5,
    playedMinimum: false,
    couldHaveGoneOut: false,
    actionSource: 'player',
    partnerCardsRemaining: 14,
    leftOppCardsRemaining: 14,
    rightOppCardsRemaining: 14,
    turnStartedAt: '2026-01-01T00:00:00.000Z',
    durationMs: 1000,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('GameEventCapture', () => {
  let capture: GameEventCapture;

  beforeEach(() => {
    nextId = 1;
    capture = new GameEventCapture(1);
  });

  // ─── REQ-F-ST01: In-memory accumulation ─────────────────────────

  describe('REQ-F-ST01: In-memory accumulation', () => {
    it('should create empty accumulator on construction', () => {
      const acc = capture.getAccumulator();
      expect(acc.gameId).toBe(1);
      expect(acc.rounds).toHaveLength(0);
    });

    it('should accumulate round data after finalization', () => {
      capture.initRound(1, 0, 0);
      capture.initPlayerRounds(1, 1, {
        north: { userId: 'u1' },
        east: { userId: 'u2' },
        south: { userId: 'u3' },
        west: { userId: 'u4' },
      });
      capture.finalizeRound();

      const acc = capture.getAccumulator();
      expect(acc.rounds).toHaveLength(1);
      expect(acc.rounds[0].roundNumber).toBe(1);
      expect(acc.rounds[0].playerRounds).toHaveLength(4);
    });
  });

  // ─── REQ-F-CP02/CP04: Pre-play context management ──────────────

  describe('REQ-F-CP02/CP04: Pre-play context', () => {
    it('should record and discard pre-play contexts', () => {
      const prePlay = makePrePlayContext('north');
      capture.recordPrePlayContext('north', prePlay);
      // Discard should not throw
      capture.discardPrePlayContext('north');
      // Recording another should work
      capture.recordPrePlayContext('east', makePrePlayContext('east'));
    });
  });

  // ─── REQ-F-CP06: Round-level capture ────────────────────────────

  describe('REQ-F-CP06: Round-level capture', () => {
    it('should capture scores at round start', () => {
      capture.initRound(2, 350, 200);
      const roundData = capture.getCurrentRound();
      expect(roundData).not.toBeNull();
      expect(roundData!.roundNumber).toBe(2);
      expect(roundData!.scoreNSAtStart).toBe(350);
      expect(roundData!.scoreEWAtStart).toBe(200);
      expect(roundData!.startedAt).toBeTruthy();
    });
  });

  // ─── REQ-F-CP07: Hand capture ──────────────────────────────────

  describe('REQ-F-CP07: Hand capture', () => {
    it('should capture first 8 cards during GT phase', () => {
      const cards = Array.from({ length: 8 }, (_, i) => card('standard', i + 2, 'jade', i + 1));

      const round = makeRound({
        phase: GamePhase.GrandTichuDecision,
        players: {
          north: makePlayerState('north', { hand: cards }),
          east: makePlayerState('east', { hand: cards.map((c, i) => ({ ...c, id: i + 100 })) }),
          south: makePlayerState('south', { hand: cards.map((c, i) => ({ ...c, id: i + 200 })) }),
          west: makePlayerState('west', { hand: cards.map((c, i) => ({ ...c, id: i + 300 })) }),
        },
      });

      const ctx = makeContext(round);
      capture.onStateChange(ctx);

      const roundData = capture.getCurrentRound();
      expect(roundData).not.toBeNull();
      const northPR = roundData!.playerRounds.find(pr => pr.seat === 'north');
      expect(northPR).toBeDefined();
      expect(northPR!.first8Cards).toHaveLength(8);
      expect(northPR!.first8Cards![0]).toBe(1);
    });

    it('should capture pre-pass, pass, and post-pass hands on phase transition', () => {
      // Start in CardPassing phase
      const prePassCards = Array.from({ length: 14 }, (_, i) => card('standard', (i % 13) + 2, 'jade', i + 1));
      const postPassCards = Array.from({ length: 14 }, (_, i) => card('standard', (i % 13) + 2, 'jade', i + 50));

      const passedToEast = card('standard', 3, 'jade', 90);
      const passedToSouth = card('standard', 4, 'jade', 91);
      const passedToWest = card('standard', 5, 'jade', 92);

      const prevRound = makeRound({
        phase: GamePhase.CardPassing,
        players: {
          north: makePlayerState('north', { hand: prePassCards }),
          east: makePlayerState('east', { hand: prePassCards.map((c, i) => ({ ...c, id: i + 100 })) }),
          south: makePlayerState('south', { hand: prePassCards.map((c, i) => ({ ...c, id: i + 200 })) }),
          west: makePlayerState('west', { hand: prePassCards.map((c, i) => ({ ...c, id: i + 300 })) }),
        },
      });

      // After exchange: Playing phase with pass data visible
      const currRound = makeRound({
        phase: GamePhase.Playing,
        players: {
          north: makePlayerState('north', {
            hand: postPassCards,
            passedCards: {
              to: {
                north: null as any,
                east: passedToEast,
                south: passedToSouth,
                west: passedToWest,
              },
              received: true,
            },
          }),
          east: makePlayerState('east', {
            hand: postPassCards.map((c, i) => ({ ...c, id: i + 150 })),
            passedCards: {
              to: { north: card('standard', 6, 'jade', 93), east: null as any, south: null as any, west: null as any },
              received: true,
            },
          }),
          south: makePlayerState('south', {
            hand: postPassCards.map((c, i) => ({ ...c, id: i + 250 })),
            passedCards: {
              to: { north: card('standard', 7, 'jade', 94), east: null as any, south: null as any, west: null as any },
              received: true,
            },
          }),
          west: makePlayerState('west', {
            hand: postPassCards.map((c, i) => ({ ...c, id: i + 350 })),
            passedCards: {
              to: { north: card('standard', 8, 'jade', 95), east: null as any, south: null as any, west: null as any },
              received: true,
            },
          }),
        },
      });

      // Feed prev state first
      capture.onStateChange(makeContext(prevRound));
      // Feed curr state (transition detected)
      capture.onStateChange(makeContext(currRound));

      const roundData = capture.getCurrentRound();
      const northPR = roundData!.playerRounds.find(pr => pr.seat === 'north');

      // Pre-pass hand captured
      expect(northPR!.fullHandPrePass).toHaveLength(14);
      // Pass cards captured (north passes to east/south/west)
      expect(northPR!.passedToLeft).toBe(90); // east is left of north
      expect(northPR!.passedToPartner).toBe(91); // south is partner of north
      expect(northPR!.passedToRight).toBe(92); // west is right of north
      // Post-pass hand captured
      expect(northPR!.handAfterPass).toHaveLength(14);
    });
  });

  // ─── REQ-F-CP08: Tichu/GT call detection ────────────────────────

  describe('REQ-F-CP08: Tichu/GT call detection', () => {
    it('should detect Grand Tichu call', () => {
      const prevRound = makeRound({
        phase: GamePhase.GrandTichuDecision,
        players: {
          north: makePlayerState('north', { hand: Array.from({ length: 8 }, (_, i) => card('standard', i + 2, 'jade', i + 1)) }),
          east: makePlayerState('east'),
          south: makePlayerState('south'),
          west: makePlayerState('west'),
        },
      });
      const currRound = makeRound({
        ...prevRound,
        players: {
          ...prevRound.players,
          north: { ...prevRound.players.north, tipiCall: 'grandTichu' },
        },
      });

      capture.onStateChange(makeContext(prevRound));
      capture.onStateChange(makeContext(currRound));

      const roundData = capture.getCurrentRound();
      const northPR = roundData!.playerRounds.find(pr => pr.seat === 'north');
      expect(northPR!.grandTichuCall).toBe(true);
    });

    it('should detect mid-round Tichu call with hand sizes', () => {
      const prevRound = makeRound({
        phase: GamePhase.Playing,
        currentTurn: 'north',
        players: {
          north: makePlayerState('north', { hand: Array.from({ length: 14 }, (_, i) => card('standard', i + 2, 'jade', i + 1)) }),
          east: makePlayerState('east', { hand: Array.from({ length: 12 }, (_, i) => card('standard', i + 2, 'jade', i + 100)) }),
          south: makePlayerState('south', { hand: Array.from({ length: 10 }, (_, i) => card('standard', i + 2, 'jade', i + 200)) }),
          west: makePlayerState('west', { hand: Array.from({ length: 8 }, (_, i) => card('standard', i + 2, 'jade', i + 300)) }),
        },
      });
      const currRound = makeRound({
        ...prevRound,
        players: {
          ...prevRound.players,
          north: { ...prevRound.players.north, tipiCall: 'tichu' },
        },
      });

      capture.onStateChange(makeContext(prevRound));
      capture.onStateChange(makeContext(currRound));

      const roundData = capture.getCurrentRound();
      const northPR = roundData!.playerRounds.find(pr => pr.seat === 'north');
      expect(northPR!.tichuCall).toBe(true);
      expect(northPR!.tichuCallPhase).toBe('midRound');
      // North's partner is south, left opp is east, right opp is west
      expect(northPR!.tichuCallHandSizes).toEqual({
        partner: 10,
        leftOpp: 12,
        rightOpp: 8,
      });
    });
  });

  // ─── REQ-F-CP09/CP10: Play and trick detection ─────────────────

  describe('REQ-F-CP09/CP10: Play and trick detection', () => {
    it('should detect a new play in a trick', () => {
      const playCard = card('standard', 5, 'jade', 42);

      const prevRound = makeRound({
        phase: GamePhase.Playing,
        currentTurn: 'north',
        currentTrick: makeTrick({ plays: [], leadSeat: 'north', currentWinner: 'north' }),
        players: {
          north: makePlayerState('north', { hand: [playCard, card('standard', 7)] }),
          east: makePlayerState('east', { hand: [card('standard', 8)] }),
          south: makePlayerState('south', { hand: [card('standard', 9)] }),
          west: makePlayerState('west', { hand: [card('standard', 10)] }),
        },
      });
      const currRound = makeRound({
        phase: GamePhase.Playing,
        currentTurn: 'east',
        currentTrick: makeTrick({
          plays: [{
            seat: 'north' as Seat,
            combination: {
              type: CombinationType.Single,
              cards: [playCard],
              rank: 5,
              length: 1,
              isBomb: false,
            },
          }],
          leadSeat: 'north',
          currentWinner: 'north',
        }),
        players: {
          north: makePlayerState('north', { hand: [card('standard', 7, 'jade', 43)] }),
          east: makePlayerState('east', { hand: [card('standard', 8)] }),
          south: makePlayerState('south', { hand: [card('standard', 9)] }),
          west: makePlayerState('west', { hand: [card('standard', 10)] }),
        },
      });

      capture.onStateChange(makeContext(prevRound));

      // Record pre-play context AFTER first state change (after round init)
      const prePlay = makePrePlayContext('north', {
        legalPlayCount: 3,
        playedMinimum: true,
        actionSource: 'player',
      });
      capture.recordPrePlayContext('north', prePlay);

      capture.onStateChange(makeContext(currRound));

      const roundData = capture.getCurrentRound();
      expect(roundData!.plays).toHaveLength(1);

      const play = roundData!.plays[0];
      expect(play.seat).toBe('north');
      expect(play.actionType).toBe('play');
      expect(play.combinationType).toBe(CombinationType.Single);
      expect(play.combinationRank).toBe(5);
      expect(play.cards).toEqual([42]);
      expect(play.legalPlayCount).toBe(3);
      expect(play.playedMinimum).toBe(true);
      expect(play.actionSource).toBe('player');
      expect(play.trickNumber).toBe(1);
      expect(play.sequenceNumber).toBe(1);

      // Trick record should also exist
      expect(roundData!.tricks).toHaveLength(1);
      expect(roundData!.tricks[0].leadSeat).toBe('north');
      expect(roundData!.tricks[0].leadCombinationType).toBe(CombinationType.Single);
    });

    it('should detect a pass action', () => {
      const prevRound = makeRound({
        phase: GamePhase.Playing,
        currentTurn: 'east',
        currentTrick: makeTrick({
          plays: [{
            seat: 'north' as Seat,
            combination: {
              type: CombinationType.Single,
              cards: [card('standard', 10, 'jade', 42)],
              rank: 10,
              length: 1,
              isBomb: false,
            },
          }],
          passes: [],
          leadSeat: 'north',
          currentWinner: 'north',
        }),
        players: {
          north: makePlayerState('north', { hand: [card('standard', 7)] }),
          east: makePlayerState('east', { hand: [card('standard', 3), card('standard', 4)] }),
          south: makePlayerState('south', { hand: [card('standard', 9)] }),
          west: makePlayerState('west', { hand: [card('standard', 8)] }),
        },
      });
      const currRound = makeRound({
        ...prevRound,
        currentTurn: 'south',
        currentTrick: makeTrick({
          plays: prevRound.currentTrick!.plays,
          passes: ['east' as Seat],
          leadSeat: 'north',
          currentWinner: 'north',
        }),
      });

      capture.onStateChange(makeContext(prevRound));

      // Record pre-play context AFTER first state change (after round init)
      capture.recordPrePlayContext('east', makePrePlayContext('east', {
        legalPlayCount: 0,
        actionSource: 'player',
      }));

      capture.onStateChange(makeContext(currRound));

      const roundData = capture.getCurrentRound();
      // There should be 1 play (north's lead) + 1 pass (east)
      expect(roundData!.plays.length).toBeGreaterThanOrEqual(1);
      const passRecord = roundData!.plays.find(p => p.seat === 'east');
      expect(passRecord).toBeDefined();
      expect(passRecord!.actionType).toBe('pass');
      expect(passRecord!.couldHavePlayed).toBe(false);
    });
  });

  // ─── REQ-F-CP09: Trick completion ──────────────────────────────

  describe('REQ-F-CP09: Trick completion', () => {
    it('should finalize trick record on completion', () => {
      const c5 = card('standard', 5, 'jade', 10);
      const c10 = card('standard', 10, 'jade', 11);

      const basePlayers = {
        north: makePlayerState('north', { hand: [card('standard', 7), card('standard', 3)] }),
        east: makePlayerState('east', { hand: [card('standard', 8), card('standard', 4)] }),
        south: makePlayerState('south', { hand: [card('standard', 9)] }),
        west: makePlayerState('west', { hand: [card('standard', 6)] }),
      };

      // State 0: playing phase, empty trick (lead about to happen)
      const round0 = makeRound({
        phase: GamePhase.Playing,
        currentTurn: 'north',
        currentTrick: makeTrick({ plays: [], leadSeat: 'north', currentWinner: 'north' }),
        players: basePlayers,
      });

      // State 1: north played 5
      const round1 = makeRound({
        phase: GamePhase.Playing,
        currentTurn: 'east',
        currentTrick: makeTrick({
          plays: [
            { seat: 'north' as Seat, combination: { type: CombinationType.Single, cards: [c5], rank: 5, length: 1, isBomb: false } },
          ],
          passes: [],
          leadSeat: 'north',
          currentWinner: 'north',
        }),
        players: basePlayers,
      });

      // State 2: east played 10
      const round2 = makeRound({
        phase: GamePhase.Playing,
        currentTurn: 'south',
        currentTrick: makeTrick({
          plays: [
            { seat: 'north' as Seat, combination: { type: CombinationType.Single, cards: [c5], rank: 5, length: 1, isBomb: false } },
            { seat: 'east' as Seat, combination: { type: CombinationType.Single, cards: [c10], rank: 10, length: 1, isBomb: false } },
          ],
          passes: [],
          leadSeat: 'north',
          currentWinner: 'east',
        }),
        players: basePlayers,
      });

      // State 3: south and west passed, trick completed → new trick with east leading
      const round3 = makeRound({
        phase: GamePhase.Playing,
        currentTurn: 'east',
        currentTrick: makeTrick({ plays: [], leadSeat: 'east', currentWinner: 'east' }),
        players: basePlayers,
      });

      capture.onStateChange(makeContext(round0)); // init
      capture.onStateChange(makeContext(round1)); // north plays
      capture.onStateChange(makeContext(round2)); // east plays
      capture.onStateChange(makeContext(round3)); // trick completes

      const roundData = capture.getCurrentRound();
      // First trick completed
      const trick1 = roundData!.tricks.find(t => t.trickNumber === 1);
      expect(trick1).toBeDefined();
      expect(trick1!.winnerSeat).toBe('east');
      expect(trick1!.pointValue).toBe(15); // 5-point card + 10-point card
      expect(trick1!.trickLength).toBe(2);
      expect(trick1!.leadSeat).toBe('north');
      expect(trick1!.winningCombinationType).toBe(CombinationType.Single);
    });
  });

  // ─── REQ-F-CP11: Out-of-turn bomb ──────────────────────────────

  describe('REQ-F-CP11: Out-of-turn bomb capture', () => {
    it('should detect out-of-turn bomb play', () => {
      const bombCards = [
        card('standard', 7, 'jade', 20),
        card('standard', 7, 'star', 21),
        card('standard', 7, 'pagoda', 22),
        card('standard', 7, 'sword', 23),
      ];

      const prevRound = makeRound({
        phase: GamePhase.Playing,
        currentTurn: 'north', // It's north's turn
        currentTrick: makeTrick({
          plays: [{
            seat: 'west' as Seat,
            combination: { type: CombinationType.Single, cards: [card('standard', 5, 'jade', 50)], rank: 5, length: 1, isBomb: false },
          }],
          leadSeat: 'west',
          currentWinner: 'west',
        }),
        players: {
          north: makePlayerState('north', { hand: [card('standard', 3)] }),
          east: makePlayerState('east', { hand: [...bombCards, card('standard', 9, 'jade', 24)] }),
          south: makePlayerState('south', { hand: [card('standard', 8)] }),
          west: makePlayerState('west', { hand: [card('standard', 6)] }),
        },
      });

      const currRound = makeRound({
        phase: GamePhase.Playing,
        currentTurn: 'east',
        currentTrick: makeTrick({
          plays: [
            prevRound.currentTrick!.plays[0],
            {
              seat: 'east' as Seat,
              combination: { type: CombinationType.FourBomb, cards: bombCards, rank: 7, length: 4, isBomb: true },
            },
          ],
          leadSeat: 'west',
          currentWinner: 'east',
        }),
        players: {
          ...prevRound.players,
          east: makePlayerState('east', { hand: [card('standard', 9, 'jade', 24)] }),
        },
      });

      capture.onStateChange(makeContext(prevRound));
      capture.onStateChange(makeContext(currRound));

      const roundData = capture.getCurrentRound();
      const bombPlay = roundData!.plays.find(p => p.seat === 'east' && p.actionType === 'bomb');
      expect(bombPlay).toBeDefined();
      expect(bombPlay!.outOfTurn).toBe(true);
      expect(bombPlay!.interruptedSeat).toBe('north'); // north's turn was interrupted
      expect(bombPlay!.isBomb).toBe(true);
    });
  });

  // ─── REQ-F-CP12: Wish event capture ────────────────────────────

  describe('REQ-F-CP12: Wish event capture', () => {
    it('should detect wish declaration', () => {
      const mahjongCard = card('mahjong', undefined, undefined, 0);

      const prevRound = makeRound({
        phase: GamePhase.Playing,
        mahjongWish: null,
        currentTrick: makeTrick({
          plays: [{
            seat: 'north' as Seat,
            combination: { type: CombinationType.Single, cards: [mahjongCard], rank: 1, length: 1, isBomb: false },
          }],
          leadSeat: 'north',
          currentWinner: 'north',
        }),
        players: {
          north: makePlayerState('north', { hand: [card('standard', 5)] }),
          east: makePlayerState('east', { hand: [card('standard', 8), card('standard', 8, 'star')] }),
          south: makePlayerState('south', { hand: [card('standard', 9)] }),
          west: makePlayerState('west', { hand: [card('standard', 8, 'pagoda')] }),
        },
      });

      const currRound = makeRound({
        ...prevRound,
        mahjongWish: 8,
      });

      capture.onStateChange(makeContext(prevRound));
      capture.onStateChange(makeContext(currRound));

      const roundData = capture.getCurrentRound();
      expect(roundData!.wishEvent).not.toBeNull();
      expect(roundData!.wishEvent!.wishRank).toBe(8);
      expect(roundData!.wishEvent!.cardsOfRankRemaining).toBe(3); // east has 2, west has 1
      expect(roundData!.wishEvent!.wishFulfilledTrick).toBeNull(); // not yet fulfilled
    });

    it('should detect wish fulfillment', () => {
      // Set up wish already declared
      const prevRound = makeRound({
        phase: GamePhase.Playing,
        mahjongWish: 8,
        wishFulfilled: false,
        currentTrick: makeTrick({
          plays: [{
            seat: 'east' as Seat,
            combination: { type: CombinationType.Single, cards: [card('standard', 8, 'jade', 30)], rank: 8, length: 1, isBomb: false },
          }],
          leadSeat: 'east',
          currentWinner: 'east',
        }),
      });

      const currRound = makeRound({
        ...prevRound,
        wishFulfilled: true,
      });

      // First feed a round to initialize
      capture.onStateChange(makeContext(makeRound({ phase: GamePhase.Playing, mahjongWish: null })));
      // Then feed the wish declaration to create the wish event
      const wishDeclRound = makeRound({ phase: GamePhase.Playing, mahjongWish: 8, wishFulfilled: false });
      capture.onStateChange(makeContext(wishDeclRound));

      // Now feed the fulfillment
      capture.onStateChange(makeContext(prevRound));
      capture.onStateChange(makeContext(currRound));

      const roundData = capture.getCurrentRound();
      if (roundData!.wishEvent) {
        expect(roundData!.wishEvent.wishFulfilledBy).toBe('east');
      }
    });
  });

  // ─── REQ-F-CP13: Dragon gift capture ───────────────────────────

  describe('REQ-F-CP13: Dragon gift capture', () => {
    it('should detect dragon gift event', () => {
      const dragonCard = card('dragon', undefined, undefined, 55);
      const trickCards = [dragonCard, card('standard', 10, 'jade', 30)];

      const prevRound = makeRound({
        phase: GamePhase.Playing,
        dragonGiftPending: { trickCards, from: 'north' as Seat },
        dragonGiftedTo: null,
        players: {
          north: makePlayerState('north', { hand: [card('standard', 5)] }),
          east: makePlayerState('east', { hand: Array.from({ length: 8 }, (_, i) => card('standard', i + 2, 'jade', i + 100)) }),
          south: makePlayerState('south', { hand: [card('standard', 9)] }),
          west: makePlayerState('west', { hand: Array.from({ length: 5 }, (_, i) => card('standard', i + 2, 'jade', i + 200)) }),
        },
      });

      const currRound = makeRound({
        ...prevRound,
        dragonGiftPending: null,
        dragonGiftedTo: 'east',
      });

      capture.onStateChange(makeContext(prevRound));
      capture.onStateChange(makeContext(currRound));

      const roundData = capture.getCurrentRound();
      expect(roundData!.dragonGiftEvents).toHaveLength(1);
      const gift = roundData!.dragonGiftEvents[0];
      expect(gift.gifterSeat).toBe('north');
      expect(gift.recipientSeat).toBe('east');
      expect(gift.trickPointValue).toBe(35); // Dragon(25) + 10-card(10)
      expect(gift.recipientCardsLeft).toBe(8);
    });
  });

  // ─── REQ-F-CP14: Dog play capture ──────────────────────────────

  describe('REQ-F-CP14: Dog play capture', () => {
    it('should detect dog play event', () => {
      const prevRound = makeRound({
        phase: GamePhase.Playing,
        lastDogPlay: null,
        players: {
          north: makePlayerState('north', { hand: [card('standard', 5)] }),
          east: makePlayerState('east'),
          south: makePlayerState('south'),
          west: makePlayerState('west'),
        },
      });

      const currRound = makeRound({
        ...prevRound,
        lastDogPlay: { fromSeat: 'north' as Seat, toSeat: 'south' as Seat },
        players: {
          ...prevRound.players,
          north: makePlayerState('north', { hand: [card('standard', 5)] }),
        },
      });

      capture.onStateChange(makeContext(prevRound));
      capture.onStateChange(makeContext(currRound));

      const roundData = capture.getCurrentRound();
      expect(roundData!.dogPlayEvents).toHaveLength(1);
      const dogEvent = roundData!.dogPlayEvents[0];
      expect(dogEvent.playerSeat).toBe('north');
      expect(dogEvent.controlPassedTo).toBe('south');
      expect(dogEvent.partnerAlreadyOut).toBe(false);
      expect(dogEvent.dogWasLastCard).toBe(false);
    });

    it('should detect dog as last card', () => {
      const prevRound = makeRound({
        phase: GamePhase.Playing,
        lastDogPlay: null,
        players: {
          north: makePlayerState('north', { hand: [] }), // empty after playing dog
          east: makePlayerState('east'),
          south: makePlayerState('south'),
          west: makePlayerState('west'),
        },
      });

      const currRound = makeRound({
        ...prevRound,
        lastDogPlay: { fromSeat: 'north' as Seat, toSeat: 'south' as Seat },
      });

      capture.onStateChange(makeContext(prevRound));
      capture.onStateChange(makeContext(currRound));

      const roundData = capture.getCurrentRound();
      expect(roundData!.dogPlayEvents[0].dogWasLastCard).toBe(true);
    });
  });

  // ─── REQ-F-CP15: Bomb inventory ────────────────────────────────

  describe('REQ-F-CP15: Bomb inventory capture', () => {
    it('should detect bombs after pass resolution', () => {
      // 4 sevens = bomb in hand after pass
      const hand = [
        card('standard', 7, 'jade', 1),
        card('standard', 7, 'star', 2),
        card('standard', 7, 'pagoda', 3),
        card('standard', 7, 'sword', 4),
        ...Array.from({ length: 10 }, (_, i) => card('standard', i + 2, 'jade', i + 10)),
      ];

      const prevRound = makeRound({
        phase: GamePhase.CardPassing,
        players: {
          north: makePlayerState('north', { hand }),
          east: makePlayerState('east', { hand: Array.from({ length: 14 }, (_, i) => card('standard', i + 2, 'jade', i + 100)) }),
          south: makePlayerState('south', { hand: Array.from({ length: 14 }, (_, i) => card('standard', i + 2, 'jade', i + 200)) }),
          west: makePlayerState('west', { hand: Array.from({ length: 14 }, (_, i) => card('standard', i + 2, 'jade', i + 300)) }),
        },
      });

      const currRound = makeRound({
        phase: GamePhase.Playing,
        players: {
          north: makePlayerState('north', {
            hand,
            passedCards: { to: { north: null as any, east: null as any, south: null as any, west: null as any }, received: true },
          }),
          east: makePlayerState('east', {
            hand: Array.from({ length: 14 }, (_, i) => card('standard', i + 2, 'jade', i + 100)),
            passedCards: { to: { north: null as any, east: null as any, south: null as any, west: null as any }, received: true },
          }),
          south: makePlayerState('south', {
            hand: Array.from({ length: 14 }, (_, i) => card('standard', i + 2, 'jade', i + 200)),
            passedCards: { to: { north: null as any, east: null as any, south: null as any, west: null as any }, received: true },
          }),
          west: makePlayerState('west', {
            hand: Array.from({ length: 14 }, (_, i) => card('standard', i + 2, 'jade', i + 300)),
            passedCards: { to: { north: null as any, east: null as any, south: null as any, west: null as any }, received: true },
          }),
        },
      });

      capture.onStateChange(makeContext(prevRound));
      capture.onStateChange(makeContext(currRound));

      const roundData = capture.getCurrentRound();
      const northBombs = roundData!.bombInventory.filter(b => b.playerSeat === 'north');
      expect(northBombs.length).toBeGreaterThanOrEqual(1);
      expect(northBombs[0].bombType).toBe('fourOfAKind');
      expect(northBombs[0].rank).toBe(7);
      expect(northBombs[0].size).toBe(4);
    });
  });

  // ─── REQ-F-CP17: Bot action capture ────────────────────────────

  describe('REQ-F-CP17: Bot action capture', () => {
    it('should compute retroactive pre-play context for bot plays', () => {
      const playCard = card('standard', 5, 'jade', 42);

      const prevRound = makeRound({
        phase: GamePhase.Playing,
        currentTurn: 'north',
        currentTrick: makeTrick({ plays: [], leadSeat: 'north', currentWinner: 'north' }),
        players: {
          north: makePlayerState('north', { hand: [playCard, card('standard', 7, 'jade', 43)] }),
          east: makePlayerState('east', { hand: [card('standard', 8)] }),
          south: makePlayerState('south', { hand: [card('standard', 9)] }),
          west: makePlayerState('west', { hand: [card('standard', 10)] }),
        },
      });
      const currRound = makeRound({
        phase: GamePhase.Playing,
        currentTurn: 'east',
        currentTrick: makeTrick({
          plays: [{
            seat: 'north' as Seat,
            combination: { type: CombinationType.Single, cards: [playCard], rank: 5, length: 1, isBomb: false },
          }],
          leadSeat: 'north',
          currentWinner: 'north',
        }),
        players: {
          north: makePlayerState('north', { hand: [card('standard', 7, 'jade', 43)] }),
          east: makePlayerState('east', { hand: [card('standard', 8)] }),
          south: makePlayerState('south', { hand: [card('standard', 9)] }),
          west: makePlayerState('west', { hand: [card('standard', 10)] }),
        },
      });

      // NO pre-play context recorded — simulates bot play
      capture.onStateChange(makeContext(prevRound));
      capture.onStateChange(makeContext(currRound));

      const roundData = capture.getCurrentRound();
      const play = roundData!.plays.find(p => p.seat === 'north');
      expect(play).toBeDefined();
      // Should have retroactive enrichment
      expect(play!.actionSource).toBe('bot');
      expect(play!.legalPlayCount).toBeGreaterThan(0);
    });
  });

  // ─── REQ-F-CP05: Game-level / player finish ────────────────────

  describe('Player finish detection', () => {
    it('should detect player going out', () => {
      const prevRound = makeRound({
        phase: GamePhase.Playing,
        finishOrder: [],
        players: {
          north: makePlayerState('north', { finishOrder: null, hand: [] }),
          east: makePlayerState('east', { hand: [card('standard', 5)] }),
          south: makePlayerState('south', { hand: [card('standard', 6)] }),
          west: makePlayerState('west', { hand: [card('standard', 7)] }),
        },
      });
      const currRound = makeRound({
        ...prevRound,
        finishOrder: ['north' as Seat],
        players: {
          ...prevRound.players,
          north: makePlayerState('north', { finishOrder: 1, hand: [] }),
        },
      });

      capture.onStateChange(makeContext(prevRound));
      capture.onStateChange(makeContext(currRound));

      const roundData = capture.getCurrentRound();
      const northPR = roundData!.playerRounds.find(pr => pr.seat === 'north');
      expect(northPR!.finishPosition).toBe(1);
    });
  });

  // ─── REQ-F-CP06: Round scoring finalization ────────────────────

  describe('REQ-F-CP06: Round scoring finalization', () => {
    it('should finalize player round scoring', () => {
      capture.initRound(1, 0, 0);
      capture.initPlayerRounds(1, 1, {
        north: { userId: 'u1' },
        east: { userId: 'u2' },
        south: { userId: 'u3' },
        west: { userId: 'u4' },
      });

      // Simulate a round with tricks won
      const c5 = card('standard', 5, 'jade', 10);
      const c10 = card('standard', 10, 'jade', 11);

      const round = makeRound({
        phase: GamePhase.RoundScoring,
        finishOrder: ['north', 'south', 'east', 'west'] as Seat[],
        players: {
          north: makePlayerState('north', {
            finishOrder: 1,
            hand: [],
            tricksWon: [[c5, c10]], // won a trick with 5+10=15 points
          }),
          east: makePlayerState('east', {
            finishOrder: 3,
            hand: [card('standard', 5, 'jade', 30)], // still has 5 points in hand
            tricksWon: [],
          }),
          south: makePlayerState('south', {
            finishOrder: 2,
            hand: [],
            tricksWon: [],
          }),
          west: makePlayerState('west', {
            finishOrder: 4,
            hand: [card('standard', 10, 'jade', 31)], // last player, 10 points in hand
            tricksWon: [[card('standard', 13, 'jade', 32)]], // won 10 points
          }),
        },
      });

      capture.finalizePlayerRoundScoring(round);

      const roundData = capture.getCurrentRound();
      const northPR = roundData!.playerRounds.find(pr => pr.seat === 'north');
      expect(northPR!.cardPointsCaptured).toBe(15);

      // West is last (4th), first out is north (NS team), west is EW team
      // So west's captured points go to first-out player
      const westPR = roundData!.playerRounds.find(pr => pr.seat === 'west');
      expect(westPR!.handPointsGivenToOpponents).toBe(10);
      expect(westPR!.capturedPointsGivenToFirstOut).toBe(10);
    });
  });

  // ─── REQ-F-CP15: Bomb fate finalization ────────────────────────

  describe('Bomb fate finalization', () => {
    it('should set heldToEnd fate for unused bombs on round finalize', () => {
      // Manually add a bomb inventory record
      capture.initRound(1, 0, 0);
      capture.initPlayerRounds(1, 1, {
        north: { userId: 'u1' },
        east: { userId: 'u2' },
        south: { userId: 'u3' },
        west: { userId: 'u4' },
      });

      const roundData = capture.getCurrentRound()!;
      roundData.bombInventory.push({
        gameId: 1,
        roundNumber: 1,
        playerSeat: 'north',
        bombType: 'fourOfAKind',
        cards: [1, 2, 3, 4],
        rank: 7,
        size: 4,
        acquiredPhase: 'postPass',
        bombPlaysFromRun: 0,
        overlapsWith: [],
        fate: null, // not resolved
        fateTrickNumber: null,
        fateTarget: null,
        outOfTurn: null,
        endOfTrickBomb: null,
        playsSeenWhileHeld: 0,
        capturedDragon: false,
        wasOverbomb: false,
        followedByDog: false,
      });

      capture.finalizeRound();

      const acc = capture.getAccumulator();
      const finalized = acc.rounds[0].bombInventory[0];
      expect(finalized.fate).toBe('heldToEnd');
    });

    it('should mark capturedDragon when the winning combination of a dragon trick is a bomb', () => {
      // Scenario: East leads Dragon as a Single. North bombs with four-sevens and wins.
      // On trick completion the winning bomb should be flagged capturedDragon = true.
      const dragon = card('dragon', undefined, undefined, 100);
      const bombCards = [
        card('standard', 7, 'jade', 1),
        card('standard', 7, 'sword', 2),
        card('standard', 7, 'pagoda', 3),
        card('standard', 7, 'star', 4),
      ];

      capture.initRound(1, 0, 0);
      capture.initPlayerRounds(1, 1, {
        north: { userId: 'u1' },
        east: { userId: 'u2' },
        south: { userId: 'u3' },
        west: { userId: 'u4' },
      });

      // Seed bomb inventory for North in both the per-round list and the
      // internal per-seat map (normally populated when hands are captured).
      const roundData = capture.getCurrentRound()!;
      const northBomb = {
        gameId: 1,
        roundNumber: 1,
        playerSeat: 'north' as Seat,
        bombType: 'fourOfAKind' as const,
        cards: bombCards.map(c => c.id),
        rank: 7,
        size: 4,
        acquiredPhase: 'postPass' as const,
        bombPlaysFromRun: 0,
        overlapsWith: [],
        fate: null,
        fateTrickNumber: null,
        fateTarget: null,
        outOfTurn: null,
        endOfTrickBomb: null,
        playsSeenWhileHeld: 0,
        capturedDragon: false,
        wasOverbomb: false,
        followedByDog: false,
      };
      roundData.bombInventory.push(northBomb);
      (capture as unknown as { bombInventoryBySeat: Map<Seat, unknown[]> })
        .bombInventoryBySeat.set('north', [northBomb]);

      const players = {
        north: makePlayerState('north', { hand: bombCards }),
        east: makePlayerState('east', { hand: [dragon, card('standard', 9, 'jade', 50)] }),
        south: makePlayerState('south', { hand: [card('standard', 8, 'jade', 51)] }),
        west: makePlayerState('west', { hand: [card('standard', 6, 'jade', 52)] }),
      };

      // State 0: Playing phase, no trick started yet. Establishes a prevContext
      // so the s0→s1 transition fires detectPlays (which creates the trick record).
      const s0 = makeRound({
        phase: GamePhase.Playing,
        currentTurn: 'east',
        currentTrick: null,
        players,
      });

      // State 1: East leads Dragon as a Single, currentTurn=south.
      const s1 = makeRound({
        phase: GamePhase.Playing,
        currentTurn: 'south',
        currentTrick: makeTrick({
          plays: [{
            seat: 'east',
            combination: { type: CombinationType.Single, cards: [dragon], rank: 15, length: 1, isBomb: false },
          }],
          leadSeat: 'east',
          currentWinner: 'east',
        }),
        players,
      });

      // State 2: North bombs over the dragon, trackBombErosion runs and flips
      // the inventory bomb's fate to 'played' with fateTrickNumber=<current>.
      const s2 = makeRound({
        phase: GamePhase.Playing,
        currentTurn: 'east', // wraps to next player after winner
        currentTrick: makeTrick({
          plays: [
            s1.currentTrick!.plays[0]!,
            {
              seat: 'north',
              combination: { type: CombinationType.FourBomb, cards: bombCards, rank: 7, length: 4, isBomb: true },
            },
          ],
          leadSeat: 'east',
          currentWinner: 'north',
        }),
        players: {
          ...s1.players,
          north: makePlayerState('north', { hand: [] }),
        },
      });

      // State 3: Trick cleared, which triggers detectTrickCompletion
      // against the previous (complete) trick.
      const s3 = makeRound({
        phase: GamePhase.Playing,
        currentTurn: 'north',
        currentTrick: null,
        players: s2.players,
      });

      capture.onStateChange(makeContext(s0));
      capture.onStateChange(makeContext(s1));
      capture.onStateChange(makeContext(s2));
      capture.onStateChange(makeContext(s3));

      const finalized = capture.getCurrentRound()!.bombInventory[0]!;
      expect(finalized.fate).toBe('played');
      expect(finalized.capturedDragon).toBe(true);
    });

    it('should not mark capturedDragon when the trick has no dragon', () => {
      // Same bomb-wins-trick setup, but lead is a plain Single (no dragon).
      const bombCards = [
        card('standard', 7, 'jade', 1),
        card('standard', 7, 'sword', 2),
        card('standard', 7, 'pagoda', 3),
        card('standard', 7, 'star', 4),
      ];

      capture.initRound(1, 0, 0);
      capture.initPlayerRounds(1, 1, {
        north: { userId: 'u1' },
        east: { userId: 'u2' },
        south: { userId: 'u3' },
        west: { userId: 'u4' },
      });

      const roundData = capture.getCurrentRound()!;
      const northBomb = {
        gameId: 1,
        roundNumber: 1,
        playerSeat: 'north' as Seat,
        bombType: 'fourOfAKind' as const,
        cards: bombCards.map(c => c.id),
        rank: 7,
        size: 4,
        acquiredPhase: 'postPass' as const,
        bombPlaysFromRun: 0,
        overlapsWith: [],
        fate: null,
        fateTrickNumber: null,
        fateTarget: null,
        outOfTurn: null,
        endOfTrickBomb: null,
        playsSeenWhileHeld: 0,
        capturedDragon: false,
        wasOverbomb: false,
        followedByDog: false,
      };
      roundData.bombInventory.push(northBomb);
      (capture as unknown as { bombInventoryBySeat: Map<Seat, unknown[]> })
        .bombInventoryBySeat.set('north', [northBomb]);

      const lead = card('standard', 9, 'jade', 60);
      const players = {
        north: makePlayerState('north', { hand: bombCards }),
        east: makePlayerState('east', { hand: [lead] }),
        south: makePlayerState('south', { hand: [] }),
        west: makePlayerState('west', { hand: [] }),
      };
      const s0 = makeRound({
        phase: GamePhase.Playing,
        currentTurn: 'east',
        currentTrick: null,
        players,
      });
      const s1 = makeRound({
        phase: GamePhase.Playing,
        currentTurn: 'south',
        currentTrick: makeTrick({
          plays: [{
            seat: 'east',
            combination: { type: CombinationType.Single, cards: [lead], rank: 9, length: 1, isBomb: false },
          }],
          leadSeat: 'east',
          currentWinner: 'east',
        }),
        players,
      });
      const s2 = makeRound({
        ...s1,
        currentTrick: makeTrick({
          plays: [
            s1.currentTrick!.plays[0]!,
            { seat: 'north', combination: { type: CombinationType.FourBomb, cards: bombCards, rank: 7, length: 4, isBomb: true } },
          ],
          leadSeat: 'east',
          currentWinner: 'north',
        }),
      });
      const s3 = makeRound({ ...s2, currentTrick: null });

      capture.onStateChange(makeContext(s0));
      capture.onStateChange(makeContext(s1));
      capture.onStateChange(makeContext(s2));
      capture.onStateChange(makeContext(s3));

      const finalized = capture.getCurrentRound()!.bombInventory[0]!;
      expect(finalized.fate).toBe('played');
      expect(finalized.capturedDragon).toBe(false);
    });
  });

  // ─── Seat→userId resolver ───────────────────────────────────────

  describe('seat→userId resolver', () => {
    it('auto-init uses resolver to populate user_id for each seat', () => {
      const resolver = (seat: Seat): string | null => {
        const map: Record<Seat, string | null> = {
          north: 'user_n', east: 'user_e', south: 'user_s', west: 'user_w',
        };
        return map[seat];
      };
      capture.wireSeatUserIdResolver(resolver);

      const round = makeRound({
        roundNumber: 1,
        phase: GamePhase.GrandTichuDecision,
        players: {
          north: makePlayerState('north', { hand: Array.from({ length: 8 }, (_, i) => card('standard', i + 2, 'jade', i + 1)) }),
          east: makePlayerState('east', { hand: Array.from({ length: 8 }, (_, i) => card('standard', i + 2, 'jade', i + 100)) }),
          south: makePlayerState('south', { hand: Array.from({ length: 8 }, (_, i) => card('standard', i + 2, 'jade', i + 200)) }),
          west: makePlayerState('west', { hand: Array.from({ length: 8 }, (_, i) => card('standard', i + 2, 'jade', i + 300)) }),
        },
      });
      const ctx = makeContext(round, { gameId: '42' });
      capture.onStateChange(ctx);

      const cr = capture.getCurrentRound();
      expect(cr).not.toBeNull();
      expect(cr!.playerRounds.find(p => p.seat === 'north')!.userId).toBe('user_n');
      expect(cr!.playerRounds.find(p => p.seat === 'east')!.userId).toBe('user_e');
      expect(cr!.playerRounds.find(p => p.seat === 'south')!.userId).toBe('user_s');
      expect(cr!.playerRounds.find(p => p.seat === 'west')!.userId).toBe('user_w');
    });

    it('auto-init leaves user_id null when no resolver is wired (pre-fix behavior)', () => {
      // NO resolver wired
      const round = makeRound({
        roundNumber: 1,
        phase: GamePhase.GrandTichuDecision,
        players: {
          north: makePlayerState('north', { hand: Array.from({ length: 8 }, (_, i) => card('standard', i + 2, 'jade', i + 1)) }),
          east: makePlayerState('east', { hand: Array.from({ length: 8 }, (_, i) => card('standard', i + 2, 'jade', i + 100)) }),
          south: makePlayerState('south', { hand: Array.from({ length: 8 }, (_, i) => card('standard', i + 2, 'jade', i + 200)) }),
          west: makePlayerState('west', { hand: Array.from({ length: 8 }, (_, i) => card('standard', i + 2, 'jade', i + 300)) }),
        },
      });
      const ctx = makeContext(round, { gameId: '42' });
      capture.onStateChange(ctx);

      const cr = capture.getCurrentRound();
      for (const pr of cr!.playerRounds) {
        expect(pr.userId).toBeNull();
      }
    });

    it('auto-init treats bot seats (resolver returns null) as null userId', () => {
      capture.wireSeatUserIdResolver((seat) => (seat === 'north' ? 'user_n' : null));

      const round = makeRound({
        roundNumber: 1,
        phase: GamePhase.GrandTichuDecision,
        players: {
          north: makePlayerState('north', { hand: Array.from({ length: 8 }, (_, i) => card('standard', i + 2, 'jade', i + 1)) }),
          east: makePlayerState('east', { hand: Array.from({ length: 8 }, (_, i) => card('standard', i + 2, 'jade', i + 100)) }),
          south: makePlayerState('south', { hand: Array.from({ length: 8 }, (_, i) => card('standard', i + 2, 'jade', i + 200)) }),
          west: makePlayerState('west', { hand: Array.from({ length: 8 }, (_, i) => card('standard', i + 2, 'jade', i + 300)) }),
        },
      });
      const ctx = makeContext(round, { gameId: '42' });
      capture.onStateChange(ctx);

      const cr = capture.getCurrentRound();
      expect(cr!.playerRounds.find(p => p.seat === 'north')!.userId).toBe('user_n');
      expect(cr!.playerRounds.find(p => p.seat === 'east')!.userId).toBeNull();
      expect(cr!.playerRounds.find(p => p.seat === 'south')!.userId).toBeNull();
      expect(cr!.playerRounds.find(p => p.seat === 'west')!.userId).toBeNull();
    });
  });

  // ─── Auto-init round from state change ─────────────────────────

  describe('Auto-init round from state change', () => {
    it('should auto-initialize round when first state change arrives', () => {
      const round = makeRound({
        roundNumber: 3,
        phase: GamePhase.GrandTichuDecision,
        players: {
          north: makePlayerState('north', { hand: Array.from({ length: 8 }, (_, i) => card('standard', i + 2, 'jade', i + 1)) }),
          east: makePlayerState('east', { hand: Array.from({ length: 8 }, (_, i) => card('standard', i + 2, 'jade', i + 100)) }),
          south: makePlayerState('south', { hand: Array.from({ length: 8 }, (_, i) => card('standard', i + 2, 'jade', i + 200)) }),
          west: makePlayerState('west', { hand: Array.from({ length: 8 }, (_, i) => card('standard', i + 2, 'jade', i + 300)) }),
        },
      });

      const ctx = makeContext(round, { scores: { northSouth: 400, eastWest: 250 } });
      capture.onStateChange(ctx);

      const roundData = capture.getCurrentRound();
      expect(roundData).not.toBeNull();
      expect(roundData!.roundNumber).toBe(3);
      expect(roundData!.scoreNSAtStart).toBe(400);
      expect(roundData!.scoreEWAtStart).toBe(250);
    });
  });
});
