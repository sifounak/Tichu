// Verifies: REQ-F-CB06

import { describe, it, expect } from 'vitest';
import { getAllValidPlays } from '../../src/engine/combination-utils.js';
import { CombinationType } from '../../src/types/combination.js';
import type { GameCard, Rank } from '../../src/types/card.js';
import { Suit } from '../../src/types/card.js';
import type { Combination } from '../../src/types/combination.js';

// --- Helpers ---

function std(id: number, suit: Suit, rank: Rank): GameCard {
  return { id, card: { kind: 'standard', suit, rank } };
}

function dragon(id = 55): GameCard {
  return { id, card: { kind: 'dragon' } };
}

function phoenix(id = 54): GameCard {
  return { id, card: { kind: 'phoenix' } };
}

function mahjong(id = 52): GameCard {
  return { id, card: { kind: 'mahjong' } };
}

function dog(id = 53): GameCard {
  return { id, card: { kind: 'dog' } };
}

function j(rank: Rank, id?: number): GameCard {
  return std(id ?? rank, Suit.Jade, rank);
}
function p(rank: Rank, id?: number): GameCard {
  return std(id ?? rank + 20, Suit.Pagoda, rank);
}

function hasType(plays: Combination[], type: CombinationType): boolean {
  return plays.some((c) => c.type === type);
}

function countType(plays: Combination[], type: CombinationType): number {
  return plays.filter((c) => c.type === type).length;
}

// --- Tests ---

describe('getAllValidPlays', () => {
  describe('leading (no current trick)', () => {
    it('finds all singles from a simple hand', () => {
      const hand = [j(3), j(5), j(8)];
      const plays = getAllValidPlays(hand, null);
      const singles = plays.filter((c) => c.type === CombinationType.Single);
      expect(singles).toHaveLength(3);
    });

    it('finds pairs from hand with matching ranks', () => {
      const hand = [j(5), p(5), j(8)];
      const plays = getAllValidPlays(hand, null);
      expect(hasType(plays, CombinationType.Pair)).toBe(true);
    });

    it('finds four-of-a-kind bomb', () => {
      const hand = [
        std(1, Suit.Jade, 7),
        std(2, Suit.Pagoda, 7),
        std(3, Suit.Star, 7),
        std(4, Suit.Sword, 7),
      ];
      const plays = getAllValidPlays(hand, null);
      expect(hasType(plays, CombinationType.FourBomb)).toBe(true);
    });

    it('Dog can lead', () => {
      const hand = [dog(), j(3)];
      const plays = getAllValidPlays(hand, null);
      const dogPlays = plays.filter(
        (c) => c.type === CombinationType.Single && c.rank === 0,
      );
      expect(dogPlays).toHaveLength(1);
    });

    it('finds Phoenix pairs with each standard card', () => {
      const hand = [phoenix(), j(3), j(8)];
      const plays = getAllValidPlays(hand, null);
      const pairs = plays.filter((c) => c.type === CombinationType.Pair);
      expect(pairs).toHaveLength(2); // Phoenix+3, Phoenix+8
    });

    it('finds straights', () => {
      const hand = [j(3), p(4), j(5), p(6), j(7)];
      const plays = getAllValidPlays(hand, null);
      expect(hasType(plays, CombinationType.Straight)).toBe(true);
    });

    it('finds full houses', () => {
      const hand = [
        std(1, Suit.Jade, 5),
        std(2, Suit.Pagoda, 5),
        std(3, Suit.Star, 5),
        std(4, Suit.Jade, 9),
        std(5, Suit.Pagoda, 9),
      ];
      const plays = getAllValidPlays(hand, null);
      expect(hasType(plays, CombinationType.FullHouse)).toBe(true);
    });
  });

  describe('following (current trick set)', () => {
    it('only returns plays that beat the current trick', () => {
      const hand = [j(3), j(5), j(10), j(14)];
      const currentTrick: Combination = {
        type: CombinationType.Single,
        cards: [],
        rank: 8,
        length: 1,
        isBomb: false,
      };
      const plays = getAllValidPlays(hand, currentTrick);
      // Only 10 and Ace can beat an 8
      const singles = plays.filter((c) => c.type === CombinationType.Single);
      expect(singles).toHaveLength(2);
      expect(singles.every((s) => s.rank > 8)).toBe(true);
    });

    it('Dog cannot follow (only leads)', () => {
      const hand = [dog(), j(10)];
      const currentTrick: Combination = {
        type: CombinationType.Single,
        cards: [],
        rank: 3,
        length: 1,
        isBomb: false,
      };
      const plays = getAllValidPlays(hand, currentTrick);
      const dogPlays = plays.filter((c) => c.rank === 0);
      expect(dogPlays).toHaveLength(0);
    });

    it('bombs can beat non-bomb tricks', () => {
      const hand = [
        std(1, Suit.Jade, 2),
        std(2, Suit.Pagoda, 2),
        std(3, Suit.Star, 2),
        std(4, Suit.Sword, 2),
      ];
      const currentTrick: Combination = {
        type: CombinationType.Single,
        cards: [],
        rank: 14,
        length: 1,
        isBomb: false,
      };
      const plays = getAllValidPlays(hand, currentTrick);
      expect(hasType(plays, CombinationType.FourBomb)).toBe(true);
    });

    it('must match type and length for non-bomb plays', () => {
      const hand = [j(3), p(4), j(10), p(10)];
      const currentTrick: Combination = {
        type: CombinationType.Pair,
        cards: [],
        rank: 8,
        length: 1,
        isBomb: false,
      };
      const plays = getAllValidPlays(hand, currentTrick);
      // Only pair of 10s can beat pair of 8s
      const pairs = plays.filter((c) => c.type === CombinationType.Pair);
      expect(pairs).toHaveLength(1);
      expect(pairs[0].rank).toBe(10);
    });
  });

  describe('advanced combinations', () => {
    it('finds straight flush bombs from hand', () => {
      const hand = [
        std(1, Suit.Jade, 3),
        std(2, Suit.Jade, 4),
        std(3, Suit.Jade, 5),
        std(4, Suit.Jade, 6),
        std(5, Suit.Jade, 7),
      ];
      const plays = getAllValidPlays(hand, null);
      expect(hasType(plays, CombinationType.StraightFlushBomb)).toBe(true);
    });

    it('finds pair sequences from hand', () => {
      const hand = [j(5), p(5), j(6), p(6), j(7), p(7)];
      const plays = getAllValidPlays(hand, null);
      // Should find 2-pair and 3-pair sequences
      const pairSeqs = plays.filter((c) => c.type === CombinationType.PairSequence);
      expect(pairSeqs.length).toBeGreaterThanOrEqual(3); // 5-6, 6-7, 5-6-7
    });

    it('finds pair sequences with Phoenix', () => {
      const hand = [phoenix(), j(5), j(6), p(6)];
      const plays = getAllValidPlays(hand, null);
      const pairSeqs = plays.filter((c) => c.type === CombinationType.PairSequence);
      // Phoenix+5 and 6,6 forms a 2-pair sequence
      expect(pairSeqs.length).toBeGreaterThanOrEqual(1);
    });

    it('finds full houses from hand', () => {
      const hand = [
        std(1, Suit.Jade, 5),
        std(2, Suit.Pagoda, 5),
        std(3, Suit.Star, 5),
        std(4, Suit.Jade, 9),
        std(5, Suit.Pagoda, 9),
        std(6, Suit.Star, 9),
      ];
      const plays = getAllValidPlays(hand, null);
      const fullHouses = plays.filter((c) => c.type === CombinationType.FullHouse);
      // 5-5-5 + 9-9, 9-9-9 + 5-5 (and variants with different suit combos)
      expect(fullHouses.length).toBeGreaterThanOrEqual(2);
    });

    it('finds straights with Mahjong', () => {
      const hand = [mahjong(), j(2), p(3), j(4), p(5)];
      const plays = getAllValidPlays(hand, null);
      expect(hasType(plays, CombinationType.Straight)).toBe(true);
    });

    it('finds straights with Phoenix filling gap', () => {
      const hand = [phoenix(), j(3), p(4), j(6), p(7)];
      const plays = getAllValidPlays(hand, null);
      const straights = plays.filter((c) => c.type === CombinationType.Straight);
      expect(straights.length).toBeGreaterThanOrEqual(1);
      expect(straights[0].phoenixUsedAs).toBe(5);
    });
  });
});
