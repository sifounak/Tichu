// REQ-F-AU03: Game history persistence — save completed games and rounds to DB

import { eq, desc, or, sql } from 'drizzle-orm';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgTransaction, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { Database } from './connection.js';
import { games, gameRounds, playerStats } from './schema.js';
import * as schema from './schema.js';
import type { Seat } from '@tichu/shared';

type Transaction = PgTransaction<PgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;

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
  tichuCalls: Record<string, string>; // seat → 'tichu' | 'grandTichu'
}

/**
 * Saves a completed game and all its rounds to the database.
 * Also updates player stats for all human participants.
 */
export async function saveGameResult(
  database: Database,
  gameResult: GameResult,
  rounds: RoundResult[],
): Promise<number> {
  const { db } = database;

  return db.transaction(async (tx) => {
    // Insert game record
    const [game] = await tx.insert(games).values({
      roomCode: gameResult.roomCode,
      startedAt: gameResult.startedAt,
      endedAt: new Date(),
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
    }).returning({ id: games.id });

    // Insert round records
    if (rounds.length > 0) {
      await tx.insert(gameRounds).values(rounds.map(r => ({
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
      })));
    }

    // Update stats for human players
    const humanPlayers = Object.entries(gameResult.players)
      .filter(([, p]) => p.userId !== null)
      .map(([seat, p]) => ({
        seat: seat as Seat,
        userId: p.userId!,
      }));

    for (const { seat, userId } of humanPlayers) {
      const isNS = seat === 'north' || seat === 'south';
      const won = (isNS && gameResult.winnerTeam === 'NS') || (!isNS && gameResult.winnerTeam === 'EW');

      // Count tichu stats from rounds
      let tichuCalls = 0;
      let tichuSuccesses = 0;
      let grandTichuCalls = 0;
      let grandTichuSuccesses = 0;
      let firstFinishes = 0;

      for (const round of rounds) {
        const call = round.tichuCalls[seat];
        if (call === 'tichu') {
          tichuCalls++;
          if (round.finishOrder[0] === seat) tichuSuccesses++;
        } else if (call === 'grandTichu') {
          grandTichuCalls++;
          if (round.finishOrder[0] === seat) grandTichuSuccesses++;
        }
        if (round.finishOrder[0] === seat) firstFinishes++;
      }

      await upsertPlayerStats(tx, userId, {
        gamesPlayed: 1,
        gamesWon: won ? 1 : 0,
        tichuCalls,
        tichuSuccesses,
        grandTichuCalls,
        grandTichuSuccesses,
        totalRoundsPlayed: rounds.length,
        firstFinishes,
      });
    }

    return game.id;
  });
}

async function upsertPlayerStats(
  tx: Transaction | Database['db'],
  userId: string,
  increments: {
    gamesPlayed: number;
    gamesWon: number;
    tichuCalls: number;
    tichuSuccesses: number;
    grandTichuCalls: number;
    grandTichuSuccesses: number;
    totalRoundsPlayed: number;
    firstFinishes: number;
  },
): Promise<void> {
  const winRate = increments.gamesPlayed > 0 ? increments.gamesWon / increments.gamesPlayed : 0;

  await tx.execute(sql`
    INSERT INTO player_stats (
      user_id, games_played, games_won, win_rate,
      tichu_calls, tichu_successes, grand_tichu_calls, grand_tichu_successes,
      total_rounds_played, first_finishes, last_updated_at
    ) VALUES (
      ${userId}, ${increments.gamesPlayed}, ${increments.gamesWon}, ${winRate},
      ${increments.tichuCalls}, ${increments.tichuSuccesses},
      ${increments.grandTichuCalls}, ${increments.grandTichuSuccesses},
      ${increments.totalRoundsPlayed}, ${increments.firstFinishes}, NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      games_played = player_stats.games_played + EXCLUDED.games_played,
      games_won = player_stats.games_won + EXCLUDED.games_won,
      win_rate = CASE
        WHEN (player_stats.games_played + EXCLUDED.games_played) > 0
        THEN (player_stats.games_won + EXCLUDED.games_won)::float / (player_stats.games_played + EXCLUDED.games_played)
        ELSE 0
      END,
      tichu_calls = player_stats.tichu_calls + EXCLUDED.tichu_calls,
      tichu_successes = player_stats.tichu_successes + EXCLUDED.tichu_successes,
      grand_tichu_calls = player_stats.grand_tichu_calls + EXCLUDED.grand_tichu_calls,
      grand_tichu_successes = player_stats.grand_tichu_successes + EXCLUDED.grand_tichu_successes,
      total_rounds_played = player_stats.total_rounds_played + EXCLUDED.total_rounds_played,
      first_finishes = player_stats.first_finishes + EXCLUDED.first_finishes,
      last_updated_at = NOW()
  `);
}

/**
 * Gets game history for a specific player.
 */
export async function getPlayerGameHistory(
  database: Database,
  userId: string,
  limit = 20,
  offset = 0,
): Promise<Array<{
  id: number;
  roomCode: string;
  startedAt: Date;
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
    startedAt: games.startedAt,
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
export async function getGameRounds(
  database: Database,
  gameId: number,
): Promise<Array<{
  roundNumber: number;
  cardPointsNS: number;
  cardPointsEW: number;
  tichuBonusNS: number;
  tichuBonusEW: number;
  oneTwoBonus: string | null;
  totalNS: number;
  totalEW: number;
  finishOrder: unknown;
  tichuCalls: unknown;
}>> {
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
