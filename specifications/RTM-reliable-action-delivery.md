# Requirements Traceability Matrix — Reliable Action Delivery

| Req ID | Description | Milestone | Source File(s) | Test File(s) | Status |
|--------|-------------|-----------|----------------|--------------|--------|
| REQ-F-RAD01 | Client assigns unique messageId to every outbound message except HEARTBEAT_PONG | M1, M3 | code/packages/shared/src/types/protocol.ts:38, code/packages/client/src/hooks/useWebSocket.ts:177 | code/packages/shared/tests/types/protocol.test.ts:298, code/packages/client/tests/hooks/useWebSocket.test.ts:130 | Passed |
| REQ-F-RAD02 | Client tracks pending actions (messageId, payload, sentAt, retryCount) | M3 | code/packages/client/src/services/PendingActionManager.ts:42 | code/packages/client/tests/services/PendingActionManager.test.ts:42 | Passed |
| REQ-F-RAD03 | Server responds with ACK { messageId } on successful processing | M1, M2 | code/packages/server/src/ws/message-router.ts:113 | code/packages/server/tests/ws/message-router-ack.test.ts:42 | Passed |
| REQ-F-RAD04 | Server responds with NACK { messageId, error } on failure | M1, M2 | code/packages/server/src/ws/message-router.ts:122 | code/packages/server/tests/ws/message-router-ack.test.ts:66 | Passed |
| REQ-F-RAD05 | Client retries at 2s, 4s, 6s (3 max) | M3 | code/packages/client/src/services/PendingActionManager.ts:105 | code/packages/client/tests/services/PendingActionManager.test.ts:57 | Passed |
| REQ-F-RAD06 | Server idempotency map (messageId → result, TTL 60s, max 1000/room) | M2 | code/packages/server/src/ws/idempotency-map.ts | code/packages/server/tests/ws/idempotency-map.test.ts | Passed |
| REQ-F-RAD07 | Spinner overlay after 3s without ACK/NACK | M4 | code/packages/client/src/components/game/ActionSpinner.tsx:8, code/packages/client/src/stores/uiStore.ts:138 | code/packages/client/tests/services/PendingActionManager.test.ts:88 | Passed |
| REQ-F-RAD08 | On final failure, restore pre-action UI state + error toast | M4 | code/packages/client/src/app/game/[gameId]/page.tsx:455, code/packages/client/src/stores/uiStore.ts:293 | code/packages/client/tests/services/PendingActionManager.test.ts:70 | Passed |
| REQ-F-RAD09 | On reconnection, pending actions auto-retry | M3, M5 | code/packages/client/src/services/PendingActionManager.ts:87, code/packages/client/src/hooks/useWebSocket.ts:100 | code/packages/client/tests/services/PendingActionManager.test.ts:131 | In Progress |
| REQ-F-RAD10 | On ACK, remove from pending queue, clear spinner | M3, M4 | code/packages/client/src/services/PendingActionManager.ts:72, code/packages/client/src/hooks/useWebSocket.ts:117, code/packages/client/src/app/game/[gameId]/page.tsx:453 | code/packages/client/tests/services/PendingActionManager.test.ts:98 | Passed |
| REQ-F-RAD11 | On NACK, remove from pending, show error, restore state | M3, M4 | code/packages/client/src/services/PendingActionManager.ts:79, code/packages/client/src/hooks/useWebSocket.ts:122, code/packages/client/src/app/game/[gameId]/page.tsx:455 | code/packages/client/tests/services/PendingActionManager.test.ts:118 | Passed |
| REQ-F-RAD12 | Chat messages included in retry system | M3 | code/packages/client/src/hooks/useWebSocket.ts:187 | code/packages/client/tests/services/PendingActionManager.test.ts:163 | Passed |
| REQ-F-RAD13 | Client captures pre-action UI snapshot before clearing state | M4 | code/packages/client/src/app/game/[gameId]/page.tsx:544, code/packages/client/src/services/PendingActionManager.ts:12 | code/packages/client/tests/services/PendingActionManager.test.ts:51 | Passed |
| REQ-NF-RAD01 | ACK adds no perceptible latency (<100ms) | M2 | code/packages/server/src/ws/message-router.ts:113 | — (synchronous with handler) | Passed |
| REQ-NF-RAD02 | Idempotency map bounded (TTL 60s, max 1000/room) | M2 | code/packages/server/src/ws/idempotency-map.ts | code/packages/server/tests/ws/idempotency-map.test.ts:48,63 | Passed |
| REQ-NF-RAD03 | Retry doesn't block UI thread | M3 | code/packages/client/src/services/PendingActionManager.ts:105 | — (uses setTimeout, non-blocking by design) | Passed |
| REQ-NF-RAD04 | Existing test coverage maintained, new code 80%+ | M5 | | | Not Started |
