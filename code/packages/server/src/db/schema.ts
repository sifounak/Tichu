// REQ-F-AU01: Guest access — users table supports guests (no email/password required)
// REQ-F-AU02: Optional account registration — email + hashed password columns
// REQ-F-AU03: Game history persistence — games + game_rounds tables
// REQ-F-AU04: Leaderboard — player_stats for aggregated stats

import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── Users ──────────────────────────────────────────────────────────────

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  email: text('email'),
  passwordHash: text('password_hash'),
  isGuest: integer('is_guest', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  lastSeenAt: text('last_seen_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex('users_email_unique').on(table.email),
]);

// ─── Completed Games ────────────────────────────────────────────────────

export const games = sqliteTable('games', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roomCode: text('room_code').notNull(),
  startedAt: text('started_at').notNull().default(sql`(datetime('now'))`),
  endedAt: text('ended_at').notNull().default(sql`(datetime('now'))`),
  winnerTeam: text('winner_team').notNull(),
  finalScoreNS: integer('final_score_ns').notNull(),
  finalScoreEW: integer('final_score_ew').notNull(),
  targetScore: integer('target_score').notNull().default(1000),
  roundCount: integer('round_count').notNull(),
  northUserId: text('north_user_id').references(() => users.id),
  eastUserId: text('east_user_id').references(() => users.id),
  southUserId: text('south_user_id').references(() => users.id),
  westUserId: text('west_user_id').references(() => users.id),
  northName: text('north_name').notNull(),
  eastName: text('east_name').notNull(),
  southName: text('south_name').notNull(),
  westName: text('west_name').notNull(),
});

// ─── Game Rounds ────────────────────────────────────────────────────────

export const gameRounds = sqliteTable('game_rounds', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id').notNull().references(() => games.id),
  roundNumber: integer('round_number').notNull(),
  cardPointsNS: integer('card_points_ns').notNull(),
  cardPointsEW: integer('card_points_ew').notNull(),
  tichuBonusNS: integer('tichu_bonus_ns').notNull().default(0),
  tichuBonusEW: integer('tichu_bonus_ew').notNull().default(0),
  oneTwoBonus: text('one_two_bonus'),
  totalNS: integer('total_ns').notNull(),
  totalEW: integer('total_ew').notNull(),
  finishOrder: text('finish_order', { mode: 'json' }).notNull(),
  tichuCalls: text('tichu_calls', { mode: 'json' }).notNull().default('{}'),
});

// ─── Player Stats (materialized/cached) ─────────────────────────────────

export const playerStats = sqliteTable('player_stats', {
  userId: text('user_id').primaryKey().references(() => users.id),
  gamesPlayed: integer('games_played').notNull().default(0),
  gamesWon: integer('games_won').notNull().default(0),
  winRate: real('win_rate').notNull().default(0),
  tichuCalls: integer('tichu_calls').notNull().default(0),
  tichuSuccesses: integer('tichu_successes').notNull().default(0),
  grandTichuCalls: integer('grand_tichu_calls').notNull().default(0),
  grandTichuSuccesses: integer('grand_tichu_successes').notNull().default(0),
  totalRoundsPlayed: integer('total_rounds_played').notNull().default(0),
  firstFinishes: integer('first_finishes').notNull().default(0),
  lastUpdatedAt: text('last_updated_at').notNull().default(sql`(datetime('now'))`),
});
