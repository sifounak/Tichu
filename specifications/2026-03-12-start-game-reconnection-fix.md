# Specification: Start Game & In-Progress Game Reconnection Fix

**Date:** 2026-03-12
**Status:** Approved
**Type:** Bugfix

## Problem Statement

The "Start Game" button in the room lobby fails to transition players into the game. Clicking it once appears to do nothing; clicking again reports "game already in progress." Navigating away and returning to an in-progress game leaves the client stuck at "connecting."

## Root Cause Analysis

Three interrelated bugs:

1. **Game page WebSocket missing credentials (REQ-F-SG01):** The game page (`game/[gameId]/page.tsx:28,64`) connects to bare `ws://localhost:3001/ws` without `userId` or `playerName` query parameters. The server (`app.ts:102-104`) closes connections missing these params with code 4001. The game page's WebSocket is therefore immediately rejected — it can never receive `GAME_STATE`.

2. **Reconnection doesn't send GAME_STATE (REQ-F-SG02):** When a user reconnects via a new WebSocket (`app.ts:109-117`), the server restores room membership and sends `ROOM_JOINED` + `ROOM_UPDATE`, but never checks if a game is in progress. It never calls `game.handleReconnect(ws, seat)`, so the client never receives `GAME_STATE`.

3. **startGame flag not rolled back on failure (REQ-F-SG03):** In `handleStartGame` (`room-handler.ts:189`), `roomManager.startGame()` sets `gameInProgress = true` before the game is fully initialized. If subsequent steps throw, the flag remains true, causing "game already in progress" on retry.

## Requirements

### Functional Requirements

| ID | Description | Priority |
|----|-------------|----------|
| REQ-F-SG01 | Game page WebSocket must include userId and playerName query parameters | Critical |
| REQ-F-SG02 | Server reconnection must send GAME_STATE for in-progress games via `game.handleReconnect(ws, seat)` | Critical |
| REQ-F-SG03 | `roomManager.startGame()` must be called only after successful game initialization, or rolled back on failure | Medium |

### Non-Functional Requirements

| ID | Description | Priority |
|----|-------------|----------|
| REQ-NF-SG01 | No breaking changes to existing protocol or WebSocket handshake | High |
| REQ-NF-SG02 | All existing tests must continue to pass | High |

## Success Metrics

1. Click "Start Game" in room lobby — all players transition to game page with full game state
2. Navigate away from game and return — game state is restored via reconnection
3. If game initialization fails, "Start Game" can be retried (no stale `gameInProgress` flag)
4. All existing tests pass (928+)

## Files Affected

| File | Changes |
|------|---------|
| `code/packages/client/src/app/game/[gameId]/page.tsx` | Add `userId` + `playerName` query params to WebSocket URL |
| `code/packages/server/src/app.ts` | After room restoration, check `gameStore.getGameByRoom()` and call `game.handleReconnect()` |
| `code/packages/server/src/room/room-handler.ts` | Move `roomManager.startGame()` after game initialization; add rollback in catch |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Existing `handleReconnect` doesn't handle all game phases | Low | Medium | Method already exists and is tested; sends full `GAME_STATE` |
| Game page userId differs from lobby userId | Low | High | Both use `getGuestId()` which reads/writes the same `sessionStorage` key |

## Confidence

**High** — Root causes are confirmed by code inspection. Fixes use existing infrastructure (`handleReconnect`, `sendStateTo`, `getGuestId`). All three changes are targeted with no architectural impact.
