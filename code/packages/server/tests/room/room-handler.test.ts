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
    assignAsSpectator: vi.fn((ws: WebSocket, roomCode: string) => {
      const info = clients.get(ws);
      if (info) { info.roomCode = roomCode; info.seat = null; }
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
    sendSeatClaimRejected: vi.fn().mockReturnValue(true),
  } as unknown as Broadcaster;
}

function createMockGameStore(): GameStore {
  return {
    createGame: vi.fn().mockReturnValue({
      gameId: 'game_123',
      roomCode: 'ABCDEF',
      seatPlayer: vi.fn().mockReturnValue(true),
      registerBot: vi.fn(),
      handleMessage: vi.fn(),
      broadcastState: vi.fn(),
      wireKickCallback: vi.fn(),
      wireVoteCallback: vi.fn(),
      wireGameEndCallback: vi.fn(),
      getEventAccumulator: vi.fn(),
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
        seat: 'south',
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
        seat: 'north',
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
      await router.handleMessage(ws1, JSON.stringify({ type: 'ADD_BOT', seat: 'north' }));

      const room = handler.roomManager.getRoom(handler.roomManager.getUserRoom('user1')!);
      expect(room!.players).toHaveLength(2);
      expect(room!.players[1].isBot).toBe(true);
    });

    it('should remove bot from seat', async () => {
      await router.handleMessage(ws1, JSON.stringify({ type: 'CREATE_ROOM', playerName: 'Alice' }));
      await router.handleMessage(ws1, JSON.stringify({ type: 'ADD_BOT', seat: 'north' }));
      await router.handleMessage(ws1, JSON.stringify({ type: 'REMOVE_BOT', seat: 'north' }));

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

      await router.handleMessage(ws2, JSON.stringify({ type: 'ADD_BOT', seat: 'north' }));
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
      await router.handleMessage(ws1, JSON.stringify({ type: 'ADD_BOT', seat: 'north' }));
      await router.handleMessage(ws1, JSON.stringify({ type: 'ADD_BOT', seat: 'east' }));
      await router.handleMessage(ws1, JSON.stringify({ type: 'ADD_BOT', seat: 'west' }));

      await router.handleMessage(ws1, JSON.stringify({ type: 'START_GAME' }));

      expect(gameStore.createGame).toHaveBeenCalled();
    });

    it('should reject start from non-host', async () => {
      await router.handleMessage(ws1, JSON.stringify({ type: 'CREATE_ROOM', playerName: 'Alice' }));
      await router.handleMessage(ws1, JSON.stringify({ type: 'ADD_BOT', seat: 'north' }));
      await router.handleMessage(ws1, JSON.stringify({ type: 'ADD_BOT', seat: 'east' }));
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

      await router.handleMessage(ws1, JSON.stringify({ type: 'ADD_BOT', seat: 'east' }));
      await router.handleMessage(ws1, JSON.stringify({ type: 'ADD_BOT', seat: 'west' }));

      await router.handleMessage(ws1, JSON.stringify({ type: 'START_GAME' }));

      const game = (gameStore.createGame as any).mock.results[0].value;
      // seatPlayer called for all 4 players (2 humans + 2 bots)
      expect(game.seatPlayer).toHaveBeenCalledTimes(4);
      expect(game.handleMessage).toHaveBeenCalledWith(
        ws1, 'south', { type: 'START_GAME' },
      );
    });
  });

  // Verifies: REQ-F-SJ01, SJ03-SJ06, REQ-NF-SJ01, NF-SJ02
  describe('seat-claim eligibility enforcement (REQ-NF-SJ02)', () => {
    let roomCode: string;
    let stubGame: any;

    beforeEach(async () => {
      // Fill all 4 seats and start a game so room.gameInProgress = true.
      await router.handleMessage(ws1, JSON.stringify({ type: 'CREATE_ROOM', playerName: 'Alice' }));
      await router.handleMessage(ws1, JSON.stringify({ type: 'ADD_BOT', seat: 'north' }));
      await router.handleMessage(ws1, JSON.stringify({ type: 'ADD_BOT', seat: 'east' }));
      await router.handleMessage(ws1, JSON.stringify({ type: 'ADD_BOT', seat: 'west' }));
      await router.handleMessage(ws1, JSON.stringify({ type: 'START_GAME' }));
      roomCode = handler.roomManager.getUserRoom('user1')!;

      // Stub the live-game lookup: round 1 dealt, user's prior seat is 'south'
      // for any caller. Every entry point below must reject cross-seat attempts.
      stubGame = {
        hasRoundBeenDealt: vi.fn().mockReturnValue(true),
        getPreviousSeatForUser: vi.fn().mockReturnValue('south' as Seat),
        handleChooseSeat: vi.fn(),
        handleSeatFilled: vi.fn(),
        handleSeatVacated: vi.fn(),
        sendSpectatorState: vi.fn(),
        markJoinedAfterSpectating: vi.fn(),
      };
      (gameStore.getGameByRoom as any).mockReturnValue(stubGame);
    });

    // REQ-NF-SJ01, NF-SJ02, F-SJ06: Even if a forged client sends CHOOSE_SEAT
    // bypassing the UI pre-filter, the server rejects cross-seat changes.
    it('CHOOSE_SEAT: rejects cross-seat change and does not touch game state', async () => {
      await router.handleMessage(ws1, JSON.stringify({ type: 'CHOOSE_SEAT', seat: 'north' }));

      expect(broadcaster.sendSeatClaimRejected).toHaveBeenCalledWith(
        ws1,
        expect.objectContaining({
          kind: 'rejected',
          originalSeat: 'south',
          requestedSeat: 'north',
          offerClaimOriginal: false,
        }),
      );
      expect(stubGame.handleChooseSeat).not.toHaveBeenCalled();
    });

    // REQ-NF-SJ02, F-SJ06: Mid-game JOIN_ROOM is validated before the room
    // state mutates. Bob previously held 'south'; north is the only free seat.
    it('JOIN_ROOM mid-game: rejects and does not seat the player', async () => {
      // Vacate north so the next-seat heuristic picks it up.
      await router.handleMessage(ws1, JSON.stringify({ type: 'REMOVE_BOT', seat: 'north' }));

      const ws2 = createMockWs();
      (connections.addClient as any)(ws2, 'user2', 'Bob');

      await router.handleMessage(ws2, JSON.stringify({
        type: 'JOIN_ROOM',
        roomCode,
        playerName: 'Bob',
      }));

      expect(broadcaster.sendSeatClaimRejected).toHaveBeenCalledWith(
        ws2,
        expect.objectContaining({
          kind: 'rejected',
          originalSeat: 'south',
          requestedSeat: 'north',
        }),
      );
      // Seat not assigned — info.seat stays null.
      const info = connections.getClientInfo(ws2);
      expect(info?.seat).toBeNull();
      // Room state unchanged — still 3 players (Alice + 2 bots).
      const room = handler.roomManager.getRoom(roomCode);
      expect(room?.players).toHaveLength(3);
    });

    // REQ-NF-SJ02, F-SJ06: CLAIM_SEAT with an explicit seat is validated
    // against the user's prior seat before handing off to the queue.
    it('CLAIM_SEAT with explicit seat: rejects and does not invoke the queue', async () => {
      // Room is full — Bob auto-joins as spectator.
      const ws2 = createMockWs();
      (connections.addClient as any)(ws2, 'user2', 'Bob');
      await router.handleMessage(ws2, JSON.stringify({
        type: 'JOIN_ROOM',
        roomCode,
        playerName: 'Bob',
      }));

      // Inject an active mock queue so the handler proceeds to the eligibility
      // check. A real queue would require orchestrating a vacation + spectator
      // flow, which is tangential to the rule under test.
      const mockQueue = {
        isActive: vi.fn().mockReturnValue(true),
        handleClaim: vi.fn().mockReturnValue(true),
        phase: 'offer',
        cleanup: vi.fn(),
      };
      (handler as any).seatQueues.set(roomCode, mockQueue);

      await router.handleMessage(ws2, JSON.stringify({
        type: 'CLAIM_SEAT',
        seat: 'north',
      }));

      expect(broadcaster.sendSeatClaimRejected).toHaveBeenCalledWith(
        ws2,
        expect.objectContaining({
          kind: 'rejected',
          originalSeat: 'south',
          requestedSeat: 'north',
        }),
      );
      expect(mockQueue.handleClaim).not.toHaveBeenCalled();
    });

    // REQ-F-SJ01: When no round has been dealt yet, validation short-circuits
    // to allowed. Proves the gate is anchored on hasRoundBeenDealt().
    it('allows cross-seat CHOOSE_SEAT when no round has been dealt yet', async () => {
      stubGame.hasRoundBeenDealt.mockReturnValue(false);

      await router.handleMessage(ws1, JSON.stringify({ type: 'CHOOSE_SEAT', seat: 'north' }));

      expect(broadcaster.sendSeatClaimRejected).not.toHaveBeenCalled();
      expect(stubGame.handleChooseSeat).toHaveBeenCalledWith('south', 'north');
    });

    // REQ-F-SJ04: Reclaiming the original seat (same seat as prior) is always
    // allowed — exercised via CHOOSE_SEAT no-op where chosenSeat === currentSeat.
    it('CHOOSE_SEAT to the same seat bypasses validation (reclaim)', async () => {
      await router.handleMessage(ws1, JSON.stringify({ type: 'CHOOSE_SEAT', seat: 'south' }));

      expect(broadcaster.sendSeatClaimRejected).not.toHaveBeenCalled();
      expect(stubGame.handleChooseSeat).toHaveBeenCalledWith('south', 'south');
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
