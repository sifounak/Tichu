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

  // REQ-NF-SA05: stats-cache queries use SQLite row-value IN tuple syntax (3.15+).
  // Abort at startup if the bundled SQLite is too old rather than fail opaquely later.
  const versionRow = client.prepare('SELECT sqlite_version() AS v').get() as { v: string };
  const [maj, min] = versionRow.v.split('.').map(Number);
  if (maj < 3 || (maj === 3 && min < 15)) {
    throw new Error(
      `SQLite ${versionRow.v} does not support row-value IN tuple syntax (requires 3.15+)`,
    );
  }

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

    -- ═══════════════════════════════════════════════════════════════════
    -- REQ-F-MG03/MG04/MG05: Old player_stats, player_relational_stats,
    -- and round_player_events tables removed — replaced by stats_cache,
    -- relational_stats_cache, and player_rounds respectively.
    -- ═══════════════════════════════════════════════════════════════════

    -- ═══════════════════════════════════════════════════════════════════
    -- Statistics Redesign — Raw Event Tables (REQ-F-SC03–SC11)
    -- ═══════════════════════════════════════════════════════════════════

    -- REQ-F-SC03: Player rounds (structured replacement for round_player_events)
    CREATE TABLE IF NOT EXISTS player_rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id),
      round_number INTEGER NOT NULL,
      seat TEXT NOT NULL,
      user_id TEXT,
      -- Hands
      first_8_cards TEXT,
      full_hand_pre_pass TEXT,
      passed_to_left TEXT,
      passed_to_partner TEXT,
      passed_to_right TEXT,
      received_from_left TEXT,
      received_from_partner TEXT,
      received_from_right TEXT,
      hand_after_pass TEXT,
      -- Calls
      grand_tichu_call INTEGER NOT NULL DEFAULT 0,
      tichu_call INTEGER NOT NULL DEFAULT 0,
      tichu_call_phase TEXT,
      tichu_call_trick_number INTEGER,
      tichu_call_hand_sizes TEXT,
      tichu_call_success INTEGER,
      -- Finish
      finish_position INTEGER,
      finish_trick_number INTEGER,
      -- Points
      card_points_captured INTEGER NOT NULL DEFAULT 0,
      hand_points_given_to_opponents INTEGER NOT NULL DEFAULT 0,
      captured_points_given_to_first_out INTEGER NOT NULL DEFAULT 0,
      -- Running point total
      trick_point_running_total TEXT
    );

    -- REQ-F-SC04: Tricks (merged trick identity + result)
    CREATE TABLE IF NOT EXISTS tricks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id),
      round_number INTEGER NOT NULL,
      trick_number INTEGER NOT NULL,
      -- Lead info
      lead_seat TEXT NOT NULL,
      lead_combination_type TEXT,
      lead_combination_rank INTEGER,
      lead_combination_length INTEGER,
      -- Result info
      winner_seat TEXT,
      point_value INTEGER NOT NULL DEFAULT 0,
      trick_length INTEGER NOT NULL DEFAULT 0,
      uncontested INTEGER NOT NULL DEFAULT 0,
      -- Winning combination
      winning_combination_type TEXT,
      winning_combination_rank INTEGER,
      winning_combination_length INTEGER,
      -- Content flags
      contains_dragon INTEGER NOT NULL DEFAULT 0,
      contains_phoenix INTEGER NOT NULL DEFAULT 0,
      -- Context
      active_tichu_seats TEXT
    );

    -- REQ-F-SC05: Plays (one per action within a trick)
    CREATE TABLE IF NOT EXISTS plays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id),
      round_number INTEGER NOT NULL,
      trick_number INTEGER NOT NULL,
      sequence_number INTEGER NOT NULL,
      seat TEXT NOT NULL,
      -- Action
      action_type TEXT NOT NULL,
      action_at TEXT,
      action_source TEXT,
      -- Card details (play/bomb only)
      cards TEXT,
      combination_type TEXT,
      combination_rank INTEGER,
      combination_length INTEGER,
      phoenix_used_as INTEGER,
      phoenix_effective_value REAL,
      is_bomb INTEGER,
      legal_play_count INTEGER,
      -- Contextual flags
      out_of_turn INTEGER,
      interrupted_seat TEXT,
      end_of_trick_bomb INTEGER,
      played_on_top_of TEXT,
      player_finished INTEGER,
      cards_remaining_after INTEGER,
      could_have_gone_out INTEGER,
      played_minimum INTEGER,
      -- Hand sizes
      partner_cards_remaining INTEGER,
      left_opp_cards_remaining INTEGER,
      right_opp_cards_remaining INTEGER,
      -- Pass-specific
      could_have_played INTEGER,
      had_bomb_available INTEGER,
      -- Wish context
      wish_active INTEGER,
      wish_rank INTEGER,
      play_forced_by_wish INTEGER,
      -- Tichu context
      partner_tichu_active INTEGER,
      opponent_tichu_active TEXT,
      -- Timing
      turn_started_at TEXT,
      duration_ms INTEGER
    );

    -- REQ-F-SC06: Wish events
    CREATE TABLE IF NOT EXISTS wish_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id),
      round_number INTEGER NOT NULL,
      wish_rank INTEGER NOT NULL,
      trick_number INTEGER NOT NULL,
      cards_of_rank_remaining INTEGER NOT NULL,
      cards_of_rank_in_wisher_hand INTEGER NOT NULL,
      wish_fulfilled_trick INTEGER,
      wish_fulfilled_by TEXT
    );

    -- REQ-F-SC07: Dragon gift events
    CREATE TABLE IF NOT EXISTS dragon_gift_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id),
      round_number INTEGER NOT NULL,
      trick_number INTEGER NOT NULL,
      gifter_seat TEXT NOT NULL,
      recipient_seat TEXT NOT NULL,
      trick_point_value INTEGER NOT NULL,
      recipient_cards_left INTEGER NOT NULL,
      other_opponent_cards_left INTEGER NOT NULL,
      gifter_finished_on_play INTEGER NOT NULL DEFAULT 0,
      recipient_has_tichu INTEGER NOT NULL DEFAULT 0,
      other_opponent_has_tichu INTEGER NOT NULL DEFAULT 0,
      gift_was_forced INTEGER NOT NULL DEFAULT 0
    );

    -- REQ-F-SC08: Dog play events
    CREATE TABLE IF NOT EXISTS dog_play_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id),
      round_number INTEGER NOT NULL,
      trick_number INTEGER NOT NULL,
      player_seat TEXT NOT NULL,
      control_passed_to TEXT NOT NULL,
      partner_already_out INTEGER NOT NULL DEFAULT 0,
      partner_has_tichu INTEGER NOT NULL DEFAULT 0,
      had_prior_lead_opportunity INTEGER NOT NULL DEFAULT 0,
      dog_was_last_card INTEGER NOT NULL DEFAULT 0
    );

    -- REQ-F-SC09: Bomb inventory (Level 1)
    CREATE TABLE IF NOT EXISTS bomb_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id),
      round_number INTEGER NOT NULL,
      player_seat TEXT NOT NULL,
      bomb_type TEXT NOT NULL,
      cards TEXT NOT NULL,
      rank INTEGER NOT NULL,
      size INTEGER NOT NULL,
      acquired_phase TEXT NOT NULL,
      bomb_plays_from_run INTEGER NOT NULL DEFAULT 0,
      overlaps_with TEXT,
      fate TEXT,
      fate_trick_number INTEGER,
      fate_target TEXT,
      out_of_turn INTEGER,
      end_of_trick_bomb INTEGER,
      plays_seen_while_held INTEGER NOT NULL DEFAULT 0,
      captured_dragon INTEGER NOT NULL DEFAULT 0,
      was_overbomb INTEGER NOT NULL DEFAULT 0,
      followed_by_dog INTEGER NOT NULL DEFAULT 0
    );

    -- REQ-F-SC10: Bomb events (Level 2)
    CREATE TABLE IF NOT EXISTS bomb_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id),
      round_number INTEGER NOT NULL,
      bomb_inventory_id INTEGER NOT NULL REFERENCES bomb_inventory(id),
      event_type TEXT NOT NULL,
      trick_number INTEGER,
      followed_by_dog INTEGER,
      card_lost INTEGER,
      could_have_played_bomb INTEGER,
      run_length_change INTEGER
    );

    -- REQ-F-SC11: Player global stats (lifetime counters)
    CREATE TABLE IF NOT EXISTS player_global_stats (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      total_chat_messages INTEGER NOT NULL DEFAULT 0,
      total_chat_characters INTEGER NOT NULL DEFAULT 0
    );

    -- ═══════════════════════════════════════════════════════════════════
    -- REQ-F-MC01: Materialized Stats Cache (disposable, rebuilt from raw events)
    -- ═══════════════════════════════════════════════════════════════════

    CREATE TABLE IF NOT EXISTS stats_cache (
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
      -- Group A
      largest_win_diff INTEGER NOT NULL DEFAULT 0,
      largest_loss_diff INTEGER NOT NULL DEFAULT 0,
      games_forfeited INTEGER NOT NULL DEFAULT 0,
      games_spectated INTEGER NOT NULL DEFAULT 0,
      one_two_wins INTEGER NOT NULL DEFAULT 0,
      one_two_against INTEGER NOT NULL DEFAULT 0,
      -- Group B
      rounds_won INTEGER NOT NULL DEFAULT 0,
      opponent_tichu_broken INTEGER NOT NULL DEFAULT 0,
      opponent_grand_tichu_broken INTEGER NOT NULL DEFAULT 0,
      partner_tichu_broken INTEGER NOT NULL DEFAULT 0,
      partner_grand_tichu_broken INTEGER NOT NULL DEFAULT 0,
      last_finishes INTEGER NOT NULL DEFAULT 0,
      tichu_broken_by_partner INTEGER NOT NULL DEFAULT 0,
      grand_tichu_broken_by_partner INTEGER NOT NULL DEFAULT 0,
      games_requiring_tie_break INTEGER NOT NULL DEFAULT 0,
      most_tie_break_rounds_needed INTEGER NOT NULL DEFAULT 0,
      games_joined_after_spectating INTEGER NOT NULL DEFAULT 0,
      -- Group C
      rounds_with_dragon INTEGER NOT NULL DEFAULT 0,
      rounds_with_dragon_won INTEGER NOT NULL DEFAULT 0,
      rounds_with_phoenix INTEGER NOT NULL DEFAULT 0,
      rounds_with_phoenix_won INTEGER NOT NULL DEFAULT 0,
      dragon_received_in_pass INTEGER NOT NULL DEFAULT 0,
      phoenix_received_in_pass INTEGER NOT NULL DEFAULT 0,
      ace_received_in_pass INTEGER NOT NULL DEFAULT 0,
      dog_received_in_pass INTEGER NOT NULL DEFAULT 0,
      dragon_trick_wins INTEGER NOT NULL DEFAULT 0,
      captured_dragon_with_bomb INTEGER NOT NULL DEFAULT 0,
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
      the_tichu_dirty INTEGER NOT NULL DEFAULT 0,
      phoenix_used_as_single INTEGER NOT NULL DEFAULT 0,
      phoenix_used_for_pair INTEGER NOT NULL DEFAULT 0,
      phoenix_used_in_triple INTEGER NOT NULL DEFAULT 0,
      phoenix_used_in_full_house INTEGER NOT NULL DEFAULT 0,
      phoenix_used_in_consecutive_pairs INTEGER NOT NULL DEFAULT 0,
      phoenix_used_in_straight INTEGER NOT NULL DEFAULT 0,
      longest_straight_with_phoenix INTEGER NOT NULL DEFAULT 0,
      dog_control_to_partner INTEGER NOT NULL DEFAULT 0,
      dog_control_to_opponent INTEGER NOT NULL DEFAULT 0,
      dog_control_to_self INTEGER NOT NULL DEFAULT 0,
      dog_stuck_as_last_card INTEGER NOT NULL DEFAULT 0,
      bomb_size_4 INTEGER NOT NULL DEFAULT 0,
      bomb_size_5 INTEGER NOT NULL DEFAULT 0,
      bomb_size_6 INTEGER NOT NULL DEFAULT 0,
      bomb_size_7 INTEGER NOT NULL DEFAULT 0,
      bomb_size_8 INTEGER NOT NULL DEFAULT 0,
      bomb_size_9 INTEGER NOT NULL DEFAULT 0,
      bomb_size_10 INTEGER NOT NULL DEFAULT 0,
      bomb_size_11 INTEGER NOT NULL DEFAULT 0,
      bomb_size_12 INTEGER NOT NULL DEFAULT 0,
      bomb_size_13 INTEGER NOT NULL DEFAULT 0,
      bomb_size_14 INTEGER NOT NULL DEFAULT 0,
      conflicting_bombs INTEGER NOT NULL DEFAULT 0,
      you_over_bombed INTEGER NOT NULL DEFAULT 0,
      you_were_over_bombed INTEGER NOT NULL DEFAULT 0,
      dragon_gave_in_pass INTEGER NOT NULL DEFAULT 0,
      phoenix_gave_in_pass INTEGER NOT NULL DEFAULT 0,
      ace_gave_in_pass INTEGER NOT NULL DEFAULT 0,
      mahjong_gave_in_pass INTEGER NOT NULL DEFAULT 0,
      mahjong_received_in_pass INTEGER NOT NULL DEFAULT 0,
      dog_received_from_partner INTEGER NOT NULL DEFAULT 0,
      dog_received_from_opponent INTEGER NOT NULL DEFAULT 0,
      bomb_gave_to_partner INTEGER NOT NULL DEFAULT 0,
      bomb_gave_to_opponent INTEGER NOT NULL DEFAULT 0,
      bomb_received_from_partner INTEGER NOT NULL DEFAULT 0,
      bomb_received_from_opponent INTEGER NOT NULL DEFAULT 0,
      hands_with_dog INTEGER NOT NULL DEFAULT 0,
      strong_pre_pass_hand INTEGER NOT NULL DEFAULT 0,
      kept_dog_during_pass INTEGER NOT NULL DEFAULT 0,
      all_power_cards_before_pass INTEGER NOT NULL DEFAULT 0,
      all_cards_under_10_after_pass INTEGER NOT NULL DEFAULT 0,
      double_bomb_in_trick INTEGER NOT NULL DEFAULT 0,
      all_players_bomb_in_round INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS relational_stats_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id),
      other_user_id TEXT NOT NULL REFERENCES users(id),
      relationship TEXT NOT NULL,
      games_played INTEGER NOT NULL DEFAULT 0,
      games_won INTEGER NOT NULL DEFAULT 0,
      one_two_wins INTEGER NOT NULL DEFAULT 0,
      total_team_bombs INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, other_user_id, relationship)
    );


    CREATE TABLE IF NOT EXISTS active_games (
      game_id TEXT PRIMARY KEY,
      room_code TEXT NOT NULL,
      state_blob TEXT NOT NULL,
      saved_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS active_rooms (
      room_code TEXT PRIMARY KEY,
      room_blob TEXT NOT NULL,
      saved_at TEXT NOT NULL DEFAULT (datetime('now'))
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

  // REQ-F-SC02: Extend game_rounds with score-at-start and startedAt
  const gameRoundsNewCols = [
    'score_ns_at_start INTEGER',
    'score_ew_at_start INTEGER',
    'started_at TEXT',
  ];
  for (const col of gameRoundsNewCols) {
    try {
      client.exec(`ALTER TABLE game_rounds ADD COLUMN ${col}`);
    } catch {
      // Column already exists
    }
  }
}
