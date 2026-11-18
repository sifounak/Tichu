import { PARTICIPATION_VIEWS, type ParticipationView } from '@tichu/shared';
import { inferLegacyParticipation, participationCondition, getStatsSource } from './participation.js';
export const STATS_CACHE_VERSION = 2;
// REQ-F-MC01–MC05: Materialized stats cache — rebuild from raw events, incremental update
//
// Design: Both rebuild and incremental paths recompute all stats for affected users
// from raw event tables. This guarantees rebuild produces identical results to
// incremental updates (REQ-F-MC02).

import { sql } from 'drizzle-orm';
import { countBombContributions, getReceivedBombStats } from './bomb-pass-stats.js';
import type { Database } from './connection.js';
import type { Seat } from '@tichu/shared';
import { CombinationType, getTeam, getPartner, SEATS_IN_ORDER } from '@tichu/shared';

// ─── Card ID Constants ─────────────────────────────────────────────────
// Deck layout: 0-51 standard (4 suits × 13 ranks), 52-55 specials
const MAHJONG_ID = 52;
const DOG_ID = 53;
const PHOENIX_ID = 54;
const DRAGON_ID = 55;
const ACE_IDS = [12, 25, 38, 51]; // rank 14 in each suit (Jade, Pagoda, Star, Sword)

// ─── Helper: seat column mapping ───────────────────────────────────────

function getOpponentSeats(seat: Seat): [Seat, Seat] {
  const myTeam = getTeam(seat);
  return SEATS_IN_ORDER.filter(s => getTeam(s) !== myTeam) as [Seat, Seat];
}

// ─── Raw Data Row Types ────────────────────────────────────────────────

interface GameRow {
  id: number;
  status: string;
  winner_team: string;
  final_score_ns: number;
  final_score_ew: number;
  target_score: number;
  north_user_id: string | null;
  east_user_id: string | null;
  south_user_id: string | null;
  west_user_id: string | null;
}

interface GameRoundRow {
  game_id: number;
  round_number: number;
  one_two_bonus: string | null;
  total_ns: number;
  total_ew: number;
  finish_order: string;
  tichu_calls: string;
  score_ns_at_start: number | null;
  score_ew_at_start: number | null;
}

interface PlayerRoundRow {
  game_id: number;
  round_number: number;
  seat: string;
  user_id: string | null;
  first_8_cards: string | null;
  full_hand_pre_pass: string | null;
  passed_to_left: string | null;
  passed_to_partner: string | null;
  passed_to_right: string | null;
  received_from_left: string | null;
  received_from_partner: string | null;
  received_from_right: string | null;
  hand_after_pass: string | null;
  blind_grand_tichu_call: number;
  grand_tichu_call: number;
  tichu_call: number;
  tichu_call_phase: string | null;
  tichu_call_trick_number: number | null;
  tichu_call_hand_sizes: string | null;
  tichu_call_success: number | null;
  finish_position: number | null;
  finish_trick_number: number | null;
}

interface PlayRow {
  game_id: number;
  round_number: number;
  trick_number: number;
  sequence_number: number;
  seat: string;
  action_type: string;
  cards: string | null;
  combination_type: string | null;
  combination_length: number | null;
  phoenix_used_as: number | null;
  is_bomb: number | null;
  play_forced_by_wish: number | null;
  partner_tichu_active: number | null;
  could_have_played: number | null;
}

interface TrickRow {
  game_id: number;
  round_number: number;
  trick_number: number;
  winner_seat: string | null;
  contains_dragon: number;
  winning_combination_type: string | null;
}

interface BombInventoryRow {
  game_id: number;
  round_number: number;
  player_seat: string;
  bomb_type: string;
  rank: number;
  size: number;
  acquired_phase: string;
  fate: string | null;
  was_overbomb: number;
  captured_dragon: number;
}

interface DogPlayRow {
  game_id: number;
  round_number: number;
  player_seat: string;
  control_passed_to: string;
  partner_has_tichu: number;
  dog_was_last_card: number;
}

// ─── JSON parsing helpers ──────────────────────────────────────────────

// Accepts either a JSON array (e.g. full hand "[0,1,2]") or a JSON scalar number
// (e.g. a single passed card "42"). Pass-direction columns store one card id; hand
// columns store arrays. Both share this helper so scalars lift to single-element arrays.
function parseJsonArray(val: string | null): number[] {
  if (val === null || val === undefined) return [];
  try {
    const parsed = typeof val === 'string' ? JSON.parse(val) : val;
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === 'number') return [parsed];
    return [];
  } catch { return []; }
}

// ─── Card Analysis Helpers ─────────────────────────────────────────────

function containsCard(hand: number[], cardId: number): boolean {
  return hand.includes(cardId);
}

function countPowerCards(hand: number[]): number {
  let count = 0;
  if (hand.includes(DRAGON_ID)) count++;
  if (hand.includes(PHOENIX_ID)) count++;
  for (const aceId of ACE_IDS) {
    if (hand.includes(aceId)) count++;
  }
  return count;
}

function allCardsUnder10(hand: number[]): boolean {
  if (hand.length === 0) return false;
  for (const id of hand) {
    if (id === DRAGON_ID) return false;
    // Standard cards: rank = (id % 13) + 2. Rank >= 10 means id % 13 >= 8
    if (id < 52 && (id % 13) >= 8) return false;
  }
  return true;
}

// ─── Seat Resolution ───────────────────────────────────────────────────

/** Find the seat a user occupied in a game */
function getUserSeat(game: GameRow, userId: string): Seat | null {
  if (game.north_user_id === userId) return 'north';
  if (game.east_user_id === userId) return 'east';
  if (game.south_user_id === userId) return 'south';
  if (game.west_user_id === userId) return 'west';
  return null;
}

function getUserTeamStr(seat: Seat): 'NS' | 'EW' {
  return getTeam(seat) === 'northSouth' ? 'NS' : 'EW';
}

// ═══════════════════════════════════════════════════════════════════════════
// Core Computation: compute all stats for a single user from raw events
// ═══════════════════════════════════════════════════════════════════════════

interface StatsResult {
  // Core
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  tichuCalls: number;
  tichuSuccesses: number;
  blindGrandTichuCalls: number;
  blindGrandTichuSuccesses: number;
  grandTichuCalls: number;
  grandTichuSuccesses: number;
  totalRoundsPlayed: number;
  firstFinishes: number;
  // Group A
  largestWinDiff: number;
  largestLossDiff: number;
  oneTwoWins: number;
  oneTwoAgainst: number;
  gamesRequiringTieBreak: number;
  mostTieBreakRoundsNeeded: number;
  // Group B
  roundsWon: number;
  opponentTichuBroken: number;
  opponentGrandTichuBroken: number;
  partnerTichuBroken: number;
  partnerGrandTichuBroken: number;
  lastFinishes: number;
  tichuBrokenByPartner: number;
  grandTichuBrokenByPartner: number;
  gamesJoinedAfterSpectating: number;
  gamesForfeited: number;
  // Group C
  roundsWithDragon: number;
  roundsWithDragonWon: number;
  roundsWithPhoenix: number;
  roundsWithPhoenixWon: number;
  dragonReceivedInPass: number;
  phoenixReceivedInPass: number;
  aceReceivedInPass: number;
  dogReceivedInPass: number;
  dragonTrickWins: number;
  capturedDragonWithBomb: number;
  dogGivenToPartner: number;
  dogGivenToOpponent: number;
  dogPlayedForTichuPartner: number;
  dogOpportunitiesForTichuPartner: number;
  handsWithBombs: number;
  totalBombs: number;
  fourCardBombs: number;
  fiveCardBombs: number;
  sixPlusCardBombs: number;
  bombsInFirst8: number;
  handsWithMultipleBombs: number;
  overBombed: number;
  bombForcedByWish: number;
  theTichuClean: number;
  theTichuDirty: number;
  phoenixUsedAsSingle: number;
  phoenixUsedForPair: number;
  phoenixUsedInTriple: number;
  phoenixUsedInFullHouse: number;
  phoenixUsedInConsecutivePairs: number;
  phoenixUsedInStraight: number;
  longestStraightWithPhoenix: number;
  longestStraight: number;
  totalBombsReceived: number;
  opponentBlindGrandTichuBroken: number;
  partnerBlindGrandTichuBroken: number;
  blindGrandTichuBrokenByPartner: number;

  dogControlToPartner: number;
  dogControlToOpponent: number;
  dogControlToSelf: number;
  dogStuckAsLastCard: number;
  bombSize4: number;
  bombSize5: number;
  bombSize6: number;
  bombSize7: number;
  bombSize8: number;
  bombSize9: number;
  bombSize10: number;
  bombSize11: number;
  bombSize12: number;
  bombSize13: number;
  bombSize14: number;
  conflictingBombs: number;
  youOverBombed: number;
  youWereOverBombed: number;
  dragonGivenInPass: number;
  phoenixGivenInPass: number;
  aceGivenInPass: number;
  mahjongGivenInPass: number;
  mahjongReceivedInPass: number;
  dogReceivedFromPartner: number;
  dogReceivedFromOpponent: number;
  bombGivenToPartner: number;
  bombGivenToOpponent: number;
  bombReceivedFromPartner: number;
  bombReceivedFromOpponent: number;
  handsWithDog: number;
  strongPrePassHand: number;
  keptDogDuringPass: number;
  allPowerCardsBeforePass: number;
  allCardsUnder10AfterPass: number;
  doubleBombInTrick: number;
  allPlayersBombInRound: number;
}

function createEmptyStats(): StatsResult {
  return {
    gamesPlayed: 0, gamesWon: 0, winRate: 0,
    tichuCalls: 0, tichuSuccesses: 0,
    blindGrandTichuCalls: 0, blindGrandTichuSuccesses: 0,
    grandTichuCalls: 0, grandTichuSuccesses: 0,
    totalRoundsPlayed: 0, firstFinishes: 0,
    largestWinDiff: 0, largestLossDiff: 0, oneTwoWins: 0, oneTwoAgainst: 0,
    gamesRequiringTieBreak: 0, mostTieBreakRoundsNeeded: 0,
    roundsWon: 0, opponentTichuBroken: 0, opponentGrandTichuBroken: 0,
    partnerTichuBroken: 0, partnerGrandTichuBroken: 0,
    lastFinishes: 0, tichuBrokenByPartner: 0, grandTichuBrokenByPartner: 0,
    gamesJoinedAfterSpectating: 0,
    gamesForfeited: 0,
    roundsWithDragon: 0, roundsWithDragonWon: 0,
    roundsWithPhoenix: 0, roundsWithPhoenixWon: 0,
    dragonReceivedInPass: 0, phoenixReceivedInPass: 0, aceReceivedInPass: 0, dogReceivedInPass: 0,
    dragonTrickWins: 0, capturedDragonWithBomb: 0,
    dogGivenToPartner: 0, dogGivenToOpponent: 0,
    dogPlayedForTichuPartner: 0, dogOpportunitiesForTichuPartner: 0,
    handsWithBombs: 0, totalBombs: 0, fourCardBombs: 0, fiveCardBombs: 0, sixPlusCardBombs: 0,
    bombsInFirst8: 0, handsWithMultipleBombs: 0,
    overBombed: 0, bombForcedByWish: 0,
    theTichuClean: 0, theTichuDirty: 0,
    phoenixUsedAsSingle: 0, phoenixUsedForPair: 0, phoenixUsedInTriple: 0,
    phoenixUsedInFullHouse: 0, phoenixUsedInConsecutivePairs: 0, phoenixUsedInStraight: 0,
    longestStraightWithPhoenix: 0,
    longestStraight: 0,
    totalBombsReceived: 0,
    opponentBlindGrandTichuBroken: 0,
    partnerBlindGrandTichuBroken: 0,
    blindGrandTichuBrokenByPartner: 0,

    dogControlToPartner: 0, dogControlToOpponent: 0, dogControlToSelf: 0, dogStuckAsLastCard: 0,
    bombSize4: 0, bombSize5: 0, bombSize6: 0, bombSize7: 0, bombSize8: 0,
    bombSize9: 0, bombSize10: 0, bombSize11: 0, bombSize12: 0, bombSize13: 0, bombSize14: 0,
    conflictingBombs: 0, youOverBombed: 0, youWereOverBombed: 0,
    dragonGivenInPass: 0, phoenixGivenInPass: 0, aceGivenInPass: 0,
    mahjongGivenInPass: 0, mahjongReceivedInPass: 0,
    dogReceivedFromPartner: 0, dogReceivedFromOpponent: 0,
    bombGivenToPartner: 0, bombGivenToOpponent: 0,
    bombReceivedFromPartner: 0, bombReceivedFromOpponent: 0,
    handsWithDog: 0, strongPrePassHand: 0, keptDogDuringPass: 0,
    allPowerCardsBeforePass: 0, allCardsUnder10AfterPass: 0,
    doubleBombInTrick: 0, allPlayersBombInRound: 0,
  };
}

// REQ-F-MC02: Compute all stats for a user from raw event tables
// REQ-F-SA01–SA15: Attribution is driven by player_rounds tuples, not by
// final seat occupancy in the games table. A user who played rounds 1–4 of
// an 8-round game and was replaced before game end still receives correct
// per-play/per-round credit for the rounds they actually played.
function computeStatsForUser(database: Database, userId: string, participation: ParticipationView): StatsResult {
  const { db } = database;
  const stats = createEmptyStats();

  // REQ-F-SA01–SA11: player_rounds is the authoritative source of "who was
  // seated at what seat for which round." All downstream filters key off the
  // (game_id, round_number, seat) tuples present here.
  const myPlayerRounds = db.all(sql`
    SELECT game_id, round_number, seat, user_id,
           first_8_cards, full_hand_pre_pass, passed_to_left, passed_to_partner, passed_to_right,
           received_from_left, received_from_partner, received_from_right, hand_after_pass,
           blind_grand_tichu_call, grand_tichu_call, tichu_call, tichu_call_phase, tichu_call_trick_number,
           tichu_call_hand_sizes, tichu_call_success, finish_position, finish_trick_number
    FROM player_rounds
    WHERE user_id = ${userId}
      AND game_id IN (SELECT id FROM games WHERE ${participationCondition(participation)})
  `) as PlayerRoundRow[];

  if (myPlayerRounds.length === 0) return stats;

  // Derive game IDs from actual participation — not from games.{seat}_user_id,
  // which reflects only the final occupant (REQ-F-SA01).
  const gameIds = [...new Set(myPlayerRounds.map(pr => pr.game_id))];

  // ── Load games metadata for the games this user participated in ──
  const userGames = db.all(sql`
    SELECT id, status, winner_team, final_score_ns, final_score_ew, target_score,
           north_user_id, east_user_id, south_user_id, west_user_id
    FROM games
    WHERE id IN (${sql.join(gameIds.map(id => sql`${id}`), sql`, `)})
  `) as GameRow[];

  // ── Get all game_rounds for these games ──
  const allRounds = db.all(sql`
    SELECT game_id, round_number, one_two_bonus, total_ns, total_ew,
           finish_order, tichu_calls, score_ns_at_start, score_ew_at_start
    FROM game_rounds
    WHERE game_id IN (${sql.join(gameIds.map(id => sql`${id}`), sql`, `)})
  `) as GameRoundRow[];

  // Index rounds by game
  const roundsByGame = new Map<number, GameRoundRow[]>();
  for (const r of allRounds) {
    if (!roundsByGame.has(r.game_id)) roundsByGame.set(r.game_id, []);
    roundsByGame.get(r.game_id)!.push(r);
  }

  // REQ-F-SA04–SA08: tuple key used to filter per-play / per-trick / per-bomb /
  // per-dog / per-dragon events down to only those belonging to rounds this
  // user actually occupied the seat for.
  const validGameRoundSeat = new Set<string>();
  // REQ-F-SA09–SA10: rounds the user actually played, per game, used to gate
  // round-level aggregates (oneTwoWins, tie-break credit).
  const myRoundsByGame = new Map<number, Set<number>>();
  // REQ-F-SA11: team derived from the seat the user occupied during the rounds
  // they played (single team per user per game is guaranteed by SJ04–SJ06 in
  // M2; until then, we assert and log if two rounds map to different teams).
  const myTeamByGame = new Map<number, 'NS' | 'EW'>();
  for (const pr of myPlayerRounds) {
    validGameRoundSeat.add(`${pr.game_id}-${pr.round_number}-${pr.seat}`);
    if (!myRoundsByGame.has(pr.game_id)) myRoundsByGame.set(pr.game_id, new Set());
    myRoundsByGame.get(pr.game_id)!.add(pr.round_number);
    const roundTeam = getUserTeamStr(pr.seat as Seat);
    const existingTeam = myTeamByGame.get(pr.game_id);
    if (existingTeam === undefined) {
      myTeamByGame.set(pr.game_id, roundTeam);
    } else if (existingTeam !== roundTeam) {
      // Should be impossible once SJ04–SJ06 is enforced. Keep first-seen team.
      console.warn(
        `[stats-cache] User ${userId} in game ${pr.game_id} mapped to both teams `
        + `(existing=${existingTeam}, round ${pr.round_number} seat ${pr.seat} → ${roundTeam}); keeping existing.`,
      );
    }
  }

  // ── 4. Get ALL player_rounds for cross-player stats (partner/opponent tichu) ──
  const allPlayerRounds = db.all(sql`
    SELECT game_id, round_number, seat, user_id, blind_grand_tichu_call, grand_tichu_call, tichu_call,
           tichu_call_success, finish_position, hand_after_pass
    FROM player_rounds
    WHERE game_id IN (${sql.join(gameIds.map(id => sql`${id}`), sql`, `)})
  `) as PlayerRoundRow[];

  // Index by game+round for cross-player lookups
  const prByGameRound = new Map<string, PlayerRoundRow[]>();
  for (const pr of allPlayerRounds) {
    const key = `${pr.game_id}-${pr.round_number}`;
    if (!prByGameRound.has(key)) prByGameRound.set(key, []);
    prByGameRound.get(key)!.push(pr);
  }

  // REQ-F-SA04: Per-play stats filtered by (game_id, round_number, seat) tuples.
  // Narrowed in SQL via row-value IN for perf; JS-side tuple filter re-verifies
  // against validGameRoundSeat as a defensive regression guard.
  const myPlays = db.all(sql`
    SELECT game_id, round_number, trick_number, sequence_number, seat,
           action_type, cards, combination_type, combination_length,
           phoenix_used_as, is_bomb, play_forced_by_wish,
           partner_tichu_active, could_have_played
    FROM plays
    WHERE (game_id, round_number, seat) IN (
      SELECT game_id, round_number, seat FROM player_rounds WHERE user_id = ${userId}
    )
  `) as PlayRow[];
  const filteredPlays = myPlays.filter(p => validGameRoundSeat.has(`${p.game_id}-${p.round_number}-${p.seat}`));

  // ── 6. Get ALL plays for double-bomb and all-players-bomb detection ──
  const allPlays = db.all(sql`
    SELECT game_id, round_number, trick_number, seat, is_bomb
    FROM plays
    WHERE game_id IN (${sql.join(gameIds.map(id => sql`${id}`), sql`, `)})
      AND (action_type = 'play' OR action_type = 'bomb')
      AND is_bomb = 1
  `) as PlayRow[];

  // ── 7. Get tricks for dragon detection ──
  const dragonTricks = db.all(sql`
    SELECT game_id, round_number, trick_number, winner_seat, contains_dragon, winning_combination_type
    FROM tricks
    WHERE game_id IN (${sql.join(gameIds.map(id => sql`${id}`), sql`, `)})
      AND contains_dragon = 1
  `) as TrickRow[];

  // REQ-F-SA05: Per-bomb stats filtered by (game_id, round_number, seat) tuples.
  const myBombs = db.all(sql`
    SELECT game_id, round_number, player_seat, bomb_type, rank, size,
           acquired_phase, fate, was_overbomb, captured_dragon
    FROM bomb_inventory
    WHERE (game_id, round_number, player_seat) IN (
      SELECT game_id, round_number, seat FROM player_rounds WHERE user_id = ${userId}
    )
  `) as BombInventoryRow[];
  const filteredBombs = myBombs.filter(b => validGameRoundSeat.has(`${b.game_id}-${b.round_number}-${b.player_seat}`));

  // ── 9. Get dog play events ──
  const myDogPlays = db.all(sql`
    SELECT game_id, round_number, player_seat, control_passed_to,
           partner_has_tichu, dog_was_last_card
    FROM dog_play_events
    WHERE game_id IN (${sql.join(gameIds.map(id => sql`${id}`), sql`, `)})
  `) as DogPlayRow[];

  // ═══════════════════════════════════════════════════════════════════════
  // Compute Game-Level Stats
  // ═══════════════════════════════════════════════════════════════════════

  // REQ-F-SA01: gamesPlayed = count of games with ≥1 player_rounds row for this user.
  const completedUserGames = new Set(
    userGames.filter(g => g.status === 'completed').map(g => g.id),
  );
  stats.gamesPlayed = completedUserGames.size;

  for (const game of userGames) {
    // SA02/SA03/SA13: these credits are gated on final-occupancy.
    const finalSeat = getUserSeat(game, userId);
    const myTeamStr = myTeamByGame.get(game.id)!;
    const myRoundsInGame = myRoundsByGame.get(game.id)!;
    const scoreDiff = Math.abs(game.final_score_ns - game.final_score_ew);
    const myTeamWon = game.winner_team === myTeamStr;

    if (completedUserGames.has(game.id) && finalSeat !== null) {
      // REQ-F-SA02: gamesWon only when final occupant AND team won.
      // REQ-F-SA03: largestWinDiff / largestLossDiff gated on final occupancy.
      if (myTeamWon) {
        stats.gamesWon++;
        stats.largestWinDiff = Math.max(stats.largestWinDiff, scoreDiff);
      } else {
        stats.largestLossDiff = Math.max(stats.largestLossDiff, scoreDiff);
      }
      // REQ-F-SA13: joined-after-spectating iff final occupant AND min round > 1.
      // Reconnect-to-same-seat preserves the user's min round, so this counter
      // does not trigger for reconnects.
      const minRound = Math.min(...myRoundsInGame);
      if (minRound > 1) stats.gamesJoinedAfterSpectating++;
    } else if (completedUserGames.has(game.id)) {
      // REQ-F-SA12: user participated but is not the final occupant → forfeited,
      // regardless of team outcome. (SA15: disjoint from gamesWon by construction.)
      stats.gamesForfeited++;
    }

    // 1-2 finishes and tie-break from game_rounds
    const rounds = roundsByGame.get(game.id) || [];
    let cumNS = 0, cumEW = 0;
    let tieBreakDetected = false;
    let tieBreakRounds = 0;
    let tieBreakFirstRoundIdx = -1;

    for (let i = 0; i < rounds.length; i++) {
      const r = rounds[i];
      // REQ-F-SA09: credit 1-2 finishes only for rounds the user actually played.
      if (myRoundsInGame.has(r.round_number)) {
        if (r.one_two_bonus === myTeamStr) stats.oneTwoWins++;
        else if (r.one_two_bonus !== null) stats.oneTwoAgainst++;
      }

      // Walk all rounds for cumulative score (tie-break is a game-level property).
      if (r.score_ns_at_start != null && r.score_ew_at_start != null) {
        cumNS = r.score_ns_at_start + r.total_ns;
        cumEW = r.score_ew_at_start + r.total_ew;
      } else {
        cumNS += r.total_ns;
        cumEW += r.total_ew;
      }

      if (!tieBreakDetected && cumNS >= game.target_score && cumEW >= game.target_score && i < rounds.length - 1) {
        tieBreakDetected = true;
        tieBreakRounds = rounds.length - (i + 1);
        tieBreakFirstRoundIdx = i + 1;
      }
    }

    // REQ-F-SA10: tie-break counters credit user only if they played a tie-break round.
    if (tieBreakDetected) {
      let userPlayedTieBreak = false;
      for (let i = tieBreakFirstRoundIdx; i < rounds.length; i++) {
        if (myRoundsInGame.has(rounds[i].round_number)) {
          userPlayedTieBreak = true;
          break;
        }
      }
      if (userPlayedTieBreak) {
        stats.gamesRequiringTieBreak++;
        stats.mostTieBreakRoundsNeeded = Math.max(stats.mostTieBreakRoundsNeeded, tieBreakRounds);
      }
    }
  }

  stats.winRate = stats.gamesPlayed > 0 ? stats.gamesWon / stats.gamesPlayed : 0;

  // ═══════════════════════════════════════════════════════════════════════
  // Compute Round-Level Stats
  // ═══════════════════════════════════════════════════════════════════════

  for (const pr of myPlayerRounds) {
    const seat = pr.seat as Seat;
    const game = userGames.find(g => g.id === pr.game_id);
    if (!game) continue;

    stats.totalRoundsPlayed++;

    // Finish position
    if (pr.finish_position === 1) stats.firstFinishes++;
    if (pr.finish_position === 4) stats.lastFinishes++;

    // Tichu calls
    if (pr.tichu_call) {
      stats.tichuCalls++;
      if (pr.tichu_call_success) stats.tichuSuccesses++;
    }
    if (pr.blind_grand_tichu_call) {
      stats.blindGrandTichuCalls++;
      if (pr.tichu_call_success) stats.blindGrandTichuSuccesses++;
    }
    if (pr.grand_tichu_call) {
      stats.grandTichuCalls++;
      if (pr.tichu_call_success) stats.grandTichuSuccesses++;
    }

    // Round won (team scored more)
    const myTeam = getTeam(seat);
    const gameRound = (roundsByGame.get(pr.game_id) || []).find(r => r.round_number === pr.round_number);
    if (gameRound) {
      const myTotal = myTeam === 'northSouth' ? gameRound.total_ns : gameRound.total_ew;
      const oppTotal = myTeam === 'northSouth' ? gameRound.total_ew : gameRound.total_ns;
      if (myTotal > oppTotal) stats.roundsWon++;
    }

    // Cross-player tichu stats
    const partner = getPartner(seat);
    const opponents = getOpponentSeats(seat);
    const roundKey = `${pr.game_id}-${pr.round_number}`;
    const roundPlayers = prByGameRound.get(roundKey) || [];

    // Opponent tichu broken
    for (const oppSeat of opponents) {
      const oppPr = roundPlayers.find(p => p.seat === oppSeat);
      if (!oppPr) continue;
      if (oppPr.tichu_call && !oppPr.tichu_call_success) stats.opponentTichuBroken++;
      if (oppPr.grand_tichu_call && !oppPr.tichu_call_success) stats.opponentGrandTichuBroken++;
      if (oppPr.blind_grand_tichu_call && !oppPr.tichu_call_success) stats.opponentBlindGrandTichuBroken++;
    }

    // Partner tichu broken by me (partner called, I went out first, partner failed)
    const partnerPr = roundPlayers.find(p => p.seat === partner);
    if (partnerPr && !partnerPr.tichu_call_success && pr.finish_position === 1) {
      if (partnerPr.tichu_call) stats.partnerTichuBroken++;
      if (partnerPr.grand_tichu_call) stats.partnerGrandTichuBroken++;
      if (partnerPr.blind_grand_tichu_call) stats.partnerBlindGrandTichuBroken++;
    }

    // My tichu broken by partner (I called, partner went out first, I failed)
    if ((pr.tichu_call || pr.grand_tichu_call || pr.blind_grand_tichu_call) && !pr.tichu_call_success) {
      if (partnerPr && partnerPr.finish_position === 1) {
        if (pr.tichu_call) stats.tichuBrokenByPartner++;
        if (pr.grand_tichu_call) stats.grandTichuBrokenByPartner++;
        if (pr.blind_grand_tichu_call) stats.blindGrandTichuBrokenByPartner++;
      }
    }

    // ── Hand-based Group C stats ──
    const handAfterPass = parseJsonArray(pr.hand_after_pass);
    const fullHandPrePass = parseJsonArray(pr.full_hand_pre_pass);

    if (handAfterPass.length > 0) {
      const hadDragon = containsCard(handAfterPass, DRAGON_ID);
      const hadPhoenix = containsCard(handAfterPass, PHOENIX_ID);
      const hadDog = containsCard(handAfterPass, DOG_ID);

      if (hadDragon) {
        stats.roundsWithDragon++;
        // Did team win the round?
        if (gameRound) {
          const myTotal = myTeam === 'northSouth' ? gameRound.total_ns : gameRound.total_ew;
          const oppTotal = myTeam === 'northSouth' ? gameRound.total_ew : gameRound.total_ns;
          if (myTotal > oppTotal) stats.roundsWithDragonWon++;
        }
      }
      if (hadPhoenix) {
        stats.roundsWithPhoenix++;
        if (gameRound) {
          const myTotal = myTeam === 'northSouth' ? gameRound.total_ns : gameRound.total_ew;
          const oppTotal = myTeam === 'northSouth' ? gameRound.total_ew : gameRound.total_ns;
          if (myTotal > oppTotal) stats.roundsWithPhoenixWon++;
        }
      }
      if (hadDog) stats.handsWithDog++;
    }

    // ── Pass tracking ──
    const receivedFromLeft = parseJsonArray(pr.received_from_left);
    const receivedFromPartner = parseJsonArray(pr.received_from_partner);
    const receivedFromRight = parseJsonArray(pr.received_from_right);
    const allReceived = [...receivedFromLeft, ...receivedFromPartner, ...receivedFromRight];

    if (allReceived.includes(DRAGON_ID)) stats.dragonReceivedInPass++;
    if (allReceived.includes(PHOENIX_ID)) stats.phoenixReceivedInPass++;
    if (allReceived.some(id => ACE_IDS.includes(id))) stats.aceReceivedInPass++;
    if (allReceived.includes(DOG_ID)) stats.dogReceivedInPass++;
    if (allReceived.includes(MAHJONG_ID)) stats.mahjongReceivedInPass++;

    // Dog received direction
    if (receivedFromPartner.includes(DOG_ID)) stats.dogReceivedFromPartner++;
    if (receivedFromLeft.includes(DOG_ID) || receivedFromRight.includes(DOG_ID)) stats.dogReceivedFromOpponent++;

    // Cards given in pass
    const passedToLeft = parseJsonArray(pr.passed_to_left);
    const passedToPartner = parseJsonArray(pr.passed_to_partner);
    const passedToRight = parseJsonArray(pr.passed_to_right);
    const allGiven = [...passedToLeft, ...passedToPartner, ...passedToRight];

    if (allGiven.includes(DRAGON_ID)) stats.dragonGivenInPass++;
    if (allGiven.includes(PHOENIX_ID)) stats.phoenixGivenInPass++;
    if (allGiven.some(id => ACE_IDS.includes(id))) stats.aceGivenInPass++;
    if (allGiven.includes(MAHJONG_ID)) stats.mahjongGivenInPass++;

    // Dog given direction
    if (passedToPartner.includes(DOG_ID)) stats.dogGivenToPartner++;
    if (passedToLeft.includes(DOG_ID) || passedToRight.includes(DOG_ID)) stats.dogGivenToOpponent++;

    // Bomb completion in pass — check if passed/received cards complete a bomb
    // For partner: check if passedToPartner cards complete a 4-of-a-kind with partner's hand
    // Simplified: track if a bomb card was passed to/from partner/opponent
    // The old tracker used bombGivenToPartnerInPass etc. — these are approximate checks
    // For now, count bomb inventory items with acquiredPhase = 'postPass' per recipient
    // (This is handled in the bomb inventory section below)

    // Kept dog during pass
    if (fullHandPrePass.length > 0 && handAfterPass.length > 0) {
      if (fullHandPrePass.includes(DOG_ID) && handAfterPass.includes(DOG_ID)) {
        stats.keptDogDuringPass++;
      }
    }

    // Pre-pass hand analysis
    if (fullHandPrePass.length > 0) {
      const powerCount = countPowerCards(fullHandPrePass);
      if (powerCount >= 2) stats.strongPrePassHand++;
      if (powerCount >= 6) stats.allPowerCardsBeforePass++;
    }

    // Post-pass hand analysis
    if (handAfterPass.length > 0) {
      if (allCardsUnder10(handAfterPass)) stats.allCardsUnder10AfterPass++;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Compute Play-Level Group C Stats (from plays table)
  // ═══════════════════════════════════════════════════════════════════════

  for (const play of filteredPlays) {
    if (play.action_type === 'play' || play.action_type === 'bomb') {
      // REQ-F-PS01: Production enum values and card IDs, including Phoenix singles.
      if (play.combination_type === CombinationType.Straight) {
        stats.longestStraight = Math.max(stats.longestStraight, play.combination_length ?? 0);
      }
      // Phoenix usage
      if (parseJsonArray(play.cards).includes(PHOENIX_ID)) {
        switch (play.combination_type) {
          case CombinationType.Single: stats.phoenixUsedAsSingle++; break;
          case CombinationType.Pair: stats.phoenixUsedForPair++; break;
          case CombinationType.Triple: stats.phoenixUsedInTriple++; break;
          case CombinationType.FullHouse: stats.phoenixUsedInFullHouse++; break;
          case CombinationType.PairSequence: stats.phoenixUsedInConsecutivePairs++; break;
          case CombinationType.Straight:
            stats.phoenixUsedInStraight++;
            if (play.combination_length != null) {
              stats.longestStraightWithPhoenix = Math.max(
                stats.longestStraightWithPhoenix, play.combination_length);
            }
            break;
        }
      }

      // Bomb forced by wish
      if (play.is_bomb && play.play_forced_by_wish) stats.bombForcedByWish++;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Dragon Trick Stats (from tricks table)
  // ═══════════════════════════════════════════════════════════════════════

  // REQ-F-SA06: dragon trick credit only if user held the winning seat for that specific round.
  for (const trick of dragonTricks) {
    if (trick.winner_seat == null) continue;
    if (validGameRoundSeat.has(`${trick.game_id}-${trick.round_number}-${trick.winner_seat}`)) {
      stats.dragonTrickWins++;
    }
  }

  // REQ-F-SA08: captured-dragon-with-bomb credit only if user held the bomber's seat for that round.
  // Counts inventory bombs whose fate was 'played' AND whose winning trick contained the dragon.
  // Set by GameEventCapture.detectTrickCompletion when a bomb wins a dragon trick.
  for (const bomb of filteredBombs) {
    if (bomb.captured_dragon === 1) {
      stats.capturedDragonWithBomb++;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Dog Play Stats
  // ═══════════════════════════════════════════════════════════════════════

  // REQ-F-SA07: dog-play credit only if user held the playing seat for that round.
  for (const dog of myDogPlays) {
    if (!validGameRoundSeat.has(`${dog.game_id}-${dog.round_number}-${dog.player_seat}`)) continue;
    const mySeat = dog.player_seat as Seat;
    const partner = getPartner(mySeat);
    if (dog.control_passed_to === partner) {
      stats.dogControlToPartner++;
    } else if (dog.control_passed_to === mySeat) {
      stats.dogControlToSelf++;
    } else {
      stats.dogControlToOpponent++;
    }

    if (dog.dog_was_last_card) stats.dogStuckAsLastCard++;
    if (dog.partner_has_tichu) stats.dogPlayedForTichuPartner++;

    // Dog opportunities: partner has tichu and we lead (played Dog or not)
    // The old tracker tracks this differently — it counts whenever the player leads and partner has tichu
    // For now, we count dog play events where partner_has_tichu is true
    // (dogOpportunitiesForTichuPartner is tracked separately via plays where lead + partnerTichuActive)
  }

  // Dog opportunities for tichu partner: count leads where partner had active tichu
  // This counts every time the player led a trick while partner had an active tichu call
  for (const play of filteredPlays) {
    if (play.action_type === 'play' && play.sequence_number === 1 && play.partner_tichu_active) {
      stats.dogOpportunitiesForTichuPartner++;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Bomb Inventory Stats
  // ═══════════════════════════════════════════════════════════════════════

  // Index bombs by (game, round) for per-round analysis
  const bombsByGameRound = new Map<string, BombInventoryRow[]>();
  for (const bomb of filteredBombs) {
    const key = `${bomb.game_id}-${bomb.round_number}`;
    if (!bombsByGameRound.has(key)) bombsByGameRound.set(key, []);
    bombsByGameRound.get(key)!.push(bomb);
  }

  for (const [, roundBombs] of bombsByGameRound) {
    if (roundBombs.length > 0) stats.handsWithBombs++;
    if (roundBombs.length > 1) stats.handsWithMultipleBombs++;

    let bombsInFirst8Count = 0;
    for (const bomb of roundBombs) {
      if (bomb.acquired_phase === 'first8') bombsInFirst8Count++;

      if (bomb.fate === 'played') {
        stats.totalBombs++;
        if (bomb.size === 4) { stats.fourCardBombs++; stats.bombSize4++; }
        else if (bomb.size === 5) { stats.fiveCardBombs++; stats.bombSize5++; }
        else if (bomb.size >= 6) {
          stats.sixPlusCardBombs++;
          const sizeKey = `bombSize${bomb.size}` as keyof StatsResult;
          if (sizeKey in stats && bomb.size >= 6 && bomb.size <= 14) {
            stats[sizeKey]++;
          }
        }

        if (bomb.was_overbomb) {
          stats.youOverBombed++;
          stats.overBombed++; // legacy compat
        }
      }
    }

    if (bombsInFirst8Count > 0) stats.bombsInFirst8 += bombsInFirst8Count;
  }

  // REQ-F-SA05: youWereOverBombed — user was the fate_target of someone else's overbomb,
  // credited only for rounds the user actually held that seat.
  const allBombs = db.all(sql`
    SELECT game_id, round_number, player_seat, was_overbomb, fate_target, fate
    FROM bomb_inventory
    WHERE game_id IN (${sql.join(gameIds.map(id => sql`${id}`), sql`, `)})
      AND was_overbomb = 1 AND fate = 'played'
  `) as (BombInventoryRow & { fate_target: string | null })[];

  for (const bomb of allBombs) {
    if (bomb.fate_target == null) continue;
    if (bomb.player_seat === bomb.fate_target) continue;
    if (validGameRoundSeat.has(`${bomb.game_id}-${bomb.round_number}-${bomb.fate_target}`)) {
      stats.youWereOverBombed++;
    }
  }

  // REQ-F-SA05: conflicting-bombs credit only for rounds the user held the seat.
  const bombOverlaps = db.all(sql`
    SELECT game_id, round_number, player_seat, overlaps_with
    FROM bomb_inventory
    WHERE game_id IN (${sql.join(gameIds.map(id => sql`${id}`), sql`, `)})
      AND overlaps_with IS NOT NULL
  `) as (BombInventoryRow & { overlaps_with: string | null })[];

  const conflictingRounds = new Set<string>();
  for (const bomb of bombOverlaps) {
    if (!validGameRoundSeat.has(`${bomb.game_id}-${bomb.round_number}-${bomb.player_seat}`)) continue;
    const overlaps = parseJsonArray(bomb.overlaps_with);
    if (overlaps.length > 0) {
      conflictingRounds.add(`${bomb.game_id}-${bomb.round_number}`);
    }
  }
  stats.conflictingBombs = conflictingRounds.size;

  // ═══════════════════════════════════════════════════════════════════════
  // "The Tichu" straight and double-bomb / all-players-bomb
  // ═══════════════════════════════════════════════════════════════════════

  // theTichuClean/Dirty: a 2-Ace straight (13 cards). Clean = no Phoenix, Dirty = with Phoenix
  // Detect from plays: combination_type = 'Straight' AND combination_length = 13
  for (const play of filteredPlays) {
    if (play.combination_type === CombinationType.Straight && play.combination_length === 13) {
      if (parseJsonArray(play.cards).includes(PHOENIX_ID)) {
        stats.theTichuDirty++;
      } else {
        stats.theTichuClean++;
      }
    }
  }

  // Double bomb in trick: 2+ bombs in same trick. Credit the user only if they
  // played the specific round (REQ-F-SA05).
  // REQ-F-PS03: Two bomb plays, including two by the same seat.
  const bombsByTrick = new Map<string, { gameId: number; roundNumber: number; count: number }>();
  for (const play of allPlays) {
    const key = `${play.game_id}-${play.round_number}-${play.trick_number}`;
    const entry = bombsByTrick.get(key) ?? { gameId: play.game_id, roundNumber: play.round_number, count: 0 };
    entry.count++;
    bombsByTrick.set(key, entry);
  }
  for (const { gameId, roundNumber, count } of bombsByTrick.values()) {
    if (count >= 2 && myRoundsByGame.get(gameId)?.has(roundNumber)) stats.doubleBombInTrick++;
  }

  // All-players-bomb-in-round: all 4 seats played a bomb this round. Credit the
  // user only if they played the specific round (REQ-F-SA05).
  const bombSeatsByRound = new Map<string, { gameId: number; roundNumber: number; seats: Set<string> }>();
  for (const play of allPlays) {
    if (play.is_bomb) {
      const key = `${play.game_id}-${play.round_number}`;
      if (!bombSeatsByRound.has(key)) {
        bombSeatsByRound.set(key, { gameId: play.game_id, roundNumber: play.round_number, seats: new Set() });
      }
      bombSeatsByRound.get(key)!.seats.add(play.seat);
    }
  }
  for (const { gameId, roundNumber, seats } of bombSeatsByRound.values()) {
    if (seats.size >= 4 && myRoundsByGame.get(gameId)?.has(roundNumber)) {
      stats.allPlayersBombInRound++;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Bomb pass tracking (bombGivenToPartner/Opponent, bombReceivedFromPartner/Opponent)
  // ═══════════════════════════════════════════════════════════════════════

  // REQ-F-PS02: Exact contribution to canonical bombs in each recipient's hand.
  for (const pr of myPlayerRounds) {
    const seat = pr.seat as Seat;
    const roundPlayers = prByGameRound.get(`${pr.game_id}-${pr.round_number}`) ?? [];
    const partnerHand = parseJsonArray(roundPlayers.find(p => p.seat === getPartner(seat))?.hand_after_pass ?? null);
    stats.bombGivenToPartner += countBombContributions(partnerHand, parseJsonArray(pr.passed_to_partner));
    // Passing order follows SEATS_IN_ORDER; left/right are the next/previous seat.
    const seatIndex = SEATS_IN_ORDER.indexOf(seat);
    for (const [offset, passed] of [[1, pr.passed_to_left], [3, pr.passed_to_right]] as const) {
      const recipient = SEATS_IN_ORDER[(seatIndex + offset) % 4];
      const hand = parseJsonArray(roundPlayers.find(p => p.seat === recipient)?.hand_after_pass ?? null);
      stats.bombGivenToOpponent += countBombContributions(hand, parseJsonArray(passed));
    }
    const received = getReceivedBombStats(parseJsonArray(pr.hand_after_pass),
      parseJsonArray(pr.received_from_partner),
      [...parseJsonArray(pr.received_from_left), ...parseJsonArray(pr.received_from_right)]);
    stats.bombReceivedFromPartner += received.partner;
    stats.bombReceivedFromOpponent += received.opponent;
    stats.totalBombsReceived += received.total;
  }

  return stats;
}

// ═══════════════════════════════════════════════════════════════════════════
// Relational Stats Computation
// ═══════════════════════════════════════════════════════════════════════════

interface RelationalStatsResult {
  userId: string;
  otherUserId: string;
  relationship: 'partner' | 'opponent';
  gamesPlayed: number;
  gamesWon: number;
  oneTwoWins: number;
  totalTeamBombs: number;
}

function computeRelationalStatsForUser(database: Database, userId: string, participation: ParticipationView): RelationalStatsResult[] {
  const { db } = database;
  const results: RelationalStatsResult[] = [];

  // REQ-F-PS03: Only co-participating round tuples establish a relationship.
  const userGames = db.all(sql`
    SELECT * FROM games WHERE status = 'completed' AND ${participationCondition(participation)} AND id IN (
      SELECT game_id FROM player_rounds WHERE user_id = ${userId}
    )
  `) as GameRow[];
  if (userGames.length === 0) return results;
  const gameIds = userGames.map(game => game.id);
  const idList = sql.join(gameIds.map(id => sql`${id}`), sql`, `);
  const participants = db.all(sql`SELECT game_id, round_number, seat, user_id FROM player_rounds
    WHERE game_id IN (${idList})`) as PlayerRoundRow[];
  const rounds = db.all(sql`SELECT game_id, round_number, one_two_bonus FROM game_rounds
    WHERE game_id IN (${idList})`) as GameRoundRow[];
  const bombs = db.all(sql`SELECT game_id, round_number, seat FROM plays
    WHERE game_id IN (${idList}) AND is_bomb = 1 AND action_type IN ('play', 'bomb')`) as PlayRow[];
  const accumulator = new Map<string, RelationalStatsResult>();
  for (const game of userGames) {
    const seenGames = new Set<string>();
    const seenRounds = new Set<string>();
    for (const mine of participants.filter(row => row.game_id === game.id && row.user_id === userId)) {
      const myTeam = getTeam(mine.seat as Seat);
      const others = participants.filter(row => row.game_id === game.id
        && row.round_number === mine.round_number && row.seat !== mine.seat);
      for (const other of others) {
        const otherUserId = other.user_id ?? '__bot__';
        const relationship = getTeam(other.seat as Seat) === myTeam ? 'partner' : 'opponent';
        const key = `${otherUserId}-${relationship}`;
        const entry = accumulator.get(key) ?? {
          userId, otherUserId, relationship, gamesPlayed: 0, gamesWon: 0, oneTwoWins: 0, totalTeamBombs: 0,
        };
        if (!seenGames.has(key)) {
          entry.gamesPlayed++;
          if (getUserSeat(game, userId) !== null && game.winner_team === getUserTeamStr(mine.seat as Seat)) entry.gamesWon++;
          seenGames.add(key);
        }
        const roundKey = `${key}-${mine.round_number}`;
        if (!seenRounds.has(roundKey)) {
          if (rounds.some(round => round.game_id === game.id && round.round_number === mine.round_number
            && round.one_two_bonus === getUserTeamStr(mine.seat as Seat))) entry.oneTwoWins++;
          entry.totalTeamBombs += bombs.filter(bomb => bomb.game_id === game.id
            && bomb.round_number === mine.round_number && getTeam(bomb.seat as Seat) === myTeam).length;
          seenRounds.add(roundKey);
        }
        accumulator.set(key, entry);
      }
    }
  }

  return [...accumulator.values()];
}

// ═══════════════════════════════════════════════════════════════════════════
// Write Stats to Cache Tables
// ═══════════════════════════════════════════════════════════════════════════

function writeStatsToCache(database: Database, userId: string, stats: StatsResult, participation: ParticipationView): void {
  const { db } = database;
  db.run(sql`
    INSERT OR REPLACE INTO stats_cache (
      user_id, participation, cache_version, source_signature, games_played, games_won, win_rate,
      tichu_calls, tichu_successes, blind_grand_tichu_calls, blind_grand_tichu_successes,
      grand_tichu_calls, grand_tichu_successes,
      total_rounds_played, first_finishes, last_updated_at,
      largest_win_diff, largest_loss_diff, games_forfeited, games_spectated,
      one_two_wins, one_two_against,
      rounds_won, opponent_tichu_broken, opponent_grand_tichu_broken,
      partner_tichu_broken, partner_grand_tichu_broken,
      last_finishes, tichu_broken_by_partner, grand_tichu_broken_by_partner,
      games_requiring_tie_break, most_tie_break_rounds_needed,
      games_joined_after_spectating,
      rounds_with_dragon, rounds_with_dragon_won,
      rounds_with_phoenix, rounds_with_phoenix_won,
      dragon_received_in_pass, phoenix_received_in_pass, ace_received_in_pass, dog_received_in_pass,
      dragon_trick_wins, captured_dragon_with_bomb,
      dog_given_to_partner, dog_given_to_opponent,
      dog_played_for_tichu_partner, dog_opportunities_for_tichu_partner,
      hands_with_bombs, total_bombs, four_card_bombs, five_card_bombs, six_plus_card_bombs,
      bombs_in_first_8, hands_with_multiple_bombs,
      over_bombed, bomb_forced_by_wish,
      the_tichu_clean, the_tichu_dirty,
      phoenix_used_as_single, phoenix_used_for_pair, phoenix_used_in_triple,
      phoenix_used_in_full_house, phoenix_used_in_consecutive_pairs, phoenix_used_in_straight,
      longest_straight_with_phoenix,
      longest_straight,
      total_bombs_received,
      opponent_blind_grand_tichu_broken,
      partner_blind_grand_tichu_broken,
      blind_grand_tichu_broken_by_partner,

      dog_control_to_partner, dog_control_to_opponent, dog_control_to_self, dog_stuck_as_last_card,
      bomb_size_4, bomb_size_5, bomb_size_6, bomb_size_7, bomb_size_8,
      bomb_size_9, bomb_size_10, bomb_size_11, bomb_size_12, bomb_size_13, bomb_size_14,
      conflicting_bombs, you_over_bombed, you_were_over_bombed,
      dragon_gave_in_pass, phoenix_gave_in_pass, ace_gave_in_pass,
      mahjong_gave_in_pass, mahjong_received_in_pass,
      dog_received_from_partner, dog_received_from_opponent,
      bomb_gave_to_partner, bomb_gave_to_opponent,
      bomb_received_from_partner, bomb_received_from_opponent,
      hands_with_dog, strong_pre_pass_hand, kept_dog_during_pass,
      all_power_cards_before_pass, all_cards_under_10_after_pass,
      double_bomb_in_trick, all_players_bomb_in_round
    ) VALUES (
      ${userId}, ${participation}, ${STATS_CACHE_VERSION}, ${getStatsSource(database, userId).signature}, ${stats.gamesPlayed}, ${stats.gamesWon}, ${stats.winRate},
      ${stats.tichuCalls}, ${stats.tichuSuccesses}, ${stats.blindGrandTichuCalls}, ${stats.blindGrandTichuSuccesses},
      ${stats.grandTichuCalls}, ${stats.grandTichuSuccesses},
      ${stats.totalRoundsPlayed}, ${stats.firstFinishes}, datetime('now'),
      ${stats.largestWinDiff}, ${stats.largestLossDiff}, ${stats.gamesForfeited}, 0,
      ${stats.oneTwoWins}, ${stats.oneTwoAgainst},
      ${stats.roundsWon}, ${stats.opponentTichuBroken}, ${stats.opponentGrandTichuBroken},
      ${stats.partnerTichuBroken}, ${stats.partnerGrandTichuBroken},
      ${stats.lastFinishes}, ${stats.tichuBrokenByPartner}, ${stats.grandTichuBrokenByPartner},
      ${stats.gamesRequiringTieBreak}, ${stats.mostTieBreakRoundsNeeded},
      ${stats.gamesJoinedAfterSpectating},
      ${stats.roundsWithDragon}, ${stats.roundsWithDragonWon},
      ${stats.roundsWithPhoenix}, ${stats.roundsWithPhoenixWon},
      ${stats.dragonReceivedInPass}, ${stats.phoenixReceivedInPass}, ${stats.aceReceivedInPass}, ${stats.dogReceivedInPass},
      ${stats.dragonTrickWins}, ${stats.capturedDragonWithBomb},
      ${stats.dogGivenToPartner}, ${stats.dogGivenToOpponent},
      ${stats.dogPlayedForTichuPartner}, ${stats.dogOpportunitiesForTichuPartner},
      ${stats.handsWithBombs}, ${stats.totalBombs}, ${stats.fourCardBombs}, ${stats.fiveCardBombs}, ${stats.sixPlusCardBombs},
      ${stats.bombsInFirst8}, ${stats.handsWithMultipleBombs},
      ${stats.overBombed}, ${stats.bombForcedByWish},
      ${stats.theTichuClean}, ${stats.theTichuDirty},
      ${stats.phoenixUsedAsSingle}, ${stats.phoenixUsedForPair}, ${stats.phoenixUsedInTriple},
      ${stats.phoenixUsedInFullHouse}, ${stats.phoenixUsedInConsecutivePairs}, ${stats.phoenixUsedInStraight},
      ${stats.longestStraightWithPhoenix},
      ${stats.longestStraight},
      ${stats.totalBombsReceived},
      ${stats.opponentBlindGrandTichuBroken},
      ${stats.partnerBlindGrandTichuBroken},
      ${stats.blindGrandTichuBrokenByPartner},

      ${stats.dogControlToPartner}, ${stats.dogControlToOpponent}, ${stats.dogControlToSelf}, ${stats.dogStuckAsLastCard},
      ${stats.bombSize4}, ${stats.bombSize5}, ${stats.bombSize6}, ${stats.bombSize7}, ${stats.bombSize8},
      ${stats.bombSize9}, ${stats.bombSize10}, ${stats.bombSize11}, ${stats.bombSize12}, ${stats.bombSize13}, ${stats.bombSize14},
      ${stats.conflictingBombs}, ${stats.youOverBombed}, ${stats.youWereOverBombed},
      ${stats.dragonGivenInPass}, ${stats.phoenixGivenInPass}, ${stats.aceGivenInPass},
      ${stats.mahjongGivenInPass}, ${stats.mahjongReceivedInPass},
      ${stats.dogReceivedFromPartner}, ${stats.dogReceivedFromOpponent},
      ${stats.bombGivenToPartner}, ${stats.bombGivenToOpponent},
      ${stats.bombReceivedFromPartner}, ${stats.bombReceivedFromOpponent},
      ${stats.handsWithDog}, ${stats.strongPrePassHand}, ${stats.keptDogDuringPass},
      ${stats.allPowerCardsBeforePass}, ${stats.allCardsUnder10AfterPass},
      ${stats.doubleBombInTrick}, ${stats.allPlayersBombInRound}
    )
  `);
}

function writeRelationalStatsToCache(database: Database, userId: string, relStats: RelationalStatsResult[], participation: ParticipationView): void {
  const { db } = database;
  // Delete existing entries for this user
  db.run(sql`DELETE FROM relational_stats_cache WHERE user_id = ${userId} AND participation = ${participation}`);
  // Insert new entries
  for (const entry of relStats) {
    db.run(sql`
      INSERT INTO relational_stats_cache (user_id, participation, other_user_id, relationship, games_played, games_won, one_two_wins, total_team_bombs)
      VALUES (${entry.userId}, ${participation}, ${entry.otherUserId}, ${entry.relationship},
              ${entry.gamesPlayed}, ${entry.gamesWon}, ${entry.oneTwoWins}, ${entry.totalTeamBombs})
    `);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * REQ-F-MC02: Full rebuild — recompute all stats for all users from raw events.
 * Drops existing cache and recreates from scratch.
 */
export function rebuildStatsCache(database: Database): void {
  const { db } = database;
  inferLegacyParticipation(database);

  // Get all users who have played any round — includes users who were swapped
  // out before the game ended and therefore do not appear in games.{seat}_user_id.
  // REQ-F-SA01/SA12: users with ≥1 player_rounds row must be discoverable for
  // gamesPlayed and gamesForfeited attribution.
  const userIds = db.all(sql`
    SELECT DISTINCT user_id FROM (
      SELECT north_user_id AS user_id FROM games WHERE north_user_id IS NOT NULL
      UNION SELECT east_user_id FROM games WHERE east_user_id IS NOT NULL
      UNION SELECT south_user_id FROM games WHERE south_user_id IS NOT NULL
      UNION SELECT west_user_id FROM games WHERE west_user_id IS NOT NULL
      UNION SELECT user_id FROM player_rounds WHERE user_id IS NOT NULL
    )
  `) as { user_id: string }[];

  // Clear cache tables
  db.run(sql`DELETE FROM stats_cache`);
  db.run(sql`DELETE FROM relational_stats_cache`);

  // Rebuild for each user
  for (const { user_id: userId } of userIds) {
    rebuildPlayerCache(database, userId, false);
  }
  console.log(`[STATS] Rebuilt stats cache for ${userIds.length} user(s)`);
}

/**
 * REQ-F-MC03: Incremental update — recompute stats for all players in a specific game.
 * Called after writeEventData completes.
 */
export function updateCacheAfterGame(database: Database, dbGameId: number): void {
  const { db } = database;
  console.log(`[STATS] updateCacheAfterGame called for dbGameId=${dbGameId}`);
  inferLegacyParticipation(database);

  // Get all humans who played any round of this game — not just final occupants.
  // REQ-F-SA01/SA12: swapped-out players must be refreshed so their
  // gamesPlayed/gamesForfeited counters update after each completed game.
  const played = db.all(sql`
    SELECT DISTINCT user_id FROM player_rounds
    WHERE game_id = ${dbGameId} AND user_id IS NOT NULL
  `) as { user_id: string }[];

  if (played.length === 0) {
    console.log(`[STATS] No player_rounds with user_id found for game ${dbGameId} — skipping cache update`);
    return;
  }

  const uniqueIds = played.map((r) => r.user_id);

  for (const userId of uniqueIds) {
    rebuildPlayerCache(database, userId, false);
  }
  console.log(`[STATS] Updated stats cache for ${uniqueIds.length} user(s) after game ${dbGameId}`);
}

/**
 * REQ-F-MC04: Rebuild stats for a single user (useful for retroactive stat addition).
 */
export function rebuildPlayerCache(database: Database, userId: string, infer = true): void {
  if (infer) inferLegacyParticipation(database);
  database.db.transaction(() => {
    for (const participation of PARTICIPATION_VIEWS) {
      const stats = computeStatsForUser(database, userId, participation);
      writeStatsToCache(database, userId, stats, participation);
      const relStats = computeRelationalStatsForUser(database, userId, participation);
      writeRelationalStatsToCache(database, userId, relStats, participation);
    }
  });
}

export function refreshLeaderboardStatsCacheIfStale(database: Database): boolean {
  inferLegacyParticipation(database);
  const users = database.client.prepare("SELECT DISTINCT pr.user_id FROM player_rounds pr JOIN games g ON g.id = pr.game_id WHERE pr.user_id IS NOT NULL AND g.status = 'completed'")
    .all() as { user_id: string }[];
  let refreshed = false;
  for (const { user_id: userId } of users) refreshed = refreshPlayerStatsCacheIfStale(database, userId) || refreshed;
  return refreshed;
}

function parseDbTimestampMs(value: string): number | null {
  const normalized = value.includes('T')
    ? value
    : `${value.replace(' ', 'T')}Z`;
  const timestamp = Date.parse(normalized);
  return Number.isNaN(timestamp) ? null : timestamp;
}

/**
 * Recompute a player's materialized stats only when raw completed-game data has
 * moved past the cached snapshot. This covers missed incremental updates while
 * keeping normal stats-page visits cheap.
 */
export function refreshPlayerStatsCacheIfStale(database: Database, userId: string): boolean {
  inferLegacyParticipation(database);
  const raw = getStatsSource(database, userId);
  if (raw.gameCount === 0) return false;
  const caches = database.client.prepare(`SELECT cache_version, source_signature, last_updated_at
    FROM stats_cache WHERE user_id = ?`).all(userId) as {
      cache_version: number; source_signature: string; last_updated_at: string;
    }[];
  const latestRaw = raw.latestEndedAt === null ? null : parseDbTimestampMs(raw.latestEndedAt);
  const stale = caches.length !== PARTICIPATION_VIEWS.length || caches.some(cache => {
    const latestCache = parseDbTimestampMs(cache.last_updated_at);
    return cache.cache_version !== STATS_CACHE_VERSION || cache.source_signature !== raw.signature
      || (latestRaw !== null && latestCache !== null && latestRaw > latestCache);
  });
  if (!stale) return false;
  rebuildPlayerCache(database, userId, false);
  return true;
}
