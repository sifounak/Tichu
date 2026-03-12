// REQ-F-AU01: Guest access — users table supports guests (no email/password required)
// REQ-F-AU02: Optional account registration — email + hashed password columns
// REQ-F-AU03: Game history persistence — games + game_rounds tables
// REQ-F-AU04: Leaderboard — player_stats for aggregated stats

import { pgTable, text, integer, timestamp, boolean, jsonb, serial, uniqueIndex, real } from 'drizzle-orm/pg-core';

// ─── Users ──────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: text('id').primaryKey(), // matches the guest_xxx ID or a generated UUID for registered users
  displayName: text('display_name').notNull(),
  email: text('email'),
  passwordHash: text('password_hash'),
  isGuest: boolean('is_guest').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('users_email_unique').on(table.email),
]);

// ─── Completed Games ────────────────────────────────────────────────────

export const games = pgTable('games', {
  id: serial('id').primaryKey(),
  roomCode: text('room_code').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }).notNull().defaultNow(),
  winnerTeam: text('winner_team').notNull(), // 'NS' | 'EW'
  finalScoreNS: integer('final_score_ns').notNull(),
  finalScoreEW: integer('final_score_ew').notNull(),
  targetScore: integer('target_score').notNull().default(1000),
  roundCount: integer('round_count').notNull(),
  // Player seat assignments (userId or null for bots)
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

export const gameRounds = pgTable('game_rounds', {
  id: serial('id').primaryKey(),
  gameId: integer('game_id').notNull().references(() => games.id),
  roundNumber: integer('round_number').notNull(),
  cardPointsNS: integer('card_points_ns').notNull(),
  cardPointsEW: integer('card_points_ew').notNull(),
  tichuBonusNS: integer('tichu_bonus_ns').notNull().default(0),
  tichuBonusEW: integer('tichu_bonus_ew').notNull().default(0),
  oneTwoBonus: text('one_two_bonus'), // 'NS' | 'EW' | null
  totalNS: integer('total_ns').notNull(),
  totalEW: integer('total_ew').notNull(),
  finishOrder: jsonb('finish_order').notNull(), // ['north', 'east', 'south', 'west'] order
  tichuCalls: jsonb('tichu_calls').notNull().default('{}'), // { north: 'tichu' | 'grandTichu', ... }
});

// ─── Player Stats (materialized/cached) ─────────────────────────────────

export const playerStats = pgTable('player_stats', {
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
  lastUpdatedAt: timestamp('last_updated_at', { withTimezone: true }).notNull().defaultNow(),
});
