# Milestone 8: Server WebSocket Layer

**Package(s):** server
**Requirements:** Real-time client-server communication

## Goal

Implement the WebSocket infrastructure: connection management, message routing, state projection, and broadcasting.

## Tasks

### 8.1 Connection manager (`packages/server/src/ws/connection-manager.ts`)
- Track connected clients: `Map<WebSocket, { userId, roomCode, seat }>`
- Handle connect/disconnect lifecycle
- Heartbeat/ping-pong for connection health
- Reconnection: match returning user to their seat

### 8.2 Message router (`packages/server/src/ws/message-router.ts`)
- Parse incoming JSON messages
- Validate with Zod schemas from `@tichu/shared`
- Route to appropriate handler (room, game, chat)
- Error handling: invalid message format, unknown types

### 8.3 Broadcaster (`packages/server/src/ws/broadcaster.ts`)
- `broadcastToRoom(roomCode, message)` — all players in room
- `sendToPlayer(seat, message)` — single player
- `broadcastGameState(gameId)` — send projected views (each player gets their own view)
- `broadcastToSpectators(gameId, message)` — spectator feed

### 8.4 State projection
- `projectGameState(fullState: GameState, forSeat: Seat): ClientGameView`
  - Hide other players' hands (show only card count)
  - Include own hand, trick state, scores, phase, indicators
  - Include selectable cards (pre-computed by hand-filter)

### 8.5 Server setup (`packages/server/src/app.ts`)
- Fastify HTTP server with health endpoint
- WebSocket upgrade handler
- CORS configuration
- Environment config (port, DB URL)

## Tests

- Connection lifecycle: connect, authenticate, disconnect, reconnect
- Message validation: valid messages route correctly, invalid rejected with error
- State projection: other players' hands hidden, own hand visible
- Broadcasting: message reaches all room members
- Heartbeat: stale connections detected and cleaned up

## Verification

1. All tests pass
2. Coverage ≥ 80%
3. Manual test: connect via wscat, send messages, receive responses
