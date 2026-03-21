# Empty Seat Filling Overhaul — Planning Conversation

## Date: 2026-03-21

## Summary

Designed a 5-milestone implementation plan for the empty seat filling behavior overhaul.

## Key Planning Decisions

1. **Milestone order**: Types/protocol first (M1), then server disconnect handler (M2), then seat queue (M3), then client UI (M4), then integration tests (M5)
2. **Explicit leave vs disconnect**: Leverages existing architecture — LEAVE_ROOM message = explicit leave (already removes player), ws.on('close') without LEAVE_ROOM = disconnect → vote. Add `beforeunload` handler on client to send LEAVE_ROOM on browser close.
3. **Vote status broadcasting**: New DISCONNECT_VOTE_UPDATE message (separate from GAME_STATE) to keep game state machine clean
4. **Multi-seat offer**: SEAT_OFFERED changes from single seat to array, breaking protocol change in M1
5. **No-recycle queue**: Pass/timeout completely removes spectator from queue. Up-for-grabs broadcasts to ALL current spectators.
6. **Per-spectator ordinal positions**: Individual QUEUE_STATUS messages instead of single broadcast
7. **Empty seat visuals**: New `emptySeat` prop on PlayerSeat rather than modifying `vacated` behavior
8. **Vote UI**: `voteStatus` prop on PlayerSeat for green/red glow + label overlay

## Milestones

| # | Name | Requirements | Key Files |
|---|------|-------------|-----------|
| M1 | Protocol & Type Foundation | Foundation for all | protocol.ts, room.ts, game.ts, stores |
| M2 | Disconnect Handler Overhaul | ES04, ES14, ES15, ES17 | disconnect-handler.ts, game-manager.ts, app.ts |
| M3 | Seat Queue Enhancements | ES02, ES03, ES06-ES11, ES13, ES16 | seat-queue.ts, room-handler.ts |
| M4 | Client UI Updates | ES01, ES04-ES06, ES11, ES12, ES16 | PlayerSeat.tsx, lobby, SpectatorOverlay, game page |
| M5 | Integration Testing & Polish | All | integration tests, documentation |

## Trade-offs

- Chose to keep DISCONNECT_VOTE_UPDATE separate from GAME_STATE to avoid coupling game phases with disconnect logic
- Multi-seat picker shows standard game table layout (not a separate picker component) for visual consistency
- 45s auto-kick is a hard timeout — no configurable option (keeping it simple)
