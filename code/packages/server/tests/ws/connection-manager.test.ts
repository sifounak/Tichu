// Verifies: REQ-NF-A02 — Connection management layer

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectionManager } from '../../src/ws/connection-manager.js';
import type { ClientInfo } from '../../src/ws/connection-manager.js';
import type { WebSocket } from 'ws';

/** Create a mock WebSocket with the minimal interface needed */
function createMockWs(overrides: Partial<WebSocket> = {}): WebSocket {
  return {
    readyState: 1, // OPEN
    OPEN: 1,
    send: vi.fn(),
    ping: vi.fn(),
    terminate: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
    ...overrides,
  } as unknown as WebSocket;
}

describe('ConnectionManager', () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    manager = new ConnectionManager({ pingIntervalMs: 100, staleThresholdMs: 200 });
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('addClient / removeClient', () => {
    it('registers a client and tracks it by userId', () => {
      const ws = createMockWs();
      manager.addClient(ws, 'user-1', 'Alice');

      expect(manager.size).toBe(1);
      expect(manager.getClientInfo(ws)).toMatchObject({
        userId: 'user-1',
        playerName: 'Alice',
        roomCode: null,
        seat: null,
      });
      expect(manager.getSocketByUserId('user-1')).toBe(ws);
    });

    it('removes a client and cleans up indices', () => {
      const ws = createMockWs();
      manager.addClient(ws, 'user-1', 'Alice');

      const info = manager.removeClient(ws);
      expect(info).toMatchObject({ userId: 'user-1', playerName: 'Alice' });
      expect(manager.size).toBe(0);
      expect(manager.getSocketByUserId('user-1')).toBeUndefined();
    });

    it('returns undefined when removing an unknown WebSocket', () => {
      const ws = createMockWs();
      expect(manager.removeClient(ws)).toBeUndefined();
    });

    it('replaces existing socket when same userId connects again', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();

      manager.addClient(ws1, 'user-1', 'Alice');
      manager.addClient(ws2, 'user-1', 'Alice');

      expect(manager.size).toBe(1);
      expect(manager.getSocketByUserId('user-1')).toBe(ws2);
      expect(manager.getClientInfo(ws1)).toBeUndefined();
    });
  });

  describe('room assignment', () => {
    it('assigns and removes a client from a room', () => {
      const ws = createMockWs();
      manager.addClient(ws, 'user-1', 'Alice');

      manager.assignToRoom(ws, 'ABC123', 'north');
      expect(manager.getClientInfo(ws)?.roomCode).toBe('ABC123');
      expect(manager.getClientInfo(ws)?.seat).toBe('north');

      manager.removeFromRoom(ws);
      expect(manager.getClientInfo(ws)?.roomCode).toBeNull();
      expect(manager.getClientInfo(ws)?.seat).toBeNull();
    });

    it('getClientsInRoom returns only clients in that room', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      const ws3 = createMockWs();

      manager.addClient(ws1, 'user-1', 'Alice');
      manager.addClient(ws2, 'user-2', 'Bob');
      manager.addClient(ws3, 'user-3', 'Charlie');

      manager.assignToRoom(ws1, 'ROOM-A', 'north');
      manager.assignToRoom(ws2, 'ROOM-A', 'east');
      manager.assignToRoom(ws3, 'ROOM-B', 'south');

      const roomA = manager.getClientsInRoom('ROOM-A');
      expect(roomA).toHaveLength(2);
      expect(roomA.map(c => c.info.userId).sort()).toEqual(['user-1', 'user-2']);
    });

    it('getClientBySeat finds the right client', () => {
      const ws = createMockWs();
      manager.addClient(ws, 'user-1', 'Alice');
      manager.assignToRoom(ws, 'ROOM-A', 'south');

      const found = manager.getClientBySeat('ROOM-A', 'south');
      expect(found?.ws).toBe(ws);
      expect(found?.info.userId).toBe('user-1');
    });

    it('getClientBySeat returns undefined for empty seat', () => {
      expect(manager.getClientBySeat('ROOM-A', 'west')).toBeUndefined();
    });
  });

  describe('heartbeat', () => {
    it('pings connected clients during heartbeat', async () => {
      vi.useFakeTimers();
      const ws = createMockWs();
      manager.addClient(ws, 'user-1', 'Alice');
      manager.startHeartbeat();

      vi.advanceTimersByTime(100);
      expect(ws.ping).toHaveBeenCalled();

      manager.stopHeartbeat();
      vi.useRealTimers();
    });

    it('terminates stale connections', async () => {
      vi.useFakeTimers();
      const ws = createMockWs();
      const onStale = vi.fn();
      manager.onStaleConnection = onStale;

      manager.addClient(ws, 'user-1', 'Alice');
      manager.startHeartbeat();

      // Advance past stale threshold (200ms) + one ping interval (100ms)
      vi.advanceTimersByTime(300);

      expect(ws.terminate).toHaveBeenCalled();
      expect(onStale).toHaveBeenCalledWith(ws, expect.objectContaining({ userId: 'user-1' }));
      expect(manager.size).toBe(0);

      manager.stopHeartbeat();
      vi.useRealTimers();
    });

    it('does not terminate clients that respond with pong', async () => {
      vi.useFakeTimers();
      const ws = createMockWs();
      manager.addClient(ws, 'user-1', 'Alice');
      manager.startHeartbeat();

      // Advance, then record pong, then advance again
      vi.advanceTimersByTime(100);
      manager.recordPong(ws);
      vi.advanceTimersByTime(100);

      expect(ws.terminate).not.toHaveBeenCalled();
      expect(manager.size).toBe(1);

      manager.stopHeartbeat();
      vi.useRealTimers();
    });

    it('startHeartbeat is idempotent', () => {
      manager.startHeartbeat();
      manager.startHeartbeat(); // Should not create a second interval
      manager.stopHeartbeat();
    });
  });

  describe('reconnection', () => {
    it('canReconnect returns seat when user has active session in room', () => {
      const ws = createMockWs();
      manager.addClient(ws, 'user-1', 'Alice');
      manager.assignToRoom(ws, 'ROOM-A', 'north');

      const result = manager.canReconnect('user-1', 'ROOM-A');
      expect(result).toEqual({ seat: 'north' });
    });

    it('canReconnect returns null when user has no session', () => {
      expect(manager.canReconnect('user-99', 'ROOM-A')).toBeNull();
    });

    it('canReconnect returns null when user is in a different room', () => {
      const ws = createMockWs();
      manager.addClient(ws, 'user-1', 'Alice');
      manager.assignToRoom(ws, 'ROOM-A', 'north');

      expect(manager.canReconnect('user-1', 'ROOM-B')).toBeNull();
    });
  });

  describe('dispose', () => {
    it('terminates all connections and clears state', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      manager.addClient(ws1, 'user-1', 'Alice');
      manager.addClient(ws2, 'user-2', 'Bob');
      manager.startHeartbeat();

      manager.dispose();

      expect(ws1.terminate).toHaveBeenCalled();
      expect(ws2.terminate).toHaveBeenCalled();
      expect(manager.size).toBe(0);
    });
  });
});
