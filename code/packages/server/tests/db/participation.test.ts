// Verifies: REQ-F-PS04–PS06 with a real database and HTTP routes.
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { classifyParticipation, parseParticipation } from '@tichu/shared';
import { createDatabase, type Database } from '../../src/db/connection.js';
import { getParticipationMetadata, saveParticipation, inferLegacyParticipation } from '../../src/db/participation.js';
import { getPlayerProfile, getLeaderboard } from '../../src/db/queries.js';
import { rebuildStatsCache, refreshPlayerStatsCacheIfStale, updateCacheAfterGame } from '../../src/db/stats-cache.js';
import { completeGameProgress, getPlayerGameHistory } from '../../src/db/game-persistence.js';
import { registerAuthRoutes } from '../../src/auth/auth-routes.js';

describe('Participation', () => {
  let database: Database;
  beforeEach(() => {
    database = createDatabase(':memory:');
    database.client.exec(`INSERT INTO users (id, display_name) VALUES ('a','A'),('b','B'),('c','C'),('d','D'),('e','E');`);
  });
  afterEach(() => database.close());

  function seed(humanCount: number, exact = true, status = 'completed') {
    const humans = ['a', 'b', 'c', 'd'].slice(0, humanCount);
    const ids = ['north', 'east', 'south', 'west'].map((_, index) => humans[index] ?? null);
    const gameId = Number(database.client.prepare(`INSERT INTO games (room_code,status,winner_team,final_score_ns,final_score_ew,
      round_count,north_user_id,east_user_id,south_user_id,west_user_id,north_name,east_name,south_name,west_name)
      VALUES ('TEST',?,'NS',1000,500,1,?,?,?,?,'N','E','S','W')`).run(status, ...ids).lastInsertRowid);
    for (const [index, seat] of ['north', 'east', 'south', 'west'].entries()) {
      database.client.prepare(`INSERT INTO player_rounds (game_id,round_number,seat,user_id)
        VALUES (?,1,?,?)`).run(gameId, seat, ids[index]);
    }
    if (exact) saveParticipation(database, gameId, { humanUserIds: humans, hadBot: humanCount < 4, inferred: false });
    return gameId;
  }

  it('classifies human-only, mixed and solo independently of human identity count duplicates', () => {
    expect(classifyParticipation({ humanUserIds: ['a', 'a'], hadBot: true, inferred: false })).toBe('solo');
    expect(classifyParticipation({ humanUserIds: ['a', 'b'], hadBot: true, inferred: false })).toBe('mixed');
    expect(classifyParticipation({ humanUserIds: ['a', 'b', 'c', 'd'], hadBot: false, inferred: false })).toBe('human-only');
    expect(parseParticipation(undefined)).toBe('all');
    expect(parseParticipation('garbage')).toBeUndefined();
  });

  it('filters profile cache, history before pagination, and leaderboard before eligibility', async () => {
    const humanId = seed(4);
    seed(2);
    seed(1);
    rebuildStatsCache(database);
    for (const view of ['human-only', 'mixed', 'solo'] as const) {
      expect(getPlayerProfile(database, 'a', view)?.gamesPlayed).toBe(1);
      expect(getPlayerProfile(database, 'a', view)?.totalRoundsPlayed).toBe(1);
    }
    expect(getPlayerProfile(database, 'a')?.gamesPlayed).toBe(3);
    expect((await getPlayerGameHistory(database, 'a', 1, 0, 'human-only')).map(game => game.id)).toEqual([humanId]);
    expect(await getPlayerGameHistory(database, 'a', 1, 1, 'human-only')).toEqual([]);
    expect(getLeaderboard(database, 20, 2, 'human-only')).toEqual([]);
    expect(getLeaderboard(database, 20, 2, 'all').map(row => row.userId)).toEqual(['a', 'b']);
  });

  it('keeps a brief bot replacement sticky and invalidates already cached human-only rounds', () => {
    const gameId = seed(4, true, 'in_progress');
    rebuildStatsCache(database);
    expect(getPlayerProfile(database, 'a', 'human-only')?.totalRoundsPlayed).toBe(1);
    saveParticipation(database, gameId, { humanUserIds: ['a','b','c','d'], hadBot: true, inferred: false });
    saveParticipation(database, gameId, { humanUserIds: ['a','b','c','d'], hadBot: false, inferred: false });
    expect(refreshPlayerStatsCacheIfStale(database, 'a')).toBe(true);
    expect(getPlayerProfile(database, 'a', 'human-only')?.totalRoundsPlayed).toBe(0);
    expect(getPlayerProfile(database, 'a', 'mixed')?.totalRoundsPlayed).toBe(1);
    expect(refreshPlayerStatsCacheIfStale(database, 'a')).toBe(false);
  });

  it('changes solo to mixed when a second distinct human joins and preserves previous identities', () => {
    const gameId = seed(1);
    saveParticipation(database, gameId, { humanUserIds: ['e'], hadBot: true, inferred: false });
    updateCacheAfterGame(database, gameId);
    expect(getPlayerProfile(database, 'a', 'solo')?.gamesPlayed).toBe(0);
    expect(getPlayerProfile(database, 'a', 'mixed')?.gamesPlayed).toBe(1);
    expect(getParticipationMetadata(database, 'mixed', 'a').inferredGames).toBe(0);
  });

  it('infers legacy games, labels their coverage, and does not reclassify recorded games', () => {
    const legacyId = seed(2, false);
    seed(4);
    inferLegacyParticipation(database);
    expect(database.client.prepare('SELECT participation,participation_inferred FROM games WHERE id=?').get(legacyId))
      .toEqual({ participation: 'mixed', participation_inferred: 1 });
    expect(getParticipationMetadata(database, 'all', 'a')).toEqual({ participation: 'all', totalGames: 2, inferredGames: 1 });
    expect(getParticipationMetadata(database, 'human-only', 'a').inferredGames).toBe(0);
  });

  it('refreshes stale calculation versions and additional rounds in the same unfinished game', () => {
    const gameId = seed(4, true, 'in_progress');
    rebuildStatsCache(database);
    database.client.exec("UPDATE stats_cache SET cache_version=0 WHERE user_id='a'");
    expect(refreshPlayerStatsCacheIfStale(database, 'a')).toBe(true);
    database.client.prepare("INSERT INTO player_rounds (game_id,round_number,seat,user_id) VALUES (?,2,'north','a')").run(gameId);
    expect(refreshPlayerStatsCacheIfStale(database, 'a')).toBe(true);
    expect(getPlayerProfile(database, 'a', 'human-only')).toMatchObject({ gamesPlayed: 0, totalRoundsPlayed: 2 });
    expect(refreshPlayerStatsCacheIfStale(database, 'a')).toBe(false);
  });

  it('refreshes completion even when raw and cache timestamps fall in the same second', () => {
    const gameId = seed(4, true, 'in_progress');
    rebuildStatsCache(database);
    completeGameProgress(database, gameId, {
      roomCode: 'TEST', startedAt: new Date(), winnerTeam: 'NS', finalScoreNS: 1000, finalScoreEW: 500,
      targetScore: 1000, roundCount: 1,
      players: { north: { userId: 'a', name: 'A' }, east: { userId: 'b', name: 'B' },
        south: { userId: 'c', name: 'C' }, west: { userId: 'd', name: 'D' } },
    }, []);
    database.client.prepare(`UPDATE games SET ended_at = (
      SELECT last_updated_at FROM stats_cache WHERE user_id='a' AND participation='all'
    ) WHERE id=?`).run(gameId);
    expect(refreshPlayerStatsCacheIfStale(database, 'a')).toBe(true);
    expect(getPlayerProfile(database, 'a', 'human-only')).toMatchObject({ gamesPlayed: 1, gamesWon: 1 });
  });

  it('exposes the filter and provenance through each HTTP surface and rejects invalid views', async () => {
    seed(4);
    seed(1, false);
    const app = Fastify();
    registerAuthRoutes(app, database, 'test');
    try {
      for (const endpoint of ['/api/players/a/profile', '/api/players/a/relationships', '/api/players/a/games', '/api/leaderboard']) {
        const response = await app.inject(`${endpoint}?participation=human-only&minGames=1`);
        expect(response.statusCode).toBe(200);
        expect(response.json().metadata).toMatchObject({ participation: 'human-only', inferredGames: 0 });
        expect((await app.inject(`${endpoint}?participation=invalid`)).statusCode).toBe(400);
      }
      const defaultResponse = await app.inject('/api/players/a/profile');
      expect(defaultResponse.json()).toMatchObject({ profile: { gamesPlayed: 2 }, metadata: { participation: 'all', inferredGames: 1 } });
      expect((await app.inject('/api/players/missing/profile?participation=solo')).json().profile).toBeNull();
    } finally { await app.close(); }
  });
});
