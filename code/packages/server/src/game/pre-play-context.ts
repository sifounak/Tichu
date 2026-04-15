// REQ-F-CP02: Pre-play enrichment — computed by GameManager before actor.send()
// These helpers compute contextual fields that are expensive to reconstruct later.

import type { Seat, Combination } from '@tichu/shared';
import type { PrePlayContext, ActionSource } from './event-types.js';

/**
 * REQ-F-CP02: Determine if the chosen play is the minimum (lowest-ranking)
 * legal option of the same combination type.
 *
 * For leads: lowest of the same combination type chosen.
 * For follow plays: lowest legal play that beats the current trick top.
 */
export function isPlayedMinimum(
  chosenCombination: Combination,
  legalPlays: Combination[],
): boolean {
  if (legalPlays.length <= 1) return true; // only option

  // Filter to same combination type
  const sameType = legalPlays.filter(p => p.type === chosenCombination.type);
  if (sameType.length <= 1) return true; // only option of this type

  // For same type, compare by rank (lower = minimum)
  const minRank = Math.min(...sameType.map(p => p.rank));
  return chosenCombination.rank === minRank;
}

/**
 * REQ-F-CP02: Determine if any legal play would empty the player's hand.
 */
export function couldGoOut(
  handSize: number,
  legalPlays: Combination[],
): boolean {
  return legalPlays.some(p => p.cards.length === handSize);
}

/**
 * REQ-F-CP02: Get card counts for all other players from game context.
 * Returns counts relative to the acting player's seat.
 */
export function getOtherPlayerCardCounts(
  actingSeat: Seat,
  handSizes: Record<Seat, number>,
): { partnerCardsRemaining: number; leftOppCardsRemaining: number; rightOppCardsRemaining: number } {
  const seatOrder: Seat[] = ['north', 'east', 'south', 'west'];
  const actingIdx = seatOrder.indexOf(actingSeat);
  const partnerIdx = (actingIdx + 2) % 4;
  const leftOppIdx = (actingIdx + 1) % 4;
  const rightOppIdx = (actingIdx + 3) % 4;

  return {
    partnerCardsRemaining: handSizes[seatOrder[partnerIdx]],
    leftOppCardsRemaining: handSizes[seatOrder[leftOppIdx]],
    rightOppCardsRemaining: handSizes[seatOrder[rightOppIdx]],
  };
}

/**
 * REQ-F-CP02: Build a complete PrePlayContext from game state.
 * Called by GameManager before actor.send().
 */
export function buildPrePlayContext(params: {
  seat: Seat;
  actionSource: ActionSource;
  legalPlays: Combination[];
  chosenCombination: Combination | null; // null for pass
  handSize: number;
  handSizes: Record<Seat, number>;
  turnStartedAt: string | null;
}): PrePlayContext {
  const { seat, actionSource, legalPlays, chosenCombination, handSize, handSizes, turnStartedAt } = params;
  const otherCounts = getOtherPlayerCardCounts(seat, handSizes);

  const now = turnStartedAt ? new Date().toISOString() : null;
  const durationMs = turnStartedAt && now
    ? new Date(now).getTime() - new Date(turnStartedAt).getTime()
    : null;

  return {
    seat,
    legalPlayCount: legalPlays.length,
    playedMinimum: chosenCombination ? isPlayedMinimum(chosenCombination, legalPlays) : false,
    couldHaveGoneOut: couldGoOut(handSize, legalPlays),
    actionSource,
    partnerCardsRemaining: otherCounts.partnerCardsRemaining,
    leftOppCardsRemaining: otherCounts.leftOppCardsRemaining,
    rightOppCardsRemaining: otherCounts.rightOppCardsRemaining,
    turnStartedAt,
    durationMs,
  };
}
