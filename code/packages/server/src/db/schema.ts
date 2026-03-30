// REQ-F-AU01: Guest access — users table supports guests (no email/password required)
// REQ-F-AU02: Optional account registration — email + hashed password columns
// REQ-F-AU03: Game history persistence — games + game_rounds tables
// REQ-F-AU04: Leaderboard — player_stats for aggregated stats

import { sqliteTable, text, integer, real, uniqueIndex, unique } from 'drizzle-orm/sqlite-core';
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
// REQ-F-DB01: Extended playerStats table with ~50 columns for O(1) profile reads

export const playerStats = sqliteTable('player_stats', {
  userId: text('user_id').primaryKey().references(() => users.id),

  // ── Existing columns ──
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

  // ── Group A: Game-level stats ──
  // REQ-F-GA02: Largest win/loss score difference
  largestWinDiff: integer('largest_win_diff').notNull().default(0),
  largestLossDiff: integer('largest_loss_diff').notNull().default(0),
  // REQ-F-GA03/PW03: Forfeit tracking
  gamesForfeited: integer('games_forfeited').notNull().default(0),
  // REQ-F-GA04/PW04: Spectator tracking
  gamesSpectated: integer('games_spectated').notNull().default(0),
  // REQ-F-GA05: 1-2 finish wins and against
  oneTwoWins: integer('one_two_wins').notNull().default(0),
  oneTwoAgainst: integer('one_two_against').notNull().default(0),

  // ── Group B: Round-level stats ──
  // REQ-F-GB01: Rounds won
  roundsWon: integer('rounds_won').notNull().default(0),
  // REQ-F-GB03: Opponent Tichu/Grand Tichu broken
  opponentTichuBroken: integer('opponent_tichu_broken').notNull().default(0),
  opponentGrandTichuBroken: integer('opponent_grand_tichu_broken').notNull().default(0),
  // REQ-F-GB04: Partner Tichu/Grand Tichu broken
  partnerTichuBroken: integer('partner_tichu_broken').notNull().default(0),
  partnerGrandTichuBroken: integer('partner_grand_tichu_broken').notNull().default(0),

  // ── Group C: Card event stats ──
  // REQ-F-GC01: Rounds with Dragon / Phoenix
  roundsWithDragon: integer('rounds_with_dragon').notNull().default(0),
  roundsWithDragonWon: integer('rounds_with_dragon_won').notNull().default(0),
  roundsWithPhoenix: integer('rounds_with_phoenix').notNull().default(0),
  roundsWithPhoenixWon: integer('rounds_with_phoenix_won').notNull().default(0),
  // REQ-F-GC02: Special cards received in pass
  dragonReceivedInPass: integer('dragon_received_in_pass').notNull().default(0),
  phoenixReceivedInPass: integer('phoenix_received_in_pass').notNull().default(0),
  aceReceivedInPass: integer('ace_received_in_pass').notNull().default(0),
  dogReceivedInPass: integer('dog_received_in_pass').notNull().default(0),
  // REQ-F-GC03: Dragon trick wins
  dragonTrickWins: integer('dragon_trick_wins').notNull().default(0),
  // REQ-F-GC04: Dragon given after opponent's Dragon victory
  dragonGivenAfterOpponentWin: integer('dragon_given_after_opponent_win').notNull().default(0),
  // REQ-F-GC05: Dog pass tracking
  dogGivenToPartner: integer('dog_given_to_partner').notNull().default(0),
  dogGivenToOpponent: integer('dog_given_to_opponent').notNull().default(0),
  // REQ-F-GC06: Dog played for Tichu partner
  dogPlayedForTichuPartner: integer('dog_played_for_tichu_partner').notNull().default(0),
  dogOpportunitiesForTichuPartner: integer('dog_opportunities_for_tichu_partner').notNull().default(0),
  // REQ-F-GC07: Bomb statistics
  handsWithBombs: integer('hands_with_bombs').notNull().default(0),
  totalBombs: integer('total_bombs').notNull().default(0),
  fourCardBombs: integer('four_card_bombs').notNull().default(0),
  fiveCardBombs: integer('five_card_bombs').notNull().default(0),
  sixPlusCardBombs: integer('six_plus_card_bombs').notNull().default(0),
  bombsInFirst8: integer('bombs_in_first_8').notNull().default(0),
  handsWithMultipleBombs: integer('hands_with_multiple_bombs').notNull().default(0),
  // REQ-F-GC08: Over-bombed
  overBombed: integer('over_bombed').notNull().default(0),
  // REQ-F-GC09: Bomb forced by wish
  bombForcedByWish: integer('bomb_forced_by_wish').notNull().default(0),
  // REQ-F-GC10: "The Tichu" straight
  theTichuClean: integer('the_tichu_clean').notNull().default(0),
  theTichuDirty: integer('the_tichu_dirty').notNull().default(0),
});

// ─── Player Relational Stats ────────────────────────────────────────────
// REQ-F-DB02: Per-partner and per-opponent win rates

export const playerRelationalStats = sqliteTable('player_relational_stats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => users.id),
  otherUserId: text('other_user_id').notNull().references(() => users.id),
  relationship: text('relationship').notNull(), // 'partner' | 'opponent'
  gamesPlayed: integer('games_played').notNull().default(0),
  gamesWon: integer('games_won').notNull().default(0),
}, (table) => [
  unique('player_relational_unique').on(table.userId, table.otherUserId, table.relationship),
]);

// ─── Round Player Events (audit trail) ──────────────────────────────────
// REQ-F-DB03: Per-player per-round event summary for auditing/recomputation

export const roundPlayerEvents = sqliteTable('round_player_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id').notNull().references(() => games.id),
  roundNumber: integer('round_number').notNull(),
  userId: text('user_id').notNull().references(() => users.id),
  seat: text('seat').notNull(),
  eventData: text('event_data', { mode: 'json' }).notNull(),
});
