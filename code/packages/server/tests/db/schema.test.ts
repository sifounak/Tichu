// Verifies: REQ-F-AU01, REQ-F-AU02, REQ-F-AU03, REQ-F-AU04

import { describe, it, expect } from 'vitest';
import { users, games, gameRounds, statsCache, relationalStatsCache } from '../../src/db/schema.js';
import { getTableName } from 'drizzle-orm';

describe('database schema', () => {
  describe('users table', () => {
    it('should have correct table name', () => {
      expect(getTableName(users)).toBe('users');
    });

    it('should have all required columns', () => {
      const columns = Object.keys(users);
      expect(columns).toContain('id');
      expect(columns).toContain('displayName');
      expect(columns).toContain('email');
      expect(columns).toContain('passwordHash');
      expect(columns).toContain('isGuest');
      expect(columns).toContain('createdAt');
      expect(columns).toContain('lastSeenAt');
    });
  });

  describe('games table', () => {
    it('should have correct table name', () => {
      expect(getTableName(games)).toBe('games');
    });

    it('should have all required columns', () => {
      const columns = Object.keys(games);
      expect(columns).toContain('id');
      expect(columns).toContain('roomCode');
      expect(columns).toContain('startedAt');
      expect(columns).toContain('endedAt');
      expect(columns).toContain('winnerTeam');
      expect(columns).toContain('finalScoreNS');
      expect(columns).toContain('finalScoreEW');
      expect(columns).toContain('targetScore');
      expect(columns).toContain('roundCount');
      expect(columns).toContain('northUserId');
      expect(columns).toContain('eastUserId');
      expect(columns).toContain('southUserId');
      expect(columns).toContain('westUserId');
      expect(columns).toContain('northName');
      expect(columns).toContain('eastName');
      expect(columns).toContain('southName');
      expect(columns).toContain('westName');
    });
  });

  describe('gameRounds table', () => {
    it('should have correct table name', () => {
      expect(getTableName(gameRounds)).toBe('game_rounds');
    });

    it('should have all required columns', () => {
      const columns = Object.keys(gameRounds);
      expect(columns).toContain('id');
      expect(columns).toContain('gameId');
      expect(columns).toContain('roundNumber');
      expect(columns).toContain('cardPointsNS');
      expect(columns).toContain('cardPointsEW');
      expect(columns).toContain('tichuBonusNS');
      expect(columns).toContain('tichuBonusEW');
      expect(columns).toContain('oneTwoBonus');
      expect(columns).toContain('totalNS');
      expect(columns).toContain('totalEW');
      expect(columns).toContain('finishOrder');
      expect(columns).toContain('tichuCalls');
    });
  });

  // REQ-F-MC01: Stats cache table (replaces old player_stats)
  describe('statsCache table', () => {
    it('should have correct table name', () => {
      expect(getTableName(statsCache)).toBe('stats_cache');
    });

    it('should have core stat columns', () => {
      const columns = Object.keys(statsCache);
      expect(columns).toContain('userId');
      expect(columns).toContain('gamesPlayed');
      expect(columns).toContain('gamesWon');
      expect(columns).toContain('winRate');
      expect(columns).toContain('tichuCalls');
      expect(columns).toContain('totalRoundsPlayed');
      expect(columns).toContain('firstFinishes');
      expect(columns).toContain('roundsWithDragon');
      expect(columns).toContain('handsWithBombs');
    });
  });

  // REQ-F-MC01: Relational stats cache (replaces old player_relational_stats)
  describe('relationalStatsCache table', () => {
    it('should have correct table name', () => {
      expect(getTableName(relationalStatsCache)).toBe('relational_stats_cache');
    });

    it('should have all required columns', () => {
      const columns = Object.keys(relationalStatsCache);
      expect(columns).toContain('id');
      expect(columns).toContain('userId');
      expect(columns).toContain('otherUserId');
      expect(columns).toContain('relationship');
      expect(columns).toContain('gamesPlayed');
      expect(columns).toContain('gamesWon');
      expect(columns).toContain('oneTwoWins');
      expect(columns).toContain('totalTeamBombs');
    });
  });
});
