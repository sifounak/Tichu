// REQ-F-MP02: Room codes for matchmaking
// REQ-F-MP03: Public lobby
// REQ-F-MP04: Room configuration options

import type { WebSocket } from 'ws';
import type { ClientMessage, Seat } from '@tichu/shared';
import type { ConnectionManager } from '../ws/connection-manager.js';
import type { Broadcaster } from '../ws/broadcaster.js';
import type { MessageRouter } from '../ws/message-router.js';
import { RoomManager } from './room-manager.js';
import { GameStore } from '../game/game-store.js';

/**
 * Handles room-related WebSocket messages by routing them to the RoomManager.
 * Registers handlers on the MessageRouter for CREATE_ROOM, JOIN_ROOM, etc.
 */
export class RoomHandler {
  readonly roomManager: RoomManager;
  private readonly gameStore: GameStore;
  private readonly connections: ConnectionManager;
  private readonly broadcaster: Broadcaster;

  constructor(
    router: MessageRouter,
    connections: ConnectionManager,
    broadcaster: Broadcaster,
    gameStore: GameStore,
    roomManager?: RoomManager,
  ) {
    this.connections = connections;
    this.broadcaster = broadcaster;
    this.gameStore = gameStore;
    this.roomManager = roomManager ?? new RoomManager();

    // Register room message handlers
    router.on('CREATE_ROOM', (ws, msg) => this.handleCreateRoom(ws, msg as ClientMessage & { type: 'CREATE_ROOM' }));
    router.on('JOIN_ROOM', (ws, msg) => this.handleJoinRoom(ws, msg as ClientMessage & { type: 'JOIN_ROOM' }));
    router.on('LEAVE_ROOM', (ws, msg) => this.handleLeaveRoom(ws, msg as ClientMessage & { type: 'LEAVE_ROOM' }));
    router.on('CONFIGURE_ROOM', (ws, msg) => this.handleConfigureRoom(ws, msg as ClientMessage & { type: 'CONFIGURE_ROOM' }));
    router.on('ADD_BOT', (ws, msg) => this.handleAddBot(ws, msg as ClientMessage & { type: 'ADD_BOT' }));
    router.on('REMOVE_BOT', (ws, msg) => this.handleRemoveBot(ws, msg as ClientMessage & { type: 'REMOVE_BOT' }));
    router.on('GET_LOBBY', (ws) => this.handleGetLobby(ws));
    router.on('START_GAME', (ws) => this.handleStartGame(ws));
  }

  private handleCreateRoom(ws: WebSocket, msg: ClientMessage & { type: 'CREATE_ROOM' }): void {
    const info = this.connections.getClientInfo(ws);
    if (!info) {
      this.broadcaster.sendError(ws, 'NOT_AUTHENTICATED', 'Not authenticated');
      return;
    }

    try {
      const room = this.roomManager.createRoom(info.userId, msg.playerName);
      this.connections.assignToRoom(ws, room.roomCode, 'north');

      this.broadcaster.send(ws, { type: 'ROOM_CREATED', roomCode: room.roomCode });
      this.broadcaster.send(ws, { type: 'ROOM_JOINED', roomCode: room.roomCode, seat: 'north' });
      this.broadcastRoomUpdate(room.roomCode);
    } catch (err) {
      this.broadcaster.sendError(ws, 'CREATE_ROOM_FAILED', (err as Error).message);
    }
  }

  private handleJoinRoom(ws: WebSocket, msg: ClientMessage & { type: 'JOIN_ROOM' }): void {
    const info = this.connections.getClientInfo(ws);
    if (!info) {
      this.broadcaster.sendError(ws, 'NOT_AUTHENTICATED', 'Not authenticated');
      return;
    }

    try {
      const { room, seat } = this.roomManager.joinRoom(info.userId, msg.roomCode, msg.playerName);
      this.connections.assignToRoom(ws, room.roomCode, seat);

      this.broadcaster.send(ws, { type: 'ROOM_JOINED', roomCode: room.roomCode, seat });
      this.broadcastRoomUpdate(room.roomCode);
    } catch (err) {
      this.broadcaster.sendError(ws, 'JOIN_ROOM_FAILED', (err as Error).message);
    }
  }

  private handleLeaveRoom(ws: WebSocket, _msg: ClientMessage & { type: 'LEAVE_ROOM' }): void {
    const info = this.connections.getClientInfo(ws);
    if (!info) {
      this.broadcaster.sendError(ws, 'NOT_AUTHENTICATED', 'Not authenticated');
      return;
    }

    try {
      const { room, roomCode } = this.roomManager.leaveRoom(info.userId);
      this.connections.removeFromRoom(ws);

      this.broadcaster.send(ws, { type: 'ROOM_LEFT' });

      if (room) {
        this.broadcastRoomUpdate(roomCode);
      }
    } catch (err) {
      this.broadcaster.sendError(ws, 'LEAVE_ROOM_FAILED', (err as Error).message);
    }
  }

  private handleConfigureRoom(ws: WebSocket, msg: ClientMessage & { type: 'CONFIGURE_ROOM' }): void {
    const info = this.connections.getClientInfo(ws);
    if (!info?.roomCode) {
      this.broadcaster.sendError(ws, 'NOT_IN_ROOM', 'Not in a room');
      return;
    }

    if (!this.roomManager.isHost(info.userId)) {
      this.broadcaster.sendError(ws, 'NOT_HOST', 'Only the host can configure the room');
      return;
    }

    try {
      this.roomManager.configureRoom(info.roomCode, msg.config);
      this.broadcastRoomUpdate(info.roomCode);
    } catch (err) {
      this.broadcaster.sendError(ws, 'CONFIGURE_FAILED', (err as Error).message);
    }
  }

  private handleAddBot(ws: WebSocket, msg: ClientMessage & { type: 'ADD_BOT' }): void {
    const info = this.connections.getClientInfo(ws);
    if (!info?.roomCode) {
      this.broadcaster.sendError(ws, 'NOT_IN_ROOM', 'Not in a room');
      return;
    }

    if (!this.roomManager.isHost(info.userId)) {
      this.broadcaster.sendError(ws, 'NOT_HOST', 'Only the host can add bots');
      return;
    }

    try {
      this.roomManager.addBot(info.roomCode, msg.seat, msg.difficulty);
      this.broadcastRoomUpdate(info.roomCode);
    } catch (err) {
      this.broadcaster.sendError(ws, 'ADD_BOT_FAILED', (err as Error).message);
    }
  }

  private handleRemoveBot(ws: WebSocket, msg: ClientMessage & { type: 'REMOVE_BOT' }): void {
    const info = this.connections.getClientInfo(ws);
    if (!info?.roomCode) {
      this.broadcaster.sendError(ws, 'NOT_IN_ROOM', 'Not in a room');
      return;
    }

    if (!this.roomManager.isHost(info.userId)) {
      this.broadcaster.sendError(ws, 'NOT_HOST', 'Only the host can remove bots');
      return;
    }

    try {
      this.roomManager.removeBot(info.roomCode, msg.seat);
      this.broadcastRoomUpdate(info.roomCode);
    } catch (err) {
      this.broadcaster.sendError(ws, 'REMOVE_BOT_FAILED', (err as Error).message);
    }
  }

  private handleGetLobby(ws: WebSocket): void {
    const rooms = this.roomManager.getPublicRooms();
    this.broadcaster.send(ws, { type: 'LOBBY_LIST', rooms });
  }

  private handleStartGame(ws: WebSocket): void {
    const info = this.connections.getClientInfo(ws);
    if (!info?.roomCode) {
      this.broadcaster.sendError(ws, 'NOT_IN_ROOM', 'Not in a room');
      return;
    }

    if (!this.roomManager.isHost(info.userId)) {
      this.broadcaster.sendError(ws, 'NOT_HOST', 'Only the host can start the game');
      return;
    }

    const room = this.roomManager.getRoom(info.roomCode);
    if (!room) {
      this.broadcaster.sendError(ws, 'ROOM_NOT_FOUND', 'Room not found');
      return;
    }

    try {
      this.roomManager.startGame(info.roomCode);

      // Create the game via GameStore
      const game = this.gameStore.createGame(info.roomCode, room.config);

      // Seat all players into the game
      for (const player of room.players) {
        if (!player.isBot) {
          game.seatPlayer(player.seat);
          // Assign the WebSocket connection's seat to the game
          const userId = this.roomManager.getUserIdAtSeat(info.roomCode, player.seat);
          if (userId) {
            const playerWs = this.connections.getSocketByUserId(userId);
            if (playerWs) {
              this.connections.assignToRoom(playerWs, info.roomCode, player.seat);
            }
          }
        } else {
          game.seatPlayer(player.seat);
        }
      }

      // Start the game (HOST_START_GAME triggers FSM transition)
      game.handleMessage(ws, info.seat as Seat, { type: 'START_GAME' });
    } catch (err) {
      this.broadcaster.sendError(ws, 'START_GAME_FAILED', (err as Error).message);
    }
  }

  /** Broadcast ROOM_UPDATE to all players in a room */
  private broadcastRoomUpdate(roomCode: string): void {
    const room = this.roomManager.getRoom(roomCode);
    if (!room) return;

    this.broadcaster.broadcastToRoom(roomCode, {
      type: 'ROOM_UPDATE',
      players: room.players.map(p => ({
        seat: p.seat,
        name: p.name,
        isBot: p.isBot,
        isConnected: p.isConnected,
      })),
      hostSeat: room.hostSeat,
      config: room.config,
      gameInProgress: room.gameInProgress,
    });
  }

  dispose(): void {
    this.roomManager.dispose();
  }
}
