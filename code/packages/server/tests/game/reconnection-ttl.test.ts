import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameStore } from '../../src/game/game-store.js';
import type { GameManager } from '../../src/game/game-manager.js';
import type { Broadcaster } from '../../src/ws/broadcaster.js';

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

describe('GameStore restoreGame', () => {
  let store: GameStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new GameStore(createMockBroadcaster());
  });

  afterEach(() => {
    store.dispose();
    vi.useRealTimers();
  });

  it('registers a restored game', () => {
    const mockManager = {
      gameId: 'game-1',
      roomCode: 'ROOM1',
      destroy: vi.fn(),
    } as unknown as GameManager;

    store.restoreGame(mockManager);
    expect(store.getGame('game-1')).toBe(mockManager);
    expect(store.getGameByRoom('ROOM1')).toBe(mockManager);
  });

  it('destroys game after TTL expires with no reconnection', () => {
    const mockManager = {
      gameId: 'game-1',
      roomCode: 'ROOM1',
      destroy: vi.fn(),
    } as unknown as GameManager;

    store.restoreGame(mockManager, { ttlMs: 5 * 60 * 1000 });
    expect(store.getGame('game-1')).toBeDefined();

    vi.advanceTimersByTime(5 * 60 * 1000 + 100);
    expect(store.getGame('game-1')).toBeUndefined();
    expect(mockManager.destroy).toHaveBeenCalled();
  });

  it('cancels TTL when cancelReconnectionTTL is called', () => {
    const mockManager = {
      gameId: 'game-1',
      roomCode: 'ROOM1',
      destroy: vi.fn(),
    } as unknown as GameManager;

    store.restoreGame(mockManager, { ttlMs: 5 * 60 * 1000 });
    store.cancelReconnectionTTL('game-1');

    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(store.getGame('game-1')).toBeDefined();
    expect(mockManager.destroy).not.toHaveBeenCalled();
  });
});
