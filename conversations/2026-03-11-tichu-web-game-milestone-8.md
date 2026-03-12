# Milestone 8 — Server WebSocket Layer — Conversation Transcript

**Date:** 2026-03-11
**Milestone:** 8 — Server WebSocket Layer
**Package:** @tichu/server

## Summary

Implemented the WebSocket infrastructure layer for the Tichu game server, providing real-time client-server communication.

### Key Decisions

1. **Connection Manager pattern**: Tracks clients via `Map<WebSocket, ClientInfo>` with reverse lookup by userId. Supports heartbeat/ping-pong for connection health and reconnection detection.

2. **Message Router with Zod**: All incoming messages parsed as JSON, validated against `clientMessageSchema` from `@tichu/shared`, then routed to registered handlers. Invalid messages receive typed error responses.

3. **State Projection**: `projectGameState()` transforms the full `GameMachineContext` into per-player `ClientGameView` that hides opponents' hands (showing only card counts). XState machine state names mapped to `GamePhase` enum values.

4. **Broadcaster**: Three broadcast modes — `broadcastToRoom` (all players), `sendToPlayer` (specific seat), `broadcastGameState` (projected per-player views), `broadcastToSpectators` (clients without seats).

5. **Server Setup**: `createApp()` factory creates Fastify HTTP server with WebSocket upgrade on `/ws` path. CORS configured. Authentication via `userId` + `playerName` query parameters.

6. **Coverage exclusions**: `app.ts` (Fastify wiring), `index.ts` (entry point), `ws/index.ts` (barrel export) excluded from coverage — these are integration/wiring files.

### Files Created

- `code/packages/server/src/ws/connection-manager.ts` — ConnectionManager class
- `code/packages/server/src/ws/message-router.ts` — MessageRouter with Zod validation
- `code/packages/server/src/ws/state-projection.ts` — projectGameState function
- `code/packages/server/src/ws/broadcaster.ts` — Broadcaster class
- `code/packages/server/src/ws/index.ts` — Barrel exports
- `code/packages/server/src/app.ts` — Fastify + WebSocket server factory

### Files Modified

- `code/packages/server/src/index.ts` — Updated to use `createApp()`
- `code/packages/server/vitest.config.ts` — Added coverage exclusions

### Test Results

- **Server tests:** 106 passing (52 new + 54 existing)
- **Coverage:** 87.18% statements (threshold: 80%)
- **WebSocket layer coverage:** 100% (all 4 source files)
- **Shared regression:** 367 tests — all passing

### Requirements Addressed

- REQ-NF-A02: Server authoritative, projected state — **Passed**
- REQ-NF-A03: Zod validation on WebSocket messages — **Passed**
- REQ-NF-P03: WebSocket latency < 100ms local — **In Progress** (infrastructure ready)
