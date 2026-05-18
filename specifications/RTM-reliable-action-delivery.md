# Requirements Traceability Matrix — Reliable Action Delivery

| Req ID | Description | Milestone | Source File(s) | Test File(s) | Status |
|--------|-------------|-----------|----------------|--------------|--------|
| REQ-F-RAD01 | Client assigns unique messageId to every outbound message except HEARTBEAT_PONG | M1, M3 | code/packages/shared/src/types/protocol.ts:38 | code/packages/shared/tests/types/protocol.test.ts:298 | In Progress |
| REQ-F-RAD02 | Client tracks pending actions (messageId, payload, sentAt, retryCount) | M3 | | | Not Started |
| REQ-F-RAD03 | Server responds with ACK { messageId } on successful processing | M1, M2 | code/packages/shared/src/types/protocol.ts:175 | code/packages/shared/tests/types/protocol.test.ts:297 | In Progress |
| REQ-F-RAD04 | Server responds with NACK { messageId, error } on failure | M1, M2 | code/packages/shared/src/types/protocol.ts:176 | code/packages/shared/tests/types/protocol.test.ts:303 | In Progress |
| REQ-F-RAD05 | Client retries at 2s, 4s, 6s (3 max) | M3 | | | Not Started |
| REQ-F-RAD06 | Server idempotency map (messageId → result, TTL 60s, max 1000/room) | M2 | | | Not Started |
| REQ-F-RAD07 | Spinner overlay after 3s without ACK/NACK | M4 | | | Not Started |
| REQ-F-RAD08 | On final failure, restore pre-action UI state + error toast | M4 | | | Not Started |
| REQ-F-RAD09 | On reconnection, pending actions auto-retry | M3, M5 | | | Not Started |
| REQ-F-RAD10 | On ACK, remove from pending queue, clear spinner | M3, M4 | | | Not Started |
| REQ-F-RAD11 | On NACK, remove from pending, show error, restore state | M3, M4 | | | Not Started |
| REQ-F-RAD12 | Chat messages included in retry system | M3 | | | Not Started |
| REQ-F-RAD13 | Client captures pre-action UI snapshot before clearing state | M4 | | | Not Started |
| REQ-NF-RAD01 | ACK adds no perceptible latency (<100ms) | M2 | | | Not Started |
| REQ-NF-RAD02 | Idempotency map bounded (TTL 60s, max 1000/room) | M2 | | | Not Started |
| REQ-NF-RAD03 | Retry doesn't block UI thread | M3 | | | Not Started |
| REQ-NF-RAD04 | Existing test coverage maintained, new code 80%+ | M5 | | | Not Started |
