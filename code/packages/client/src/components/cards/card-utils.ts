// Card display utilities: suit symbols, rank labels, colors
import { Suit, CombinationType, type Card, type GameCard, type Rank, type Combination, type CardOrder, type CardOverlap } from '@tichu/shared';

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

/** Ascending display key: Dog, Mahjong, 2 through Ace, Phoenix, Dragon; ties use suit. */
export function cardSortKey(card: Card): number {
  switch (card.kind) {
    case 'dog': return 0;               // lowest display value
    case 'mahjong': return 1;           // after dog, before 2s
    case 'standard': {
      // Rank 2 → key 2, Rank 14 (Ace) → key 14; within same rank, break tie by suit
      const suitTie = { jade: 0.1, pagoda: 0.2, star: 0.3, sword: 0.4 };
      return 2 + (card.rank - 2) + suitTie[card.suit];
    }
    case 'phoenix': return 15;          // after aces, before dragon
    case 'dragon': return 16;           // highest display value
  }
}

/** Get the effective rank of a card, using phoenixUsedAs for Phoenix */
function effectiveRank(gc: GameCard, phoenixUsedAs?: Rank): number {
  if (gc.card.kind === 'standard') return gc.card.rank;
  if (gc.card.kind === 'mahjong') return 1;
  if (gc.card.kind === 'phoenix' && phoenixUsedAs !== undefined) return phoenixUsedAs;
  return 0;
}

/** REQ-F-UP04: Display copies preserve card identity and never reorder game state. */
export function sortCardsForDisplay(cards: GameCard[], order: CardOrder = 'descending'): GameCard[] {
  const direction = order === 'ascending' ? 1 : -1;
  return [...cards].sort((a, b) => direction * (cardSortKey(a.card) - cardSortKey(b.card)));
}

/** REQ-F-UP05: The full-house triple sits at the top end of the chosen stack. */
export function sortCombinationForDisplay(
  combo: Combination,
  order: CardOrder = 'descending',
  overlap: CardOverlap = 'rightOnTop',
): GameCard[] {
  const direction = order === 'ascending' ? 1 : -1;
  const sameRank = (a: GameCard, b: GameCard) => {
    // Preserve Phoenix's existing position within equal-rank groups.
    if (a.card.kind === 'phoenix') return combo.type === CombinationType.PairSequence ? 1 : -1;
    if (b.card.kind === 'phoenix') return combo.type === CombinationType.PairSequence ? -1 : 1;
    return direction * (cardSortKey(a.card) - cardSortKey(b.card));
  };
  if (combo.type === CombinationType.FullHouse) {
    const triple = combo.cards.filter((gc) => effectiveRank(gc, combo.phoenixUsedAs) === combo.rank).sort(sameRank);
    const pair = combo.cards.filter((gc) => effectiveRank(gc, combo.phoenixUsedAs) !== combo.rank).sort(sameRank);
    return overlap === 'leftOnTop' ? [...triple, ...pair] : [...pair, ...triple];
  }
  return [...combo.cards].sort((a, b) => {
    const rankDifference = effectiveRank(a, combo.phoenixUsedAs) - effectiveRank(b, combo.phoenixUsedAs);
    return rankDifference ? direction * rankDifference : sameRank(a, b);
  });
}

/** REQ-F-UP06: Explicit local stacking leaves the identifier edge exposed. */
export function cardStackIndex(index: number, count: number, overlap: CardOverlap): number {
  return overlap === 'leftOnTop' ? count - index : index + 1;
}

export function cardIdentifierSide(overlap: CardOverlap): 'left' | 'right' {
  return overlap === 'leftOnTop' ? 'right' : 'left';
}
