# Requirements Traceability Matrix — Empty Seat Filling Overhaul

## Functional Requirements

| REQ ID | Description | Milestone | Source Files | Test Files | Status |
|--------|-------------|-----------|-------------|------------|--------|
| REQ-F-ES01 | Empty Seat Visuals | M1, M4 | PlayerSeat.tsx (emptySeat prop, emptyAvatar style), PlayerSeat.module.css (.emptySeat, .emptyAvatar), GameTable.tsx (passes emptySeat), game.ts | — | Passed |
| REQ-F-ES02 | Game Halt on Player Leave | M2, M3 | game-manager.ts, state-projection.ts (gameHalted flag), seat-queue.ts | game-manager.test.ts, seat-queue.test.ts | Passed |
| REQ-F-ES03 | Explicit Leave — Immediate Queue | M2, M3, M4 | app.ts, room-handler.ts, game/[gameId]/page.tsx (beforeunload handler) | room-handler.test.ts, seat-queue.test.ts | Passed |
| REQ-F-ES04 | Disconnect — Vote Then Queue | M1, M2, M4 | disconnect-handler.ts, game-manager.ts, app.ts, state-projection.ts, protocol.ts, PlayerSeat.tsx (voteStatus prop, .voteWait/.voteKick CSS), GameTable.tsx, SpectatorOverlay.tsx (disconnectVoteActive), game page (DISCONNECT_VOTE_UPDATE handler, beforeunload) | disconnect-handler.test.ts (29 tests) | Passed |
| REQ-F-ES05 | Lobby "Join (In Progress)" Button | M1, M3, M4 | room.ts, protocol.ts, room-manager.ts:280-302, lobby/page.tsx:368-376 | — | Passed |
| REQ-F-ES06 | Spectator Queue — FIFO Offering Phase | M1, M3, M4 | seat-queue.ts, protocol.ts, SpectatorOverlay.tsx | seat-queue.test.ts (31 tests) | Passed |
| REQ-F-ES07 | Queue — Claim Seat | M3 | seat-queue.ts:106-131 (handleClaim with seat param), room-handler.ts (handleClaimSeat parses seat) | seat-queue.test.ts | Passed |
| REQ-F-ES08 | Queue — Pass or Timeout | M3 | seat-queue.ts:137-148 (handleDecline removes from queue), seat-queue.ts:253-263 (timeout removes) | seat-queue.test.ts | Passed |
| REQ-F-ES09 | Queue — Lobby Join During Processing | M3 | seat-queue.ts:155-172 (addToQueue, immediate SEATS_AVAILABLE in up-for-grabs), room-handler.ts | seat-queue.test.ts | Passed |
| REQ-F-ES10 | Up For Grabs Phase | M3, M4 | seat-queue.ts, SpectatorOverlay.tsx | seat-queue.test.ts | Passed |
| REQ-F-ES11 | Queue Status for Non-Deciding Spectators | M3, M4 | seat-queue.ts, SpectatorOverlay.tsx, PreRoomView.tsx | seat-queue.test.ts | Passed |
| REQ-F-ES12 | Pre-Room Seat Change | M4 | PreRoomView.tsx (SWAP_SEATS already implemented) | — | Passed |
| REQ-F-ES13 | Pre-Room Queue | M3 | room-handler.ts:548-556 (tryStartSeatQueue works for pre-room and mid-game) | room-handler.test.ts | Passed |
| REQ-F-ES14 | Reconnect After Wait Vote | M2 | disconnect-handler.ts, game-manager.ts | disconnect-handler.test.ts | Passed |
| REQ-F-ES15 | All Players Leave — Destroy Game | M2, M3 | room-manager.ts, room-handler.ts | room-handler.test.ts | Passed |
| REQ-F-ES16 | Queue Completion | M3, M4 | seat-queue.ts, room-handler.ts, game page, uiStore.ts | seat-queue.test.ts | Passed |
| REQ-F-ES17 | Multi-Player Disconnect Vote | M1, M2 | disconnect-handler.ts, protocol.ts | disconnect-handler.test.ts | Passed |

## Non-Functional Requirements

| REQ ID | Description | Milestone | Source Files | Test Files | Status |
|--------|-------------|-----------|-------------|------------|--------|
| REQ-NF-ES01 | Queue Responsiveness (<500ms) | M3 | seat-queue.ts (synchronous callbacks, no delays) | seat-queue.test.ts | Passed |
| REQ-NF-ES02 | Race Condition Safety | M3 | seat-queue.ts (single-threaded Node.js, serialized claim handling) | seat-queue.test.ts | Passed |
| REQ-NF-ES03 | State Consistency (<1s) | M2, M3 | broadcaster.ts (broadcastGameState with vote status) | — | Passed |
