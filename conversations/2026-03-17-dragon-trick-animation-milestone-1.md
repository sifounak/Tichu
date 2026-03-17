# Dragon Trick Animation — Milestone 1 Transcript

**Date:** 2026-03-17
**Branch:** feature/dragon-trick-animation
**Milestone:** M1 — Server: Keep Trick Alive + `dragonGiftedTo` Signal

## Summary

Implemented server-side changes to support dragon trick animation:

1. **`game.ts`** — Added `dragonGiftedTo: Seat | null` to both `RoundState` and `ClientGameView` interfaces
2. **`game-state-machine.ts`** — Five changes:
   - `createRoundState()`: initialise `dragonGiftedTo: null`
   - `completeTrickAndAdvance()` manual-gift branch: removed premature `currentTrick = null` (REQ-F-DRA01)
   - `completeTrickAndAdvance()` auto-gift branch: set `dragonGiftedTo = autoRecipient` (REQ-F-DRA03)
   - `giveDragonTrick` action: set `dragonGiftedTo = event.recipient` (REQ-F-DRA02)
   - `playCards` and `passTurn` actions: reset `dragonGiftedTo = null` (ephemeral signal)
3. **`state-projection.ts`** — Project `dragonGiftedTo` in both lobby (null) and active-round views
4. **Test helper updates** — Updated `createTestRoundState` and `makeMinimalRoundState` in 6 test files to include new `dragonGiftedTo` field
5. **New test file** — `dragon-trick-animation.test.ts` with 6 tests covering:
   - Initialization to null
   - currentTrick remains non-null during awaitingDragonGift
   - dragonGiftedTo set after manual gift
   - dragonGiftedTo cleared on next play
   - State projection correctness

## Key Decisions

- Kept `currentTrick` alive during manual gift by removing `round.currentTrick = null` from the `else` branch in `completeTrickAndAdvance()`. The trick is now only cleared in `giveDragonTrick`.
- The `dragonGiftedTo` signal is ephemeral — set on gift resolution, cleared on the next play or pass action.
- Pre-existing test failures (db/queries, regular-bot, auth-routes) are unrelated to these changes.

## Test Results

- 174/174 game + state-projection tests pass
- 6/6 new dragon-trick-animation tests pass
- 6 pre-existing failures in unrelated test files (db, bot, auth)
