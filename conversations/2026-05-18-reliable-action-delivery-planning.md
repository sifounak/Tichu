# Conversation: Reliable Action Delivery — Planning

**Date:** 2026-05-18
**Phase:** 1.4–1.5 (Implementation Planning)

## Summary

Designed a 5-milestone implementation plan for reliable WebSocket action delivery:

1. **M1 — Protocol Layer:** Add optional `messageId` to all 37 client message schemas, add ACK/NACK server message types
2. **M2 — Server ACK/NACK + Idempotency:** IdempotencyMap class (per-room, TTL 60s, max 1000), MessageRouter ACK/NACK integration
3. **M3 — Client PendingActionManager:** Pure TS class with retry logic (2s/4s/6s), hook integration, reconnect retry
4. **M4 — Client UI:** Spinner overlay after 3s, pre-action snapshot capture, state restoration on failure
5. **M5 — Integration + Coverage:** Edge cases, backward compat verification, 80%+ coverage

## Key Decisions

- `messageId` added to each schema variant individually (not envelope) to preserve Zod discriminated union compatibility
- PendingActionManager is a standalone class (not Zustand store) for testability with fake timers
- Idempotency scoped per-room with `'__lobby'` fallback for pre-room messages
- Single `pendingActionSpinner` boolean in uiStore (not per-action tracking)
- HEARTBEAT_PONG explicitly excluded from tracking/ACK
- Backward-compatible: messages without messageId processed normally, no ACK sent

## Architecture Exploration

Explored 3 package layers:
- **Shared:** Zod discriminated unions for 37 client + 31 server message types, flat JSON (no envelope)
- **Server:** MessageRouter (parse → validate → auth → route → handler), Broadcaster (send/broadcastToRoom/sendError)
- **Client:** useWebSocket hook (send returns boolean, reconnect with backoff, heartbeat auto-response)
