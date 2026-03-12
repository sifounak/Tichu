# Milestone 1: Start Game & Reconnection Fix

**Date:** 2026-03-12

## Changes

1. **Game page WebSocket credentials (REQ-F-SG01):** Added `userId` and `playerName` query parameters to the game page's WebSocket URL using `getGuestId()` and `sessionStorage` — same pattern as lobby/room pages.

2. **In-progress game reconnection (REQ-F-SG02):** Added `gameStore.getGameByRoom()` check in `app.ts` reconnection block. If a game exists, calls `game.handleReconnect(ws, seat)` which sends full `GAME_STATE` to the reconnected player.

3. **StartGame rollback (REQ-F-SG03):** Moved `roomManager.startGame()` after successful game initialization. Added rollback in catch block: `roomManager.endGame()` + `gameStore.destroyGameByRoom()`.

## Test Results

- All 928+ tests pass (shared: 374, server: 354, client: 200)
- 4/4 turbo tasks successful
- No regressions
