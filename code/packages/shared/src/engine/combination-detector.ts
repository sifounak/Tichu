// REQ-F-CB01: Detect all combination types
// REQ-F-CB03: Dragon only as single
// REQ-F-CB04: Dog only as lead (not a combination to beat)
// REQ-F-CB05: Mahjong rank 1 in straights

import type { GameCard, Rank } from '../types/card.js';
import { isPhoenix, isDragon, isDog, isMahjong, isStandard } from '../types/card.js';
import type { Combination } from '../types/combination.js';
import { CombinationType } from '../types/combination.js';
import { MAHJONG_RANK, DRAGON_RANK, PHOENIX_SINGLE_VALUE } from '../constants.js';

/**
 * REQ-F-CB01: Detect what combination a set of cards forms.
 * Returns null if the cards do not form a valid combination.
 *
 * Phoenix can substitute in non-bomb combinations.
 * Phoenix NEVER forms a bomb (REQ-F-PH01 — enforced here as a foundation).
 */
export function detectCombination(cards: GameCard[]): Combination | null {
  if (cards.length === 0) return null;

  if (cards.length === 1) return detectSingle(cards);

  // Check for bombs first (Phoenix never participates)
  const bomb = detectBomb(cards);
  if (bomb) return bomb;

  if (cards.length === 2) return detectPair(cards);
  if (cards.length === 3) return detectTriple(cards);
  if (cards.length === 5) {
    // Could be full house, straight, or pair sequence (though 2-pair seq needs 4 cards)
    return detectFullHouse(cards) ?? detectStraight(cards);
  }
  if (cards.length === 4) {
    // Could be pair sequence (2 consecutive pairs)
    return detectPairSequence(cards) ?? detectStraight(cards);
  }
  // 6+ cards: straight or pair sequence
  if (cards.length >= 6) {
    return detectPairSequence(cards) ?? detectStraight(cards);
  }

  return null;
}

// --- Single ---

function detectSingle(cards: GameCard[]): Combination | null {
  const card = cards[0].card;

  // Dog is a special lead action, not a "combination" that beats others
  if (isDog(card)) {
    return {
      type: CombinationType.Single,
      cards,
      rank: 0,
      length: 1,
      isBomb: false,
    };
  }

  if (isDragon(card)) {
    return {
      type: CombinationType.Single,
      cards,
      rank: DRAGON_RANK,
      length: 1,
      isBomb: false,
    };
  }

  if (isPhoenix(card)) {
    return {
      type: CombinationType.Single,
      cards,
      rank: PHOENIX_SINGLE_VALUE,
      length: 1,
      isBomb: false,
    };
  }

  if (isMahjong(card)) {
    return {
      type: CombinationType.Single,
      cards,
      rank: MAHJONG_RANK,
      length: 1,
      isBomb: false,
    };
  }

  // Standard card
  return {
    type: CombinationType.Single,
    cards,
    rank: card.rank,
    length: 1,
    isBomb: false,
  };
}

// --- Pair ---

function detectPair(cards: GameCard[]): Combination | null {
  if (cards.length !== 2) return null;

  const hasPhoenix = cards.some((gc) => isPhoenix(gc.card));
  const standards = cards.filter((gc) => isStandard(gc.card));

  // Dragon, Dog, Mahjong cannot form pairs
  if (cards.some((gc) => isDragon(gc.card) || isDog(gc.card) || isMahjong(gc.card))) {
    return null;
  }

  if (hasPhoenix) {
    // Phoenix + 1 standard card = pair at that rank
    if (standards.length !== 1) return null;
    const rank = (standards[0].card as { rank: Rank }).rank;
    return {
      type: CombinationType.Pair,
      cards,
      rank,
      length: 1,
      phoenixUsedAs: rank,
      isBomb: false,
    };
  }

  // Two standard cards of the same rank
  if (standards.length !== 2) return null;
  const r0 = (standards[0].card as { rank: Rank }).rank;
  const r1 = (standards[1].card as { rank: Rank }).rank;
  if (r0 !== r1) return null;

  return {
    type: CombinationType.Pair,
    cards,
    rank: r0,
    length: 1,
    isBomb: false,
  };
}

// --- Triple ---

function detectTriple(cards: GameCard[]): Combination | null {
  if (cards.length !== 3) return null;

  const hasPhoenix = cards.some((gc) => isPhoenix(gc.card));
  const standards = cards.filter((gc) => isStandard(gc.card));

  // No Dragon, Dog, Mahjong in triples
  if (cards.some((gc) => isDragon(gc.card) || isDog(gc.card) || isMahjong(gc.card))) {
    return null;
  }

  if (hasPhoenix) {
    // Phoenix + 2 standard cards of the same rank
    if (standards.length !== 2) return null;
    const r0 = (standards[0].card as { rank: Rank }).rank;
    const r1 = (standards[1].card as { rank: Rank }).rank;
    if (r0 !== r1) return null;
    return {
      type: CombinationType.Triple,
      cards,
      rank: r0,
      length: 1,
      phoenixUsedAs: r0,
      isBomb: false,
    };
  }

  // Three standard cards of the same rank
  if (standards.length !== 3) return null;
  const ranks = standards.map((gc) => (gc.card as { rank: Rank }).rank);
  if (ranks[0] !== ranks[1] || ranks[1] !== ranks[2]) return null;

  return {
    type: CombinationType.Triple,
    cards,
    rank: ranks[0],
    length: 1,
    isBomb: false,
  };
}

// --- Full House ---

function detectFullHouse(cards: GameCard[]): Combination | null {
  if (cards.length !== 5) return null;

  const hasPhoenix = cards.some((gc) => isPhoenix(gc.card));
  const standards = cards.filter((gc) => isStandard(gc.card));

  // No Dragon, Dog, Mahjong in full houses
  if (cards.some((gc) => isDragon(gc.card) || isDog(gc.card) || isMahjong(gc.card))) {
    return null;
  }

  const expectedStandards = hasPhoenix ? 4 : 5;
  if (standards.length !== expectedStandards) return null;

  // Count ranks
  const rankCounts = new Map<Rank, number>();
  for (const gc of standards) {
    const r = (gc.card as { rank: Rank }).rank;
    rankCounts.set(r, (rankCounts.get(r) ?? 0) + 1);
  }

  if (hasPhoenix) {
    // Possible configurations with Phoenix completing the full house:
    // 3+1+Phoenix: Phoenix completes the pair → triple is the rank
    // 2+2+Phoenix: Phoenix joins one of the pairs to form a triple → higher rank is the triple
    const entries = [...rankCounts.entries()];

    if (entries.length === 2) {
      const [e0, e1] = entries;
      // 3+1: Phoenix completes the pair side
      if (e0[1] === 3 && e1[1] === 1) {
        return {
          type: CombinationType.FullHouse,
          cards,
          rank: e0[0],
          length: 1,
          phoenixUsedAs: e1[0],
          isBomb: false,
        };
      }
      if (e0[1] === 1 && e1[1] === 3) {
        return {
          type: CombinationType.FullHouse,
          cards,
          rank: e1[0],
          length: 1,
          phoenixUsedAs: e0[0],
          isBomb: false,
        };
      }
      // 2+2: Phoenix makes higher rank the triple
      if (e0[1] === 2 && e1[1] === 2) {
        const tripleRank = Math.max(e0[0], e1[0]) as Rank;
        return {
          type: CombinationType.FullHouse,
          cards,
          rank: tripleRank,
          length: 1,
          phoenixUsedAs: tripleRank,
          isBomb: false,
        };
      }
    }
    // 4+Phoenix is not a valid full house (would be 4-of-a-kind + phoenix, not FH)
    return null;
  }

  // Without Phoenix: exactly one rank with count 3 and one with count 2
  if (rankCounts.size !== 2) return null;
  const entries = [...rankCounts.entries()];
  const tripleEntry = entries.find((e) => e[1] === 3);
  const pairEntry = entries.find((e) => e[1] === 2);
  if (!tripleEntry || !pairEntry) return null;

  return {
    type: CombinationType.FullHouse,
    cards,
    rank: tripleEntry[0],
    length: 1,
    isBomb: false,
  };
}

// --- Straight ---

/**
 * Get the effective rank of a card for straight detection.
 * Returns the rank number, or null if the card can't be in a straight.
 */
function getStraightRank(gc: GameCard): number | null {
  const card = gc.card;
  if (isStandard(card)) return card.rank;
  if (isMahjong(card)) return MAHJONG_RANK; // rank 1
  // Dragon, Dog, Phoenix handled separately
  return null;
}

function detectStraight(cards: GameCard[]): Combination | null {
  if (cards.length < 5) return null;

  const hasPhoenix = cards.some((gc) => isPhoenix(gc.card));
  // Dragon and Dog cannot appear in straights
  if (cards.some((gc) => isDragon(gc.card) || isDog(gc.card))) return null;

  const nonPhoenix = cards.filter((gc) => !isPhoenix(gc.card));
  const ranks = nonPhoenix.map((gc) => getStraightRank(gc));

  // All non-phoenix cards must have valid straight ranks
  if (ranks.some((r) => r === null)) return null;
  const validRanks = ranks as number[];

  // Check for duplicate ranks (no duplicates in a straight)
  if (new Set(validRanks).size !== validRanks.length) return null;

  const sorted = [...validRanks].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const expectedLength = cards.length;

  // With Phoenix, it fills exactly one gap
  if (hasPhoenix) {
    const span = max - min + 1;
    // Phoenix fills one gap, so span should equal expectedLength
    // and we have expectedLength - 1 non-phoenix cards
    if (nonPhoenix.length !== expectedLength - 1) return null;
    if (span !== expectedLength && span !== expectedLength - 1) return null;

    if (span === expectedLength - 1) {
      // Phoenix extends the straight (at top or bottom)
      // But rank can't go below 1 (Mahjong) or above 14 (Ace)
      // Try extending at top
      if (max + 1 <= 14) {
        return {
          type: CombinationType.Straight,
          cards,
          rank: max + 1,
          length: expectedLength,
          phoenixUsedAs: (max + 1) as Rank,
          isBomb: false,
        };
      }
      // Try extending at bottom (but not below 1)
      if (min - 1 >= 1) {
        // If extending below 2, the Phoenix would be at rank 1 (Mahjong position)
        // Phoenix can act as rank 1 in a straight? Per spec: Phoenix >= 2 in combinations (REQ-F-PH03)
        // Actually REQ-F-PH03 is for M4. For now, allow extension at bottom only if >= 2
        if (min - 1 >= 2) {
          return {
            type: CombinationType.Straight,
            cards,
            rank: max,
            length: expectedLength,
            phoenixUsedAs: (min - 1) as Rank,
            isBomb: false,
          };
        }
      }
      return null;
    }

    if (span === expectedLength) {
      // Phoenix fills an internal gap — find it
      let gapRank: number | null = null;
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i + 1] - sorted[i] === 2) {
          if (gapRank !== null) return null; // more than one gap
          gapRank = sorted[i] + 1;
        } else if (sorted[i + 1] - sorted[i] !== 1) {
          return null; // gap too large
        }
      }
      if (gapRank === null) return null;

      return {
        type: CombinationType.Straight,
        cards,
        rank: max,
        length: expectedLength,
        phoenixUsedAs: gapRank as Rank,
        isBomb: false,
      };
    }

    return null;
  }

  // Without Phoenix: all ranks must be consecutive
  if (validRanks.length !== expectedLength) return null;
  const span = max - min + 1;
  if (span !== expectedLength) return null;

  // Check all suits — if all same suit, it's a straight flush bomb (handled by detectBomb)
  // Here we return a regular straight
  return {
    type: CombinationType.Straight,
    cards,
    rank: max,
    length: expectedLength,
    isBomb: false,
  };
}

// --- Pair Sequence ---

function detectPairSequence(cards: GameCard[]): Combination | null {
  if (cards.length < 4 || cards.length % 2 !== 0) return null;

  const hasPhoenix = cards.some((gc) => isPhoenix(gc.card));
  // No Dragon, Dog, Mahjong in pair sequences
  if (cards.some((gc) => isDragon(gc.card) || isDog(gc.card) || isMahjong(gc.card))) {
    return null;
  }

  const standards = cards.filter((gc) => isStandard(gc.card));
  const expectedStandards = hasPhoenix ? cards.length - 1 : cards.length;
  if (standards.length !== expectedStandards) return null;

  const numPairs = cards.length / 2;

  // Count ranks
  const rankCounts = new Map<Rank, number>();
  for (const gc of standards) {
    const r = (gc.card as { rank: Rank }).rank;
    rankCounts.set(r, (rankCounts.get(r) ?? 0) + 1);
  }

  if (hasPhoenix) {
    // Phoenix completes one pair: we should have numPairs distinct ranks,
    // numPairs-1 of them with count 2 and one with count 1
    const entries = [...rankCounts.entries()].sort((a, b) => a[0] - b[0]);
    const singles = entries.filter((e) => e[1] === 1);
    const pairs = entries.filter((e) => e[1] === 2);

    if (singles.length !== 1 || pairs.length !== numPairs - 1) return null;

    // All ranks must be consecutive
    const allRanks = entries.map((e) => e[0]).sort((a, b) => a - b);
    if (allRanks.length !== numPairs) return null;
    for (let i = 1; i < allRanks.length; i++) {
      if (allRanks[i] - allRanks[i - 1] !== 1) return null;
    }

    const maxRank = allRanks[allRanks.length - 1];
    return {
      type: CombinationType.PairSequence,
      cards,
      rank: maxRank,
      length: numPairs,
      phoenixUsedAs: singles[0][0],
      isBomb: false,
    };
  }

  // Without Phoenix: all ranks must have count 2 and be consecutive
  const entries = [...rankCounts.entries()].sort((a, b) => a[0] - b[0]);
  if (entries.length !== numPairs) return null;
  if (entries.some((e) => e[1] !== 2)) return null;

  for (let i = 1; i < entries.length; i++) {
    if (entries[i][0] - entries[i - 1][0] !== 1) return null;
  }

  const maxRank = entries[entries.length - 1][0];
  return {
    type: CombinationType.PairSequence,
    cards,
    rank: maxRank,
    length: numPairs,
    isBomb: false,
  };
}

// --- Bombs ---

function detectBomb(cards: GameCard[]): Combination | null {
  // Phoenix NEVER forms a bomb
  if (cards.some((gc) => isPhoenix(gc.card))) return null;

  return detectFourBomb(cards) ?? detectStraightFlushBomb(cards);
}

function detectFourBomb(cards: GameCard[]): Combination | null {
  if (cards.length !== 4) return null;

  // All must be standard cards of the same rank
  if (!cards.every((gc) => isStandard(gc.card))) return null;
  const ranks = cards.map((gc) => (gc.card as { rank: Rank }).rank);
  if (new Set(ranks).size !== 1) return null;

  return {
    type: CombinationType.FourBomb,
    cards,
    rank: ranks[0],
    length: 4,
    isBomb: true,
  };
}

function detectStraightFlushBomb(cards: GameCard[]): Combination | null {
  if (cards.length < 5) return null;

  // All must be standard cards, or Mahjong can participate (rank 1, no suit)
  // Actually, Mahjong has no suit, so it can't be in a straight flush
  if (!cards.every((gc) => isStandard(gc.card))) return null;

  // All same suit
  const suits = cards.map((gc) => (gc.card as { suit: string }).suit);
  if (new Set(suits).size !== 1) return null;

  // Consecutive ranks
  const ranks = cards.map((gc) => (gc.card as { rank: Rank }).rank).sort((a, b) => a - b);
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] - ranks[i - 1] !== 1) return null;
  }

  return {
    type: CombinationType.StraightFlushBomb,
    cards,
    rank: ranks[ranks.length - 1],
    length: cards.length,
    isBomb: true,
  };
}
