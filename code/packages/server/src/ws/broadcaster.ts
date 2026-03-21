// REQ-NF-A02: Server authoritative, projected state — broadcasting layer

import type { WebSocket } from 'ws';
import type { Seat, ServerMessage } from '@tichu/shared';
import type { ConnectionManager } from './connection-manager.js';
import type { GameMachineContext } from '../game/game-state-machine.js';
import { projectGameState, projectSpectatorView } from './state-projection.js';

/**
 * Sends server messages to connected clients via the ConnectionManager.
 *
 * Supports broadcasting to rooms, individual players, and projected
 * game state views where each player sees only their own hand.
 */
export class Broadcaster {
  constructor(private readonly connections: ConnectionManager) {}

  /** Send a message to a single WebSocket */
  send(ws: WebSocket, message: ServerMessage): boolean {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  /** Send a message to a specific seat in a room */
  sendToPlayer(roomCode: string, seat: Seat, message: ServerMessage): boolean {
    const client = this.connections.getClientBySeat(roomCode, seat);
    if (client) {
      return this.send(client.ws, message);
    }
    return false;
  }

  /** Broadcast a message to all players in a room */
  broadcastToRoom(roomCode: string, message: ServerMessage): number {
    const clients = this.connections.getClientsInRoom(roomCode);
    let sent = 0;
    for (const { ws } of clients) {
      if (this.send(ws, message)) {
        sent++;
      }
    }
    return sent;
  }

  /**
   * REQ-NF-A02: Broadcast projected game state to each player in a room.
   * Each player receives their own view with hidden opponent hands.
   * REQ-F-SP06: Spectators (seat === null) receive a spectator-projected view.
   */
  broadcastGameState(roomCode: string, context: GameMachineContext, machineState: string, vacatedSeats: readonly Seat[] = [], choosingSeats: readonly Seat[] = [], disconnectVoteStatus?: { votes: Record<string, 'wait' | 'kick' | null>; disconnectedSeats: Seat[]; timeoutMs: number } | null): number {
    const clients = this.connections.getClientsInRoom(roomCode);
    let sent = 0;
    // REQ-F-SP05, REQ-NF-SP02: Compute spectator view once (lazy, shared across all spectators)
    let spectatorView: ReturnType<typeof projectSpectatorView> | null = null;
    for (const { ws, info } of clients) {
      if (info.seat) {
        const view = projectGameState(context, machineState, info.seat, vacatedSeats, choosingSeats, disconnectVoteStatus);
        const message: ServerMessage = { type: 'GAME_STATE', state: view };
        if (this.send(ws, message)) {
          sent++;
        }
      } else {
        // Spectator — send projected view with no hand data
        if (!spectatorView) {
          spectatorView = projectSpectatorView(context, machineState, vacatedSeats, disconnectVoteStatus);
        }
        const message: ServerMessage = { type: 'GAME_STATE', state: spectatorView };
        if (this.send(ws, message)) {
          sent++;
        }
      }
    }
    return sent;
  }

  /**
   * Broadcast a message to all spectators in a room.
   * Spectators are clients in the room without a seat assignment.
   */
  broadcastToSpectators(roomCode: string, message: ServerMessage): number {
    const clients = this.connections.getClientsInRoom(roomCode);
    let sent = 0;
    for (const { ws, info } of clients) {
      if (info.seat === null) {
        if (this.send(ws, message)) {
          sent++;
        }
      }
    }
    return sent;
  }

  /** Send an error message to a specific WebSocket */
  sendError(ws: WebSocket, code: string, errorMessage: string): boolean {
    return this.send(ws, { type: 'ERROR', code, message: errorMessage });
  }
}
