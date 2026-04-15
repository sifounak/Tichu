// REQ-F-AU04: Leaderboard — top players by win rate, recent games, player profile stats

import { desc, sql } from 'drizzle-orm';
import type { Database } from './connection.js';
import { games } from './schema.js';

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  tichuSuccessRate: number;
  grandTichuSuccessRate: number;
}

export interface PlayerProfile {
  userId: string;
  displayName: string;
  // Existing
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  tichuCalls: number;
  tichuSuccesses: number;
  grandTichuCalls: number;
  grandTichuSuccesses: number;
  totalRoundsPlayed: number;
  firstFinishes: number;
  // Group A
  largestWinDiff: number;
  largestLossDiff: number;
  gamesForfeited: number;
  gamesSpectated: number;
  oneTwoWins: number;
  oneTwoAgainst: number;
  // Group B
  roundsWon: number;
  opponentTichuBroken: number;
  opponentGrandTichuBroken: number;
  partnerTichuBroken: number;
  partnerGrandTichuBroken: number;
  // REQ-F-SO02–SO05: New stats
  lastFinishes: number;
  tichuBrokenByPartner: number;
  grandTichuBrokenByPartner: number;
  gamesRequiringTieBreak: number;
  mostTieBreakRoundsNeeded: number;
  gamesJoinedAfterSpectating: number;
  // REQ-F-SO17: Group C card event stats
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
  // REQ-F-CS03–CS05: Phoenix play type tracking
  phoenixUsedAsSingle: number;
  phoenixUsedForPair: number;
  phoenixUsedInTriple: number;
  phoenixUsedInFullHouse: number;
  phoenixUsedInConsecutivePairs: number;
  phoenixUsedInStraight: number;
  longestStraightWithPhoenix: number;
  // REQ-F-CS06–CS09: Dog control tracking
  dogControlToPartner: number;
  dogControlToOpponent: number;
  dogControlToSelf: number;
  dogStuckAsLastCard: number;
  // REQ-F-CS10–CS12: Per-size bomb tracking
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
  // REQ-F-CS13–CS15: Conflicting bombs
  conflictingBombs: number;
  // REQ-F-CS16–CS18: Over-bomb direction split
  youOverBombed: number;
  youWereOverBombed: number;
  // REQ-F-CS19–CS22: Extended pass tracking
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
  // Dog: hands with dog (after pass)
  handsWithDog: number;
  // Pass analysis
  strongPrePassHand: number;
  keptDogDuringPass: number;
  // Achievements (expanded)
  allPowerCardsBeforePass: number;
  allCardsUnder10AfterPass: number;
  doubleBombInTrick: number;
  allPlayersBombInRound: number;
}

const MIN_GAMES_FOR_LEADERBOARD = 5;

/**
 * Gets top players by win rate, with a minimum games threshold.
 */
export function getLeaderboard(
  database: Database,
  limit = 20,
  minGames = MIN_GAMES_FOR_LEADERBOARD,
): LeaderboardEntry[] {
  const { db } = database;

  const results = db.all(sql`
    SELECT
      ps.user_id as userId,
      u.display_name as displayName,
      ps.games_played as gamesPlayed,
      ps.games_won as gamesWon,
      ps.win_rate as winRate,
      CASE WHEN ps.tichu_calls > 0
        THEN CAST(ps.tichu_successes AS REAL) / ps.tichu_calls
        ELSE 0
      END as tichuSuccessRate,
      CASE WHEN ps.grand_tichu_calls > 0
        THEN CAST(ps.grand_tichu_successes AS REAL) / ps.grand_tichu_calls
        ELSE 0
      END as grandTichuSuccessRate
    FROM stats_cache ps
    JOIN users u ON u.id = ps.user_id
    WHERE ps.games_played >= ${minGames}
    ORDER BY ps.win_rate DESC, ps.games_played DESC
    LIMIT ${limit}
  `);

  return results as LeaderboardEntry[];
}

/**
 * Gets recent completed games (for lobby display).
 */
export function getRecentGames(
  database: Database,
  limit = 10,
) {
  const { db } = database;

  return db.select({
    id: games.id,
    roomCode: games.roomCode,
    endedAt: games.endedAt,
    winnerTeam: games.winnerTeam,
    finalScoreNS: games.finalScoreNS,
    finalScoreEW: games.finalScoreEW,
    roundCount: games.roundCount,
    northName: games.northName,
    eastName: games.eastName,
    southName: games.southName,
    westName: games.westName,
  })
    .from(games)
    .orderBy(desc(games.endedAt))
    .limit(limit);
}

/**
 * Gets a player's profile stats.
 */
export function getPlayerProfile(
  database: Database,
  userId: string,
): PlayerProfile | undefined {
  const { db } = database;

  const results = db.all(sql`
    SELECT
      ps.user_id as userId,
      u.display_name as displayName,
      ps.games_played as gamesPlayed,
      ps.games_won as gamesWon,
      ps.win_rate as winRate,
      ps.tichu_calls as tichuCalls,
      ps.tichu_successes as tichuSuccesses,
      ps.grand_tichu_calls as grandTichuCalls,
      ps.grand_tichu_successes as grandTichuSuccesses,
      ps.total_rounds_played as totalRoundsPlayed,
      ps.first_finishes as firstFinishes,
      ps.largest_win_diff as largestWinDiff,
      ps.largest_loss_diff as largestLossDiff,
      ps.games_forfeited as gamesForfeited,
      ps.games_spectated as gamesSpectated,
      ps.one_two_wins as oneTwoWins,
      ps.one_two_against as oneTwoAgainst,
      ps.rounds_won as roundsWon,
      ps.opponent_tichu_broken as opponentTichuBroken,
      ps.opponent_grand_tichu_broken as opponentGrandTichuBroken,
      ps.partner_tichu_broken as partnerTichuBroken,
      ps.partner_grand_tichu_broken as partnerGrandTichuBroken,
      -- REQ-F-SO18: New stats
      ps.last_finishes as lastFinishes,
      ps.tichu_broken_by_partner as tichuBrokenByPartner,
      ps.grand_tichu_broken_by_partner as grandTichuBrokenByPartner,
      ps.games_requiring_tie_break as gamesRequiringTieBreak,
      ps.most_tie_break_rounds_needed as mostTieBreakRoundsNeeded,
      ps.games_joined_after_spectating as gamesJoinedAfterSpectating,
      -- REQ-F-SO17: Group C card event stats
      ps.rounds_with_dragon as roundsWithDragon,
      ps.rounds_with_dragon_won as roundsWithDragonWon,
      ps.rounds_with_phoenix as roundsWithPhoenix,
      ps.rounds_with_phoenix_won as roundsWithPhoenixWon,
      ps.dragon_received_in_pass as dragonReceivedInPass,
      ps.phoenix_received_in_pass as phoenixReceivedInPass,
      ps.ace_received_in_pass as aceReceivedInPass,
      ps.dog_received_in_pass as dogReceivedInPass,
      ps.dragon_trick_wins as dragonTrickWins,
      ps.dragon_given_after_opponent_win as dragonGivenAfterOpponentWin,
      ps.dog_given_to_partner as dogGivenToPartner,
      ps.dog_given_to_opponent as dogGivenToOpponent,
      ps.dog_played_for_tichu_partner as dogPlayedForTichuPartner,
      ps.dog_opportunities_for_tichu_partner as dogOpportunitiesForTichuPartner,
      ps.hands_with_bombs as handsWithBombs,
      ps.total_bombs as totalBombs,
      ps.four_card_bombs as fourCardBombs,
      ps.five_card_bombs as fiveCardBombs,
      ps.six_plus_card_bombs as sixPlusCardBombs,
      ps.bombs_in_first_8 as bombsInFirst8,
      ps.hands_with_multiple_bombs as handsWithMultipleBombs,
      ps.over_bombed as overBombed,
      ps.bomb_forced_by_wish as bombForcedByWish,
      ps.the_tichu_clean as theTichuClean,
      ps.the_tichu_dirty as theTichuDirty,
      -- REQ-F-CS03–CS05: Phoenix play type tracking
      ps.phoenix_used_as_single as phoenixUsedAsSingle,
      ps.phoenix_used_for_pair as phoenixUsedForPair,
      ps.phoenix_used_in_triple as phoenixUsedInTriple,
      ps.phoenix_used_in_full_house as phoenixUsedInFullHouse,
      ps.phoenix_used_in_consecutive_pairs as phoenixUsedInConsecutivePairs,
      ps.phoenix_used_in_straight as phoenixUsedInStraight,
      ps.longest_straight_with_phoenix as longestStraightWithPhoenix,
      -- REQ-F-CS06–CS09: Dog control tracking
      ps.dog_control_to_partner as dogControlToPartner,
      ps.dog_control_to_opponent as dogControlToOpponent,
      ps.dog_control_to_self as dogControlToSelf,
      ps.dog_stuck_as_last_card as dogStuckAsLastCard,
      -- REQ-F-CS10–CS12: Per-size bomb tracking
      ps.bomb_size_4 as bombSize4,
      ps.bomb_size_5 as bombSize5,
      ps.bomb_size_6 as bombSize6,
      ps.bomb_size_7 as bombSize7,
      ps.bomb_size_8 as bombSize8,
      ps.bomb_size_9 as bombSize9,
      ps.bomb_size_10 as bombSize10,
      ps.bomb_size_11 as bombSize11,
      ps.bomb_size_12 as bombSize12,
      ps.bomb_size_13 as bombSize13,
      ps.bomb_size_14 as bombSize14,
      -- REQ-F-CS13–CS15: Conflicting bombs
      ps.conflicting_bombs as conflictingBombs,
      -- REQ-F-CS16–CS18: Over-bomb direction split
      ps.you_over_bombed as youOverBombed,
      ps.you_were_over_bombed as youWereOverBombed,
      -- REQ-F-CS19–CS22: Extended pass tracking
      ps.dragon_gave_in_pass as dragonGivenInPass,
      ps.phoenix_gave_in_pass as phoenixGivenInPass,
      ps.ace_gave_in_pass as aceGivenInPass,
      ps.mahjong_gave_in_pass as mahjongGivenInPass,
      ps.mahjong_received_in_pass as mahjongReceivedInPass,
      ps.dog_received_from_partner as dogReceivedFromPartner,
      ps.dog_received_from_opponent as dogReceivedFromOpponent,
      ps.bomb_gave_to_partner as bombGivenToPartner,
      ps.bomb_gave_to_opponent as bombGivenToOpponent,
      ps.bomb_received_from_partner as bombReceivedFromPartner,
      ps.bomb_received_from_opponent as bombReceivedFromOpponent,
      ps.hands_with_dog as handsWithDog,
      ps.strong_pre_pass_hand as strongPrePassHand,
      ps.kept_dog_during_pass as keptDogDuringPass,
      ps.all_power_cards_before_pass as allPowerCardsBeforePass,
      ps.all_cards_under_10_after_pass as allCardsUnder10AfterPass,
      ps.double_bomb_in_trick as doubleBombInTrick,
      ps.all_players_bomb_in_round as allPlayersBombInRound
    FROM stats_cache ps
    JOIN users u ON u.id = ps.user_id
    WHERE ps.user_id = ${userId}
    LIMIT 1
  `);

  const rows = results as PlayerProfile[];
  if (rows.length === 0) return undefined;
  return rows[0];
}

export interface RelationalStatEntry {
  userId: string;
  displayName: string;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
}

/** REQ-F-API02: Get partner stats for a player */
export function getPlayerPartners(
  database: Database,
  userId: string,
  limit = 20,
): RelationalStatEntry[] {
  const { db } = database;
  return db.all(sql`
    SELECT
      prs.other_user_id as userId,
      COALESCE(u.display_name, 'Bot') as displayName,
      prs.games_played as gamesPlayed,
      prs.games_won as gamesWon,
      CASE WHEN prs.games_played > 0
        THEN CAST(prs.games_won AS REAL) / prs.games_played
        ELSE 0
      END as winRate
    FROM relational_stats_cache prs
    LEFT JOIN users u ON u.id = prs.other_user_id
    WHERE prs.user_id = ${userId} AND prs.relationship = 'partner'
    ORDER BY prs.games_played DESC
    LIMIT ${limit}
  `) as RelationalStatEntry[];
}

/** REQ-F-API03: Get opponent stats for a player */
export function getPlayerOpponents(
  database: Database,
  userId: string,
  limit = 20,
): RelationalStatEntry[] {
  const { db } = database;
  return db.all(sql`
    SELECT
      prs.other_user_id as userId,
      COALESCE(u.display_name, 'Bot') as displayName,
      prs.games_played as gamesPlayed,
      prs.games_won as gamesWon,
      CASE WHEN prs.games_played > 0
        THEN CAST(prs.games_won AS REAL) / prs.games_played
        ELSE 0
      END as winRate
    FROM relational_stats_cache prs
    LEFT JOIN users u ON u.id = prs.other_user_id
    WHERE prs.user_id = ${userId} AND prs.relationship = 'opponent'
    ORDER BY prs.games_played DESC
    LIMIT ${limit}
  `) as RelationalStatEntry[];
}

export interface MergedRelationalEntry {
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

/** Get merged partner/opponent relational stats for a player */
export function getPlayerRelationships(
  database: Database,
  userId: string,
): MergedRelationalEntry[] {
  const { db } = database;
  return db.all(sql`
    SELECT
      prs.other_user_id as userId,
      COALESCE(u.display_name, 'Bot') as displayName,
      SUM(CASE WHEN prs.relationship = 'partner' THEN prs.games_played ELSE 0 END) as partnerGamesPlayed,
      SUM(CASE WHEN prs.relationship = 'partner' THEN prs.games_won ELSE 0 END) as partnerGamesWon,
      CASE WHEN SUM(CASE WHEN prs.relationship = 'partner' THEN prs.games_played ELSE 0 END) > 0
        THEN CAST(SUM(CASE WHEN prs.relationship = 'partner' THEN prs.games_won ELSE 0 END) AS REAL)
             / SUM(CASE WHEN prs.relationship = 'partner' THEN prs.games_played ELSE 0 END)
        ELSE 0 END as partnerWinRate,
      SUM(CASE WHEN prs.relationship = 'partner' THEN prs.one_two_wins ELSE 0 END) as partnerOneTwoWins,
      SUM(CASE WHEN prs.relationship = 'partner' THEN prs.total_team_bombs ELSE 0 END) as partnerTotalTeamBombs,
      SUM(CASE WHEN prs.relationship = 'opponent' THEN prs.games_played ELSE 0 END) as opponentGamesPlayed,
      SUM(CASE WHEN prs.relationship = 'opponent' THEN prs.games_won ELSE 0 END) as opponentGamesWon,
      CASE WHEN SUM(CASE WHEN prs.relationship = 'opponent' THEN prs.games_played ELSE 0 END) > 0
        THEN CAST(SUM(CASE WHEN prs.relationship = 'opponent' THEN prs.games_won ELSE 0 END) AS REAL)
             / SUM(CASE WHEN prs.relationship = 'opponent' THEN prs.games_played ELSE 0 END)
        ELSE 0 END as opponentWinRate,
      SUM(CASE WHEN prs.relationship = 'opponent' THEN prs.one_two_wins ELSE 0 END) as opponentOneTwoWins,
      SUM(CASE WHEN prs.relationship = 'opponent' THEN prs.total_team_bombs ELSE 0 END) as opponentTotalTeamBombs
    FROM relational_stats_cache prs
    LEFT JOIN users u ON u.id = prs.other_user_id
    WHERE prs.user_id = ${userId}
    GROUP BY prs.other_user_id
    ORDER BY displayName ASC
  `) as MergedRelationalEntry[];
}
