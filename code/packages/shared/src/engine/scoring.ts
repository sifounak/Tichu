// REQ-F-SC01: Standard round scoring
// REQ-F-SC02: 1-2 finish bonus
// REQ-F-SC03: Last player redistribution
// REQ-F-GF08: Tichu declaration +100/-100
// REQ-F-GF09: Grand Tichu +200/-200
// REQ-F-GF10: Customizable target score (checkGameOver)

import type { GameCard } from '../types/card.js';
import type { Seat, Team, TichuCall, RoundScore, TichuResult } from '../types/game.js';
import { getTeam, SEATS_IN_ORDER } from '../types/game.js';
import { getCardPoints } from '../constants.js';

/**
 * REQ-F-SC01: Calculate total point value of a collection of cards.
 * Used for trick points and hand points.
 */
export function getCardsPoints(cards: GameCard[]): number {
  return cards.reduce((sum, gc) => sum + getCardPoints(gc.card), 0);
}

/**
 * REQ-F-SC01: Calculate total point value of tricks won by a player.
 */
export function getTrickPoints(tricks: GameCard[][]): number {
  return tricks.reduce((sum, trick) => sum + getCardsPoints(trick), 0);
}

/**
 * REQ-F-SC01: Score a complete round.
 * REQ-F-SC02: 1-2 finish bonus — if both partners finish 1st and 2nd, their team gets 200 points.
 * REQ-F-SC03: Last player redistribution — last player's tricks go to first-out player,
 *   last player's remaining hand points go to the opposing team.
 * REQ-F-GF08: Tichu +100/-100
 * REQ-F-GF09: Grand Tichu +200/-200
 *
 * @param finishOrder - Seats in the order they went out (index 0 = first out)
 * @param tricksByPlayer - Cards won in tricks by each player
 * @param handsByPlayer - Cards remaining in each player's hand at round end
 * @param tichuCalls - Tichu/Grand Tichu call status per player
 * @param bombsPerTeam - Bombs played per team this round (REQ-F-GS15)
 * @returns RoundScore with detailed breakdown
 */
export function scoreRound(
  roundNumber: number,
  finishOrder: Seat[],
  tricksByPlayer: Record<Seat, GameCard[][]>,
  handsByPlayer: Record<Seat, GameCard[]>,
  tichuCalls: Record<Seat, TichuCall>,
  bombsPerTeam: Record<Team, number> = { northSouth: 0, eastWest: 0 },
): RoundScore {
  const firstOut = finishOrder[0];
  const secondOut = finishOrder[1];
  const lastPlayer = finishOrder[3]; // 4th place = last

  // REQ-F-SC02: Check for 1-2 finish
  const firstTeam = getTeam(firstOut);
  const secondTeam = getTeam(secondOut);
  const isOneTwoFinish = firstTeam === secondTeam;

  let cardPoints: Record<Team, number>;

  if (isOneTwoFinish) {
    // 1-2 finish: winning team gets 200, opponents get 0
    cardPoints = {
      northSouth: firstTeam === 'northSouth' ? 200 : 0,
      eastWest: firstTeam === 'eastWest' ? 200 : 0,
    };
  } else {
    // REQ-F-SC03: Standard scoring with last-player redistribution
    // Last player's tricks go to first-out player
    const redistributedTricks: Record<Seat, GameCard[][]> = {
      north: [...tricksByPlayer.north],
      east: [...tricksByPlayer.east],
      south: [...tricksByPlayer.south],
      west: [...tricksByPlayer.west],
    };
    redistributedTricks[firstOut] = [
      ...redistributedTricks[firstOut],
      ...redistributedTricks[lastPlayer],
    ];
    redistributedTricks[lastPlayer] = [];

    // Calculate card points per team
    const seatPoints: Record<Seat, number> = {
      north: getTrickPoints(redistributedTricks.north),
      east: getTrickPoints(redistributedTricks.east),
      south: getTrickPoints(redistributedTricks.south),
      west: getTrickPoints(redistributedTricks.west),
    };

    // Last player's remaining hand points go to opposing team
    const lastPlayerHandPoints = getCardsPoints(handsByPlayer[lastPlayer]);
    const opposingTeam = getTeam(lastPlayer) === 'northSouth' ? 'eastWest' : 'northSouth';

    cardPoints = {
      northSouth:
        seatPoints.north +
        seatPoints.south +
        (opposingTeam === 'northSouth' ? lastPlayerHandPoints : 0),
      eastWest:
        seatPoints.east +
        seatPoints.west +
        (opposingTeam === 'eastWest' ? lastPlayerHandPoints : 0),
    };
  }

  // REQ-F-GF08, REQ-F-GF09: Tichu bonuses/penalties
  const tichuBonuses: Record<Team, number> = { northSouth: 0, eastWest: 0 };
  for (const seat of finishOrder) {
    const call = tichuCalls[seat];
    if (call === 'none') continue;

    const team = getTeam(seat);
    const isFirstOut = seat === firstOut;
    const bonus = call === 'grandTichu' ? 200 : 100;

    tichuBonuses[team] += isFirstOut ? bonus : -bonus;
  }

  // REQ-F-GS15: Compute per-seat tichu results for the game summary dialog
  const tichuResults: Record<Seat, TichuResult | null> = {
    north: null,
    east: null,
    south: null,
    west: null,
  };
  for (const seat of SEATS_IN_ORDER) {
    const call = tichuCalls[seat];
    if (call === 'none') continue;
    const won = seat === firstOut;
    tichuResults[seat] = { call, won };
  }

  return {
    roundNumber,
    cardPoints,
    tichuBonuses,
    oneTwoBonus: isOneTwoFinish ? firstTeam : null,
    total: {
      northSouth: cardPoints.northSouth + tichuBonuses.northSouth,
      eastWest: cardPoints.eastWest + tichuBonuses.eastWest,
    },
    tichuResults,
    bombsPerTeam,
  };
}

/**
 * REQ-F-GF10: Check if the game is over (a team reached the target score).
 * Returns the winning team, or null if the game continues.
 * If both teams reach the target in the same round, the team with the higher score wins.
 * If tied at or above the target, play continues.
 */
export function checkGameOver(
  scores: Record<Team, number>,
  targetScore: number,
): Team | null {
  const nsReached = scores.northSouth >= targetScore;
  const ewReached = scores.eastWest >= targetScore;

  if (!nsReached && !ewReached) return null;

  if (nsReached && ewReached) {
    // Both reached: higher score wins; if tied, game continues
    if (scores.northSouth > scores.eastWest) return 'northSouth';
    if (scores.eastWest > scores.northSouth) return 'eastWest';
    return null; // tied — play another round
  }

  return nsReached ? 'northSouth' : 'eastWest';
}
