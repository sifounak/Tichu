// REQ-F-GA01–GA05, REQ-F-GB01–GB05: Pure stat computation functions
// REQ-F-SO07–SO11: Stats page overhaul — tie-break, lastFinishes, tichuBrokenByPartner, fix firstFinishes
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
  // REQ-F-SO10: Tie-break stats
  gamesRequiringTieBreak: 0 | 1;
  mostTieBreakRoundsNeeded: number; // used with MAX
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
  // REQ-F-SO08: Last-place finishes
  lastFinishes: number;
  // REQ-F-SO09: Tichu broken by partner
  tichuBrokenByPartner: number;
  grandTichuBrokenByPartner: number;
}

/** Get opponent seats for a given seat */
export function getOpponentSeats(seat: Seat): [Seat, Seat] {
  const myTeam = getTeam(seat);
  return SEATS_IN_ORDER.filter(s => getTeam(s) !== myTeam) as [Seat, Seat];
}

/**
 * REQ-F-GA01–GA05, REQ-F-SO10: Compute game-level stat increments from final scores and round history.
 */
export function computeGameStats(
  scores: Record<Team, number>,
  winner: Team | null,
  roundHistory: RoundScore[],
  seat: Seat,
  targetScore: number,
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

  // REQ-F-SO10: Tie-break detection
  // A tie-break occurs when both teams reach/exceed targetScore simultaneously
  let gamesRequiringTieBreak: 0 | 1 = 0;
  let tieBreakRounds = 0;
  let cumNS = 0;
  let cumEW = 0;
  for (let i = 0; i < roundHistory.length; i++) {
    cumNS += roundHistory[i].total.northSouth;
    cumEW += roundHistory[i].total.eastWest;
    if (cumNS >= targetScore && cumEW >= targetScore && i < roundHistory.length - 1) {
      // Both teams at/above target and game continued — this is a tie-break game
      gamesRequiringTieBreak = 1;
      tieBreakRounds = roundHistory.length - (i + 1);
      break; // Count from first tie occurrence
    }
  }

  return {
    gamesPlayed: 1,
    gamesWon: won ? 1 : 0,
    // REQ-F-GA02: Only set for the appropriate diff based on win/loss
    largestWinDiff: won ? scoreDiff : 0,
    largestLossDiff: won ? 0 : scoreDiff,
    oneTwoWins,
    oneTwoAgainst,
    gamesRequiringTieBreak,
    mostTieBreakRoundsNeeded: tieBreakRounds,
  };
}

/**
 * REQ-F-GB01–GB05, REQ-F-SO07–SO09, REQ-F-SO11: Compute round-level stat increments.
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
  let lastFinishes = 0;
  let tichuCalls = 0;
  let tichuSuccesses = 0;
  let grandTichuCalls = 0;
  let grandTichuSuccesses = 0;
  let opponentTichuBroken = 0;
  let opponentGrandTichuBroken = 0;
  let partnerTichuBroken = 0;
  let partnerGrandTichuBroken = 0;
  let tichuBrokenByPartner = 0;
  let grandTichuBrokenByPartner = 0;

  for (const round of roundHistory) {
    // REQ-F-GB01: Round won = my team scored more
    if (round.total[myTeam] > round.total[myTeam === 'northSouth' ? 'eastWest' : 'northSouth']) {
      roundsWon++;
    }

    const finishOrder = round.finishOrder;

    // REQ-F-SO07: First finishes — count ALL 1st-place finishes using finishOrder
    if (finishOrder && finishOrder.length > 0 && finishOrder[0] === seat) {
      firstFinishes++;
    }

    // REQ-F-SO08: Last finishes — finished 4th (last)
    if (finishOrder && finishOrder.length >= 4 && finishOrder[3] === seat) {
      lastFinishes++;
    }

    // My own tichu results
    const myResult = round.tichuResults[seat];
    if (myResult) {
      if (myResult.call === 'tichu') {
        tichuCalls++;
        if (myResult.won) tichuSuccesses++;
      } else if (myResult.call === 'grandTichu') {
        grandTichuCalls++;
        if (myResult.won) grandTichuSuccesses++;
      }
    }

    // REQ-F-GB03: Opponent Tichu/Grand Tichu broken
    for (const opp of opponents) {
      const oppResult = round.tichuResults[opp];
      if (oppResult && !oppResult.won) {
        if (oppResult.call === 'tichu') opponentTichuBroken++;
        if (oppResult.call === 'grandTichu') opponentGrandTichuBroken++;
      }
    }

    // REQ-F-SO11: Partner Tichu/Grand Tichu broken (improved with finishOrder)
    // Partner called tichu/GT but I went out first => I broke their call
    const partnerResult = round.tichuResults[partner];
    if (partnerResult && !partnerResult.won && finishOrder && finishOrder[0] === seat) {
      if (partnerResult.call === 'tichu') partnerTichuBroken++;
      if (partnerResult.call === 'grandTichu') partnerGrandTichuBroken++;
    }

    // REQ-F-SO09: Tichu broken by partner (I called, partner went out first)
    if (myResult && !myResult.won && finishOrder && finishOrder[0] === partner) {
      if (myResult.call === 'tichu') tichuBrokenByPartner++;
      if (myResult.call === 'grandTichu') grandTichuBrokenByPartner++;
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
    lastFinishes,
    tichuBrokenByPartner,
    grandTichuBrokenByPartner,
  };
}
