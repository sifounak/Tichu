// Card display utilities: suit symbols, rank labels, colors
import { Suit, CombinationType, type Card, type GameCard, type Rank, type Combination } from '@tichu/shared';

/** Unicode suit symbols — REQ-NF-U05: symbols distinguish suits, not just color */
export const SUIT_SYMBOLS: Record<Suit, string> = {
  [Suit.Jade]: '🟢',   // Jade disc
  [Suit.Pagoda]: '🏯',  // Pagoda
  [Suit.Star]: '⭐',    // Star
  [Suit.Sword]: '⚔️',  // Crossed swords
};

/** Short suit labels for compact display */
export const SUIT_LABELS: Record<Suit, string> = {
  [Suit.Jade]: 'J',
  [Suit.Pagoda]: 'P',
  [Suit.Star]: 'S',
  [Suit.Sword]: 'W',
};

/** Rank display labels */
export const RANK_LABELS: Record<Rank, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7',
  8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

/** CSS color variable for a suit */
export function suitColor(suit: Suit): string {
  return `var(--color-suit-${suit})`;
}

/** CSS color variable for a special card */
export function specialColor(kind: 'dragon' | 'phoenix' | 'mahjong' | 'dog'): string {
  return `var(--color-special-${kind})`;
}

/** Special card display labels */
export const SPECIAL_LABELS: Record<string, string> = {
  dragon: 'Dr',
  phoenix: 'Ph',
  mahjong: '1',
  dog: 'Do',
};

/** Special card full names */
export const SPECIAL_NAMES: Record<string, string> = {
  dragon: 'Dragon',
  phoenix: 'Phoenix',
  mahjong: 'Mahjong',
  dog: 'Dog',
};

/** Get aria-label for a card — REQ-NF-U04: screen reader support */
export function cardAriaLabel(card: Card): string {
  if (card.kind === 'standard') {
    return `${RANK_LABELS[card.rank]} of ${card.suit}`;
  }
  return SPECIAL_NAMES[card.kind];
}

/**
 * Sort key for ordering cards in hand.
 * Ascending left-to-right: lowest-value cards on the left, highest on the right.
 * Order (left to right): Dog, Mahjong, 2…A by rank, Phoenix, Dragon
 *
 * Dog = 0 (leftmost), standard cards by ascending rank,
 * Dragon = 16 (rightmost).
 */
export function cardSortKey(card: Card): number {
  switch (card.kind) {
    case 'dog': return 0;               // leftmost (lowest value)
    case 'mahjong': return 1;           // after dog, before 2s
    case 'standard': {
      // Rank 2 → key 2, Rank 14 (Ace) → key 14; within same rank, break tie by suit
      const suitTie = { jade: 0.1, pagoda: 0.2, star: 0.3, sword: 0.4 };
      return 2 + (card.rank - 2) + suitTie[card.suit];
    }
    case 'phoenix': return 15;          // after aces, before dragon
    case 'dragon': return 16;           // rightmost (highest value)
  }
}

/** Get the effective rank of a card, using phoenixUsedAs for Phoenix */
function effectiveRank(gc: GameCard, phoenixUsedAs?: Rank): number {
  if (gc.card.kind === 'standard') return gc.card.rank;
  if (gc.card.kind === 'mahjong') return 1;
  if (gc.card.kind === 'phoenix' && phoenixUsedAs !== undefined) return phoenixUsedAs;
  return 0;
}

/**
 * Sort combination cards for display in the trick area.
 *
 * - Full House: 3-of-a-kind on the left, pair on the right
 * - Straight / Straight Flush Bomb: ascending rank; Phoenix in its substituted slot
 * - Pair Sequence: ascending rank; Phoenix after its duplicate card
 * - Pair / Triple: ascending rank sort with Phoenix placed by its substituted rank
 * - Single / Four Bomb: no reordering needed
 */
export function sortCombinationForDisplay(combo: Combination): GameCard[] {
  const { type, cards, phoenixUsedAs } = combo;

  if (cards.length <= 1) return cards;

  const phoenixIdx = cards.findIndex((gc) => gc.card.kind === 'phoenix');
  const hasPhoenix = phoenixIdx >= 0;

  switch (type) {
    case CombinationType.FullHouse: {
      // Group by rank, 3-of-a-kind first (left), pair second (right)
      const nonPhoenix = cards.filter((gc) => gc.card.kind !== 'phoenix');
      const rankCounts = new Map<number, GameCard[]>();
      for (const gc of nonPhoenix) {
        const r = effectiveRank(gc, phoenixUsedAs);
        const arr = rankCounts.get(r) ?? [];
        arr.push(gc);
        rankCounts.set(r, arr);
      }

      let tripleCards: GameCard[] = [];
      let pairCards: GameCard[] = [];

      if (hasPhoenix && phoenixUsedAs !== undefined) {
        // Phoenix completes either the triple or the pair
        // Find which group has 2 cards and which has 1 — Phoenix fills the smaller
        for (const [rank, group] of rankCounts) {
          if (group.length === 3) {
            tripleCards = group;
          } else if (group.length === 2) {
            // Check if Phoenix is completing this to a triple or if it's the pair
            if (rank === phoenixUsedAs && tripleCards.length === 0) {
              // Phoenix makes this group a triple
              tripleCards = [...group, cards[phoenixIdx]];
            } else {
              pairCards = group;
            }
          } else if (group.length === 1) {
            if (rank === phoenixUsedAs) {
              pairCards = [...group, cards[phoenixIdx]];
            } else {
              pairCards = group;
            }
          }
        }
        // Fallback: if we still don't have both groups assigned
        if (tripleCards.length === 0 || pairCards.length === 0) {
          const groups = [...rankCounts.values()].sort((a, b) => b.length - a.length);
          if (groups.length >= 2) {
            const bigger = groups[0];
            const smaller = groups[1];
            if (bigger.length === 2 && smaller.length === 2) {
              // 2+2+phoenix: phoenix completes one to triple
              tripleCards = [...rankCounts.get(phoenixUsedAs)!, cards[phoenixIdx]];
              pairCards = [...rankCounts.values()].find(
                (g) => effectiveRank(g[0], phoenixUsedAs) !== phoenixUsedAs,
              )!;
            } else {
              tripleCards = bigger;
              pairCards = [...smaller, cards[phoenixIdx]];
            }
          }
        }
      } else {
        // No phoenix — straightforward grouping
        for (const group of rankCounts.values()) {
          if (group.length === 3) tripleCards = group;
          else if (group.length === 2) pairCards = group;
        }
      }

      return [...tripleCards, ...pairCards];
    }

    case CombinationType.Straight:
    case CombinationType.StraightFlushBomb: {
      // Sort by ascending rank; Phoenix goes in its phoenixUsedAs slot
      const sorted = [...cards].sort((a, b) => {
        const ra = effectiveRank(a, phoenixUsedAs);
        const rb = effectiveRank(b, phoenixUsedAs);
        if (ra !== rb) return ra - rb;
        // If same effective rank (shouldn't happen in a straight, but safety):
        // put standard card before phoenix
        if (a.card.kind === 'phoenix') return 1;
        if (b.card.kind === 'phoenix') return -1;
        return 0;
      });
      return sorted;
    }

    case CombinationType.PairSequence: {
      // Sort ascending by rank; within each pair, Phoenix goes after its duplicate
      const sorted = [...cards].sort((a, b) => {
        const ra = effectiveRank(a, phoenixUsedAs);
        const rb = effectiveRank(b, phoenixUsedAs);
        if (ra !== rb) return ra - rb;
        // Same rank: put standard card before phoenix
        if (a.card.kind === 'phoenix') return 1;
        if (b.card.kind === 'phoenix') return -1;
        return 0;
      });
      return sorted;
    }

    case CombinationType.Pair:
    case CombinationType.Triple: {
      // Phoenix at the end of the group
      if (!hasPhoenix) return cards;
      const nonPhoenix = cards.filter((gc) => gc.card.kind !== 'phoenix');
      return [...nonPhoenix, cards[phoenixIdx]];
    }

    case CombinationType.FourBomb:
    case CombinationType.Single:
    default:
      return cards;
  }
}
