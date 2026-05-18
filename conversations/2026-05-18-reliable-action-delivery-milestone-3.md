# Milestone 3: Client PendingActionManager + Hook Integration

## Date: 2026-05-18

## Summary

Implemented the client-side PendingActionManager class and integrated it into the useWebSocket hook for reliable action delivery with retry.

## Key Decisions

1. **PendingActionManager as pure TS class** — No React dependency, testable in isolation with fake timers.
2. **Retry exhaustion triggers NACK resolution** — After 3 retries (2s/4s/6s), the manager resolves the action as a nack with code='TIMEOUT' rather than leaving it pending forever.
3. **Spinner timer independent of retry timer** — The 3s spinner fires once regardless of retry state.
4. **HEARTBEAT_PONG bypass in useWebSocket** — Sent directly without tracking, matching plan requirement.
5. **Callbacks via refs** — onSpinnerNeeded and onResolved exposed as UseWebSocketOptions with stable refs to avoid reconnection loops.

## Files Created
- `code/packages/client/src/services/PendingActionManager.ts` — Core retry/tracking logic
- `code/packages/client/tests/services/PendingActionManager.test.ts` — 15 unit tests

## Files Modified
- `code/packages/client/src/hooks/useWebSocket.ts` — Integrated PendingActionManager
- `code/packages/client/tests/hooks/useWebSocket.test.ts` — Updated assertion for messageId

## Test Results
- 15/15 PendingActionManager tests pass
- 11/11 useWebSocket tests pass
- Typecheck clean across all packages
- Pre-existing PhoenixValuePicker test failures (unrelated)

## Requirements Addressed
- REQ-F-RAD01: messageId on all outbound (except HEARTBEAT_PONG)
- REQ-F-RAD02: Pending action tracking
- REQ-F-RAD05: 2s/4s/6s retry schedule
- REQ-F-RAD09: retryAll on reconnect (partial — integration test in M5)
- REQ-F-RAD10: ACK handling (partial — UI spinner clear in M4)
- REQ-F-RAD11: NACK handling (partial — state restore in M4)
- REQ-F-RAD12: Chat messages tracked
- REQ-NF-RAD03: Non-blocking retries via setTimeout
