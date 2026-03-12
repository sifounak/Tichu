// REQ-F-GF03: Mahjong leads first trick + wish
// REQ-F-GF04: Wish enforcement

import type { GameCard, Rank } from '../types/card.js';
import { isStandard } from '../types/card.js';
import type { Combination } from '../types/combination.js';
import { getAllValidPlays } from './combination-utils.js';

/**
 * REQ-F-GF04: Check if a play contains the wished rank.
 * The wished rank must appear as a real card (not Phoenix substituting).
 */
export function isWishFulfilled(play: Combination, wish: Rank): boolean {
  return play.cards.some(
    (gc) => isStandard(gc.card) && gc.card.rank === wish,
  );
}

/**
 * REQ-F-GF04: Check if a player CAN fulfill the wish.
 * A player can fulfill the wish if they have the wished rank as a real card
 * AND can play it in a valid combination that beats the current trick.
 *
 * @param hand - The player's current hand
 * @param wish - The wished rank
 * @param currentTrick - The current top combination on the trick (null if leading)
 */
export function canFulfillWish(
  hand: GameCard[],
  wish: Rank,
  currentTrick: Combination | null,
): boolean {
  // Must have the wished rank as a real card (not just Phoenix)
  const hasWishedRank = hand.some(
    (gc) => isStandard(gc.card) && gc.card.rank === wish,
  );
  if (!hasWishedRank) return false;

  // Must be able to play a valid combination containing the wished rank
  const validPlays = getAllValidPlays(hand, currentTrick);
  return validPlays.some((combo) => isWishFulfilled(combo, wish));
}

/**
 * REQ-F-GF04: Check if a player MUST fulfill the wish.
 * A player must fulfill the wish if they CAN fulfill it.
 * This is a convenience alias — in Tichu, "can" equals "must" for wishes.
 */
export function mustFulfillWish(
  hand: GameCard[],
  wish: Rank,
  currentTrick: Combination | null,
): boolean {
  return canFulfillWish(hand, wish, currentTrick);
}
