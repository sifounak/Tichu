// Verifies: REQ-F-GF04, REQ-F-CB01, REQ-F-CB02

import { describe, it, expect } from 'vitest';
import { validatePlay, getValidPlays, canPlayerPass } from '../../src/engine/rules.js';
import { createDeck } from '../../src/engine/deck.js';
import { detectCombination } from '../../src/engine/combination-detector.js';
import type { GameCard, Rank } from '../../src/types/card.js';
import type { Combination } from '../../src/types/combination.js';
import type { TrickState, Seat } from '../../src/types/game.js';

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
  if (!combo) throw new Error('Failed to detect combination');
  return combo;
}

/** Create a TrickState with plays */
function makeTrick(plays: Array<{ seat: Seat; cards: GameCard[] }>): TrickState {
  return {
    plays: plays.map((p) => ({
      seat: p.seat,
      combination: makeCombination(p.cards),
    })),
    passes: [],
    leadSeat: plays[0].seat,
    currentWinner: plays[plays.length - 1].seat,
  };
}

// --- validatePlay ---

describe('validatePlay', () => {
  it('accepts a valid single when leading', () => {
    const cards = [findStandard(7)];
    const hand = [findStandard(7), findStandard(8)];
    const result = validatePlay(cards, hand, null, null);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.combination.type).toBe('single');
      expect(result.combination.rank).toBe(7);
    }
  });

  it('rejects empty card selection', () => {
    const result = validatePlay([], [findStandard(7)], null, null);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('No cards selected');
  });

  it('rejects cards that do not form a valid combination', () => {
    // Two different ranks — not a valid combo
    const cards = [findStandard(7), findStandard(8)];
    const hand = [findStandard(7), findStandard(8)];
    const result = validatePlay(cards, hand, null, null);

    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('Cards do not form a valid combination');
  });

  it('rejects a play that cannot beat the current trick', () => {
    const trick = makeTrick([{ seat: 'north', cards: [findStandard(10)] }]);
    const cards = [findStandard(7)];
    const hand = [findStandard(7), findStandard(8)];

    const result = validatePlay(cards, hand, trick, null);

    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('Play does not beat the current trick');
  });

  it('accepts a play that beats the current trick', () => {
    const trick = makeTrick([{ seat: 'north', cards: [findStandard(7)] }]);
    const cards = [findStandard(10)];
    const hand = [findStandard(10), findStandard(3)];

    const result = validatePlay(cards, hand, trick, null);

    expect(result.valid).toBe(true);
  });

  it('rejects Dog when trick is active', () => {
    const trick = makeTrick([{ seat: 'north', cards: [findStandard(7)] }]);
    const cards = [findCard('dog')];
    const hand = [findCard('dog'), findStandard(8)];

    const result = validatePlay(cards, hand, trick, null);

    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('Dog can only be played as a lead');
  });

  it('accepts Dog when leading', () => {
    const cards = [findCard('dog')];
    const hand = [findCard('dog'), findStandard(7)];

    const result = validatePlay(cards, hand, null, null);

    expect(result.valid).toBe(true);
  });

  // Wish enforcement
  it('rejects a play that does not fulfill wish when player can fulfill it', () => {
    const hand = [findStandard(7), findStandard(8), findStandard(9)];
    const cards = [findStandard(8)]; // Playing 8 instead of wished 7

    const result = validatePlay(cards, hand, null, 7 as Rank);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain('wished rank');
    }
  });

  it('accepts a play fulfilling the wish', () => {
    const hand = [findStandard(7), findStandard(8)];
    const cards = [findStandard(7)];

    const result = validatePlay(cards, hand, null, 7 as Rank);

    expect(result.valid).toBe(true);
  });

  it('allows any play when player cannot fulfill the wish', () => {
    const hand = [findStandard(8), findStandard(9)];
    const cards = [findStandard(8)];

    // Wish for 7 but player doesn't have it
    const result = validatePlay(cards, hand, null, 7 as Rank);

    expect(result.valid).toBe(true);
  });

  it('accepts a bomb even when trick type differs', () => {
    const trick = makeTrick([{ seat: 'north', cards: [findStandard(7)] }]);
    const bomb = [findStandard(5), findStandard(5, 1), findStandard(5, 2), findStandard(5, 3)];
    const hand = [...bomb, findStandard(3)];

    const result = validatePlay(bomb, hand, trick, null);

    expect(result.valid).toBe(true);
    if (result.valid) expect(result.combination.isBomb).toBe(true);
  });
});

// --- getValidPlays ---

describe('getValidPlays', () => {
  it('returns all plays when leading with no wish', () => {
    const hand = [findStandard(7), findStandard(8), findStandard(7, 1)];
    const plays = getValidPlays(hand, null, null);

    // Should include singles (7, 8, 7) and pair of 7s
    expect(plays.length).toBeGreaterThanOrEqual(4); // 3 singles + 1 pair
  });

  it('filters to only wish-fulfilling plays when wish is active and fulfillable', () => {
    const hand = [findStandard(7), findStandard(8), findStandard(9)];
    const plays = getValidPlays(hand, null, 7 as Rank);

    // Only plays containing a real 7
    expect(plays.length).toBeGreaterThan(0);
    for (const play of plays) {
      const has7 = play.cards.some(
        (gc) => gc.card.kind === 'standard' && gc.card.rank === 7,
      );
      expect(has7).toBe(true);
    }
  });

  it('returns all plays when wish is active but unfulfillable', () => {
    const hand = [findStandard(8), findStandard(9)];
    const plays = getValidPlays(hand, null, 7 as Rank);

    // Can't fulfill wish for 7, so all plays are valid
    expect(plays.length).toBeGreaterThan(0);
  });

  it('returns plays that beat the trick', () => {
    const trick = makeTrick([{ seat: 'north', cards: [findStandard(7)] }]);
    const hand = [findStandard(3), findStandard(8), findStandard(14)];

    const plays = getValidPlays(hand, trick, null);

    // Only 8 and Ace can beat 7
    const ranks = plays.map((p) => p.rank);
    expect(ranks).toContain(8);
    expect(ranks).toContain(14);
    expect(ranks).not.toContain(3);
  });

  it('filters by wish AND trick when both are active', () => {
    const trick = makeTrick([{ seat: 'north', cards: [findStandard(5)] }]);
    const hand = [findStandard(7), findStandard(3), findStandard(9)];

    // Wish for 7, trick is single 5 — must play 7
    const plays = getValidPlays(hand, trick, 7 as Rank);

    expect(plays.length).toBe(1);
    expect(plays[0].rank).toBe(7);
  });
});

// --- canPlayerPass ---

describe('canPlayerPass', () => {
  it('returns false when leading (no trick)', () => {
    const hand = [findStandard(7)];
    expect(canPlayerPass(hand, null, null)).toBe(false);
  });

  it('returns false when leading (empty trick)', () => {
    const emptyTrick: TrickState = {
      plays: [],
      passes: [],
      leadSeat: 'north',
      currentWinner: 'north',
    };
    expect(canPlayerPass([findStandard(7)], emptyTrick, null)).toBe(false);
  });

  it('returns true when following and no wish', () => {
    const trick = makeTrick([{ seat: 'north', cards: [findStandard(7)] }]);
    expect(canPlayerPass([findStandard(3)], trick, null)).toBe(true);
  });

  it('returns false when following and can fulfill wish', () => {
    const trick = makeTrick([{ seat: 'north', cards: [findStandard(5)] }]);
    const hand = [findStandard(7), findStandard(8)];

    // Wish for 7, can beat 5 with 7 → can't pass
    expect(canPlayerPass(hand, trick, 7 as Rank)).toBe(false);
  });

  it('returns true when following and cannot fulfill wish', () => {
    const trick = makeTrick([{ seat: 'north', cards: [findStandard(5)] }]);
    const hand = [findStandard(3), findStandard(4)];

    // Wish for 7, but player has no 7 → can pass
    expect(canPlayerPass(hand, trick, 7 as Rank)).toBe(true);
  });

  it('returns true when wish rank exists but cannot beat the trick with it', () => {
    const trick = makeTrick([{ seat: 'north', cards: [findStandard(14)] }]);
    const hand = [findStandard(7), findStandard(3)];

    // Wish for 7, but can't beat Ace with 7 → can pass
    expect(canPlayerPass(hand, trick, 7 as Rank)).toBe(true);
  });
});
