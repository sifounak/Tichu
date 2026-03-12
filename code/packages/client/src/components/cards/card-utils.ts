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

/** Sort rank for ordering cards in hand: Dog, Mahjong first; standard by suit+rank; Phoenix, Dragon last */
export function cardSortKey(card: Card): number {
  switch (card.kind) {
    case 'dog': return 0;
    case 'mahjong': return 1;
    case 'standard': {
      // Group by suit then rank: suit index * 20 + rank, offset to 100-179 range
      const suitOrder = { jade: 0, pagoda: 1, star: 2, sword: 3 };
      return 100 + suitOrder[card.suit] * 20 + card.rank;
    }
    case 'phoenix': return 200;
    case 'dragon': return 201;
  }
}
