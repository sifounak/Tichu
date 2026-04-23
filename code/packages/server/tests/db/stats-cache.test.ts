// Verifies: REQ-F-MC01–MC05, REQ-NF-04

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import { createDatabase, type Database } from '../../src/db/connection.js';
import { writeEventData } from '../../src/db/event-persistence.js';
import { rebuildStatsCache, updateCacheAfterGame, rebuildPlayerCache } from '../../src/db/stats-cache.js';
import { createGameAccumulator, createEmptyRoundData, createBlankPlayerRound } from '../../src/game/event-types.js';
import type { GameEventAccumulator } from '../../src/game/event-types.js';

// ─── Card ID constants ──────────────────────────────────────────────
const MAHJONG_ID = 52;
const DOG_ID = 53;
const PHOENIX_ID = 54;
const DRAGON_ID = 55;
// Aces: Jade=12, Pagoda=25, Star=38, Sword=51

const TEST_DB_PATH = './data/test-stats-cache.sqlite';

// ─── Test Helpers ───────────────────────────────────────────────────

function insertTestGame(database: Database, opts: {
  northUserId?: string | null;
  eastUserId?: string | null;
  southUserId?: string | null;
  westUserId?: string | null;
  winnerTeam?: string;
  finalScoreNS?: number;
  finalScoreEW?: number;
  targetScore?: number;
} = {}): number {
  const { client } = database;
  const result = client.prepare(
    `INSERT INTO games (room_code, started_at, ended_at, winner_team,
      final_score_ns, final_score_ew, target_score, round_count,
      north_user_id, east_user_id, south_user_id, west_user_id,
      north_name, east_name, south_name, west_name)
    VALUES ('TEST', datetime('now'), datetime('now'), ?,
      ?, ?, ?, 1,
      ?, ?, ?, ?,
      'North', 'East', 'South', 'West')`,
  ).run(
    opts.winnerTeam ?? 'NS',
    opts.finalScoreNS ?? 500,
    opts.finalScoreEW ?? 300,
    opts.targetScore ?? 1000,
    opts.northUserId ?? 'user1',
    opts.eastUserId ?? null,
    opts.southUserId ?? null,
    opts.westUserId ?? null,
  );
  const gameId = Number(result.lastInsertRowid);
  client.prepare(
    `INSERT INTO game_rounds (game_id, round_number, card_points_ns, card_points_ew,
      tichu_bonus_ns, tichu_bonus_ew, one_two_bonus, total_ns, total_ew,
      finish_order, tichu_calls, score_ns_at_start, score_ew_at_start)
    VALUES (?, 1, 50, 50, 100, 0, null, 150, 50,
      '["north","east","south","west"]', '{}', 0, 0)`,
  ).run(gameId);
  return gameId;
}

function insertUser(database: Database, userId: string, displayName: string): void {
  const { client } = database;
  try {
    client.prepare(
      `INSERT INTO users (id, display_name) VALUES (?, ?)`,
    ).run(userId, displayName);
  } catch {
    // Already exists
  }
}

function makeMinimalAccumulator(gameId: number, opts: {
  northUserId?: string | null;
  handAfterPass?: number[];
  tichuCall?: boolean;
  tichuCallSuccess?: boolean;
  grandTichuCall?: boolean;
  finishPosition?: number;
} = {}): GameEventAccumulator {
  const acc = createGameAccumulator(gameId);
  const round = createEmptyRoundData(1, 0, 0);

  for (const seat of ['north', 'east', 'south', 'west'] as const) {
    const pr = createBlankPlayerRound(gameId, 1, seat,
      seat === 'north' ? (opts.northUserId ?? 'user1') : null);
    pr.grandTichuCall = seat === 'north' ? (opts.grandTichuCall ?? false) : false;
    pr.tichuCall = seat === 'north' ? (opts.tichuCall ?? false) : false;
    pr.tichuCallSuccess = seat === 'north' ? (opts.tichuCallSuccess ?? null) : null;
    pr.finishPosition = seat === 'north' ? (opts.finishPosition ?? 1) :
      seat === 'east' ? 2 : seat === 'south' ? 3 : 4;
    pr.handAfterPass = seat === 'north' ? (opts.handAfterPass ?? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]) : null;
    pr.fullHandPrePass = seat === 'north' ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] : null;
    round.playerRounds.push(pr);
  }

  acc.rounds.push(round);
  return acc;
}

function getCacheRow(database: Database, userId: string): Record<string, any> | undefined {
  const { client } = database;
  return client.prepare('SELECT * FROM stats_cache WHERE user_id = ?').get(userId) as Record<string, any> | undefined;
}

function getRelationalCacheRows(database: Database, userId: string): Record<string, any>[] {
  const { client } = database;
  return client.prepare('SELECT * FROM relational_stats_cache WHERE user_id = ?').all(userId) as Record<string, any>[];
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('Stats Cache', () => {
  let database: Database;

  beforeEach(() => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    database = createDatabase(TEST_DB_PATH);
    insertUser(database, 'user1', 'Player1');
    insertUser(database, 'user2', 'Player2');
    insertUser(database, '__bot__', 'Bot');
  });

  afterEach(() => {
    database.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  // ─── REQ-F-MC01: V1 Cache Table ──────────────────────────────────

  describe('REQ-F-MC01: V1 cache table', () => {
    it('should create stats_cache table on database creation', () => {
      const { client } = database;
      const tables = client.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='stats_cache'"
      ).all();
      expect(tables).toHaveLength(1);
    });

    it('should create relational_stats_cache table on database creation', () => {
      const { client } = database;
      const tables = client.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='relational_stats_cache'"
      ).all();
      expect(tables).toHaveLength(1);
    });
  });

  // ─── REQ-F-MC02: Full Rebuild ────────────────────────────────────

  describe('REQ-F-MC02: Full rebuild from raw events', () => {
    it('should rebuild cache with 0 games (empty cache)', () => {
      rebuildStatsCache(database);
      const row = getCacheRow(database, 'user1');
      expect(row).toBeUndefined();
    });

    it('should rebuild cache after a game with basic stats', () => {
      const gameId = insertTestGame(database, { northUserId: 'user1', winnerTeam: 'NS' });
      const acc = makeMinimalAccumulator(gameId);
      writeEventData(database, gameId, acc);

      rebuildStatsCache(database);

      const row = getCacheRow(database, 'user1');
      expect(row).toBeDefined();
      expect(row!.games_played).toBe(1);
      expect(row!.games_won).toBe(1);
      expect(row!.win_rate).toBe(1);
      expect(row!.total_rounds_played).toBe(1);
      expect(row!.first_finishes).toBe(1);
    });

    it('should compute win rate correctly across multiple games', () => {
      // Game 1: user1 wins
      const g1 = insertTestGame(database, { northUserId: 'user1', winnerTeam: 'NS' });
      const acc1 = makeMinimalAccumulator(g1);
      writeEventData(database, g1, acc1);

      // Game 2: user1 loses
      const g2 = insertTestGame(database, { northUserId: 'user1', winnerTeam: 'EW', finalScoreNS: 300, finalScoreEW: 500 });
      const acc2 = makeMinimalAccumulator(g2);
      writeEventData(database, g2, acc2);

      rebuildStatsCache(database);

      const row = getCacheRow(database, 'user1');
      expect(row!.games_played).toBe(2);
      expect(row!.games_won).toBe(1);
      expect(row!.win_rate).toBeCloseTo(0.5);
    });

    it('should compute tichu call stats from player_rounds', () => {
      const gameId = insertTestGame(database, { northUserId: 'user1' });
      const acc = makeMinimalAccumulator(gameId, {
        tichuCall: true,
        tichuCallSuccess: true,
        finishPosition: 1,
      });
      writeEventData(database, gameId, acc);

      rebuildStatsCache(database);

      const row = getCacheRow(database, 'user1');
      expect(row!.tichu_calls).toBe(1);
      expect(row!.tichu_successes).toBe(1);
    });

    it('should compute grand tichu stats', () => {
      const gameId = insertTestGame(database, { northUserId: 'user1' });
      const acc = makeMinimalAccumulator(gameId, {
        grandTichuCall: true,
        tichuCallSuccess: true,
        finishPosition: 1,
      });
      writeEventData(database, gameId, acc);

      rebuildStatsCache(database);

      const row = getCacheRow(database, 'user1');
      expect(row!.grand_tichu_calls).toBe(1);
      expect(row!.grand_tichu_successes).toBe(1);
    });

    it('should detect dragon in hand after pass', () => {
      const gameId = insertTestGame(database, { northUserId: 'user1' });
      const acc = makeMinimalAccumulator(gameId, {
        handAfterPass: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, DRAGON_ID],
      });
      writeEventData(database, gameId, acc);

      rebuildStatsCache(database);

      const row = getCacheRow(database, 'user1');
      expect(row!.rounds_with_dragon).toBe(1);
      // Team won (NS winner), so rounds_with_dragon_won should also be 1
      expect(row!.rounds_with_dragon_won).toBe(1);
    });

    it('should detect phoenix in hand after pass', () => {
      const gameId = insertTestGame(database, { northUserId: 'user1' });
      const acc = makeMinimalAccumulator(gameId, {
        handAfterPass: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, PHOENIX_ID],
      });
      writeEventData(database, gameId, acc);

      rebuildStatsCache(database);

      const row = getCacheRow(database, 'user1');
      expect(row!.rounds_with_phoenix).toBe(1);
    });

    it('should detect dog in hand after pass', () => {
      const gameId = insertTestGame(database, { northUserId: 'user1' });
      const acc = makeMinimalAccumulator(gameId, {
        handAfterPass: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, DOG_ID],
      });
      writeEventData(database, gameId, acc);

      rebuildStatsCache(database);

      const row = getCacheRow(database, 'user1');
      expect(row!.hands_with_dog).toBe(1);
    });

    it('should detect last-place finishes', () => {
      const gameId = insertTestGame(database, { northUserId: 'user1' });
      const acc = makeMinimalAccumulator(gameId, { finishPosition: 4 });
      writeEventData(database, gameId, acc);

      rebuildStatsCache(database);

      const row = getCacheRow(database, 'user1');
      expect(row!.last_finishes).toBe(1);
      expect(row!.first_finishes).toBe(0);
    });

    it('should compute largest win/loss diff', () => {
      // Win by 200
      const g1 = insertTestGame(database, {
        northUserId: 'user1', winnerTeam: 'NS',
        finalScoreNS: 1100, finalScoreEW: 900,
      });
      writeEventData(database, g1, makeMinimalAccumulator(g1));

      // Lose by 300
      const g2 = insertTestGame(database, {
        northUserId: 'user1', winnerTeam: 'EW',
        finalScoreNS: 700, finalScoreEW: 1000,
      });
      writeEventData(database, g2, makeMinimalAccumulator(g2));

      rebuildStatsCache(database);

      const row = getCacheRow(database, 'user1');
      expect(row!.largest_win_diff).toBe(200);
      expect(row!.largest_loss_diff).toBe(300);
    });

    it('should produce identical results when called multiple times', () => {
      const gameId = insertTestGame(database, { northUserId: 'user1', winnerTeam: 'NS' });
      const acc = makeMinimalAccumulator(gameId, { tichuCall: true, tichuCallSuccess: true });
      writeEventData(database, gameId, acc);

      rebuildStatsCache(database);
      const firstRebuild = getCacheRow(database, 'user1');

      rebuildStatsCache(database);
      const secondRebuild = getCacheRow(database, 'user1');

      // All values should match (except last_updated_at timestamp)
      expect(firstRebuild!.games_played).toBe(secondRebuild!.games_played);
      expect(firstRebuild!.tichu_calls).toBe(secondRebuild!.tichu_calls);
      expect(firstRebuild!.rounds_with_dragon).toBe(secondRebuild!.rounds_with_dragon);
    });
  });

  // ─── REQ-F-MC03: Incremental Update ──────────────────────────────

  describe('REQ-F-MC03: Incremental update after each game', () => {
    it('should update cache incrementally for players in a game', () => {
      const gameId = insertTestGame(database, { northUserId: 'user1', winnerTeam: 'NS' });
      const acc = makeMinimalAccumulator(gameId);
      writeEventData(database, gameId, acc);

      updateCacheAfterGame(database, gameId);

      const row = getCacheRow(database, 'user1');
      expect(row).toBeDefined();
      expect(row!.games_played).toBe(1);
      expect(row!.games_won).toBe(1);
    });

    it('should handle game with no human players gracefully', () => {
      const gameId = insertTestGame(database, {
        northUserId: null, eastUserId: null, southUserId: null, westUserId: null,
      });

      // Should not throw
      updateCacheAfterGame(database, gameId);
    });

    it('incremental update should match full rebuild results', () => {
      const g1 = insertTestGame(database, { northUserId: 'user1', winnerTeam: 'NS' });
      writeEventData(database, g1, makeMinimalAccumulator(g1));
      updateCacheAfterGame(database, g1);

      const g2 = insertTestGame(database, { northUserId: 'user1', winnerTeam: 'EW' });
      writeEventData(database, g2, makeMinimalAccumulator(g2));
      updateCacheAfterGame(database, g2);

      const incrementalRow = getCacheRow(database, 'user1');

      // Now do full rebuild and compare
      rebuildStatsCache(database);
      const rebuildRow = getCacheRow(database, 'user1');

      expect(incrementalRow!.games_played).toBe(rebuildRow!.games_played);
      expect(incrementalRow!.games_won).toBe(rebuildRow!.games_won);
      expect(incrementalRow!.win_rate).toBeCloseTo(rebuildRow!.win_rate);
      expect(incrementalRow!.total_rounds_played).toBe(rebuildRow!.total_rounds_played);
    });
  });

  // ─── REQ-F-MC04: Retroactive Stat Addition ───────────────────────

  describe('REQ-F-MC04: Retroactive stat addition', () => {
    it('should support per-user cache rebuild', () => {
      const gameId = insertTestGame(database, { northUserId: 'user1' });
      const acc = makeMinimalAccumulator(gameId, {
        handAfterPass: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, DRAGON_ID],
      });
      writeEventData(database, gameId, acc);

      rebuildPlayerCache(database, 'user1');

      const row = getCacheRow(database, 'user1');
      expect(row).toBeDefined();
      expect(row!.rounds_with_dragon).toBe(1);
    });
  });

  // ─── REQ-F-MC05: Cache Disposability ─────────────────────────────

  describe('REQ-F-MC05: Cache disposability', () => {
    it('should restore all stats after dropping and rebuilding cache', () => {
      const gameId = insertTestGame(database, { northUserId: 'user1' });
      const acc = makeMinimalAccumulator(gameId, { tichuCall: true, tichuCallSuccess: true });
      writeEventData(database, gameId, acc);

      updateCacheAfterGame(database, gameId);
      const beforeDrop = getCacheRow(database, 'user1');

      // Drop cache
      database.client.exec('DELETE FROM stats_cache');
      database.client.exec('DELETE FROM relational_stats_cache');

      expect(getCacheRow(database, 'user1')).toBeUndefined();

      // Rebuild
      rebuildStatsCache(database);
      const afterRebuild = getCacheRow(database, 'user1');

      expect(afterRebuild!.games_played).toBe(beforeDrop!.games_played);
      expect(afterRebuild!.tichu_calls).toBe(beforeDrop!.tichu_calls);
      expect(afterRebuild!.tichu_successes).toBe(beforeDrop!.tichu_successes);
      expect(afterRebuild!.first_finishes).toBe(beforeDrop!.first_finishes);
    });

    it('raw events should be untouched after cache drop', () => {
      const gameId = insertTestGame(database, { northUserId: 'user1' });
      const acc = makeMinimalAccumulator(gameId);
      writeEventData(database, gameId, acc);

      database.client.exec('DELETE FROM stats_cache');

      // Raw event data should still exist
      const playerRounds = database.client.prepare(
        'SELECT COUNT(*) as cnt FROM player_rounds WHERE game_id = ?'
      ).get(gameId) as { cnt: number };
      expect(playerRounds.cnt).toBeGreaterThan(0);
    });
  });

  // ─── Relational Stats Cache ──────────────────────────────────────

  describe('Relational stats cache', () => {
    it('should compute partner relational stats', () => {
      const gameId = insertTestGame(database, {
        northUserId: 'user1', southUserId: 'user2',
        winnerTeam: 'NS',
      });
      const acc = makeMinimalAccumulator(gameId);
      // Set user2 for south seat
      acc.rounds[0].playerRounds[2].userId = 'user2'; // south is index 2
      writeEventData(database, gameId, acc);

      rebuildStatsCache(database);

      const relRows = getRelationalCacheRows(database, 'user1');
      const partnerEntry = relRows.find(r => r.other_user_id === 'user2' && r.relationship === 'partner');
      expect(partnerEntry).toBeDefined();
      expect(partnerEntry!.games_played).toBe(1);
      expect(partnerEntry!.games_won).toBe(1);
    });

    it('should compute bot relational stats', () => {
      const gameId = insertTestGame(database, {
        northUserId: 'user1', eastUserId: null, southUserId: null, westUserId: null,
      });
      writeEventData(database, gameId, makeMinimalAccumulator(gameId));

      rebuildStatsCache(database);

      const relRows = getRelationalCacheRows(database, 'user1');
      const botPartner = relRows.find(r => r.other_user_id === '__bot__' && r.relationship === 'partner');
      const botOpponent = relRows.find(r => r.other_user_id === '__bot__' && r.relationship === 'opponent');
      expect(botPartner).toBeDefined();
      expect(botOpponent).toBeDefined();
    });
  });

  // ─── Edge Cases ──────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('should handle non-existent game ID gracefully', () => {
      updateCacheAfterGame(database, 9999);
      // Should not throw
    });

    it('should handle user with no games', () => {
      rebuildPlayerCache(database, 'user1');
      const row = getCacheRow(database, 'user1');
      expect(row).toBeDefined();
      expect(row!.games_played).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Verifies: REQ-F-SA01–SA13, SA15 — mid-game attribution correctness
  // ═══════════════════════════════════════════════════════════════════════
  describe('mid-game attribution', () => {
    type SeatMap = Partial<Record<'north' | 'east' | 'south' | 'west', string | null>>;

    /**
     * Inserts a multi-round game with custom seat occupancy per round.
     * `games.{seat}_user_id` reflects the *final* occupant (rounds[last]).
     * `player_rounds` rows reflect the actual occupant of each seat for each round.
     */
    function insertMultiRoundGame(opts: {
      winnerTeam?: 'NS' | 'EW';
      finalScoreNS?: number;
      finalScoreEW?: number;
      targetScore?: number;
      rounds: Array<{
        roundNumber: number;
        oneTwoBonus?: 'NS' | 'EW' | null;
        totalNS: number;
        totalEW: number;
        scoreNsAtStart?: number;
        scoreEwAtStart?: number;
        seats: SeatMap; // null => bot, omitted => bot
        finishOrder?: string; // JSON array; defaults to N,E,S,W
        tichuCalls?: string; // JSON; defaults to '{}'
      }>;
    }): number {
      const { client } = database;
      const last = opts.rounds[opts.rounds.length - 1];
      const finalSeats: SeatMap = last.seats;
      const result = client.prepare(
        `INSERT INTO games (room_code, started_at, ended_at, winner_team,
          final_score_ns, final_score_ew, target_score, round_count,
          north_user_id, east_user_id, south_user_id, west_user_id,
          north_name, east_name, south_name, west_name)
        VALUES ('TEST', datetime('now'), datetime('now'), ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          'N', 'E', 'S', 'W')`,
      ).run(
        opts.winnerTeam ?? 'NS',
        opts.finalScoreNS ?? 1000,
        opts.finalScoreEW ?? 500,
        opts.targetScore ?? 1000,
        opts.rounds.length,
        finalSeats.north ?? null,
        finalSeats.east ?? null,
        finalSeats.south ?? null,
        finalSeats.west ?? null,
      );
      const gameId = Number(result.lastInsertRowid);

      for (const r of opts.rounds) {
        client.prepare(
          `INSERT INTO game_rounds (game_id, round_number, card_points_ns, card_points_ew,
            tichu_bonus_ns, tichu_bonus_ew, one_two_bonus, total_ns, total_ew,
            finish_order, tichu_calls, score_ns_at_start, score_ew_at_start)
          VALUES (?, ?, 0, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          gameId,
          r.roundNumber,
          r.oneTwoBonus ?? null,
          r.totalNS,
          r.totalEW,
          r.finishOrder ?? '["north","east","south","west"]',
          r.tichuCalls ?? '{}',
          r.scoreNsAtStart ?? 0,
          r.scoreEwAtStart ?? 0,
        );

        for (const seat of ['north', 'east', 'south', 'west'] as const) {
          const uid = r.seats[seat] ?? null;
          client.prepare(
            `INSERT INTO player_rounds (game_id, round_number, seat, user_id,
              first_8_cards, full_hand_pre_pass, hand_after_pass,
              grand_tichu_call, tichu_call, tichu_call_success, finish_position)
            VALUES (?, ?, ?, ?, NULL, NULL, NULL, 0, 0, NULL, ?)`,
          ).run(
            gameId, r.roundNumber, seat, uid,
            seat === 'north' ? 1 : seat === 'east' ? 2 : seat === 'south' ? 3 : 4,
          );
        }
      }
      return gameId;
    }

    beforeEach(() => {
      insertUser(database, 'userA', 'A');
      insertUser(database, 'userB', 'B');
    });

    // Verifies: REQ-F-SA01, SA02, SA03, SA12, SA13, SA15 (winning team, shared seat)
    it('SA01/SA02/SA12/SA13/SA15: A plays rounds 1-4, B plays 5-8 at same seat, NS wins', () => {
      const rounds = Array.from({ length: 8 }, (_, i) => ({
        roundNumber: i + 1,
        oneTwoBonus: null,
        totalNS: 125,
        totalEW: 0,
        scoreNsAtStart: i * 125,
        scoreEwAtStart: 0,
        seats: {
          north: i < 4 ? 'userA' : 'userB',
          east: null, south: null, west: null,
        },
      }));
      insertMultiRoundGame({
        winnerTeam: 'NS',
        finalScoreNS: 1000, finalScoreEW: 0,
        targetScore: 1000,
        rounds,
      });

      rebuildStatsCache(database);

      const rowA = getCacheRow(database, 'userA');
      const rowB = getCacheRow(database, 'userB');

      // A: played but was replaced → forfeited, no win credit, no win diff
      expect(rowA).toBeDefined();
      expect(rowA!.games_played).toBe(1);
      expect(rowA!.games_won).toBe(0);
      expect(rowA!.games_forfeited).toBe(1);
      expect(rowA!.largest_win_diff).toBe(0);
      expect(rowA!.games_joined_after_spectating).toBe(0);

      // B: final occupant on winning team with min round > 1 → win + joined-after-spectating
      expect(rowB).toBeDefined();
      expect(rowB!.games_played).toBe(1);
      expect(rowB!.games_won).toBe(1);
      expect(rowB!.games_forfeited).toBe(0);
      expect(rowB!.largest_win_diff).toBe(1000);
      expect(rowB!.games_joined_after_spectating).toBe(1);

      // SA15: disjoint counters
      expect(rowA!.games_won + rowA!.games_forfeited).toBe(1);
      expect(rowB!.games_won + rowB!.games_forfeited).toBe(1);
    });

    // Verifies: REQ-F-SA03, SA12 (losing team, shared seat)
    it('SA03/SA12: shared seat on losing team — A forfeits, B absorbs loss', () => {
      const rounds = Array.from({ length: 8 }, (_, i) => ({
        roundNumber: i + 1,
        totalNS: 0,
        totalEW: 125,
        scoreNsAtStart: 0,
        scoreEwAtStart: i * 125,
        seats: {
          north: i < 4 ? 'userA' : 'userB',
          east: null, south: null, west: null,
        },
      }));
      insertMultiRoundGame({
        winnerTeam: 'EW',
        finalScoreNS: 100, finalScoreEW: 1000,
        rounds,
      });

      rebuildStatsCache(database);

      const rowA = getCacheRow(database, 'userA');
      const rowB = getCacheRow(database, 'userB');

      // A: forfeits, no loss diff credit (gated on final occupancy)
      expect(rowA!.games_forfeited).toBe(1);
      expect(rowA!.largest_loss_diff).toBe(0);
      expect(rowA!.games_won).toBe(0);

      // B: final occupant on losing team → loss diff credited
      expect(rowB!.games_forfeited).toBe(0);
      expect(rowB!.largest_loss_diff).toBe(900);
      expect(rowB!.games_won).toBe(0);
    });

    // Verifies: REQ-F-SA01, SA12 (bot replaces human)
    it('SA01/SA12: bot replaces A mid-game — A forfeits, no attribution to bot', () => {
      const rounds = Array.from({ length: 8 }, (_, i) => ({
        roundNumber: i + 1,
        totalNS: 100, totalEW: 0,
        scoreNsAtStart: i * 100,
        scoreEwAtStart: 0,
        seats: {
          north: i < 3 ? 'userA' : null, // bot from round 4 onward
          east: null, south: null, west: null,
        },
      }));
      insertMultiRoundGame({
        winnerTeam: 'NS',
        finalScoreNS: 800, finalScoreEW: 0,
        rounds,
      });

      rebuildStatsCache(database);

      const rowA = getCacheRow(database, 'userA');
      expect(rowA!.games_played).toBe(1);
      expect(rowA!.games_won).toBe(0);
      expect(rowA!.games_forfeited).toBe(1);
    });

    // Verifies: REQ-F-SA09 — oneTwoWins only counts rounds user played
    it('SA09: late joiner does not get credit for 1-2 finish in unplayed round', () => {
      const rounds = Array.from({ length: 8 }, (_, i) => ({
        roundNumber: i + 1,
        oneTwoBonus: i === 1 ? ('NS' as const) : null, // 1-2 finish in round 2 only
        totalNS: 125, totalEW: 0,
        scoreNsAtStart: i * 125,
        scoreEwAtStart: 0,
        seats: {
          north: i < 4 ? 'userA' : 'userB', // B joins at round 5
          east: null, south: null, west: null,
        },
      }));
      insertMultiRoundGame({
        winnerTeam: 'NS',
        finalScoreNS: 1000, finalScoreEW: 0,
        rounds,
      });

      rebuildStatsCache(database);

      const rowA = getCacheRow(database, 'userA');
      const rowB = getCacheRow(database, 'userB');

      // A played round 2 → credited for the 1-2 win.
      expect(rowA!.one_two_wins).toBe(1);
      // B joined at round 5 → no credit for round-2 1-2 win.
      expect(rowB!.one_two_wins).toBe(0);
    });

    // Verifies: REQ-F-SA10 — tie-break counters gated on participation in tie-break rounds
    it('SA10: user did not play any tie-break round → no tie-break credit', () => {
      // 8 regular rounds where NS and EW both cross the 1000 threshold at round 8,
      // then 2 tie-break rounds (9 and 10) that B plays but A does not.
      const rounds = [
        ...Array.from({ length: 8 }, (_, i) => ({
          roundNumber: i + 1,
          totalNS: 125, totalEW: 125, // both teams gain 125 per round
          scoreNsAtStart: i * 125,
          scoreEwAtStart: i * 125,
          seats: {
            north: 'userA', east: null, south: null, west: null,
          } as SeatMap,
        })),
        ...Array.from({ length: 2 }, (_, i) => ({
          roundNumber: i + 9,
          totalNS: 100, totalEW: 0,
          scoreNsAtStart: 1000 + i * 100,
          scoreEwAtStart: 1000,
          seats: {
            north: 'userB', east: null, south: null, west: null,
          } as SeatMap,
        })),
      ];
      insertMultiRoundGame({
        winnerTeam: 'NS',
        finalScoreNS: 1200, finalScoreEW: 1000,
        targetScore: 1000,
        rounds,
      });

      rebuildStatsCache(database);

      const rowA = getCacheRow(database, 'userA');
      const rowB = getCacheRow(database, 'userB');

      // A left before tie-break → no credit
      expect(rowA!.games_requiring_tie_break).toBe(0);
      expect(rowA!.most_tie_break_rounds_needed).toBe(0);
      // B played tie-break rounds → credit
      expect(rowB!.games_requiring_tie_break).toBe(1);
      expect(rowB!.most_tie_break_rounds_needed).toBe(2);
    });

    // Verifies: REQ-F-SA03 (regression) + NF-SA03 (clean-game behavior unchanged)
    it('SA03 regression: clean game with no swaps — final occupant gets all credit', () => {
      const rounds = Array.from({ length: 3 }, (_, i) => ({
        roundNumber: i + 1,
        totalNS: 200, totalEW: 100,
        scoreNsAtStart: i * 200,
        scoreEwAtStart: i * 100,
        seats: {
          north: 'userA', east: 'userB', south: null, west: null,
        } as SeatMap,
      }));
      insertMultiRoundGame({
        winnerTeam: 'NS',
        finalScoreNS: 600, finalScoreEW: 300,
        rounds,
      });

      rebuildStatsCache(database);

      const rowA = getCacheRow(database, 'userA');
      expect(rowA!.games_played).toBe(1);
      expect(rowA!.games_won).toBe(1);
      expect(rowA!.games_forfeited).toBe(0);
      expect(rowA!.largest_win_diff).toBe(300);
      expect(rowA!.games_joined_after_spectating).toBe(0); // min round == 1
    });

    // Verifies: REQ-F-SA15 — gamesWon and gamesForfeited are disjoint across
    // a parametric sweep of mid-game and clean-game fixtures.
    it('SA15 property sweep: gamesWon and gamesForfeited never both increment', () => {
      const fixtures: Array<{ winner: 'NS' | 'EW'; firstUser: string; swapUser: string | null; swapRound: number }> = [
        { winner: 'NS', firstUser: 'userA', swapUser: 'userB', swapRound: 5 },
        { winner: 'EW', firstUser: 'userA', swapUser: 'userB', swapRound: 5 },
        { winner: 'NS', firstUser: 'userA', swapUser: null, swapRound: 4 },
        { winner: 'NS', firstUser: 'userA', swapUser: null, swapRound: 99 }, // no swap
      ];
      for (const f of fixtures) {
        const rounds = Array.from({ length: 6 }, (_, i) => ({
          roundNumber: i + 1,
          totalNS: 100, totalEW: 100,
          scoreNsAtStart: i * 100,
          scoreEwAtStart: i * 100,
          seats: {
            north: i < f.swapRound - 1 ? f.firstUser : f.swapUser,
            east: null, south: null, west: null,
          } as SeatMap,
        }));
        insertMultiRoundGame({
          winnerTeam: f.winner,
          finalScoreNS: f.winner === 'NS' ? 1000 : 500,
          finalScoreEW: f.winner === 'EW' ? 1000 : 500,
          rounds,
        });
      }
      rebuildStatsCache(database);

      for (const userId of ['userA', 'userB']) {
        const row = getCacheRow(database, userId);
        if (!row) continue;
        // SA15: disjoint subsets of gamesPlayed
        expect(row.games_won + row.games_forfeited).toBeLessThanOrEqual(row.games_played);
      }
    });

    // Verifies: REQ-F-SA04, SA05, SA06, SA07, SA08 — tuple-filtered attribution
    // across plays, bomb_inventory, tricks, dragon_gift_events, dog_play_events
    // when two users share the same seat across rounds of one game.
    it('SA04-SA08: per-event stats attributed by (game, round, seat) tuple, not final occupant', () => {
      const rounds = [
        // Round 1: A at north (score_ns_at_start=0)
        { roundNumber: 1, totalNS: 100, totalEW: 100, scoreNsAtStart: 0, scoreEwAtStart: 0,
          seats: { north: 'userA', east: null, south: null, west: null } as SeatMap },
        // Round 2: A at north
        { roundNumber: 2, totalNS: 100, totalEW: 100, scoreNsAtStart: 100, scoreEwAtStart: 100,
          seats: { north: 'userA', east: null, south: null, west: null } as SeatMap },
        // Round 3: B takes over north
        { roundNumber: 3, totalNS: 100, totalEW: 100, scoreNsAtStart: 200, scoreEwAtStart: 200,
          seats: { north: 'userB', east: null, south: null, west: null } as SeatMap },
        // Round 4: B at north
        { roundNumber: 4, totalNS: 700, totalEW: 700, scoreNsAtStart: 300, scoreEwAtStart: 300,
          seats: { north: 'userB', east: null, south: null, west: null } as SeatMap },
      ];
      const gameId = insertMultiRoundGame({
        winnerTeam: 'NS', finalScoreNS: 1000, finalScoreEW: 1000, rounds,
      });

      const { client } = database;

      // ── plays: A's phoenix-as-Single in round 1 ──
      client.prepare(
        `INSERT INTO plays (game_id, round_number, trick_number, sequence_number, seat,
          action_type, cards, combination_type, combination_length, phoenix_used_as, is_bomb,
          partner_tichu_active)
        VALUES (?, 1, 1, 1, 'north', 'play', '[54]', 'Single', 1, 14, 0, 0)`,
      ).run(gameId);

      // ── plays: A's bomb in round 1 (4-card), forced by wish ──
      client.prepare(
        `INSERT INTO plays (game_id, round_number, trick_number, sequence_number, seat,
          action_type, cards, combination_type, combination_length, is_bomb, play_forced_by_wish)
        VALUES (?, 1, 2, 1, 'north', 'bomb', '[1,14,27,40]', 'Bomb', 4, 1, 1)`,
      ).run(gameId);

      // ── plays: B leads round 3 trick 1 with partner_tichu_active ──
      client.prepare(
        `INSERT INTO plays (game_id, round_number, trick_number, sequence_number, seat,
          action_type, cards, combination_type, combination_length, partner_tichu_active)
        VALUES (?, 3, 1, 1, 'north', 'play', '[15]', 'Single', 1, 1)`,
      ).run(gameId);

      // ── bomb_inventory: A's 4-card bomb in round 1, acquired first8, played ──
      client.prepare(
        `INSERT INTO bomb_inventory (game_id, round_number, player_seat, bomb_type, cards,
          rank, size, acquired_phase, fate, was_overbomb)
        VALUES (?, 1, 'north', 'FourOfAKind', '[1,14,27,40]', 2, 4, 'first8', 'played', 0)`,
      ).run(gameId);

      // ── bomb_inventory: B's 5-card bomb in round 4, played (post-pass), was_overbomb ──
      client.prepare(
        `INSERT INTO bomb_inventory (game_id, round_number, player_seat, bomb_type, cards,
          rank, size, acquired_phase, fate, was_overbomb)
        VALUES (?, 4, 'north', 'StraightFlush', '[2,3,4,5,6]', 2, 5, 'after_pass', 'played', 1)`,
      ).run(gameId);

      // ── tricks: round 1 trick 3 has dragon, won by north (A) ──
      client.prepare(
        `INSERT INTO tricks (game_id, round_number, trick_number, lead_seat, winner_seat,
          point_value, contains_dragon)
        VALUES (?, 1, 3, 'north', 'north', 25, 1)`,
      ).run(gameId);

      // ── tricks: round 3 trick 2 has dragon, won by north (B) ──
      client.prepare(
        `INSERT INTO tricks (game_id, round_number, trick_number, lead_seat, winner_seat,
          point_value, contains_dragon)
        VALUES (?, 3, 2, 'north', 'north', 25, 1)`,
      ).run(gameId);

      // ── dragon_gift_events: east gifts dragon to north in round 2 (to A) ──
      client.prepare(
        `INSERT INTO dragon_gift_events (game_id, round_number, trick_number, gifter_seat,
          recipient_seat, trick_point_value, recipient_cards_left, other_opponent_cards_left)
        VALUES (?, 2, 1, 'east', 'north', 25, 10, 10)`,
      ).run(gameId);

      // ── dog_play_events: B plays dog in round 3, control to partner (south) ──
      client.prepare(
        `INSERT INTO dog_play_events (game_id, round_number, trick_number, player_seat,
          control_passed_to, partner_has_tichu, dog_was_last_card)
        VALUES (?, 3, 3, 'north', 'south', 0, 0)`,
      ).run(gameId);

      rebuildStatsCache(database);

      const rowA = getCacheRow(database, 'userA')!;
      const rowB = getCacheRow(database, 'userB')!;

      // REQ-F-SA04 (plays): phoenix-as-Single belongs to A, not B
      expect(rowA.phoenix_used_as_single).toBe(1);
      expect(rowB.phoenix_used_as_single).toBe(0);

      // REQ-F-SA04 (plays): bomb_forced_by_wish in round 1 → A only
      expect(rowA.bomb_forced_by_wish).toBe(1);
      expect(rowB.bomb_forced_by_wish).toBe(0);

      // REQ-F-SA04 (plays): partner_tichu_active lead in round 3 → B only
      expect(rowA.dog_opportunities_for_tichu_partner).toBe(0);
      expect(rowB.dog_opportunities_for_tichu_partner).toBe(1);

      // REQ-F-SA05 (bomb_inventory): A's 4-card, B's 5-card — disjoint
      expect(rowA.total_bombs).toBe(1);
      expect(rowA.four_card_bombs).toBe(1);
      expect(rowA.bomb_size_4).toBe(1);
      expect(rowA.bombs_in_first_8).toBe(1);
      expect(rowB.total_bombs).toBe(1);
      expect(rowB.five_card_bombs).toBe(1);
      expect(rowB.bomb_size_5).toBe(1);
      expect(rowB.you_over_bombed).toBe(1);
      expect(rowA.you_over_bombed).toBe(0);

      // REQ-F-SA06 (tricks): A's dragon trick win in round 1, B's in round 3 — disjoint
      expect(rowA.dragon_trick_wins).toBe(1);
      expect(rowB.dragon_trick_wins).toBe(1);

      // REQ-F-SA08 (dragon_gift_events): A is recipient in round 2 from opponent
      expect(rowA.dragon_given_after_opponent_win).toBe(1);
      expect(rowB.dragon_given_after_opponent_win).toBe(0);

      // REQ-F-SA07 (dog_play_events): B plays dog in round 3, control to partner
      expect(rowA.dog_control_to_partner).toBe(0);
      expect(rowB.dog_control_to_partner).toBe(1);
    });
  });
});
