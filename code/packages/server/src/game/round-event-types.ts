// REQ-F-EC01: Types for per-player per-round event accumulation

import type { Seat } from '@tichu/shared';

/** Per-player per-round event summary.
 *  Accumulated by RoundEventTracker during state transitions. */
export interface RoundEventSummary {
  seat: Seat;
  roundNumber: number;

  // Cards held (after pass)
  hadDragon: boolean;
  hadPhoenix: boolean;
  hadDog: boolean;
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

  // REQ-F-CS10: Per-size bomb tracking (4-card through 14-card)
  bombSize4: number;
  bombSize5: number;
  bombSize6: number;
  bombSize7: number;
  bombSize8: number;
  bombSize9: number;
  bombSize10: number;
  bombSize11: number;
  bombSize12: number;
  bombSize13: number;
  bombSize14: number;

  // REQ-F-CS13: Conflicting bombs in dealt hand
  conflictingBombs: number;

  // REQ-F-CS16: Over-bomb direction split
  youOverBombed: number;
  youWereOverBombed: number;

  // Dragon events
  dragonTrickWins: number;
  dragonGivenAfterOpponentWin: number;

  // REQ-F-CS03: Phoenix play type tracking
  phoenixUsedAsSingle: number;
  phoenixUsedForPair: number;
  phoenixUsedInTriple: number;
  phoenixUsedInFullHouse: number;
  phoenixUsedInConsecutivePairs: number;
  phoenixUsedInStraight: number;
  longestStraightWithPhoenix: number;

  // Dog events
  dogPlayedForTichuPartner: number;
  dogOpportunitiesForTichuPartner: number;

  // REQ-F-CS06: Dog control outcomes
  dogControlToPartner: number;
  dogControlToOpponent: number;
  dogControlToSelf: number;

  // REQ-F-CS07: Stuck with Dog as last card
  dogStuckAsLastCard: number;

  // REQ-F-CS19: Extended pass tracking — gave direction
  dragonGivenInPass: boolean;
  phoenixGivenInPass: boolean;
  aceGivenInPass: boolean;
  mahjongGivenInPass: boolean;

  // REQ-F-CS19: Extended pass tracking — received direction
  mahjongReceivedInPass: boolean;
  dogReceivedFromPartner: boolean;
  dogReceivedFromOpponent: boolean;

  // REQ-F-CS20: Bomb completion in pass
  bombGivenToPartnerInPass: boolean;
  bombGivenToOpponentInPass: boolean;
  bombReceivedFromPartnerInPass: boolean;
  bombReceivedFromOpponentInPass: boolean;

  // Pass analysis
  strongPrePassHand: boolean;
  keptDogDuringPass: boolean;

  // Achievements
  theTichuClean: number;
  theTichuDirty: number;
  allPowerCardsBeforePass: boolean;
  allCardsUnder10AfterPass: boolean;
  doubleBombInTrick: number;
  allPlayersBombInRound: boolean;
}

/** Create a blank event summary for a seat/round */
export function createBlankSummary(seat: Seat, roundNumber: number): RoundEventSummary {
  return {
    seat,
    roundNumber,
    hadDragon: false,
    hadPhoenix: false,
    hadDog: false,
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
    bombSize4: 0,
    bombSize5: 0,
    bombSize6: 0,
    bombSize7: 0,
    bombSize8: 0,
    bombSize9: 0,
    bombSize10: 0,
    bombSize11: 0,
    bombSize12: 0,
    bombSize13: 0,
    bombSize14: 0,
    conflictingBombs: 0,
    youOverBombed: 0,
    youWereOverBombed: 0,
    dragonTrickWins: 0,
    dragonGivenAfterOpponentWin: 0,
    phoenixUsedAsSingle: 0,
    phoenixUsedForPair: 0,
    phoenixUsedInTriple: 0,
    phoenixUsedInFullHouse: 0,
    phoenixUsedInConsecutivePairs: 0,
    phoenixUsedInStraight: 0,
    longestStraightWithPhoenix: 0,
    dogPlayedForTichuPartner: 0,
    dogOpportunitiesForTichuPartner: 0,
    dogControlToPartner: 0,
    dogControlToOpponent: 0,
    dogControlToSelf: 0,
    dogStuckAsLastCard: 0,
    dragonGivenInPass: false,
    phoenixGivenInPass: false,
    aceGivenInPass: false,
    mahjongGivenInPass: false,
    mahjongReceivedInPass: false,
    dogReceivedFromPartner: false,
    dogReceivedFromOpponent: false,
    bombGivenToPartnerInPass: false,
    bombGivenToOpponentInPass: false,
    bombReceivedFromPartnerInPass: false,
    bombReceivedFromOpponentInPass: false,
    strongPrePassHand: false,
    keptDogDuringPass: false,
    theTichuClean: 0,
    theTichuDirty: 0,
    allPowerCardsBeforePass: false,
    allCardsUnder10AfterPass: false,
    doubleBombInTrick: 0,
    allPlayersBombInRound: false,
  };
}
