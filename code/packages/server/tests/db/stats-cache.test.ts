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
});
