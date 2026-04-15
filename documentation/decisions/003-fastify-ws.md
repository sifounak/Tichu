# ADR-003: Fastify + ws over Express + Socket.io

**Date:** 2026-03
**Status:** Accepted

## Context

The server needs both HTTP endpoints (authentication, leaderboard queries) and real-time
WebSocket communication for game play. The framework choice affects performance,
developer experience, and the complexity of the WebSocket integration.

## Decision

Use Fastify as the HTTP framework and the `ws` library for WebSocket connections.

## Rationale

- Fastify provides built-in JSON schema validation, structured logging (via Pino), and a
  composable plugin system out of the box
- The `ws` library is a lightweight, standards-compliant WebSocket implementation without
  the overhead of Socket.io's fallback transports, rooms, and namespaces (none of which
  we need)
- Room broadcast and connection tracking are handled by our own ConnectionManager, giving
  us full control over the player-to-socket mapping
- Fastify benchmarks significantly faster than Express for JSON serialization and routing
- Fastify's lifecycle hooks (onRequest, preHandler) cleanly separate authentication from
  route logic

## Consequences

- We own the WebSocket connection lifecycle (heartbeats, reconnection, cleanup) rather
  than relying on Socket.io's built-in handling
- No automatic fallback to long-polling if WebSocket is unavailable, though this is
  acceptable since all modern browsers support WebSocket natively
- Adding features like namespaces or multiplexing would require custom implementation
