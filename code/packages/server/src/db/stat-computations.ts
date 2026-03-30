// REQ-F-GA01–GA05, REQ-F-GB01–GB05: Pure stat computation functions
// These extract stat increments from GameMachineContext data without side effects.

import type { Seat, Team, RoundScore } from '@tichu/shared';
import { getTeam, getPartner, SEATS_IN_ORDER } from '@tichu/shared';

/** Group A: Game-level stat increments */
export interface GameStatIncrements {
  gamesPlayed: 1;
  gamesWon: 0 | 1;
  largestWinDiff: number;  // absolute score diff (used with MAX, not +=)
  largestLossDiff: number; // absolute score diff (used with MAX, not +=)
  oneTwoWins: number;
  oneTwoAgainst: number;
}

/** Group B: Round-level stat increments */
export interface RoundStatIncrements {
  totalRoundsPlayed: number;
  roundsWon: number;
  firstFinishes: number;
  tichuCalls: number;
  tichuSuccesses: number;
  grandTichuCalls: number;
  grandTichuSuccesses: number;
  opponentTichuBroken: number;
  opponentGrandTichuBroken: number;
  partnerTichuBroken: number;
  partnerGrandTichuBroken: number;
}

/** Get opponent seats for a given seat */
export function getOpponentSeats(seat: Seat): [Seat, Seat] {
  const myTeam = getTeam(seat);
  return SEATS_IN_ORDER.filter(s => getTeam(s) !== myTeam) as [Seat, Seat];
}

/**
 * REQ-F-GA01–GA05: Compute game-level stat increments from final scores and round history.
 */
export function computeGameStats(
  scores: Record<Team, number>,
  winner: Team | null,
  roundHistory: RoundScore[],
  seat: Seat,
): GameStatIncrements {
  const myTeam = getTeam(seat);
  const won = winner === myTeam;
  const scoreDiff = Math.abs(scores.northSouth - scores.eastWest);

  // REQ-F-GA05: Count 1-2 finishes across all rounds
  let oneTwoWins = 0;
  let oneTwoAgainst = 0;
  for (const round of roundHistory) {
    if (round.oneTwoBonus === myTeam) oneTwoWins++;
    else if (round.oneTwoBonus !== null) oneTwoAgainst++;
  }

  return {
    gamesPlayed: 1,
    gamesWon: won ? 1 : 0,
    // REQ-F-GA02: Only set for the appropriate diff based on win/loss
    largestWinDiff: won ? scoreDiff : 0,
    largestLossDiff: won ? 0 : scoreDiff,
    oneTwoWins,
    oneTwoAgainst,
  };
}

/**
 * REQ-F-GB01–GB05: Compute round-level stat increments from round history.
 */
export function computeRoundStats(
  roundHistory: RoundScore[],
  seat: Seat,
): RoundStatIncrements {
  const myTeam = getTeam(seat);
  const partner = getPartner(seat);
  const opponents = getOpponentSeats(seat);

  let roundsWon = 0;
  let firstFinishes = 0;
  let tichuCalls = 0;
  let tichuSuccesses = 0;
  let grandTichuCalls = 0;
  let grandTichuSuccesses = 0;
  let opponentTichuBroken = 0;
  let opponentGrandTichuBroken = 0;
  let partnerTichuBroken = 0;
  let partnerGrandTichuBroken = 0;

  for (const round of roundHistory) {
    // REQ-F-GB01: Round won = my team scored more
    if (round.total[myTeam] > round.total[myTeam === 'northSouth' ? 'eastWest' : 'northSouth']) {
      roundsWon++;
    }

    // My own tichu results
    const myResult = round.tichuResults[seat];
    if (myResult) {
      if (myResult.call === 'tichu') {
        tichuCalls++;
        // REQ-F-GB02: Tichu success = won === true
        if (myResult.won) {
          tichuSuccesses++;
          firstFinishes++;
        }
      } else if (myResult.call === 'grandTichu') {
        grandTichuCalls++;
        if (myResult.won) {
          grandTichuSuccesses++;
          firstFinishes++;
        }
      }
    }

    // First finish without tichu call (if I finished first but didn't call)
    // We can't determine first finish without finishOrder for non-callers
    // This will be improved when RoundEventTracker provides finishOrder (M3)
    // For now, firstFinishes only counts successful tichu/GT calls

    // REQ-F-GB03: Opponent Tichu/Grand Tichu broken
    for (const opp of opponents) {
      const oppResult = round.tichuResults[opp];
      if (oppResult && !oppResult.won) {
        if (oppResult.call === 'tichu') opponentTichuBroken++;
        if (oppResult.call === 'grandTichu') opponentGrandTichuBroken++;
      }
    }

    // REQ-F-GB04: Partner Tichu/Grand Tichu broken (by me going out first)
    // Partner called tichu/GT but I went out first => I broke their call
    // We need finishOrder for this; use tichuResults.won as proxy:
    // If partner called and lost, AND I called and won in the same round,
    // that means I went out first and broke partner's call.
    // This is an approximation — full tracking needs M3's RoundEventTracker
    const partnerResult = round.tichuResults[partner];
    if (partnerResult && !partnerResult.won && myResult?.won) {
      if (partnerResult.call === 'tichu') partnerTichuBroken++;
      if (partnerResult.call === 'grandTichu') partnerGrandTichuBroken++;
    }
  }

  return {
    totalRoundsPlayed: roundHistory.length,
    roundsWon,
    firstFinishes,
    tichuCalls,
    tichuSuccesses,
    grandTichuCalls,
    grandTichuSuccesses,
    opponentTichuBroken,
    opponentGrandTichuBroken,
    partnerTichuBroken,
    partnerGrandTichuBroken,
  };
}
