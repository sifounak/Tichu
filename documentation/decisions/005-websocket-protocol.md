# ADR-005: Custom WebSocket Protocol

**Date:** 2026-03
**Status:** Accepted

## Context

A real-time card game for 4 players plus spectators requires sub-second state
synchronization. Every card play, Tichu call, and turn transition must be reflected
immediately on all connected clients.

## Decision

Use a custom WebSocket protocol with Zod-validated messages and a discriminated union
on the `type` field for type-safe message routing.

## Rationale

- WebSocket provides true bidirectional communication with minimal overhead per message,
  critical for a game where multiple events can occur per second
- Zod schemas validate every message in both directions (client-to-server and
  server-to-client), catching malformed data at the boundary
- Discriminated union on the `type` field gives compile-time exhaustiveness checking in
  message handlers, ensuring no message type is accidentally unhandled
- REST polling would introduce unacceptable latency for real-time gameplay
- Server-Sent Events are unidirectional and would still require a separate channel for
  client-to-server actions
- gRPC adds protobuf compilation steps and browser compatibility complexity (grpc-web)
  without meaningful benefit for this use case

## Consequences

- The shared package (@tichu/shared) defines all message schemas, ensuring client and
  server always agree on the protocol
- Adding a new message type requires updating the Zod schema, the discriminated union,
  and handlers on both sides, which is deliberate but safe
- No automatic reconnection or message buffering from a library; we implement our own
  reconnection logic in ConnectionManager
