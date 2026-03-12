// REQ-F-AU04: Leaderboard — top players by win rate, recent games, player profile stats

import { desc, eq, sql } from 'drizzle-orm';
import type { Database } from './connection.js';
import { playerStats, games } from './schema.js';

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
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  tichuCalls: number;
  tichuSuccesses: number;
  grandTichuCalls: number;
  grandTichuSuccesses: number;
  totalRoundsPlayed: number;
  firstFinishes: number;
}

const MIN_GAMES_FOR_LEADERBOARD = 5;

/**
 * Gets top players by win rate, with a minimum games threshold.
 */
export async function getLeaderboard(
  database: Database,
  limit = 20,
  minGames = MIN_GAMES_FOR_LEADERBOARD,
): Promise<LeaderboardEntry[]> {
  const { db } = database;

  // Join playerStats with users to get display names
  const results = await db.execute(sql`
    SELECT
      ps.user_id as "userId",
      u.display_name as "displayName",
      ps.games_played as "gamesPlayed",
      ps.games_won as "gamesWon",
      ps.win_rate as "winRate",
      CASE WHEN ps.tichu_calls > 0
        THEN CAST(ps.tichu_successes AS FLOAT) / ps.tichu_calls
        ELSE 0
      END as "tichuSuccessRate",
      CASE WHEN ps.grand_tichu_calls > 0
        THEN CAST(ps.grand_tichu_successes AS FLOAT) / ps.grand_tichu_calls
        ELSE 0
      END as "grandTichuSuccessRate"
    FROM player_stats ps
    JOIN users u ON u.id = ps.user_id
    WHERE ps.games_played >= ${minGames}
    ORDER BY ps.win_rate DESC, ps.games_played DESC
    LIMIT ${limit}
  `);

  return results.rows as unknown as LeaderboardEntry[];
}

/**
 * Gets recent completed games (for lobby display).
 */
export async function getRecentGames(
  database: Database,
  limit = 10,
): Promise<Array<{
  id: number;
  roomCode: string;
  endedAt: Date;
  winnerTeam: string;
  finalScoreNS: number;
  finalScoreEW: number;
  roundCount: number;
  northName: string;
  eastName: string;
  southName: string;
  westName: string;
}>> {
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
export async function getPlayerProfile(
  database: Database,
  userId: string,
): Promise<PlayerProfile | undefined> {
  const { db } = database;

  const results = await db.execute(sql`
    SELECT
      ps.user_id as "userId",
      u.display_name as "displayName",
      ps.games_played as "gamesPlayed",
      ps.games_won as "gamesWon",
      ps.win_rate as "winRate",
      ps.tichu_calls as "tichuCalls",
      ps.tichu_successes as "tichuSuccesses",
      ps.grand_tichu_calls as "grandTichuCalls",
      ps.grand_tichu_successes as "grandTichuSuccesses",
      ps.total_rounds_played as "totalRoundsPlayed",
      ps.first_finishes as "firstFinishes"
    FROM player_stats ps
    JOIN users u ON u.id = ps.user_id
    WHERE ps.user_id = ${userId}
    LIMIT 1
  `);

  if (results.rows.length === 0) return undefined;
  return results.rows[0] as unknown as PlayerProfile;
}
