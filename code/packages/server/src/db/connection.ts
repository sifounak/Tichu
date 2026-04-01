// REQ-F-AU03: Database connection for game persistence
// REQ-DP-03: SQLite file-based database via better-sqlite3

import { drizzle } from 'drizzle-orm/better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';
import type { Database as BetterSqlite3Database } from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import * as schema from './schema.js';

export interface Database {
  db: ReturnType<typeof drizzle>;
  client: BetterSqlite3Database;
  close(): void;
}

/**
 * Creates a Drizzle database connection using the better-sqlite3 driver.
 * Automatically creates parent directories for the database file.
 * Returns the Drizzle instance, underlying client, and a close function.
 */
export function createDatabase(dbPath: string): Database {
  // Ensure the directory exists
  mkdirSync(dirname(dbPath), { recursive: true });

  const client = new BetterSqlite3(dbPath);

  // Enable WAL mode for better concurrent read performance
  client.pragma('journal_mode = WAL');

  // Ensure all tables exist (idempotent — CREATE TABLE IF NOT EXISTS)
  syncSchema(client);

  const db = drizzle(client, { schema });

  return {
    db,
    client,
    /** Close the database connection */
    close() {
      client.close();
    },
  };
}

/** Create all tables if they don't exist. Idempotent. */
function syncSchema(client: BetterSqlite3Database): void {
  client.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT,
      display_name TEXT NOT NULL,
      email TEXT,
      password_hash TEXT,
      is_guest INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email);
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users(username);

    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_code TEXT NOT NULL,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT NOT NULL DEFAULT (datetime('now')),
      winner_team TEXT NOT NULL,
      final_score_ns INTEGER NOT NULL,
      final_score_ew INTEGER NOT NULL,
      target_score INTEGER NOT NULL DEFAULT 1000,
      round_count INTEGER NOT NULL,
      north_user_id TEXT REFERENCES users(id),
      east_user_id TEXT REFERENCES users(id),
      south_user_id TEXT REFERENCES users(id),
      west_user_id TEXT REFERENCES users(id),
      north_name TEXT NOT NULL,
      east_name TEXT NOT NULL,
      south_name TEXT NOT NULL,
      west_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS game_rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id),
      round_number INTEGER NOT NULL,
      card_points_ns INTEGER NOT NULL,
      card_points_ew INTEGER NOT NULL,
      tichu_bonus_ns INTEGER NOT NULL DEFAULT 0,
      tichu_bonus_ew INTEGER NOT NULL DEFAULT 0,
      one_two_bonus TEXT,
      total_ns INTEGER NOT NULL,
      total_ew INTEGER NOT NULL,
      finish_order TEXT NOT NULL,
      tichu_calls TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS player_stats (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      games_played INTEGER NOT NULL DEFAULT 0,
      games_won INTEGER NOT NULL DEFAULT 0,
      win_rate REAL NOT NULL DEFAULT 0,
      tichu_calls INTEGER NOT NULL DEFAULT 0,
      tichu_successes INTEGER NOT NULL DEFAULT 0,
      grand_tichu_calls INTEGER NOT NULL DEFAULT 0,
      grand_tichu_successes INTEGER NOT NULL DEFAULT 0,
      total_rounds_played INTEGER NOT NULL DEFAULT 0,
      first_finishes INTEGER NOT NULL DEFAULT 0,
      last_updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      -- Group A: Game-level stats
      largest_win_diff INTEGER NOT NULL DEFAULT 0,
      largest_loss_diff INTEGER NOT NULL DEFAULT 0,
      games_forfeited INTEGER NOT NULL DEFAULT 0,
      games_spectated INTEGER NOT NULL DEFAULT 0,
      one_two_wins INTEGER NOT NULL DEFAULT 0,
      one_two_against INTEGER NOT NULL DEFAULT 0,
      -- Group B: Round-level stats
      rounds_won INTEGER NOT NULL DEFAULT 0,
      opponent_tichu_broken INTEGER NOT NULL DEFAULT 0,
      opponent_grand_tichu_broken INTEGER NOT NULL DEFAULT 0,
      partner_tichu_broken INTEGER NOT NULL DEFAULT 0,
      partner_grand_tichu_broken INTEGER NOT NULL DEFAULT 0,
      -- Group C: Card event stats
      rounds_with_dragon INTEGER NOT NULL DEFAULT 0,
      rounds_with_dragon_won INTEGER NOT NULL DEFAULT 0,
      rounds_with_phoenix INTEGER NOT NULL DEFAULT 0,
      rounds_with_phoenix_won INTEGER NOT NULL DEFAULT 0,
      dragon_received_in_pass INTEGER NOT NULL DEFAULT 0,
      phoenix_received_in_pass INTEGER NOT NULL DEFAULT 0,
      ace_received_in_pass INTEGER NOT NULL DEFAULT 0,
      dog_received_in_pass INTEGER NOT NULL DEFAULT 0,
      dragon_trick_wins INTEGER NOT NULL DEFAULT 0,
      dragon_given_after_opponent_win INTEGER NOT NULL DEFAULT 0,
      dog_given_to_partner INTEGER NOT NULL DEFAULT 0,
      dog_given_to_opponent INTEGER NOT NULL DEFAULT 0,
      dog_played_for_tichu_partner INTEGER NOT NULL DEFAULT 0,
      dog_opportunities_for_tichu_partner INTEGER NOT NULL DEFAULT 0,
      hands_with_bombs INTEGER NOT NULL DEFAULT 0,
      total_bombs INTEGER NOT NULL DEFAULT 0,
      four_card_bombs INTEGER NOT NULL DEFAULT 0,
      five_card_bombs INTEGER NOT NULL DEFAULT 0,
      six_plus_card_bombs INTEGER NOT NULL DEFAULT 0,
      bombs_in_first_8 INTEGER NOT NULL DEFAULT 0,
      hands_with_multiple_bombs INTEGER NOT NULL DEFAULT 0,
      over_bombed INTEGER NOT NULL DEFAULT 0,
      bomb_forced_by_wish INTEGER NOT NULL DEFAULT 0,
      the_tichu_clean INTEGER NOT NULL DEFAULT 0,
      the_tichu_dirty INTEGER NOT NULL DEFAULT 0
    );

    -- REQ-F-DB02: Player relational stats
    CREATE TABLE IF NOT EXISTS player_relational_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id),
      other_user_id TEXT NOT NULL REFERENCES users(id),
      relationship TEXT NOT NULL,
      games_played INTEGER NOT NULL DEFAULT 0,
      games_won INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, other_user_id, relationship)
    );

    -- REQ-F-DB03: Round player events (audit trail)
    CREATE TABLE IF NOT EXISTS round_player_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id),
      round_number INTEGER NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id),
      seat TEXT NOT NULL,
      event_data TEXT NOT NULL
    );
  `);

  // REQ-F-AU10: Add username column to existing users table (for existing DBs)
  try {
    client.exec(`ALTER TABLE users ADD COLUMN username TEXT`);
  } catch {
    // Column already exists
  }
  try {
    client.exec(`CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users(username)`);
  } catch {
    // Index already exists
  }

  // Add new columns to existing player_stats table (for existing DBs)
  // SQLite ADD COLUMN is idempotent-safe: we catch "duplicate column" errors
  const newColumns = [
    'largest_win_diff INTEGER NOT NULL DEFAULT 0',
    'largest_loss_diff INTEGER NOT NULL DEFAULT 0',
    'games_forfeited INTEGER NOT NULL DEFAULT 0',
    'games_spectated INTEGER NOT NULL DEFAULT 0',
    'one_two_wins INTEGER NOT NULL DEFAULT 0',
    'one_two_against INTEGER NOT NULL DEFAULT 0',
    'rounds_won INTEGER NOT NULL DEFAULT 0',
    'opponent_tichu_broken INTEGER NOT NULL DEFAULT 0',
    'opponent_grand_tichu_broken INTEGER NOT NULL DEFAULT 0',
    'partner_tichu_broken INTEGER NOT NULL DEFAULT 0',
    'partner_grand_tichu_broken INTEGER NOT NULL DEFAULT 0',
    'rounds_with_dragon INTEGER NOT NULL DEFAULT 0',
    'rounds_with_dragon_won INTEGER NOT NULL DEFAULT 0',
    'rounds_with_phoenix INTEGER NOT NULL DEFAULT 0',
    'rounds_with_phoenix_won INTEGER NOT NULL DEFAULT 0',
    'dragon_received_in_pass INTEGER NOT NULL DEFAULT 0',
    'phoenix_received_in_pass INTEGER NOT NULL DEFAULT 0',
    'ace_received_in_pass INTEGER NOT NULL DEFAULT 0',
    'dog_received_in_pass INTEGER NOT NULL DEFAULT 0',
    'dragon_trick_wins INTEGER NOT NULL DEFAULT 0',
    'dragon_given_after_opponent_win INTEGER NOT NULL DEFAULT 0',
    'dog_given_to_partner INTEGER NOT NULL DEFAULT 0',
    'dog_given_to_opponent INTEGER NOT NULL DEFAULT 0',
    'dog_played_for_tichu_partner INTEGER NOT NULL DEFAULT 0',
    'dog_opportunities_for_tichu_partner INTEGER NOT NULL DEFAULT 0',
    'hands_with_bombs INTEGER NOT NULL DEFAULT 0',
    'total_bombs INTEGER NOT NULL DEFAULT 0',
    'four_card_bombs INTEGER NOT NULL DEFAULT 0',
    'five_card_bombs INTEGER NOT NULL DEFAULT 0',
    'six_plus_card_bombs INTEGER NOT NULL DEFAULT 0',
    'bombs_in_first_8 INTEGER NOT NULL DEFAULT 0',
    'hands_with_multiple_bombs INTEGER NOT NULL DEFAULT 0',
    'over_bombed INTEGER NOT NULL DEFAULT 0',
    'bomb_forced_by_wish INTEGER NOT NULL DEFAULT 0',
    'the_tichu_clean INTEGER NOT NULL DEFAULT 0',
    'the_tichu_dirty INTEGER NOT NULL DEFAULT 0',
    // REQ-F-SO02–SO05: Stats page overhaul columns
    'last_finishes INTEGER NOT NULL DEFAULT 0',
    'tichu_broken_by_partner INTEGER NOT NULL DEFAULT 0',
    'grand_tichu_broken_by_partner INTEGER NOT NULL DEFAULT 0',
    'games_requiring_tie_break INTEGER NOT NULL DEFAULT 0',
    'most_tie_break_rounds_needed INTEGER NOT NULL DEFAULT 0',
    'games_joined_after_spectating INTEGER NOT NULL DEFAULT 0',
    // REQ-F-CS03–CS05: Phoenix play type tracking
    'phoenix_used_as_single INTEGER NOT NULL DEFAULT 0',
    'phoenix_used_for_pair INTEGER NOT NULL DEFAULT 0',
    'phoenix_used_in_triple INTEGER NOT NULL DEFAULT 0',
    'phoenix_used_in_full_house INTEGER NOT NULL DEFAULT 0',
    'phoenix_used_in_consecutive_pairs INTEGER NOT NULL DEFAULT 0',
    'phoenix_used_in_straight INTEGER NOT NULL DEFAULT 0',
    'longest_straight_with_phoenix INTEGER NOT NULL DEFAULT 0',
    // REQ-F-CS06–CS09: Dog control tracking
    'dog_control_to_partner INTEGER NOT NULL DEFAULT 0',
    'dog_control_to_opponent INTEGER NOT NULL DEFAULT 0',
    'dog_control_to_self INTEGER NOT NULL DEFAULT 0',
    'dog_stuck_as_last_card INTEGER NOT NULL DEFAULT 0',
    // REQ-F-CS10–CS12: Per-size bomb tracking
    'bomb_size_4 INTEGER NOT NULL DEFAULT 0',
    'bomb_size_5 INTEGER NOT NULL DEFAULT 0',
    'bomb_size_6 INTEGER NOT NULL DEFAULT 0',
    'bomb_size_7 INTEGER NOT NULL DEFAULT 0',
    'bomb_size_8 INTEGER NOT NULL DEFAULT 0',
    'bomb_size_9 INTEGER NOT NULL DEFAULT 0',
    'bomb_size_10 INTEGER NOT NULL DEFAULT 0',
    'bomb_size_11 INTEGER NOT NULL DEFAULT 0',
    'bomb_size_12 INTEGER NOT NULL DEFAULT 0',
    'bomb_size_13 INTEGER NOT NULL DEFAULT 0',
    'bomb_size_14 INTEGER NOT NULL DEFAULT 0',
    // REQ-F-CS13–CS15: Conflicting bombs
    'conflicting_bombs INTEGER NOT NULL DEFAULT 0',
    // REQ-F-CS16–CS18: Over-bomb direction split
    'you_over_bombed INTEGER NOT NULL DEFAULT 0',
    'you_were_over_bombed INTEGER NOT NULL DEFAULT 0',
    // REQ-F-CS19–CS22: Extended pass tracking
    'dragon_gave_in_pass INTEGER NOT NULL DEFAULT 0',
    'phoenix_gave_in_pass INTEGER NOT NULL DEFAULT 0',
    'ace_gave_in_pass INTEGER NOT NULL DEFAULT 0',
    'mahjong_gave_in_pass INTEGER NOT NULL DEFAULT 0',
    'mahjong_received_in_pass INTEGER NOT NULL DEFAULT 0',
    'dog_received_from_partner INTEGER NOT NULL DEFAULT 0',
    'dog_received_from_opponent INTEGER NOT NULL DEFAULT 0',
    'bomb_gave_to_partner INTEGER NOT NULL DEFAULT 0',
    'bomb_gave_to_opponent INTEGER NOT NULL DEFAULT 0',
    'bomb_received_from_partner INTEGER NOT NULL DEFAULT 0',
    'bomb_received_from_opponent INTEGER NOT NULL DEFAULT 0',
    // Dog: hands with dog (after pass)
    'hands_with_dog INTEGER NOT NULL DEFAULT 0',
    // Pass analysis
    'strong_pre_pass_hand INTEGER NOT NULL DEFAULT 0',
    'kept_dog_during_pass INTEGER NOT NULL DEFAULT 0',
    // Achievements (expanded)
    'all_power_cards_before_pass INTEGER NOT NULL DEFAULT 0',
    'all_cards_under_10_after_pass INTEGER NOT NULL DEFAULT 0',
    'double_bomb_in_trick INTEGER NOT NULL DEFAULT 0',
    'all_players_bomb_in_round INTEGER NOT NULL DEFAULT 0',
  ];
  for (const col of newColumns) {
    try {
      client.exec(`ALTER TABLE player_stats ADD COLUMN ${col}`);
    } catch {
      // Column already exists — expected for new DBs or re-runs
    }
  }

  // REQ-F-CS17: Migrate existing overBombed data to youWereOverBombed
  try {
    client.exec(`UPDATE player_stats SET you_were_over_bombed = over_bombed WHERE you_were_over_bombed = 0 AND over_bombed > 0`);
  } catch {
    // Table or columns may not exist yet on first run — safe to ignore
  }
}
