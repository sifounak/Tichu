// REQ-F-AU01: Guest access — users table supports guests (no email/password required)
// REQ-F-AU02: Optional account registration — email + hashed password columns
// REQ-F-AU03: Game history persistence — games + game_rounds tables
// REQ-F-AU04: Leaderboard — player_stats for aggregated stats

import { sqliteTable, text, integer, real, uniqueIndex, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── Users ──────────────────────────────────────────────────────────────

// REQ-F-AU10: Registration requires username, email, password
// REQ-F-AU11: Username unique (case-insensitive, trimmed)
// REQ-NF-AU03: Username uniqueness enforced at DB level
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username'),
  displayName: text('display_name').notNull(),
  email: text('email'),
  passwordHash: text('password_hash'),
  isGuest: integer('is_guest', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  lastSeenAt: text('last_seen_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex('users_email_unique').on(table.email),
  uniqueIndex('users_username_unique').on(table.username),
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

  // REQ-F-SC02: Score-at-start and round timing
  scoreNSAtStart: integer('score_ns_at_start'),
  scoreEWAtStart: integer('score_ew_at_start'),
  startedAt: text('started_at'),
});

// ═══════════════════════════════════════════════════════════════════════════
// REQ-F-MG03/MG04/MG05: Old player_stats, player_relational_stats, and
// round_player_events tables removed — replaced by stats_cache,
// relational_stats_cache, and player_rounds respectively.
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// Statistics Redesign — Raw Event Tables
// REQ-F-SC03–SC11: Store raw game events for retroactive stat computation
// ═══════════════════════════════════════════════════════════════════════════

// ─── Player Rounds (structured replacement for roundPlayerEvents) ────────
// REQ-F-SC03: One row per player per round with hands, passes, calls, finish, points

export const playerRounds = sqliteTable('player_rounds', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id').notNull().references(() => games.id),
  roundNumber: integer('round_number').notNull(),
  seat: text('seat').notNull(),
  userId: text('user_id'),

  // Hands
  first8Cards: text('first_8_cards', { mode: 'json' }),
  fullHandPrePass: text('full_hand_pre_pass', { mode: 'json' }),
  passedToLeft: text('passed_to_left', { mode: 'json' }),
  passedToPartner: text('passed_to_partner', { mode: 'json' }),
  passedToRight: text('passed_to_right', { mode: 'json' }),
  receivedFromLeft: text('received_from_left', { mode: 'json' }),
  receivedFromPartner: text('received_from_partner', { mode: 'json' }),
  receivedFromRight: text('received_from_right', { mode: 'json' }),
  handAfterPass: text('hand_after_pass', { mode: 'json' }),

  // Calls
  grandTichuCall: integer('grand_tichu_call', { mode: 'boolean' }).notNull().default(false),
  tichuCall: integer('tichu_call', { mode: 'boolean' }).notNull().default(false),
  tichuCallPhase: text('tichu_call_phase'), // 'prePassing' | 'midRound' | null
  tichuCallTrickNumber: integer('tichu_call_trick_number'),
  tichuCallHandSizes: text('tichu_call_hand_sizes', { mode: 'json' }), // {partner, leftOpp, rightOpp}
  tichuCallSuccess: integer('tichu_call_success', { mode: 'boolean' }),

  // Finish
  finishPosition: integer('finish_position'), // 1-4, null if didn't finish
  finishTrickNumber: integer('finish_trick_number'),

  // Points
  cardPointsCaptured: integer('card_points_captured').notNull().default(0),
  handPointsGivenToOpponents: integer('hand_points_given_to_opponents').notNull().default(0),
  capturedPointsGivenToFirstOut: integer('captured_points_given_to_first_out').notNull().default(0),

  // Running point total
  trickPointRunningTotal: text('trick_point_running_total', { mode: 'json' }), // int[]
});

// ─── Tricks (merged trick identity + result) ────────────────────────────
// REQ-F-SC04: One row per trick per round

export const tricks = sqliteTable('tricks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id').notNull().references(() => games.id),
  roundNumber: integer('round_number').notNull(),
  trickNumber: integer('trick_number').notNull(),

  // Lead info
  leadSeat: text('lead_seat').notNull(),
  leadCombinationType: text('lead_combination_type'),
  leadCombinationRank: integer('lead_combination_rank'),
  leadCombinationLength: integer('lead_combination_length'),

  // Result info
  winnerSeat: text('winner_seat'),
  pointValue: integer('point_value').notNull().default(0),
  trickLength: integer('trick_length').notNull().default(0), // plays, not passes
  uncontested: integer('uncontested', { mode: 'boolean' }).notNull().default(false),

  // Winning combination
  winningCombinationType: text('winning_combination_type'),
  winningCombinationRank: integer('winning_combination_rank'),
  winningCombinationLength: integer('winning_combination_length'),

  // Content flags
  containsDragon: integer('contains_dragon', { mode: 'boolean' }).notNull().default(false),
  containsPhoenix: integer('contains_phoenix', { mode: 'boolean' }).notNull().default(false),

  // Context
  activeTichuSeats: text('active_tichu_seats', { mode: 'json' }), // seat[]
});

// ─── Plays (one per action within a trick) ──────────────────────────────
// REQ-F-SC05: Most granular level — every play, pass, or bomb

export const plays = sqliteTable('plays', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id').notNull().references(() => games.id),
  roundNumber: integer('round_number').notNull(),
  trickNumber: integer('trick_number').notNull(),
  sequenceNumber: integer('sequence_number').notNull(),
  seat: text('seat').notNull(),

  // Action
  actionType: text('action_type').notNull(), // 'play' | 'pass' | 'bomb'
  actionAt: text('action_at'),
  actionSource: text('action_source'), // 'player' | 'automation' | 'timeout' | 'bot'

  // Card details (play/bomb only)
  cards: text('cards', { mode: 'json' }), // int[]
  combinationType: text('combination_type'),
  combinationRank: integer('combination_rank'),
  combinationLength: integer('combination_length'),
  phoenixUsedAs: integer('phoenix_used_as'),
  phoenixEffectiveValue: real('phoenix_effective_value'),
  isBomb: integer('is_bomb', { mode: 'boolean' }),
  legalPlayCount: integer('legal_play_count'),

  // Contextual flags
  outOfTurn: integer('out_of_turn', { mode: 'boolean' }),
  interruptedSeat: text('interrupted_seat'),
  endOfTrickBomb: integer('end_of_trick_bomb', { mode: 'boolean' }),
  playedOnTopOf: text('played_on_top_of'),
  playerFinished: integer('player_finished', { mode: 'boolean' }),
  cardsRemainingAfter: integer('cards_remaining_after'),
  couldHaveGoneOut: integer('could_have_gone_out', { mode: 'boolean' }),
  playedMinimum: integer('played_minimum', { mode: 'boolean' }),

  // Hand sizes of other players
  partnerCardsRemaining: integer('partner_cards_remaining'),
  leftOppCardsRemaining: integer('left_opp_cards_remaining'),
  rightOppCardsRemaining: integer('right_opp_cards_remaining'),

  // Pass-specific fields (actionType='pass')
  couldHavePlayed: integer('could_have_played', { mode: 'boolean' }),
  hadBombAvailable: integer('had_bomb_available', { mode: 'boolean' }),

  // Wish context
  wishActive: integer('wish_active', { mode: 'boolean' }),
  wishRank: integer('wish_rank'),
  playForcedByWish: integer('play_forced_by_wish', { mode: 'boolean' }),

  // Tichu context
  partnerTichuActive: integer('partner_tichu_active', { mode: 'boolean' }),
  opponentTichuActive: text('opponent_tichu_active', { mode: 'json' }), // {left, right}

  // Timing
  turnStartedAt: text('turn_started_at'),
  durationMs: integer('duration_ms'),
});

// ─── Wish Events (0-1 per round) ───────────────────────────────────────
// REQ-F-SC06: Mah Jong wish declaration + fulfillment tracking

export const wishEvents = sqliteTable('wish_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id').notNull().references(() => games.id),
  roundNumber: integer('round_number').notNull(),
  wishRank: integer('wish_rank').notNull(),
  trickNumber: integer('trick_number').notNull(),
  cardsOfRankRemaining: integer('cards_of_rank_remaining').notNull(),
  cardsOfRankInWisherHand: integer('cards_of_rank_in_wisher_hand').notNull(),
  wishFulfilledTrick: integer('wish_fulfilled_trick'),
  wishFulfilledBy: text('wish_fulfilled_by'),
});

// ─── Dragon Gift Events (0+ per round) ─────────────────────────────────
// REQ-F-SC07: Created when Dragon player wins trick and must gift

export const dragonGiftEvents = sqliteTable('dragon_gift_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id').notNull().references(() => games.id),
  roundNumber: integer('round_number').notNull(),
  trickNumber: integer('trick_number').notNull(),
  gifterSeat: text('gifter_seat').notNull(),
  recipientSeat: text('recipient_seat').notNull(),
  trickPointValue: integer('trick_point_value').notNull(),
  recipientCardsLeft: integer('recipient_cards_left').notNull(),
  otherOpponentCardsLeft: integer('other_opponent_cards_left').notNull(),
  gifterFinishedOnPlay: integer('gifter_finished_on_play', { mode: 'boolean' }).notNull().default(false),
  recipientHasTichu: integer('recipient_has_tichu', { mode: 'boolean' }).notNull().default(false),
  otherOpponentHasTichu: integer('other_opponent_has_tichu', { mode: 'boolean' }).notNull().default(false),
  giftWasForced: integer('gift_was_forced', { mode: 'boolean' }).notNull().default(false),
});

// ─── Dog Play Events (0+ per round) ────────────────────────────────────
// REQ-F-SC08: Dog play with context

export const dogPlayEvents = sqliteTable('dog_play_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id').notNull().references(() => games.id),
  roundNumber: integer('round_number').notNull(),
  trickNumber: integer('trick_number').notNull(),
  playerSeat: text('player_seat').notNull(),
  controlPassedTo: text('control_passed_to').notNull(),
  partnerAlreadyOut: integer('partner_already_out', { mode: 'boolean' }).notNull().default(false),
  partnerHasTichu: integer('partner_has_tichu', { mode: 'boolean' }).notNull().default(false),
  hadPriorLeadOpportunity: integer('had_prior_lead_opportunity', { mode: 'boolean' }).notNull().default(false),
  dogWasLastCard: integer('dog_was_last_card', { mode: 'boolean' }).notNull().default(false),
});

// ─── Bomb Inventory (Level 1 — one per bomb resource) ──────────────────
// REQ-F-SC09: Bomb lifecycle tracking — inventory level

export const bombInventory = sqliteTable('bomb_inventory', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id').notNull().references(() => games.id),
  roundNumber: integer('round_number').notNull(),
  playerSeat: text('player_seat').notNull(),

  // Bomb identity
  bombType: text('bomb_type').notNull(), // 'fourOfAKind' | 'straightFlush'
  cards: text('cards', { mode: 'json' }).notNull(), // int[]
  rank: integer('rank').notNull(), // 4oaK rank or SFB high card
  size: integer('size').notNull(), // number of cards

  // Evolution
  acquiredPhase: text('acquired_phase').notNull(), // 'first8' | 'fullDeal' | 'postPass'

  // SFB tracking (maximal same-suit runs)
  bombPlaysFromRun: integer('bomb_plays_from_run').notNull().default(0),

  // Overlap with other bombs
  overlapsWith: text('overlaps_with', { mode: 'json' }), // int[] of bombInventory ids

  // Fate
  fate: text('fate'), // 'played' | 'brokenUp' | 'heldToEnd'
  fateTrickNumber: integer('fate_trick_number'),
  fateTarget: text('fate_target'), // seat
  outOfTurn: integer('out_of_turn', { mode: 'boolean' }),
  endOfTrickBomb: integer('end_of_trick_bomb', { mode: 'boolean' }),

  // Context
  playsSeenWhileHeld: integer('plays_seen_while_held').notNull().default(0),

  // Aggregate flags
  capturedDragon: integer('captured_dragon', { mode: 'boolean' }).notNull().default(false),
  wasOverbomb: integer('was_overbomb', { mode: 'boolean' }).notNull().default(false),
  followedByDog: integer('followed_by_dog', { mode: 'boolean' }).notNull().default(false),
});

// ─── Bomb Events (Level 2 — play events + wish side effects) ───────────
// REQ-F-SC10: Bomb lifecycle tracking — event level

export const bombEvents = sqliteTable('bomb_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  gameId: integer('game_id').notNull().references(() => games.id),
  roundNumber: integer('round_number').notNull(),
  bombInventoryId: integer('bomb_inventory_id').notNull().references(() => bombInventory.id),
  eventType: text('event_type').notNull(), // 'playBomb' | 'wishSideEffect'

  // playBomb fields
  trickNumber: integer('trick_number'),
  followedByDog: integer('followed_by_dog', { mode: 'boolean' }),

  // wishSideEffect fields
  cardLost: integer('card_lost'),
  couldHavePlayedBomb: integer('could_have_played_bomb', { mode: 'boolean' }),
  runLengthChange: integer('run_length_change'),
});

// ─── Player Global Stats (lifetime counters) ───────────────────────────
// REQ-F-SC11: Chat counters outside per-game event log

export const playerGlobalStats = sqliteTable('player_global_stats', {
  userId: text('user_id').primaryKey().references(() => users.id),
  totalChatMessages: integer('total_chat_messages').notNull().default(0),
  totalChatCharacters: integer('total_chat_characters').notNull().default(0),
});

// ═══════════════════════════════════════════════════════════════════════════
// REQ-F-MC01: Materialized Stats Cache — disposable, rebuilt from raw events
// ═══════════════════════════════════════════════════════════════════════════

// REQ-F-MC01: V1 cache table — same schema as player_stats, rebuildable from raw events
// REQ-F-MC05: Cache disposability — dropping and rebuilding restores all stats
export const statsCache = sqliteTable('stats_cache', {
  userId: text('user_id').primaryKey().references(() => users.id),

  // ── Core stats ──
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
  largestWinDiff: integer('largest_win_diff').notNull().default(0),
  largestLossDiff: integer('largest_loss_diff').notNull().default(0),
  gamesForfeited: integer('games_forfeited').notNull().default(0),
  gamesSpectated: integer('games_spectated').notNull().default(0),
  oneTwoWins: integer('one_two_wins').notNull().default(0),
  oneTwoAgainst: integer('one_two_against').notNull().default(0),

  // ── Group B: Round-level stats ──
  roundsWon: integer('rounds_won').notNull().default(0),
  opponentTichuBroken: integer('opponent_tichu_broken').notNull().default(0),
  opponentGrandTichuBroken: integer('opponent_grand_tichu_broken').notNull().default(0),
  partnerTichuBroken: integer('partner_tichu_broken').notNull().default(0),
  partnerGrandTichuBroken: integer('partner_grand_tichu_broken').notNull().default(0),
  lastFinishes: integer('last_finishes').notNull().default(0),
  tichuBrokenByPartner: integer('tichu_broken_by_partner').notNull().default(0),
  grandTichuBrokenByPartner: integer('grand_tichu_broken_by_partner').notNull().default(0),
  gamesRequiringTieBreak: integer('games_requiring_tie_break').notNull().default(0),
  mostTieBreakRoundsNeeded: integer('most_tie_break_rounds_needed').notNull().default(0),
  gamesJoinedAfterSpectating: integer('games_joined_after_spectating').notNull().default(0),

  // ── Group C: Card event stats ──
  roundsWithDragon: integer('rounds_with_dragon').notNull().default(0),
  roundsWithDragonWon: integer('rounds_with_dragon_won').notNull().default(0),
  roundsWithPhoenix: integer('rounds_with_phoenix').notNull().default(0),
  roundsWithPhoenixWon: integer('rounds_with_phoenix_won').notNull().default(0),
  dragonReceivedInPass: integer('dragon_received_in_pass').notNull().default(0),
  phoenixReceivedInPass: integer('phoenix_received_in_pass').notNull().default(0),
  aceReceivedInPass: integer('ace_received_in_pass').notNull().default(0),
  dogReceivedInPass: integer('dog_received_in_pass').notNull().default(0),
  dragonTrickWins: integer('dragon_trick_wins').notNull().default(0),
  dragonGivenAfterOpponentWin: integer('dragon_given_after_opponent_win').notNull().default(0),
  dogGivenToPartner: integer('dog_given_to_partner').notNull().default(0),
  dogGivenToOpponent: integer('dog_given_to_opponent').notNull().default(0),
  dogPlayedForTichuPartner: integer('dog_played_for_tichu_partner').notNull().default(0),
  dogOpportunitiesForTichuPartner: integer('dog_opportunities_for_tichu_partner').notNull().default(0),
  handsWithBombs: integer('hands_with_bombs').notNull().default(0),
  totalBombs: integer('total_bombs').notNull().default(0),
  fourCardBombs: integer('four_card_bombs').notNull().default(0),
  fiveCardBombs: integer('five_card_bombs').notNull().default(0),
  sixPlusCardBombs: integer('six_plus_card_bombs').notNull().default(0),
  bombsInFirst8: integer('bombs_in_first_8').notNull().default(0),
  handsWithMultipleBombs: integer('hands_with_multiple_bombs').notNull().default(0),
  overBombed: integer('over_bombed').notNull().default(0),
  bombForcedByWish: integer('bomb_forced_by_wish').notNull().default(0),
  theTichuClean: integer('the_tichu_clean').notNull().default(0),
  theTichuDirty: integer('the_tichu_dirty').notNull().default(0),

  // ── Phoenix play type tracking ──
  phoenixUsedAsSingle: integer('phoenix_used_as_single').notNull().default(0),
  phoenixUsedForPair: integer('phoenix_used_for_pair').notNull().default(0),
  phoenixUsedInTriple: integer('phoenix_used_in_triple').notNull().default(0),
  phoenixUsedInFullHouse: integer('phoenix_used_in_full_house').notNull().default(0),
  phoenixUsedInConsecutivePairs: integer('phoenix_used_in_consecutive_pairs').notNull().default(0),
  phoenixUsedInStraight: integer('phoenix_used_in_straight').notNull().default(0),
  longestStraightWithPhoenix: integer('longest_straight_with_phoenix').notNull().default(0),

  // ── Dog control tracking ──
  dogControlToPartner: integer('dog_control_to_partner').notNull().default(0),
  dogControlToOpponent: integer('dog_control_to_opponent').notNull().default(0),
  dogControlToSelf: integer('dog_control_to_self').notNull().default(0),
  dogStuckAsLastCard: integer('dog_stuck_as_last_card').notNull().default(0),

  // ── Per-size bomb tracking ──
  bombSize4: integer('bomb_size_4').notNull().default(0),
  bombSize5: integer('bomb_size_5').notNull().default(0),
  bombSize6: integer('bomb_size_6').notNull().default(0),
  bombSize7: integer('bomb_size_7').notNull().default(0),
  bombSize8: integer('bomb_size_8').notNull().default(0),
  bombSize9: integer('bomb_size_9').notNull().default(0),
  bombSize10: integer('bomb_size_10').notNull().default(0),
  bombSize11: integer('bomb_size_11').notNull().default(0),
  bombSize12: integer('bomb_size_12').notNull().default(0),
  bombSize13: integer('bomb_size_13').notNull().default(0),
  bombSize14: integer('bomb_size_14').notNull().default(0),

  // ── Conflicting bombs ──
  conflictingBombs: integer('conflicting_bombs').notNull().default(0),

  // ── Over-bomb direction split ──
  youOverBombed: integer('you_over_bombed').notNull().default(0),
  youWereOverBombed: integer('you_were_over_bombed').notNull().default(0),

  // ── Extended pass tracking ──
  dragonGivenInPass: integer('dragon_gave_in_pass').notNull().default(0),
  phoenixGivenInPass: integer('phoenix_gave_in_pass').notNull().default(0),
  aceGivenInPass: integer('ace_gave_in_pass').notNull().default(0),
  mahjongGivenInPass: integer('mahjong_gave_in_pass').notNull().default(0),
  mahjongReceivedInPass: integer('mahjong_received_in_pass').notNull().default(0),
  dogReceivedFromPartner: integer('dog_received_from_partner').notNull().default(0),
  dogReceivedFromOpponent: integer('dog_received_from_opponent').notNull().default(0),
  bombGivenToPartner: integer('bomb_gave_to_partner').notNull().default(0),
  bombGivenToOpponent: integer('bomb_gave_to_opponent').notNull().default(0),
  bombReceivedFromPartner: integer('bomb_received_from_partner').notNull().default(0),
  bombReceivedFromOpponent: integer('bomb_received_from_opponent').notNull().default(0),

  // ── Dog: hands with dog ──
  handsWithDog: integer('hands_with_dog').notNull().default(0),

  // ── Pass analysis ──
  strongPrePassHand: integer('strong_pre_pass_hand').notNull().default(0),
  keptDogDuringPass: integer('kept_dog_during_pass').notNull().default(0),

  // ── Achievements ──
  allPowerCardsBeforePass: integer('all_power_cards_before_pass').notNull().default(0),
  allCardsUnder10AfterPass: integer('all_cards_under_10_after_pass').notNull().default(0),
  doubleBombInTrick: integer('double_bomb_in_trick').notNull().default(0),
  allPlayersBombInRound: integer('all_players_bomb_in_round').notNull().default(0),
});

// REQ-F-MC01: Relational stats cache — per-partner, per-opponent stats
export const relationalStatsCache = sqliteTable('relational_stats_cache', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => users.id),
  otherUserId: text('other_user_id').notNull().references(() => users.id),
  relationship: text('relationship').notNull(), // 'partner' | 'opponent'
  gamesPlayed: integer('games_played').notNull().default(0),
  gamesWon: integer('games_won').notNull().default(0),
  oneTwoWins: integer('one_two_wins').notNull().default(0),
  totalTeamBombs: integer('total_team_bombs').notNull().default(0),
}, (table) => [
  unique('relational_stats_cache_unique').on(table.userId, table.otherUserId, table.relationship),
]);


// ─── Active Game State (transient, for graceful restart) ────────────────

export const activeGames = sqliteTable('active_games', {
  gameId: text('game_id').primaryKey(),
  roomCode: text('room_code').notNull(),
  stateBlob: text('state_blob').notNull(),
  savedAt: text('saved_at').notNull().default(sql`(datetime('now'))`),
});

export const activeRooms = sqliteTable('active_rooms', {
  roomCode: text('room_code').primaryKey(),
  roomBlob: text('room_blob').notNull(),
  savedAt: text('saved_at').notNull().default(sql`(datetime('now'))`),
});
