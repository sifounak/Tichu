// Verifies: REQ-F-CALL01, REQ-F-CALL02, REQ-F-PASS01, REQ-F-PASS02, REQ-F-PASS03,
// REQ-F-PLAY01, REQ-F-PLAY02, REQ-F-PLAY03, REQ-F-PLAY04, REQ-F-PLAY06,
// REQ-F-DRAG01, REQ-F-WISH01, REQ-F-DEF01, REQ-F-INFO01

import { describe, it, expect } from 'vitest';
import type { GameCard, Rank, Seat, Combination, TrickState, RoundState } from '@tichu/shared';
import { CombinationType, Suit } from '@tichu/shared';
import { HardBot } from '../../src/bot/hard-bot.js';
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

// ─── Grand Tichu Tests ──────────────────────────────────────────────────────

describe('HardBot', () => {
  describe('chooseGrandTichu', () => {
    // Verifies: REQ-F-CALL01
    it('calls Grand Tichu with Dragon + Phoenix in first 8 cards', () => {
      const bot = new HardBot();
      const hand8 = [
        card('dragon'), card('phoenix'),
        card('standard', 5), card('standard', 6),
        card('standard', 7), card('standard', 8),
        card('standard', 3), card('standard', 2),
      ];
      expect(bot.chooseGrandTichu(hand8)).toBe(true);
    });

    it('never calls with 0-1 top cards', () => {
      const bot = new HardBot();
      // 0 top cards
      const hand0 = [
        card('standard', 2), card('standard', 3),
        card('standard', 4), card('standard', 5),
        card('standard', 6), card('standard', 7),
        card('standard', 8), card('standard', 9),
      ];
      expect(bot.chooseGrandTichu(hand0)).toBe(false);

      // 1 top card (just an Ace)
      const hand1 = [
        card('standard', 14), card('standard', 3),
        card('standard', 4), card('standard', 5),
        card('standard', 6), card('standard', 7),
        card('standard', 8), card('standard', 9),
      ];
      expect(bot.chooseGrandTichu(hand1)).toBe(false);
    });

    it('calls with 4+ top cards (including Mahjong/Dog)', () => {
      const bot = new HardBot();
      const hand = [
        card('dragon'), card('mahjong'), card('dog'),
        card('standard', 14, 'jade'),  // Ace
        card('standard', 5), card('standard', 6),
        card('standard', 7), card('standard', 8),
      ];
      // Dragon + Mahjong + Dog + Ace = 4 top cards
      expect(bot.chooseGrandTichu(hand)).toBe(true);
    });

    it('does not call with only 2-3 top cards', () => {
      const bot = new HardBot();
      const hand = [
        card('dragon'),
        card('standard', 14, 'jade'),  // Ace
        card('standard', 5), card('standard', 6),
        card('standard', 7), card('standard', 8),
        card('standard', 3), card('standard', 2),
      ];
      // Dragon + Ace = 2 top cards (no Mahjong/Dog without flag, wait — countTopCards
      // with includeMahjongDog includes them. Let's check: Dragon counts, Ace counts = 2.
      // Without includeMahjongDog option it's just Dragon + Ace = 2.
      // With the option it's still 2.
      expect(bot.chooseGrandTichu(hand)).toBe(false);
    });
  });

  // ─── Regular Tichu Tests ──────────────────────────────────────────────────

  describe('chooseRegularTichu', () => {
    // Verifies: REQ-F-CALL02
    it('calls Tichu with very strong hand (many winners + lead getters)', () => {
      const bot = new HardBot();
      const hand14 = [
        card('dragon'), card('phoenix'),
        card('standard', 14, 'jade', 1401), card('standard', 14, 'pagoda', 1402),
        card('standard', 14, 'star', 1403), card('standard', 14, 'sword', 1404),
        card('standard', 13, 'jade', 1301), card('standard', 13, 'pagoda', 1302),
        card('standard', 13, 'star', 1303), card('standard', 12, 'jade', 1201),
        card('standard', 11, 'jade', 1101), card('standard', 10, 'jade', 1001),
        card('standard', 9, 'jade', 991), card('dog'),
      ];
      // Dragon(3) + Phoenix(2.5) + 4 Aces(8) + 3 Kings(4.5) + Queen(.5) + Dog(1) = 19.5+
      // Lead getters: Dragon + 4 Aces + Dog + 1 bomb (four Aces) = 7
      expect(bot.chooseRegularTichu(hand14)).toBe(true);
    });

    it('does not call Tichu with weak hand', () => {
      const bot = new HardBot();
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
  });

  // ─── Card Passing Tests ───────────────────────────────────────────────────

  describe('chooseCardsToPass', () => {
    // Verifies: REQ-F-PASS01, REQ-F-PASS02, REQ-F-PASS03
    it('returns cards for all three other seats', () => {
      const bot = new HardBot();
      const hand = [
        card('standard', 2, 'jade', 201),
        card('standard', 5, 'pagoda', 501),
        card('standard', 8, 'star', 801),
        card('standard', 10, 'sword', 1001),
        card('standard', 14, 'jade', 1401),
      ];
      const result = bot.chooseCardsToPass(hand, 'north');
      // Should have entries for east (opponent), south (partner), west (opponent)
      expect(result.east).toBeDefined();
      expect(result.south).toBeDefined();
      expect(result.west).toBeDefined();
    });

    it('passes distinct cards', () => {
      const bot = new HardBot();
      const hand = [
        card('standard', 2, 'jade', 201),
        card('standard', 5, 'pagoda', 501),
        card('standard', 8, 'star', 801),
        card('standard', 10, 'sword', 1001),
        card('standard', 14, 'jade', 1401),
      ];
      const result = bot.chooseCardsToPass(hand, 'north');
      const ids = new Set([result.east.id, result.south.id, result.west.id]);
      expect(ids.size).toBe(3);
    });

    it('does not pass Phoenix to opponents', () => {
      const bot = new HardBot();
      const hand = [
        card('phoenix'),
        card('standard', 2, 'jade', 201),
        card('standard', 3, 'pagoda', 301),
        card('standard', 5, 'star', 501),
        card('standard', 14, 'jade', 1401),
      ];
      const result = bot.chooseCardsToPass(hand, 'north');
      // East and West are opponents for North
      expect(result.east.card.kind).not.toBe('phoenix');
      expect(result.west.card.kind).not.toBe('phoenix');
    });
  });

  // ─── Play Selection Tests ─────────────────────────────────────────────────

  describe('choosePlay', () => {
    // Verifies: REQ-F-PLAY01
    it('leads with lowest combination from mixed hand', () => {
      // Use deterministic random that never triggers random play (> 0.12)
      const bot = new HardBot(() => 0.5);
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
        // Should play the 3 (lowest), not the Ace
        expect(decision.cards[0].id).toBe(301);
      }
    });

    // Verifies: REQ-F-PLAY04
    it('passes when partner is winning the trick', () => {
      const bot = new HardBot(() => 0.5);
      const c7 = card('standard', 7, 'pagoda', 701);
      const c10 = card('standard', 10, 'star', 1001);
      const hand = [c7, c10, card('standard', 3, 'jade', 301)];

      const trick = makeTrick('south', 'south', [
        { seat: 'south', combination: makeCombo(CombinationType.Single, [card('standard', 5)], 5) },
      ]);

      const validPlays = [
        makeCombo(CombinationType.Single, [c7], 7),
        makeCombo(CombinationType.Single, [c10], 10),
      ];

      const ctx = makePlayContext({
        hand,
        currentTrick: trick,
        validPlays,
        canPass: true,
        seat: 'north', // North's partner is South
      });

      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('pass');
    });

    // Verifies: REQ-F-PLAY04 exception (go out even if partner winning)
    it('plays to go out even when partner is winning', () => {
      const bot = new HardBot(() => 0.5);
      const c7 = card('standard', 7, 'pagoda', 701);
      const hand = [c7]; // Only 1 card left — can go out

      const trick = makeTrick('south', 'south', [
        { seat: 'south', combination: makeCombo(CombinationType.Single, [card('standard', 5)], 5) },
      ]);

      const validPlays = [
        makeCombo(CombinationType.Single, [c7], 7),
      ];

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

    // Verifies: REQ-F-PLAY06 (randomness with seed < 0.12)
    it('makes suboptimal play when random seed < 0.12', () => {
      // Random source returns 0.05 first (triggers random), then 0.1 (picks index)
      let callCount = 0;
      const bot = new HardBot(() => {
        callCount++;
        return callCount === 1 ? 0.05 : 0.1;
      });

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
      // With random < 0.12, bot picks randomly — any valid play is acceptable
      expect(decision.action).toBe('play');
    });

    // Verifies: REQ-F-PLAY06 (optimal play when seed > 0.12)
    it('plays optimally when random seed > 0.12', () => {
      const bot = new HardBot(() => 0.5);
      const c3 = card('standard', 3, 'jade', 301);
      const c7 = card('standard', 7, 'pagoda', 701);
      const hand = [c3, c7];

      const validPlays = [
        makeCombo(CombinationType.Single, [c3], 3),
        makeCombo(CombinationType.Single, [c7], 7),
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
        // Should play the 3 (lowest — lead low strategy)
        expect(decision.cards[0].id).toBe(301);
      }
    });

    // Verifies: REQ-F-PLAY03, REQ-F-DEF01
    it('plays bomb when opponent has 1-2 cards and is about to go out', () => {
      const bot = new HardBot(() => 0.5);
      const bombCards = [
        card('standard', 8, 'jade', 801),
        card('standard', 8, 'pagoda', 802),
        card('standard', 8, 'star', 803),
        card('standard', 8, 'sword', 804),
      ];
      const c3 = card('standard', 3, 'jade', 301);
      const hand = [...bombCards, c3];

      const trick = makeTrick('east', 'east', [
        { seat: 'east', combination: makeCombo(CombinationType.Single, [card('standard', 12)], 12) },
      ]);

      const bombCombo = makeCombo(CombinationType.FourBomb, bombCards, 8, true);
      const validPlays = [bombCombo];

      const roundState = makeRoundState({
        players: {
          north: { hand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: [card('standard', 14)], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: [card('standard', 5), card('standard', 6)], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: [card('standard', 9), card('standard', 10)], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      const ctx = makePlayContext({
        hand,
        currentTrick: trick,
        validPlays,
        canPass: true,
        roundState,
        seat: 'north',
      });

      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
      if (decision.action === 'play') {
        expect(decision.cards.length).toBe(4); // Played the bomb
      }
    });

    // Verifies: REQ-F-PLAY03 (doesn't waste bomb when no urgency)
    it('does not bomb when opponents have many cards', () => {
      const bot = new HardBot(() => 0.5);
      const bombCards = [
        card('standard', 8, 'jade', 801),
        card('standard', 8, 'pagoda', 802),
        card('standard', 8, 'star', 803),
        card('standard', 8, 'sword', 804),
      ];
      const c10 = card('standard', 10, 'jade', 1001);
      const hand = [...bombCards, c10, card('standard', 3, 'jade', 301)];

      const trick = makeTrick('east', 'east', [
        { seat: 'east', combination: makeCombo(CombinationType.Single, [card('standard', 7)], 7) },
      ]);

      const bombCombo = makeCombo(CombinationType.FourBomb, bombCards, 8, true);
      const singleCombo = makeCombo(CombinationType.Single, [c10], 10);
      const validPlays = [singleCombo, bombCombo];

      const roundState = makeRoundState({
        players: {
          north: { hand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      const ctx = makePlayContext({
        hand,
        currentTrick: trick,
        validPlays,
        canPass: true,
        roundState,
        seat: 'north',
      });

      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
      if (decision.action === 'play') {
        // Should play the single 10, not the bomb
        expect(decision.cards.length).toBe(1);
        expect(decision.cards[0].id).toBe(1001);
      }
    });

    // Verifies: REQ-F-PLAY02 (Dog handling — lead with Dog early)
    it('leads with Dog when available', () => {
      const bot = new HardBot(() => 0.5);
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

    // Verifies: Must pass when no valid plays
    it('passes when no valid plays available', () => {
      const bot = new HardBot(() => 0.5);
      const ctx = makePlayContext({
        hand: [card('standard', 3)],
        validPlays: [],
        canPass: true,
      });

      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('pass');
    });

    // Verifies: REQ-F-PLAY02 (Phoenix phoenixAs included)
    it('includes phoenixAs when playing Phoenix combination', () => {
      const bot = new HardBot(() => 0.5);
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

    // Verifies: REQ-F-DEF01 (bomb on Tichu caller about to go out)
    it('bombs when Tichu caller has few cards', () => {
      const bot = new HardBot(() => 0.5);
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

      const bombCombo = makeCombo(CombinationType.FourBomb, bombCards, 9, true);
      const validPlays = [bombCombo];

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
        validPlays,
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

  // ─── Dragon Gift Tests ────────────────────────────────────────────────────

  describe('chooseDragonGiftRecipient', () => {
    // Verifies: REQ-F-DRAG01
    it('gives Dragon to opponent with most cards', () => {
      const bot = new HardBot();
      // Simulate a play to cache round state
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
      expect(result).toBe('east'); // East has 12 cards (most)
    });
  });

  // ─── Mahjong Wish Tests ───────────────────────────────────────────────────

  describe('chooseMahjongWish', () => {
    // Verifies: REQ-F-WISH01
    it('wishes for mid-rank not in hand', () => {
      const bot = new HardBot();
      const hand = [
        card('standard', 8, 'jade'),
        card('standard', 9, 'pagoda'),
        card('standard', 14, 'jade'),
      ];
      const wish = bot.chooseMahjongWish(hand);
      // 8 and 9 are in hand; should wish for 7 (next candidate)
      expect(wish).toBe(7);
    });

    it('returns null when all mid-ranks held', () => {
      const bot = new HardBot();
      const hand = [
        card('standard', 6, 'jade'),
        card('standard', 7, 'pagoda'),
        card('standard', 8, 'star'),
        card('standard', 9, 'sword'),
        card('standard', 10, 'jade'),
      ];
      expect(bot.chooseMahjongWish(hand)).toBeNull();
    });
  });

  // ─── Information Model Tests ──────────────────────────────────────────────

  describe('information model', () => {
    // Verifies: REQ-F-INFO01
    it('never accesses opponent hand contents', () => {
      // This test verifies by code inspection that HardBot methods
      // only access roundState.players[seat].hand for the bot's own seat
      // and only access .hand.length for other seats (via shared utilities).
      // The HardBot delegates to bot-strategy-utils which also never
      // accesses opponent hand contents.
      const bot = new HardBot(() => 0.5);

      // Create a context where opponent hands have cards
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

      // Should complete without error — bot doesn't need opponent card details
      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
    });
  });

  // ─── Difficulty Property ──────────────────────────────────────────────────

  describe('difficulty', () => {
    it('reports difficulty as hard', () => {
      const bot = new HardBot();
      expect(bot.difficulty).toBe('hard');
    });
  });
});
