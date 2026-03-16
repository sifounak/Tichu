// Verifies: REQ-NF-MAINT01, REQ-F-INFO01

import { describe, it, expect } from 'vitest';
import type { GameCard, Rank, Seat, Combination } from '@tichu/shared';
import { CombinationType, Suit } from '@tichu/shared';
import {
  countTopCards,
  countLeadGetters,
  evaluateHandStrength,
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
  selectMahjongWish,
  selectDragonRecipient,
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
