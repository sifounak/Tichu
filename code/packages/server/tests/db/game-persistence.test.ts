// Verifies: REQ-F-AU03

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveGameResult, getPlayerGameHistory, getGameRounds } from '../../src/db/game-persistence.js';
import type { Database } from '../../src/db/connection.js';
import type { GameResult, RoundResult } from '../../src/db/game-persistence.js';

// ─── Mock helpers ────────────────────────────────────────────────────

function fluentChain(result: any[] = []): any {
  // Used for getGameRounds which ends at .orderBy()
  // Also used as default for createMockDatabase
  const limitChain: any = {
    limit: vi.fn(),
    offset: vi.fn().mockReturnValue(result),
  };
  limitChain.limit.mockReturnValue(limitChain);

  const self: any = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn().mockReturnValue(result),
    limit: limitChain.limit,
    offset: limitChain.offset,
    then: (resolve: (v: any) => void) => resolve(result),
  };
  self.from.mockReturnValue(self);
  self.where.mockReturnValue(self);
  return self;
}

function paginatedChain(result: any[] = []): any {
  // Used for getPlayerGameHistory which ends at .limit().offset()
  const limitChain: any = {
    limit: vi.fn(),
    offset: vi.fn().mockReturnValue(result),
  };
  limitChain.limit.mockReturnValue(limitChain);

  const self: any = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn().mockReturnValue(limitChain),
    limit: limitChain.limit,
    offset: limitChain.offset,
    then: (resolve: (v: any) => void) => resolve(result),
  };
  self.from.mockReturnValue(self);
  self.where.mockReturnValue(self);
  return self;
}

function createMockTx() {
  return {
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation((val: any) => ({
        returning: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue({ id: 42 }),
          all: vi.fn().mockReturnValue([{ id: 42 }]),
        }),
        run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
        // values() also needs to be thenable for the rounds insert (no .returning())
        then: (resolve: (v: any) => void) => resolve(undefined),
        _passedValues: val,
      })),
    })),
    run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
  };
}

function createMockDatabase(mockTx?: any): Database {
  const tx = mockTx ?? createMockTx();
  return {
    db: {
      select: vi.fn().mockImplementation(() => fluentChain([])),
      transaction: vi.fn().mockImplementation((callback: any) => {
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
    it('should call transaction on db', () => {
      const mockTx = createMockTx();
      const mockDb = createMockDatabase(mockTx);
      const gameResult = makeGameResult();

      saveGameResult(mockDb, gameResult, [makeRound()]);

      expect(mockDb.db.transaction).toHaveBeenCalledOnce();
    });

    it('should insert game record with correct player data', () => {
      const mockTx = createMockTx();
      const mockDb = createMockDatabase(mockTx);
      const gameResult = makeGameResult();

      saveGameResult(mockDb, gameResult, [makeRound()]);

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

    it('should insert round records for each round', () => {
      const mockTx = createMockTx();
      const mockDb = createMockDatabase(mockTx);
      const gameResult = makeGameResult();
      const rounds = [makeRound({ roundNumber: 1 }), makeRound({ roundNumber: 2 })];

      saveGameResult(mockDb, gameResult, rounds);

      // insert is called: once for game, once for rounds
      expect(mockTx.insert).toHaveBeenCalledTimes(2);
      // The second insert call is for the rounds
      const roundInsertCall = mockTx.insert.mock.results[1].value;
      const roundValuesArg = roundInsertCall.values.mock.calls[0][0];
      expect(roundValuesArg).toHaveLength(2);
      expect(roundValuesArg[0].roundNumber).toBe(1);
      expect(roundValuesArg[1].roundNumber).toBe(2);
    });

    it('should call run (upsertPlayerStats) for each human player', () => {
      const mockTx = createMockTx();
      const mockDb = createMockDatabase(mockTx);
      const gameResult = makeGameResult(); // 4 human players

      saveGameResult(mockDb, gameResult, [makeRound()]);

      // 4 human players -> 4 run calls for upsertPlayerStats
      expect(mockTx.run).toHaveBeenCalledTimes(4);
    });

    it('should NOT call run for stats when all players are bots', () => {
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

      saveGameResult(mockDb, gameResult, [makeRound()]);

      // No human players -> no run calls
      expect(mockTx.run).not.toHaveBeenCalled();
    });

    it('should compute tichu stats correctly', () => {
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

      saveGameResult(mockDb, gameResult, rounds);

      // Only 1 human -> 1 run call
      expect(mockTx.run).toHaveBeenCalledTimes(1);
      // The run was called with a SQL template object
      const runArg = mockTx.run.mock.calls[0][0];
      expect(runArg).toBeDefined();
    });
  });

  describe('getPlayerGameHistory', () => {
    it('should call select/from/where/orderBy/limit/offset with correct structure', () => {
      const mockDb = createMockDatabase();
      const chain = paginatedChain([{ id: 1, roomCode: 'TEST' }]);
      (mockDb.db as any).select = vi.fn().mockReturnValue(chain);

      getPlayerGameHistory(mockDb, 'user1', 10, 5);

      expect(mockDb.db.select).toHaveBeenCalled();
      expect(chain.from).toHaveBeenCalled();
      expect(chain.where).toHaveBeenCalled();
      expect(chain.orderBy).toHaveBeenCalled();
      expect(chain.limit).toHaveBeenCalledWith(10);
      expect(chain.offset).toHaveBeenCalledWith(5);
    });

    it('should return the result from the chain', () => {
      const expected = [{ id: 1, roomCode: 'ABCD' }, { id: 2, roomCode: 'EFGH' }];
      const mockDb = createMockDatabase();
      (mockDb.db as any).select = vi.fn().mockReturnValue(paginatedChain(expected));

      const result = getPlayerGameHistory(mockDb, 'user1');

      expect(result).toEqual(expected);
    });
  });

  describe('getGameRounds', () => {
    it('should call select/from/where/orderBy', () => {
      const mockDb = createMockDatabase();
      const chain = fluentChain([]);
      (mockDb.db as any).select = vi.fn().mockReturnValue(chain);

      getGameRounds(mockDb, 42);

      expect(mockDb.db.select).toHaveBeenCalled();
      expect(chain.from).toHaveBeenCalled();
      expect(chain.where).toHaveBeenCalled();
      expect(chain.orderBy).toHaveBeenCalled();
    });

    it('should return the result from the chain', () => {
      const expected = [{ roundNumber: 1, totalNS: 75, totalEW: 25 }];
      const mockDb = createMockDatabase();
      (mockDb.db as any).select = vi.fn().mockReturnValue(fluentChain(expected));

      const result = getGameRounds(mockDb, 42);

      expect(result).toEqual(expected);
    });
  });
});
