# Requirements Traceability Matrix — WebSocket Reconnection & Seat Swap

| Req ID | Description | Milestone | Source File(s) | Test File(s) | Status |
|--------|-------------|-----------|----------------|-------------|--------|
| REQ-F-001 | Server reconnection on new WebSocket | M1 | `server/src/app.ts:110-117` | Existing suite (546 pass) | Passed |
| REQ-F-002 | Mark disconnected on ws close | M1 | `server/src/app.ts:130` | Existing suite (546 pass) | Passed |
| REQ-F-003 | Persist playerName in sessionStorage | M1 | `client/src/app/lobby/page.tsx:63,71,78` | Manual | Passed |
| REQ-F-004 | Room page auto-join timing fix | M1 | `client/src/app/lobby/[roomId]/page.tsx:71-78` | Manual | Passed |
| REQ-F-005 | broadcastRoomUpdate public access | M1 | `server/src/room/room-handler.ts:218` | N/A | Passed |
| REQ-F-006 | Seat swap feature | M2 | `protocol.ts:46`, `room-manager.ts:284-337`, `room-handler.ts:218-240`, `[roomId]/page.tsx:97,146-179` | `room-manager.test.ts:349-408` | Passed |
| REQ-F-007 | Block swap during game | M2 | `room-manager.ts:293` | `room-manager.test.ts:398-404` | Passed |
| REQ-NF-001 | Reconnection within 200ms | M1 | `server/src/app.ts:110-117` | Manual | Passed |
| REQ-NF-002 | No breaking protocol changes | M1, M2 | `protocol.ts` | Existing tests (554 pass) | Passed |
