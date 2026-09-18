# Milestone 5: Integration + Edge Cases + Coverage

## Date: 2026-05-18

## Summary

Added integration tests covering end-to-end reliable delivery scenarios and verified coverage across all packages.

## Key Decisions

1. **Server-side tests already comprehensive from M2** — 8 tests in message-router-ack.test.ts + 8 in idempotency-map.test.ts already covered all M5 server scenarios (ACK on success, NACK on error, idempotency replay, HEARTBEAT_PONG bypass, unauthenticated NACK, no-handler NACK).
2. **Client integration tests focus on full flows** — 7 new integration tests exercise the useWebSocket + PendingActionManager combination end-to-end: ACK path, timeout path, reconnect+retry path, NACK with snapshot, ACK/NACK non-bubbling, HEARTBEAT_PONG bypass, disconnect cancellation.
3. **Coverage threshold passing** — vitest configured with 80% statement threshold; no threshold violation. Total: 947 server tests, 427 shared tests, 244 client tests (excluding 2 pre-existing PhoenixValuePicker failures).

## Files Created
- `code/packages/client/tests/services/PendingActionManager.integration.test.ts` — 7 end-to-end integration tests

## Test Results
- Server: 947/947 pass
- Shared: 427/427 pass
- Client: 244/246 pass (2 pre-existing PhoenixValuePicker failures)
- Typecheck: clean across all packages
- useWebSocket.ts: 88% statement coverage
- uiStore.ts: 97% statement coverage
- PendingActionManager: 24 tests (17 unit + 7 integration) covering all branches

## Requirements Finalized
- REQ-F-RAD09: Reconnect retry verified via integration test
- REQ-NF-RAD04: All existing tests maintained, new code above 80%
