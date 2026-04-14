export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface PlayerProfile {
  userId: string;
  displayName: string;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  tichuCalls: number;
  tichuSuccesses: number;
  grandTichuCalls: number;
  grandTichuSuccesses: number;
  totalRoundsPlayed: number;
  firstFinishes: number;
  largestWinDiff: number;
  largestLossDiff: number;
  gamesForfeited: number;
  gamesSpectated: number;
  oneTwoWins: number;
  oneTwoAgainst: number;
  roundsWon: number;
  opponentTichuBroken: number;
  opponentGrandTichuBroken: number;
  partnerTichuBroken: number;
  partnerGrandTichuBroken: number;
  lastFinishes: number;
  tichuBrokenByPartner: number;
  grandTichuBrokenByPartner: number;
  gamesRequiringTieBreak: number;
  mostTieBreakRoundsNeeded: number;
  gamesJoinedAfterSpectating: number;
  roundsWithDragon: number;
  roundsWithDragonWon: number;
  roundsWithPhoenix: number;
  roundsWithPhoenixWon: number;
  dragonReceivedInPass: number;
  phoenixReceivedInPass: number;
  aceReceivedInPass: number;
  dogReceivedInPass: number;
  dragonTrickWins: number;
  dragonGivenAfterOpponentWin: number;
  dogGivenToPartner: number;
  dogGivenToOpponent: number;
  dogPlayedForTichuPartner: number;
  dogOpportunitiesForTichuPartner: number;
  handsWithBombs: number;
  totalBombs: number;
  fourCardBombs: number;
  fiveCardBombs: number;
  sixPlusCardBombs: number;
  bombsInFirst8: number;
  handsWithMultipleBombs: number;
  overBombed: number;
  bombForcedByWish: number;
  theTichuClean: number;
  theTichuDirty: number;
  phoenixUsedAsSingle: number;
  phoenixUsedForPair: number;
  phoenixUsedInTriple: number;
  phoenixUsedInFullHouse: number;
  phoenixUsedInConsecutivePairs: number;
  phoenixUsedInStraight: number;
  longestStraightWithPhoenix: number;
  dogControlToPartner: number;
  dogControlToOpponent: number;
  dogControlToSelf: number;
  dogStuckAsLastCard: number;
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
  conflictingBombs: number;
  youOverBombed: number;
  youWereOverBombed: number;
  dragonGivenInPass: number;
  phoenixGivenInPass: number;
  aceGivenInPass: number;
  mahjongGivenInPass: number;
  mahjongReceivedInPass: number;
  dogReceivedFromPartner: number;
  dogReceivedFromOpponent: number;
  bombGivenToPartner: number;
  bombGivenToOpponent: number;
  bombReceivedFromPartner: number;
  bombReceivedFromOpponent: number;
  handsWithDog: number;
  strongPrePassHand: number;
  keptDogDuringPass: number;
  allPowerCardsBeforePass: number;
  allCardsUnder10AfterPass: number;
  doubleBombInTrick: number;
  allPlayersBombInRound: number;
}

export interface MergedRelationalStat {
  userId: string;
  displayName: string;
  partnerGamesPlayed: number;
  partnerGamesWon: number;
  partnerWinRate: number;
  partnerOneTwoWins: number;
  partnerTotalTeamBombs: number;
  opponentGamesPlayed: number;
  opponentGamesWon: number;
  opponentWinRate: number;
  opponentOneTwoWins: number;
  opponentTotalTeamBombs: number;
}

export interface GameHistoryEntry {
  id: number;
  roomCode: string;
  endedAt: string;
  winnerTeam: string;
  finalScoreNS: number;
  finalScoreEW: number;
  roundCount: number;
  northUserId: string | null;
  eastUserId: string | null;
  southUserId: string | null;
  westUserId: string | null;
  northName: string;
  eastName: string;
  southName: string;
  westName: string;
  tichuSummary?: {
    teamTichuSuccess: number;
    teamTichuTotal: number;
    teamGTSuccess: number;
    teamGTTotal: number;
  };
}

export function pct(n: number, d: number): string {
  if (d <= 0) return '-';
  const val = (n / d) * 100;
  const fixed1 = val.toFixed(1);
  return fixed1.endsWith('.0') ? `${Math.round(val)}%` : `${fixed1}%`;
}

export function perGame(count: number, games: number): string {
  if (games === 0) return '—';
  return (count / games).toFixed(1);
}

export function getUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tichu_user_id') ?? sessionStorage.getItem('tichu_user_id');
}
