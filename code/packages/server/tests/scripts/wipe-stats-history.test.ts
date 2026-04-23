// Verifies: REQ-F-SA14

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { createDatabase, type Database } from '../../src/db/connection.js';
import {
  runWipe,
  countRows,
  WIPE_TABLES,
  PRESERVE_TABLES,
} from '../../scripts/wipe-stats-history.js';

const TEST_DB_PATH = './data/test-wipe-stats.sqlite';

function seedAllTables(database: Database): void {
  const { client } = database;

  client.prepare(
    `INSERT INTO users (id, display_name) VALUES (?, ?)`,
  ).run('user1', 'User One');
  client.prepare(
    `INSERT INTO users (id, display_name) VALUES (?, ?)`,
  ).run('user2', 'User Two');

  const gameId = Number(
    client.prepare(
      `INSERT INTO games (room_code, started_at, ended_at, winner_team,
        final_score_ns, final_score_ew, target_score, round_count,
        north_user_id, east_user_id, south_user_id, west_user_id,
        north_name, east_name, south_name, west_name)
      VALUES ('ROOM1', datetime('now'), datetime('now'), 'NS',
        500, 300, 1000, 1,
        'user1', 'user2', null, null,
        'North', 'East', 'South', 'West')`,
    ).run().lastInsertRowid,
  );

  client.prepare(
    `INSERT INTO game_rounds (game_id, round_number, card_points_ns, card_points_ew,
      tichu_bonus_ns, tichu_bonus_ew, one_two_bonus, total_ns, total_ew,
      finish_order, tichu_calls, score_ns_at_start, score_ew_at_start)
    VALUES (?, 1, 50, 50, 0, 0, null, 50, 50, '["north"]', '{}', 0, 0)`,
  ).run(gameId);

  client.prepare(
    `INSERT INTO player_rounds (game_id, round_number, seat, user_id,
      grand_tichu_call, tichu_call, tichu_call_success, finish_position,
      hand_after_pass, full_hand_pre_pass)
    VALUES (?, 1, 'north', 'user1', 0, 0, null, 1, '[]', '[]')`,
  ).run(gameId);

  client.prepare(
    `INSERT INTO tricks (game_id, round_number, trick_number, lead_seat)
    VALUES (?, 1, 1, 'north')`,
  ).run(gameId);

  client.prepare(
    `INSERT INTO plays (game_id, round_number, trick_number, sequence_number, seat, action_type)
    VALUES (?, 1, 1, 1, 'north', 'play')`,
  ).run(gameId);

  client.prepare(
    `INSERT INTO wish_events (game_id, round_number, wish_rank, trick_number,
      cards_of_rank_remaining, cards_of_rank_in_wisher_hand)
    VALUES (?, 1, 2, 1, 4, 0)`,
  ).run(gameId);

  client.prepare(
    `INSERT INTO dragon_gift_events (game_id, round_number, trick_number,
      gifter_seat, recipient_seat, trick_point_value, recipient_cards_left,
      other_opponent_cards_left)
    VALUES (?, 1, 1, 'north', 'east', 25, 13, 13)`,
  ).run(gameId);

  client.prepare(
    `INSERT INTO dog_play_events (game_id, round_number, trick_number,
      player_seat, control_passed_to)
    VALUES (?, 1, 1, 'north', 'south')`,
  ).run(gameId);

  const bombInventoryId = Number(
    client.prepare(
      `INSERT INTO bomb_inventory (game_id, round_number, player_seat,
        bomb_type, cards, rank, size, acquired_phase)
      VALUES (?, 1, 'north', 'four_of_a_kind', '[0,1,2,3]', 2, 4, 'deal')`,
    ).run(gameId).lastInsertRowid,
  );

  client.prepare(
    `INSERT INTO bomb_events (game_id, round_number, bomb_inventory_id,
      event_type, trick_number)
    VALUES (?, 1, ?, 'played', 1)`,
  ).run(gameId, bombInventoryId);

  client.prepare(
    `INSERT INTO player_global_stats (user_id, total_chat_messages) VALUES (?, 42)`,
  ).run('user1');

  client.prepare(
    `INSERT INTO stats_cache (user_id, games_played, games_won) VALUES (?, 1, 1)`,
  ).run('user1');

  client.prepare(
    `INSERT INTO relational_stats_cache (user_id, other_user_id, relationship, games_played)
    VALUES (?, ?, 'partner', 1)`,
  ).run('user1', 'user2');

  client.prepare(
    `INSERT INTO active_games (game_id, room_code, state_blob) VALUES (?, ?, ?)`,
  ).run('ag1', 'ROOM1', '{}');

  client.prepare(
    `INSERT INTO active_rooms (room_code, room_blob) VALUES (?, ?)`,
  ).run('ROOM1', '{}');
}

describe('wipe-stats-history (REQ-F-SA14)', () => {
  let database: Database;

  beforeEach(() => {
    try {
      fs.unlinkSync(TEST_DB_PATH);
    } catch {
      // File doesn't exist
    }
    database = createDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    database.close();
    try {
      fs.unlinkSync(TEST_DB_PATH);
    } catch {
      // Ignore
    }
  });

  it('wipes all 13 targeted tables and preserves users, active_games, active_rooms', () => {
    seedAllTables(database);

    const beforeCounts = countRows(database.client);
    // Every wipe table has at least 1 row after seeding
    for (const table of WIPE_TABLES) {
      expect(beforeCounts[table]).toBeGreaterThan(0);
    }
    // Every preserve table has at least 1 row after seeding
    for (const table of PRESERVE_TABLES) {
      expect(beforeCounts[table]).toBeGreaterThan(0);
    }

    const result = runWipe(database.client);

    // Wipe tables are empty
    for (const table of WIPE_TABLES) {
      expect(result.after[table], `${table} should be empty after wipe`).toBe(0);
    }
    // Preserve tables are unchanged
    for (const table of PRESERVE_TABLES) {
      expect(
        result.after[table],
        `${table} should be unchanged after wipe`,
      ).toBe(beforeCounts[table]);
    }

    // Report captures before/after correctly
    for (const table of WIPE_TABLES) {
      expect(result.before[table]).toBe(beforeCounts[table]);
    }
  });

  it('is idempotent: running twice leaves wipe tables empty with no error', () => {
    seedAllTables(database);
    runWipe(database.client);
    const second = runWipe(database.client);
    for (const table of WIPE_TABLES) {
      expect(second.before[table]).toBe(0);
      expect(second.after[table]).toBe(0);
    }
  });

  it('runs in a single transaction (no partial wipe if a later delete fails)', () => {
    seedAllTables(database);
    // Cause a failure partway through: add a trigger that raises on
    // DELETE FROM games (the 10th entry in WIPE_TABLES). If the wipe is
    // NOT transactional the earlier deletes would still commit.
    database.client.exec(`
      CREATE TRIGGER block_games_delete BEFORE DELETE ON games
      BEGIN
        SELECT RAISE(FAIL, 'blocked for test');
      END;
    `);

    const before = countRows(database.client);
    expect(() => runWipe(database.client)).toThrow(/blocked for test/);

    // Transaction rolled back — every table should be at its pre-wipe count
    const after = countRows(database.client);
    for (const table of [...WIPE_TABLES, ...PRESERVE_TABLES]) {
      expect(after[table], `${table} should be rolled back`).toBe(before[table]);
    }

    database.client.exec(`DROP TRIGGER block_games_delete;`);
  });

  it('counts exactly the 13 wipe tables and 3 preserve tables (REQ-F-SA14 list integrity)', () => {
    expect(WIPE_TABLES).toHaveLength(13);
    expect(PRESERVE_TABLES).toHaveLength(3);
    expect(new Set([...WIPE_TABLES, ...PRESERVE_TABLES]).size).toBe(16);
  });
});
