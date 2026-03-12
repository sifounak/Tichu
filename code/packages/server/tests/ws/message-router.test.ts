// Verifies: REQ-NF-A03 — Zod validation on WebSocket messages

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageRouter } from '../../src/ws/message-router.js';
import { ConnectionManager } from '../../src/ws/connection-manager.js';
import { Broadcaster } from '../../src/ws/broadcaster.js';
import type { WebSocket } from 'ws';

function createMockWs(): WebSocket {
  return {
    readyState: 1,
    OPEN: 1,
    send: vi.fn(),
    ping: vi.fn(),
    terminate: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
  } as unknown as WebSocket;
}

describe('MessageRouter', () => {
  let connections: ConnectionManager;
  let broadcaster: Broadcaster;
  let router: MessageRouter;
  let ws: WebSocket;

  beforeEach(() => {
    connections = new ConnectionManager();
    broadcaster = new Broadcaster(connections);
    router = new MessageRouter(connections, broadcaster);
    ws = createMockWs();
    // Register the client so it's "authenticated"
    connections.addClient(ws, 'user-1', 'Alice');
  });

  describe('JSON parsing', () => {
    it('rejects invalid JSON with INVALID_JSON error', async () => {
      await router.handleMessage(ws, 'not json{{{');
      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"code":"INVALID_JSON"'),
      );
    });
  });

  describe('Zod validation', () => {
    it('rejects messages that fail schema validation', async () => {
      await router.handleMessage(ws, JSON.stringify({ type: 'NONEXISTENT' }));
      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"code":"INVALID_MESSAGE"'),
      );
    });

    it('rejects messages with missing required fields', async () => {
      // JOIN_ROOM requires roomCode and playerName
      await router.handleMessage(ws, JSON.stringify({ type: 'JOIN_ROOM' }));
      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"code":"INVALID_MESSAGE"'),
      );
    });

    it('rejects messages with invalid field types', async () => {
      await router.handleMessage(ws, JSON.stringify({
        type: 'PLAY_CARDS',
        cardIds: 'not an array',
      }));
      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"code":"INVALID_MESSAGE"'),
      );
    });
  });

  describe('authentication check', () => {
    it('rejects messages from unregistered clients', async () => {
      const unknownWs = createMockWs();
      await router.handleMessage(unknownWs, JSON.stringify({ type: 'LEAVE_ROOM' }));
      expect(unknownWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"code":"NOT_AUTHENTICATED"'),
      );
    });
  });

  describe('handler routing', () => {
    it('routes valid messages to the registered handler', async () => {
      const handler = vi.fn();
      router.on('LEAVE_ROOM', handler);

      await router.handleMessage(ws, JSON.stringify({ type: 'LEAVE_ROOM' }));
      expect(handler).toHaveBeenCalledWith(ws, { type: 'LEAVE_ROOM' });
    });

    it('routes CREATE_ROOM with payload correctly', async () => {
      const handler = vi.fn();
      router.on('CREATE_ROOM', handler);

      await router.handleMessage(ws, JSON.stringify({ type: 'CREATE_ROOM', playerName: 'Alice' }));
      expect(handler).toHaveBeenCalledWith(ws, { type: 'CREATE_ROOM', playerName: 'Alice' });
    });

    it('routes PLAY_CARDS with cardIds and phoenixAs', async () => {
      const handler = vi.fn();
      router.on('PLAY_CARDS', handler);

      await router.handleMessage(ws, JSON.stringify({
        type: 'PLAY_CARDS',
        cardIds: [0, 1, 2],
        phoenixAs: 7,
      }));
      expect(handler).toHaveBeenCalledWith(ws, {
        type: 'PLAY_CARDS',
        cardIds: [0, 1, 2],
        phoenixAs: 7,
      });
    });

    it('sends UNKNOWN_TYPE error when no handler is registered', async () => {
      // LEAVE_ROOM is a valid message type but has no handler registered
      await router.handleMessage(ws, JSON.stringify({ type: 'LEAVE_ROOM' }));
      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"code":"UNKNOWN_TYPE"'),
      );
    });

    it('sends HANDLER_ERROR when handler throws', async () => {
      router.on('LEAVE_ROOM', () => {
        throw new Error('Test handler failure');
      });

      await router.handleMessage(ws, JSON.stringify({ type: 'LEAVE_ROOM' }));
      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"code":"HANDLER_ERROR"'),
      );
      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('Test handler failure'),
      );
    });

    it('sends HANDLER_ERROR for async handler rejection', async () => {
      router.on('LEAVE_ROOM', async () => {
        throw new Error('Async failure');
      });

      await router.handleMessage(ws, JSON.stringify({ type: 'LEAVE_ROOM' }));
      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"code":"HANDLER_ERROR"'),
      );
    });
  });
});
