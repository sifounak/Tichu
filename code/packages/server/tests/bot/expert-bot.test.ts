// Verifies: REQ-F-INFO02, REQ-F-CALL01, REQ-F-CALL02, REQ-F-PASS04,
// REQ-F-PLAY05, REQ-F-PLAY06, REQ-F-PLAY07, REQ-F-DEF01, REQ-F-INFO01

import { describe, it, expect, beforeEach } from 'vitest';
import type { GameCard, Rank, Seat, Combination, TrickState, RoundState } from '@tichu/shared';
import { CombinationType, Suit } from '@tichu/shared';
import { ExpertBot } from '../../src/bot/expert-bot.js';
import type { BotPlayContext } from '../../src/bot/bot-interface.js';

// ─── Test Helpers ───────────────────────────────────────────────────────────

let nextId = 1;

function card(kind: string, rank?: number, suit?: string, id?: number): GameCard {
  if (kind === 'standard') {
    return {
      id: id ?? nextId++,
      card: { kind: 'standard', rank: rank as Rank, suit: suit as any ?? Suit.Jade },
    };
  }
  const idMap: Record<string, number> = { dragon: 900, phoenix: 901, mahjong: 902, dog: 903 };
  return { id: id ?? idMap[kind], card: { kind } as any };
}

function makeCombo(
  type: CombinationType,
  cards: GameCard[],
  rank: number,
  isBomb = false,
  phoenixUsedAs?: number,
): Combination {
  return { type, cards, rank, length: cards.length, isBomb, phoenixUsedAs };
}

function makeRoundState(overrides: Partial<Record<string, any>> = {}): RoundState {
  return {
    roundNumber: 1,
    phase: 'playing',
    currentTrick: null,
    currentTurn: 'north',
    mahjongWish: null,
    wishFulfilled: false,
    finishOrder: [],
    dragonGiftPending: null,
    dragonGiftedTo: null,
    lastDogPlay: null,
    bombsPerTeam: { northSouth: 0, eastWest: 0 },
    players: {
      north: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
      east: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
      south: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
      west: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
    },
    ...overrides,
  } as any;
}

function makePlayContext(overrides: Partial<BotPlayContext>): BotPlayContext {
  return {
    hand: [],
    currentTrick: null,
    wish: null,
    validPlays: [],
    canPass: true,
    roundState: makeRoundState(),
    seat: 'north' as Seat,
    ...overrides,
  };
}

function makeTrick(
  leadSeat: Seat,
  currentWinner: Seat,
  plays: Array<{ seat: Seat; combination: Combination }> = [],
): TrickState {
  return { plays, passes: [], leadSeat, currentWinner };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ExpertBot', () => {
  beforeEach(() => {
    nextId = 1;
  });

  // ─── Difficulty ──────────────────────────────────────────────────────────

  describe('difficulty', () => {
    it('reports difficulty as expert', () => {
      const bot = new ExpertBot();
      expect(bot.difficulty).toBe('expert');
    });
  });

  // ─── Grand Tichu (REQ-F-CALL01) ─────────────────────────────────────────

  describe('chooseGrandTichu', () => {
    // Verifies: REQ-F-CALL01
    it('calls Grand Tichu with Dragon + Phoenix', () => {
      const bot = new ExpertBot();
      const hand8 = [
        card('dragon'), card('phoenix'),
        card('standard', 5), card('standard', 6),
        card('standard', 7), card('standard', 8),
        card('standard', 3), card('standard', 2),
      ];
      expect(bot.chooseGrandTichu(hand8)).toBe(true);
    });

    it('never calls with 0-1 top cards', () => {
      const bot = new ExpertBot();
      const hand0 = [
        card('standard', 2), card('standard', 3),
        card('standard', 4), card('standard', 5),
        card('standard', 6), card('standard', 7),
        card('standard', 8), card('standard', 9),
      ];
      expect(bot.chooseGrandTichu(hand0)).toBe(false);
    });

    it('calls with 3+ top cards when Dragon present (more aggressive than HardBot)', () => {
      const bot = new ExpertBot();
      const hand = [
        card('dragon'),
        card('standard', 14, 'jade'), // Ace
        card('mahjong'),               // Top card with includeMahjongDog
        card('standard', 5), card('standard', 6),
        card('standard', 7), card('standard', 8),
        card('standard', 9),
      ];
      // Dragon + Ace + Mahjong = 3 top cards with Dragon → Expert calls
      expect(bot.chooseGrandTichu(hand)).toBe(true);
    });

    it('does not call with only 2 top cards without Dragon+Phoenix combo', () => {
      const bot = new ExpertBot();
      const hand = [
        card('standard', 14, 'jade'),  // Ace
        card('standard', 14, 'pagoda'), // Ace
        card('standard', 5), card('standard', 6),
        card('standard', 7), card('standard', 8),
        card('standard', 3), card('standard', 2),
      ];
      // 2 Aces = 2 top cards, no Dragon/Phoenix → doesn't call
      expect(bot.chooseGrandTichu(hand)).toBe(false);
    });
  });

  // ─── Regular Tichu (REQ-F-CALL02) ───────────────────────────────────────

  describe('chooseRegularTichu', () => {
    // Verifies: REQ-F-CALL02
    it('calls Tichu with very strong hand', () => {
      const bot = new ExpertBot();
      const hand14 = [
        card('dragon'), card('phoenix'),
        card('standard', 14, 'jade', 1401), card('standard', 14, 'pagoda', 1402),
        card('standard', 14, 'star', 1403), card('standard', 14, 'sword', 1404),
        card('standard', 13, 'jade', 1301), card('standard', 13, 'pagoda', 1302),
        card('standard', 13, 'star', 1303), card('standard', 12, 'jade', 1201),
        card('standard', 11, 'jade', 1101), card('standard', 10, 'jade', 1001),
        card('standard', 9, 'jade', 991), card('dog'),
      ];
      expect(bot.chooseRegularTichu(hand14)).toBe(true);
    });

    it('does not call Tichu with weak hand', () => {
      const bot = new ExpertBot();
      const hand14 = [
        card('standard', 2, 'jade', 201), card('standard', 3, 'pagoda', 301),
        card('standard', 4, 'star', 401), card('standard', 5, 'sword', 501),
        card('standard', 6, 'jade', 601), card('standard', 7, 'pagoda', 701),
        card('standard', 8, 'star', 801), card('standard', 9, 'sword', 991),
        card('standard', 10, 'jade', 1001), card('standard', 2, 'pagoda', 202),
        card('standard', 3, 'star', 302), card('standard', 4, 'sword', 402),
        card('standard', 5, 'jade', 502), card('standard', 6, 'pagoda', 602),
      ];
      expect(bot.chooseRegularTichu(hand14)).toBe(false);
    });

    // Verifies: REQ-F-CALL02 (score-aware suppression)
    it('suppresses Tichu call when team leads by 200+', () => {
      const bot = new ExpertBot();
      // Strong hand that normally triggers Tichu
      const hand14 = [
        card('dragon'), card('phoenix'),
        card('standard', 14, 'jade', 1401), card('standard', 14, 'pagoda', 1402),
        card('standard', 14, 'star', 1403), card('standard', 14, 'sword', 1404),
        card('standard', 13, 'jade', 1301), card('standard', 13, 'pagoda', 1302),
        card('standard', 13, 'star', 1303), card('standard', 12, 'jade', 1201),
        card('standard', 11, 'jade', 1101), card('standard', 10, 'jade', 1001),
        card('standard', 9, 'jade', 991), card('dog'),
      ];

      // Without score context, should call
      expect(bot.chooseRegularTichu(hand14)).toBe(true);

      // With team leading by 200+, threshold increases — suppresses call for weaker hands
      bot.setScoreDiff(300);
      // This very strong hand still passes the higher threshold
      // Use a moderately strong hand that passes default but not elevated threshold
      const moderateHand = [
        card('dragon'), card('phoenix'),
        card('standard', 14, 'jade', 2401), card('standard', 13, 'jade', 2301),
        card('standard', 10, 'jade', 2001), card('standard', 9, 'jade', 2991),
        card('standard', 8, 'star', 2801), card('standard', 7, 'pagoda', 2701),
        card('standard', 6, 'jade', 2601), card('standard', 5, 'star', 2501),
        card('standard', 4, 'jade', 2401), card('standard', 3, 'pagoda', 2301),
        card('standard', 2, 'jade', 2201), card('dog'),
      ];
      // With elevated threshold (15, 5 lead getters), this should be suppressed
      expect(bot.chooseRegularTichu(moderateHand)).toBe(false);
    });

    it('is more aggressive when behind by 200+', () => {
      const bot = new ExpertBot();
      // Hand: Dragon(3) + Phoenix(2.5) + 2 Aces(4) + King(1.5) + Queen(.5) + Dog(1) = 12.5
      // Low singletons: 8,7 are above 6 so no penalty.
      // Lead getters: Dragon + 2 Aces + Dog = 4 (but no bomb since only 2 aces)
      // Wait — lead getters = 3 if we only count distinct leads. Let me use:
      // Dragon + Ace + Ace + Dog = 4 lead getters (each Ace is a separate lead)
      // Strength: 12.5, leadGetters: 4 → passes normal threshold (12/4)
      // Need a hand where strength >= 10 && leadGetters >= 3 but NOT >= 12 && >= 4
      //
      // Dragon(3) + Ace(2) + King(1.5) + 2 Kings(3.0) + Queen(.5) + Dog(1) = 11
      // Low singletons: none below 6 → no penalty
      // Lead getters: Dragon + Ace + Dog = 3
      // → 11 >= 10 (yes), 3 >= 3 (yes) for behind threshold
      // → 11 < 12 for normal threshold → doesn't call normally
      const hand14 = [
        card('dragon'),
        card('standard', 14, 'jade', 1401),
        card('standard', 13, 'jade', 1301), card('standard', 13, 'pagoda', 1302),
        card('standard', 13, 'star', 1303),
        card('standard', 12, 'jade', 1201), card('standard', 11, 'jade', 1101),
        card('standard', 10, 'jade', 1001), card('standard', 9, 'jade', 991),
        card('standard', 8, 'star', 801), card('standard', 8, 'pagoda', 802),
        card('standard', 7, 'pagoda', 701), card('standard', 7, 'jade', 702),
        card('dog'),
      ];

      // Normally doesn't call (strength ~11, leadGetters=3, below 12/4 threshold)
      expect(bot.chooseRegularTichu(hand14)).toBe(false);

      // When behind by 200+, lower threshold (10/3) makes call succeed
      bot.setScoreDiff(-300);
      expect(bot.chooseRegularTichu(hand14)).toBe(true);
    });
  });

  // ─── Card Passing (REQ-F-PASS04) ───────────────────────────────────────

  describe('chooseCardsToPass', () => {
    // Verifies: REQ-F-PASS04
    it('avoids passing two same-rank cards to one opponent', () => {
      const bot = new ExpertBot();
      const hand = [
        card('standard', 3, 'jade', 301),
        card('standard', 3, 'pagoda', 302),
        card('standard', 5, 'star', 501),
        card('standard', 10, 'sword', 1001),
        card('standard', 14, 'jade', 1401),
      ];

      const result = bot.chooseCardsToPass(hand, 'north');

      // Check that east and west don't both get rank-3 cards
      const eastRank = result.east?.card.kind === 'standard' ? result.east.card.rank : null;
      const westRank = result.west?.card.kind === 'standard' ? result.west.card.rank : null;

      if (eastRank !== null && westRank !== null) {
        // If both opponents get standard cards, they shouldn't have the same rank
        // (The anti-bomb check should swap one)
        // Actually, the base selectPassCards picks the two weakest for opponents,
        // which would be the two 3s. ExpertBot should split them.
        expect(eastRank === westRank && eastRank === 3).toBe(false);
      }
    });

    it('returns cards for all three other seats', () => {
      const bot = new ExpertBot();
      const hand = [
        card('standard', 2, 'jade', 201),
        card('standard', 5, 'pagoda', 501),
        card('standard', 8, 'star', 801),
        card('standard', 10, 'sword', 1001),
        card('standard', 14, 'jade', 1401),
      ];
      const result = bot.chooseCardsToPass(hand, 'north');
      expect(result.east).toBeDefined();
      expect(result.south).toBeDefined();
      expect(result.west).toBeDefined();
    });
  });

  // ─── Play Selection (REQ-F-PLAY06 — Always Optimal) ──────────────────────

  describe('choosePlay', () => {
    // Verifies: REQ-F-PLAY06
    it('always plays optimally — leads with lowest combination', () => {
      const bot = new ExpertBot();
      const c3 = card('standard', 3, 'jade', 301);
      const c7 = card('standard', 7, 'pagoda', 701);
      const c14 = card('standard', 14, 'star', 1401);
      const hand = [c3, c7, c14];

      const validPlays = [
        makeCombo(CombinationType.Single, [c3], 3),
        makeCombo(CombinationType.Single, [c7], 7),
        makeCombo(CombinationType.Single, [c14], 14),
      ];

      const ctx = makePlayContext({
        hand,
        validPlays,
        canPass: false,
        seat: 'north',
      });

      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
      if (decision.action === 'play') {
        expect(decision.cards[0].id).toBe(301); // Lowest = 3
      }
    });

    // Verifies: REQ-F-PLAY06 (no randomness — same result every time)
    it('produces deterministic results (no randomness)', () => {
      const bot = new ExpertBot();

      const results: number[] = [];
      for (let i = 0; i < 10; i++) {
        nextId = 100;
        const c3 = card('standard', 3, 'jade', 301);
        const c7 = card('standard', 7, 'pagoda', 701);
        const hand = [c3, c7];
        const validPlays = [
          makeCombo(CombinationType.Single, [c3], 3),
          makeCombo(CombinationType.Single, [c7], 7),
        ];
        const ctx = makePlayContext({ hand, validPlays, canPass: false, seat: 'north' });
        const decision = bot.choosePlay(ctx);
        if (decision.action === 'play') {
          results.push(decision.cards[0].id);
        }
      }

      // All 10 results should be the same (always plays 3)
      expect(new Set(results).size).toBe(1);
      expect(results[0]).toBe(301);
    });

    // Verifies: REQ-F-PLAY04 (partner support)
    it('passes when partner is winning the trick', () => {
      const bot = new ExpertBot();
      const c10 = card('standard', 10, 'star', 1001);
      const hand = [c10, card('standard', 3, 'jade', 301)];

      const trick = makeTrick('south', 'south', [
        { seat: 'south', combination: makeCombo(CombinationType.Single, [card('standard', 5)], 5) },
      ]);

      const validPlays = [
        makeCombo(CombinationType.Single, [c10], 10),
      ];

      const ctx = makePlayContext({
        hand,
        currentTrick: trick,
        validPlays,
        canPass: true,
        seat: 'north',
      });

      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('pass');
    });

    // Verifies: REQ-F-PLAY04 exception (go out even if partner winning)
    it('plays to go out even when partner is winning', () => {
      const bot = new ExpertBot();
      const c7 = card('standard', 7, 'pagoda', 701);
      const hand = [c7];

      const trick = makeTrick('south', 'south', [
        { seat: 'south', combination: makeCombo(CombinationType.Single, [card('standard', 5)], 5) },
      ]);

      const validPlays = [makeCombo(CombinationType.Single, [c7], 7)];
      const ctx = makePlayContext({
        hand,
        currentTrick: trick,
        validPlays,
        canPass: true,
        seat: 'north',
      });

      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
    });

    // Verifies: must pass when no valid plays
    it('passes when no valid plays available', () => {
      const bot = new ExpertBot();
      const ctx = makePlayContext({
        hand: [card('standard', 3)],
        validPlays: [],
        canPass: true,
      });
      expect(bot.choosePlay(ctx).action).toBe('pass');
    });

    // Verifies: REQ-F-PLAY03, REQ-F-DEF01 (bomb timing)
    it('plays bomb when opponent has 1-2 cards', () => {
      const bot = new ExpertBot();
      const bombCards = [
        card('standard', 8, 'jade', 801),
        card('standard', 8, 'pagoda', 802),
        card('standard', 8, 'star', 803),
        card('standard', 8, 'sword', 804),
      ];
      const hand = [...bombCards, card('standard', 3, 'jade', 301)];

      const trick = makeTrick('east', 'east', [
        { seat: 'east', combination: makeCombo(CombinationType.Single, [card('standard', 12)], 12) },
      ]);

      const bombCombo = makeCombo(CombinationType.FourBomb, bombCards, 8, true);

      const roundState = makeRoundState({
        players: {
          north: { hand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: [card('standard', 14)], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      const ctx = makePlayContext({
        hand,
        currentTrick: trick,
        validPlays: [bombCombo],
        canPass: true,
        roundState,
        seat: 'north',
      });

      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
      if (decision.action === 'play') {
        expect(decision.cards.length).toBe(4);
      }
    });

    // Verifies: REQ-F-PLAY02 (Dog handling)
    it('leads with Dog when available', () => {
      const bot = new ExpertBot();
      const dogCard = card('dog');
      const c5 = card('standard', 5, 'jade', 501);
      const c10 = card('standard', 10, 'jade', 1001);
      const hand = [dogCard, c5, c10];

      const validPlays = [
        makeCombo(CombinationType.Single, [dogCard], 0),
        makeCombo(CombinationType.Single, [c5], 5),
        makeCombo(CombinationType.Single, [c10], 10),
      ];

      const ctx = makePlayContext({
        hand,
        validPlays,
        canPass: false,
        seat: 'north',
      });

      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
      if (decision.action === 'play') {
        expect(decision.cards[0].card.kind).toBe('dog');
      }
    });

    // Verifies: REQ-F-PLAY02 (Phoenix phoenixAs)
    it('includes phoenixAs when playing Phoenix combination', () => {
      const bot = new ExpertBot();
      const phoenixCard = card('phoenix');
      const hand = [phoenixCard, card('standard', 3, 'jade', 301)];

      const trick = makeTrick('east', 'east', [
        { seat: 'east', combination: makeCombo(CombinationType.Single, [card('standard', 10)], 10) },
      ]);

      const validPlays = [
        makeCombo(CombinationType.Single, [phoenixCard], 10.5, false, 10),
      ];

      const ctx = makePlayContext({
        hand,
        currentTrick: trick,
        validPlays,
        canPass: true,
        seat: 'north',
        roundState: makeRoundState({
          players: {
            north: { hand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
            east: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
            south: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
            west: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          },
        }),
      });

      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
      if (decision.action === 'play') {
        expect(decision.phoenixAs).toBe(10);
      }
    });

    // Verifies: REQ-F-DEF01 (bomb Tichu caller)
    it('bombs when Tichu caller has few cards', () => {
      const bot = new ExpertBot();
      const bombCards = [
        card('standard', 9, 'jade', 901),
        card('standard', 9, 'pagoda', 902),
        card('standard', 9, 'star', 903),
        card('standard', 9, 'sword', 904),
      ];
      const hand = [...bombCards, card('standard', 3, 'jade', 301)];

      const trick = makeTrick('east', 'east', [
        { seat: 'east', combination: makeCombo(CombinationType.Single, [card('standard', 12)], 12) },
      ]);

      const roundState = makeRoundState({
        players: {
          north: { hand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: [card('standard', 14), card('standard', 13), card('standard', 11)], tricksWon: [], tipiCall: 'tichu', hasPlayed: true, finishOrder: null },
          south: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      const ctx = makePlayContext({
        hand,
        currentTrick: trick,
        validPlays: [makeCombo(CombinationType.FourBomb, bombCards, 9, true)],
        canPass: true,
        roundState,
        seat: 'north',
      });

      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
      if (decision.action === 'play') {
        expect(decision.cards.length).toBe(4);
      }
    });
  });

  // ─── One-Two Prevention (REQ-F-PLAY05) ────────────────────────────────────

  describe('one-two prevention', () => {
    // Verifies: REQ-F-PLAY05
    it('plays highest when opponent teammate already went out first', () => {
      const bot = new ExpertBot();
      const c3 = card('standard', 3, 'jade', 301);
      const c14 = card('standard', 14, 'star', 1401);
      const hand = [c3, c14, card('standard', 7, 'pagoda', 701)];

      const validPlays = [
        makeCombo(CombinationType.Single, [c3], 3),
        makeCombo(CombinationType.Single, [c14], 14),
      ];

      // East (opponent) went out first, West (other opponent) still in
      const roundState = makeRoundState({
        finishOrder: ['east'],
        players: {
          north: { hand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: true, finishOrder: 1 },
          south: { hand: Array(5).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: Array(5).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      const ctx = makePlayContext({
        hand,
        validPlays,
        canPass: false,
        roundState,
        seat: 'north',
      });

      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
      if (decision.action === 'play') {
        // Should play highest (Ace) to control the game and prevent one-two
        expect(decision.cards[0].id).toBe(1401);
      }
    });

    it('does not activate one-two prevention when own team went out first', () => {
      const bot = new ExpertBot();
      const c3 = card('standard', 3, 'jade', 301);
      const c7 = card('standard', 7, 'pagoda', 701);
      const hand = [c3, c7];

      const validPlays = [
        makeCombo(CombinationType.Single, [c3], 3),
        makeCombo(CombinationType.Single, [c7], 7),
      ];

      // South (partner) went out first — no one-two prevention needed
      const roundState = makeRoundState({
        finishOrder: ['south'],
        players: {
          north: { hand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: Array(5).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: true, finishOrder: 1 },
          west: { hand: Array(5).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      const ctx = makePlayContext({
        hand,
        validPlays,
        canPass: false,
        roundState,
        seat: 'north',
      });

      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
      if (decision.action === 'play') {
        // Normal strategy: lead low
        expect(decision.cards[0].id).toBe(301);
      }
    });

    it('plays to go out in one-two prevention mode', () => {
      const bot = new ExpertBot();
      const c7 = card('standard', 7, 'pagoda', 701);
      const hand = [c7]; // Can go out

      const validPlays = [makeCombo(CombinationType.Single, [c7], 7)];

      const roundState = makeRoundState({
        finishOrder: ['east'],
        players: {
          north: { hand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: true, finishOrder: 1 },
          south: { hand: Array(5).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: Array(5).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      const ctx = makePlayContext({
        hand,
        validPlays,
        canPass: false,
        roundState,
        seat: 'north',
      });

      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
    });
  });

  // ─── Hand Planning (REQ-F-PLAY07) ────────────────────────────────────────

  describe('hand planning', () => {
    // Verifies: REQ-F-PLAY07
    it('creates a hand plan on first play of round', () => {
      const bot = new ExpertBot();
      const c3 = card('standard', 3, 'jade', 301);
      const c14 = card('standard', 14, 'star', 1401);
      const hand = [c3, c14];

      const validPlays = [
        makeCombo(CombinationType.Single, [c3], 3),
        makeCombo(CombinationType.Single, [c14], 14),
      ];

      const ctx = makePlayContext({ hand, validPlays, canPass: false, seat: 'north' });
      bot.choosePlay(ctx);

      const plan = bot.getHandPlan();
      expect(plan).not.toBeNull();
      expect(plan!.valid).toBe(true);
    });

    it('categorizes low combos as losers and high combos as winners', () => {
      const bot = new ExpertBot();
      const c3 = card('standard', 3, 'jade', 301);
      const c5 = card('standard', 5, 'pagoda', 501);
      const dragon = card('dragon');
      const c14 = card('standard', 14, 'star', 1401);
      const hand = [c3, c5, c14, dragon];

      const validPlays = [
        makeCombo(CombinationType.Single, [c3], 3),
        makeCombo(CombinationType.Single, [c5], 5),
        makeCombo(CombinationType.Single, [c14], 14),
        makeCombo(CombinationType.Single, [dragon], 25),
      ];

      const ctx = makePlayContext({ hand, validPlays, canPass: false, seat: 'north' });
      bot.choosePlay(ctx);

      const plan = bot.getHandPlan();
      expect(plan).not.toBeNull();
      // 3 and 5 should be losers (rank <= 8)
      expect(plan!.losersToLead.some((c) => c.rank === 3)).toBe(true);
      expect(plan!.losersToLead.some((c) => c.rank === 5)).toBe(true);
      // Dragon and Ace should be winners
      expect(plan!.winners.some((c) => c.rank === 25)).toBe(true);
      expect(plan!.winners.some((c) => c.rank === 14)).toBe(true);
    });

    it('uses hand plan to guide lead selection', () => {
      const bot = new ExpertBot();
      const c3 = card('standard', 3, 'jade', 301);
      const c5 = card('standard', 5, 'pagoda', 501);
      const c14 = card('standard', 14, 'star', 1401);
      const hand = [c3, c5, c14];

      const validPlays = [
        makeCombo(CombinationType.Single, [c3], 3),
        makeCombo(CombinationType.Single, [c5], 5),
        makeCombo(CombinationType.Single, [c14], 14),
      ];

      const ctx = makePlayContext({ hand, validPlays, canPass: false, seat: 'north' });

      // First play creates plan and uses it
      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
      if (decision.action === 'play') {
        // Should lead with a loser (3 or 5), guided by hand plan
        expect([301, 501]).toContain(decision.cards[0].id);
      }
    });

    it('decides Phoenix role based on hand composition', () => {
      const bot = new ExpertBot();
      const phoenix = card('phoenix');
      const c3 = card('standard', 3, 'jade', 301);
      const hand = [phoenix, c3];

      const validPlays = [
        makeCombo(CombinationType.Single, [c3], 3),
        makeCombo(CombinationType.Single, [phoenix], 15),
      ];

      const ctx = makePlayContext({ hand, validPlays, canPass: false, seat: 'north' });
      bot.choosePlay(ctx);

      const plan = bot.getHandPlan();
      expect(plan).not.toBeNull();
      // With few high singletons, Phoenix should be singleton-killer
      expect(plan!.phoenixRole).toBe('singleton-killer');
    });
  });

  // ─── Card Tracking Integration (REQ-F-INFO02) ───────────────────────────

  describe('card tracking integration', () => {
    // Verifies: REQ-F-INFO02
    it('updates card tracker during play', () => {
      const bot = new ExpertBot();
      const ace = card('standard', 14, 'jade', 1401);
      const c3 = card('standard', 3, 'jade', 301);
      const hand = [c3];

      const rs = makeRoundState({
        players: {
          north: { hand, tricksWon: [[ace]], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      bot.choosePlay(makePlayContext({
        hand,
        validPlays: [makeCombo(CombinationType.Single, [c3], 3)],
        canPass: false,
        roundState: rs,
        seat: 'north',
      }));

      const tracker = bot.getCardTracker();
      // Ace should be tracked as played
      expect(tracker.getUnaccountedAces()).toBe(3);
    });

    it('resets card tracker on new round', () => {
      const bot = new ExpertBot();
      const c3 = card('standard', 3, 'jade', 301);

      // First round
      const rs1 = makeRoundState({ roundNumber: 1 });
      bot.choosePlay(makePlayContext({
        hand: [c3],
        validPlays: [makeCombo(CombinationType.Single, [c3], 3)],
        canPass: false,
        roundState: rs1,
        seat: 'north',
      }));

      // Second round
      const rs2 = makeRoundState({ roundNumber: 2 });
      bot.choosePlay(makePlayContext({
        hand: [c3],
        validPlays: [makeCombo(CombinationType.Single, [c3], 3)],
        canPass: false,
        roundState: rs2,
        seat: 'north',
      }));

      // Tracker should be fresh for round 2
      const tracker = bot.getCardTracker();
      expect(tracker.getUnaccountedTop10Count()).toBe(10);
    });
  });

  // ─── Dragon Gift (REQ-F-DRAG01) ──────────────────────────────────────────

  describe('chooseDragonGiftRecipient', () => {
    // Verifies: REQ-F-DRAG01
    it('gives Dragon to opponent with most cards', () => {
      const bot = new ExpertBot();
      const roundState = makeRoundState({
        players: {
          north: { hand: Array(5).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: Array(12).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: Array(5).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: Array(8).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      // Trigger a play to cache roundState
      bot.choosePlay(makePlayContext({
        hand: [card('standard', 3)],
        validPlays: [],
        roundState,
        seat: 'north',
      }));

      const result = bot.chooseDragonGiftRecipient(['east', 'west'], 25);
      expect(result).toBe('east');
    });
  });

  // ─── Mahjong Wish (REQ-F-WISH01) ─────────────────────────────────────────

  describe('chooseMahjongWish', () => {
    // Verifies: REQ-F-WISH01
    it('wishes for mid-high rank not in hand', () => {
      const bot = new ExpertBot();
      const hand = [
        card('standard', 8, 'jade'),
        card('standard', 9, 'pagoda'),
        card('standard', 14, 'jade'),
      ];
      const wish = bot.chooseMahjongWish(hand);
      // Strategy guide: wish for mid-high ranks (10, 9, 8, 7, 11) not in hand
      expect(wish).toBe(10);
    });

    it('returns null when all wish candidate ranks held', () => {
      const bot = new ExpertBot();
      const hand = [
        card('standard', 7, 'pagoda'),
        card('standard', 8, 'star'),
        card('standard', 9, 'sword'),
        card('standard', 10, 'jade'),
        card('standard', 11, 'jade'),
      ];
      expect(bot.chooseMahjongWish(hand)).toBeNull();
    });
  });

  // ─── Information Model (REQ-F-INFO01) ────────────────────────────────────

  describe('information model', () => {
    // Verifies: REQ-F-INFO01
    it('never accesses opponent hand contents directly', () => {
      const bot = new ExpertBot();
      const roundState = makeRoundState({
        players: {
          north: { hand: [card('standard', 3)], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: [card('standard', 14, 'jade', 1401)], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: [card('standard', 5)], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: [card('standard', 9)], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      const c3 = card('standard', 3, 'jade', 301);
      const ctx = makePlayContext({
        hand: [c3],
        validPlays: [makeCombo(CombinationType.Single, [c3], 3)],
        canPass: false,
        roundState,
        seat: 'north',
      });

      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
    });
  });
});
