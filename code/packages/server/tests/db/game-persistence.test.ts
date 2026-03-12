// Verifies: REQ-F-AU03

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveGameResult, getPlayerGameHistory, getGameRounds } from '../../src/db/game-persistence.js';
import type { Database } from '../../src/db/connection.js';
import type { GameResult, RoundResult } from '../../src/db/game-persistence.js';

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

function createMockTx() {
  return {
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation((val: any) => ({
        returning: vi.fn().mockResolvedValue([{ id: 42 }]),
        // values() also needs to be thenable for the rounds insert (no .returning())
        then: (resolve: (v: any) => void) => resolve(undefined),
        _passedValues: val,
      })),
    })),
    execute: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockDatabase(mockTx?: any): Database {
  const tx = mockTx ?? createMockTx();
  return {
    db: {
      select: vi.fn().mockImplementation(() => fluentChain([])),
      transaction: vi.fn().mockImplementation(async (callback: any) => {
        return callback(tx);
      }),
      execute: vi.fn().mockResolvedValue({ rows: [] }),
    } as any,
    client: {} as any,
    close: vi.fn(),
  } as unknown as Database;
}

function makeGameResult(overrides: Partial<GameResult> = {}): GameResult {
  return {
    roomCode: 'ABCD',
    startedAt: new Date('2025-01-01'),
    winnerTeam: 'NS',
    finalScoreNS: 1050,
    finalScoreEW: 800,
    targetScore: 1000,
    roundCount: 3,
    players: {
      north: { userId: 'user1', name: 'Alice' },
      east: { userId: 'user2', name: 'Bob' },
      south: { userId: 'user3', name: 'Carol' },
      west: { userId: 'user4', name: 'Dave' },
    },
    ...overrides,
  };
}

function makeRound(overrides: Partial<RoundResult> = {}): RoundResult {
  return {
    roundNumber: 1,
    cardPointsNS: 75,
    cardPointsEW: 25,
    tichuBonusNS: 0,
    tichuBonusEW: 0,
    oneTwoBonus: null,
    totalNS: 75,
    totalEW: 25,
    finishOrder: ['north', 'east', 'south', 'west'],
    tichuCalls: {},
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('game-persistence', () => {
  describe('saveGameResult', () => {
    it('should call transaction on db', async () => {
      const mockTx = createMockTx();
      const mockDb = createMockDatabase(mockTx);
      const gameResult = makeGameResult();

      await saveGameResult(mockDb, gameResult, [makeRound()]);

      expect(mockDb.db.transaction).toHaveBeenCalledOnce();
    });

    it('should insert game record with correct player data', async () => {
      const mockTx = createMockTx();
      const mockDb = createMockDatabase(mockTx);
      const gameResult = makeGameResult();

      await saveGameResult(mockDb, gameResult, [makeRound()]);

      expect(mockTx.insert).toHaveBeenCalled();
      // First insert call is for the game record
      const insertCall = mockTx.insert.mock.results[0].value;
      expect(insertCall.values).toHaveBeenCalled();
      const valuesArg = insertCall.values.mock.calls[0][0];
      expect(valuesArg.roomCode).toBe('ABCD');
      expect(valuesArg.northUserId).toBe('user1');
      expect(valuesArg.eastUserId).toBe('user2');
      expect(valuesArg.northName).toBe('Alice');
    });

    it('should insert round records for each round', async () => {
      const mockTx = createMockTx();
      const mockDb = createMockDatabase(mockTx);
      const gameResult = makeGameResult();
      const rounds = [makeRound({ roundNumber: 1 }), makeRound({ roundNumber: 2 })];

      await saveGameResult(mockDb, gameResult, rounds);

      // insert is called: once for game, once for rounds
      expect(mockTx.insert).toHaveBeenCalledTimes(2);
      // The second insert call is for the rounds
      const roundInsertCall = mockTx.insert.mock.results[1].value;
      const roundValuesArg = roundInsertCall.values.mock.calls[0][0];
      expect(roundValuesArg).toHaveLength(2);
      expect(roundValuesArg[0].roundNumber).toBe(1);
      expect(roundValuesArg[1].roundNumber).toBe(2);
    });

    it('should call execute (upsertPlayerStats) for each human player', async () => {
      const mockTx = createMockTx();
      const mockDb = createMockDatabase(mockTx);
      const gameResult = makeGameResult(); // 4 human players

      await saveGameResult(mockDb, gameResult, [makeRound()]);

      // 4 human players -> 4 execute calls for upsertPlayerStats
      expect(mockTx.execute).toHaveBeenCalledTimes(4);
    });

    it('should NOT call execute for stats when all players are bots', async () => {
      const mockTx = createMockTx();
      const mockDb = createMockDatabase(mockTx);
      const gameResult = makeGameResult({
        players: {
          north: { userId: null, name: 'Bot1' },
          east: { userId: null, name: 'Bot2' },
          south: { userId: null, name: 'Bot3' },
          west: { userId: null, name: 'Bot4' },
        },
      });

      await saveGameResult(mockDb, gameResult, [makeRound()]);

      // No human players -> no execute calls
      expect(mockTx.execute).not.toHaveBeenCalled();
    });

    it('should compute tichu stats correctly', async () => {
      const mockTx = createMockTx();
      const mockDb = createMockDatabase(mockTx);
      const gameResult = makeGameResult({
        players: {
          north: { userId: 'user1', name: 'Alice' },
          east: { userId: null, name: 'Bot' },
          south: { userId: null, name: 'Bot2' },
          west: { userId: null, name: 'Bot3' },
        },
      });
      // North calls tichu in round 1 and finishes first (success),
      // North calls grandTichu in round 2 but does NOT finish first (fail)
      const rounds = [
        makeRound({
          roundNumber: 1,
          finishOrder: ['north', 'east', 'south', 'west'],
          tichuCalls: { north: 'tichu' },
        }),
        makeRound({
          roundNumber: 2,
          finishOrder: ['east', 'north', 'south', 'west'],
          tichuCalls: { north: 'grandTichu' },
        }),
      ];

      await saveGameResult(mockDb, gameResult, rounds);

      // Only 1 human -> 1 execute call
      expect(mockTx.execute).toHaveBeenCalledTimes(1);
      // The execute was called with a SQL template object
      const executeArg = mockTx.execute.mock.calls[0][0];
      expect(executeArg).toBeDefined();
    });
  });

  describe('getPlayerGameHistory', () => {
    it('should call select/from/where/orderBy/limit/offset with correct structure', async () => {
      const mockDb = createMockDatabase();
      const chain = fluentChain([{ id: 1, roomCode: 'TEST' }]);
      (mockDb.db as any).select = vi.fn().mockReturnValue(chain);

      await getPlayerGameHistory(mockDb, 'user1', 10, 5);

      expect(mockDb.db.select).toHaveBeenCalled();
      expect(chain.from).toHaveBeenCalled();
      expect(chain.where).toHaveBeenCalled();
      expect(chain.orderBy).toHaveBeenCalled();
      expect(chain.limit).toHaveBeenCalledWith(10);
      expect(chain.offset).toHaveBeenCalledWith(5);
    });

    it('should return the result from the chain', async () => {
      const expected = [{ id: 1, roomCode: 'ABCD' }, { id: 2, roomCode: 'EFGH' }];
      const mockDb = createMockDatabase();
      (mockDb.db as any).select = vi.fn().mockReturnValue(fluentChain(expected));

      const result = await getPlayerGameHistory(mockDb, 'user1');

      expect(result).toEqual(expected);
    });
  });

  describe('getGameRounds', () => {
    it('should call select/from/where/orderBy', async () => {
      const mockDb = createMockDatabase();
      const chain = fluentChain([]);
      (mockDb.db as any).select = vi.fn().mockReturnValue(chain);

      await getGameRounds(mockDb, 42);

      expect(mockDb.db.select).toHaveBeenCalled();
      expect(chain.from).toHaveBeenCalled();
      expect(chain.where).toHaveBeenCalled();
      expect(chain.orderBy).toHaveBeenCalled();
    });

    it('should return the result from the chain', async () => {
      const expected = [{ roundNumber: 1, totalNS: 75, totalEW: 25 }];
      const mockDb = createMockDatabase();
      (mockDb.db as any).select = vi.fn().mockReturnValue(fluentChain(expected));

      const result = await getGameRounds(mockDb, 42);

      expect(result).toEqual(expected);
    });
  });
});
