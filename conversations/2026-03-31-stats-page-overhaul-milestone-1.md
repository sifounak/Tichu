# Stats Page Overhaul — Milestone 1

## Summary

**Goal:** Shared types, DB schema, and stat computation logic for new stats.

**Changes:**
- Added `finishOrder: Seat[]` to `RoundScore` interface and `scoreRound()` return value
- Added 6 new columns to `playerStats`: `lastFinishes`, `tichuBrokenByPartner`, `grandTichuBrokenByPartner`, `gamesRequiringTieBreak`, `mostTieBreakRoundsNeeded`, `gamesJoinedAfterSpectating`
- Added migration in `connection.ts` for new columns
- Updated `computeGameStats()` to accept `targetScore` and compute tie-break stats
- Updated `computeRoundStats()` to use `finishOrder` for:
  - `firstFinishes`: now counts ALL 1st-place finishes (not just Tichu callers)
  - `lastFinishes`: counts 4th-place finishes
  - `tichuBrokenByPartner`: I called Tichu/GT, partner finished 1st
  - `partnerTichuBroken`: improved with finishOrder (partner called, I finished 1st)
- Updated stat-computations.test.ts with 25 tests including new tie-break, lastFinishes, and broken-by-partner tests

**Test Results:** 59 DB tests pass (25 stat-computations, 10 game-persistence, 15 schema, 7 queries, 2 connection)
**Requirements:** REQ-F-SO01–SO11, REQ-NF-SO01, REQ-NF-SO02 all Passed
