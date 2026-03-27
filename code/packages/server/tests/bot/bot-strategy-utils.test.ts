// Verifies: REQ-NF-MAINT01, REQ-F-INFO01

import { describe, it, expect } from 'vitest';
import type { GameCard, Rank, Seat, Combination, RoundState } from '@tichu/shared';
import { CombinationType, Suit } from '@tichu/shared';
import {
  countTopCards,
  countLeadGetters,
  evaluateHandStrength,
  computeGrandTichuIndex,
  computeTichuIndex,
  countStraights,
  countSmallSingletons,
  findBombs,
  findSingletons,
  getCardStrength,
  sortByStrength,
  rankCombinationsForLead,
  rankCombinationsForFollow,
  identifyWeakCards,
  selectPassCards,
  isPartnerWinning,
  canGoOut,
  isAllWinners,
  selectLeadPlay,
  selectFollowPlay,
  shouldPlayBomb,
  getOpponentTichuCallers,
  getHandSizes,
  isEndgame,
  getEndgamePhase,
  selectMahjongWish,
  selectDragonRecipient,
  hasStrength,
  isCardInMultiCardCombo,
  getThirdWorstNonBreaking,
  getRightOpponent,
  hasStrongMultiCardHand,
} from '../../src/bot/bot-strategy-utils.js';

// ─── Test Helpers ───────────────────────────────────────────────────────────

function card(kind: string, rank?: number, suit?: string, id?: number): GameCard {
  if (kind === 'standard') {
    return {
      id: id ?? rank! * 10 + (suit === 'jade' ? 1 : suit === 'pagoda' ? 2 : suit === 'star' ? 3 : 4),
      card: { kind: 'standard', rank: rank as Rank, suit: suit as any ?? Suit.Jade },
    };
  }
  const idMap: Record<string, number> = { dragon: 100, phoenix: 101, mahjong: 102, dog: 103 };
  return { id: id ?? idMap[kind], card: { kind } as any };
}

function makeCombo(type: CombinationType, cards: GameCard[], rank: number, isBomb = false): Combination {
  return { type, cards, rank, length: cards.length, isBomb };
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

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Hand Evaluation', () => {
  describe('countTopCards', () => {
    it('counts Dragon, Phoenix, Aces, and Kings', () => {
      const hand = [
        card('dragon'),
        card('phoenix'),
        card('standard', 14, 'jade'),   // Ace
        card('standard', 13, 'pagoda'), // King
        card('standard', 7, 'jade'),
        card('standard', 3, 'star'),
      ];
      expect(countTopCards(hand)).toBe(4);
    });

    it('counts Mahjong and Dog when option enabled', () => {
      const hand = [
        card('mahjong'),
        card('dog'),
        card('standard', 14, 'jade'),
        card('standard', 2, 'jade'),
      ];
      expect(countTopCards(hand)).toBe(1); // Just the Ace
      expect(countTopCards(hand, { includeMahjongDog: true })).toBe(3);
    });

    it('returns 0 for hand with no top cards', () => {
      const hand = [
        card('standard', 2, 'jade'),
        card('standard', 5, 'pagoda'),
        card('standard', 8, 'star'),
      ];
      expect(countTopCards(hand)).toBe(0);
    });
  });

  describe('countLeadGetters', () => {
    it('counts Aces, Dragon, Dog, and bombs', () => {
      const hand = [
        card('dragon'),
        card('dog'),
        card('standard', 14, 'jade'),
        card('standard', 14, 'pagoda'),
        card('standard', 7, 'jade'),
        // 4-of-a-kind bomb:
        card('standard', 9, 'jade', 901),
        card('standard', 9, 'pagoda', 902),
        card('standard', 9, 'star', 903),
        card('standard', 9, 'sword', 904),
      ];
      // Dragon + Dog + 2 Aces + 1 bomb = 5
      expect(countLeadGetters(hand)).toBe(5);
    });
  });

  describe('evaluateHandStrength', () => {
    it('returns higher score for stronger hands', () => {
      const strongHand = [
        card('dragon'),
        card('phoenix'),
        card('standard', 14, 'jade'),
        card('standard', 14, 'pagoda'),
        card('standard', 13, 'jade'),
      ];
      const weakHand = [
        card('standard', 2, 'jade'),
        card('standard', 3, 'pagoda'),
        card('standard', 4, 'star'),
        card('standard', 5, 'sword'),
        card('standard', 6, 'jade'),
      ];
      expect(evaluateHandStrength(strongHand)).toBeGreaterThan(evaluateHandStrength(weakHand));
    });
  });

  describe('findBombs', () => {
    it('finds four-of-a-kind bombs', () => {
      const hand = [
        card('standard', 7, 'jade', 701),
        card('standard', 7, 'pagoda', 702),
        card('standard', 7, 'star', 703),
        card('standard', 7, 'sword', 704),
        card('standard', 3, 'jade'),
      ];
      const bombs = findBombs(hand);
      expect(bombs.length).toBe(1);
      expect(bombs[0].isBomb).toBe(true);
    });

    it('returns empty for no bombs', () => {
      const hand = [
        card('standard', 7, 'jade'),
        card('standard', 7, 'pagoda'),
        card('standard', 7, 'star'),
        card('standard', 3, 'jade'),
      ];
      expect(findBombs(hand)).toHaveLength(0);
    });

    // Verifies: REQ-F-BOMB03 — straight-flush bomb detection
    it('detects straight-flush bombs (5+ consecutive same suit)', () => {
      const hand = [
        card('standard', 3, 'jade', 301),
        card('standard', 4, 'jade', 401),
        card('standard', 5, 'jade', 501),
        card('standard', 6, 'jade', 601),
        card('standard', 7, 'jade', 701),
        card('standard', 10, 'pagoda', 1002),
      ];
      const bombs = findBombs(hand);
      expect(bombs.length).toBeGreaterThanOrEqual(1);
      const sfBomb = bombs.find((b) => b.type === CombinationType.StraightFlushBomb);
      expect(sfBomb).toBeDefined();
      expect(sfBomb!.isBomb).toBe(true);
      expect(sfBomb!.cards.length).toBe(5);
    });

    // Verifies: REQ-F-BOMB03 — does not false-positive on non-flush straights
    it('does not detect straight of different suits as straight-flush bomb', () => {
      const hand = [
        card('standard', 3, 'jade', 301),
        card('standard', 4, 'pagoda', 402),
        card('standard', 5, 'jade', 501),
        card('standard', 6, 'star', 603),
        card('standard', 7, 'jade', 701),
      ];
      const bombs = findBombs(hand);
      const sfBombs = bombs.filter((b) => b.type === CombinationType.StraightFlushBomb);
      expect(sfBombs).toHaveLength(0);
    });

    // Verifies: REQ-F-BOMB03 — finds both four-of-a-kind and straight-flush bombs
    it('finds both bomb types when both exist', () => {
      const hand = [
        // Four-of-a-kind bomb: 4x 9s
        card('standard', 9, 'jade', 901),
        card('standard', 9, 'pagoda', 902),
        card('standard', 9, 'star', 903),
        card('standard', 9, 'sword', 904),
        // Straight-flush bomb: 3-4-5-6-7 of pagoda
        card('standard', 3, 'pagoda', 302),
        card('standard', 4, 'pagoda', 402),
        card('standard', 5, 'pagoda', 502),
        card('standard', 6, 'pagoda', 602),
        card('standard', 7, 'pagoda', 702),
      ];
      const bombs = findBombs(hand);
      const fourBombs = bombs.filter((b) => b.type === CombinationType.FourBomb);
      const sfBombs = bombs.filter((b) => b.type === CombinationType.StraightFlushBomb);
      expect(fourBombs.length).toBeGreaterThanOrEqual(1);
      expect(sfBombs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('findSingletons', () => {
    it('finds cards with no pair partner', () => {
      const hand = [
        card('standard', 7, 'jade', 701),
        card('standard', 7, 'pagoda', 702), // pair
        card('standard', 3, 'jade', 301),   // singleton
        card('standard', 10, 'star', 1001), // singleton
        card('dragon'),
      ];
      const singletons = findSingletons(hand);
      // Standard singletons: 3 and 10. Special: dragon
      expect(singletons.length).toBe(3);
    });
  });
});

describe('Card Sorting & Ranking', () => {
  describe('getCardStrength', () => {
    it('assigns correct strengths', () => {
      expect(getCardStrength(card('dog'))).toBe(0);
      expect(getCardStrength(card('mahjong'))).toBe(1);
      expect(getCardStrength(card('standard', 5))).toBe(5);
      expect(getCardStrength(card('standard', 14))).toBe(14);
      expect(getCardStrength(card('phoenix'))).toBe(15);
      expect(getCardStrength(card('dragon'))).toBe(25);
    });
  });

  describe('sortByStrength', () => {
    it('sorts weakest first', () => {
      const hand = [card('dragon'), card('standard', 3), card('phoenix'), card('dog')];
      const sorted = sortByStrength(hand);
      expect(sorted[0].card.kind).toBe('dog');
      expect(sorted[1].card.kind).toBe('standard');
      expect(sorted[2].card.kind).toBe('phoenix');
      expect(sorted[3].card.kind).toBe('dragon');
    });
  });

  describe('rankCombinationsForLead', () => {
    it('puts Dog first, then low rank, bombs last', () => {
      const combos: Combination[] = [
        makeCombo(CombinationType.Single, [card('standard', 10)], 10),
        makeCombo(CombinationType.Single, [card('dog')], 0),
        makeCombo(CombinationType.FourBomb, [card('standard', 8), card('standard', 8), card('standard', 8), card('standard', 8)], 8, true),
        makeCombo(CombinationType.Single, [card('standard', 3)], 3),
      ];
      const ranked = rankCombinationsForLead(combos);
      expect(ranked[0].cards[0].card.kind).toBe('dog'); // Dog first
      expect(ranked[ranked.length - 1].isBomb).toBe(true); // Bomb last
    });
  });

  describe('rankCombinationsForFollow', () => {
    it('puts non-bombs before bombs, sorted by rank', () => {
      const combos: Combination[] = [
        makeCombo(CombinationType.Single, [card('standard', 10)], 10),
        makeCombo(CombinationType.FourBomb, [card('standard', 8), card('standard', 8), card('standard', 8), card('standard', 8)], 8, true),
        makeCombo(CombinationType.Single, [card('standard', 5)], 5),
      ];
      const ranked = rankCombinationsForFollow(combos);
      expect(ranked[0].rank).toBe(5); // Lowest non-bomb
      expect(ranked[1].rank).toBe(10); // Higher non-bomb
      expect(ranked[2].isBomb).toBe(true); // Bomb last
    });
  });
});

describe('Strategic Passing', () => {
  describe('identifyWeakCards', () => {
    it('returns low singletons (rank <= 8)', () => {
      const hand = [
        card('standard', 2, 'jade', 201),
        card('standard', 5, 'pagoda', 501),
        card('standard', 10, 'star', 1001), // singleton but rank > 8
        card('standard', 14, 'jade', 1401),
        card('standard', 14, 'pagoda', 1402), // pair, not singleton
      ];
      const weak = identifyWeakCards(hand);
      expect(weak.length).toBe(2); // 2 and 5
      expect(weak[0].card.kind === 'standard' && weak[0].card.rank).toBe(2);
    });
  });

  describe('selectPassCards', () => {
    it('returns 3 distinct cards for 3 other seats', () => {
      const hand = [
        card('standard', 2, 'jade', 201),
        card('standard', 5, 'pagoda', 501),
        card('standard', 8, 'star', 801),
        card('standard', 10, 'sword', 1001),
        card('standard', 14, 'jade', 1401),
      ];
      const result = selectPassCards(hand, 'north');
      // Should have entries for east (opponent), south (partner), west (opponent)
      expect(result.east).toBeDefined();
      expect(result.south).toBeDefined();
      expect(result.west).toBeDefined();
      // All should be distinct cards
      const ids = new Set([result.east.id, result.south.id, result.west.id]);
      expect(ids.size).toBe(3);
    });
  });
});

describe('Play Selection', () => {
  describe('isPartnerWinning', () => {
    it('returns true when partner holds the trick', () => {
      const trick = {
        plays: [{ seat: 'south' as Seat, combination: makeCombo(CombinationType.Single, [], 5) }],
        passes: [],
        leadSeat: 'south' as Seat,
        currentWinner: 'south' as Seat,
      };
      // North's partner is South
      expect(isPartnerWinning(trick, 'north')).toBe(true);
      expect(isPartnerWinning(trick, 'east')).toBe(false);
    });

    it('returns false when no trick', () => {
      expect(isPartnerWinning(null, 'north')).toBe(false);
    });
  });

  describe('canGoOut', () => {
    it('returns true when hand size equals play size', () => {
      const hand = [card('standard', 5), card('standard', 5)];
      const combo = makeCombo(CombinationType.Pair, hand, 5);
      expect(canGoOut(hand, combo)).toBe(true);
    });

    it('returns false when hand has more cards', () => {
      const hand = [card('standard', 5), card('standard', 5), card('standard', 3)];
      const combo = makeCombo(CombinationType.Pair, [hand[0], hand[1]], 5);
      expect(canGoOut(hand, combo)).toBe(false);
    });
  });

  describe('isAllWinners', () => {
    it('returns true for all Aces/Dragon/Phoenix', () => {
      const hand = [card('standard', 14), card('dragon'), card('phoenix')];
      expect(isAllWinners(hand)).toBe(true);
    });

    it('returns false with low cards', () => {
      const hand = [card('standard', 14), card('standard', 3)];
      expect(isAllWinners(hand)).toBe(false);
    });
  });
});

describe('State Analysis', () => {
  describe('selectMahjongWish', () => {
    it('wishes for a mid-rank not in hand', () => {
      const hand = [
        card('standard', 8, 'jade'),
        card('standard', 9, 'pagoda'),
        card('standard', 14, 'jade'),
      ];
      const wish = selectMahjongWish(hand);
      // Should wish for 7 (first mid-rank not in hand, since 8 and 9 are held)
      expect(wish).toBe(7);
    });

    it('returns null when all mid-ranks are in hand', () => {
      const hand = [
        card('standard', 6, 'jade'),
        card('standard', 7, 'pagoda'),
        card('standard', 8, 'star'),
        card('standard', 9, 'sword'),
        card('standard', 10, 'jade'),
      ];
      expect(selectMahjongWish(hand)).toBeNull();
    });
  });

  describe('selectDragonRecipient', () => {
    it('gives to opponent with most cards', () => {
      const roundState = {
        players: {
          north: { hand: [card('standard', 2)], finishOrder: null },
          east: { hand: [card('standard', 3), card('standard', 4), card('standard', 5)], finishOrder: null },
          south: { hand: [], finishOrder: 1 },
          west: { hand: [card('standard', 6)], finishOrder: null },
        },
      } as any;
      const result = selectDragonRecipient(['east', 'west'], roundState);
      expect(result).toBe('east'); // East has 3 cards vs West's 1
    });
  });

  describe('getOpponentTichuCallers', () => {
    it('finds opponents who called Tichu', () => {
      const roundState = {
        players: {
          north: { tipiCall: 'none' },
          east: { tipiCall: 'tichu' },
          south: { tipiCall: 'grandTichu' },
          west: { tipiCall: 'none' },
        },
      } as any;
      // North's opponents are East and West
      const callers = getOpponentTichuCallers(roundState, 'north');
      expect(callers).toEqual(['east']);
    });
  });

  describe('isEndgame', () => {
    it('returns true when 2 or fewer active', () => {
      const roundState = {
        players: {
          north: { finishOrder: 1 },
          east: { finishOrder: null },
          south: { finishOrder: 2 },
          west: { finishOrder: null },
        },
      } as any;
      expect(isEndgame(roundState)).toBe(true);
    });

    it('returns false when 3+ active', () => {
      const roundState = {
        players: {
          north: { finishOrder: 1 },
          east: { finishOrder: null },
          south: { finishOrder: null },
          west: { finishOrder: null },
        },
      } as any;
      expect(isEndgame(roundState)).toBe(false);
    });
  });

  describe('getHandSizes', () => {
    it('returns card count per seat', () => {
      const roundState = {
        players: {
          north: { hand: [1, 2, 3] },
          east: { hand: [1] },
          south: { hand: [] },
          west: { hand: [1, 2] },
        },
      } as any;
      const sizes = getHandSizes(roundState);
      expect(sizes).toEqual({ north: 3, east: 1, south: 0, west: 2 });
    });
  });
});

// ─── Stanford Index Computations (REQ-F-GT01, REQ-F-RT01) ──────────────────

describe('Stanford Index Computations', () => {
  // Verifies: REQ-F-GT01
  describe('computeGrandTichuIndex', () => {
    it('returns 0 for hand with no power cards', () => {
      // Alternating suits to avoid straight-flush bomb
      const hand = [
        card('standard', 2, 'jade'), card('standard', 3, 'pagoda'), card('standard', 4, 'star'),
        card('standard', 5, 'sword'), card('standard', 6, 'jade'), card('standard', 7, 'pagoda'),
        card('standard', 8, 'star'), card('standard', 9, 'sword'),
      ];
      expect(computeGrandTichuIndex(hand)).toBe(0);
    });

    it('counts Dragon as 3', () => {
      const hand = [
        card('dragon'),
        card('standard', 2, 'jade'), card('standard', 3, 'pagoda'), card('standard', 4, 'star'),
        card('standard', 5, 'sword'), card('standard', 6, 'jade'), card('standard', 7, 'pagoda'),
        card('standard', 8, 'star'),
      ];
      expect(computeGrandTichuIndex(hand)).toBe(3);
    });

    it('counts Phoenix as 3', () => {
      const hand = [
        card('phoenix'),
        card('standard', 2, 'jade'), card('standard', 3, 'pagoda'), card('standard', 4, 'star'),
        card('standard', 5, 'sword'), card('standard', 6, 'jade'), card('standard', 7, 'pagoda'),
        card('standard', 8, 'star'),
      ];
      expect(computeGrandTichuIndex(hand)).toBe(3);
    });

    it('counts each Ace as 1', () => {
      const hand = [
        card('standard', 14, 'jade', 1401), card('standard', 14, 'pagoda', 1402),
        card('standard', 3, 'jade'), card('standard', 4, 'pagoda'),
        card('standard', 5, 'star'), card('standard', 6, 'sword'),
        card('standard', 7, 'jade'), card('standard', 8, 'pagoda'),
      ];
      expect(computeGrandTichuIndex(hand)).toBe(2);
    });

    it('counts Dragon + Phoenix + Ace correctly', () => {
      const hand = [
        card('dragon'), card('phoenix'), card('standard', 14, 'jade'),
        card('standard', 5, 'jade'), card('standard', 6, 'pagoda'), card('standard', 7, 'star'),
        card('standard', 8, 'sword'), card('standard', 9, 'jade'),
      ];
      // 3 + 3 + 1 = 7
      expect(computeGrandTichuIndex(hand)).toBe(7);
    });

    it('counts four-of-a-kind bomb as 3', () => {
      const hand = [
        card('standard', 5, 'jade', 501), card('standard', 5, 'pagoda', 502),
        card('standard', 5, 'star', 503), card('standard', 5, 'sword', 504),
        card('standard', 6, 'jade'), card('standard', 7, 'pagoda'),
        card('standard', 8, 'star'), card('standard', 9, 'sword'),
      ];
      expect(computeGrandTichuIndex(hand)).toBe(3);
    });

    it('does not count Kings, Dog, or Mahjong', () => {
      const hand = [
        card('standard', 13, 'jade'), card('standard', 13, 'pagoda'),
        card('dog'), card('mahjong'),
        card('standard', 5, 'jade'), card('standard', 6, 'pagoda'),
        card('standard', 7, 'star'), card('standard', 8, 'sword'),
      ];
      expect(computeGrandTichuIndex(hand)).toBe(0);
    });
  });

  // Verifies: REQ-F-RT01
  describe('computeTichuIndex', () => {
    it('returns 0 for a hand of all low non-consecutive pairs', () => {
      // 7 pairs at non-consecutive ranks: no straights, no singletons
      const hand = [
        card('standard', 2, 'jade', 201), card('standard', 2, 'pagoda', 202),
        card('standard', 4, 'jade', 401), card('standard', 4, 'pagoda', 402),
        card('standard', 6, 'jade', 601), card('standard', 6, 'pagoda', 602),
        card('standard', 8, 'jade', 801), card('standard', 8, 'pagoda', 802),
        card('standard', 10, 'jade', 1001), card('standard', 10, 'pagoda', 1002),
        card('standard', 12, 'jade', 1201), card('standard', 12, 'pagoda', 1202),
        card('standard', 3, 'jade', 301), card('standard', 3, 'pagoda', 302),
      ];
      expect(computeTichuIndex(hand)).toBe(0);
    });

    it('weights Dragon at 6', () => {
      // Dragon + non-consecutive pairs → no straights, no singletons
      const hand = [
        card('dragon'),
        card('standard', 2, 'jade', 201), card('standard', 2, 'pagoda', 202),
        card('standard', 4, 'jade', 401), card('standard', 4, 'pagoda', 402),
        card('standard', 6, 'jade', 601), card('standard', 6, 'pagoda', 602),
        card('standard', 8, 'jade', 801), card('standard', 8, 'pagoda', 802),
        card('standard', 10, 'jade', 1001), card('standard', 10, 'pagoda', 1002),
        card('standard', 12, 'jade', 1201), card('standard', 12, 'pagoda', 1202),
      ];
      expect(computeTichuIndex(hand)).toBe(6);
    });

    it('weights Dog at -2', () => {
      // Dog + non-consecutive pairs → no straights, no singletons
      const hand = [
        card('dog'),
        card('standard', 2, 'jade', 201), card('standard', 2, 'pagoda', 202),
        card('standard', 4, 'jade', 401), card('standard', 4, 'pagoda', 402),
        card('standard', 6, 'jade', 601), card('standard', 6, 'pagoda', 602),
        card('standard', 8, 'jade', 801), card('standard', 8, 'pagoda', 802),
        card('standard', 10, 'jade', 1001), card('standard', 10, 'pagoda', 1002),
        card('standard', 12, 'jade', 1201), card('standard', 12, 'pagoda', 1202),
      ];
      expect(computeTichuIndex(hand)).toBe(-2);
    });

    it('includes straight bonus (+1 per straight of 5+)', () => {
      // Hand: 2-3-4-5-6 = straight of 5 (alternating suits), + non-consecutive paired filler
      const hand = [
        card('standard', 2, 'jade', 201), card('standard', 3, 'pagoda', 301),
        card('standard', 4, 'star', 401), card('standard', 5, 'sword', 501),
        card('standard', 6, 'jade', 601),
        // Non-consecutive paired filler (no more straight extension)
        card('standard', 8, 'jade', 801), card('standard', 8, 'pagoda', 802),
        card('standard', 10, 'star', 1001), card('standard', 10, 'sword', 1002),
        card('standard', 12, 'jade', 1201), card('standard', 12, 'pagoda', 1202),
        card('standard', 13, 'star', 1301), card('standard', 13, 'sword', 1302),
        card('standard', 14, 'jade', 1401),
      ];
      // Straight: 2-3-4-5-6 = run of 5 → 1 straight (+1)
      // No small singletons not in straight (2-6 in straight, 8,10,12,13 paired, 14 Ace)
      // Ace: 2 points
      // It = 2(Ace) + 1(straight) = 3
      expect(computeTichuIndex(hand)).toBe(3);
    });

    it('penalizes small singletons not in straights (-1 each)', () => {
      // Hand with no power cards, no straights, and small singletons
      const hand = [
        card('standard', 2, 'jade', 201),  // singleton below Q, not in straight → -1
        card('standard', 4, 'star', 401),  // singleton below Q, not in straight → -1
        card('standard', 9, 'sword', 901),  // singleton below Q, not in straight → -1
        card('standard', 12, 'jade', 1201), card('standard', 12, 'pagoda', 1202),
        card('standard', 13, 'jade', 1301), card('standard', 13, 'pagoda', 1302),
        card('standard', 10, 'jade', 1001), card('standard', 10, 'pagoda', 1002),
        card('standard', 11, 'star', 1101), card('standard', 11, 'pagoda', 1102),
        card('standard', 8, 'jade', 801), card('standard', 8, 'pagoda', 802),
        card('standard', 7, 'sword', 701),  // singleton below Q, not in straight → -1
      ];
      // 7,8,9,10,11,12,13 = 7 consecutive → straight! So 7 and 9 NOT penalized.
      // Only 2 and 4 are singletons below Q not in straight → -2
      // It = 0(no power cards) + 1(straight) - 2(singletons) = -1
      expect(computeTichuIndex(hand)).toBe(-1);
    });

    it('computes full index: Dragon + Ace + bomb + straight - Dog - singletons', () => {
      // Dragon(6) + Ace(2) + Dog(-2) + bomb(5) + straight(1) - 0 singletons = 12
      // Use alternating suits for non-bomb cards to avoid straight-flush bombs
      const hand = [
        card('dragon'), card('dog'),
        card('standard', 14, 'jade', 1401),
        card('standard', 5, 'jade', 501), card('standard', 5, 'pagoda', 502),
        card('standard', 5, 'star', 503), card('standard', 5, 'sword', 504),
        card('standard', 6, 'pagoda', 601), card('standard', 7, 'star', 701),
        card('standard', 8, 'sword', 801), card('standard', 9, 'jade', 901),
        card('standard', 10, 'pagoda', 1001),
        card('standard', 11, 'star', 1101), card('standard', 11, 'pagoda', 1102),
      ];
      // Bombs: four 5s = 1 bomb (5), no straight-flush bombs (mixed suits)
      // Straight: 5,6,7,8,9,10,11 = 7 consecutive (+1)
      // Small singletons: 6,7,8,9,10 are singletons below 12 but they're in the straight
      // It = 6 + 2 - 2 + 5 + 1 - 0 = 12
      expect(computeTichuIndex(hand)).toBe(12);
    });
  });

  describe('countStraights', () => {
    it('returns 0 when no 5+ consecutive ranks', () => {
      const hand = [
        card('standard', 2), card('standard', 4), card('standard', 6),
        card('standard', 8), card('standard', 10),
      ];
      expect(countStraights(hand)).toBe(0);
    });

    it('returns 1 for a run of exactly 5', () => {
      const hand = [
        card('standard', 3), card('standard', 4), card('standard', 5),
        card('standard', 6), card('standard', 7),
      ];
      expect(countStraights(hand)).toBe(1);
    });

    it('counts Mahjong as rank 1', () => {
      const hand = [
        card('mahjong'), card('standard', 2), card('standard', 3),
        card('standard', 4), card('standard', 5),
      ];
      expect(countStraights(hand)).toBe(1);
    });

    it('Phoenix fills one gap in a run', () => {
      // 3,4,_,6,7 with Phoenix = 3,4,5,6,7 → straight
      const hand = [
        card('phoenix'), card('standard', 3), card('standard', 4),
        card('standard', 6), card('standard', 7),
      ];
      expect(countStraights(hand)).toBe(1);
    });

    it('returns 0 when run of 4 with no Phoenix', () => {
      const hand = [
        card('standard', 3), card('standard', 4),
        card('standard', 5), card('standard', 6),
      ];
      expect(countStraights(hand)).toBe(0);
    });
  });

  describe('countSmallSingletons', () => {
    it('returns 0 when all cards are paired', () => {
      const hand = [
        card('standard', 3, 'jade', 31), card('standard', 3, 'pagoda', 32),
        card('standard', 5, 'jade', 51), card('standard', 5, 'pagoda', 52),
      ];
      expect(countSmallSingletons(hand)).toBe(0);
    });

    it('counts singletons below rank 12', () => {
      const hand = [
        card('standard', 3, 'jade', 31),  // singleton, below 12 → counted
        card('standard', 7, 'jade', 71),  // singleton, below 12 → counted
        card('standard', 12, 'jade', 121), // singleton, but rank 12 → NOT counted
        card('standard', 14, 'jade', 141), // singleton, but rank 14 → NOT counted
      ];
      expect(countSmallSingletons(hand)).toBe(2);
    });

    it('excludes singletons that are in a 5+ straight', () => {
      const hand = [
        card('standard', 3, 'jade', 31), card('standard', 4, 'jade', 41),
        card('standard', 5, 'jade', 51), card('standard', 6, 'jade', 61),
        card('standard', 7, 'jade', 71),
        card('standard', 10, 'jade', 101), // singleton below 12, NOT in straight → counted
      ];
      // 3-4-5-6-7 is a straight → those singletons excluded
      // 10 is a singleton not in straight → counted
      expect(countSmallSingletons(hand)).toBe(1);
    });
  });

  // ─── Endgame Phase Detection (REQ-F-END01-04) ─────────────────────────────

  describe('getEndgamePhase', () => {
    // Verifies: REQ-F-END01
    it('returns 3p-partner-out when partner already went out', () => {
      const rs = makeRoundState({
        finishOrder: ['south'],
        players: {
          north: { hand: Array(5).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: Array(5).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          south: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: true, finishOrder: 1 },
          west: { hand: Array(5).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });
      expect(getEndgamePhase(rs, 'north')).toBe('3p-partner-out');
    });

    // Verifies: REQ-F-END02
    it('returns 3p-partner-in when partner still playing', () => {
      const rs = makeRoundState({
        finishOrder: ['east'],
        players: {
          north: { hand: Array(5).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: true, finishOrder: 1 },
          south: { hand: Array(5).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          west: { hand: Array(5).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });
      expect(getEndgamePhase(rs, 'north')).toBe('3p-partner-in');
    });

    // Verifies: REQ-F-END03, REQ-F-END04
    it('returns 2p when only 2 players remain', () => {
      const rs = makeRoundState({
        finishOrder: ['east', 'south'],
        players: {
          north: { hand: Array(5).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
          east: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: true, finishOrder: 1 },
          south: { hand: [], tricksWon: [], tipiCall: 'none', hasPlayed: true, finishOrder: 2 },
          west: { hand: Array(5).fill(card('standard', 2)), tricksWon: [], tipiCall: 'none', hasPlayed: false, finishOrder: null },
        },
      });
      expect(getEndgamePhase(rs, 'north')).toBe('2p');
    });

    it('returns normal when all 4 players active', () => {
      const rs = makeRoundState();
      expect(getEndgamePhase(rs, 'north')).toBe('normal');
    });
  });

  // ─── M1: Strength Detection (REQ-F-STR01) ──────────────────────────────

  describe('hasStrength', () => {
    // Verifies: REQ-F-STR01
    it('returns true with 2+ power cards (Dragon + Ace)', () => {
      const hand = [
        card('dragon'),
        card('standard', 14, 'jade'),
        card('standard', 5, 'jade'),
      ];
      expect(hasStrength(hand)).toBe(true);
    });

    it('returns true with 2 Aces', () => {
      const hand = [
        card('standard', 14, 'jade', 1401),
        card('standard', 14, 'pagoda', 1402),
        card('standard', 5, 'jade'),
      ];
      expect(hasStrength(hand)).toBe(true);
    });

    it('returns true with Phoenix + Dragon', () => {
      const hand = [card('phoenix'), card('dragon'), card('standard', 3, 'jade')];
      expect(hasStrength(hand)).toBe(true);
    });

    it('returns false with only 1 power card', () => {
      const hand = [
        card('dragon'),
        card('standard', 10, 'jade'),
        card('standard', 5, 'jade'),
      ];
      expect(hasStrength(hand)).toBe(false);
    });

    it('returns false with no power cards', () => {
      const hand = [
        card('standard', 3, 'jade'),
        card('standard', 5, 'pagoda'),
        card('standard', 8, 'star'),
      ];
      expect(hasStrength(hand)).toBe(false);
    });

    it('counts Kings as non-power cards', () => {
      const hand = [
        card('standard', 13, 'jade'),
        card('standard', 13, 'pagoda'),
        card('standard', 5, 'jade'),
      ];
      expect(hasStrength(hand)).toBe(false);
    });
  });

  // ─── isCardInMultiCardCombo (REQ-F-PASS02) ──────────────────────────────

  describe('isCardInMultiCardCombo', () => {
    it('returns true for a card in a pair', () => {
      const hand = [
        card('standard', 7, 'jade', 701),
        card('standard', 7, 'pagoda', 702),
        card('standard', 3, 'jade', 301),
      ];
      expect(isCardInMultiCardCombo(hand[0], hand)).toBe(true);
    });

    it('returns false for a singleton', () => {
      const hand = [
        card('standard', 7, 'jade', 701),
        card('standard', 8, 'pagoda', 801),
        card('standard', 3, 'jade', 301),
      ];
      expect(isCardInMultiCardCombo(hand[0], hand)).toBe(false);
    });

    it('returns true for a card in a triple', () => {
      const hand = [
        card('standard', 7, 'jade', 701),
        card('standard', 7, 'pagoda', 702),
        card('standard', 7, 'star', 703),
      ];
      expect(isCardInMultiCardCombo(hand[0], hand)).toBe(true);
    });

    it('returns false for special cards', () => {
      const hand = [card('dragon'), card('phoenix'), card('standard', 7, 'jade')];
      expect(isCardInMultiCardCombo(hand[0], hand)).toBe(false);
    });
  });

  // ─── getThirdWorstNonBreaking (REQ-F-PASS02) ────────────────────────────

  describe('getThirdWorstNonBreaking', () => {
    it('returns 3rd weakest singleton when enough singletons exist', () => {
      const hand = [
        card('standard', 2, 'jade', 201),
        card('standard', 4, 'jade', 401),
        card('standard', 6, 'jade', 601),
        card('standard', 8, 'jade', 801),
        card('standard', 10, 'jade', 1001),
      ];
      const result = getThirdWorstNonBreaking(hand);
      expect(result).not.toBeNull();
      expect(result!.card.kind).toBe('standard');
      if (result!.card.kind === 'standard') {
        expect(result!.card.rank).toBe(6); // 3rd weakest singleton
      }
    });

    it('skips cards in pairs', () => {
      const hand = [
        card('standard', 2, 'jade', 201),
        card('standard', 4, 'jade', 401),
        card('standard', 4, 'pagoda', 402), // pair of 4s — skip
        card('standard', 6, 'jade', 601),
        card('standard', 8, 'jade', 801),
      ];
      const result = getThirdWorstNonBreaking(hand);
      expect(result).not.toBeNull();
      if (result!.card.kind === 'standard') {
        // Singletons: 2, 6, 8 → 3rd = 8
        expect(result!.card.rank).toBe(8);
      }
    });

    it('falls back to 3rd weakest overall when fewer than 3 singletons', () => {
      const hand = [
        card('standard', 3, 'jade', 301),
        card('standard', 3, 'pagoda', 302),
        card('standard', 5, 'jade', 501),
        card('standard', 5, 'pagoda', 502),
        card('standard', 7, 'jade', 701),
      ];
      const result = getThirdWorstNonBreaking(hand);
      expect(result).not.toBeNull();
      // Only 1 singleton (7), so falls back to 3rd weakest overall = rank 5
      if (result!.card.kind === 'standard') {
        expect(result!.card.rank).toBe(5);
      }
    });

    it('returns null for empty hand', () => {
      expect(getThirdWorstNonBreaking([])).toBeNull();
    });
  });

  // ─── getRightOpponent ──────────────────────────────────────────────────

  describe('getRightOpponent', () => {
    it('returns west for north (counter-clockwise)', () => {
      expect(getRightOpponent('north')).toBe('west');
    });

    it('returns north for east', () => {
      expect(getRightOpponent('east')).toBe('north');
    });

    it('returns east for south', () => {
      expect(getRightOpponent('south')).toBe('east');
    });

    it('returns south for west', () => {
      expect(getRightOpponent('west')).toBe('south');
    });
  });

  // ─── hasStrongMultiCardHand (REQ-F-GT01-03) ────────────────────────────

  describe('hasStrongMultiCardHand', () => {
    it('returns true for pair of Jacks (rank 11)', () => {
      const hand = [
        card('standard', 11, 'jade', 1101),
        card('standard', 11, 'pagoda', 1102),
        card('standard', 5, 'jade'),
      ];
      expect(hasStrongMultiCardHand(hand)).toBe(true);
    });

    it('returns true for pair of Kings', () => {
      const hand = [
        card('standard', 13, 'jade', 1301),
        card('standard', 13, 'pagoda', 1302),
      ];
      expect(hasStrongMultiCardHand(hand)).toBe(true);
    });

    it('returns false for pair of 10s (rank = 10, not > 10)', () => {
      const hand = [
        card('standard', 10, 'jade', 1001),
        card('standard', 10, 'pagoda', 1002),
        card('standard', 5, 'jade'),
      ];
      expect(hasStrongMultiCardHand(hand)).toBe(false);
    });

    it('returns false when all cards are singletons', () => {
      const hand = [
        card('standard', 12, 'jade'),
        card('standard', 13, 'pagoda'),
        card('standard', 14, 'star'),
      ];
      expect(hasStrongMultiCardHand(hand)).toBe(false);
    });

    it('returns true for a straight containing high ranks', () => {
      const hand = [
        card('standard', 9, 'jade', 901),
        card('standard', 10, 'jade', 1001),
        card('standard', 11, 'jade', 1101),
        card('standard', 12, 'jade', 1201),
        card('standard', 13, 'jade', 1301),
      ];
      expect(hasStrongMultiCardHand(hand)).toBe(true);
    });

    it('returns false for low straight (5-9)', () => {
      const hand = [
        card('standard', 5, 'jade', 501),
        card('standard', 6, 'jade', 601),
        card('standard', 7, 'jade', 701),
        card('standard', 8, 'jade', 801),
        card('standard', 9, 'jade', 901),
      ];
      expect(hasStrongMultiCardHand(hand)).toBe(false);
    });
  });
});
