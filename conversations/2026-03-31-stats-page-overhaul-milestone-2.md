# Stats Page Overhaul — Milestone 2

## Summary

**Goal:** Game persistence, spectator tracking, and API expansion.

**Changes:**
- Updated `PlayerStatIncrements` with 6 new fields and `upsertPlayerStats()` SQL with new columns
- `computeGameStats()` now receives `targetScore` for tie-break detection
- `GameResult` accepts `joinedAfterSpectating` set for spectator-to-player tracking
- `GameManager`: Added `joinedAfterSpectating` set, `markJoinedAfterSpectating()` method, passes set to onGameEnd callback
- `RoomHandler`: Calls `markJoinedAfterSpectating()` in `onSeatClaimed` when game is in progress; passes set through to `persistGameResult`
- Fixed `finishOrder` in RoundResult mapping — now uses `rs.finishOrder` from RoundScore instead of empty array
- Expanded `PlayerProfile` interface with 31 new fields (6 new stats + 25 Group C card event stats)
- Updated `getPlayerProfile()` SQL to select all new columns
- Added userId columns to `getPlayerGameHistory()` for player team detection
- Added `getGameTichuSummaries()` batch query for enriched history

**Test Results:** 59 DB tests pass. Server TypeScript compiles clean (after shared rebuild).
**Requirements:** REQ-F-SO12–SO20, REQ-NF-SO01 all Passed
