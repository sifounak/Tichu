// Verifies: REQ-F-MP02, REQ-F-MP03, REQ-F-MP04

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoomHandler } from '../../src/room/room-handler.js';
import { RoomManager } from '../../src/room/room-manager.js';
import { MessageRouter } from '../../src/ws/message-router.js';
import type { ConnectionManager, ClientInfo } from '../../src/ws/connection-manager.js';
import type { Broadcaster } from '../../src/ws/broadcaster.js';
import type { GameStore } from '../../src/game/game-store.js';
import type { WebSocket } from 'ws';

// ─── Mock factories ──────────────────────────────────────────────────

function createMockWs(): WebSocket {
  return {
    readyState: 1,
    OPEN: 1,
    send: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
    ping: vi.fn(),
    terminate: vi.fn(),
  } as unknown as WebSocket;
}

function createMockConnections(): ConnectionManager {
  const clients = new Map<WebSocket, ClientInfo>();
  const userSockets = new Map<string, WebSocket>();

  return {
    addClient: vi.fn((ws: WebSocket, userId: string, playerName: string) => {
      const info: ClientInfo = { userId, playerName, roomCode: null, seat: null, lastPong: Date.now() };
      clients.set(ws, info);
      userSockets.set(userId, ws);
    }),
    removeClient: vi.fn((ws: WebSocket) => {
      const info = clients.get(ws);
      clients.delete(ws);
      if (info) userSockets.delete(info.userId);
      return info;
    }),
    getClientInfo: vi.fn((ws: WebSocket) => clients.get(ws)),
    getSocketByUserId: vi.fn((userId: string) => userSockets.get(userId)),
    assignToRoom: vi.fn((ws: WebSocket, roomCode: string, seat: string) => {
      const info = clients.get(ws);
      if (info) { info.roomCode = roomCode; info.seat = seat as any; }
    }),
    removeFromRoom: vi.fn((ws: WebSocket) => {
      const info = clients.get(ws);
      if (info) { info.roomCode = null; info.seat = null; }
    }),
    getClientsInRoom: vi.fn((roomCode: string) => {
      const result: Array<{ ws: WebSocket; info: ClientInfo }> = [];
      for (const [ws, info] of clients) {
        if (info.roomCode === roomCode) result.push({ ws, info });
      }
      return result;
    }),
    getClientBySeat: vi.fn(),
    recordPong: vi.fn(),
    startHeartbeat: vi.fn(),
    stopHeartbeat: vi.fn(),
    canReconnect: vi.fn(),
    size: 0,
    dispose: vi.fn(),
    onStaleConnection: null,
  } as unknown as ConnectionManager;
}

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

function createMockGameStore(): GameStore {
  return {
    createGame: vi.fn().mockReturnValue({
      gameId: 'game_123',
      roomCode: 'ABCDEF',
      seatPlayer: vi.fn().mockReturnValue(true),
      handleMessage: vi.fn(),
      broadcastState: vi.fn(),
      destroy: vi.fn(),
    }),
    getGame: vi.fn(),
    getGameByRoom: vi.fn(),
    destroyGame: vi.fn(),
    destroyGameByRoom: vi.fn(),
    dispose: vi.fn(),
    size: 0,
    activeGameIds: [],
    disconnectHandler: { cleanupRoom: vi.fn(), dispose: vi.fn() } as any,
  } as unknown as GameStore;
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('RoomHandler', () => {
  let connections: ConnectionManager;
  let broadcaster: Broadcaster;
  let gameStore: GameStore;
  let router: MessageRouter;
  let handler: RoomHandler;
  let ws1: WebSocket;

  beforeEach(() => {
    connections = createMockConnections();
    broadcaster = createMockBroadcaster();
    gameStore = createMockGameStore();
    router = new MessageRouter(connections, broadcaster);
    handler = new RoomHandler(router, connections, broadcaster, gameStore);

    // Set up a connected client
    ws1 = createMockWs();
    (connections.addClient as any)(ws1, 'user1', 'Alice');
  });

  describe('CREATE_ROOM', () => {
    it('should create room and send ROOM_CREATED + ROOM_JOINED', async () => {
      await router.handleMessage(ws1, JSON.stringify({ type: 'CREATE_ROOM', playerName: 'Alice' }));

      expect(broadcaster.send).toHaveBeenCalledWith(ws1, expect.objectContaining({ type: 'ROOM_CREATED' }));
      expect(broadcaster.send).toHaveBeenCalledWith(ws1, expect.objectContaining({
        type: 'ROOM_JOINED',
        seat: 'north',
      }));
      expect(connections.assignToRoom).toHaveBeenCalled();
    });

    it('should broadcast ROOM_UPDATE after creation', async () => {
      await router.handleMessage(ws1, JSON.stringify({ type: 'CREATE_ROOM', playerName: 'Alice' }));

      expect(broadcaster.broadcastToRoom).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ type: 'ROOM_UPDATE' }),
      );
    });
  });

  describe('JOIN_ROOM', () => {
    it('should join room and send ROOM_JOINED', async () => {
      // Create room first
      await router.handleMessage(ws1, JSON.stringify({ type: 'CREATE_ROOM', playerName: 'Alice' }));

      // Second player joins
      const ws2 = createMockWs();
      (connections.addClient as any)(ws2, 'user2', 'Bob');

      const roomCode = handler.roomManager.getUserRoom('user1');
      await router.handleMessage(ws2, JSON.stringify({
        type: 'JOIN_ROOM',
        roomCode,
        playerName: 'Bob',
      }));

      expect(broadcaster.send).toHaveBeenCalledWith(ws2, expect.objectContaining({
        type: 'ROOM_JOINED',
        seat: 'east',
      }));
    });

    it('should send error for non-existent room', async () => {
      await router.handleMessage(ws1, JSON.stringify({
        type: 'JOIN_ROOM',
        roomCode: 'ZZZZZZ',
        playerName: 'Alice',
      }));

      expect(broadcaster.sendError).toHaveBeenCalledWith(ws1, 'JOIN_ROOM_FAILED', expect.any(String));
    });
  });

  describe('LEAVE_ROOM', () => {
    it('should send ROOM_LEFT and broadcast update', async () => {
      await router.handleMessage(ws1, JSON.stringify({ type: 'CREATE_ROOM', playerName: 'Alice' }));

      const ws2 = createMockWs();
      (connections.addClient as any)(ws2, 'user2', 'Bob');
      const roomCode = handler.roomManager.getUserRoom('user1')!;
      await router.handleMessage(ws2, JSON.stringify({
        type: 'JOIN_ROOM',
        roomCode,
        playerName: 'Bob',
      }));

      // Alice leaves
      await router.handleMessage(ws1, JSON.stringify({ type: 'LEAVE_ROOM' }));

      expect(broadcaster.send).toHaveBeenCalledWith(ws1, { type: 'ROOM_LEFT' });
      expect(connections.removeFromRoom).toHaveBeenCalledWith(ws1);
    });
  });

  describe('CONFIGURE_ROOM', () => {
    it('should update config when host sends', async () => {
      await router.handleMessage(ws1, JSON.stringify({ type: 'CREATE_ROOM', playerName: 'Alice' }));

      await router.handleMessage(ws1, JSON.stringify({
        type: 'CONFIGURE_ROOM',
        config: { targetScore: 500 },
      }));

      const room = handler.roomManager.getRoom(handler.roomManager.getUserRoom('user1')!);
      expect(room!.config.targetScore).toBe(500);
    });

    it('should reject config from non-host', async () => {
      await router.handleMessage(ws1, JSON.stringify({ type: 'CREATE_ROOM', playerName: 'Alice' }));

      const ws2 = createMockWs();
      (connections.addClient as any)(ws2, 'user2', 'Bob');
      const roomCode = handler.roomManager.getUserRoom('user1')!;
      await router.handleMessage(ws2, JSON.stringify({
        type: 'JOIN_ROOM', roomCode, playerName: 'Bob',
      }));

      await router.handleMessage(ws2, JSON.stringify({
        type: 'CONFIGURE_ROOM',
        config: { targetScore: 500 },
      }));

      expect(broadcaster.sendError).toHaveBeenCalledWith(ws2, 'NOT_HOST', expect.any(String));
    });
  });

  describe('ADD_BOT / REMOVE_BOT', () => {
    it('should add bot to specified seat', async () => {
      await router.handleMessage(ws1, JSON.stringify({ type: 'CREATE_ROOM', playerName: 'Alice' }));
      await router.handleMessage(ws1, JSON.stringify({ type: 'ADD_BOT', seat: 'south' }));

      const room = handler.roomManager.getRoom(handler.roomManager.getUserRoom('user1')!);
      expect(room!.players).toHaveLength(2);
      expect(room!.players[1].isBot).toBe(true);
    });

    it('should remove bot from seat', async () => {
      await router.handleMessage(ws1, JSON.stringify({ type: 'CREATE_ROOM', playerName: 'Alice' }));
      await router.handleMessage(ws1, JSON.stringify({ type: 'ADD_BOT', seat: 'south' }));
      await router.handleMessage(ws1, JSON.stringify({ type: 'REMOVE_BOT', seat: 'south' }));

      const room = handler.roomManager.getRoom(handler.roomManager.getUserRoom('user1')!);
      expect(room!.players).toHaveLength(1);
    });

    it('should reject add bot from non-host', async () => {
      await router.handleMessage(ws1, JSON.stringify({ type: 'CREATE_ROOM', playerName: 'Alice' }));

      const ws2 = createMockWs();
      (connections.addClient as any)(ws2, 'user2', 'Bob');
      const roomCode = handler.roomManager.getUserRoom('user1')!;
      await router.handleMessage(ws2, JSON.stringify({
        type: 'JOIN_ROOM', roomCode, playerName: 'Bob',
      }));

      await router.handleMessage(ws2, JSON.stringify({ type: 'ADD_BOT', seat: 'south' }));
      expect(broadcaster.sendError).toHaveBeenCalledWith(ws2, 'NOT_HOST', expect.any(String));
    });
  });

  describe('GET_LOBBY', () => {
    it('should return list of public rooms', async () => {
      await router.handleMessage(ws1, JSON.stringify({ type: 'CREATE_ROOM', playerName: 'Alice' }));
      await router.handleMessage(ws1, JSON.stringify({ type: 'GET_LOBBY' }));

      expect(broadcaster.send).toHaveBeenCalledWith(ws1, expect.objectContaining({
        type: 'LOBBY_LIST',
        rooms: expect.arrayContaining([
          expect.objectContaining({ hostName: 'Alice', playerCount: 1 }),
        ]),
      }));
    });
  });

  describe('START_GAME', () => {
    it('should start game when 4 players are seated', async () => {
      await router.handleMessage(ws1, JSON.stringify({ type: 'CREATE_ROOM', playerName: 'Alice' }));
      await router.handleMessage(ws1, JSON.stringify({ type: 'ADD_BOT', seat: 'east' }));
      await router.handleMessage(ws1, JSON.stringify({ type: 'ADD_BOT', seat: 'south' }));
      await router.handleMessage(ws1, JSON.stringify({ type: 'ADD_BOT', seat: 'west' }));

      await router.handleMessage(ws1, JSON.stringify({ type: 'START_GAME' }));

      expect(gameStore.createGame).toHaveBeenCalled();
    });

    it('should reject start from non-host', async () => {
      await router.handleMessage(ws1, JSON.stringify({ type: 'CREATE_ROOM', playerName: 'Alice' }));
      await router.handleMessage(ws1, JSON.stringify({ type: 'ADD_BOT', seat: 'east' }));
      await router.handleMessage(ws1, JSON.stringify({ type: 'ADD_BOT', seat: 'south' }));
      await router.handleMessage(ws1, JSON.stringify({ type: 'ADD_BOT', seat: 'west' }));

      const ws2 = createMockWs();
      (connections.addClient as any)(ws2, 'user2', 'Bob');
      // Not in the room, but try to start
      await router.handleMessage(ws2, JSON.stringify({ type: 'START_GAME' }));

      expect(broadcaster.sendError).toHaveBeenCalled();
    });

    it('should seat human players and bots and send START_GAME', async () => {
      await router.handleMessage(ws1, JSON.stringify({ type: 'CREATE_ROOM', playerName: 'Alice' }));

      const ws2 = createMockWs();
      (connections.addClient as any)(ws2, 'user2', 'Bob');
      const roomCode = handler.roomManager.getUserRoom('user1')!;
      await router.handleMessage(ws2, JSON.stringify({
        type: 'JOIN_ROOM', roomCode, playerName: 'Bob',
      }));

      await router.handleMessage(ws1, JSON.stringify({ type: 'ADD_BOT', seat: 'south' }));
      await router.handleMessage(ws1, JSON.stringify({ type: 'ADD_BOT', seat: 'west' }));

      await router.handleMessage(ws1, JSON.stringify({ type: 'START_GAME' }));

      const game = (gameStore.createGame as any).mock.results[0].value;
      // seatPlayer called for all 4 players (2 humans + 2 bots)
      expect(game.seatPlayer).toHaveBeenCalledTimes(4);
      expect(game.handleMessage).toHaveBeenCalledWith(
        ws1, 'north', { type: 'START_GAME' },
      );
    });
  });

  describe('error handling', () => {
    it('should send NOT_AUTHENTICATED for unauthenticated CREATE_ROOM', async () => {
      const unknownWs = createMockWs();
      // Don't add to connections
      await router.handleMessage(unknownWs, JSON.stringify({ type: 'CREATE_ROOM', playerName: 'X' }));
      // Message router rejects unauthenticated — sends NOT_AUTHENTICATED
      expect(broadcaster.sendError).toHaveBeenCalledWith(unknownWs, 'NOT_AUTHENTICATED', expect.any(String));
    });

    it('should send NOT_IN_ROOM for CONFIGURE_ROOM when not in room', async () => {
      await router.handleMessage(ws1, JSON.stringify({
        type: 'CONFIGURE_ROOM',
        config: { targetScore: 500 },
      }));
      expect(broadcaster.sendError).toHaveBeenCalledWith(ws1, 'NOT_IN_ROOM', expect.any(String));
    });

    it('should send NOT_IN_ROOM for ADD_BOT when not in room', async () => {
      await router.handleMessage(ws1, JSON.stringify({ type: 'ADD_BOT', seat: 'south' }));
      expect(broadcaster.sendError).toHaveBeenCalledWith(ws1, 'NOT_IN_ROOM', expect.any(String));
    });

    it('should send NOT_IN_ROOM for REMOVE_BOT when not in room', async () => {
      await router.handleMessage(ws1, JSON.stringify({ type: 'REMOVE_BOT', seat: 'south' }));
      expect(broadcaster.sendError).toHaveBeenCalledWith(ws1, 'NOT_IN_ROOM', expect.any(String));
    });

    it('should send NOT_IN_ROOM for START_GAME when not in room', async () => {
      await router.handleMessage(ws1, JSON.stringify({ type: 'START_GAME' }));
      expect(broadcaster.sendError).toHaveBeenCalledWith(ws1, 'NOT_IN_ROOM', expect.any(String));
    });
  });
});
