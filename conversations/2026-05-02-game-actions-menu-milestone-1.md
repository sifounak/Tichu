# Game Actions Menu — Milestone 1: Protocol & Server-Side Changes

**Date:** 2026-05-02
**Branch:** feature/game-actions-menu
**Milestone:** M1 — Protocol & Server

## Summary

Added 6 new WebSocket message types and server-side handlers for host force actions, host transfer, vote cancellation, and voting toggle.

## Key Decisions

1. **Routing architecture**: All 6 new message types handled in `room-handler.ts` (not `game-handler.ts`) because they need room-level access (RoomManager, host validation) that GameManager doesn't have. For in-game force actions, room-handler accesses the game via `gameStore.getGameByRoom()`.

2. **Voting-disabled enforcement**: Added `setRoomState(hostSeat, votingEnabled)` method to GameManager so room-handler can sync host/voting state when games start and when these values change. GameManager checks `_votingEnabled && seat !== _hostSeat` before allowing vote initiation.

3. **Vote cancellation authorization**: Both host and vote initiator can cancel. Added `getInitiatorSeat()` to VoteHandler. `handleCancelVote` checks both pre-game (preGameVoteHandler) and in-game (game's voteHandler) paths.

4. **Force kick paths**: Pre-game reuses existing `kickPlayer` flow. In-game reuses the vote-resolved kick path (vacate seat → start bot queue).

## Changes

### Protocol (`packages/shared/src/types/protocol.ts`)
- Added FORCE_KICK, FORCE_RESTART_ROUND, FORCE_RESTART_GAME, TRANSFER_HOST, CANCEL_VOTE, TOGGLE_VOTING client message schemas
- Added `votingEnabled: z.boolean().optional()` to ROOM_UPDATE server message

### Room Interface (`packages/shared/src/types/room.ts`)
- Added `votingEnabled: boolean` field

### Room Manager (`packages/server/src/room/room-manager.ts`)
- `createRoom()` and `restoreRooms()`: initialize `votingEnabled: true`
- `transferHost()`: validates host, human target, not self, updates `room.hostSeat`
- `toggleVoting()`: validates host, toggles `room.votingEnabled`

### Vote Handler (`packages/server/src/game/vote-handler.ts`)
- `cancelVote()`: accepts optional `cancellerName`, message shows "Vote cancelled by [Name]"
- `getInitiatorSeat()`: returns initiator seat for authorization checks

### Game Manager (`packages/server/src/game/game-manager.ts`)
- `setRoomState()`: receives host seat and votingEnabled from room-handler
- Voting-disabled checks in `handleStartKickVote`, `handleStartRestartGameVote`, `handleStartRestartRoundVote`

### Room Handler (`packages/server/src/room/room-handler.ts`)
- 6 new handlers: `handleForceKick`, `handleForceRestartRound`, `handleForceRestartGame`, `handleTransferHost`, `handleCancelVote`, `handleToggleVoting`
- Voting-disabled check in `handlePreGameKickVote`
- `broadcastRoomUpdate()` includes `votingEnabled`
- `startGameInternal()` calls `game.setRoomState()`

### Tests (`packages/server/tests/room/room-handler.test.ts`)
- Added `setRoomState: vi.fn()` to mock game object

## Test Results

- **Server**: 881/881 passed
- **Client**: 216/218 passed (2 pre-existing failures in ChatPanel and PreGamePhase — unrelated to M1)
- **Typecheck**: All packages pass
- **Build**: All packages build successfully

## Requirements Addressed

REQ-F-GA28, GA29, GA35, GA36, GA37, GA38, GA51, GA52, GA53, GA54 (server part), GA55
