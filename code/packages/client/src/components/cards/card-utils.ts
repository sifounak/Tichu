// Card display utilities: suit symbols, rank labels, colors
import { Suit, type Card, type Rank } from '@tichu/shared';

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
