// Verifies: REQ-F-CB01, REQ-F-CB03, REQ-F-CB04, REQ-F-CB05
// Verifies: REQ-F-BB01, REQ-F-BB07, REQ-F-BB08

import { describe, it, expect } from 'vitest';
import { detectCombination, detectAllBombs } from '../../src/engine/combination-detector.js';
import { CombinationType } from '../../src/types/combination.js';
import type { GameCard, Rank } from '../../src/types/card.js';
import { Suit } from '../../src/types/card.js';
import { DRAGON_RANK, MAHJONG_RANK, PHOENIX_SINGLE_VALUE } from '../../src/constants.js';

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

// Shorthand for standard cards in Jade suit
function j(rank: Rank, id?: number): GameCard {
  return std(id ?? rank, Suit.Jade, rank);
}
function p(rank: Rank, id?: number): GameCard {
  return std(id ?? rank + 20, Suit.Pagoda, rank);
}
function s(rank: Rank, id?: number): GameCard {
  return std(id ?? rank + 40, Suit.Star, rank);
}
function sw(rank: Rank, id?: number): GameCard {
  return std(id ?? rank + 60, Suit.Sword, rank);
}

// --- Tests ---

describe('detectCombination', () => {
  describe('empty input', () => {
    it('returns null for empty array', () => {
      expect(detectCombination([])).toBeNull();
    });
  });

  describe('Singles', () => {
    it('detects standard card as single', () => {
      const combo = detectCombination([j(7)]);
      expect(combo).not.toBeNull();
      expect(combo!.type).toBe(CombinationType.Single);
      expect(combo!.rank).toBe(7);
      expect(combo!.length).toBe(1);
      expect(combo!.isBomb).toBe(false);
    });

    it('detects Ace as single with rank 14', () => {
      const combo = detectCombination([j(14)]);
      expect(combo!.type).toBe(CombinationType.Single);
      expect(combo!.rank).toBe(14);
    });

    // REQ-F-CB03: Dragon only as single
    it('detects Dragon as single with highest rank', () => {
      const combo = detectCombination([dragon()]);
      expect(combo!.type).toBe(CombinationType.Single);
      expect(combo!.rank).toBe(DRAGON_RANK);
    });

    it('detects Phoenix as single with rank 1.5', () => {
      const combo = detectCombination([phoenix()]);
      expect(combo!.type).toBe(CombinationType.Single);
      expect(combo!.rank).toBe(PHOENIX_SINGLE_VALUE);
    });

    // REQ-F-CB05: Mahjong rank 1
    it('detects Mahjong as single with rank 1', () => {
      const combo = detectCombination([mahjong()]);
      expect(combo!.type).toBe(CombinationType.Single);
      expect(combo!.rank).toBe(MAHJONG_RANK);
    });

    // REQ-F-CB04: Dog as single (lead-only action)
    it('detects Dog as single with rank 0', () => {
      const combo = detectCombination([dog()]);
      expect(combo!.type).toBe(CombinationType.Single);
      expect(combo!.rank).toBe(0);
    });
  });

  describe('Pairs', () => {
    it('detects a standard pair', () => {
      const combo = detectCombination([j(8), p(8)]);
      expect(combo!.type).toBe(CombinationType.Pair);
      expect(combo!.rank).toBe(8);
      expect(combo!.isBomb).toBe(false);
    });

    it('detects pair of Aces', () => {
      const combo = detectCombination([j(14), p(14)]);
      expect(combo!.type).toBe(CombinationType.Pair);
      expect(combo!.rank).toBe(14);
    });

    it('detects Phoenix + standard as pair', () => {
      const combo = detectCombination([phoenix(), j(10)]);
      expect(combo!.type).toBe(CombinationType.Pair);
      expect(combo!.rank).toBe(10);
      expect(combo!.phoenixUsedAs).toBe(10);
    });

    it('rejects two different ranks', () => {
      expect(detectCombination([j(5), p(7)])).toBeNull();
    });

    it('rejects Phoenix + Mahjong as pair', () => {
      expect(detectCombination([phoenix(), mahjong()])).toBeNull();
    });

    it('rejects Phoenix + Dragon as pair', () => {
      expect(detectCombination([phoenix(), dragon()])).toBeNull();
    });

    it('rejects Phoenix + Dog as pair', () => {
      expect(detectCombination([phoenix(), dog()])).toBeNull();
    });

    it('rejects Dragon + standard as pair', () => {
      expect(detectCombination([dragon(), j(5)])).toBeNull();
    });
  });

  describe('Triples', () => {
    it('detects a standard triple', () => {
      const combo = detectCombination([j(6), p(6), s(6)]);
      expect(combo!.type).toBe(CombinationType.Triple);
      expect(combo!.rank).toBe(6);
    });

    it('detects Phoenix + 2 same rank as triple', () => {
      const combo = detectCombination([phoenix(), j(9), p(9)]);
      expect(combo!.type).toBe(CombinationType.Triple);
      expect(combo!.rank).toBe(9);
      expect(combo!.phoenixUsedAs).toBe(9);
    });

    it('rejects three different ranks', () => {
      expect(detectCombination([j(3), p(4), s(5)])).toBeNull();
    });

    it('rejects Phoenix + two different ranks', () => {
      expect(detectCombination([phoenix(), j(3), p(4)])).toBeNull();
    });

    it('rejects Dragon in triple', () => {
      expect(detectCombination([dragon(), j(5), p(5)])).toBeNull();
    });
  });

  describe('Full Houses', () => {
    it('detects standard full house (3+2)', () => {
      const combo = detectCombination([j(10), p(10), s(10), j(4), p(4)]);
      expect(combo!.type).toBe(CombinationType.FullHouse);
      expect(combo!.rank).toBe(10); // triple rank
    });

    it('detects Phoenix completing the pair in full house', () => {
      // Triple of 7s + pair of (5 + Phoenix)
      const combo = detectCombination([j(7), p(7), s(7), j(5), phoenix()]);
      expect(combo!.type).toBe(CombinationType.FullHouse);
      expect(combo!.rank).toBe(7);
      expect(combo!.phoenixUsedAs).toBe(5);
    });

    it('detects 2+2+Phoenix as full house — higher rank becomes triple (case 1)', () => {
      // Two 3s + two 8s + Phoenix → Phoenix joins 8s for triple, 3s stay as pair
      const combo = detectCombination([j(3), p(3), phoenix(), j(8), p(8)]);
      expect(combo!.type).toBe(CombinationType.FullHouse);
      expect(combo!.rank).toBe(8); // higher rank becomes triple
      expect(combo!.phoenixUsedAs).toBe(8);
    });

    it('detects 2+2+Phoenix as full house — higher rank becomes triple (case 2)', () => {
      // Two 4s + two 9s + Phoenix → triple of 9s + pair of 4s
      const combo = detectCombination([j(4), p(4), j(9), p(9), phoenix()]);
      expect(combo!.type).toBe(CombinationType.FullHouse);
      expect(combo!.rank).toBe(9); // higher rank becomes triple
      expect(combo!.phoenixUsedAs).toBe(9);
    });

    it('rejects full house with Dragon', () => {
      expect(detectCombination([dragon(), j(5), p(5), j(3), p(3)])).toBeNull();
    });

    it('rejects 5 cards of same rank (not a full house)', () => {
      // This isn't possible with 4 suits, but let's test 4+Phoenix
      expect(detectCombination([j(5), p(5), s(5), sw(5), phoenix()])).toBeNull();
    });

    // Verifies: REQ-F-RT01 — Official FAQ: "Is 3,3,3,3,Phoenix a valid full house? No."
    it('rejects [3,3,3,3,Phoenix] as full house (FAQ rule)', () => {
      expect(detectCombination([j(3), p(3), s(3), sw(3), phoenix()])).toBeNull();
    });

    // Verifies: REQ-F-RT02 — Generalized 4-of-kind + Phoenix rejection
    it('rejects [7,7,7,7,Phoenix] as full house', () => {
      expect(detectCombination([j(7), p(7), s(7), sw(7), phoenix()])).toBeNull();
    });
  });

  describe('Straights', () => {
    it('detects a 5-card straight', () => {
      const combo = detectCombination([j(3), p(4), s(5), j(6), p(7)]);
      expect(combo!.type).toBe(CombinationType.Straight);
      expect(combo!.rank).toBe(7); // highest rank
      expect(combo!.length).toBe(5);
      expect(combo!.isBomb).toBe(false);
    });

    it('detects a 6-card straight', () => {
      const combo = detectCombination([j(8), p(9), s(10), j(11), p(12), s(13)]);
      expect(combo!.type).toBe(CombinationType.Straight);
      expect(combo!.rank).toBe(13);
      expect(combo!.length).toBe(6);
    });

    // REQ-F-CB05: Mahjong rank 1 in straights
    it('detects straight with Mahjong as rank 1', () => {
      const combo = detectCombination([mahjong(), j(2), p(3), s(4), j(5)]);
      expect(combo!.type).toBe(CombinationType.Straight);
      expect(combo!.rank).toBe(5);
      expect(combo!.length).toBe(5);
    });

    it('detects straight with Phoenix filling a gap', () => {
      // 3, 4, _, 6, 7 → Phoenix fills rank 5
      const combo = detectCombination([j(3), p(4), phoenix(), j(6), p(7)]);
      expect(combo!.type).toBe(CombinationType.Straight);
      expect(combo!.rank).toBe(7);
      expect(combo!.length).toBe(5);
      expect(combo!.phoenixUsedAs).toBe(5);
    });

    it('detects straight with Phoenix extending at top', () => {
      // 3, 4, 5, 6, Phoenix → Phoenix as 7
      const combo = detectCombination([j(3), p(4), s(5), j(6), phoenix()]);
      expect(combo!.type).toBe(CombinationType.Straight);
      expect(combo!.rank).toBe(7);
      expect(combo!.phoenixUsedAs).toBe(7);
    });

    it('rejects straight with Dragon', () => {
      expect(detectCombination([j(10), p(11), s(12), j(13), dragon()])).toBeNull();
    });

    it('rejects straight with Dog', () => {
      expect(detectCombination([dog(), j(2), p(3), s(4), j(5)])).toBeNull();
    });

    it('rejects non-consecutive cards', () => {
      expect(detectCombination([j(2), p(4), s(6), j(8), p(10)])).toBeNull();
    });

    it('rejects 4 cards as straight (need minimum 5)', () => {
      // 4 cards could be a pair sequence, but not a straight
      expect(detectCombination([j(3), p(4), s(5), j(6)])?.type).not.toBe(CombinationType.Straight);
    });

    it('detects A-high straight (10-J-Q-K-A)', () => {
      const combo = detectCombination([j(10), p(11), s(12), j(13), p(14)]);
      expect(combo!.type).toBe(CombinationType.Straight);
      expect(combo!.rank).toBe(14);
    });
  });

  describe('Pair Sequences', () => {
    it('detects a 2-pair sequence', () => {
      const combo = detectCombination([j(5), p(5), j(6), p(6)]);
      expect(combo!.type).toBe(CombinationType.PairSequence);
      expect(combo!.rank).toBe(6);
      expect(combo!.length).toBe(2); // number of pairs
    });

    it('detects a 3-pair sequence', () => {
      const combo = detectCombination([j(8), p(8), j(9), p(9), j(10), p(10)]);
      expect(combo!.type).toBe(CombinationType.PairSequence);
      expect(combo!.rank).toBe(10);
      expect(combo!.length).toBe(3);
    });

    it('detects pair sequence with Phoenix', () => {
      // Pairs at 5, 6, 7 — Phoenix completes one pair
      const combo = detectCombination([j(5), phoenix(), j(6), p(6), j(7), p(7)]);
      expect(combo!.type).toBe(CombinationType.PairSequence);
      expect(combo!.rank).toBe(7);
      expect(combo!.length).toBe(3);
      expect(combo!.phoenixUsedAs).toBe(5);
    });

    it('rejects non-consecutive pairs', () => {
      expect(detectCombination([j(5), p(5), j(7), p(7)])).toBeNull();
    });

    it('rejects pair sequence with Mahjong', () => {
      expect(detectCombination([mahjong(), j(2), p(2), s(2)])).toBeNull();
    });
  });

  describe('Four-of-a-Kind Bombs', () => {
    it('detects four-of-a-kind bomb', () => {
      const combo = detectCombination([j(8), p(8), s(8), sw(8)]);
      expect(combo!.type).toBe(CombinationType.FourBomb);
      expect(combo!.rank).toBe(8);
      expect(combo!.isBomb).toBe(true);
    });

    it('detects bomb of Aces', () => {
      const combo = detectCombination([j(14), p(14), s(14), sw(14)]);
      expect(combo!.type).toBe(CombinationType.FourBomb);
      expect(combo!.rank).toBe(14);
      expect(combo!.isBomb).toBe(true);
    });

    // Phoenix NEVER forms a bomb
    it('rejects Phoenix in four-of-a-kind (3 same rank + Phoenix = null, not a valid 4-card combo)', () => {
      const combo = detectCombination([j(8), p(8), s(8), phoenix()]);
      // 4 cards: not a bomb (Phoenix excluded), not a pair sequence (not pairs),
      // not a straight (not consecutive). Triple requires exactly 3 cards. Returns null.
      expect(combo).toBeNull();
    });
  });

  describe('Straight Flush Bombs', () => {
    it('detects 5-card straight flush bomb', () => {
      const combo = detectCombination([
        std(0, Suit.Jade, 3),
        std(1, Suit.Jade, 4),
        std(2, Suit.Jade, 5),
        std(3, Suit.Jade, 6),
        std(4, Suit.Jade, 7),
      ]);
      expect(combo!.type).toBe(CombinationType.StraightFlushBomb);
      expect(combo!.rank).toBe(7);
      expect(combo!.length).toBe(5);
      expect(combo!.isBomb).toBe(true);
    });

    it('detects 6-card straight flush bomb', () => {
      const combo = detectCombination([
        std(0, Suit.Star, 8),
        std(1, Suit.Star, 9),
        std(2, Suit.Star, 10),
        std(3, Suit.Star, 11),
        std(4, Suit.Star, 12),
        std(5, Suit.Star, 13),
      ]);
      expect(combo!.type).toBe(CombinationType.StraightFlushBomb);
      expect(combo!.rank).toBe(13);
      expect(combo!.length).toBe(6);
    });

    it('rejects mixed-suit straight as bomb (returns regular straight)', () => {
      const combo = detectCombination([
        std(0, Suit.Jade, 3),
        std(1, Suit.Pagoda, 4),
        std(2, Suit.Jade, 5),
        std(3, Suit.Jade, 6),
        std(4, Suit.Jade, 7),
      ]);
      expect(combo!.type).toBe(CombinationType.Straight);
      expect(combo!.isBomb).toBe(false);
    });

    it('rejects Phoenix in straight flush', () => {
      const combo = detectCombination([
        std(0, Suit.Jade, 3),
        std(1, Suit.Jade, 4),
        phoenix(),
        std(3, Suit.Jade, 6),
        std(4, Suit.Jade, 7),
      ]);
      // Phoenix can't form bombs — should be a regular straight
      expect(combo!.type).toBe(CombinationType.Straight);
      expect(combo!.isBomb).toBe(false);
    });
  });

  describe('Invalid combinations', () => {
    it('rejects Dragon in multi-card combination', () => {
      expect(detectCombination([dragon(), j(5)])).toBeNull();
      expect(detectCombination([dragon(), j(5), p(5)])).toBeNull();
    });

    it('rejects Dog in multi-card combination', () => {
      expect(detectCombination([dog(), j(5)])).toBeNull();
      expect(detectCombination([dog(), j(5), p(5)])).toBeNull();
    });

    it('rejects random assortment of cards', () => {
      expect(detectCombination([j(2), p(5), s(9)])).toBeNull();
    });
  });

  describe('Edge cases — straight with Phoenix', () => {
    it('rejects Phoenix straight with two gaps', () => {
      // 3, _, 5, _, 7 — two gaps, Phoenix can only fill one
      expect(detectCombination([j(3), phoenix(), s(5), j(7), p(9)])).toBeNull();
    });

    it('rejects Phoenix straight with gap too large', () => {
      // 3, 4, 5, 6, 10 + Phoenix — gap from 6 to 10 is too large
      expect(detectCombination([j(3), p(4), s(5), j(6), p(10), phoenix()])).toBeNull();
    });

    it('detects straight with Phoenix extending below (rank 2 min)', () => {
      // 3, 4, 5, 6, Phoenix → Phoenix could be 2 or 7. Extends at top (7) by default.
      const combo = detectCombination([j(3), p(4), s(5), j(6), phoenix()]);
      expect(combo!.type).toBe(CombinationType.Straight);
      expect(combo!.rank).toBe(7);
    });

    it('detects Mahjong-started straight with Phoenix gap', () => {
      // Mahjong(1), _, 3, 4, 5 → Phoenix fills rank 2
      const combo = detectCombination([mahjong(), phoenix(), j(3), p(4), s(5)]);
      expect(combo!.type).toBe(CombinationType.Straight);
      expect(combo!.rank).toBe(5);
      expect(combo!.phoenixUsedAs).toBe(2);
    });
  });

  describe('Edge cases — pair sequences', () => {
    it('rejects odd number of cards as pair sequence', () => {
      // 5 cards can't be a pair sequence
      expect(detectCombination([j(5), p(5), j(6), p(6), s(7)])?.type).not.toBe(
        CombinationType.PairSequence,
      );
    });
  });
});

// --- detectAllBombs ---

describe('detectAllBombs', () => {
  // Verifies: REQ-F-BB01
  it('returns empty array for empty hand', () => {
    expect(detectAllBombs([])).toEqual([]);
  });

  // Verifies: REQ-F-BB01
  it('returns empty array for hand with no bombs', () => {
    const hand = [j(3), p(4), s(5), j(6), sw(7)];
    expect(detectAllBombs(hand)).toHaveLength(0);
  });

  // Verifies: REQ-F-BB01
  it('ignores special cards (Dragon, Phoenix, Dog, Mahjong)', () => {
    const hand = [dragon(), phoenix(), dog(), mahjong()];
    expect(detectAllBombs(hand)).toHaveLength(0);
  });

  // Verifies: REQ-F-BB08
  it('detects a four-of-a-kind bomb (exactly 4 cards)', () => {
    const hand = [j(9), p(9), s(9), sw(9)];
    const bombs = detectAllBombs(hand);
    expect(bombs).toHaveLength(1);
    expect(bombs[0].type).toBe(CombinationType.FourBomb);
    expect(bombs[0].rank).toBe(9);
    expect(bombs[0].cards).toHaveLength(4);
    expect(bombs[0].isBomb).toBe(true);
  });

  // Verifies: REQ-F-BB08
  it('uses exactly 4 cards for four-of-a-kind even if only 4 available', () => {
    const hand = [j(7), p(7), s(7), sw(7), j(8)];
    const bombs = detectAllBombs(hand);
    const fourBombs = bombs.filter((b) => b.type === CombinationType.FourBomb);
    expect(fourBombs).toHaveLength(1);
    expect(fourBombs[0].cards).toHaveLength(4);
  });

  // Verifies: REQ-F-BB01
  it('detects a straight-flush bomb (5 cards, same suit, consecutive)', () => {
    const hand = [j(5), j(6), j(7), j(8), j(9)];
    const bombs = detectAllBombs(hand);
    expect(bombs).toHaveLength(1);
    expect(bombs[0].type).toBe(CombinationType.StraightFlushBomb);
    expect(bombs[0].rank).toBe(9);
    expect(bombs[0].isBomb).toBe(true);
  });

  // Verifies: REQ-F-BB07
  it('enumerates sub-sequences of a 6-card straight flush', () => {
    // j(5)–j(10): contains [5-9], [6-10], [5-10] = 3 bombs
    const hand = [j(5), j(6), j(7), j(8), j(9), j(10)];
    const bombs = detectAllBombs(hand);
    expect(bombs).toHaveLength(3);
    expect(bombs.every((b) => b.type === CombinationType.StraightFlushBomb)).toBe(true);
  });

  // Verifies: REQ-F-BB07
  it('enumerates sub-sequences of a 7-card straight flush', () => {
    // 5..11: sub-sequences of length 5 = [5-9,6-10,7-11], length 6 = [5-10,6-11], length 7 = [5-11] → 6 bombs
    const hand = [j(5), j(6), j(7), j(8), j(9), j(10), j(11)];
    const bombs = detectAllBombs(hand);
    expect(bombs).toHaveLength(6);
  });

  // Verifies: REQ-F-BB01
  it('does not produce straight-flush bombs from mixed suits', () => {
    const hand = [j(5), p(6), s(7), sw(8), j(9)];
    expect(detectAllBombs(hand)).toHaveLength(0);
  });

  // Verifies: REQ-F-BB01
  it('detects both a four-bomb and a straight-flush bomb in the same hand', () => {
    const hand = [j(5), j(6), j(7), j(8), j(9), p(9), s(9), sw(9)];
    const bombs = detectAllBombs(hand);
    const fourBombs = bombs.filter((b) => b.type === CombinationType.FourBomb);
    const sfBombs = bombs.filter((b) => b.type === CombinationType.StraightFlushBomb);
    expect(fourBombs).toHaveLength(1);
    expect(sfBombs).toHaveLength(1);
  });

  // Verifies: REQ-F-BB07
  it('does not report a straight flush bomb for non-consecutive same-suit cards', () => {
    // j(5), j(7), j(8), j(9), j(10) — gap at 6
    const hand = [j(5), j(7), j(8), j(9), j(10)];
    expect(detectAllBombs(hand)).toHaveLength(0);
  });
});
