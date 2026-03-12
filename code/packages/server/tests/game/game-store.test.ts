// Verifies: REQ-F-MP01

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameStore } from '../../src/game/game-store.js';
import type { Broadcaster } from '../../src/ws/broadcaster.js';

// ─── Mock Broadcaster ───────────────────────────────────────────────────────

function createMockBroadcaster(): Broadcaster {
  return {
    send: vi.fn().mockReturnValue(true),
    sendToPlayer: vi.fn().mockReturnValue(true),
    broadcastToRoom: vi.fn().mockReturnValue(3),
    broadcastGameState: vi.fn().mockReturnValue(4),
    broadcastToSpectators: vi.fn().mockReturnValue(0),
    sendError: vi.fn().mockReturnValue(true),
  } as unknown as Broadcaster;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GameStore', () => {
  let store: GameStore;
  let broadcaster: Broadcaster;

  beforeEach(() => {
    broadcaster = createMockBroadcaster();
    store = new GameStore(broadcaster);
  });

  describe('createGame', () => {
    it('should create a new game with a unique ID', () => {
      const game = store.createGame('ROOM1');
      expect(game).toBeDefined();
      expect(game.gameId).toMatch(/^game_/);
      expect(game.roomCode).toBe('ROOM1');
    });

    it('should return existing game for same room', () => {
      const game1 = store.createGame('ROOM1');
      const game2 = store.createGame('ROOM1');
      expect(game1).toBe(game2);
    });

    it('should create different games for different rooms', () => {
      const game1 = store.createGame('ROOM1');
      const game2 = store.createGame('ROOM2');
      expect(game1.gameId).not.toBe(game2.gameId);
    });

    it('should accept custom config', () => {
      const game = store.createGame('ROOM1', { targetScore: 500 });
      expect(game.context.config.targetScore).toBe(500);
    });
  });

  describe('getGame', () => {
    it('should find game by ID', () => {
      const game = store.createGame('ROOM1');
      expect(store.getGame(game.gameId)).toBe(game);
    });

    it('should return undefined for unknown ID', () => {
      expect(store.getGame('nonexistent')).toBeUndefined();
    });
  });

  describe('getGameByRoom', () => {
    it('should find game by room code', () => {
      const game = store.createGame('ROOM1');
      expect(store.getGameByRoom('ROOM1')).toBe(game);
    });

    it('should return undefined for unknown room', () => {
      expect(store.getGameByRoom('UNKNOWN')).toBeUndefined();
    });
  });

  describe('destroyGame', () => {
    it('should remove game by ID', () => {
      const game = store.createGame('ROOM1');
      const result = store.destroyGame(game.gameId);
      expect(result).toBe(true);
      expect(store.getGame(game.gameId)).toBeUndefined();
      expect(store.getGameByRoom('ROOM1')).toBeUndefined();
    });

    it('should return false for unknown game', () => {
      expect(store.destroyGame('nonexistent')).toBe(false);
    });
  });

  describe('destroyGameByRoom', () => {
    it('should remove game by room code', () => {
      store.createGame('ROOM1');
      const result = store.destroyGameByRoom('ROOM1');
      expect(result).toBe(true);
      expect(store.getGameByRoom('ROOM1')).toBeUndefined();
    });

    it('should return false for unknown room', () => {
      expect(store.destroyGameByRoom('UNKNOWN')).toBe(false);
    });
  });

  describe('multiple concurrent games', () => {
    it('should maintain isolated state', () => {
      const game1 = store.createGame('ROOM1');
      const game2 = store.createGame('ROOM2');

      game1.seatPlayer('north');
      expect(game1.context.seats.north).toBe(true);
      expect(game2.context.seats.north).toBe(false);
    });

    it('should track active game count', () => {
      store.createGame('ROOM1');
      store.createGame('ROOM2');
      store.createGame('ROOM3');
      expect(store.size).toBe(3);
    });

    it('should list active game IDs', () => {
      const g1 = store.createGame('ROOM1');
      const g2 = store.createGame('ROOM2');
      expect(store.activeGameIds).toContain(g1.gameId);
      expect(store.activeGameIds).toContain(g2.gameId);
    });
  });

  describe('dispose', () => {
    it('should clean up all games', () => {
      store.createGame('ROOM1');
      store.createGame('ROOM2');
      store.dispose();
      expect(store.size).toBe(0);
    });
  });
});
