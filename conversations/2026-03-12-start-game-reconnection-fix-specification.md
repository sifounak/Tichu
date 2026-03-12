# Specification: Start Game & Reconnection Fix

**Date:** 2026-03-12

## Summary

Investigated why "Start Game" button fails. Found three interrelated bugs:

1. Game page WebSocket connects without userId/playerName → server rejects immediately
2. Server reconnection logic doesn't send GAME_STATE for in-progress games
3. `roomManager.startGame()` sets flag before game is fully initialized with no rollback

Fix approach: add credentials to game page WS URL, add game reconnection to app.ts, move startGame() call after initialization.

## Key Decisions

- All three bugs fixed in a single milestone (small-change path)
- Uses existing `game.handleReconnect()` and `getGuestId()` infrastructure
- 3 files affected: game page.tsx, app.ts, room-handler.ts
