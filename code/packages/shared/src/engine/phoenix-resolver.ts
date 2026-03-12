// REQ-F-PH01: Phoenix never forms bomb
// REQ-F-PH02: Phoenix never acts as Dragon, Dog, or Mahjong
// REQ-F-PH03: Phoenix value >= 2 in combinations
// REQ-F-PH04: Leading single Phoenix = 1.5
// REQ-F-PH05: Phoenix on trick = leader + 0.5
// REQ-F-PH06: Auto-determine Phoenix when unambiguous
// REQ-F-PH07: Present only valid Phoenix options
// REQ-F-PH08: Phoenix in straight starting with 2

import type { GameCard, Rank } from '../types/card.js';
import { isPhoenix, isStandard, isDragon, isDog, isMahjong } from '../types/card.js';
import type { TrickState } from '../types/game.js';
import { PHOENIX_SINGLE_VALUE, MAHJONG_RANK } from '../constants.js';

/** Result of resolving Phoenix values for a card selection */
export type PhoenixResolution =
  | { status: 'not_present' }
  | { status: 'auto'; value: number }
  | { status: 'choose'; validValues: number[] }
  | { status: 'single_lead'; value: 1.5 }
  | { status: 'single_ontrick'; value: number }
  | { status: 'invalid' };

/**
 * REQ-F-PH06: Determine valid Phoenix values for a card selection.
 *
 * Given a set of selected cards (which may include the Phoenix) and the
 * current trick state, returns the resolution:
 * - not_present: no Phoenix in selection
 * - auto: exactly one valid value (pair, triple, gap-fill straight, etc.)
 * - choose: multiple valid values (2+2 full house, open-ended straight)
 * - single_lead: Phoenix played alone as lead (value 1.5)
 * - single_ontrick: Phoenix played alone on existing trick (leader + 0.5)
 * - invalid: would form a bomb or violate rules
 */
export function resolvePhoenixValues(
  selectedCards: GameCard[],
  currentTrick: TrickState | null,
): PhoenixResolution {
  const phoenixCards = selectedCards.filter((gc) => isPhoenix(gc.card));
  if (phoenixCards.length === 0) {
    return { status: 'not_present' };
  }

  // REQ-F-PH02: Phoenix cannot be combined with Dragon or Dog
  if (selectedCards.some((gc) => isDragon(gc.card) || isDog(gc.card))) {
    return { status: 'invalid' };
  }

  const nonPhoenix = selectedCards.filter((gc) => !isPhoenix(gc.card));

  // --- Single Phoenix ---
  if (selectedCards.length === 1) {
    return resolveSinglePhoenix(currentTrick);
  }

  // --- Pair (2 cards, 1 non-Phoenix) ---
  if (selectedCards.length === 2 && nonPhoenix.length === 1) {
    return resolvePairPhoenix(nonPhoenix);
  }

  // --- Triple (3 cards, 2 non-Phoenix) ---
  if (selectedCards.length === 3 && nonPhoenix.length === 2) {
    return resolveTriplePhoenix(nonPhoenix);
  }

  // --- 4 cards with Phoenix (pair sequence or would-be bomb) ---
  if (selectedCards.length === 4 && nonPhoenix.length === 3) {
    const pairSeq = resolvePairSequencePhoenix(nonPhoenix, selectedCards.length);
    if (pairSeq.status !== 'invalid') return pairSeq;
    return resolveThreeWithPhoenix(nonPhoenix);
  }

  // --- 5 cards with Phoenix (full house or straight) ---
  if (selectedCards.length === 5 && nonPhoenix.length === 4) {
    const fh = resolveFullHousePhoenix(nonPhoenix);
    if (fh.status !== 'invalid') return fh;
    return resolveStraightPhoenix(nonPhoenix, selectedCards.length);
  }

  // --- 6+ cards with Phoenix (pair sequence or straight) ---
  if (selectedCards.length >= 6 && nonPhoenix.length === selectedCards.length - 1) {
    if (selectedCards.length % 2 === 0) {
      const pairSeq = resolvePairSequencePhoenix(nonPhoenix, selectedCards.length);
      if (pairSeq.status !== 'invalid') return pairSeq;
    }
    return resolveStraightPhoenix(nonPhoenix, selectedCards.length);
  }

  return { status: 'invalid' };
}

// --- Single ---

/** REQ-F-PH04, REQ-F-PH05: Single Phoenix resolution */
function resolveSinglePhoenix(currentTrick: TrickState | null): PhoenixResolution {
  if (!currentTrick || currentTrick.plays.length === 0) {
    // REQ-F-PH04: Leading single = 1.5
    return { status: 'single_lead', value: PHOENIX_SINGLE_VALUE as 1.5 };
  }
  // REQ-F-PH05: On existing trick = current winner's rank + 0.5
  const topPlay = currentTrick.plays[currentTrick.plays.length - 1];
  const topRank = topPlay.combination.rank;
  return { status: 'single_ontrick', value: topRank + 0.5 };
}

// --- Pair ---

/** REQ-F-PH06: Phoenix + 1 card = auto pair at that rank */
function resolvePairPhoenix(nonPhoenix: GameCard[]): PhoenixResolution {
  const card = nonPhoenix[0].card;
  // REQ-F-PH02: Cannot pair with specials
  if (!isStandard(card)) return { status: 'invalid' };
  return { status: 'auto', value: card.rank };
}

// --- Triple ---

/** REQ-F-PH06: Phoenix + 2 same-rank cards = auto triple */
function resolveTriplePhoenix(nonPhoenix: GameCard[]): PhoenixResolution {
  // Both must be standard and same rank
  if (!nonPhoenix.every((gc) => isStandard(gc.card))) return { status: 'invalid' };
  const r0 = (nonPhoenix[0].card as { rank: Rank }).rank;
  const r1 = (nonPhoenix[1].card as { rank: Rank }).rank;
  if (r0 !== r1) return { status: 'invalid' };
  return { status: 'auto', value: r0 };
}

// --- Full House ---

/** REQ-F-PH06, REQ-F-PH07: Full house with Phoenix */
function resolveFullHousePhoenix(nonPhoenix: GameCard[]): PhoenixResolution {
  // All 4 must be standard (no specials in full houses)
  if (!nonPhoenix.every((gc) => isStandard(gc.card))) return { status: 'invalid' };

  const rankCounts = new Map<Rank, number>();
  for (const gc of nonPhoenix) {
    const r = (gc.card as { rank: Rank }).rank;
    rankCounts.set(r, (rankCounts.get(r) ?? 0) + 1);
  }

  const entries = [...rankCounts.entries()];

  if (entries.length === 2) {
    const [e0, e1] = entries;
    // 3+1: Phoenix completes the pair side → auto at the single's rank
    if (e0[1] === 3 && e1[1] === 1) {
      return { status: 'auto', value: e1[0] };
    }
    if (e0[1] === 1 && e1[1] === 3) {
      return { status: 'auto', value: e0[0] };
    }
    // 2+2: Phoenix could join either pair → choose
    // REQ-F-PH07: Present only valid options (both ranks)
    if (e0[1] === 2 && e1[1] === 2) {
      const values = [e0[0], e1[0]].sort((a, b) => a - b);
      return { status: 'choose', validValues: values };
    }
  }

  // 4 of same rank + Phoenix → would be 4-bomb territory → invalid (REQ-F-PH01)
  return { status: 'invalid' };
}

// --- Three cards + Phoenix (4 total, could be pair sequence or invalid bomb) ---

function resolveThreeWithPhoenix(nonPhoenix: GameCard[]): PhoenixResolution {
  if (!nonPhoenix.every((gc) => isStandard(gc.card))) return { status: 'invalid' };

  const rankCounts = new Map<Rank, number>();
  for (const gc of nonPhoenix) {
    const r = (gc.card as { rank: Rank }).rank;
    rankCounts.set(r, (rankCounts.get(r) ?? 0) + 1);
  }

  const entries = [...rankCounts.entries()].sort((a, b) => a[0] - b[0]);

  // 3 of same rank + Phoenix → would form four-of-a-kind → invalid (REQ-F-PH01)
  if (entries.length === 1 && entries[0][1] === 3) {
    return { status: 'invalid' };
  }

  // Pair sequence: 2 consecutive ranks, one pair + one single, Phoenix completes the single
  if (entries.length === 2) {
    const [low, high] = entries;
    if (Math.abs(high[0] - low[0]) === 1) {
      const singles = entries.filter((e) => e[1] === 1);
      const pairs = entries.filter((e) => e[1] === 2);
      if (singles.length === 1 && pairs.length === 1) {
        return { status: 'auto', value: singles[0][0] };
      }
    }
  }

  return { status: 'invalid' };
}

// --- Pair Sequence ---

/** REQ-F-PH06: Pair sequence with Phoenix completing one pair */
function resolvePairSequencePhoenix(
  nonPhoenix: GameCard[],
  totalCards: number,
): PhoenixResolution {
  // All non-Phoenix must be standard
  if (!nonPhoenix.every((gc) => isStandard(gc.card))) return { status: 'invalid' };

  // Must also check if this is a valid straight (5+ cards); pair sequence takes priority for even counts
  const numPairs = totalCards / 2;

  const rankCounts = new Map<Rank, number>();
  for (const gc of nonPhoenix) {
    const r = (gc.card as { rank: Rank }).rank;
    rankCounts.set(r, (rankCounts.get(r) ?? 0) + 1);
  }

  const entries = [...rankCounts.entries()].sort((a, b) => a[0] - b[0]);

  // We need numPairs consecutive ranks. Phoenix completes one pair (count 1 → 2).
  // So we expect: numPairs ranks, (numPairs-1) with count 2, one with count 1
  const singles = entries.filter((e) => e[1] === 1);
  const pairs = entries.filter((e) => e[1] === 2);

  if (singles.length === 1 && pairs.length === numPairs - 1 && entries.length === numPairs) {
    // Verify consecutive ranks
    const allRanks = entries.map((e) => e[0]).sort((a, b) => a - b);
    let consecutive = true;
    for (let i = 1; i < allRanks.length; i++) {
      if (allRanks[i] - allRanks[i - 1] !== 1) {
        consecutive = false;
        break;
      }
    }
    if (consecutive) {
      return { status: 'auto', value: singles[0][0] };
    }
  }

  // Not a valid pair sequence with Phoenix → fall through to straight check
  return { status: 'invalid' };
}

// --- Straight ---

/**
 * REQ-F-PH03, REQ-F-PH06, REQ-F-PH07, REQ-F-PH08: Straight with Phoenix.
 * Phoenix fills a gap or extends the straight. Value >= 2 always.
 */
function resolveStraightPhoenix(
  nonPhoenix: GameCard[],
  expectedLength: number,
): PhoenixResolution {
  // No Dragon or Dog (already checked above), but verify standard/Mahjong only
  if (
    nonPhoenix.some(
      (gc) => !isStandard(gc.card) && !isMahjong(gc.card),
    )
  ) {
    return { status: 'invalid' };
  }

  // REQ-F-PH01: Check if all non-Phoenix cards are same suit → would form straight flush bomb
  const standardCards = nonPhoenix.filter((gc) => isStandard(gc.card));
  if (standardCards.length === nonPhoenix.length && standardCards.length >= 4) {
    const suits = standardCards.map((gc) => (gc.card as { suit: string }).suit);
    if (new Set(suits).size === 1) {
      // All same suit — Phoenix would create a straight flush bomb → invalid
      return { status: 'invalid' };
    }
  }

  // Get ranks of non-Phoenix cards
  const ranks = nonPhoenix.map((gc) => {
    if (isMahjong(gc.card)) return MAHJONG_RANK;
    return (gc.card as { rank: Rank }).rank;
  });

  // Check for duplicate ranks
  if (new Set(ranks).size !== ranks.length) return { status: 'invalid' };

  const sorted = [...ranks].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const span = max - min + 1;
  const numNonPhoenix = nonPhoenix.length; // expectedLength - 1

  // Case 1: Phoenix fills an internal gap (span === expectedLength)
  // Case 2: Phoenix extends at one end (span === expectedLength - 1)
  // Case 3: span < expectedLength - 1 or span > expectedLength → invalid

  const candidates: number[] = [];

  if (span === expectedLength) {
    // Internal gap — find the missing rank
    for (let r = min; r <= max; r++) {
      if (!(ranks as number[]).includes(r)) {
        // REQ-F-PH03: value >= 2
        if (r >= 2) {
          candidates.push(r);
        }
      }
    }
    // There should be exactly one gap
    if (candidates.length !== 1) return { status: 'invalid' };
  } else if (span === numNonPhoenix) {
    // All non-Phoenix are consecutive — Phoenix extends at one end
    // REQ-F-PH08: Can't go below 2
    const lowExtend = min - 1;
    const highExtend = max + 1;

    if (lowExtend >= 2) {
      candidates.push(lowExtend);
    }
    if (highExtend <= 14) {
      candidates.push(highExtend);
    }
  } else {
    return { status: 'invalid' };
  }

  if (candidates.length === 0) return { status: 'invalid' };
  if (candidates.length === 1) return { status: 'auto', value: candidates[0] };

  // REQ-F-PH07: Present only valid options
  return { status: 'choose', validValues: candidates.sort((a, b) => a - b) };
}
