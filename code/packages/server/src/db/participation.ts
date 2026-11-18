// REQ-F-PS04–PS06: Durable participation, legacy inference and shared filtering.
import { sql } from 'drizzle-orm';
import { classifyParticipation, type ParticipationRecord, type ParticipationView, type ParticipationMetadata } from '@tichu/shared';
import type { Database } from './connection.js';

/** Historical lineups are evidence, not proof of uninterrupted human control. */
export function inferLegacyParticipation(database: Database): void {
  const legacy = database.client.prepare(`SELECT id, north_user_id, east_user_id, south_user_id, west_user_id, human_participant_ids, had_bot
    FROM games WHERE participation_inferred = 1`).all() as {
      human_participant_ids: string | null; had_bot: number; id: number; north_user_id: string | null; east_user_id: string | null;
      south_user_id: string | null; west_user_id: string | null;
    }[];
  const rounds = database.client.prepare('SELECT user_id FROM player_rounds WHERE game_id = ?');
  const update = database.client.prepare(`UPDATE games SET participation = ?, human_participant_ids = ?, had_bot = ?, stats_revision = stats_revision + 1
    WHERE id = ? AND (participation IS NULL OR participation != ? OR human_participant_ids != ? OR had_bot != ?)`);
  for (const game of legacy) {
    const finalIds = [game.north_user_id, game.east_user_id, game.south_user_id, game.west_user_id];
    const ids = [...(game.human_participant_ids ? JSON.parse(game.human_participant_ids) as string[] : []), ...finalIds, ...(rounds.all(game.id) as { user_id: string | null }[]).map(row => row.user_id)];
    const record: ParticipationRecord = {
      humanUserIds: [...new Set(ids.filter((id): id is string => id !== null && id !== '__bot__'))].sort(),
      hadBot: game.had_bot === 1 || ids.some(id => id === null || id === '__bot__'), inferred: true,
    };
    const view = classifyParticipation(record);
    const humans = JSON.stringify(record.humanUserIds);
    update.run(view, humans, Number(record.hadBot), game.id, view, humans, Number(record.hadBot));
  }
}

export function saveParticipation(database: Database, gameId: number, record: ParticipationRecord): void {
  // Never lose previously observed humans or a brief bot replacement.
  const previous = database.client.prepare('SELECT human_participant_ids, had_bot, participation_inferred FROM games WHERE id = ?')
    .get(gameId) as { human_participant_ids: string | null; had_bot: number; participation_inferred: number } | undefined;
  if (!previous) return;
  const humans = [...new Set([...(previous.human_participant_ids ? JSON.parse(previous.human_participant_ids) as string[] : []),
    ...record.humanUserIds])].sort();
  const hadBot = record.hadBot || (previous.had_bot === 1);
  const merged = { humanUserIds: humans, hadBot, inferred: record.inferred };
  database.client.prepare(`UPDATE games SET human_participant_ids = ?, had_bot = ?, participation = ?,
    participation_inferred = ?, stats_revision = stats_revision + 1 WHERE id = ?`)
    .run(JSON.stringify(humans), Number(hadBot), classifyParticipation(merged), Number(record.inferred), gameId);
}

/** Alias is supplied by application code, never request data. */
export function participationCondition(view: ParticipationView, alias = 'games') {
  return view === 'all' ? sql`1 = 1` : sql`${sql.raw(`${alias}.participation`)} = ${view}`;
}

export function getParticipationMetadata(database: Database, view: ParticipationView, userId?: string): ParticipationMetadata {
  inferLegacyParticipation(database);
  const userCondition = userId === undefined ? sql`1 = 1` : sql`g.id IN (
    SELECT game_id FROM player_rounds WHERE user_id = ${userId}
    UNION SELECT id FROM games WHERE north_user_id = ${userId} OR east_user_id = ${userId}
      OR south_user_id = ${userId} OR west_user_id = ${userId})`;
  const rows = database.db.all(sql`SELECT COUNT(*) as totalGames,
    COALESCE(SUM(participation_inferred), 0) as inferredGames FROM games g
    WHERE ${userCondition} AND ${participationCondition(view, 'g')}`) as { totalGames: number; inferredGames: number }[];
  return { participation: view, ...rows[0] };
}

export function getStatsSource(database: Database, userId: string) {
  const result = database.client.prepare(`SELECT COUNT(DISTINCT g.id) as gameCount,
    COUNT(pr.id) as roundCount, COALESCE(SUM(g.stats_revision),0) as revision, MAX(g.ended_at) as latestEndedAt
    FROM player_rounds pr JOIN games g ON g.id = pr.game_id WHERE pr.user_id = ?`).get(userId) as {
      gameCount: number; roundCount: number; revision: number; latestEndedAt: string | null;
    };
  return { ...result, signature: `${result.gameCount}:${result.roundCount}:${result.revision}` };
}
