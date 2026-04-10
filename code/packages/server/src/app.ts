// REQ-NF-A02: Server authoritative — Fastify HTTP + WebSocket server setup
// REQ-F-AU01: Guest access integration
// REQ-F-AU02: Account auth integration

import Fastify from 'fastify';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { ConnectionManager } from './ws/connection-manager.js';
import { Broadcaster } from './ws/broadcaster.js';
import { MessageRouter } from './ws/message-router.js';
import { GameStore } from './game/game-store.js';
import { RoomHandler } from './room/room-handler.js';
import { GameHandler } from './game/game-handler.js';
import { createDatabase, type Database } from './db/connection.js';
import { registerAuthRoutes } from './auth/auth-routes.js';
import { recoverFromCrash } from './db/event-persistence.js';

export interface AppConfig {
  port: number;
  host: string;
  corsOrigin: string;
  pingIntervalMs?: number;
  staleThresholdMs?: number;
  databasePath?: string;
  jwtSecret?: string;
}

const DEFAULT_CONFIG: AppConfig = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  host: '0.0.0.0',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
};

/**
 * Creates and configures the Fastify server with WebSocket upgrade support.
 * Returns the server components for external use and testing.
 */
export function createApp(config: Partial<AppConfig> = {}) {
  const cfg: AppConfig = { ...DEFAULT_CONFIG, ...config };

  // ─── Fastify HTTP server ─────────────────────────────────────────────
  const fastify = Fastify({ logger: true });

  // CORS headers
  fastify.addHook('onRequest', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', cfg.corsOrigin);
    reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (request.method === 'OPTIONS') {
      reply.status(204).send();
    }
  });

  // Health endpoint
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // ─── Database & Auth ─────────────────────────────────────────────────
  const dbPath = cfg.databasePath ?? process.env.DATABASE_PATH ?? './data/tichu.sqlite';
  const jwtSecret = cfg.jwtSecret ?? process.env.JWT_SECRET ?? 'tichu-dev-secret';
  let database: Database | null = null;
  try {
    database = createDatabase(dbPath);
    registerAuthRoutes(fastify, database, jwtSecret);
    // REQ-F-ST05: Recover any event data from previous server crashes
    try {
      recoverFromCrash(database);
    } catch (recoveryErr) {
      fastify.log.warn(`Event data recovery failed: ${recoveryErr instanceof Error ? recoveryErr.message : recoveryErr}`);
    }
  } catch (err) {
    fastify.log.warn(`Database unavailable (${err instanceof Error ? err.message : err}). Auth routes disabled.`);
  }

  // ─── WebSocket infrastructure ────────────────────────────────────────
  const connections = new ConnectionManager({
    pingIntervalMs: cfg.pingIntervalMs,
    staleThresholdMs: cfg.staleThresholdMs,
  });
  const broadcaster = new Broadcaster(connections);
  const router = new MessageRouter(connections, broadcaster);

  // Application-level heartbeat: HEARTBEAT_PONG from client → record liveness
  router.on('HEARTBEAT_PONG', (ws) => {
    connections.recordPong(ws);
  });

  // ─── Game & Room infrastructure ─────────────────────────────────────
  const gameStore = new GameStore(broadcaster);
  const roomHandler = new RoomHandler(router, connections, broadcaster, gameStore, undefined, database);
  // REQ-F-GMR01: Route game messages (play, pass, tichu, etc.) to GameManager
  const gameHandler = new GameHandler(router, connections, broadcaster, gameStore);

  // Create WebSocket server (no HTTP server — uses Fastify's)
  const wss = new WebSocketServer({ noServer: true });

  // Handle WebSocket upgrade requests
  fastify.server.on('upgrade', (request: IncomingMessage, socket, head) => {
    // Only upgrade requests to /ws path
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
    if (url.pathname !== '/ws') {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  // Handle new WebSocket connections
  wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
    const userId = url.searchParams.get('userId');
    const playerName = url.searchParams.get('playerName');

    if (!userId || !playerName) {
      ws.close(4001, 'Missing userId or playerName query parameters');
      return;
    }

    connections.addClient(ws, userId, playerName);

    // REQ-F-001: Detect returning user and restore room membership
    const existingRoom = roomHandler.roomManager.getUserRoom(userId);
    const existingSeat = roomHandler.roomManager.getUserSeat(userId);
    if (existingRoom && existingSeat) {
      connections.assignToRoom(ws, existingRoom, existingSeat);
      roomHandler.roomManager.markReconnected(userId);
      broadcaster.send(ws, { type: 'ROOM_JOINED', roomCode: existingRoom, seat: existingSeat });
      roomHandler.broadcastRoomUpdate(existingRoom);

      // REQ-F-SG02: If a game is in progress, send GAME_STATE to reconnected player
      const game = gameStore.getGameByRoom(existingRoom);
      if (game) {
        game.handleReconnect(ws, existingSeat);
      }
    } else {
      // REQ-F-SP13: Detect returning spectator
      const spectatorRoom = roomHandler.roomManager.getSpectatorRoom(userId);
      if (spectatorRoom) {
        connections.assignAsSpectator(ws, spectatorRoom);
        roomHandler.roomManager.markSpectatorReconnected(userId);
        broadcaster.send(ws, { type: 'ROOM_JOINED', roomCode: spectatorRoom, seat: null });
        roomHandler.broadcastRoomUpdate(spectatorRoom);

        // Send game state if game in progress
        const game = gameStore.getGameByRoom(spectatorRoom);
        if (game) {
          game.sendSpectatorState(ws);
        }

        // Resend queue state if a seat queue is active (preserves place in line on refresh)
        roomHandler.resendQueueState(spectatorRoom, userId);
      }
    }

    // Note: protocol-level ws.on('pong') removed — browser network stack auto-responds
    // to protocol pings even after tab close. Application-level HEARTBEAT_PONG (via
    // message router) requires JavaScript to respond, so it correctly detects tab closure.

    ws.on('message', (data) => {
      const message = typeof data === 'string' ? data : data.toString();
      router.handleMessage(ws, message);
    });

    ws.on('close', () => {
      const info = connections.removeClient(ws);
      if (info?.roomCode) {
        // REQ-F-SP13: Check if spectator first
        if (roomHandler.roomManager.isSpectator(info.userId)) {
          roomHandler.roomManager.markSpectatorDisconnected(info.userId);
          // No PLAYER_DISCONNECTED broadcast for spectators
        } else if (info.seat) {
          // REQ-F-002: Mark player as disconnected (preserves room membership for reconnection)
          roomHandler.roomManager.markDisconnected(info.userId);

          // REQ-F-ES04: If game is in progress, trigger disconnect vote flow
          const room = roomHandler.roomManager.getRoom(info.roomCode);
          const game = gameStore.getGameByRoom(info.roomCode);
          if (room?.gameInProgress && game) {
            game.handleDisconnect(info.seat);
          } else {
            // No game in progress — just broadcast disconnection
            broadcaster.broadcastToRoom(info.roomCode, {
              type: 'PLAYER_DISCONNECTED',
              seat: info.seat,
            });
          }
        }
      }
    });

    ws.on('error', () => {
      // No-op: 'close' always fires after 'error' in the ws library,
      // and the close handler does full cleanup (removeClient + disconnect logic).
    });
  });

  // Stale connection handler — ws.terminate() triggers 'close' event which does full cleanup
  connections.onStaleConnection = (_ws, info) => {
    fastify.log.info(`Stale connection detected for user ${info.userId} (room: ${info.roomCode ?? 'none'})`);
  };

  return {
    fastify,
    wss,
    connections,
    broadcaster,
    router,
    gameStore,
    roomHandler,
    gameHandler,
    database,
    config: cfg,

    /** Start listening and begin heartbeat */
    async start(): Promise<void> {
      await fastify.listen({ port: cfg.port, host: cfg.host });
      connections.startHeartbeat();
      roomHandler.roomManager.startCleanup();
      fastify.log.info(`Tichu server listening on port ${cfg.port}`);
    },

    /** Graceful shutdown */
    async stop(): Promise<void> {
      roomHandler.dispose();
      gameStore.dispose();
      connections.dispose();
      wss.close();
      if (database) database.close();
      await fastify.close();
    },
  };
}

export type App = ReturnType<typeof createApp>;
