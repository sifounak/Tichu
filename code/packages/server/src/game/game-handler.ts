// REQ-F-GMR01: Route game WebSocket messages to GameManager
// REQ-F-GMR02: Validate player is in a room with a seat and game exists
// REQ-F-GMR03: Handle CHAT_MESSAGE directly (broadcast to room)

import type { WebSocket } from 'ws';
import type { ClientMessage, Seat } from '@tichu/shared';
import type { ConnectionManager } from '../ws/connection-manager.js';
import type { Broadcaster } from '../ws/broadcaster.js';
import type { MessageRouter } from '../ws/message-router.js';
import type { GameStore } from './game-store.js';

/** Game message types that should be routed to GameManager */
const GAME_MESSAGE_TYPES = [
  'GRAND_TICHU_DECISION',
  'TICHU_DECLARATION',
  'PASS_CARDS',
  'CANCEL_PASS_CARDS',
  'PLAY_CARDS',
  'PASS_TURN',
  'DECLARE_WISH',
  'GIFT_DRAGON',
  'DISCONNECT_VOTE',
  // REQ-F-PV20: Player-initiated vote messages
  'START_KICK_VOTE',
  'START_RESTART_VOTE',
  'PLAYER_VOTE',
] as const;

/**
 * REQ-F-GMR01: Handles game-related WebSocket messages by routing them
 * to the appropriate GameManager instance.
 *
 * Registers handlers on the MessageRouter for all game action message types.
 * Each handler validates the player context and delegates to GameManager.
 */
export class GameHandler {
  constructor(
    router: MessageRouter,
    private readonly connections: ConnectionManager,
    private readonly broadcaster: Broadcaster,
    private readonly gameStore: GameStore,
  ) {
    // Register all game message types to route through GameManager
    for (const type of GAME_MESSAGE_TYPES) {
      router.on(type, (ws, msg) => this.routeGameMessage(ws, msg));
    }

    // REQ-F-GMR03: Chat handled directly — broadcast to room without going through GameManager
    router.on('CHAT_MESSAGE', (ws, msg) => this.handleChatMessage(ws, msg as ClientMessage & { type: 'CHAT_MESSAGE' }));
  }

  /**
   * REQ-F-GMR02: Common routing logic for all game messages.
   * Validates player context and delegates to the game's handleMessage.
   */
  private routeGameMessage(ws: WebSocket, message: ClientMessage): void {
    const info = this.connections.getClientInfo(ws);
    if (!info?.roomCode || !info.seat) {
      this.broadcaster.sendError(ws, 'NOT_IN_GAME', 'You must be in a game to perform this action');
      return;
    }

    const game = this.gameStore.getGameByRoom(info.roomCode);
    if (!game) {
      this.broadcaster.sendError(ws, 'NO_GAME', 'No active game in this room');
      return;
    }

    game.handleMessage(ws, info.seat as Seat, message);
  }

  /**
   * REQ-F-GMR03: Handle chat messages by broadcasting to the room.
   * Chat is not a game-engine action, so it bypasses GameManager.
   */
  private handleChatMessage(ws: WebSocket, msg: ClientMessage & { type: 'CHAT_MESSAGE' }): void {
    const info = this.connections.getClientInfo(ws);
    if (!info?.roomCode || !info.seat) {
      this.broadcaster.sendError(ws, 'NOT_IN_GAME', 'You must be in a game to chat');
      return;
    }

    this.broadcaster.broadcastToRoom(info.roomCode, {
      type: 'CHAT_RECEIVED',
      from: info.seat,
      text: msg.text,
    });
  }
}
