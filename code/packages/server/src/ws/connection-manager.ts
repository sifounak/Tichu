// REQ-NF-A02: Server authoritative, projected state — connection management layer

import type { WebSocket } from 'ws';
import type { Seat } from '@tichu/shared';

/** Metadata associated with a WebSocket connection */
export interface ClientInfo {
  userId: string;
  playerName: string;
  roomCode: string | null;
  seat: Seat | null;
  lastPong: number;
}

/**
 * Manages WebSocket client connections: tracking, heartbeat, and reconnection.
 *
 * Clients are identified by a userId string. Each connection stores metadata
 * about which room/seat the player occupies so the broadcaster and router
 * can address messages correctly.
 */
export class ConnectionManager {
  /** Active connections indexed by WebSocket instance */
  private readonly clients = new Map<WebSocket, ClientInfo>();

  /** Reverse lookup: userId → WebSocket */
  private readonly userSockets = new Map<string, WebSocket>();

  /** Heartbeat interval handle */
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  /** How often to ping clients (ms) */
  private readonly pingIntervalMs: number;

  /** How long before a client with no pong is considered stale (ms) */
  private readonly staleThresholdMs: number;

  /** Callback invoked when a stale connection is cleaned up */
  onStaleConnection: ((ws: WebSocket, info: ClientInfo) => void) | null = null;

  constructor(options?: { pingIntervalMs?: number; staleThresholdMs?: number }) {
    this.pingIntervalMs = options?.pingIntervalMs ?? 10_000;
    this.staleThresholdMs = options?.staleThresholdMs ?? 20_000;
  }

  /** Register a new client connection */
  addClient(ws: WebSocket, userId: string, playerName: string): void {
    // If this user already has a socket, terminate the old one
    const existing = this.userSockets.get(userId);
    if (existing && existing !== ws) {
      this.removeClient(existing);
      existing.terminate();
    }

    const info: ClientInfo = {
      userId,
      playerName,
      roomCode: null,
      seat: null,
      lastPong: Date.now(),
    };

    this.clients.set(ws, info);
    this.userSockets.set(userId, ws);
  }

  /** Remove a client connection and clean up indices */
  removeClient(ws: WebSocket): ClientInfo | undefined {
    const info = this.clients.get(ws);
    if (!info) return undefined;

    this.clients.delete(ws);
    // Only remove from userSockets if this is still the active socket
    if (this.userSockets.get(info.userId) === ws) {
      this.userSockets.delete(info.userId);
    }

    return info;
  }

  /** Get the info for a connected WebSocket */
  getClientInfo(ws: WebSocket): ClientInfo | undefined {
    return this.clients.get(ws);
  }

  /** Get the WebSocket for a userId */
  getSocketByUserId(userId: string): WebSocket | undefined {
    return this.userSockets.get(userId);
  }

  /** Assign a client to a room and seat */
  assignToRoom(ws: WebSocket, roomCode: string, seat: Seat): void {
    const info = this.clients.get(ws);
    if (info) {
      info.roomCode = roomCode;
      info.seat = seat;
    }
  }

  /** REQ-F-SP02: Assign a client to a room as spectator (no seat). */
  assignAsSpectator(ws: WebSocket, roomCode: string): void {
    const info = this.clients.get(ws);
    if (info) {
      info.roomCode = roomCode;
      info.seat = null;
    }
  }

  /** Remove a client's room assignment */
  removeFromRoom(ws: WebSocket): void {
    const info = this.clients.get(ws);
    if (info) {
      info.roomCode = null;
      info.seat = null;
    }
  }

  /** Get all WebSocket connections in a given room */
  getClientsInRoom(roomCode: string): Array<{ ws: WebSocket; info: ClientInfo }> {
    const result: Array<{ ws: WebSocket; info: ClientInfo }> = [];
    for (const [ws, info] of this.clients) {
      if (info.roomCode === roomCode) {
        result.push({ ws, info });
      }
    }
    return result;
  }

  /** Get the WebSocket for a specific seat in a room */
  getClientBySeat(roomCode: string, seat: Seat): { ws: WebSocket; info: ClientInfo } | undefined {
    for (const [ws, info] of this.clients) {
      if (info.roomCode === roomCode && info.seat === seat) {
        return { ws, info };
      }
    }
    return undefined;
  }

  /** Record a pong from a client */
  recordPong(ws: WebSocket): void {
    const info = this.clients.get(ws);
    if (info) {
      info.lastPong = Date.now();
    }
  }

  /** Start the heartbeat ping interval */
  startHeartbeat(): void {
    if (this.heartbeatTimer) return;

    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      for (const [ws, info] of this.clients) {
        if (now - info.lastPong > this.staleThresholdMs) {
          // Guard against double-terminate on already-closing sockets
          if (ws.readyState !== ws.CLOSED && ws.readyState !== ws.CLOSING) {
            this.onStaleConnection?.(ws, info);
            ws.terminate(); // Will trigger 'close' event — cleanup happens there
          }
        } else {
          try {
            ws.send(JSON.stringify({ type: 'HEARTBEAT_PING' }));
          } catch {
            // Send failed — connection is broken; terminate triggers 'close' event
            ws.terminate();
          }
        }
      }
    }, this.pingIntervalMs);
  }

  /** Stop the heartbeat ping interval */
  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /** Check if a userId has a reconnectable session in the given room */
  canReconnect(userId: string, roomCode: string): { seat: Seat } | null {
    // Check if user still has a mapping but socket is gone/closed
    // The room manager would track disconnected players — here we just
    // check if there's no active socket for this user
    const existingSocket = this.userSockets.get(userId);
    if (existingSocket) {
      const info = this.clients.get(existingSocket);
      if (info?.roomCode === roomCode && info.seat) {
        return { seat: info.seat };
      }
    }
    return null;
  }

  /** Return all connected WebSocket instances */
  getAllSockets(): WebSocket[] {
    return Array.from(this.clients.keys());
  }

  /** Total number of connected clients */
  get size(): number {
    return this.clients.size;
  }

  /** Clean up all connections and timers */
  dispose(): void {
    this.stopHeartbeat();
    for (const [ws] of this.clients) {
      ws.terminate();
    }
    this.clients.clear();
    this.userSockets.clear();
  }
}
