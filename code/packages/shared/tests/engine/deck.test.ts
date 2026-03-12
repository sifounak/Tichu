// Verifies: REQ-F-C01, REQ-F-C02, REQ-F-C03

import { describe, it, expect } from 'vitest';
import { createDeck, shuffleDeck, dealCards } from '../../src/engine/deck.js';
import { ALL_RANKS, ALL_SUITS, isStandard, isSpecial } from '../../src/types/card.js';
import { SEATS_IN_ORDER } from '../../src/types/game.js';
import { DECK_SIZE, FIRST_DEAL_SIZE, SECOND_DEAL_SIZE, CARDS_PER_PLAYER } from '../../src/constants.js';
import type { GameCard } from '../../src/types/card.js';

describe('createDeck', () => {
  const deck = createDeck();

  // REQ-F-C01: 56 unique cards
  it('creates exactly 56 cards', () => {
    expect(deck).toHaveLength(DECK_SIZE);
  });

  it('assigns unique IDs from 0 to 55', () => {
    const ids = deck.map(gc => gc.id);
    expect(new Set(ids).size).toBe(DECK_SIZE);
    expect(Math.min(...ids)).toBe(0);
    expect(Math.max(...ids)).toBe(55);
  });

  it('contains 52 standard cards (4 suits × 13 ranks)', () => {
    const standardCards = deck.filter(gc => isStandard(gc.card));
    expect(standardCards).toHaveLength(52);
  });

  it('contains all suit/rank combinations', () => {
    const standardCards = deck.filter(gc => gc.card.kind === 'standard');
    for (const suit of ALL_SUITS) {
      for (const rank of ALL_RANKS) {
        const found = standardCards.find(
          gc => gc.card.kind === 'standard' && gc.card.suit === suit && gc.card.rank === rank
        );
        expect(found, `Missing ${suit} ${rank}`).toBeDefined();
      }
    }
  });

  it('contains exactly one of each special card', () => {
    const specials = deck.filter(gc => isSpecial(gc.card));
    expect(specials).toHaveLength(4);

    const kinds = specials.map(gc => gc.card.kind);
    expect(kinds).toContain('mahjong');
    expect(kinds).toContain('dog');
    expect(kinds).toContain('phoenix');
    expect(kinds).toContain('dragon');
  });

  it('standard cards have IDs 0–51, specials have IDs 52–55', () => {
    const standardCards = deck.filter(gc => isStandard(gc.card));
    const specialCards = deck.filter(gc => isSpecial(gc.card));

    for (const gc of standardCards) {
      expect(gc.id).toBeGreaterThanOrEqual(0);
      expect(gc.id).toBeLessThan(52);
    }
    for (const gc of specialCards) {
      expect(gc.id).toBeGreaterThanOrEqual(52);
      expect(gc.id).toBeLessThanOrEqual(55);
    }
  });
});

describe('shuffleDeck', () => {
  const deck = createDeck();

  // REQ-F-C02: Fisher-Yates shuffle
  it('returns the same number of cards', () => {
    const shuffled = shuffleDeck(deck);
    expect(shuffled).toHaveLength(DECK_SIZE);
  });

  it('contains all the same cards (no duplicates, no missing)', () => {
    const shuffled = shuffleDeck(deck);
    const originalIds = new Set(deck.map(gc => gc.id));
    const shuffledIds = new Set(shuffled.map(gc => gc.id));
    expect(shuffledIds).toEqual(originalIds);
  });

  it('does not mutate the original deck', () => {
    const originalOrder = deck.map(gc => gc.id);
    shuffleDeck(deck);
    expect(deck.map(gc => gc.id)).toEqual(originalOrder);
  });

  it('produces a different order (with very high probability)', () => {
    const shuffled = shuffleDeck(deck);
    const originalOrder = deck.map(gc => gc.id).join(',');
    const shuffledOrder = shuffled.map(gc => gc.id).join(',');
    // Probability of identical order = 1/56! ≈ 0
    expect(shuffledOrder).not.toBe(originalOrder);
  });

  it('produces different results on consecutive calls', () => {
    const shuffled1 = shuffleDeck(deck);
    const shuffled2 = shuffleDeck(deck);
    const order1 = shuffled1.map(gc => gc.id).join(',');
    const order2 = shuffled2.map(gc => gc.id).join(',');
    expect(order1).not.toBe(order2);
  });
});

describe('dealCards', () => {
  const deck = createDeck();
  const shuffled = shuffleDeck(deck);
  const dealt = dealCards(shuffled);

  // REQ-F-C03: Deal 8+6 cards per player
  it('deals to all 4 seats', () => {
    for (const seat of SEATS_IN_ORDER) {
      expect(dealt[seat]).toBeDefined();
    }
  });

  it('deals 8 cards in first deal for each player', () => {
    for (const seat of SEATS_IN_ORDER) {
      expect(dealt[seat].first8).toHaveLength(FIRST_DEAL_SIZE);
    }
  });

  it('deals 6 cards in second deal for each player', () => {
    for (const seat of SEATS_IN_ORDER) {
      expect(dealt[seat].remaining6).toHaveLength(SECOND_DEAL_SIZE);
    }
  });

  it('each player gets 14 unique cards total', () => {
    for (const seat of SEATS_IN_ORDER) {
      const allCards = [...dealt[seat].first8, ...dealt[seat].remaining6];
      expect(allCards).toHaveLength(CARDS_PER_PLAYER);
      const ids = allCards.map(gc => gc.id);
      expect(new Set(ids).size).toBe(CARDS_PER_PLAYER);
    }
  });

  it('no duplicates across all players', () => {
    const allIds: number[] = [];
    for (const seat of SEATS_IN_ORDER) {
      allIds.push(...dealt[seat].first8.map(gc => gc.id));
      allIds.push(...dealt[seat].remaining6.map(gc => gc.id));
    }
    expect(allIds).toHaveLength(DECK_SIZE);
    expect(new Set(allIds).size).toBe(DECK_SIZE);
  });

  it('throws for wrong deck size', () => {
    expect(() => dealCards([])).toThrow('Expected 56 cards, got 0');
    expect(() => dealCards(deck.slice(0, 10))).toThrow('Expected 56 cards, got 10');
  });
});
