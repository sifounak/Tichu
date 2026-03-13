# Conversation: Game Message Routing + Delays — Implementation

**Date:** 2026-03-13
**Phase:** Implementation (Milestones 1 & 2)

## Summary

### Milestone 1: Game Message Routing (Critical Fix)
- Added `REGULAR_TICHU_PASS` to shared protocol types (protocol.ts)
- Created `GameHandler` class (game-handler.ts) that registers all game message types on the MessageRouter
- Wired GameHandler into app.ts after RoomHandler
- Added `REGULAR_TICHU_PASS` case to GameManager.handleMessage switch
- CHAT_MESSAGE handled directly in GameHandler (broadcast to room)

### Milestone 2: Client Fix + Delay Reductions
- Fixed `handleTichuSkip` to send `REGULAR_TICHU_PASS` instead of `GRAND_TICHU_DECISION`
- Reduced lobby polling: 5000ms → 2000ms
- Reduced room auto-join: 150ms → 50ms
- Reduced bot thinking: 200-1500ms → 100-800ms
- Reduced tichu dismiss: 2s → 1s
- Reduced reconnected message: 3000ms → 1500ms

## Test Results
- Server type-check: Clean
- Shared type-check: Clean
- Server tests: 349 passed, 5 pre-existing failures (db/queries unrelated)
- No regressions introduced
