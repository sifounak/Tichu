// REQ-F-GF04: Wish enforcement in play validation
// REQ-F-CB01: Combination detection chain
// REQ-F-CB02: Combination comparison in validation

import type { GameCard, Rank } from '../types/card.js';
import { isDog } from '../types/card.js';
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
): PlayValidation {
  if (cards.length === 0) {
    return { valid: false, reason: 'No cards selected' };
  }

  // Step 1: Detect combination
  const combination = detectCombination(cards);
  if (combination === null) {
    return { valid: false, reason: 'Cards do not form a valid combination' };
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
  // a combination containing the wished rank IF they can
  if (wish !== null && canFulfillWish(hand, wish, trickTop)) {
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

  // If wish is active and player can fulfill it, filter to only wish-fulfilling plays
  if (canFulfillWish(hand, wish, trickTop)) {
    const wishPlays = allPlays.filter((combo) => isWishFulfilled(combo, wish));
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
