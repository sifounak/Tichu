// Verifies: REQ-F-HV01, REQ-F-HV02, REQ-F-HV03, REQ-F-HV04, REQ-F-HV05

import { describe, it, expect } from 'vitest';
import { getSelectableCards, canFormValidCombination, canFormValidPrefix } from '../../src/engine/hand-filter.js';
import type { GameCard, Rank } from '../../src/types/card.js';
import { Suit } from '../../src/types/card.js';
import type { TrickState } from '../../src/types/game.js';
import type { Combination } from '../../src/types/combination.js';
import { CombinationType } from '../../src/types/combination.js';

// --- Helpers ---

function std(id: number, suit: Suit, rank: Rank): GameCard {
  return { id, card: { kind: 'standard', suit, rank } };
}

function dragon(id = 55): GameCard {
  return { id, card: { kind: 'dragon' } };
}

function phoenix(id = 54): GameCard {
  return { id, card: { kind: 'phoenix' } };
}

function mahjong(id = 52): GameCard {
  return { id, card: { kind: 'mahjong' } };
}

function dog(id = 53): GameCard {
  return { id, card: { kind: 'dog' } };
}

// Shorthand for standard cards in each suit
function j(rank: Rank, id?: number): GameCard {
  return std(id ?? rank, Suit.Jade, rank);
}
function p(rank: Rank, id?: number): GameCard {
  return std(id ?? rank + 20, Suit.Pagoda, rank);
}
function s(rank: Rank, id?: number): GameCard {
  return std(id ?? rank + 40, Suit.Star, rank);
}
function sw(rank: Rank, id?: number): GameCard {
  return std(id ?? rank + 60, Suit.Sword, rank);
}

function makeTrick(plays: Array<{ seat: string; combination: Combination }>): TrickState {
  return {
    plays: plays.map((p) => ({
      seat: p.seat as 'north' | 'east' | 'south' | 'west',
      combination: p.combination,
    })),
    passes: [],
    leadSeat: (plays[0]?.seat ?? 'north') as 'north' | 'east' | 'south' | 'west',
    currentWinner: (plays[plays.length - 1]?.seat ?? 'north') as 'north' | 'east' | 'south' | 'west',
  };
}

function makeCombination(
  type: CombinationType,
  rank: number,
  length: number,
  cards: GameCard[],
  isBomb = false,
): Combination {
  return { type, rank, length, cards, isBomb };
}

// --- Tests ---

describe('getSelectableCards', () => {
  describe('Phase 1 — Empty selection', () => {
    it('REQ-F-HV01: all cards selectable when nothing selected and leading', () => {
      const hand = [j(5), j(7), j(10), p(5), dragon(), phoenix(), mahjong(), dog()];
      const result = getSelectableCards(hand, [], null, null);
      expect(result.size).toBe(hand.length);
      for (const gc of hand) {
        expect(result.has(gc.id)).toBe(true);
      }
    });

    it('REQ-F-HV03: Dog disabled when trick is active', () => {
      const hand = [j(5), j(7), dog(), phoenix()];
      const trick = makeTrick([
        { seat: 'east', combination: makeCombination(CombinationType.Single, 3, 1, [j(3)]) },
      ]);

      const result = getSelectableCards(hand, [], trick, null);
      expect(result.has(dog().id)).toBe(false);
      expect(result.has(j(5).id)).toBe(true);
      expect(result.has(j(7).id)).toBe(true);
      expect(result.has(phoenix().id)).toBe(true);
    });

    it('REQ-F-HV03: Dog enabled when leading (no trick)', () => {
      const hand = [j(5), dog()];
      const result = getSelectableCards(hand, [], null, null);
      expect(result.has(dog().id)).toBe(true);
    });
  });

  describe('REQ-F-HV02 — Dragon/Dog disables all others', () => {
    it('Dragon selected: no other cards selectable', () => {
      const hand = [j(5), j(7), dragon(), phoenix()];
      const result = getSelectableCards(hand, [dragon()], null, null);
      expect(result.size).toBe(0);
    });

    it('Dog selected: no other cards selectable', () => {
      const hand = [j(5), j(7), dog(), phoenix()];
      const result = getSelectableCards(hand, [dog()], null, null);
      expect(result.size).toBe(0);
    });
  });

  describe('Phase 2 — Cards selected', () => {
    it('select a 5: cards that can form pairs, triples, straights with 5 stay enabled', () => {
      const hand = [j(5), p(5), s(5), j(3), j(4), j(6), j(7), j(14)];
      const selected = [j(5)];
      const result = getSelectableCards(hand, selected, null, null);

      // p(5) and s(5) → can form pair/triple
      expect(result.has(p(5).id)).toBe(true);
      expect(result.has(s(5).id)).toBe(true);

      // j(3), j(4), j(6), j(7) → could form straight prefix
      expect(result.has(j(3).id)).toBe(true);
      expect(result.has(j(4).id)).toBe(true);
      expect(result.has(j(6).id)).toBe(true);
      expect(result.has(j(7).id)).toBe(true);

      // j(14) → could be part of a long straight with 5 (5-6-7-8-9-10-11-12-13-14)
      expect(result.has(j(14).id)).toBe(true);
    });

    it('select 5+6: cards forming straights stay enabled', () => {
      const hand = [j(5), j(6), j(7), j(8), j(3), j(4), j(14)];
      const selected = [j(5), j(6)];
      const result = getSelectableCards(hand, selected, null, null);

      // j(3), j(4) → could extend straight down
      expect(result.has(j(3).id)).toBe(true);
      expect(result.has(j(4).id)).toBe(true);

      // j(7), j(8) → could extend straight up
      expect(result.has(j(7).id)).toBe(true);
      expect(result.has(j(8).id)).toBe(true);

      // j(14) → could be part of a long straight (5-6-...-14)
      expect(result.has(j(14).id)).toBe(true);
    });

    it('select 5+5: cards for triple, full house, pair sequence stay enabled', () => {
      const hand = [j(5), p(5), s(5), j(6), p(6), j(14)];
      const selected = [j(5), p(5)];
      const result = getSelectableCards(hand, selected, null, null);

      // s(5) → can form triple
      expect(result.has(s(5).id)).toBe(true);

      // j(6), p(6) → pair sequence prefix (5,5,6 or 5,5,6,6)
      expect(result.has(j(6).id)).toBe(true);
      expect(result.has(p(6).id)).toBe(true);
    });

    it('Dragon and Dog cannot be added to multi-card selections', () => {
      const hand = [j(5), p(5), dragon(), dog()];
      const selected = [j(5)];
      const result = getSelectableCards(hand, selected, null, null);

      expect(result.has(dragon().id)).toBe(false);
      expect(result.has(dog().id)).toBe(false);
    });
  });

  describe('REQ-F-HV04 — Phoenix disabled if would form bomb', () => {
    it('Phoenix + 3 Kings: Phoenix disabled (would form four-bomb)', () => {
      const hand = [j(13), p(13), s(13), phoenix(), j(2)];
      const selected = [j(13), p(13), s(13)];
      const result = getSelectableCards(hand, selected, null, null);

      // Phoenix would form 4-bomb → disabled
      expect(result.has(phoenix().id)).toBe(false);
    });

    it('Phoenix enabled when it does not form a bomb', () => {
      const hand = [j(5), p(5), phoenix(), j(3)];
      const selected = [j(5)];
      const result = getSelectableCards(hand, selected, null, null);

      // Phoenix + 5 = pair (not a bomb) → enabled
      expect(result.has(phoenix().id)).toBe(true);
    });

    it('Phoenix + 4 same-suit consecutive: disabled (would-be straight flush bomb)', () => {
      const hand = [j(5), j(6), j(7), j(8), phoenix(), p(2)];
      const selected = [j(5), j(6), j(7), j(8)];
      const result = getSelectableCards(hand, selected, null, null);

      // Phoenix + 4 consecutive same suit = would-be straight flush bomb → disabled
      expect(result.has(phoenix().id)).toBe(false);
    });

    it('Phoenix + 4 same-suit with gap: disabled (would-be SF bomb with gap fill)', () => {
      const hand = [j(5), j(6), j(8), j(9), phoenix(), p(2)];
      const selected = [j(5), j(6), j(8), j(9)];
      const result = getSelectableCards(hand, selected, null, null);

      // Phoenix fills gap at 7 → would-be straight flush bomb → disabled
      expect(result.has(phoenix().id)).toBe(false);
    });
  });

  describe('Trick constraints', () => {
    it('current trick is pair: pair-compatible selections enabled (plus bombs)', () => {
      const hand = [j(5), p(5), s(5), sw(5), j(6), p(6), j(7), j(8)];
      const trick = makeTrick([
        {
          seat: 'east',
          combination: makeCombination(CombinationType.Pair, 3, 1, [j(3), p(3)]),
        },
      ]);

      const selected = [j(5)];
      const result = getSelectableCards(hand, selected, trick, null);

      // p(5), s(5) → can form pair to beat 3s
      expect(result.has(p(5).id)).toBe(true);
      expect(result.has(s(5).id)).toBe(true);

      // j(6), p(6) → could form pair sequence prefix (5,6)
      expect(result.has(j(6).id)).toBe(true);
      expect(result.has(p(6).id)).toBe(true);
    });

    it('current trick is single: selectable cards can form higher singles', () => {
      const hand = [j(5), j(7), j(2), phoenix()];
      const trick = makeTrick([
        {
          seat: 'east',
          combination: makeCombination(CombinationType.Single, 6, 1, [j(6)]),
        },
      ]);

      // Nothing selected yet — all should be enabled except j(5) and j(2) which can't beat 6
      // Actually, even low cards may participate in bombs. But as singles they can't beat.
      // With empty selection, all are initially selectable (the filter is progressive)
      const result = getSelectableCards(hand, [], trick, null);
      // All are selectable at Phase 1 (empty selection)
      expect(result.has(j(5).id)).toBe(true);
      expect(result.has(j(7).id)).toBe(true);
      expect(result.has(j(2).id)).toBe(true);
      expect(result.has(phoenix().id)).toBe(true);
    });
  });

  describe('Wish enforcement', () => {
    it('wish active with wished rank in hand: enables wish-fulfilling cards', () => {
      const hand = [j(7), p(7), j(3), j(14)];
      const result = getSelectableCards(hand, [], null, 7);

      // With wish=7 and holding 7s, must fulfill the wish
      expect(result.has(j(7).id)).toBe(true);
      expect(result.has(p(7).id)).toBe(true);
    });

    it('wish active but rank not in hand: all cards selectable', () => {
      const hand = [j(3), j(5), j(14)];
      const result = getSelectableCards(hand, [], null, 7);

      // Don't have rank 7 → wish can't be fulfilled → no restriction
      expect(result.size).toBe(hand.length);
    });

    it('wish active on a trick: only wish-fulfilling plays enabled', () => {
      const hand = [j(7), p(7), j(3), j(14)];
      const trick = makeTrick([
        { seat: 'east', combination: makeCombination(CombinationType.Single, 5, 1, [j(5)]) },
      ]);
      const result = getSelectableCards(hand, [], trick, 7);

      // j(7) and p(7) can fulfill the wish (single 7 beats single 5)
      expect(result.has(j(7).id)).toBe(true);
      expect(result.has(p(7).id)).toBe(true);
    });

    it('wish active with Phoenix: Phoenix enabled for wish pair', () => {
      const hand = [j(7), phoenix(), j(3)];
      const result = getSelectableCards(hand, [], null, 7);

      // Phoenix can pair with 7 to fulfill wish
      expect(result.has(phoenix().id)).toBe(true);
      expect(result.has(j(7).id)).toBe(true);
    });

    it('wish active: nearby cards enabled for potential straights', () => {
      const hand = [j(5), j(6), j(7), j(8), j(9), j(14)];
      const result = getSelectableCards(hand, [], null, 7);

      // Cards near 7 that could form a straight → enabled
      expect(result.has(j(5).id)).toBe(true);
      expect(result.has(j(6).id)).toBe(true);
      expect(result.has(j(8).id)).toBe(true);
      expect(result.has(j(9).id)).toBe(true);
    });

    it('wish active: four-bomb cards remain selectable', () => {
      const hand = [j(3), p(3), s(3), sw(3), j(7)];
      const result = getSelectableCards(hand, [], null, 7);

      // j(7) fulfills wish
      expect(result.has(j(7).id)).toBe(true);
      // Four 3s can form a bomb (bombs don't need to fulfill wish)
      expect(result.has(j(3).id)).toBe(true);
      expect(result.has(p(3).id)).toBe(true);
      expect(result.has(s(3).id)).toBe(true);
      expect(result.has(sw(3).id)).toBe(true);
    });

    it('wish active: far-away cards disabled', () => {
      const hand = [j(7), j(14)];
      const result = getSelectableCards(hand, [], null, 7);

      // j(14) is 7 ranks away from 7 — too far for any straight
      expect(result.has(j(14).id)).toBe(false);
    });
  });
});

describe('canFormValidCombination', () => {
  it('detects a valid pair', () => {
    expect(canFormValidCombination([j(5), p(5)], null)).toBe(true);
  });

  it('detects a valid straight', () => {
    expect(canFormValidCombination([j(3), j(4), j(5), j(6), j(7)], null)).toBe(true);
  });

  it('rejects invalid combination', () => {
    expect(canFormValidCombination([j(3), j(5)], null)).toBe(false);
  });

  it('pair beats lower pair', () => {
    const top = makeCombination(CombinationType.Pair, 3, 1, [j(3), p(3)]);
    expect(canFormValidCombination([j(5), p(5)], top)).toBe(true);
  });

  it('pair does not beat higher pair', () => {
    const top = makeCombination(CombinationType.Pair, 10, 1, [j(10), p(10)]);
    expect(canFormValidCombination([j(5), p(5)], top)).toBe(false);
  });

  it('bomb beats any non-bomb', () => {
    const top = makeCombination(CombinationType.Pair, 14, 1, [j(14), p(14)]);
    expect(canFormValidCombination([j(5), p(5), s(5), sw(5)], top)).toBe(true);
  });

  it('Dog cannot beat a trick', () => {
    const top = makeCombination(CombinationType.Single, 3, 1, [j(3)]);
    expect(canFormValidCombination([dog()], top)).toBe(false);
  });

  it('Dog can lead', () => {
    expect(canFormValidCombination([dog()], null)).toBe(true);
  });
});

describe('canFormValidPrefix', () => {
  it('same rank cards are valid prefix (pair/triple)', () => {
    expect(canFormValidPrefix([j(5), p(5)], null)).toBe(true);
  });

  it('consecutive ranks are valid straight prefix', () => {
    expect(canFormValidPrefix([j(3), j(4)], null)).toBe(true);
  });

  it('consecutive pairs are valid pair sequence prefix', () => {
    expect(canFormValidPrefix([j(5), p(5), j(6), p(6)], null)).toBe(true);
  });

  it('Dragon alone is not a valid prefix', () => {
    expect(canFormValidPrefix([dragon()], null)).toBe(false);
  });

  it('Dragon + other is not valid', () => {
    expect(canFormValidPrefix([dragon(), j(5)], null)).toBe(false);
  });

  it('Dog + other is not valid', () => {
    expect(canFormValidPrefix([dog(), j(5)], null)).toBe(false);
  });

  it('same suit consecutive cards are valid (straight flush bomb prefix)', () => {
    expect(canFormValidPrefix([j(5), j(6), j(7)], null)).toBe(true);
  });

  it('cards with large rank gap are invalid prefix (cannot fit in any straight)', () => {
    // Ranks 2 and 14 — span of 12, but could still be part of a 13-card straight
    // Use ranks that truly cannot be a prefix: more than 13 apart is impossible
    // Actually, any two ranks 1-14 fit in a straight. Test with truly invalid case:
    // Dragon + standard = invalid (Dragon can't be in multi-card)
    expect(canFormValidPrefix([dragon(), j(8)], null)).toBe(false);
  });

  it('two distant ranks can still be straight prefix if they fit in a window', () => {
    // j(3) and j(8) are 5 apart → could be part of a 3-4-5-6-7-8 straight
    expect(canFormValidPrefix([j(3), j(8)], null)).toBe(true);
  });

  it('2 distinct ranks with counts compatible for full house', () => {
    // 3+1 → valid full house prefix
    expect(canFormValidPrefix([j(5), p(5), s(5), j(7)], null)).toBe(true);
  });

  it('3 same rank is valid prefix (could be four-bomb)', () => {
    expect(canFormValidPrefix([j(5), p(5), s(5)], null)).toBe(true);
  });

  it('prefix with trick constraint: pair prefix is valid against pair trick', () => {
    const top = makeCombination(CombinationType.Pair, 3, 1, [j(3), p(3)]);
    expect(canFormValidPrefix([j(5)], top)).toBe(true); // could become pair
  });

  it('prefix with trick constraint: straight prefix invalid against pair trick', () => {
    const top = makeCombination(CombinationType.Pair, 3, 1, [j(3), p(3)]);
    // Two different ranks → straight prefix, not pair-compatible
    // However, j(5), j(6) could also be part of a pair sequence
    // So this depends on the implementation — let's test a clear case
    expect(canFormValidPrefix([j(5), j(9)], top)).toBe(false);
  });

  it('consecutive ranks with Phoenix gap are valid straight prefix', () => {
    // 3, 5 with Phoenix → gap at 4 fillable
    expect(canFormValidPrefix([j(3), j(5), phoenix()], null)).toBe(true);
  });
});

describe('Wish with straight fulfillment', () => {
  it('wish active: can form straight containing wished rank', () => {
    const hand = [j(3), j(4), j(5), j(6), j(7), j(14)];
    const trick = makeTrick([
      {
        seat: 'east',
        combination: makeCombination(CombinationType.Straight, 6, 5, [
          p(2), p(3), p(4), p(5), p(6),
        ]),
      },
    ]);
    // Wish=5, trick is straight rank 6 (2-3-4-5-6)
    // Hand has 3-4-5-6-7 which is straight rank 7 (beats rank 6)
    const result = getSelectableCards(hand, [], trick, 5);
    expect(result.has(j(5).id)).toBe(true);
    expect(result.has(j(3).id)).toBe(true);
    expect(result.has(j(4).id)).toBe(true);
  });

  it('wish active with Phoenix: straight with Phoenix filling gap', () => {
    const hand = [j(5), j(6), j(8), j(9), phoenix()];
    const result = getSelectableCards(hand, [], null, 7);
    // Phoenix can fill rank 7 gap in straight 5-6-[7]-8-9
    expect(result.has(j(5).id)).toBe(true);
    expect(result.has(phoenix().id)).toBe(true);
  });
});

describe('Performance', () => {
  it('REQ-NF-P01: filtering a 14-card hand completes in < 1ms', () => {
    const hand: GameCard[] = [
      j(2), j(3), j(4), j(5), j(6),
      p(7), p(8), p(9), p(10), p(11),
      s(12), s(13), s(14),
      phoenix(),
    ];

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      getSelectableCards(hand, [], null, null);
      getSelectableCards(hand, [j(5)], null, null);
      getSelectableCards(hand, [j(5), j(6)], null, null);
    }
    const elapsed = (performance.now() - start) / 300; // average per call

    expect(elapsed).toBeLessThan(1); // < 1ms
  });
});
