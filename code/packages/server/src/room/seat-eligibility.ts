// REQ-F-SJ01-SJ06: Server-authoritative seat-claim eligibility (pure logic).
// REQ-NF-SJ01: Enforcement lives on the server; clients may pre-filter but
// are not the source of truth.
//
// This module is data-source agnostic: the caller is responsible for
// looking up the user's previous seat (from in-memory game state for live
// games, or from `player_rounds` for post-crash / post-game paths) and
// passing it to `validateClaim`. That separation keeps the rule pure and
// easy to unit-test without DB fixtures.

import type { Seat } from '@tichu/shared';

export interface SeatOccupant {
  /** True when the seat is currently empty. */
  empty: boolean;
  /** True when the seat is held by a bot (displaceable). */
  isBot: boolean;
  /** Display name of the current human occupant (when `!empty && !isBot`). */
  displayName?: string;
}

export type ClaimResult =
  | { kind: 'allowed' }
  | {
      kind: 'rejected';
      /** Plain-language reason for the rejection dialog. */
      reason: string;
      /**
       * Seat the user previously occupied. Always non-null in rejections —
       * `validateClaim` short-circuits to `allowed` when no prior seat exists.
       */
      originalSeat: Seat;
      /** The seat the user attempted to claim. */
      requestedSeat: Seat;
      /** Current human occupant of the conflicting seat (for SJ05 / SJ06b). */
      currentOccupantDisplayName: string | null;
      /** When true, the client should offer a "claim seat {originalSeat}" action. */
      offerClaimOriginal: boolean;
    };

/**
 * REQ-F-SJ03–SJ06: Evaluate a seat claim against the eligibility rule.
 *
 * The rule engages whenever the user has a prior seat in this game
 * (REQ-F-SJ02). Before that — including before round 1 is dealt
 * (REQ-F-SJ01) — callers pass `originalSeat = null` and this short-circuits
 * to `allowed`.
 *
 * @param originalSeat Seat the user occupied in this game, or `null` if none.
 *   Callers compute this from in-memory game state (live games) or from the
 *   `player_rounds` table (post-crash / post-game).
 * @param requestedSeat Seat the user is attempting to claim.
 * @param occupants Current occupancy of every seat in the room.
 */
export function validateClaim(
  originalSeat: Seat | null,
  requestedSeat: Seat,
  occupants: Record<Seat, SeatOccupant>,
): ClaimResult {
  // REQ-F-SJ01, SJ03: No prior seat → unrestricted claim.
  if (originalSeat === null) return { kind: 'allowed' };

  const originalOccupant = occupants[originalSeat];

  if (originalSeat === requestedSeat) {
    // REQ-F-SJ04: Reclaim of original seat — allowed. Bot displacement is
    // handled by the caller's existing seat-assignment flow.
    if (originalOccupant.empty || originalOccupant.isBot) {
      return { kind: 'allowed' };
    }
    // REQ-F-SJ05: Original seat held by another human → reject with name.
    return {
      kind: 'rejected',
      reason:
        `Seat ${requestedSeat} is currently held by ${originalOccupant.displayName ?? 'another player'}. `
        + `You must wait for them to leave before reclaiming your seat.`,
      originalSeat,
      requestedSeat,
      currentOccupantDisplayName: originalOccupant.displayName ?? null,
      offerClaimOriginal: false,
    };
  }

  // REQ-F-SJ06: Cross-seat claim — always rejected ("already seen seat S's cards").
  // Offer varies by the current state of the original seat.
  const baseReason =
    `You have already seen seat ${originalSeat}'s cards this game, `
    + `so you cannot take a different seat.`;
  if (originalOccupant.empty || originalOccupant.isBot) {
    // REQ-F-SJ06a / SJ06c: Original seat empty or bot-held → offer to claim it.
    return {
      kind: 'rejected',
      reason: `${baseReason} You may reclaim seat ${originalSeat} instead.`,
      originalSeat,
      requestedSeat,
      currentOccupantDisplayName: null,
      offerClaimOriginal: true,
    };
  }
  // REQ-F-SJ06b: Original seat held by another human → name them, no offer.
  return {
    kind: 'rejected',
    reason:
      `${baseReason} Seat ${originalSeat} is currently held by ${originalOccupant.displayName ?? 'another player'}; `
      + `you must wait for it to become available.`,
    originalSeat,
    requestedSeat,
    currentOccupantDisplayName: originalOccupant.displayName ?? null,
    offerClaimOriginal: false,
  };
}

/**
 * REQ-F-SJ01: The seat-join validation rule engages only after round 1 has
 * been dealt. Before then, all unrestricted seat-claim logic applies.
 *
 * Callers that already know no prior seat exists (e.g. via live game state
 * lookup returning null) can simply pass `originalSeat = null` to
 * `validateClaim` instead of using this helper.
 */
export function isClaimValidationActive(opts: {
  gameInProgress: boolean;
  currentRoundNumber: number | null;
  finishedRoundCount: number;
}): boolean {
  if (!opts.gameInProgress) return false;
  // A round has been dealt iff there is a current round or at least one
  // finished round in history.
  return opts.currentRoundNumber !== null || opts.finishedRoundCount > 0;
}
