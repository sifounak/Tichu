// REQ-F-MP02: Room codes for matchmaking
// REQ-F-MP03: Public lobby
// REQ-F-MP04: Room configuration options

import type { WebSocket } from 'ws';
import type { ClientMessage } from '@tichu/shared';
import type { ConnectionManager } from '../ws/connection-manager.js';
import type { Broadcaster } from '../ws/broadcaster.js';
import type { MessageRouter } from '../ws/message-router.js';
import { RoomManager } from './room-manager.js';
import { GameStore } from '../game/game-store.js';
import { SeatQueue } from './seat-queue.js';

/**
 * Handles room-related WebSocket messages by routing them to the RoomManager.
 * Registers handlers on the MessageRouter for CREATE_ROOM, JOIN_ROOM, etc.
 */
export class RoomHandler {
  readonly roomManager: RoomManager;
  private readonly gameStore: GameStore;
  private readonly connections: ConnectionManager;
  private readonly broadcaster: Broadcaster;
  // REQ-F-SP07: Per-room seat queues for spectator→player promotion
  private readonly seatQueues = new Map<string, SeatQueue>();

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
    router.on('SWAP_SEATS', (ws, msg) => this.handleSwapSeats(ws, msg as ClientMessage & { type: 'SWAP_SEATS' }));
    router.on('KICK_PLAYER', (ws, msg) => this.handleKickPlayer(ws, msg as ClientMessage & { type: 'KICK_PLAYER' }));
    router.on('CHOOSE_SEAT', (ws, msg) => this.handleChooseSeat(ws, msg as ClientMessage & { type: 'CHOOSE_SEAT' }));
    // REQ-F-SP18: Ready-to-start system
    router.on('READY_TO_START', (ws) => this.handleReadyToStart(ws));
    router.on('CANCEL_READY', (ws) => this.handleCancelReady(ws));
    // REQ-F-ES07: Seat queue responses
    router.on('CLAIM_SEAT', (ws, msg) => this.handleClaimSeat(ws, msg as ClientMessage & { type: 'CLAIM_SEAT' }));
    router.on('DECLINE_SEAT', (ws) => this.handleDeclineSeat(ws));
  }

  private handleCreateRoom(ws: WebSocket, msg: ClientMessage & { type: 'CREATE_ROOM' }): void {
    const info = this.connections.getClientInfo(ws);
    if (!info) {
      this.broadcaster.sendError(ws, 'NOT_AUTHENTICATED', 'Not authenticated');
      return;
    }

    try {
      const room = this.roomManager.createRoom(info.userId, msg.playerName, msg.roomName);
      // REQ-F-CG06: Apply config from CREATE_ROOM if provided
      if (msg.config) {
        this.roomManager.configureRoom(room.roomCode, msg.config);
      }
      this.connections.assignToRoom(ws, room.roomCode, room.hostSeat);

      this.broadcaster.send(ws, { type: 'ROOM_CREATED', roomCode: room.roomCode });
      this.broadcaster.send(ws, { type: 'ROOM_JOINED', roomCode: room.roomCode, seat: room.hostSeat });
      this.broadcastRoomUpdate(room.roomCode);
    } catch (err) {
      this.broadcaster.sendError(ws, 'CREATE_ROOM_FAILED', (err as Error).message);
    }
  }

  // REQ-F-SP02, SP04, SP23: Join room — auto-spectator when full, explicit spectator via flag
  private handleJoinRoom(ws: WebSocket, msg: ClientMessage & { type: 'JOIN_ROOM' }): void {
    const info = this.connections.getClientInfo(ws);
    if (!info) {
      this.broadcaster.sendError(ws, 'NOT_AUTHENTICATED', 'Not authenticated');
      return;
    }

    const room = this.roomManager.getRoom(msg.roomCode);
    const isFull = room ? room.players.length >= 4 : false;
    const shouldSpectate = msg.asSpectator || isFull;

    if (shouldSpectate && room) {
      // Join as spectator
      try {
        this.roomManager.joinAsSpectator(info.userId, msg.roomCode, msg.playerName);
        this.connections.assignAsSpectator(ws, msg.roomCode);

        this.broadcaster.send(ws, { type: 'ROOM_JOINED', roomCode: msg.roomCode, seat: null });
        this.broadcastRoomUpdate(msg.roomCode);

        // If game is in progress, send current game state to spectator
        if (room.gameInProgress) {
          const game = this.gameStore.getGameByRoom(msg.roomCode);
          if (game) {
            game.sendSpectatorState(ws);
          }
        }

        // REQ-F-SP10, SP27: If queue is active, add late-joining spectator
        const queue = this.seatQueues.get(msg.roomCode);
        if (queue?.isActive()) {
          queue.addToQueue(info.userId);
        }
      } catch (err) {
        this.broadcaster.sendError(ws, 'JOIN_ROOM_FAILED', (err as Error).message);
      }
      return;
    }

    try {
      const { room: joinedRoom, seat } = this.roomManager.joinRoom(info.userId, msg.roomCode, msg.playerName);
      this.connections.assignToRoom(ws, joinedRoom.roomCode, seat);

      this.broadcaster.send(ws, { type: 'ROOM_JOINED', roomCode: joinedRoom.roomCode, seat });
      this.broadcastRoomUpdate(joinedRoom.roomCode);

      // If a game is in progress, seat the new player into the active game
      if (joinedRoom.gameInProgress) {
        const game = this.gameStore.getGameByRoom(joinedRoom.roomCode);
        if (game) {
          game.handleSeatFilled(seat);
        }
      }

      // If a queue is active, notify it that this seat was filled externally
      const queue = this.seatQueues.get(joinedRoom.roomCode);
      if (queue?.isActive()) {
        queue.handleSeatFilledExternally(seat);
      }
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

    // REQ-F-SP02: Check if leaving as spectator
    if (this.roomManager.isSpectator(info.userId)) {
      try {
        // REQ-F-SP08: Notify queue if spectator leaves during active queue
        const spectatorRoomCode = this.roomManager.getSpectatorRoom(info.userId);
        if (spectatorRoomCode) {
          const queue = this.seatQueues.get(spectatorRoomCode);
          if (queue?.isActive()) {
            queue.handleLeave(info.userId);
          }
        }

        const { room, roomCode } = this.roomManager.leaveAsSpectator(info.userId);
        this.connections.removeFromRoom(ws);
        this.broadcaster.send(ws, { type: 'ROOM_LEFT' });
        if (room) this.broadcastRoomUpdate(roomCode);
      } catch (err) {
        this.broadcaster.sendError(ws, 'LEAVE_ROOM_FAILED', (err as Error).message);
      }
      return;
    }

    try {
      // REQ-F-ES15: Before leaving, get spectator list (room may be destroyed after leave)
      const roomCode = this.roomManager.getUserRoom(info.userId);
      const spectatorsBefore = roomCode ? this.roomManager.getSpectatorUserIds(roomCode) : [];

      const { room, roomCode: rc, seat, gameWasInProgress } = this.roomManager.leaveRoom(info.userId);
      this.connections.removeFromRoom(ws);

      // If a game was in progress, mark the seat as vacated (game stays alive)
      if (gameWasInProgress && room) {
        const game = this.gameStore.getGameByRoom(rc);
        if (game) {
          game.handleSeatVacated(seat);
        }
      }

      this.broadcaster.send(ws, { type: 'ROOM_LEFT' });

      if (room) {
        this.broadcastRoomUpdate(rc);

        // REQ-F-SP07: Start seat queue when player leaves and spectators exist
        this.tryStartSeatQueue(rc, [seat]);
      } else if (gameWasInProgress) {
        // REQ-F-ES15: Room destroyed (all players left) — notify spectators and clean up game
        for (const spectatorId of spectatorsBefore) {
          const specWs = this.connections.getSocketByUserId(spectatorId);
          if (specWs) {
            this.broadcaster.send(specWs, {
              type: 'ROOM_CLOSED',
              message: 'All players have left. The room has been closed.',
            });
            this.connections.removeFromRoom(specWs);
          }
        }
        // Clean up any active seat queue
        const queue = this.seatQueues.get(rc);
        if (queue) {
          queue.cleanup();
          this.seatQueues.delete(rc);
        }
        // Destroy the game
        this.gameStore.destroyGameByRoom(rc);
      }
    } catch (err) {
      this.broadcaster.sendError(ws, 'LEAVE_ROOM_FAILED', (err as Error).message);
    }
  }

  private handleKickPlayer(ws: WebSocket, msg: ClientMessage & { type: 'KICK_PLAYER' }): void {
    const info = this.connections.getClientInfo(ws);
    if (!info) {
      this.broadcaster.sendError(ws, 'NOT_AUTHENTICATED', 'Not authenticated');
      return;
    }

    try {
      // Find the kicked player's WebSocket before removing them
      const kickedClient = this.connections.getClientsInRoom(info.roomCode!)
        .find(c => c.info.seat === msg.seat);

      const { roomCode } = this.roomManager.kickPlayer(info.userId, msg.seat);

      // Notify the kicked player
      if (kickedClient) {
        this.connections.removeFromRoom(kickedClient.ws);
        this.broadcaster.send(kickedClient.ws, {
          type: 'KICKED',
          message: 'The host has removed you from the room.',
        });
      }

      // Update remaining players
      this.broadcastRoomUpdate(roomCode);
    } catch (err) {
      this.broadcaster.sendError(ws, 'KICK_FAILED', (err as Error).message);
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

      // REQ-F-SP30: Bots auto-ready immediately when added (before game starts)
      const room = this.roomManager.getRoom(info.roomCode);
      if (room && !room.gameInProgress) {
        this.roomManager.setReady(info.roomCode, msg.seat);
      }

      // If a queue is active, notify it that this seat was filled externally
      const queue = this.seatQueues.get(info.roomCode);
      if (queue?.isActive()) {
        queue.handleSeatFilledExternally(msg.seat);
      }

      this.broadcastRoomUpdate(info.roomCode);

      // REQ-F-SP20: Check if all ready after bot auto-ready
      if (this.roomManager.areAllReady(info.roomCode)) {
        this.startGameInternal(info.roomCode, ws);
      }
    } catch (err) {
      this.broadcaster.sendError(ws, 'ADD_BOT_FAILED', (err as Error).message);
    }
  }

  // REQ-F-SP31: Remove bot — allowed mid-game, triggers seat vacate
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
      const { wasGameInProgress } = this.roomManager.removeBot(info.roomCode, msg.seat);

      // REQ-F-SP32: If game was in progress, vacate seat
      if (wasGameInProgress) {
        const game = this.gameStore.getGameByRoom(info.roomCode);
        if (game) {
          game.handleSeatVacated(msg.seat);
        }
      }

      // Ready resets when player composition changes
      this.roomManager.resetReady(info.roomCode);
      this.broadcastRoomUpdate(info.roomCode);

      // Trigger queue for any empty seat (mid-game or pre-room) when spectators exist
      this.tryStartSeatQueue(info.roomCode, [msg.seat]);
    } catch (err) {
      this.broadcaster.sendError(ws, 'REMOVE_BOT_FAILED', (err as Error).message);
    }
  }

  private handleGetLobby(ws: WebSocket): void {
    const rooms = this.roomManager.getPublicRooms();
    this.broadcaster.send(ws, { type: 'LOBBY_LIST', rooms });
  }

  /** Legacy START_GAME handler — kept for backward compatibility. Delegates to startGameInternal. */
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

    this.startGameInternal(info.roomCode, ws);
  }

  // REQ-F-006: Handle seat swap requests
  private handleSwapSeats(ws: WebSocket, msg: ClientMessage & { type: 'SWAP_SEATS' }): void {
    const info = this.connections.getClientInfo(ws);
    if (!info?.roomCode) {
      this.broadcaster.sendError(ws, 'NOT_IN_ROOM', 'Not in a room');
      return;
    }

    try {
      const { affectedUserIds } = this.roomManager.swapSeat(info.userId, msg.targetSeat);

      // Send updated ROOM_JOINED to each affected player with their new seat
      for (const affectedUserId of affectedUserIds) {
        const newSeat = this.roomManager.getUserSeat(affectedUserId);
        const affectedWs = this.connections.getSocketByUserId(affectedUserId);
        if (affectedWs && newSeat) {
          this.connections.assignToRoom(affectedWs, info.roomCode, newSeat);
          this.broadcaster.send(affectedWs, { type: 'ROOM_JOINED', roomCode: info.roomCode, seat: newSeat });
        }
      }

      this.broadcastRoomUpdate(info.roomCode);
    } catch (err) {
      this.broadcaster.sendError(ws, 'SWAP_SEATS_FAILED', (err as Error).message);
    }
  }

  /** Handle mid-game seat choice — player picks which vacated seat to take */
  private handleChooseSeat(ws: WebSocket, msg: ClientMessage & { type: 'CHOOSE_SEAT' }): void {
    const info = this.connections.getClientInfo(ws);
    if (!info?.roomCode || !info.seat) {
      this.broadcaster.sendError(ws, 'NOT_IN_GAME', 'Not in a game');
      return;
    }

    const game = this.gameStore.getGameByRoom(info.roomCode);
    if (!game) {
      this.broadcaster.sendError(ws, 'NO_GAME', 'No active game');
      return;
    }

    const currentSeat = info.seat;
    const chosenSeat = msg.seat;

    // If choosing a different seat, swap in the room
    if (chosenSeat !== currentSeat) {
      try {
        // Move player in the room: update room players + tracking maps
        const room = this.roomManager.getRoom(info.roomCode);
        if (!room) return;
        const player = room.players.find(p => p.seat === currentSeat);
        if (player) player.seat = chosenSeat;
        // Update room-manager internal maps
        this.roomManager.reassignSeat(info.userId, currentSeat, chosenSeat, info.roomCode);
        // Update connection manager's seat
        this.connections.assignToRoom(ws, info.roomCode, chosenSeat);
        // Send new ROOM_JOINED so the client updates mySeat
        this.broadcaster.send(ws, { type: 'ROOM_JOINED', roomCode: info.roomCode, seat: chosenSeat });
      } catch (err) {
        this.broadcaster.sendError(ws, 'CHOOSE_SEAT_FAILED', (err as Error).message);
        return;
      }
    }

    // Tell the game manager the seat choice is resolved
    game.handleChooseSeat(currentSeat, chosenSeat);
  }

  // REQ-F-SP18: Player signals ready to start
  private handleReadyToStart(ws: WebSocket): void {
    const info = this.connections.getClientInfo(ws);
    if (!info?.roomCode || !info.seat) {
      this.broadcaster.sendError(ws, 'NOT_IN_ROOM', 'Not in a room with a seat');
      return;
    }

    const room = this.roomManager.getRoom(info.roomCode);
    if (!room) {
      this.broadcaster.sendError(ws, 'NOT_IN_ROOM', 'Room not found');
      return;
    }
    if (room.gameInProgress) {
      this.broadcaster.sendError(ws, 'GAME_IN_PROGRESS', 'Game already in progress');
      return;
    }

    this.roomManager.setReady(info.roomCode, info.seat);
    this.broadcastRoomUpdate(info.roomCode);

    // REQ-F-SP20: Auto-start when all 4 ready
    if (room.players.length === 4 && this.roomManager.areAllReady(info.roomCode)) {
      this.startGameInternal(info.roomCode, ws);
    }
  }

  // REQ-F-SP18: Player cancels ready
  private handleCancelReady(ws: WebSocket): void {
    const info = this.connections.getClientInfo(ws);
    if (!info?.roomCode || !info.seat) return;

    this.roomManager.cancelReady(info.roomCode, info.seat);
    this.broadcastRoomUpdate(info.roomCode);
  }

  /** REQ-F-SP20: Internal game start logic shared between ready system and legacy START_GAME. */
  private startGameInternal(roomCode: string, triggerWs: WebSocket): void {
    const room = this.roomManager.getRoom(roomCode);
    if (!room) return;

    try {
      const game = this.gameStore.createGame(roomCode, room.config);

      // REQ-F-ES04: Wire kick callback — when disconnect vote resolves to kick, vacate seats and start queue
      game.wireKickCallback((rc, seats) => {
        this.tryStartSeatQueue(rc, seats);
        this.broadcastRoomUpdate(rc);
      });

      for (const player of room.players) {
        game.seatPlayer(player.seat);
        if (!player.isBot) {
          const userId = this.roomManager.getUserIdAtSeat(roomCode, player.seat);
          if (userId) {
            const playerWs = this.connections.getSocketByUserId(userId);
            if (playerWs) {
              this.connections.assignToRoom(playerWs, roomCode, player.seat);
            }
          }
        } else {
          game.registerBot(player.seat, room.config.botDifficulty);
        }
      }

      this.roomManager.startGame(roomCode);
      this.roomManager.resetReady(roomCode);

      // Find a human player's ws to trigger the FSM
      const hostUserId = this.roomManager.getUserIdAtSeat(roomCode, room.hostSeat);
      const hostWs = hostUserId ? this.connections.getSocketByUserId(hostUserId) : triggerWs;
      game.handleMessage(hostWs ?? triggerWs, room.hostSeat, { type: 'START_GAME' });
    } catch (err) {
      this.roomManager.endGame(roomCode);
      this.gameStore.destroyGameByRoom(roomCode);
      this.broadcaster.sendError(triggerWs, 'START_GAME_FAILED', (err as Error).message);
    }
  }

  // ─── Seat Queue (REQ-F-SP07–SP10, SP27, SP28, SP31, SP32) ───────────

  /** Get or create the SeatQueue for a room, wiring callbacks. */
  private getOrCreateQueue(roomCode: string): SeatQueue {
    let queue = this.seatQueues.get(roomCode);
    if (!queue) {
      queue = new SeatQueue(roomCode, {
        onSendToSpectator: (userId, message) => {
          const ws = this.connections.getSocketByUserId(userId);
          if (ws) this.broadcaster.send(ws, message);
        },
        onSeatClaimed: (userId, seat) => {
          // REQ-F-ES07: Promote spectator to player
          this.roomManager.promoteSpectatorToPlayer(userId, seat);
          const ws = this.connections.getSocketByUserId(userId);
          if (ws) {
            this.connections.assignToRoom(ws, roomCode, seat);
            this.broadcaster.send(ws, { type: 'ROOM_JOINED', roomCode, seat });

            // Send current game state if game is in progress
            const game = this.gameStore.getGameByRoom(roomCode);
            if (game) {
              game.handleSeatFilled(seat);
            }
          }
          this.broadcastRoomUpdate(roomCode);
        },
        // REQ-F-ES16: All available seats have been filled — clear queue UI for spectators
        onAllSeatsFilled: (rc) => {
          this.seatQueues.delete(rc);
          // Send empty SEATS_AVAILABLE to clear queueStatus/seatOffer on all spectator clients
          this.broadcaster.broadcastToSpectators(rc, { type: 'SEATS_AVAILABLE', seats: [] });
          this.broadcastRoomUpdate(rc);
        },
        // REQ-F-ES10: Get current spectator list for up-for-grabs broadcast
        onGetCurrentSpectators: (rc) => {
          return this.roomManager.getSpectatorUserIds(rc);
        },
      });
      this.seatQueues.set(roomCode, queue);
    }
    return queue;
  }

  /** REQ-F-ES06, REQ-F-ES13: Start seat queue if spectators exist and seats are available.
   *  Works for both mid-game and pre-room leaves. */
  private tryStartSeatQueue(roomCode: string, vacatedSeats: import('@tichu/shared').Seat[]): void {
    if (vacatedSeats.length === 0) return;
    const spectatorIds = this.roomManager.getSpectatorUserIds(roomCode);
    if (spectatorIds.length === 0) return;

    const queue = this.getOrCreateQueue(roomCode);
    queue.startQueue(vacatedSeats, spectatorIds);
  }

  // REQ-F-ES07: Handle spectator claiming a seat (with optional specific seat choice)
  private handleClaimSeat(ws: WebSocket, msg?: ClientMessage & { type: 'CLAIM_SEAT' }): void {
    const info = this.connections.getClientInfo(ws);
    if (!info?.roomCode) {
      this.broadcaster.sendError(ws, 'NOT_IN_ROOM', 'Not in a room');
      return;
    }

    const queue = this.seatQueues.get(info.roomCode);
    if (!queue || !queue.isActive()) {
      this.broadcaster.sendError(ws, 'NO_QUEUE', 'No active seat queue');
      return;
    }

    // REQ-F-ES07: Pass optional seat for multi-vacancy picking
    const claimed = queue.handleClaim(info.userId, msg?.seat ?? undefined);
    if (!claimed) {
      this.broadcaster.sendError(ws, 'CLAIM_FAILED', 'Cannot claim seat');
    }
  }

  // REQ-F-SP08: Handle spectator declining the offered seat
  private handleDeclineSeat(ws: WebSocket): void {
    const info = this.connections.getClientInfo(ws);
    if (!info?.roomCode) {
      this.broadcaster.sendError(ws, 'NOT_IN_ROOM', 'Not in a room');
      return;
    }

    const queue = this.seatQueues.get(info.roomCode);
    if (!queue || !queue.isActive()) {
      this.broadcaster.sendError(ws, 'NO_QUEUE', 'No active seat queue');
      return;
    }

    queue.handleDecline(info.userId);
  }

  // REQ-F-005: Public access for reconnection flow
  /** Broadcast ROOM_UPDATE to all players in a room */
  // REQ-F-SP16: ROOM_UPDATE includes spectatorCount and readyPlayers
  broadcastRoomUpdate(roomCode: string): void {
    const room = this.roomManager.getRoom(roomCode);
    if (!room) return;

    const update = {
      type: 'ROOM_UPDATE' as const,
      roomName: room.roomName,
      players: room.players.map(p => ({
        seat: p.seat,
        name: p.name,
        isBot: p.isBot,
        isConnected: p.isConnected,
      })),
      hostSeat: room.hostSeat,
      config: room.config,
      gameInProgress: room.gameInProgress,
      spectatorCount: room.spectators.length,
      readyPlayers: this.roomManager.getReadySeats(roomCode),
    };

    this.broadcaster.broadcastToRoom(roomCode, update);
  }

  /** Resend queue state to a reconnecting spectator (preserves their place in line) */
  resendQueueState(roomCode: string, userId: string): void {
    const queue = this.seatQueues.get(roomCode);
    if (queue?.isActive()) {
      queue.resendStateToSpectator(userId);
    }
  }

  dispose(): void {
    for (const queue of this.seatQueues.values()) {
      queue.cleanup();
    }
    this.seatQueues.clear();
    this.roomManager.dispose();
  }
}
