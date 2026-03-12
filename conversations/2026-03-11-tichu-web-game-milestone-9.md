# Milestone 9: Game Manager — Conversation Transcript

**Date:** 2026-03-11
**Milestone:** 9 — Game Manager
**Branch:** feature/tichu-web-game

## Summary

Implemented the server-side game orchestration layer (Milestone 9) that ties together the XState game state machine, the shared engine validation, and the WebSocket broadcasting layer.

## Key Decisions

1. **Architecture**: Split into 4 files for separation of concerns:
   - `GameManager` — main orchestrator (one per game)
   - `MoveHandler` — translates client messages to state machine events, pre-validates
   - `DisconnectHandler` — manages disconnect detection, voting, and reconnection
   - `GameStore` — in-memory game lifecycle (create/lookup/destroy)

2. **DECLARE_WISH as separate event**: Added `DECLARE_WISH` event to the state machine to handle the Mahjong wish declaration separately from `PLAY_CARDS`. The client protocol has them as separate messages, and the state machine now supports both the inline wish (via PLAY_CARDS event.wish) and the separate declaration.

3. **Dragon gift validation**: The `MoveHandler.handleGiftDragon()` validates:
   - Must be in `awaitingDragonGift` state
   - Only the Dragon winner can gift
   - Must gift to an opponent (not teammate)
   - Recipient must still be in the game

4. **Disconnect voting**: 3 remaining players vote (majority wins). Options: wait, replace with bot, abandon. Timeout defaults to replace with bot. Reconnection cancels active vote.

5. **Protocol gap noted**: The client protocol doesn't have an explicit "pass Regular Tichu" message — only `TICHU_DECLARATION` for calling. The state machine accepts `REGULAR_TICHU_PASS` events. This will be addressed when implementing the lobby/UI milestone.

## Files Created/Modified

### New Files
- `code/packages/server/src/game/game-manager.ts` — GameManager class
- `code/packages/server/src/game/move-handler.ts` — MoveHandler class
- `code/packages/server/src/game/disconnect-handler.ts` — DisconnectHandler class
- `code/packages/server/src/game/game-store.ts` — GameStore class

### Modified Files
- `code/packages/server/src/game/game-state-machine.ts` — Added DECLARE_WISH event type and handler in playing state

### Test Files
- `code/packages/server/tests/game/game-manager.test.ts` — 21 tests
- `code/packages/server/tests/game/move-handler.test.ts` — 30 tests
- `code/packages/server/tests/game/disconnect-handler.test.ts` — 17 tests
- `code/packages/server/tests/game/game-store.test.ts` — 16 tests

## Test Results

- **190 tests pass** (11 test files)
- **89.31% overall statement coverage**
- New M9 files coverage:
  - disconnect-handler.ts: 100%
  - game-manager.ts: 91.33%
  - game-store.ts: 100%
  - move-handler.ts: 85.39%

## Requirements Addressed

| Requirement | Status |
|---|---|
| REQ-F-DR01 | Passed |
| REQ-F-DR02 | Passed |
| REQ-F-DR03 | Passed |
| REQ-F-MP01 | In Progress (bot integration in M10) |
| REQ-F-MP08 | In Progress (bot replacement in M10) |
