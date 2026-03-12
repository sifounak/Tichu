// Verifies: REQ-F-C04 — Card point values

import { describe, it, expect } from 'vitest';
import {
  getCardPoints,
  TOTAL_DECK_POINTS,
  DECK_SIZE,
  FIRST_DEAL_SIZE,
  SECOND_DEAL_SIZE,
  CARDS_PER_PLAYER,
  NUM_PLAYERS,
  RANK_ORDER,
  RANK_NAMES,
  DRAGON_RANK,
  PHOENIX_SINGLE_VALUE,
  MAHJONG_RANK,
} from '../src/constants.js';
import { Suit, ALL_RANKS, ALL_SUITS } from '../src/types/card.js';
import type { Card } from '../src/types/card.js';

describe('getCardPoints', () => {
  it('returns 25 for Dragon', () => {
    expect(getCardPoints({ kind: 'dragon' })).toBe(25);
  });

  it('returns -25 for Phoenix', () => {
    expect(getCardPoints({ kind: 'phoenix' })).toBe(-25);
  });

  it('returns 0 for Mahjong', () => {
    expect(getCardPoints({ kind: 'mahjong' })).toBe(0);
  });

  it('returns 0 for Dog', () => {
    expect(getCardPoints({ kind: 'dog' })).toBe(0);
  });

  it('returns 10 for Kings', () => {
    for (const suit of ALL_SUITS) {
      expect(getCardPoints({ kind: 'standard', suit, rank: 13 })).toBe(10);
    }
  });

  it('returns 10 for Tens', () => {
    for (const suit of ALL_SUITS) {
      expect(getCardPoints({ kind: 'standard', suit, rank: 10 })).toBe(10);
    }
  });

  it('returns 5 for Fives', () => {
    for (const suit of ALL_SUITS) {
      expect(getCardPoints({ kind: 'standard', suit, rank: 5 })).toBe(5);
    }
  });

  it('returns 0 for non-scoring standard cards', () => {
    const nonScoringRanks = [2, 3, 4, 6, 7, 8, 9, 11, 12, 14] as const;
    for (const rank of nonScoringRanks) {
      expect(getCardPoints({ kind: 'standard', suit: Suit.Jade, rank })).toBe(0);
    }
  });

  it('total deck points sum to 100', () => {
    let total = 0;
    // Standard cards
    for (const suit of ALL_SUITS) {
      for (const rank of ALL_RANKS) {
        total += getCardPoints({ kind: 'standard', suit, rank });
      }
    }
    // Special cards
    total += getCardPoints({ kind: 'dragon' });
    total += getCardPoints({ kind: 'phoenix' });
    total += getCardPoints({ kind: 'mahjong' });
    total += getCardPoints({ kind: 'dog' });

    expect(total).toBe(TOTAL_DECK_POINTS);
  });
});

describe('Constants', () => {
  it('DECK_SIZE is 56', () => {
    expect(DECK_SIZE).toBe(56);
  });

  it('FIRST_DEAL_SIZE is 8', () => {
    expect(FIRST_DEAL_SIZE).toBe(8);
  });

  it('SECOND_DEAL_SIZE is 6', () => {
    expect(SECOND_DEAL_SIZE).toBe(6);
  });

  it('CARDS_PER_PLAYER is 14', () => {
    expect(CARDS_PER_PLAYER).toBe(14);
  });

  it('NUM_PLAYERS is 4', () => {
    expect(NUM_PLAYERS).toBe(4);
  });

  it('RANK_ORDER has 13 ranks', () => {
    expect(RANK_ORDER).toHaveLength(13);
  });

  it('RANK_NAMES has entries for all ranks', () => {
    expect(RANK_NAMES[11]).toBe('Jack');
    expect(RANK_NAMES[12]).toBe('Queen');
    expect(RANK_NAMES[13]).toBe('King');
    expect(RANK_NAMES[14]).toBe('Ace');
  });

  it('DRAGON_RANK is 25', () => {
    expect(DRAGON_RANK).toBe(25);
  });

  it('PHOENIX_SINGLE_VALUE is 1.5', () => {
    expect(PHOENIX_SINGLE_VALUE).toBe(1.5);
  });

  it('MAHJONG_RANK is 1', () => {
    expect(MAHJONG_RANK).toBe(1);
  });
});
