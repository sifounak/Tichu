// Verifies: REQ-F-DI01, REQ-NF-U04, REQ-NF-U05
import { describe, it, expect } from 'vitest';
import { Suit } from '@tichu/shared';
import type { Card, Rank } from '@tichu/shared';
import {
  SUIT_SYMBOLS,
  SUIT_LABELS,
  RANK_LABELS,
  SPECIAL_LABELS,
  SPECIAL_NAMES,
  suitColor,
  specialColor,
  cardAriaLabel,
  cardSortKey,
} from '@/components/cards/card-utils';

describe('card-utils', () => {
  describe('SUIT_SYMBOLS', () => {
    it('has symbols for all 4 suits', () => {
      expect(Object.keys(SUIT_SYMBOLS)).toHaveLength(4);
      for (const suit of [Suit.Jade, Suit.Pagoda, Suit.Star, Suit.Sword]) {
        expect(SUIT_SYMBOLS[suit]).toBeTruthy();
      }
    });
  });

  describe('SUIT_LABELS', () => {
    it('has single-char labels for all 4 suits', () => {
      for (const suit of [Suit.Jade, Suit.Pagoda, Suit.Star, Suit.Sword]) {
        expect(SUIT_LABELS[suit]).toHaveLength(1);
      }
    });
  });

  describe('RANK_LABELS', () => {
    it('has labels for all 13 ranks', () => {
      const ranks: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
      for (const rank of ranks) {
        expect(RANK_LABELS[rank]).toBeTruthy();
      }
    });

    it('uses J, Q, K, A for face cards', () => {
      expect(RANK_LABELS[11]).toBe('J');
      expect(RANK_LABELS[12]).toBe('Q');
      expect(RANK_LABELS[13]).toBe('K');
      expect(RANK_LABELS[14]).toBe('A');
    });
  });

  describe('SPECIAL_LABELS', () => {
    it('has labels for all 4 special cards', () => {
      expect(SPECIAL_LABELS['dragon']).toBe('Dr');
      expect(SPECIAL_LABELS['phoenix']).toBe('Ph');
      expect(SPECIAL_LABELS['mahjong']).toBe('1');
      expect(SPECIAL_LABELS['dog']).toBe('Do');
    });
  });

  describe('SPECIAL_NAMES', () => {
    it('has full names for all 4 special cards', () => {
      expect(SPECIAL_NAMES['dragon']).toBe('Dragon');
      expect(SPECIAL_NAMES['phoenix']).toBe('Phoenix');
      expect(SPECIAL_NAMES['mahjong']).toBe('Mahjong');
      expect(SPECIAL_NAMES['dog']).toBe('Dog');
    });
  });

  describe('suitColor', () => {
    it('returns CSS variable for each suit', () => {
      expect(suitColor(Suit.Jade)).toBe('var(--color-suit-jade)');
      expect(suitColor(Suit.Star)).toBe('var(--color-suit-star)');
    });
  });

  describe('specialColor', () => {
    it('returns CSS variable for each special card', () => {
      expect(specialColor('dragon')).toBe('var(--color-special-dragon)');
      expect(specialColor('phoenix')).toBe('var(--color-special-phoenix)');
    });
  });

  describe('cardAriaLabel', () => {
    // Verifies: REQ-NF-U04
    it('returns readable label for standard card', () => {
      const card: Card = { kind: 'standard', suit: Suit.Jade, rank: 14 };
      expect(cardAriaLabel(card)).toBe('A of jade');
    });

    it('returns name for special cards', () => {
      expect(cardAriaLabel({ kind: 'dragon' })).toBe('Dragon');
      expect(cardAriaLabel({ kind: 'phoenix' })).toBe('Phoenix');
      expect(cardAriaLabel({ kind: 'mahjong' })).toBe('Mahjong');
      expect(cardAriaLabel({ kind: 'dog' })).toBe('Dog');
    });
  });

  describe('cardSortKey', () => {
    it('sorts specials before standard cards', () => {
      expect(cardSortKey({ kind: 'dog' })).toBeLessThan(cardSortKey({ kind: 'standard', suit: Suit.Jade, rank: 2 }));
      expect(cardSortKey({ kind: 'mahjong' })).toBeLessThan(cardSortKey({ kind: 'standard', suit: Suit.Jade, rank: 2 }));
    });

    it('sorts phoenix and dragon after standard cards', () => {
      expect(cardSortKey({ kind: 'phoenix' })).toBeGreaterThan(cardSortKey({ kind: 'standard', suit: Suit.Sword, rank: 14 }));
      expect(cardSortKey({ kind: 'dragon' })).toBeGreaterThan(cardSortKey({ kind: 'standard', suit: Suit.Sword, rank: 14 }));
    });

    it('sorts standard cards by suit then rank', () => {
      const j5 = cardSortKey({ kind: 'standard', suit: Suit.Jade, rank: 5 });
      const j10 = cardSortKey({ kind: 'standard', suit: Suit.Jade, rank: 10 });
      const p2 = cardSortKey({ kind: 'standard', suit: Suit.Pagoda, rank: 2 });
      expect(j5).toBeLessThan(j10);
      expect(j10).toBeLessThan(p2);
    });
  });
});
