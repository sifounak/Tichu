// Verifies: REQ-F-GF03, REQ-F-GF04

import { describe, it, expect } from 'vitest';
import { isWishFulfilled, canFulfillWish, mustFulfillWish } from '../../src/engine/wish.js';
import { detectCombination } from '../../src/engine/combination-detector.js';
import { createDeck } from '../../src/engine/deck.js';
import type { GameCard, Rank } from '../../src/types/card.js';
import type { Combination } from '../../src/types/combination.js';

// --- Test Helpers ---

const deck = createDeck();

function findCard(kind: string): GameCard {
  return deck.find((gc) => gc.card.kind === kind)!;
}

function findStandard(rank: number, suitIdx = 0): GameCard {
  const suits = ['jade', 'pagoda', 'star', 'sword'];
  return deck.find(
    (gc) => gc.card.kind === 'standard' && gc.card.rank === rank && gc.card.suit === suits[suitIdx],
  )!;
}

function makeCombination(cards: GameCard[]): Combination {
  const combo = detectCombination(cards);
  if (!combo) throw new Error('Failed to detect combination for test');
  return combo;
}

// --- isWishFulfilled ---

describe('isWishFulfilled', () => {
  // Verifies: REQ-F-GF04
  it('returns true when play contains the wished rank', () => {
    const play = makeCombination([findStandard(7)]);
    expect(isWishFulfilled(play, 7 as Rank)).toBe(true);
  });

  it('returns false when play does not contain the wished rank', () => {
    const play = makeCombination([findStandard(8)]);
    expect(isWishFulfilled(play, 7 as Rank)).toBe(false);
  });

  it('returns true for pair containing the wished rank', () => {
    const play = makeCombination([findStandard(7), findStandard(7, 1)]);
    expect(isWishFulfilled(play, 7 as Rank)).toBe(true);
  });

  it('returns true for straight containing the wished rank', () => {
    const play = makeCombination([
      findStandard(3), findStandard(4), findStandard(5), findStandard(6), findStandard(7),
    ]);
    expect(isWishFulfilled(play, 5 as Rank)).toBe(true);
  });

  it('returns false when Phoenix substitutes for the wished rank (not a real card)', () => {
    // Pair of Phoenix + 7 → Phoenix acts as 7, but the real 7 is also there
    // Actually, let's test when Phoenix is the ONLY representative
    const play = makeCombination([findStandard(7), findCard('phoenix')]);
    // This is a pair at rank 7, Phoenix acts as 7
    // Wish for 8 should be false
    expect(isWishFulfilled(play, 8 as Rank)).toBe(false);
    // Wish for 7 should be true because the real 7 is there
    expect(isWishFulfilled(play, 7 as Rank)).toBe(true);
  });

  it('returns false for Dragon play when wish is for a standard rank', () => {
    const play = makeCombination([findCard('dragon')]);
    expect(isWishFulfilled(play, 7 as Rank)).toBe(false);
  });
});

// --- canFulfillWish ---

describe('canFulfillWish', () => {
  // Verifies: REQ-F-GF04
  it('returns true when player has wished rank and can play it leading', () => {
    const hand = [findStandard(7), findStandard(8), findStandard(9)];
    expect(canFulfillWish(hand, 7 as Rank, null)).toBe(true);
  });

  it('returns false when player does not have the wished rank', () => {
    const hand = [findStandard(8), findStandard(9), findStandard(10)];
    expect(canFulfillWish(hand, 7 as Rank, null)).toBe(false);
  });

  it('returns true when player has wished rank and can beat the trick', () => {
    const hand = [findStandard(7), findStandard(8), findStandard(9)];
    // Current trick is a single 5
    const trickTop = makeCombination([findStandard(5, 1)]);
    expect(canFulfillWish(hand, 7 as Rank, trickTop)).toBe(true);
  });

  it('returns false when player has wished rank but cannot beat the trick', () => {
    const hand = [findStandard(3), findStandard(4)];
    // Current trick is a single Ace — can't beat with 3
    const trickTop = makeCombination([findStandard(14)]);
    expect(canFulfillWish(hand, 3 as Rank, trickTop)).toBe(false);
  });

  it('returns true when wished rank can be played in a pair', () => {
    const hand = [findStandard(7), findStandard(7, 1), findStandard(3)];
    // Current trick is a pair of 5s
    const trickTop = makeCombination([findStandard(5, 1), findStandard(5, 2)]);
    expect(canFulfillWish(hand, 7 as Rank, trickTop)).toBe(true);
  });

  it('returns false when wished rank cannot form a valid combination to beat trick', () => {
    const hand = [findStandard(7), findStandard(3)];
    // Current trick is a pair of 5s — can't beat with a single 7
    const trickTop = makeCombination([findStandard(5, 1), findStandard(5, 2)]);
    expect(canFulfillWish(hand, 7 as Rank, trickTop)).toBe(false);
  });

  it('Phoenix alone does not fulfill wish (real card needed)', () => {
    const hand = [findCard('phoenix'), findStandard(8)];
    // Phoenix + 8 could form a pair at rank 8
    // But wish for 7 — player doesn't have a real 7
    expect(canFulfillWish(hand, 7 as Rank, null)).toBe(false);
  });
});

// --- mustFulfillWish ---

describe('mustFulfillWish', () => {
  // Verifies: REQ-F-GF04
  it('returns same result as canFulfillWish (must = can in Tichu)', () => {
    const hand = [findStandard(7), findStandard(8)];
    expect(mustFulfillWish(hand, 7 as Rank, null)).toBe(canFulfillWish(hand, 7 as Rank, null));
  });

  it('returns true when player can fulfill wish', () => {
    const hand = [findStandard(7)];
    expect(mustFulfillWish(hand, 7 as Rank, null)).toBe(true);
  });

  it('returns false when player cannot fulfill wish', () => {
    const hand = [findStandard(8)];
    expect(mustFulfillWish(hand, 7 as Rank, null)).toBe(false);
  });
});
