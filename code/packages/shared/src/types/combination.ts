// REQ-F-CB01: All valid combination types

import type { GameCard, Rank } from './card.js';

/** All valid combination types in Tichu */
export enum CombinationType {
  Single = 'single',
  Pair = 'pair',
  Triple = 'triple',
  FullHouse = 'fullHouse',
  Straight = 'straight',
  PairSequence = 'pairSequence',
  FourBomb = 'fourBomb',
  StraightFlushBomb = 'straightFlushBomb',
}

/**
 * A validated combination of cards that can be played.
 * REQ-F-CB01: Detection of all types
 * REQ-F-CB02: Ranking for comparison
 */
export interface Combination {
  /** The type of combination */
  type: CombinationType;
  /** The cards forming this combination */
  cards: GameCard[];
  /**
   * Primary rank for comparison (e.g., rank of the pair, rank of the triple in full house).
   * For straights/pair sequences, this is the highest rank.
   */
  rank: number;
  /** Length for straights and pair sequences (number of cards for straight, number of pairs for pair sequence) */
  length: number;
  /** If Phoenix is used, the rank it substitutes for */
  phoenixUsedAs?: Rank;
  /** Whether this combination is a bomb */
  isBomb: boolean;
}
