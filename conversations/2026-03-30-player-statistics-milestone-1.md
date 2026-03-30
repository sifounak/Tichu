# Player Statistics System — Milestone 1: Schema + Persistence Wiring

**Date:** 2026-03-30
**Phase:** 2 (Implementation) — Milestone 1

## Summary

Extended the database schema with ~35 new stat columns, 2 new tables, and wired `saveGameResult()` into the game lifecycle via a new `wireGameEndCallback` pattern.

## Changes Made

1. **schema.ts**: Extended `playerStats` from ~10 to ~50 columns (Group A/B/C stats). Added `playerRelationalStats` and `roundPlayerEvents` tables.

2. **connection.ts**: Added `syncSchema()` function that creates all tables (CREATE TABLE IF NOT EXISTS) and adds new columns to existing DBs (ALTER TABLE with error catch for idempotency).

3. **game-manager.ts**: Added `onGameEnd` callback field, `wireGameEndCallback()` method, and `gameOver` state detection in `onStateChange()`. Callback fires AFTER broadcast so clients see game-over first.

4. **room-handler.ts**: Added `database` parameter to constructor. Added `persistGameResult()` method that builds `GameResult` + `RoundResult[]` from `GameMachineContext` and calls `saveGameResult()`. Wired in `startGameInternal()`.

5. **app.ts**: Passes `database` to `RoomHandler` constructor.

6. **Tests**: Updated `connection.test.ts` mock (added `exec`), extended `schema.test.ts` with new table/column verifications (+7 tests).

## Key Decisions

- `passedCards.to` data is preserved after card exchange — simpler than hand-diff
- `finishOrder` per round not available in `RoundScore` — will use `tichuResults.won` for stat computation in Milestone 2
- `startedAt` is approximate (Date at game-over time) since context doesn't track start time

## Test Results

- 34/34 DB tests pass (was 27, added 7 new)
- 667/695 total tests pass (28 pre-existing failures, 0 new failures)
- TypeScript compiles cleanly
