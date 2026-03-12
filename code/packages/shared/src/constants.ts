// REQ-F-C04: Card point values
// REQ-F-C01: Rank ordering and card properties

import type { Card, Rank } from './types/card.js';

/**
 * REQ-F-C04: Card point values.
 * Kings=10, Tens=10, Fives=5, Dragon=25, Phoenix=-25, all others=0
 */
export function getCardPoints(card: Card): number {
  switch (card.kind) {
    case 'dragon':
      return 25;
    case 'phoenix':
      return -25;
    case 'mahjong':
    case 'dog':
      return 0;
    case 'standard':
      if (card.rank === 13) return 10; // King
      if (card.rank === 10) return 10; // Ten
      if (card.rank === 5) return 5;   // Five
      return 0;
  }
}

/** Total card points in a full deck (should equal 100) */
export const TOTAL_DECK_POINTS = 100;

/** Number of cards in a Tichu deck */
export const DECK_SIZE = 56;

/** Cards dealt in the first deal (before Grand Tichu decision) */
export const FIRST_DEAL_SIZE = 8;

/** Cards dealt in the second deal (after Grand Tichu decision) */
export const SECOND_DEAL_SIZE = 6;

/** Total cards per player */
export const CARDS_PER_PLAYER = 14;

/** Number of players */
export const NUM_PLAYERS = 4;

/** Rank ordering for standard cards (low to high) */
export const RANK_ORDER: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;

/** Human-readable rank names */
export const RANK_NAMES: Record<Rank, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'Jack',
  12: 'Queen',
  13: 'King',
  14: 'Ace',
};

/** Dragon rank for comparison (highest single) */
export const DRAGON_RANK = 25;

/** Phoenix rank as a leading single */
export const PHOENIX_SINGLE_VALUE = 1.5;

/** Mahjong rank */
export const MAHJONG_RANK = 1;
