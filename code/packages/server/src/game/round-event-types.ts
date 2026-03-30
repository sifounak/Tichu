// REQ-F-EC01: Types for per-player per-round event accumulation

import type { Seat } from '@tichu/shared';

/** Per-player per-round event summary.
 *  Accumulated by RoundEventTracker during state transitions. */
export interface RoundEventSummary {
  seat: Seat;
  roundNumber: number;

  // Cards held
  hadDragon: boolean;
  hadPhoenix: boolean;
  bombsInFirst8: number;

  // Pass tracking
  dragonReceivedInPass: boolean;
  phoenixReceivedInPass: boolean;
  aceReceivedInPass: boolean;
  dogReceivedInPass: boolean;
  dogGivenToPartner: boolean;
  dogGivenToOpponent: boolean;

  // Bomb stats
  bombsPlayed: number;
  fourCardBombs: number;
  fiveCardBombs: number;
  sixPlusCardBombs: number;
  overBombed: number;
  bombForcedByWish: number;

  // Dragon events
  dragonTrickWins: number;
  dragonGivenAfterOpponentWin: number;

  // Dog events
  dogPlayedForTichuPartner: number;
  dogOpportunitiesForTichuPartner: number;

  // Achievements
  theTichuClean: number;
  theTichuDirty: number;
}

/** Create a blank event summary for a seat/round */
export function createBlankSummary(seat: Seat, roundNumber: number): RoundEventSummary {
  return {
    seat,
    roundNumber,
    hadDragon: false,
    hadPhoenix: false,
    bombsInFirst8: 0,
    dragonReceivedInPass: false,
    phoenixReceivedInPass: false,
    aceReceivedInPass: false,
    dogReceivedInPass: false,
    dogGivenToPartner: false,
    dogGivenToOpponent: false,
    bombsPlayed: 0,
    fourCardBombs: 0,
    fiveCardBombs: 0,
    sixPlusCardBombs: 0,
    overBombed: 0,
    bombForcedByWish: 0,
    dragonTrickWins: 0,
    dragonGivenAfterOpponentWin: 0,
    dogPlayedForTichuPartner: 0,
    dogOpportunitiesForTichuPartner: 0,
    theTichuClean: 0,
    theTichuDirty: 0,
  };
}
