import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { createDatabase, type Database } from '../../src/db/connection.js';
import { runRebuild } from '../../scripts/rebuild-stats.js';

const TEST_DB_PATH = './data/test-rebuild-stats.sqlite';

function seedMinimalGame(database: Database): void {
  const { client } = database;

  client.prepare(
    `INSERT INTO users (id, display_name) VALUES (?, ?)`,
  ).run('user1', 'Alice');
  client.prepare(
    `INSERT INTO users (id, display_name) VALUES (?, ?)`,
  ).run('user2', 'Bob');
  // Synthetic bot user needed by relational stats (FK on relational_stats_cache.other_user_id)
  client.prepare(
    `INSERT OR IGNORE INTO users (id, display_name) VALUES (?, ?)`,
  ).run('__bot__', 'Bot');

  const gameId = Number(
    client.prepare(
      `INSERT INTO games (room_code, started_at, ended_at, winner_team,
        final_score_ns, final_score_ew, target_score, round_count,
        north_user_id, east_user_id, south_user_id, west_user_id,
        north_name, east_name, south_name, west_name)
      VALUES ('ROOM1', datetime('now'), datetime('now'), 'NS',
        1000, 500, 1000, 1,
        'user1', 'user2', null, null,
        'Alice', 'Bob', 'BotS', 'BotW')`,
    ).run().lastInsertRowid,
  );

  client.prepare(
    `INSERT INTO game_rounds (game_id, round_number, card_points_ns, card_points_ew,
      tichu_bonus_ns, tichu_bonus_ew, total_ns, total_ew,
      finish_order, tichu_calls, score_ns_at_start, score_ew_at_start)
    VALUES (?, 1, 100, 0, 0, 0, 100, 0,
      '["north","south","east","west"]', '{}', 0, 0)`,
  ).run(gameId);

  for (const [seat, userId] of [['north', 'user1'], ['east', 'user2'], ['south', null], ['west', null]] as const) {
    client.prepare(
      `INSERT INTO player_rounds (game_id, round_number, seat, user_id,
        grand_tichu_call, tichu_call, finish_position)
      VALUES (?, 1, ?, ?, 0, 0, ?)`,
    ).run(gameId, seat, userId, seat === 'north' ? 1 : seat === 'south' ? 2 : seat === 'east' ? 3 : 4);
  }
}

describe('runRebuild', () => {
  afterEach(() => {
    try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ok */ }
  });

  it('repopulates stats_cache after a back-filled DB', () => {
    const database = createDatabase(TEST_DB_PATH);
    try {
      // Verify cache is empty initially
      const beforeRows = (database.client.prepare(
        `SELECT COUNT(*) AS n FROM stats_cache`,
      ).get() as { n: number }).n;
      expect(beforeRows).toBe(0);

      // Seed game data with user_ids
      seedMinimalGame(database);

      // Run rebuild
      const result = runRebuild(database);

      expect(result.usersUpdated).toBeGreaterThan(0);
      expect(result.statsCacheRows).toBeGreaterThan(0);

      // Verify user1 has stats
      const cached = database.client.prepare(
        `SELECT * FROM stats_cache WHERE user_id = ?`,
      ).get('user1') as Record<string, unknown> | undefined;
      expect(cached).toBeTruthy();
      expect(cached!.games_played).toBe(1);
      expect(cached!.total_rounds_played).toBe(1);
      expect(cached!.first_finishes).toBe(1);
    } finally {
      database.close();
    }
  });

  it('is idempotent — running twice produces the same result', () => {
    const database = createDatabase(TEST_DB_PATH);
    try {
      seedMinimalGame(database);

      const result1 = runRebuild(database);
      const result2 = runRebuild(database);

      expect(result2.usersUpdated).toBe(result1.usersUpdated);
      expect(result2.statsCacheRows).toBe(result1.statsCacheRows);
    } finally {
      database.close();
    }
  });

  it('returns zero when no users have played', () => {
    const database = createDatabase(TEST_DB_PATH);
    try {
      const result = runRebuild(database);
      expect(result.usersUpdated).toBe(0);
      expect(result.statsCacheRows).toBe(0);
      expect(result.relationalStatsCacheRows).toBe(0);
    } finally {
      database.close();
    }
  });
});
