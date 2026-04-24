import { describe, it, expect, afterEach } from 'vitest';
import { createDatabase, backfillPlayerRoundsUserId } from '../../src/db/connection.js';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

function makeTmpDb(): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'tichu-backfill-'));
  const path = join(dir, 'test.sqlite');
  return {
    path,
    cleanup() {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* ok */ }
    },
  };
}

describe('player_rounds.user_id back-fill migration', () => {
  const cleanups: Array<() => void> = [];
  afterEach(() => { cleanups.forEach(fn => fn()); cleanups.length = 0; });

  it('populates user_id from games.{seat}_user_id where NULL', () => {
    const tmp = makeTmpDb();
    cleanups.push(tmp.cleanup);

    // First createDatabase: schema only
    const db1 = createDatabase(tmp.path);

    // Seed users
    for (const [id, name] of [['u1','Alice'],['u2','Bob'],['u3','Carol'],['u4','Dave']] as const) {
      db1.client.prepare(
        `INSERT INTO users (id, display_name, created_at, last_seen_at)
         VALUES (?, ?, datetime('now'), datetime('now'))`,
      ).run(id, name);
    }

    // Seed a game with all 4 human seats
    db1.client.prepare(`
      INSERT INTO games (room_code, started_at, ended_at, winner_team, final_score_ns, final_score_ew,
                         target_score, round_count, north_user_id, east_user_id, south_user_id, west_user_id,
                         north_name, east_name, south_name, west_name)
      VALUES ('ROOM1', datetime('now'), datetime('now'), 'NS', 1000, 500, 1000, 1,
              'u1', 'u2', 'u3', 'u4', 'Alice', 'Bob', 'Carol', 'Dave')
    `).run();
    const gameId = (db1.client.prepare('SELECT last_insert_rowid() AS id').get() as { id: number }).id;

    // Seed game_round
    db1.client.prepare(`
      INSERT INTO game_rounds (game_id, round_number, card_points_ns, card_points_ew,
                               tichu_bonus_ns, tichu_bonus_ew, total_ns, total_ew, finish_order, tichu_calls)
      VALUES (?, 1, 100, 0, 0, 0, 100, 0, '["north","south","east","west"]', '{}')
    `).run(gameId);

    // Seed player_rounds with NULL user_id
    for (const seat of ['north','east','south','west']) {
      db1.client.prepare(`
        INSERT INTO player_rounds (game_id, round_number, seat, user_id)
        VALUES (?, 1, ?, NULL)
      `).run(gameId, seat);
    }

    db1.close();

    // Re-open — back-fill migration runs in createDatabase
    const db2 = createDatabase(tmp.path);
    cleanups.push(() => db2.close());

    const rows = db2.client.prepare(
      `SELECT seat, user_id FROM player_rounds ORDER BY seat`,
    ).all() as { seat: string; user_id: string }[];

    expect(rows).toEqual([
      { seat: 'east', user_id: 'u2' },
      { seat: 'north', user_id: 'u1' },
      { seat: 'south', user_id: 'u3' },
      { seat: 'west', user_id: 'u4' },
    ]);
  });

  it('is idempotent — running twice does not overwrite already-set user_ids', () => {
    const tmp = makeTmpDb();
    cleanups.push(tmp.cleanup);

    const db1 = createDatabase(tmp.path);

    // Seed minimal data
    db1.client.prepare(
      `INSERT INTO users (id, display_name) VALUES ('u1','A'),('u2','B')`,
    ).run();
    db1.client.prepare(`
      INSERT INTO games (room_code, started_at, ended_at, winner_team, final_score_ns, final_score_ew,
                         target_score, round_count, north_user_id, east_user_id, south_user_id, west_user_id,
                         north_name, east_name, south_name, west_name)
      VALUES ('ROOM1', datetime('now'), datetime('now'), 'NS', 1000, 500, 1000, 1,
              'u1', 'u2', NULL, NULL, 'A', 'B', 'BotS', 'BotW')
    `).run();
    const gameId = (db1.client.prepare('SELECT last_insert_rowid() AS id').get() as { id: number }).id;
    db1.client.prepare(`
      INSERT INTO game_rounds (game_id, round_number, card_points_ns, card_points_ew,
                               tichu_bonus_ns, tichu_bonus_ew, total_ns, total_ew, finish_order, tichu_calls)
      VALUES (?, 1, 100, 0, 0, 0, 100, 0, '[]', '{}')
    `).run(gameId);

    // Insert one row with a manually-set user_id
    db1.client.prepare(`
      INSERT INTO player_rounds (game_id, round_number, seat, user_id)
      VALUES (?, 1, 'north', 'manually_set')
    `).run(gameId);

    // Run back-fill directly
    const changes = backfillPlayerRoundsUserId(db1.client);
    expect(changes).toBe(0); // 'manually_set' is NOT NULL — no rows to update

    const row = db1.client.prepare(
      `SELECT user_id FROM player_rounds WHERE seat = 'north'`,
    ).get() as { user_id: string };
    expect(row.user_id).toBe('manually_set');

    db1.close();
  });

  it('leaves user_id NULL when games.{seat}_user_id is also NULL (bot seat)', () => {
    const tmp = makeTmpDb();
    cleanups.push(tmp.cleanup);

    const db1 = createDatabase(tmp.path);

    db1.client.prepare(
      `INSERT INTO users (id, display_name) VALUES ('u1','Alice')`,
    ).run();
    db1.client.prepare(`
      INSERT INTO games (room_code, started_at, ended_at, winner_team, final_score_ns, final_score_ew,
                         target_score, round_count, north_user_id, east_user_id, south_user_id, west_user_id,
                         north_name, east_name, south_name, west_name)
      VALUES ('ROOM1', datetime('now'), datetime('now'), 'NS', 1000, 500, 1000, 1,
              'u1', NULL, NULL, NULL, 'Alice', 'Bot-E', 'Bot-S', 'Bot-W')
    `).run();
    const gameId = (db1.client.prepare('SELECT last_insert_rowid() AS id').get() as { id: number }).id;
    db1.client.prepare(`
      INSERT INTO game_rounds (game_id, round_number, card_points_ns, card_points_ew,
                               tichu_bonus_ns, tichu_bonus_ew, total_ns, total_ew, finish_order, tichu_calls)
      VALUES (?, 1, 100, 0, 0, 0, 100, 0, '[]', '{}')
    `).run(gameId);

    for (const seat of ['north','east','south','west']) {
      db1.client.prepare(`
        INSERT INTO player_rounds (game_id, round_number, seat, user_id)
        VALUES (?, 1, ?, NULL)
      `).run(gameId, seat);
    }

    db1.close();

    // Re-open triggers back-fill
    const db2 = createDatabase(tmp.path);
    cleanups.push(() => db2.close());

    const rows = db2.client.prepare(
      `SELECT seat, user_id FROM player_rounds ORDER BY seat`,
    ).all() as { seat: string; user_id: string | null }[];

    expect(rows).toEqual([
      { seat: 'east', user_id: null },
      { seat: 'north', user_id: 'u1' },
      { seat: 'south', user_id: null },
      { seat: 'west', user_id: null },
    ]);
  });
});
