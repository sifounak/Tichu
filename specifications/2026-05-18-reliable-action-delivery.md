# Specification: Reliable Action Delivery

**Date:** 2026-05-18
**Type:** Feature
**Confidence:** High

## Goal

Implement reliable action delivery — a client-side retry mechanism with server-side acknowledgment and idempotency — so that player actions are guaranteed to reach the server even over spotty/lossy connections, without risk of duplicate execution.

### Problem Statement

On unreliable networks, the current fire-and-forget WebSocket sends silently fail. The client clears UI state optimistically but the server never receives the message, leaving the player stuck with no feedback. Users must manually re-submit actions (sometimes multiple times) to progress the game.

### Solution Overview

1. Client assigns a unique `messageId` to every outbound action
2. Client tracks pending actions in a queue with retry logic
3. Server acknowledges every processed message with ACK/NACK
4. Server maintains an idempotency map to prevent duplicate execution
5. Client auto-retries unacknowledged actions with backoff
6. UI feedback (spinner) appears after 3s; state is restored on failure

## Requirements

### Functional Requirements

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| REQ-F-RAD01 | Client assigns a unique `messageId` to every outbound message except HEARTBEAT_PONG | All non-heartbeat messages include a UUID `messageId` field |
| REQ-F-RAD02 | Client tracks pending actions in a queue with timestamp and retry count | PendingActionManager stores messageId, payload, sentAt, retryCount |
| REQ-F-RAD03 | Server responds with `ACK { messageId }` after successfully processing a message | Every processed message triggers an ACK back to the sender |
| REQ-F-RAD04 | Server responds with `NACK { messageId, error }` for validation/processing failures | Client receives NACK and treats it as terminal (no retry) |
| REQ-F-RAD05 | Client auto-retries unacknowledged actions at 2s, 4s, 6s intervals (3 retries max) | Retry fires at correct intervals; stops after 3rd attempt |
| REQ-F-RAD06 | Server maintains an idempotency map (messageId → result, TTL ~60s) | Duplicate messageIds are re-ACK'd without re-executing the action |
| REQ-F-RAD07 | After 3s without ACK/NACK, client displays a spinner overlay on action buttons | Spinner appears at 3s, disappears on ACK/NACK/failure |
| REQ-F-RAD08 | On final retry failure, client restores pre-action UI state (e.g., re-selects cards) and shows error | Cards/state restored; error toast shown |
| REQ-F-RAD09 | On WebSocket reconnection, pending actions automatically retry on the new connection | Pending queue survives reconnect; retries resume immediately |
| REQ-F-RAD10 | On ACK received, client removes action from pending queue and clears any spinner | Pending queue shrinks; spinner hidden |
| REQ-F-RAD11 | On NACK received, client removes action from pending queue, shows error, restores state | No retry; error displayed; UI state restored |
| REQ-F-RAD12 | Chat messages are included in the retry system (not fire-and-forget) | Chat messages get messageId, ACK, and retry |
| REQ-F-RAD13 | Client captures a pre-action UI snapshot before clearing optimistic state | Selected cards, pending selections stored per-pending-action; used for restoration |

### Non-Functional Requirements

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| REQ-NF-RAD01 | ACK round-trip adds no perceptible latency to normal gameplay (< 100ms on healthy connection) | ACK processing is synchronous with message handling — no extra async delay |
| REQ-NF-RAD02 | Idempotency map memory is bounded (TTL-based eviction, max ~1000 entries per room) | Map entries auto-expire; no unbounded growth |
| REQ-NF-RAD03 | Retry mechanism does not block the UI thread or prevent other interactions | Retries run on timers; UI remains responsive |
| REQ-NF-RAD04 | Existing test coverage for WebSocket communication is maintained or improved | No coverage regression; new code at 80%+ |

### Constraints

- Must work with existing native WebSocket (ws library) — no Socket.io migration
- Protocol change must be backwards-compatible: server handles messages without messageId gracefully (processes without ACK)
- No new npm dependencies required (crypto.randomUUID is native)
- Changes span shared, client, and server packages

### Assumptions

- WebSocket readyState === OPEN is necessary but not sufficient for delivery (packets can still be lost)
- Server processing is fast enough that ACK delay is dominated by network RTT
- Game state advances linearly — a stale retry will fail validation and NACK, which is correct

## Scope

### In Scope

- Client-side PendingActionManager with retry logic
- Server-side ACK/NACK responses for all message types
- Server-side idempotency map with TTL eviction
- Protocol schema updates (messageId field, ACK/NACK message types)
- Spinner overlay UI component
- Pre-action state snapshot and restoration
- Integration with existing reconnection logic

### Out of Scope

- Offline action queueing (actions only retry while app is open)
- Server-to-client message reliability (GAME_STATE broadcasts) — these are already implicitly reliable since reconnection triggers a full state resync
- Persistent action queue across page refreshes (accepted behavior: refresh = lose pending queue, but server state is authoritative)
- Message ordering guarantees (server validates state per-action; order doesn't matter)

## Edge Cases & Accepted Behaviors

| Scenario | Behavior |
|---|---|
| ACK arrives after retry already sent | Server re-ACKs duplicate messageId; client de-dupes |
| Action becomes stale after reconnect (e.g., not your turn anymore) | Retry gets NACK; client shows error and restores state |
| Multiple rapid actions queued | Each gets independent messageId; retry independently |
| Page refresh with pending actions | Queue lost; server state is authoritative; user sees correct state on reload |
| Server restart clears idempotency map | Retry of already-processed action fails validation → NACK → correct |
| User refreshes before receiving NACK | Queue lost; full GAME_STATE on reconnect shows correct state |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Retry storms under sustained packet loss | Low | Medium | Exponential backoff (2s, 4s, 6s) + max 3 retries caps load |
| Idempotency map grows unbounded | Low | Low | TTL eviction (60s) + max entries per room (1000) |
| messageId collisions | Negligible | High | crypto.randomUUID() — collision probability ~0 |
| Protocol breaking change requires lockstep deploy | Medium | Medium | Server gracefully handles messages without messageId (legacy) |

## Success Metrics

1. On a connection with 30% packet loss, player actions succeed within 6s without manual re-submission
2. No duplicate action execution — idempotency prevents double-plays under aggressive retry
3. Spinner appears at exactly 3s and disappears immediately on resolution
4. Zero regression in existing tests; new code at 80%+ coverage
5. Graceful degradation — legacy clients without messageId are processed normally (no ACK sent)
