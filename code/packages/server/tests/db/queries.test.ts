// Verifies: REQ-F-AU04

import { describe, it, expect, vi } from 'vitest';
import { getLeaderboard, getRecentGames, getPlayerProfile } from '../../src/db/queries.js';
import type { Database } from '../../src/db/connection.js';

// ─── Mock helpers ────────────────────────────────────────────────────

function fluentChain(result: any[] = []): any {
  const self: any = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    then: (resolve: (v: any) => void) => resolve(result),
  };
  self.from.mockReturnValue(self);
  self.where.mockReturnValue(self);
  self.orderBy.mockReturnValue(self);
  self.limit.mockReturnValue(self);
  self.offset.mockReturnValue(self);
  return self;
}

function createMockDatabase(): Database {
  return {
    db: {
      select: vi.fn().mockImplementation(() => fluentChain([])),
      all: vi.fn().mockReturnValue([]),
    } as any,
    client: {} as any,
    close: vi.fn(),
  } as unknown as Database;
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('queries', () => {
  describe('getLeaderboard', () => {
    it('should call db.all with SQL and return typed results', () => {
      const entries = [
        { userId: 'u1', displayName: 'Alice', gamesPlayed: 10, gamesWon: 7, winRate: 0.7, tichuSuccessRate: 0.5, grandTichuSuccessRate: 0 },
      ];
      const mockDb = createMockDatabase();
      (mockDb.db as any).all = vi.fn().mockReturnValue(entries);

      const result = getLeaderboard(mockDb, 20, 5);

      expect(mockDb.db.all).toHaveBeenCalled();
      expect(result).toEqual(entries);
    });

    it('should return empty array when no rows', () => {
      const mockDb = createMockDatabase();
      (mockDb.db as any).all = vi.fn().mockReturnValue([]);

      const result = getLeaderboard(mockDb);

      expect(result).toEqual([]);
    });

    it('should return LeaderboardEntry array from rows', () => {
      const entries = [
        { userId: 'u1', displayName: 'Alice', gamesPlayed: 10, gamesWon: 7, winRate: 0.7, tichuSuccessRate: 0.5, grandTichuSuccessRate: 0.25 },
        { userId: 'u2', displayName: 'Bob', gamesPlayed: 8, gamesWon: 5, winRate: 0.625, tichuSuccessRate: 0.3, grandTichuSuccessRate: 0 },
      ];
      const mockDb = createMockDatabase();
      (mockDb.db as any).all = vi.fn().mockReturnValue(entries);

      const result = getLeaderboard(mockDb);

      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe('u1');
      expect(result[1].displayName).toBe('Bob');
    });
  });

  describe('getRecentGames', () => {
    it('should call select chain and return results', async () => {
      const gamesData = [{ id: 1, roomCode: 'ABCD', winnerTeam: 'NS' }];
      const mockDb = createMockDatabase();
      const chain = fluentChain(gamesData);
      (mockDb.db as any).select = vi.fn().mockReturnValue(chain);

      const result = getRecentGames(mockDb);

      expect(mockDb.db.select).toHaveBeenCalled();
      expect(chain.from).toHaveBeenCalled();
      expect(chain.orderBy).toHaveBeenCalled();
      expect(result).toEqual(chain);
    });

    it('should pass limit to the chain', async () => {
      const mockDb = createMockDatabase();
      const chain = fluentChain([]);
      (mockDb.db as any).select = vi.fn().mockReturnValue(chain);

      getRecentGames(mockDb, 5);

      expect(chain.limit).toHaveBeenCalledWith(5);
    });
  });

  describe('getPlayerProfile', () => {
    it('should return profile when rows exist', () => {
      const profile = {
        userId: 'u1', displayName: 'Alice', gamesPlayed: 10, gamesWon: 7,
        winRate: 0.7, tichuCalls: 5, tichuSuccesses: 3,
        grandTichuCalls: 2, grandTichuSuccesses: 1,
        totalRoundsPlayed: 30, firstFinishes: 8,
      };
      const mockDb = createMockDatabase();
      (mockDb.db as any).all = vi.fn().mockReturnValue([profile]);

      const result = getPlayerProfile(mockDb, 'u1');

      expect(result).toEqual(profile);
      expect(result!.userId).toBe('u1');
      expect(result!.displayName).toBe('Alice');
    });

    it('should return undefined when no rows', () => {
      const mockDb = createMockDatabase();
      (mockDb.db as any).all = vi.fn().mockReturnValue([]);

      const result = getPlayerProfile(mockDb, 'nonexistent');

      expect(result).toBeUndefined();
    });
  });
});
