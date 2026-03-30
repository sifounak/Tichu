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
    FROM player_stats ps
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
      ps.partner_grand_tichu_broken as partnerGrandTichuBroken
    FROM player_stats ps
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
      u.display_name as displayName,
      prs.games_played as gamesPlayed,
      prs.games_won as gamesWon,
      CASE WHEN prs.games_played > 0
        THEN CAST(prs.games_won AS REAL) / prs.games_played
        ELSE 0
      END as winRate
    FROM player_relational_stats prs
    JOIN users u ON u.id = prs.other_user_id
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
      u.display_name as displayName,
      prs.games_played as gamesPlayed,
      prs.games_won as gamesWon,
      CASE WHEN prs.games_played > 0
        THEN CAST(prs.games_won AS REAL) / prs.games_played
        ELSE 0
      END as winRate
    FROM player_relational_stats prs
    JOIN users u ON u.id = prs.other_user_id
    WHERE prs.user_id = ${userId} AND prs.relationship = 'opponent'
    ORDER BY prs.games_played DESC
    LIMIT ${limit}
  `) as RelationalStatEntry[];
}
