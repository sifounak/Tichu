// REQ-F-CB06: Enumerate all valid plays from a hand

import type { GameCard, Rank } from '../types/card.js';
import { isStandard, isPhoenix, isDog, isMahjong } from '../types/card.js';
import { ALL_RANKS } from '../types/card.js';
import type { Combination } from '../types/combination.js';
import { detectCombination } from './combination-detector.js';
import { canBeat } from './combination-validator.js';

/**
 * REQ-F-CB06: Get all valid plays from a hand that can beat the current trick.
 *
 * If currentTrick is null, returns all possible leading combinations.
 * If currentTrick is set, returns only combinations that can beat it.
 *
 * This is a brute-force approach that generates all subsets up to a reasonable
 * size. For performance in Milestone 5, a smarter hand-filter will replace this.
 */
export function getAllValidPlays(
  hand: GameCard[],
  currentTrick: Combination | null,
): Combination[] {
  const validPlays: Combination[] = [];
  const seen = new Set<string>();

  // Generate all candidate subsets and test them
  const candidates = generateCandidateSubsets(hand);

  for (const subset of candidates) {
    const combo = detectCombination(subset);
    if (combo === null) continue;

    // Dog can only lead, and only when there's no current trick
    if (isDog(subset[0].card) && subset.length === 1 && currentTrick !== null) continue;

    if (!canBeat(combo, currentTrick)) continue;

    // Deduplicate by type + rank + length + phoenixUsedAs + card IDs
    const key = makeKey(combo);
    if (seen.has(key)) continue;
    seen.add(key);

    validPlays.push(combo);
  }

  return validPlays;
}

function makeKey(combo: Combination): string {
  const cardIds = combo.cards
    .map((c) => c.id)
    .sort((a, b) => a - b)
    .join(',');
  return `${combo.type}:${combo.rank}:${combo.length}:${cardIds}`;
}

/**
 * Generate candidate card subsets from a hand.
 * We generate subsets of sizes 1 through min(hand.length, 14).
 * For efficiency, we use targeted generation rather than full power set.
 */
function generateCandidateSubsets(hand: GameCard[]): GameCard[][] {
  const results: GameCard[][] = [];

  // Singles
  for (const card of hand) {
    results.push([card]);
  }

  // Group standard cards by rank
  const byRank = new Map<Rank, GameCard[]>();
  const specials: GameCard[] = [];

  for (const gc of hand) {
    if (isStandard(gc.card)) {
      const r = gc.card.rank;
      if (!byRank.has(r)) byRank.set(r, []);
      byRank.get(r)!.push(gc);
    } else {
      specials.push(gc);
    }
  }

  const phoenix = specials.find((gc) => isPhoenix(gc.card));
  const mahjong = specials.find((gc) => isMahjong(gc.card));
  const sortedRanks = [...byRank.keys()].sort((a, b) => a - b);

  // Pairs (all combinations of 2 cards at the same rank)
  for (const [, cards] of byRank) {
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        results.push([cards[i], cards[j]]);
      }
      // Phoenix pairs
      if (phoenix) {
        results.push([cards[i], phoenix]);
      }
    }
  }

  // Triples (all combinations of 3 cards at the same rank)
  for (const [, cards] of byRank) {
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        for (let k = j + 1; k < cards.length; k++) {
          results.push([cards[i], cards[j], cards[k]]);
        }
        // Phoenix triples
        if (phoenix) {
          results.push([cards[i], cards[j], phoenix]);
        }
      }
    }
  }

  // Four-of-a-kind bombs (no Phoenix)
  for (const [, cards] of byRank) {
    if (cards.length === 4) {
      results.push([...cards]);
    }
  }

  // Full houses: triple + pair
  generateFullHouses(byRank, phoenix, results);

  // Straights (5+ consecutive)
  generateStraights(sortedRanks, byRank, phoenix, mahjong, results);

  // Pair sequences (2+ consecutive pairs)
  generatePairSequences(sortedRanks, byRank, phoenix, results);

  // Straight flush bombs (5+ consecutive same suit)
  generateStraightFlushBombs(hand, results);

  return results;
}

function generateFullHouses(
  byRank: Map<Rank, GameCard[]>,
  phoenix: GameCard | undefined,
  results: GameCard[][],
): void {
  const ranks = [...byRank.keys()];

  for (const tripleRank of ranks) {
    const tripleCards = byRank.get(tripleRank)!;
    // Get all triple combinations at this rank
    const tripleCombos: GameCard[][] = [];
    if (tripleCards.length >= 3) {
      for (let i = 0; i < tripleCards.length; i++) {
        for (let j = i + 1; j < tripleCards.length; j++) {
          for (let k = j + 1; k < tripleCards.length; k++) {
            tripleCombos.push([tripleCards[i], tripleCards[j], tripleCards[k]]);
          }
        }
      }
    }
    // Phoenix triples
    if (phoenix && tripleCards.length >= 2) {
      for (let i = 0; i < tripleCards.length; i++) {
        for (let j = i + 1; j < tripleCards.length; j++) {
          tripleCombos.push([tripleCards[i], tripleCards[j], phoenix]);
        }
      }
    }

    for (const pairRank of ranks) {
      if (pairRank === tripleRank) continue;
      const pairCards = byRank.get(pairRank)!;

      // All pair combinations at this rank
      const pairCombos: GameCard[][] = [];
      if (pairCards.length >= 2) {
        for (let i = 0; i < pairCards.length; i++) {
          for (let j = i + 1; j < pairCards.length; j++) {
            pairCombos.push([pairCards[i], pairCards[j]]);
          }
        }
      }
      // Phoenix pair (only if not used in triple)
      if (phoenix && pairCards.length >= 1) {
        for (const pc of pairCards) {
          pairCombos.push([pc, phoenix]);
        }
      }

      // Combine triples and pairs (avoiding double-use of Phoenix)
      for (const triple of tripleCombos) {
        const tripleHasPhoenix = triple.some((gc) => isPhoenix(gc.card));
        for (const pair of pairCombos) {
          const pairHasPhoenix = pair.some((gc) => isPhoenix(gc.card));
          if (tripleHasPhoenix && pairHasPhoenix) continue; // can't use Phoenix twice
          results.push([...triple, ...pair]);
        }
      }
    }
  }
}

function generateStraights(
  sortedRanks: Rank[],
  byRank: Map<Rank, GameCard[]>,
  phoenix: GameCard | undefined,
  mahjong: GameCard | undefined,
  results: GameCard[][],
): void {
  // Build available ranks including Mahjong as rank 1
  const availableRanks: number[] = mahjong ? [1, ...sortedRanks] : [...sortedRanks];
  const uniqueAvailable = [...new Set(availableRanks)].sort((a, b) => a - b);

  // Try all starting positions and lengths (5+)
  for (let startIdx = 0; startIdx < uniqueAvailable.length; startIdx++) {
    for (let len = 5; len <= uniqueAvailable.length - startIdx + (phoenix ? 1 : 0); len++) {
      generateStraightsOfLength(
        uniqueAvailable,
        startIdx,
        len,
        byRank,
        phoenix,
        mahjong,
        results,
      );
    }
  }
}

function generateStraightsOfLength(
  availableRanks: number[],
  startIdx: number,
  length: number,
  byRank: Map<Rank, GameCard[]>,
  phoenix: GameCard | undefined,
  mahjong: GameCard | undefined,
  results: GameCard[][],
): void {
  const startRank = availableRanks[startIdx];
  let gapsUsed = 0;
  const rankSlots: Array<{ rank: number; cards: GameCard[] }> = [];

  for (let i = 0; i < length; i++) {
    const targetRank = startRank + i;
    if (targetRank > 14) return; // Can't go above Ace

    if (targetRank === 1) {
      // Mahjong
      if (mahjong) {
        rankSlots.push({ rank: 1, cards: [mahjong] });
      } else {
        gapsUsed++;
        if (gapsUsed > 1 || !phoenix) return;
        rankSlots.push({ rank: 1, cards: [] }); // Phoenix fills this
      }
    } else {
      const cardsAtRank = byRank.get(targetRank as Rank);
      if (cardsAtRank && cardsAtRank.length > 0) {
        rankSlots.push({ rank: targetRank, cards: cardsAtRank });
      } else {
        gapsUsed++;
        if (gapsUsed > 1 || !phoenix) return;
        rankSlots.push({ rank: targetRank, cards: [] }); // Phoenix fills this
      }
    }
  }

  if (gapsUsed > (phoenix ? 1 : 0)) return;

  // If Phoenix is used to fill a gap, generate combinations with Phoenix at the gap position
  // If no gap, generate without Phoenix (and optionally with Phoenix if it extends)
  const gapIdx = rankSlots.findIndex((s) => s.cards.length === 0);

  if (gapIdx >= 0) {
    // Phoenix fills the gap
    generateStraightCombos(rankSlots, gapIdx, phoenix!, results);
  } else {
    // No gap — generate all card combos at each rank (pick 1 per rank)
    generateStraightCombosNoGap(rankSlots, results);
  }
}

function generateStraightCombos(
  rankSlots: Array<{ rank: number; cards: GameCard[] }>,
  gapIdx: number,
  phoenix: GameCard,
  results: GameCard[][],
): void {
  // Pick one card from each non-gap slot, Phoenix at the gap
  const slots = rankSlots.map((s, i) => (i === gapIdx ? [phoenix] : s.cards));
  cartesianProduct(slots, results);
}

function generateStraightCombosNoGap(
  rankSlots: Array<{ rank: number; cards: GameCard[] }>,
  results: GameCard[][],
): void {
  const slots = rankSlots.map((s) => s.cards);
  cartesianProduct(slots, results);
}

function cartesianProduct(slots: GameCard[][], results: GameCard[][]): void {
  const current: GameCard[] = [];

  function recurse(depth: number): void {
    if (depth === slots.length) {
      results.push([...current]);
      return;
    }
    for (const card of slots[depth]) {
      current.push(card);
      recurse(depth + 1);
      current.pop();
    }
  }

  recurse(0);
}

function generatePairSequences(
  sortedRanks: Rank[],
  byRank: Map<Rank, GameCard[]>,
  phoenix: GameCard | undefined,
  results: GameCard[][],
): void {
  // Try all starting ranks and lengths (2+ pairs)
  for (let startIdx = 0; startIdx < sortedRanks.length; startIdx++) {
    for (let numPairs = 2; numPairs <= sortedRanks.length - startIdx + (phoenix ? 1 : 0); numPairs++) {
      generatePairSeqOfLength(sortedRanks, startIdx, numPairs, byRank, phoenix, results);
    }
  }
}

function generatePairSeqOfLength(
  sortedRanks: Rank[],
  startIdx: number,
  numPairs: number,
  byRank: Map<Rank, GameCard[]>,
  phoenix: GameCard | undefined,
  results: GameCard[][],
): void {
  const startRank = sortedRanks[startIdx];
  let phoenixNeeded = false;

  const pairSlots: Array<{ rank: Rank; pairs: GameCard[][] }> = [];

  for (let i = 0; i < numPairs; i++) {
    const targetRank = (startRank + i) as Rank;
    if (targetRank > 14) return;
    if (!ALL_RANKS.includes(targetRank)) return;

    const cardsAtRank = byRank.get(targetRank);
    if (!cardsAtRank || cardsAtRank.length === 0) {
      // Can't form a pair here at all
      return;
    }

    const pairs: GameCard[][] = [];

    // Natural pairs
    if (cardsAtRank.length >= 2) {
      for (let a = 0; a < cardsAtRank.length; a++) {
        for (let b = a + 1; b < cardsAtRank.length; b++) {
          pairs.push([cardsAtRank[a], cardsAtRank[b]]);
        }
      }
    }

    // Phoenix pair
    if (phoenix && cardsAtRank.length >= 1) {
      for (const c of cardsAtRank) {
        pairs.push([c, phoenix]);
      }
    }

    if (pairs.length === 0) return;

    // Check if we need Phoenix for this slot
    const hasNaturalPair = cardsAtRank.length >= 2;
    if (!hasNaturalPair) {
      if (phoenixNeeded) return; // Can't use Phoenix twice
      phoenixNeeded = true;
    }

    pairSlots.push({ rank: targetRank, pairs });
  }

  // Generate all combinations, ensuring Phoenix is used at most once
  generatePairSeqCombos(pairSlots, phoenix, results);
}

function generatePairSeqCombos(
  pairSlots: Array<{ rank: Rank; pairs: GameCard[][] }>,
  phoenix: GameCard | undefined,
  results: GameCard[][],
): void {
  const current: GameCard[] = [];

  function recurse(depth: number, phoenixUsed: boolean): void {
    if (depth === pairSlots.length) {
      results.push([...current]);
      return;
    }
    for (const pair of pairSlots[depth].pairs) {
      const pairUsesPhoenix = phoenix !== undefined && pair.some((gc) => isPhoenix(gc.card));
      if (pairUsesPhoenix && phoenixUsed) continue;
      current.push(...pair);
      recurse(depth + 1, phoenixUsed || pairUsesPhoenix);
      current.splice(current.length - 2, 2);
    }
  }

  recurse(0, false);
}

function generateStraightFlushBombs(hand: GameCard[], results: GameCard[][]): void {
  // Group by suit
  const bySuit = new Map<string, GameCard[]>();
  for (const gc of hand) {
    if (isStandard(gc.card)) {
      const suit = gc.card.suit;
      if (!bySuit.has(suit)) bySuit.set(suit, []);
      bySuit.get(suit)!.push(gc);
    }
  }

  for (const [, suitCards] of bySuit) {
    const ranks = suitCards
      .map((gc) => ({ gc, rank: (gc.card as { rank: Rank }).rank }))
      .sort((a, b) => a.rank - b.rank);

    // Find all consecutive runs of length 5+
    for (let start = 0; start < ranks.length; start++) {
      const run: GameCard[] = [ranks[start].gc];
      for (let j = start + 1; j < ranks.length; j++) {
        if (ranks[j].rank - ranks[j - 1].rank !== 1) break;
        run.push(ranks[j].gc);
        if (run.length >= 5) {
          results.push([...run]);
        }
      }
    }
  }
}
