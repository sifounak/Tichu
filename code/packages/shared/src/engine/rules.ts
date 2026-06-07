// REQ-F-GF04: Wish enforcement in play validation
// REQ-F-CB01: Combination detection chain
// REQ-F-CB02: Combination comparison in validation

import type { GameCard, Rank } from '../types/card.js';
import { isDog, isPhoenix, isStandard } from '../types/card.js';
import type { Combination } from '../types/combination.js';
import type { TrickState } from '../types/game.js';
import { detectCombination } from './combination-detector.js';
import { canBeat } from './combination-validator.js';
import { getAllValidPlays } from './combination-utils.js';
import { canFulfillWish, isWishFulfilled } from './wish.js';

/** Result of validating a play attempt */
export type PlayValidation =
  | { valid: true; combination: Combination }
  | { valid: false; reason: string };

/**
 * Get the current top combination from a trick.
 * Returns the last non-pass play's combination, or null if no plays.
 */
function getTrickTop(trick: TrickState | null): Combination | null {
  if (!trick || trick.plays.length === 0) return null;
  return trick.plays[trick.plays.length - 1].combination;
}

/**
 * Validate a play: detect combination, check it beats the trick, enforce wish.
 *
 * Chains: detectCombination → canBeat → wish check
 *
 * @param cards - The cards the player wants to play
 * @param hand - The player's full hand (for wish enforcement)
 * @param currentTrick - The current trick state (null if leading)
 * @param wish - The active Mahjong wish rank (null if no wish)
 */
export function validatePlay(
  cards: GameCard[],
  hand: GameCard[],
  currentTrick: TrickState | null,
  wish: Rank | null,
  phoenixAs?: Rank,
): PlayValidation {
  if (cards.length === 0) {
    return { valid: false, reason: 'No cards selected' };
  }

  // Step 1: Detect combination
  let combination = detectCombination(cards);
  if (combination === null) {
    return { valid: false, reason: 'Cards do not form a valid combination' };
  }
  if (phoenixAs !== undefined) {
    const resolved = applyPhoenixChoice(combination, cards, phoenixAs);
    if (resolved === null) {
      return { valid: false, reason: 'Invalid Phoenix value' };
    }
    combination = resolved;
  }

  // Step 2: Check if the combination can beat the current trick
  const trickTop = getTrickTop(currentTrick);

  // Dog can only lead (no current trick)
  if (isDog(cards[0].card) && cards.length === 1 && trickTop !== null) {
    return { valid: false, reason: 'Dog can only be played as a lead' };
  }

  if (!canBeat(combination, trickTop)) {
    return { valid: false, reason: 'Play does not beat the current trick' };
  }

  // Step 3: Wish enforcement — if a wish is active, the player must play
  // a non-bomb combination containing the wished rank IF they can.
  // Bombs are legal interrupts and do not need to satisfy the wish.
  if (!combination.isBomb && wish !== null && canFulfillWish(hand, wish, trickTop)) {
    if (!isWishFulfilled(combination, wish)) {
      return {
        valid: false,
        reason: `Must play a combination containing the wished rank ${wish}`,
      };
    }
  }

  return { valid: true, combination };
}

/**
 * Applies an explicit Phoenix value for ambiguous combinations.
 *
 * The detector chooses a deterministic default for 2+2 full houses and
 * open-ended straights. User-facing play can choose either valid value, so
 * validation must compare using the chosen rank rather than the default.
 */
function applyPhoenixChoice(
  combination: Combination,
  cards: GameCard[],
  phoenixAs: Rank,
): Combination | null {
  if (!cards.some((gc) => isPhoenix(gc.card))) return null;

  if (combination.type === 'fullHouse') {
    const standards = cards.filter((gc) => isStandard(gc.card));
    const rankCounts = new Map<Rank, number>();
    for (const gc of standards) {
      const rank = (gc.card as { rank: Rank }).rank;
      rankCounts.set(rank, (rankCounts.get(rank) ?? 0) + 1);
    }
    const entries = [...rankCounts.entries()];
    const isTwoPair = entries.length === 2 && entries.every(([, count]) => count === 2);
    if (!isTwoPair) {
      return combination.phoenixUsedAs === phoenixAs ? combination : null;
    }
    if (!rankCounts.has(phoenixAs)) return null;
    return { ...combination, rank: phoenixAs, phoenixUsedAs: phoenixAs };
  }

  if (combination.type === 'straight') {
    const nonPhoenixRanks = cards
      .filter((gc) => !isPhoenix(gc.card))
      .map((gc) => {
        if (gc.card.kind === 'standard') return gc.card.rank;
        if (gc.card.kind === 'mahjong') return 1;
        return null;
      });
    if (nonPhoenixRanks.some((rank) => rank === null)) return null;
    const ranks = nonPhoenixRanks as number[];
    const sorted = [...ranks].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const span = max - min + 1;

    if (span === cards.length - 1) {
      const validValues = [min - 1, max + 1].filter((rank) => rank >= 2 && rank <= 14);
      if (!validValues.includes(phoenixAs)) return null;
      return {
        ...combination,
        rank: Math.max(max, phoenixAs),
        phoenixUsedAs: phoenixAs,
      };
    }

    return combination.phoenixUsedAs === phoenixAs ? combination : null;
  }

  return combination.phoenixUsedAs === phoenixAs ? combination : null;
}

/**
 * Get all valid plays from a hand, respecting the current trick and wish.
 *
 * @param hand - The player's hand
 * @param currentTrick - The current trick state (null if leading)
 * @param wish - The active Mahjong wish rank (null if no wish)
 * @returns All valid combinations the player can play
 */
export function getValidPlays(
  hand: GameCard[],
  currentTrick: TrickState | null,
  wish: Rank | null,
): Combination[] {
  const trickTop = getTrickTop(currentTrick);
  const allPlays = getAllValidPlays(hand, trickTop);

  // If no wish, all plays are valid
  if (wish === null) return allPlays;

  // If wish is active and player can fulfill it, filter to wish-fulfilling
  // plays while preserving bombs. Bombs are legal interrupts and do not need
  // to satisfy the wish.
  if (canFulfillWish(hand, wish, trickTop)) {
    const wishPlays = allPlays.filter((combo) => combo.isBomb || isWishFulfilled(combo, wish));
    // Only filter if there are wish-fulfilling plays (canFulfillWish guarantees this)
    return wishPlays.length > 0 ? wishPlays : allPlays;
  }

  // Player can't fulfill wish — all plays are valid
  return allPlays;
}

/**
 * Check if a player can pass on their turn.
 *
 * A player CANNOT pass if:
 * - They are leading (currentTrick is null or has no plays) — must play something
 * - They can fulfill an active wish — must play to fulfill it
 *
 * @param hand - The player's hand
 * @param currentTrick - The current trick state (null if leading)
 * @param wish - The active Mahjong wish rank (null if no wish)
 */
export function canPlayerPass(
  hand: GameCard[],
  currentTrick: TrickState | null,
  wish: Rank | null,
): boolean {
  // Can't pass when leading
  const trickTop = getTrickTop(currentTrick);
  if (trickTop === null) return false;

  // Can't pass if you can fulfill the wish
  if (wish !== null && canFulfillWish(hand, wish, trickTop)) {
    return false;
  }

  return true;
}
