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
import { saveActiveGames, saveActiveRooms, loadActiveGames, loadActiveRooms, clearActiveGames, clearActiveRooms } from './db/active-game-persistence.js';
import { GameManager } from './game/game-manager.js';
import { recoverFromCrash } from './db/event-persistence.js';
import { rebuildStatsCache } from './db/stats-cache.js';

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
    // REQ-F-MC02: Rebuild stats cache on startup to ensure consistency
    // after backfillPlayerRoundsUserId populates previously-NULL user_ids.
    try {
      rebuildStatsCache(database);
    } catch (rebuildErr) {
      const cause = rebuildErr instanceof Error && rebuildErr.cause ? ` Cause: ${rebuildErr.cause}` : '';
      fastify.log.warn(`Stats cache rebuild failed: ${rebuildErr instanceof Error ? rebuildErr.message : rebuildErr}${cause}`);
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

  // Wire room destruction → game cleanup
  roomHandler.roomManager.onRoomDestroyed = (roomCode) => {
    gameStore.destroyGameByRoom(roomCode);
  };

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
        gameStore.cancelReconnectionTTL(game.gameId);
        game.resumeAfterRestore();
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

      const restored = this.restoreActiveGames();
      if (restored > 0) {
        fastify.log.info(`Restored ${restored} active games from previous session`);
      }

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

    /** Restore active games and rooms from the database (after server restart). */
    restoreActiveGames(): number {
      if (!database) return 0;
      const roomSnapshots = loadActiveRooms(database);
      const gameSnapshots = loadActiveGames(database);
      if (gameSnapshots.length === 0) return 0;

      roomHandler.roomManager.restoreRooms(roomSnapshots);

      const TTL_MS = 5 * 60 * 1000;
      for (const snapshot of gameSnapshots) {
        try {
          const manager = GameManager.restore(
            snapshot,
            broadcaster,
            gameStore.disconnectHandler,
            gameStore.voteHandler,
          );
          // [Stats]: Re-wire seat→userId resolver — GameManager.restore creates
          // a fresh GameEventCapture which has no resolver by default.
          manager.wireSeatUserIdResolver((seat) => {
            return roomHandler.roomManager.getUserIdAtSeat(manager.roomCode, seat) ?? null;
          });
          gameStore.restoreGame(manager, { ttlMs: TTL_MS });
          roomHandler.wireGameCallbacks(manager, snapshot.roomCode);
          fastify.log.info(`Restored game ${snapshot.gameId} for room ${snapshot.roomCode}`);
        } catch (err) {
          fastify.log.error(`Failed to restore game ${snapshot.gameId}: ${err}`);
        }
      }

      clearActiveGames(database);
      clearActiveRooms(database);
      return gameSnapshots.length;
    },

    /** Serialize active games to DB, broadcast shutdown, then stop. */
    async serializeAndShutdown(): Promise<void> {
      // 1. Broadcast shutdown notice to all connected clients
      broadcaster.broadcastToAll({ type: 'SERVER_SHUTTING_DOWN' });

      // 2. Serialize active games and rooms to DB
      if (database && gameStore.size > 0) {
        const gameSnapshots = gameStore.activeGameIds
          .map((id) => gameStore.getGame(id))
          .filter((g): g is GameManager => g !== undefined)
          .map((g) => g.serialize());
        const roomSnapshots = roomHandler.roomManager.serializeActiveRooms();
        try {
          saveActiveGames(database, gameSnapshots);
          saveActiveRooms(database, roomSnapshots);
          fastify.log.info(`Serialized ${gameSnapshots.length} games and ${roomSnapshots.length} rooms`);
        } catch (err) {
          fastify.log.error(`Failed to serialize game state: ${err}`);
        }
      }

      // 3. Normal shutdown
      await this.stop();
    },
  };
}

export type App = ReturnType<typeof createApp>;
