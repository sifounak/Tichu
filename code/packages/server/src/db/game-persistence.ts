// REQ-F-AU03: Game history persistence — save completed games and rounds to DB

import { eq, desc, or, sql } from 'drizzle-orm';
import type { Database } from './connection.js';
import { games, gameRounds } from './schema.js';
import type { Seat } from '@tichu/shared';

export interface GameResult {
  roomCode: string;
  startedAt: Date;
  winnerTeam: 'NS' | 'EW';
  finalScoreNS: number;
  finalScoreEW: number;
  targetScore: number;
  roundCount: number;
  players: Record<Seat, { userId: string | null; name: string }>;
}

export interface RoundResult {
  roundNumber: number;
  cardPointsNS: number;
  cardPointsEW: number;
  tichuBonusNS: number;
  tichuBonusEW: number;
  oneTwoBonus: 'NS' | 'EW' | null;
  totalNS: number;
  totalEW: number;
  finishOrder: Seat[];
  tichuCalls: Record<string, string>;
}

/**
 * REQ-F-MG04: Saves a completed game and its rounds to the database.
 * Stats are now computed from raw events via stats-cache (REQ-F-MC01–MC05).
 */
export function saveGameResult(
  database: Database,
  gameResult: GameResult,
  rounds: RoundResult[],
): number {
  const { db } = database;

  return db.transaction((tx) => {
    // Insert game record
    const game = tx.insert(games).values({
      roomCode: gameResult.roomCode,
      startedAt: gameResult.startedAt.toISOString(),
      endedAt: new Date().toISOString(),
      winnerTeam: gameResult.winnerTeam,
      finalScoreNS: gameResult.finalScoreNS,
      finalScoreEW: gameResult.finalScoreEW,
      targetScore: gameResult.targetScore,
      roundCount: gameResult.roundCount,
      northUserId: gameResult.players.north.userId,
      eastUserId: gameResult.players.east.userId,
      southUserId: gameResult.players.south.userId,
      westUserId: gameResult.players.west.userId,
      northName: gameResult.players.north.name,
      eastName: gameResult.players.east.name,
      southName: gameResult.players.south.name,
      westName: gameResult.players.west.name,
    }).returning({ id: games.id }).get();

    // Insert round records
    if (rounds.length > 0) {
      tx.insert(gameRounds).values(rounds.map(r => ({
        gameId: game.id,
        roundNumber: r.roundNumber,
        cardPointsNS: r.cardPointsNS,
        cardPointsEW: r.cardPointsEW,
        tichuBonusNS: r.tichuBonusNS,
        tichuBonusEW: r.tichuBonusEW,
        oneTwoBonus: r.oneTwoBonus,
        totalNS: r.totalNS,
        totalEW: r.totalEW,
        finishOrder: r.finishOrder,
        tichuCalls: r.tichuCalls,
      }))).run();
    }

    return game.id;
  });
}

/**
 * Gets game history for a specific player.
 */
export function getPlayerGameHistory(
  database: Database,
  userId: string,
  limit = 20,
  offset = 0,
) {
  const { db } = database;

  // REQ-F-SO19: Include userId columns for player team detection
  return db.select({
    id: games.id,
    roomCode: games.roomCode,
    startedAt: games.startedAt,
    endedAt: games.endedAt,
    winnerTeam: games.winnerTeam,
    finalScoreNS: games.finalScoreNS,
    finalScoreEW: games.finalScoreEW,
    roundCount: games.roundCount,
    northUserId: games.northUserId,
    eastUserId: games.eastUserId,
    southUserId: games.southUserId,
    westUserId: games.westUserId,
    northName: games.northName,
    eastName: games.eastName,
    southName: games.southName,
    westName: games.westName,
  })
    .from(games)
    .where(
      or(
        eq(games.northUserId, userId),
        eq(games.eastUserId, userId),
        eq(games.southUserId, userId),
        eq(games.westUserId, userId),
      ),
    )
    .orderBy(desc(games.endedAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Gets round details for a specific game.
 */
export function getGameRounds(
  database: Database,
  gameId: number,
) {
  const { db } = database;

  return db.select({
    roundNumber: gameRounds.roundNumber,
    cardPointsNS: gameRounds.cardPointsNS,
    cardPointsEW: gameRounds.cardPointsEW,
    tichuBonusNS: gameRounds.tichuBonusNS,
    tichuBonusEW: gameRounds.tichuBonusEW,
    oneTwoBonus: gameRounds.oneTwoBonus,
    totalNS: gameRounds.totalNS,
    totalEW: gameRounds.totalEW,
    finishOrder: gameRounds.finishOrder,
    tichuCalls: gameRounds.tichuCalls,
  })
    .from(gameRounds)
    .where(eq(gameRounds.gameId, gameId))
    .orderBy(gameRounds.roundNumber);
}

/**
 * REQ-F-SO20: Get per-game Tichu call summaries for a batch of game IDs.
 * Returns a map of gameId → { tichuCalls, tichuSuccesses, grandTichuCalls, grandTichuSuccesses }
 * per seat, so the client can compute team-relative totals.
 */
export function getGameTichuSummaries(
  database: Database,
  gameIds: number[],
): Map<number, { tichuCalls: Record<string, string>; finishOrder: Seat[] }[]> {
  if (gameIds.length === 0) return new Map();

  const { db } = database;
  const results = db.all(sql`
    SELECT game_id, tichu_calls, finish_order
    FROM game_rounds
    WHERE game_id IN (${sql.join(gameIds.map(id => sql`${id}`), sql`, `)})
    ORDER BY game_id, round_number
  `) as { game_id: number; tichu_calls: string; finish_order: string }[];

  const summaries = new Map<number, { tichuCalls: Record<string, string>; finishOrder: Seat[] }[]>();
  for (const row of results) {
    if (!summaries.has(row.game_id)) summaries.set(row.game_id, []);
    summaries.get(row.game_id)!.push({
      tichuCalls: typeof row.tichu_calls === 'string' ? JSON.parse(row.tichu_calls) as Record<string, string> : row.tichu_calls as Record<string, string>,
      finishOrder: typeof row.finish_order === 'string' ? JSON.parse(row.finish_order) as Seat[] : row.finish_order as Seat[],
    });
  }
  return summaries;
}
