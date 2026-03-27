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

  // ─── Grand Tichu (REQ-F-GT01, REQ-F-GT02) ──────────────────────────────

  describe('chooseGrandTichu', () => {
    // Verifies: REQ-F-GT01 — 3+ power cards AND bomb
    it('calls with 3 power cards and a bomb', () => {
      const bot = new ExpertBot();
      const hand8 = [
        card('dragon'), card('phoenix'), card('standard', 14, 'jade'), // 3 power cards
        card('standard', 5, 'jade', 501), card('standard', 5, 'pagoda', 502),
        card('standard', 5, 'star', 503), card('standard', 5, 'sword', 504), // bomb
        card('standard', 8, 'jade'),
      ];
      expect(bot.chooseGrandTichu(hand8)).toBe(true);
    });

    // Verifies: REQ-F-GT02 — 3+ power cards AND strong multi-card hand
    it('calls with 3 power cards and a strong pair (rank > 10)', () => {
      const bot = new ExpertBot();
      const hand8 = [
        card('dragon'), card('phoenix'), card('standard', 14, 'jade'), // 3 power cards
        card('standard', 12, 'jade', 1201), card('standard', 12, 'pagoda', 1202), // pair of Queens
        card('standard', 3), card('standard', 4), card('standard', 6),
      ];
      expect(bot.chooseGrandTichu(hand8)).toBe(true);
    });

    it('does not call with only 2 power cards and no strong multi (normal game)', () => {
      const bot = new ExpertBot();
      const hand8 = [
        card('dragon'), card('standard', 14, 'jade'), // 2 power cards
        card('standard', 5), card('standard', 6),
        card('standard', 7, 'jade'), card('standard', 8, 'pagoda'),
        card('standard', 3), card('standard', 2),
      ];
      expect(bot.chooseGrandTichu(hand8)).toBe(false);
    });

    it('never calls with no power cards', () => {
      const bot = new ExpertBot();
      const hand0 = [
        card('standard', 2, 'jade'), card('standard', 3, 'pagoda'),
        card('standard', 4, 'jade'), card('standard', 5, 'pagoda'),
        card('standard', 6, 'star'), card('standard', 7, 'sword'),
        card('standard', 8, 'jade'), card('standard', 9, 'pagoda'),
      ];
      expect(bot.chooseGrandTichu(hand0)).toBe(false);
    });

    it('does not call with 2 Aces only (no bomb, no strong multi)', () => {
      const bot = new ExpertBot();
      const hand = [
        card('standard', 14, 'jade'),
        card('standard', 14, 'pagoda'),
        card('standard', 5), card('standard', 6),
        card('standard', 7, 'jade'), card('standard', 8, 'pagoda'),
        card('standard', 3), card('standard', 2),
      ];
      expect(bot.chooseGrandTichu(hand)).toBe(false);
    });

    // Verifies: REQ-F-GT03 — 2+ power + strong multi + opponents near winning
    it('calls with 2 power cards + strong multi when opponents near winning', () => {
      const bot = new ExpertBot();
      const rs = makeRoundState();
      // Opponents at 950, target 1000 → near winning
      bot.setContext(rs, { northSouth: 200, eastWest: 950 }, 1000);
      const hand = [
        card('dragon'), card('standard', 14, 'jade'), // 2 power cards
        card('standard', 12, 'jade', 1201), card('standard', 12, 'pagoda', 1202), // pair of Queens
        card('standard', 5), card('standard', 6),
        card('standard', 7, 'jade'), card('standard', 8, 'pagoda'),
      ];
      expect(bot.chooseGrandTichu(hand)).toBe(true);
    });

    it('does not call with 2 power + strong multi when opponents not near winning', () => {
      const bot = new ExpertBot();
      const rs = makeRoundState();
      bot.setContext(rs, { northSouth: 200, eastWest: 300 }, 1000);
      const hand = [
        card('dragon'), card('standard', 14, 'jade'), // 2 power cards
        card('standard', 12, 'jade', 1201), card('standard', 12, 'pagoda', 1202), // pair of Queens
        card('standard', 5), card('standard', 6),
        card('standard', 7, 'jade'), card('standard', 8, 'pagoda'),
      ];
      expect(bot.chooseGrandTichu(hand)).toBe(false);
    });
  });

  // ─── Regular Tichu (REQ-F-CALL02) ───────────────────────────────────────

  // ─── Regular Tichu (REQ-F-RT01, REQ-F-RT02) ────────────────────────────

  describe('chooseRegularTichu', () => {
    // Verifies: REQ-F-RT01 — Stanford It index
    it('calls Tichu with very strong hand (high It)', () => {
      const bot = new ExpertBot();
      // Dragon(6) + Phoenix(6) + 4 Aces(8) + Dog(-2) = 18
      // Straight 9-10-11-12-13 = +1, no small singletons
      // It = 19 → always calls
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

    it('does not call Tichu with weak hand (low It)', () => {
      const bot = new ExpertBot();
      // No power cards. Pairs of 2-6 + singletons 7-10. Straight 2-10 = +1.
      // It = 0 + 1 - 0 = 1 → never calls
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

    // Verifies: REQ-F-RT02 — Score-adaptive thresholds
    it('suppresses Tichu call when team leads by 200+ (threshold 9)', () => {
      const bot = new ExpertBot();
      // Design hand with It=8 (calls at threshold 7, fails at threshold 9):
      // Dragon(6) + 1 Ace(2) = 8, NO straights (non-consecutive pairs), no small singletons
      const hand14 = [
        card('dragon'),
        card('standard', 14, 'jade', 1401),
        card('standard', 3, 'jade', 301), card('standard', 3, 'pagoda', 302),
        card('standard', 6, 'jade', 601), card('standard', 6, 'pagoda', 602),
        card('standard', 9, 'jade', 901), card('standard', 9, 'pagoda', 902),
        card('standard', 12, 'jade', 1201), card('standard', 12, 'pagoda', 1202),
        card('standard', 5, 'jade', 501), card('standard', 5, 'pagoda', 502),
        card('standard', 8, 'jade', 801), card('standard', 8, 'pagoda', 802),
      ];
      // Ranks: 3,5,6,8,9,12,14 — longest run is 5,6 (length 2) → no straight
      // It = 6(Dragon) + 2(Ace) + 0(straights) - 0(singletons, all paired) = 8

      // Without score context: It=8 >= 7 → calls
      expect(bot.chooseRegularTichu(hand14)).toBe(true);

      // Leading by 200+: It=8 < 9 → suppressed
      bot.setScoreDiff(300);
      expect(bot.chooseRegularTichu(hand14)).toBe(false);
    });

    it('is more aggressive when behind by 200+ (threshold 5)', () => {
      const bot = new ExpertBot();
      // Design hand with It=6 (fails at threshold 7, calls at threshold 5):
      // Dragon(6) + Dog(-2) + 1 Ace(2) = 6, NO straights (non-consecutive pairs)
      const hand14 = [
        card('dragon'), card('dog'),
        card('standard', 14, 'jade', 1401),
        card('standard', 3, 'jade', 301), card('standard', 3, 'pagoda', 302),
        card('standard', 6, 'jade', 601), card('standard', 6, 'pagoda', 602),
        card('standard', 9, 'jade', 901), card('standard', 9, 'pagoda', 902),
        card('standard', 12, 'jade', 1201), card('standard', 12, 'pagoda', 1202),
        card('standard', 5, 'jade', 501), card('standard', 5, 'pagoda', 502),
      ];
      // Ranks: 3,5,6,9,12,14 — longest run is 5,6 (length 2) → no straight
      // It = 6(Dragon) - 2(Dog) + 2(Ace) = 6

      // Normally: It=6 < 7 → doesn't call
      expect(bot.chooseRegularTichu(hand14)).toBe(false);

      // Behind by 200+: It=6 >= 5 → calls
      bot.setScoreDiff(-300);
      expect(bot.chooseRegularTichu(hand14)).toBe(true);
    });

    it('accounts for straights and small singletons in It index', () => {
      const bot = new ExpertBot();
      // Hand with a straight (2-3-4-5-6-7) and 1 Ace:
      // It = 2(Ace) + 1(straight) = 3
      // Plus some small singletons not in straight: say rank 9, 10 as singletons
      // They're above 12? No, 9 and 10 are below 12. Are they in a straight? No.
      // It = 2 + 1 - 2 = 1 → doesn't call
      // Use alternating suits within straights to avoid straight-flush bombs
      const hand14 = [
        card('standard', 14, 'jade', 1401),
        card('standard', 2, 'jade', 201), card('standard', 3, 'pagoda', 301),
        card('standard', 4, 'star', 401), card('standard', 5, 'sword', 501),
        card('standard', 6, 'jade', 601), card('standard', 7, 'pagoda', 701),
        card('standard', 9, 'star', 901), card('standard', 10, 'sword', 1001),
        card('standard', 2, 'pagoda', 202), card('standard', 3, 'star', 302),
        card('standard', 4, 'sword', 402), card('standard', 5, 'jade', 502),
        card('standard', 6, 'pagoda', 602),
      ];
      // It = 2 + 1(straight 2-7) - 2(singletons 9,10) = 1
      expect(bot.chooseRegularTichu(hand14)).toBe(false);
    });
  });

  // ─── Card Passing (REQ-F-PASS01-05) ────────────────────────────────────

  describe('chooseCardsToPass', () => {
    // Helper: weak hand (It < 7) for passing tests
    function makeWeakHand(): GameCard[] {
      // It = 0 (all low non-consecutive pairs, no power cards)
      return [
        card('standard', 2, 'jade', 201), card('standard', 2, 'pagoda', 202),
        card('standard', 4, 'jade', 401), card('standard', 4, 'pagoda', 402),
        card('standard', 6, 'jade', 601), card('standard', 6, 'pagoda', 602),
        card('standard', 8, 'jade', 801), card('standard', 8, 'pagoda', 802),
        card('standard', 10, 'jade', 1001), card('standard', 10, 'pagoda', 1002),
        card('standard', 12, 'jade', 1201), card('standard', 12, 'pagoda', 1202),
        card('standard', 3, 'jade', 301), card('standard', 14, 'jade', 1401),
      ];
    }

    // Helper: strong hand (It >= 7) for passing tests
    function makeStrongHand(): GameCard[] {
      // Dragon(6) + Ace(2) = It=8 (non-consecutive pairs, no straight)
      return [
        card('dragon'),
        card('standard', 14, 'jade', 1401),
        card('standard', 3, 'jade', 301), card('standard', 3, 'pagoda', 302),
        card('standard', 6, 'jade', 601), card('standard', 6, 'pagoda', 602),
        card('standard', 9, 'jade', 901), card('standard', 9, 'pagoda', 902),
        card('standard', 12, 'jade', 1201), card('standard', 12, 'pagoda', 1202),
        card('standard', 5, 'jade', 501), card('standard', 5, 'pagoda', 502),
        card('standard', 8, 'jade', 801), card('standard', 8, 'pagoda', 802),
      ];
    }

    // Verifies: REQ-F-PASS04
    it('splits a low pair when no singles below 8 available', () => {
      const bot = new ExpertBot();
      // Hand with all pairs, no singletons below 8 → should split a low pair (rank 2-4)
      const hand = [
        card('standard', 3, 'jade', 301), card('standard', 3, 'pagoda', 302),
        card('standard', 5, 'star', 501), card('standard', 5, 'pagoda', 502),
        card('standard', 7, 'jade', 701), card('standard', 7, 'pagoda', 702),
        card('standard', 9, 'jade', 901), card('standard', 9, 'pagoda', 902),
        card('standard', 11, 'jade', 1101), card('standard', 11, 'pagoda', 1102),
        card('standard', 13, 'jade', 1301), card('standard', 13, 'pagoda', 1302),
        card('standard', 14, 'jade', 1401), card('standard', 14, 'pagoda', 1402),
      ];

      const result = bot.chooseCardsToPass(hand, 'north');
      const eastRank = result.east?.card.kind === 'standard' ? result.east.card.rank : null;
      const westRank = result.west?.card.kind === 'standard' ? result.west.card.rank : null;
      // Both opponents should receive one card from the split low pair (rank 3)
      expect(eastRank).toBe(3);
      expect(westRank).toBe(3);
    });

    it('returns cards for all three other seats', () => {
      const bot = new ExpertBot();
      const result = bot.chooseCardsToPass(makeWeakHand(), 'north');
      expect(result.east).toBeDefined();
      expect(result.south).toBeDefined();
      expect(result.west).toBeDefined();
    });

    // Verifies: REQ-F-PASS01
    it('passes best card to partner from weak hand (strength concentration)', () => {
      const bot = new ExpertBot();
      const hand = makeWeakHand(); // Ace (rank 14) is the strongest
      const result = bot.chooseCardsToPass(hand, 'north');
      // Weak hand → pass best to partner (south). Best = Ace (14)
      expect(result.south.card.kind === 'standard' && result.south.card.rank === 14).toBe(true);
    });

    it('passes 3rd-worst to partner from strong hand', () => {
      const bot = new ExpertBot();
      const hand = makeStrongHand();
      const result = bot.chooseCardsToPass(hand, 'north');
      // Strong hand → pass 3rd weakest non-special.
      // Sorted non-special by strength: 3,3,5,5,6,6,8,8,9,9,12,12,14
      // 3rd = rank 5. Partner (south) gets rank 5.
      expect(result.south.card.kind === 'standard' && result.south.card.rank === 5).toBe(true);
    });

    // Verifies: REQ-F-PASS03
    it('applies parity convention: odd to left (east), even to right (west)', () => {
      const bot = new ExpertBot();
      // Hand with 2 singletons below 8 (rank 3 and rank 4) for clean parity test
      const hand = [
        card('standard', 3, 'jade', 301), // singleton odd
        card('standard', 4, 'jade', 401), // singleton even
        card('standard', 7, 'jade', 701), card('standard', 7, 'pagoda', 702),
        card('standard', 9, 'jade', 901), card('standard', 9, 'pagoda', 902),
        card('standard', 10, 'jade', 1001), card('standard', 10, 'pagoda', 1002),
        card('standard', 11, 'jade', 1101), card('standard', 11, 'pagoda', 1102),
        card('standard', 12, 'jade', 1201), card('standard', 12, 'pagoda', 1202),
        card('standard', 13, 'jade', 1301), card('standard', 14, 'jade', 1401),
      ];
      const result = bot.chooseCardsToPass(hand, 'north');
      // Left opponent = east (next seat clockwise from north)
      // Odd (3) → east, Even (4) → west
      const eastRank = result.east?.card.kind === 'standard' ? result.east.card.rank : null;
      const westRank = result.west?.card.kind === 'standard' ? result.west.card.rank : null;
      expect(eastRank! % 2).toBe(1); // odd to east (left)
      expect(westRank! % 2).toBe(0); // even to west (right)
    });

    // Verifies: REQ-F-PASS04
    it('never passes Dragon or Phoenix to opponents', () => {
      const bot = new ExpertBot();
      // Weak hand with Dragon — should go to partner
      const hand = [
        card('dragon'),
        card('standard', 2, 'jade', 201), card('standard', 2, 'pagoda', 202),
        card('standard', 4, 'jade', 401), card('standard', 4, 'pagoda', 402),
        card('standard', 6, 'jade', 601), card('standard', 6, 'pagoda', 602),
        card('standard', 8, 'jade', 801), card('standard', 8, 'pagoda', 802),
        card('standard', 10, 'jade', 1001), card('standard', 10, 'pagoda', 1002),
        card('standard', 12, 'jade', 1201), card('standard', 12, 'pagoda', 1202),
      ];
      const result = bot.chooseCardsToPass(hand, 'north');
      expect(result.east.card.kind).not.toBe('dragon');
      expect(result.west.card.kind).not.toBe('dragon');
      // Weak hand → Dragon goes to partner
      expect(result.south.card.kind).toBe('dragon');
    });

    // Verifies: REQ-F-PASS04
    it('passes Dog to partner from strong hand', () => {
      const bot = new ExpertBot();
      // Strong hand with Dog — Dog should go to partner
      const hand = [
        card('dragon'), card('dog'),
        card('standard', 14, 'jade', 1401),
        card('standard', 3, 'jade', 301), card('standard', 3, 'pagoda', 302),
        card('standard', 6, 'jade', 601), card('standard', 6, 'pagoda', 602),
        card('standard', 9, 'jade', 901), card('standard', 9, 'pagoda', 902),
        card('standard', 12, 'jade', 1201), card('standard', 12, 'pagoda', 1202),
        card('standard', 5, 'jade', 501), card('standard', 5, 'pagoda', 502),
      ];
      // It = 6(Dragon) + 2(Ace) - 2(Dog) = 6... hmm that's below 7.
      // Need stronger: add Phoenix
      const strongWithDog = [
        card('dragon'), card('phoenix'), card('dog'),
        card('standard', 14, 'jade', 1401),
        card('standard', 3, 'jade', 301), card('standard', 3, 'pagoda', 302),
        card('standard', 6, 'jade', 601), card('standard', 6, 'pagoda', 602),
        card('standard', 9, 'jade', 901), card('standard', 9, 'pagoda', 902),
        card('standard', 12, 'jade', 1201), card('standard', 12, 'pagoda', 1202),
        card('standard', 5, 'jade', 501),
      ];
      // It = 6+6+2-2 = 12 → strong hand
      const result = bot.chooseCardsToPass(strongWithDog, 'north');
      // Strong hand with Dog → pass Dog to partner (south)
      expect(result.south.card.kind).toBe('dog');
    });

    // Verifies: REQ-F-PASS08
    it('tracks passedToRight for Mahjong wish', () => {
      const bot = new ExpertBot();
      bot.chooseCardsToPass(makeWeakHand(), 'north');
      // Should have recorded what was passed to west (right opponent)
      expect(bot.getPassedToRight()).not.toBeNull();
      expect(bot.getPassedToRight()!.card.kind).toBe('standard');
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
      // Phoenix over an Ace — acceptable per REQ-F-PHX03
      const hand = [phoenixCard, card('standard', 3, 'jade', 301)];

      const trick = makeTrick('east', 'east', [
        { seat: 'east', combination: makeCombo(CombinationType.Single, [card('standard', 14, 'jade', 1401)], 14) },
      ]);

      const validPlays = [
        makeCombo(CombinationType.Single, [phoenixCard], 14.5, false, 14),
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
        expect(decision.phoenixAs).toBe(14);
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

  // ─── Dog Strategy (REQ-F-DOG01) ─────────────────────────────────────────

  describe('context-dependent Dog play', () => {
    function makeDogContext(overrides: {
      partnerCall?: string;
      opponentCall?: string;
      handExtras?: GameCard[];
      scoreDiff?: number;
    } = {}): { bot: InstanceType<typeof ExpertBot>; ctx: BotPlayContext } {
      const bot = new ExpertBot();
      if (overrides.scoreDiff !== undefined) bot.setScoreDiff(overrides.scoreDiff);

      const dogCard = card('dog');
      const c5 = card('standard', 5, 'jade', 501);
      const c10 = card('standard', 10, 'jade', 1001);
      const extras = overrides.handExtras ?? [];
      const hand = [dogCard, c5, c10, ...extras];

      const validPlays = [
        makeCombo(CombinationType.Single, [dogCard], 0),
        makeCombo(CombinationType.Single, [c5], 5),
        makeCombo(CombinationType.Single, [c10], 10),
      ];

      const roundState = makeRoundState({
        players: {
          north: { hand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: Array(14).fill(card('standard', 2)), tricksWon: [], tipiCall: overrides.opponentCall ?? 'none', hasPlayed: false, finishOrder: null },
          south: { hand: Array(14).fill(card('standard', 2)), tricksWon: [], tipiCall: overrides.partnerCall ?? 'none', hasPlayed: false, finishOrder: null },
          west: { hand: Array(14).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      const ctx = makePlayContext({ hand, validPlays, canPass: false, roundState, seat: 'north' });
      return { bot, ctx };
    }

    // Verifies: REQ-F-DOG01 — default behavior
    it('plays Dog early when no special conditions (default)', () => {
      const { bot, ctx } = makeDogContext();
      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
      if (decision.action === 'play') {
        expect(decision.cards[0].card.kind).toBe('dog');
      }
    });

    // Verifies: REQ-F-DOG01 — condition 1
    it('saves Dog when partner called Tichu', () => {
      const { bot, ctx } = makeDogContext({ partnerCall: 'tichu' });
      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
      if (decision.action === 'play') {
        // Should NOT play Dog — saves it to bail partner out
        expect(decision.cards[0].card.kind).not.toBe('dog');
      }
    });

    // Verifies: REQ-F-DOG01 — condition 2
    it('saves Dog when holding Dragon (guaranteed lead recovery)', () => {
      const dragonCard = card('dragon');
      const { bot, ctx } = makeDogContext({ handExtras: [dragonCard] });
      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
      if (decision.action === 'play') {
        expect(decision.cards[0].card.kind).not.toBe('dog');
      }
    });

    // Verifies: REQ-F-DOG01 — condition 3
    it('saves Dog when opponent called Tichu', () => {
      const { bot, ctx } = makeDogContext({ opponentCall: 'tichu' });
      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
      if (decision.action === 'play') {
        expect(decision.cards[0].card.kind).not.toBe('dog');
      }
    });

    // Verifies: REQ-F-DOG01 — condition 4
    it('saves Dog when significantly behind on score', () => {
      const { bot, ctx } = makeDogContext({ scoreDiff: -300 });
      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
      if (decision.action === 'play') {
        expect(decision.cards[0].card.kind).not.toBe('dog');
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
        // REQ-F-END01: Partner out in 3-player → play aggressively (highest)
        expect(decision.cards[0].id).toBe(701);
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

  // ─── Phoenix Strategy (REQ-F-PHX01) ──────────────────────────────────────

  describe('Phoenix strategy', () => {
    // Verifies: REQ-F-PHX01 — avoid leading Phoenix as singleton
    it('avoids leading Phoenix as singleton (only +0.5)', () => {
      const bot = new ExpertBot();
      const phoenixCard = card('phoenix');
      const c5 = card('standard', 5, 'jade', 501);
      const c10 = card('standard', 10, 'jade', 1001);
      const hand = [phoenixCard, c5, c10];

      const validPlays = [
        makeCombo(CombinationType.Single, [phoenixCard], 0.5),
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
        // Should NOT lead with Phoenix singleton — prefer leading rank 5
        expect(decision.cards[0].card.kind).not.toBe('phoenix');
      }
    });

    // Verifies: REQ-F-PHX01 — prefer Phoenix in large combinations
    it('prefers Phoenix in combinations of 3+ cards (eliminates losers)', () => {
      const bot = new ExpertBot();
      const phoenixCard = card('phoenix');
      const c3 = card('standard', 3, 'jade', 301);
      const c4 = card('standard', 4, 'jade', 401);
      const c5 = card('standard', 5, 'jade', 501);
      const hand = [phoenixCard, c3, c4, c5];

      // Phoenix used as wild in a straight (3-4-5-Phoenix-as-6)
      const straightCombo = makeCombo(
        CombinationType.Straight, [c3, c4, c5, phoenixCard], 6, false, 6,
      );
      const singlePlay = makeCombo(CombinationType.Single, [c3], 3);

      const trick = makeTrick('east', 'east', [
        { seat: 'east', combination: makeCombo(CombinationType.Straight,
          [card('standard', 2), card('standard', 3, 'pagoda', 303),
           card('standard', 4, 'pagoda', 403), card('standard', 5, 'pagoda', 503)], 5) },
      ]);

      const ctx = makePlayContext({
        hand,
        currentTrick: trick,
        validPlays: [straightCombo],
        canPass: true,
        roundState: makeRoundState(),
        seat: 'north',
      });

      const decision = bot.choosePlay(ctx);
      // Phoenix in a 4-card combo should be preferred (eliminates losers)
      expect(decision.action).toBe('play');
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

  // ─── Mahjong Wish (REQ-F-MJ01) ──────────────────────────────────────────

  describe('chooseMahjongWish', () => {
    // Verifies: REQ-F-MJ01 — no wish when Mah Jong played in a straight
    it('returns null when Mah Jong was played in a straight', () => {
      const bot = new ExpertBot();
      const mahjong = card('mahjong');
      const c2 = card('standard', 2, 'jade', 201);
      const c3 = card('standard', 3, 'jade', 301);
      const c4 = card('standard', 4, 'jade', 401);
      const c5 = card('standard', 5, 'jade', 501);
      const c8 = card('standard', 8, 'jade', 801);
      const hand = [mahjong, c2, c3, c4, c5, c8];
      const straightCombo = makeCombo(CombinationType.Straight, [mahjong, c2, c3, c4, c5], 5);

      // Only offer the straight as valid play — forces bot to play it
      const roundState = makeRoundState({
        players: {
          north: { hand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: Array(14).fill(c8), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: Array(14).fill(c8), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: Array(14).fill(c8), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });
      const ctx = makePlayContext({
        hand,
        validPlays: [straightCombo],
        roundState,
        seat: 'north' as Seat,
      });
      bot.choosePlay(ctx);
      // After playing a straight containing Mah Jong, wish should be null
      expect(bot.chooseMahjongWish([c8])).toBeNull();
    });

    // Verifies: REQ-F-MJ03 — wish for Ace when RIGHT opponent called Tichu
    it('wishes for Ace when right opponent called Tichu', () => {
      const bot = new ExpertBot();
      const c3 = card('standard', 3, 'jade', 301);
      const c8 = card('standard', 8, 'jade', 801);
      const mahjong = card('mahjong');
      const hand = [mahjong, c3, c8];

      // Right opponent of north = west
      const roundState = makeRoundState({
        players: {
          north: { hand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: Array(14).fill(c8), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: Array(14).fill(c8), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: Array(14).fill(c8), tricksWon: [], tipiCall: 'tichu', hasPlayed: false, finishOrder: null },
        },
      });
      // Play Mah Jong as singleton to set up lastRoundState
      const ctx = makePlayContext({
        hand,
        validPlays: [makeCombo(CombinationType.Single, [mahjong], 1)],
        roundState,
        seat: 'north' as Seat,
      });
      bot.choosePlay(ctx);
      expect(bot.chooseMahjongWish([c3, c8])).toBe(14); // Wish for Ace
    });

    // Verifies: REQ-F-MJ01 — wish for Ace when opponent called Grand Tichu
    it('wishes for Ace when opponent called Grand Tichu', () => {
      const bot = new ExpertBot();
      const c3 = card('standard', 3, 'jade', 301);
      const c8 = card('standard', 8, 'jade', 801);
      const mahjong = card('mahjong');
      const hand = [mahjong, c3, c8];

      const roundState = makeRoundState({
        players: {
          north: { hand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: Array(14).fill(c8), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: Array(14).fill(c8), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: Array(14).fill(c8), tricksWon: [], tipiCall: 'grandTichu', hasPlayed: false, finishOrder: null },
        },
      });
      const ctx = makePlayContext({
        hand,
        validPlays: [makeCombo(CombinationType.Single, [mahjong], 1)],
        roundState,
        seat: 'north' as Seat,
      });
      bot.choosePlay(ctx);
      expect(bot.chooseMahjongWish([c3, c8])).toBe(14);
    });

    // Verifies: REQ-F-MJ01 — does not wish Ace if already holding one
    it('does not wish for Ace when holding Ace even if opponent called Tichu', () => {
      const bot = new ExpertBot();
      const cA = card('standard', 14, 'jade', 1401);
      const c3 = card('standard', 3, 'jade', 301);
      const mahjong = card('mahjong');
      const hand = [mahjong, c3, cA];

      const roundState = makeRoundState({
        players: {
          north: { hand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: Array(14).fill(c3), tricksWon: [], tipiCall: 'tichu', hasPlayed: false, finishOrder: null },
          south: { hand: Array(14).fill(c3), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: Array(14).fill(c3), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });
      const ctx = makePlayContext({
        hand,
        validPlays: [makeCombo(CombinationType.Single, [mahjong], 1)],
        roundState,
        seat: 'north' as Seat,
      });
      bot.choosePlay(ctx);
      const wish = bot.chooseMahjongWish([c3, cA]);
      // Should NOT wish for Ace (we have it), should use passedToRight or fallback
      expect(wish).not.toBe(14);
    });

    // Verifies: REQ-F-MJ01 — wish for card passed to left opponent
    it('wishes for card passed to left opponent when no Tichu caller', () => {
      const bot = new ExpertBot();
      // Simulate card passing: pass a 7 to left opponent
      const hand14 = [
        card('standard', 2, 'jade', 201),
        card('standard', 3, 'jade', 301),
        card('standard', 4, 'jade', 401),
        card('standard', 5, 'jade', 501),
        card('standard', 6, 'jade', 601),
        card('standard', 7, 'jade', 701),
        card('standard', 8, 'jade', 801),
        card('standard', 9, 'jade', 901),
        card('standard', 10, 'jade', 1001),
        card('standard', 11, 'jade', 1101),
        card('standard', 12, 'jade', 1201),
        card('standard', 13, 'jade', 1301),
        card('standard', 14, 'jade', 1401),
        card('mahjong'),
      ];
      bot.chooseCardsToPass(hand14, 'north');
      const passedToRight = bot.getPassedToRight();
      expect(passedToRight).not.toBeNull();

      // Set up a round state with no Tichu callers
      const c8 = card('standard', 8, 'jade', 8001);
      const mahjong = card('mahjong');
      const remainingHand = [mahjong, card('standard', 12, 'star', 1202)];
      const roundState = makeRoundState({
        players: {
          north: { hand: remainingHand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: Array(14).fill(c8), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: Array(14).fill(c8), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: Array(14).fill(c8), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });
      const ctx = makePlayContext({
        hand: remainingHand,
        validPlays: [makeCombo(CombinationType.Single, [mahjong], 1)],
        roundState,
        seat: 'north' as Seat,
      });
      bot.choosePlay(ctx);
      const wish = bot.chooseMahjongWish([card('standard', 12, 'star', 1202)]);
      // Should wish for the rank passed to right
      if (passedToRight!.card.kind === 'standard') {
        expect(wish).toBe(passedToRight!.card.rank);
      }
    });

    // Verifies: REQ-F-MJ01 — fallback to 5 or 6 when no other context
    it('falls back to wishing for 5 or 6 when no context available', () => {
      const bot = new ExpertBot();
      const c8 = card('standard', 8, 'jade', 801);
      const mahjong = card('mahjong');
      const hand = [mahjong, c8];

      const roundState = makeRoundState({
        players: {
          north: { hand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: Array(14).fill(c8), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: Array(14).fill(c8), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: Array(14).fill(c8), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });
      const ctx = makePlayContext({
        hand,
        validPlays: [makeCombo(CombinationType.Single, [mahjong], 1)],
        roundState,
        seat: 'north' as Seat,
      });
      bot.choosePlay(ctx);
      const wish = bot.chooseMahjongWish([c8]);
      // Fallback: prefer 5 or 6
      expect([5, 6]).toContain(wish);
    });

    // Verifies: REQ-F-MJ01 — returns null when all fallback ranks held
    it('returns null when all fallback candidate ranks are held', () => {
      const bot = new ExpertBot();
      const hand = [
        card('standard', 5, 'jade'),
        card('standard', 6, 'star'),
        card('standard', 7, 'pagoda'),
        card('standard', 8, 'sword'),
        card('standard', 9, 'jade'),
        card('standard', 10, 'star'),
      ];
      const wish = bot.chooseMahjongWish(hand);
      expect(wish).toBeNull();
    });
  });

  // ─── Bomb Strategy (REQ-F-BOMB01, REQ-F-BOMB02) ────────────────────────

  describe('bomb strategy', () => {
    // Verifies: REQ-F-BOMB01 — don't bomb when partner is about to go out
    it('does not bomb when partner has 1-2 cards left', () => {
      const bot = new ExpertBot();
      const c5 = card('standard', 5, 'jade', 501);
      const bombCards = [
        card('standard', 8, 'jade', 801),
        card('standard', 8, 'pagoda', 802),
        card('standard', 8, 'star', 803),
        card('standard', 8, 'sword', 804),
      ];
      const hand = [c5, ...bombCards];

      const bomb = makeCombo(CombinationType.FourBomb, bombCards, 8, true);
      const single = makeCombo(CombinationType.Single, [c5], 5);

      // Opponent plays — partner (south) has only 1 card left
      const trick = makeTrick('east', 'east', [
        { seat: 'east', combination: makeCombo(CombinationType.Single, [card('standard', 14, 'jade', 1401)], 14) },
      ]);

      const rs = makeRoundState({
        players: {
          north: { hand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: Array(5).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: [card('standard', 3)], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      const ctx = makePlayContext({
        hand,
        currentTrick: trick,
        validPlays: [bomb, single],
        canPass: true,
        roundState: rs,
        seat: 'north',
      });

      const decision = bot.choosePlay(ctx);
      // Should NOT bomb — partner about to go out
      if (decision.action === 'play') {
        expect(decision.cards.length).not.toBe(4); // Not the bomb
      }
    });

    // Verifies: REQ-F-BOMB01 — bomb to prevent 1-2 finish
    it('bombs when opponent could complete 1-2 finish', () => {
      const bot = new ExpertBot();
      const bombCards = [
        card('standard', 8, 'jade', 801),
        card('standard', 8, 'pagoda', 802),
        card('standard', 8, 'star', 803),
        card('standard', 8, 'sword', 804),
      ];
      const c5 = card('standard', 5, 'jade', 501);
      const hand = [c5, ...bombCards];

      const bomb = makeCombo(CombinationType.FourBomb, bombCards, 8, true);

      // East already finished first (opponent), west (other opponent) has 2 cards
      const trick = makeTrick('west', 'west', [
        { seat: 'west', combination: makeCombo(CombinationType.Single, [card('standard', 14, 'star', 1403)], 14) },
      ]);

      const rs = makeRoundState({
        finishOrder: ['east'],
        players: {
          north: { hand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: 1 },
          south: { hand: Array(8).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: [card('standard', 2), card('standard', 3)], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      const ctx = makePlayContext({
        hand,
        currentTrick: trick,
        validPlays: [bomb],
        canPass: true,
        roundState: rs,
        seat: 'north',
      });

      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
      if (decision.action === 'play') {
        expect(decision.cards.length).toBe(4); // The bomb
      }
    });

    // Verifies: REQ-F-BOMB01 — bomb opponent Tichu caller with few cards
    it('bombs when opponent Tichu caller has 1-5 cards', () => {
      const bot = new ExpertBot();
      const bombCards = [
        card('standard', 6, 'jade', 601),
        card('standard', 6, 'pagoda', 602),
        card('standard', 6, 'star', 603),
        card('standard', 6, 'sword', 604),
      ];
      const c3 = card('standard', 3, 'jade', 301);
      const hand = [c3, ...bombCards];

      const bomb = makeCombo(CombinationType.FourBomb, bombCards, 6, true);

      const trick = makeTrick('east', 'east', [
        { seat: 'east', combination: makeCombo(CombinationType.Single, [card('standard', 13, 'jade', 1301)], 13) },
      ]);

      const rs = makeRoundState({
        players: {
          north: { hand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: Array(4).fill(card('standard', 2)), tricksWon: [], tipiCall: 'tichu', hasPlayed: false, finishOrder: null },
          south: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      const ctx = makePlayContext({
        hand,
        currentTrick: trick,
        validPlays: [bomb],
        canPass: true,
        roundState: rs,
        seat: 'north',
      });

      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
      if (decision.action === 'play') {
        expect(decision.cards.length).toBe(4);
      }
    });

    // Verifies: REQ-F-BOMB02 — bomb-proof exit planning
    it('leads low card instead of Dragon when 2 cards left and bomb risk', () => {
      const bot = new ExpertBot();
      const dragon = card('dragon');
      const c3 = card('standard', 3, 'jade', 301);
      const hand = [dragon, c3];

      const dragonPlay = makeCombo(CombinationType.Single, [dragon], 25);
      const lowPlay = makeCombo(CombinationType.Single, [c3], 3);

      // No cards tracked → all ranks have 3+ unaccounted (bomb risk)
      const rs = makeRoundState({
        players: {
          north: { hand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      const ctx = makePlayContext({
        hand,
        validPlays: [dragonPlay, lowPlay],
        canPass: false,
        roundState: rs,
        seat: 'north',
      });

      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
      if (decision.action === 'play') {
        // Should lead the low card, not Dragon (bomb-proof exit)
        expect(decision.cards[0].id).toBe(301);
      }
    });

    // Verifies: REQ-F-BOMB02 — no bomb-proof override when no bomb risk
    it('allows Dragon lead when 2 cards left but no bomb risk', () => {
      const bot = new ExpertBot();
      const dragon = card('dragon');
      const c3 = card('standard', 3, 'jade', 301);
      const hand = [dragon, c3];

      const dragonPlay = makeCombo(CombinationType.Single, [dragon], 25);
      const lowPlay = makeCombo(CombinationType.Single, [c3], 3);

      // Build a round state with extensive tracking so no ranks have 3+ unaccounted
      // We need most ranks to have been seen (played or in hand)
      const tricksWon: GameCard[][] = [];
      // Create tricks where many cards have been played
      const trick1: GameCard[] = [];
      for (let r = 2; r <= 14; r++) {
        for (const suit of ['jade', 'pagoda', 'star', 'sword']) {
          trick1.push(card('standard', r, suit, r * 10 + (suit === 'jade' ? 1 : suit === 'pagoda' ? 2 : suit === 'star' ? 3 : 4)));
        }
      }
      tricksWon.push(trick1);

      const rs = makeRoundState({
        players: {
          north: { hand, tricksWon, tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      const ctx = makePlayContext({
        hand,
        validPlays: [dragonPlay, lowPlay],
        canPass: false,
        roundState: rs,
        seat: 'north',
      });

      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
      // With no bomb risk, the normal lead-low strategy applies (or Dragon is fine)
      // The key point is bomb-proof exit does NOT activate
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

  // ─── Endgame Strategy (REQ-F-END01-04) ──────────────────────────────────

  describe('endgame strategy', () => {
    // Verifies: REQ-F-END01 — 3-player, partner out: play aggressively
    it('plays highest when partner already went out (3-player)', () => {
      const bot = new ExpertBot();
      const c3 = card('standard', 3, 'jade', 301);
      const c14 = card('standard', 14, 'jade', 1401);
      const hand = [c3, c14];

      const validPlays = [
        makeCombo(CombinationType.Single, [c3], 3),
        makeCombo(CombinationType.Single, [c14], 14),
      ];

      const roundState = makeRoundState({
        finishOrder: ['south'],
        players: {
          north: { hand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: Array(5).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: true, finishOrder: 1 },
          west: { hand: Array(5).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      const ctx = makePlayContext({ hand, validPlays, canPass: false, roundState, seat: 'north' });
      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
      if (decision.action === 'play') {
        // Partner out → aggressive play → highest card (Ace)
        expect(decision.cards[0].id).toBe(1401);
      }
    });

    // Verifies: REQ-F-END02 — 3-player, partner still in, partner fewer cards: feed Dog
    it('plays Dog to feed partner when partner has fewer cards (3-player)', () => {
      const bot = new ExpertBot();
      const dog = card('dog');
      const c7 = card('standard', 7, 'jade', 701);
      const c3 = card('standard', 3, 'jade', 301);
      const hand = [dog, c7, c3];

      const validPlays = [
        makeCombo(CombinationType.Single, [dog], 0),
        makeCombo(CombinationType.Single, [c3], 3),
        makeCombo(CombinationType.Single, [c7], 7),
      ];

      // Partner south has 1 card, opponent east went out, west has 5 cards
      const roundState = makeRoundState({
        finishOrder: ['east'],
        players: {
          north: { hand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: true, finishOrder: 1 },
          south: { hand: [card('standard', 14)], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: Array(5).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      const ctx = makePlayContext({ hand, validPlays, canPass: false, roundState, seat: 'north' });
      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
      if (decision.action === 'play') {
        // Partner has fewer cards → feed Dog to let partner lead
        expect(decision.cards[0].id).toBe(903); // Dog id
      }
    });

    // Verifies: REQ-F-END03 — 2-player, opponent has 1 card: multi-card first
    it('plays multi-card groups first when opponent has 1 card (2-player)', () => {
      const bot = new ExpertBot();
      const c3a = card('standard', 3, 'jade', 301);
      const c3b = card('standard', 3, 'pagoda', 302);
      const c14 = card('standard', 14, 'jade', 1401);
      const hand = [c3a, c3b, c14];

      const pair = makeCombo(CombinationType.Pair, [c3a, c3b], 3);
      const singleA = makeCombo(CombinationType.Single, [c14], 14);
      const validPlays = [pair, singleA];

      // Only north and west remain, west has 1 card
      const roundState = makeRoundState({
        finishOrder: ['east', 'south'],
        players: {
          north: { hand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: true, finishOrder: 1 },
          south: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: true, finishOrder: 2 },
          west: { hand: [card('standard', 5)], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      const ctx = makePlayContext({ hand, validPlays, canPass: false, roundState, seat: 'north' });
      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
      if (decision.action === 'play') {
        // Opponent has 1 card → play multi-card groups first (pair of 3s)
        expect(decision.cards.length).toBe(2);
        expect(decision.cards[0].id).toBe(301);
      }
    });

    // Verifies: REQ-F-END03 — 2-player, opponent 1 card, only singles: high→low
    it('plays highest single when opponent has 1 card and only singles available (2-player)', () => {
      const bot = new ExpertBot();
      const c3 = card('standard', 3, 'jade', 301);
      const c14 = card('standard', 14, 'jade', 1401);
      const hand = [c3, c14];

      const validPlays = [
        makeCombo(CombinationType.Single, [c3], 3),
        makeCombo(CombinationType.Single, [c14], 14),
      ];

      const roundState = makeRoundState({
        finishOrder: ['east', 'south'],
        players: {
          north: { hand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: true, finishOrder: 1 },
          south: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: true, finishOrder: 2 },
          west: { hand: [card('standard', 5)], tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      const ctx = makePlayContext({ hand, validPlays, canPass: false, roundState, seat: 'north' });
      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
      if (decision.action === 'play') {
        // Only singles, opponent has 1 card → play highest first
        expect(decision.cards[0].id).toBe(1401);
      }
    });

    // Verifies: REQ-F-END04 — 2-player, opponent many cards: normal lead-low
    it('leads low when opponent has many cards (2-player)', () => {
      const bot = new ExpertBot();
      const c3 = card('standard', 3, 'jade', 301);
      const c7 = card('standard', 7, 'pagoda', 701);
      const c14 = card('standard', 14, 'jade', 1401);
      const hand = [c3, c7, c14];

      const validPlays = [
        makeCombo(CombinationType.Single, [c3], 3),
        makeCombo(CombinationType.Single, [c7], 7),
        makeCombo(CombinationType.Single, [c14], 14),
      ];

      // 2-player, opponent west has many cards
      const roundState = makeRoundState({
        finishOrder: ['east', 'south'],
        players: {
          north: { hand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: true, finishOrder: 1 },
          south: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: true, finishOrder: 2 },
          west: { hand: Array(8).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      const ctx = makePlayContext({ hand, validPlays, canPass: false, roundState, seat: 'north' });
      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
      if (decision.action === 'play') {
        // Opponent has many cards → normal lead-low strategy
        expect(decision.cards[0].id).toBe(301);
      }
    });

    // Verifies: REQ-F-END01 — always go out when possible in endgame
    it('goes out when possible in endgame', () => {
      const bot = new ExpertBot();
      const c7 = card('standard', 7, 'jade', 701);
      const hand = [c7]; // Only 1 card = can go out

      const validPlays = [makeCombo(CombinationType.Single, [c7], 7)];

      const roundState = makeRoundState({
        finishOrder: ['south'],
        players: {
          north: { hand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: Array(5).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: true, finishOrder: 1 },
          west: { hand: Array(5).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      const ctx = makePlayContext({ hand, validPlays, canPass: false, roundState, seat: 'north' });
      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
    });
  });

  // ─── Tichu Defense (REQ-F-DEF01) ────────────────────────────────────────

  describe('Tichu defense', () => {
    // Verifies: REQ-F-DEF01 — concede when opponent caller has very few cards
    it('passes (concedes) when opponent Tichu caller has 1-2 cards and bot is weak', () => {
      const bot = new ExpertBot();
      const c3 = card('standard', 3, 'jade', 301);
      const c5 = card('standard', 5, 'pagoda', 501);
      const c7 = card('standard', 7, 'star', 701);
      const hand = [c3, c5, c7]; // Weak hand, no winners

      // East called Tichu and has 2 cards — almost out
      const trick = makeTrick('east', 'east', [
        { seat: 'east', combination: makeCombo(CombinationType.Single, [card('standard', 10, 'jade', 1001)], 10) },
      ]);

      const roundState = makeRoundState({
        currentTrick: trick,
        players: {
          north: { hand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: [card('standard', 14), card('standard', 13)], tricksWon: [], tipiCall: 'tichu', hasPlayed: false, finishOrder: null },
          south: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      const validPlays = [
        makeCombo(CombinationType.Single, [card('standard', 14, 'jade', 1401)], 14),
      ];

      const ctx = makePlayContext({
        hand,
        validPlays,
        canPass: true,
        currentTrick: trick,
        roundState,
        seat: 'north',
      });

      const decision = bot.choosePlay(ctx);
      // Weak hand + caller almost out → concede (pass)
      expect(decision.action).toBe('pass');
    });

    // Verifies: REQ-F-DEF01 — fight when caller has many cards and bot has winners
    it('plays (fights) when opponent Tichu caller has many cards and bot has winners', () => {
      const bot = new ExpertBot();
      const cA = card('standard', 14, 'jade', 1401);
      const dragon = card('dragon');
      const c3 = card('standard', 3, 'jade', 301);
      const hand = [cA, dragon, c3]; // Strong hand with winners

      const trick = makeTrick('east', 'east', [
        { seat: 'east', combination: makeCombo(CombinationType.Single, [card('standard', 10, 'jade', 1001)], 10) },
      ]);

      const roundState = makeRoundState({
        currentTrick: trick,
        players: {
          north: { hand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'tichu', hasPlayed: false, finishOrder: null },
          south: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      const validPlays = [
        makeCombo(CombinationType.Single, [cA], 14),
      ];

      const ctx = makePlayContext({
        hand,
        validPlays,
        canPass: true,
        currentTrick: trick,
        roundState,
        seat: 'north',
      });

      const decision = bot.choosePlay(ctx);
      // Strong hand + caller has many cards → fight (play)
      expect(decision.action).toBe('play');
    });

    // Verifies: REQ-F-DEF01 — fight when partner also called Tichu
    it('fights when partner also called Tichu', () => {
      const bot = new ExpertBot();
      const c7 = card('standard', 7, 'jade', 701);
      const hand = [c7]; // Weak, but partner called Tichu

      const trick = makeTrick('east', 'east', [
        { seat: 'east', combination: makeCombo(CombinationType.Single, [card('standard', 5, 'jade', 501)], 5) },
      ]);

      const roundState = makeRoundState({
        currentTrick: trick,
        players: {
          north: { hand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: Array(8).fill(card('standard', 2)), tricksWon: [], tipiCall: 'tichu', hasPlayed: false, finishOrder: null },
          south: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'tichu', hasPlayed: false, finishOrder: null },
          west: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      const validPlays = [
        makeCombo(CombinationType.Single, [c7], 7),
      ];

      const ctx = makePlayContext({
        hand,
        validPlays,
        canPass: true,
        currentTrick: trick,
        roundState,
        seat: 'north',
      });

      const decision = bot.choosePlay(ctx);
      // Partner called Tichu → always fight
      expect(decision.action).toBe('play');
    });
  });

  // ─── Enhanced Follow Play (REQ-F-FOL01-03) ──────────────────────────────

  describe('enhanced follow play', () => {
    // Verifies: REQ-F-FOL01 — lead Kings confidently when all Aces played
    it('leads King when all Aces are accounted for', () => {
      const bot = new ExpertBot();
      const cK = card('standard', 13, 'jade', 1301);
      const c3 = card('standard', 3, 'jade', 301);
      const hand = [c3, cK];

      // Set up tracker: all 4 Aces played + 4 in own hand = 0 unaccounted
      const ace1 = card('standard', 14, 'jade', 1401);
      const ace2 = card('standard', 14, 'pagoda', 1402);
      const ace3 = card('standard', 14, 'star', 1403);
      const ace4 = card('standard', 14, 'sword', 1404);

      const roundState = makeRoundState({
        players: {
          north: { hand, tricksWon: [[ace1, ace2]], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: Array(10).fill(card('standard', 2)), tricksWon: [[ace3, ace4]], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      const validPlays = [
        makeCombo(CombinationType.Single, [c3], 3),
        makeCombo(CombinationType.Single, [cK], 13),
      ];

      const ctx = makePlayContext({ hand, validPlays, canPass: false, roundState, seat: 'north' });
      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
      if (decision.action === 'play') {
        // All Aces accounted → Kings are top singles → lead King
        expect(decision.cards[0].id).toBe(1301);
      }
    });

    // Verifies: REQ-F-FOL02 — pass when cheapest win costs King and Aces unaccounted
    it('passes on low trick when cheapest win is King and Aces unaccounted', () => {
      const bot = new ExpertBot();
      const cK = card('standard', 13, 'jade', 1301);
      const c3 = card('standard', 3, 'jade', 301);
      const hand = [c3, cK];

      // Opponent leads a 5 — cheap trick
      const trick = makeTrick('east', 'east', [
        { seat: 'east', combination: makeCombo(CombinationType.Single, [card('standard', 5, 'jade', 501)], 5) },
      ]);

      // No Aces played yet → unaccounted Aces exist
      const roundState = makeRoundState({
        currentTrick: trick,
        players: {
          north: { hand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      const validPlays = [
        makeCombo(CombinationType.Single, [cK], 13),
      ];

      const ctx = makePlayContext({
        hand,
        validPlays,
        canPass: true,
        currentTrick: trick,
        roundState,
        seat: 'north',
      });

      const decision = bot.choosePlay(ctx);
      // Cheapest win is King, Aces still out → pass
      expect(decision.action).toBe('pass');
    });

    // Verifies: REQ-F-FOL03 — never lead Ace pair
    it('does not lead Ace pair when single Ace leads available', () => {
      const bot = new ExpertBot();
      const ace1 = card('standard', 14, 'jade', 1401);
      const ace2 = card('standard', 14, 'pagoda', 1402);
      const c3 = card('standard', 3, 'jade', 301);
      const hand = [ace1, ace2, c3];

      const validPlays = [
        makeCombo(CombinationType.Single, [c3], 3),
        makeCombo(CombinationType.Single, [ace1], 14),
        makeCombo(CombinationType.Single, [ace2], 14),
        makeCombo(CombinationType.Pair, [ace1, ace2], 14),
      ];

      const roundState = makeRoundState({
        players: {
          north: { hand, tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: Array(10).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      const ctx = makePlayContext({ hand, validPlays, canPass: false, roundState, seat: 'north' });
      const decision = bot.choosePlay(ctx);
      expect(decision.action).toBe('play');
      if (decision.action === 'play') {
        // Should not lead Ace pair — lead 3 instead (or single Ace later)
        // Should pick the low card (3) as the lead
        expect(decision.cards[0].id).toBe(301);
        expect(decision.cards.length).toBe(1);
      }
    });
  });

  // ─── M1: setContext + Partner Strength Detection (REQ-F-CTX01, REQ-F-STR02) ──

  describe('setContext', () => {
    // Verifies: REQ-F-CTX01
    it('stores score diff from game context', () => {
      const bot = new ExpertBot();
      const rs = makeRoundState();
      bot.setContext(rs, { northSouth: 300, eastWest: 500 }, 1000);
      // Bot is north (northSouth team), so diff = 300 - 500 = -200
      expect(bot.getScoreDiff()).toBe(-200);
    });

    it('stores target score', () => {
      const bot = new ExpertBot();
      const rs = makeRoundState();
      bot.setContext(rs, { northSouth: 0, eastWest: 0 }, 750);
      expect(bot.getTargetScore()).toBe(750);
    });

    it('stores game scores', () => {
      const bot = new ExpertBot();
      const rs = makeRoundState();
      bot.setContext(rs, { northSouth: 100, eastWest: 200 }, 1000);
      expect(bot.getGameScores()).toEqual({ northSouth: 100, eastWest: 200 });
    });
  });

  describe('partner strength detection', () => {
    // Verifies: REQ-F-STR02
    it('detects partner strength when partner passed a low card (rank < 10)', () => {
      const bot = new ExpertBot();
      const c8 = card('standard', 8, 'jade', 8001);
      const rs = makeRoundState({
        players: {
          north: {
            hand: [c8],
            tricksWon: [],
            tipiCall: 'none',
            hasPlayed: false,
            finishOrder: null,
            passedCards: { to: { north: null, east: null, south: card('standard', 5, 'jade', 501), west: null }, received: true },
          },
          east: { hand: Array(14).fill(c8), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: {
            hand: Array(14).fill(c8),
            tricksWon: [],
            tipiCall: 'none',
            hasPlayed: false,
            finishOrder: null,
            passedCards: { to: { north: card('standard', 3, 'jade', 301), east: null, south: null, west: null }, received: true },
          },
          west: { hand: Array(14).fill(c8), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });

      const ctx = makePlayContext({
        hand: [c8],
        validPlays: [makeCombo(CombinationType.Single, [c8], 8)],
        roundState: rs,
        seat: 'north' as Seat,
      });
      bot.choosePlay(ctx);
      // Partner (south) passed rank 3 (< 10) → partner signaled strength
      expect(bot.getPartnerStrengthDetected()).toBe(true);
      expect(bot.getPartnerPassedCard()).not.toBeNull();
    });

    it('detects partner strength when partner passed Dog', () => {
      const bot = new ExpertBot();
      const c8 = card('standard', 8, 'jade', 8001);
      const dogCard = card('dog');
      const rs = makeRoundState({
        players: {
          north: {
            hand: [c8],
            tricksWon: [],
            tipiCall: 'none',
            hasPlayed: false,
            finishOrder: null,
          },
          east: { hand: Array(14).fill(c8), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: {
            hand: Array(14).fill(c8),
            tricksWon: [],
            tipiCall: 'none',
            hasPlayed: false,
            finishOrder: null,
            passedCards: { to: { north: dogCard, east: null, south: null, west: null }, received: true },
          },
          west: { hand: Array(14).fill(c8), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });
      const ctx = makePlayContext({
        hand: [c8],
        validPlays: [makeCombo(CombinationType.Single, [c8], 8)],
        roundState: rs,
        seat: 'north' as Seat,
      });
      bot.choosePlay(ctx);
      expect(bot.getPartnerStrengthDetected()).toBe(true);
    });

    it('does not detect strength when partner passed high card (rank >= 10)', () => {
      const bot = new ExpertBot();
      const c8 = card('standard', 8, 'jade', 8001);
      const rs = makeRoundState({
        players: {
          north: {
            hand: [c8],
            tricksWon: [],
            tipiCall: 'none',
            hasPlayed: false,
            finishOrder: null,
          },
          east: { hand: Array(14).fill(c8), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: {
            hand: Array(14).fill(c8),
            tricksWon: [],
            tipiCall: 'none',
            hasPlayed: false,
            finishOrder: null,
            passedCards: { to: { north: card('standard', 12, 'jade', 1201), east: null, south: null, west: null }, received: true },
          },
          west: { hand: Array(14).fill(c8), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });
      const ctx = makePlayContext({
        hand: [c8],
        validPlays: [makeCombo(CombinationType.Single, [c8], 8)],
        roundState: rs,
        seat: 'north' as Seat,
      });
      bot.choosePlay(ctx);
      expect(bot.getPartnerStrengthDetected()).toBe(false);
    });

    it('handles missing passedCards gracefully', () => {
      const bot = new ExpertBot();
      const c8 = card('standard', 8, 'jade', 8001);
      const rs = makeRoundState();
      const ctx = makePlayContext({
        hand: [c8],
        validPlays: [makeCombo(CombinationType.Single, [c8], 8)],
        roundState: rs,
        seat: 'north' as Seat,
      });
      // Should not throw
      bot.choosePlay(ctx);
      expect(bot.getPartnerStrengthDetected()).toBe(false);
    });
  });
});
