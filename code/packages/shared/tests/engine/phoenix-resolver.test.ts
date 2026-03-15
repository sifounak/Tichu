// Verifies: REQ-F-PH01, REQ-F-PH02, REQ-F-PH03, REQ-F-PH04, REQ-F-PH05,
//           REQ-F-PH06, REQ-F-PH07, REQ-F-PH08

import { describe, it, expect } from 'vitest';
import { resolvePhoenixValues } from '../../src/engine/phoenix-resolver.js';
import type { PhoenixResolution } from '../../src/engine/phoenix-resolver.js';
import type { GameCard, Rank } from '../../src/types/card.js';
import { Suit } from '../../src/types/card.js';
import { CombinationType } from '../../src/types/combination.js';
import type { TrickState } from '../../src/types/game.js';

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

// Shorthand for suits
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

/** Create a minimal TrickState with a single play at the given rank */
function trickWithTopRank(rank: number): TrickState {
  return {
    plays: [
      {
        seat: 'north',
        combination: {
          type: CombinationType.Single,
          cards: [],
          rank,
          length: 1,
          isBomb: false,
        },
      },
    ],
    passes: [],
    leadSeat: 'north',
    currentWinner: 'north',
  };
}

describe('resolvePhoenixValues', () => {
  // --- No Phoenix ---

  describe('no Phoenix in selection', () => {
    it('returns not_present when Phoenix is absent', () => {
      const result = resolvePhoenixValues([j(5), j(6)], null);
      expect(result.status).toBe('not_present');
    });
  });

  // --- Single Phoenix ---

  describe('single Phoenix', () => {
    // Verifies: REQ-F-PH04
    it('returns single_lead with value 1.5 when leading', () => {
      const result = resolvePhoenixValues([phoenix()], null);
      expect(result).toEqual({ status: 'single_lead', value: 1.5 });
    });

    it('returns single_lead with value 1.5 on empty trick', () => {
      const emptyTrick: TrickState = {
        plays: [],
        passes: [],
        leadSeat: 'north',
        currentWinner: 'north',
      };
      const result = resolvePhoenixValues([phoenix()], emptyTrick);
      expect(result).toEqual({ status: 'single_lead', value: 1.5 });
    });

    // Verifies: REQ-F-PH05
    it('returns single_ontrick with leader + 0.5 when trick has a 7', () => {
      const result = resolvePhoenixValues([phoenix()], trickWithTopRank(7));
      expect(result).toEqual({ status: 'single_ontrick', value: 7.5 });
    });

    it('returns single_ontrick with leader + 0.5 when trick has an Ace (14)', () => {
      const result = resolvePhoenixValues([phoenix()], trickWithTopRank(14));
      expect(result).toEqual({ status: 'single_ontrick', value: 14.5 });
    });

    // Verifies: REQ-F-PD01 — Phoenix cannot beat Dragon
    it('returns invalid when Dragon (rank 25) is on the trick', () => {
      const result = resolvePhoenixValues([phoenix()], trickWithTopRank(25));
      expect(result.status).toBe('invalid');
    });

    it('returns single_ontrick with value 13.5 when King (rank 13) is on the trick', () => {
      const result = resolvePhoenixValues([phoenix()], trickWithTopRank(13));
      expect(result).toEqual({ status: 'single_ontrick', value: 13.5 });
    });
  });

  // --- Pair ---

  describe('pair with Phoenix', () => {
    // Verifies: REQ-F-PH06
    it('auto-resolves Phoenix + 5♠ to value 5', () => {
      const result = resolvePhoenixValues([phoenix(), s(5)], null);
      expect(result).toEqual({ status: 'auto', value: 5 });
    });

    it('auto-resolves Phoenix + Ace to value 14', () => {
      const result = resolvePhoenixValues([phoenix(), j(14)], null);
      expect(result).toEqual({ status: 'auto', value: 14 });
    });

    // Verifies: REQ-F-PH02
    it('returns invalid for Phoenix + Dragon', () => {
      const result = resolvePhoenixValues([phoenix(), dragon()], null);
      expect(result.status).toBe('invalid');
    });

    it('returns invalid for Phoenix + Dog', () => {
      const result = resolvePhoenixValues([phoenix(), dog()], null);
      expect(result.status).toBe('invalid');
    });

    it('returns invalid for Phoenix + Mahjong', () => {
      const result = resolvePhoenixValues([phoenix(), mahjong()], null);
      expect(result.status).toBe('invalid');
    });
  });

  // --- Triple ---

  describe('triple with Phoenix', () => {
    // Verifies: REQ-F-PH06
    it('auto-resolves Phoenix + 8♠ + 8♦ to value 8', () => {
      const result = resolvePhoenixValues([phoenix(), s(8), sw(8)], null);
      expect(result).toEqual({ status: 'auto', value: 8 });
    });

    it('returns invalid for Phoenix + two different ranks', () => {
      const result = resolvePhoenixValues([phoenix(), j(5), j(6)], null);
      expect(result.status).toBe('invalid');
    });
  });

  // --- Full House ---

  describe('full house with Phoenix', () => {
    // Verifies: REQ-F-PH06
    it('auto-resolves 3+1+Phoenix: [K,K,K,5,Phoenix] → auto 5', () => {
      const result = resolvePhoenixValues(
        [j(13), p(13), s(13), j(5), phoenix()],
        null,
      );
      expect(result).toEqual({ status: 'auto', value: 5 });
    });

    // Verifies: REQ-F-PH07
    it('choose for 2+2+Phoenix: [K,K,5,5,Phoenix] → choose [5, 13]', () => {
      const result = resolvePhoenixValues(
        [j(13), p(13), j(5), p(5), phoenix()],
        null,
      );
      expect(result.status).toBe('choose');
      expect((result as { validValues: number[] }).validValues).toEqual([5, 13]);
    });

    // Verifies: REQ-F-PH01
    it('returns invalid for 4-of-a-kind + Phoenix', () => {
      // 4 Kings + Phoenix is not a valid full house
      const result = resolvePhoenixValues(
        [j(13), p(13), s(13), sw(13), phoenix()],
        null,
      );
      expect(result.status).toBe('invalid');
    });

    // Verifies: REQ-F-RT01 — Official FAQ: "Is 3,3,3,3,Phoenix a valid full house? No."
    it('returns invalid for [3,3,3,3,Phoenix]', () => {
      const result = resolvePhoenixValues(
        [j(3), p(3), s(3), sw(3), phoenix()],
        null,
      );
      expect(result.status).toBe('invalid');
    });

    // Verifies: REQ-F-RT02 — Generalized 4-of-kind + Phoenix
    it('returns invalid for [7,7,7,7,Phoenix]', () => {
      const result = resolvePhoenixValues(
        [j(7), p(7), s(7), sw(7), phoenix()],
        null,
      );
      expect(result.status).toBe('invalid');
    });
  });

  // --- Straight ---

  describe('straight with Phoenix', () => {
    // Verifies: REQ-F-PH06
    it('auto-resolves gap: [3,4,6,7,Phoenix] → auto 5', () => {
      const result = resolvePhoenixValues(
        [j(3), p(4), j(6), p(7), phoenix()],
        null,
      );
      expect(result).toEqual({ status: 'auto', value: 5 });
    });

    // Verifies: REQ-F-PH07
    it('choose for open-ended: [3,4,5,6,Phoenix] → choose [2, 7]', () => {
      const result = resolvePhoenixValues(
        [j(3), p(4), s(5), j(6), phoenix()],
        null,
      );
      expect(result.status).toBe('choose');
      expect((result as { validValues: number[] }).validValues).toEqual([2, 7]);
    });

    // Verifies: REQ-F-PH08
    it('auto-resolves starting with 2: [2,3,4,5,Phoenix] → auto 6', () => {
      const result = resolvePhoenixValues(
        [j(2), p(3), s(4), j(5), phoenix()],
        null,
      );
      expect(result).toEqual({ status: 'auto', value: 6 });
    });

    // Verifies: REQ-F-PH02, REQ-F-PH03
    it('auto-resolves with Mahjong: [Mahjong,2,3,4,Phoenix] → auto 5', () => {
      const result = resolvePhoenixValues(
        [mahjong(), j(2), p(3), s(4), phoenix()],
        null,
      );
      expect(result).toEqual({ status: 'auto', value: 5 });
    });

    // Verifies: REQ-F-PH01
    it('returns invalid for straight flush: all same suit + Phoenix', () => {
      // [3♠,4♠,5♠,6♠,Phoenix] would form a straight flush bomb → invalid
      const result = resolvePhoenixValues(
        [s(3), s(4), s(5), s(6), phoenix()],
        null,
      );
      expect(result.status).toBe('invalid');
    });

    it('choose for mid-range: [10,J,Q,K,Phoenix] → choose [9, 14]', () => {
      // Both extend-low (9) and extend-high (14/Ace) are valid
      const result = resolvePhoenixValues(
        [j(10), p(11), s(12), j(13), phoenix()],
        null,
      );
      expect(result.status).toBe('choose');
      expect((result as { validValues: number[] }).validValues).toEqual([9, 14]);
    });

    it('auto-resolves for Ace-high no extend above: [J,Q,K,A,Phoenix] → auto 10', () => {
      // min=11, max=14, span=4, numNonPhoenix=4, expectedLength=5
      // span === numNonPhoenix → extends: lowExtend=10 (>=2 ✓), highExtend=15 (>14 ✗)
      const result = resolvePhoenixValues(
        [j(11), p(12), s(13), j(14), phoenix()],
        null,
      );
      expect(result).toEqual({ status: 'auto', value: 10 });
    });

    it('returns invalid for duplicate ranks in non-Phoenix cards', () => {
      const result = resolvePhoenixValues(
        [j(5), p(5), s(6), j(7), phoenix()],
        null,
      );
      // Duplicate rank 5 → not a valid straight
      expect(result.status).toBe('invalid');
    });

    it('handles longer straight with gap: [3,4,5,7,8,Phoenix] → auto 6', () => {
      const result = resolvePhoenixValues(
        [j(3), p(4), s(5), j(7), p(8), phoenix()],
        null,
      );
      expect(result).toEqual({ status: 'auto', value: 6 });
    });

    it('returns invalid when span is too large: [2,4,7,9,Phoenix] → invalid', () => {
      // span=8, expectedLength=5, numNonPhoenix=4 — neither case matches
      const result = resolvePhoenixValues(
        [j(2), p(4), s(7), j(9), phoenix()],
        null,
      );
      expect(result.status).toBe('invalid');
    });

    it('returns invalid for 6-card same-suit straight flush with Phoenix', () => {
      // [3♠,4♠,5♠,6♠,7♠,Phoenix] → 5 same suit → would be SF bomb → invalid
      const result = resolvePhoenixValues(
        [s(3), s(4), s(5), s(6), s(7), phoenix()],
        null,
      );
      expect(result.status).toBe('invalid');
    });
  });

  // --- Pair Sequence ---

  describe('pair sequence with Phoenix', () => {
    // Verifies: REQ-F-PH06
    it('auto-resolves: [3,3,4,4,5,Phoenix] → auto 5', () => {
      const result = resolvePhoenixValues(
        [j(3), p(3), j(4), p(4), j(5), phoenix()],
        null,
      );
      expect(result).toEqual({ status: 'auto', value: 5 });
    });

    it('auto-resolves: [7,7,8,Phoenix] → auto 8', () => {
      const result = resolvePhoenixValues(
        [j(7), p(7), j(8), phoenix()],
        null,
      );
      expect(result).toEqual({ status: 'auto', value: 8 });
    });

    it('returns invalid for non-consecutive pair sequence', () => {
      // [3,3,5,5,7,Phoenix] → ranks 3,5,7 are not consecutive
      const result = resolvePhoenixValues(
        [j(3), p(3), j(5), p(5), j(7), phoenix()],
        null,
      );
      // This is neither a valid pair sequence nor a valid straight (duplicates)
      expect(result.status).toBe('invalid');
    });
  });

  // --- Would form bomb ---

  describe('would form bomb', () => {
    // Verifies: REQ-F-PH01
    it('returns invalid for three-of-a-kind + Phoenix (would be four-bomb)', () => {
      const result = resolvePhoenixValues(
        [j(13), p(13), s(13), phoenix()],
        null,
      );
      expect(result.status).toBe('invalid');
    });
  });

  // --- Context-aware filtering (trick top eliminates invalid choices) ---

  describe('context-aware filtering against trick', () => {
    it('FH 2+2 where only higher triple beats trick → auto-resolves', () => {
      // Trick top: FH rank 4 (triple of 4s)
      const trick: TrickState = {
        plays: [{
          seat: 'north',
          combination: {
            type: CombinationType.FullHouse, cards: [], rank: 4, length: 1, isBomb: false,
          },
        }],
        passes: [],
        leadSeat: 'north',
        currentWinner: 'north',
      };
      // Player plays [3,3,9,9,Phoenix] → choose [3, 9]
      // FH rank 3 < trick rank 4 → invalid; FH rank 9 > 4 → valid
      const result = resolvePhoenixValues([j(3), p(3), j(9), p(9), phoenix()], trick);
      expect(result).toEqual({ status: 'auto', value: 9 });
    });

    it('FH 2+2 where neither beats trick → invalid', () => {
      const trick: TrickState = {
        plays: [{
          seat: 'north',
          combination: {
            type: CombinationType.FullHouse, cards: [], rank: 14, length: 1, isBomb: false,
          },
        }],
        passes: [],
        leadSeat: 'north',
        currentWinner: 'north',
      };
      // Player plays [3,3,9,9,Phoenix] → choose [3, 9], both < 14
      const result = resolvePhoenixValues([j(3), p(3), j(9), p(9), phoenix()], trick);
      expect(result.status).toBe('invalid');
    });

    it('FH 2+2 when leading → still returns choose (both valid)', () => {
      const result = resolvePhoenixValues([j(3), p(3), j(9), p(9), phoenix()], null);
      expect(result.status).toBe('choose');
      expect((result as { validValues: number[] }).validValues).toEqual([3, 9]);
    });

    it('straight extension where only top-extend beats trick → auto-resolves', () => {
      // Trick top: straight rank 8 (highest card = 8), length 5
      const trick: TrickState = {
        plays: [{
          seat: 'north',
          combination: {
            type: CombinationType.Straight, cards: [], rank: 8, length: 5, isBomb: false,
          },
        }],
        passes: [],
        leadSeat: 'north',
        currentWinner: 'north',
      };
      // Player plays [5,6,7,8,Phoenix] → choose [4, 9]
      // Phoenix=4 → straight 4-8, rank 8 (can't beat rank 8, same rank)
      // Phoenix=9 → straight 5-9, rank 9 (beats rank 8)
      const result = resolvePhoenixValues([j(5), p(6), s(7), j(8), phoenix()], trick);
      expect(result).toEqual({ status: 'auto', value: 9 });
    });

    it('straight extension when leading → still returns choose', () => {
      const result = resolvePhoenixValues([j(5), p(6), s(7), j(8), phoenix()], null);
      expect(result.status).toBe('choose');
      expect((result as { validValues: number[] }).validValues).toEqual([4, 9]);
    });

    it('straight extension where neither beats trick → invalid', () => {
      // Trick top: straight rank 14, length 5
      const trick: TrickState = {
        plays: [{
          seat: 'north',
          combination: {
            type: CombinationType.Straight, cards: [], rank: 14, length: 5, isBomb: false,
          },
        }],
        passes: [],
        leadSeat: 'north',
        currentWinner: 'north',
      };
      // Player plays [5,6,7,8,Phoenix] → choose [4, 9], both < 14
      const result = resolvePhoenixValues([j(5), p(6), s(7), j(8), phoenix()], trick);
      expect(result.status).toBe('invalid');
    });
  });

  // --- Edge cases ---

  describe('edge cases', () => {
    it('returns not_present for empty selection', () => {
      const result = resolvePhoenixValues([], null);
      expect(result.status).toBe('not_present');
    });

    it('handles Phoenix with Mahjong in pair position → invalid', () => {
      const result = resolvePhoenixValues([phoenix(), mahjong()], null);
      expect(result.status).toBe('invalid');
    });

    it('straight with Mahjong and gap at low end: [Mahjong,3,4,5,Phoenix] → auto 2', () => {
      const result = resolvePhoenixValues(
        [mahjong(), j(3), p(4), s(5), phoenix()],
        null,
      );
      // min=1, max=5, span=5=expectedLength → internal gap at rank 2
      expect(result).toEqual({ status: 'auto', value: 2 });
    });
  });
});
