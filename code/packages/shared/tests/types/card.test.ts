// Verifies: REQ-F-C01 — 56-card deck types, type guards, card utilities

import { describe, it, expect } from 'vitest';
import {
  Suit,
  SpecialCardType,
  ALL_RANKS,
  ALL_SUITS,
  isSpecial,
  isStandard,
  isDragon,
  isPhoenix,
  isMahjong,
  isDog,
  getCardRank,
  getCardSuit,
} from '../../src/types/card.js';
import type { Card, StandardCard, DragonCard, PhoenixCard, MahjongCard, DogCard } from '../../src/types/card.js';

describe('Card types', () => {
  describe('Suit enum', () => {
    it('has 4 suits', () => {
      expect(Object.values(Suit)).toHaveLength(4);
    });

    it('has correct values', () => {
      expect(Suit.Jade).toBe('jade');
      expect(Suit.Pagoda).toBe('pagoda');
      expect(Suit.Star).toBe('star');
      expect(Suit.Sword).toBe('sword');
    });
  });

  describe('SpecialCardType enum', () => {
    it('has 4 special types', () => {
      expect(Object.values(SpecialCardType)).toHaveLength(4);
    });

    it('has correct values', () => {
      expect(SpecialCardType.Dragon).toBe('dragon');
      expect(SpecialCardType.Phoenix).toBe('phoenix');
      expect(SpecialCardType.Mahjong).toBe('mahjong');
      expect(SpecialCardType.Dog).toBe('dog');
    });
  });

  describe('ALL_RANKS', () => {
    it('has 13 ranks from 2 to 14', () => {
      expect(ALL_RANKS).toHaveLength(13);
      expect(ALL_RANKS[0]).toBe(2);
      expect(ALL_RANKS[12]).toBe(14);
    });
  });

  describe('ALL_SUITS', () => {
    it('has 4 suits', () => {
      expect(ALL_SUITS).toHaveLength(4);
    });
  });
});

describe('Type guards', () => {
  const standardCard: StandardCard = { kind: 'standard', suit: Suit.Jade, rank: 5 };
  const dragon: DragonCard = { kind: 'dragon' };
  const phoenix: PhoenixCard = { kind: 'phoenix' };
  const mahjong: MahjongCard = { kind: 'mahjong' };
  const dog: DogCard = { kind: 'dog' };

  describe('isSpecial', () => {
    it('returns false for standard cards', () => {
      expect(isSpecial(standardCard)).toBe(false);
    });

    it('returns true for all special cards', () => {
      expect(isSpecial(dragon)).toBe(true);
      expect(isSpecial(phoenix)).toBe(true);
      expect(isSpecial(mahjong)).toBe(true);
      expect(isSpecial(dog)).toBe(true);
    });
  });

  describe('isStandard', () => {
    it('returns true for standard cards', () => {
      expect(isStandard(standardCard)).toBe(true);
    });

    it('returns false for special cards', () => {
      expect(isStandard(dragon)).toBe(false);
      expect(isStandard(phoenix)).toBe(false);
      expect(isStandard(mahjong)).toBe(false);
      expect(isStandard(dog)).toBe(false);
    });
  });

  describe('isDragon', () => {
    it('returns true only for Dragon', () => {
      expect(isDragon(dragon)).toBe(true);
      expect(isDragon(standardCard)).toBe(false);
      expect(isDragon(phoenix)).toBe(false);
    });
  });

  describe('isPhoenix', () => {
    it('returns true only for Phoenix', () => {
      expect(isPhoenix(phoenix)).toBe(true);
      expect(isPhoenix(standardCard)).toBe(false);
      expect(isPhoenix(dragon)).toBe(false);
    });
  });

  describe('isMahjong', () => {
    it('returns true only for Mahjong', () => {
      expect(isMahjong(mahjong)).toBe(true);
      expect(isMahjong(standardCard)).toBe(false);
      expect(isMahjong(dog)).toBe(false);
    });
  });

  describe('isDog', () => {
    it('returns true only for Dog', () => {
      expect(isDog(dog)).toBe(true);
      expect(isDog(standardCard)).toBe(false);
      expect(isDog(mahjong)).toBe(false);
    });
  });
});

describe('getCardRank', () => {
  it('returns the rank for standard cards', () => {
    const card: Card = { kind: 'standard', suit: Suit.Jade, rank: 10 };
    expect(getCardRank(card)).toBe(10);
  });

  it('returns 1 for Mahjong', () => {
    expect(getCardRank({ kind: 'mahjong' })).toBe(1);
  });

  it('returns 25 for Dragon', () => {
    expect(getCardRank({ kind: 'dragon' })).toBe(25);
  });

  it('returns 0 for Phoenix (context-dependent)', () => {
    expect(getCardRank({ kind: 'phoenix' })).toBe(0);
  });

  it('returns 0 for Dog (not comparable)', () => {
    expect(getCardRank({ kind: 'dog' })).toBe(0);
  });
});

describe('getCardSuit', () => {
  it('returns the suit for standard cards', () => {
    expect(getCardSuit({ kind: 'standard', suit: Suit.Star, rank: 7 })).toBe(Suit.Star);
  });

  it('returns undefined for special cards', () => {
    expect(getCardSuit({ kind: 'dragon' })).toBeUndefined();
    expect(getCardSuit({ kind: 'phoenix' })).toBeUndefined();
    expect(getCardSuit({ kind: 'mahjong' })).toBeUndefined();
    expect(getCardSuit({ kind: 'dog' })).toBeUndefined();
  });
});
