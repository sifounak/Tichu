# Hard & Expert Bot — Milestone 1: Bug Fixes

**Date:** 2026-03-16
**Phase:** Implementation (Phase 2, Milestone 1)
**Branch:** feature/hard-bot

## Summary

Fixed three bugs: round-ending edge cases, Dog animation timing, and Phoenix singleton display.

## Key Decisions

### BUG01 — Round-ending edge cases (game gets stuck)
**Root cause:** `scoreAndFinishRound()` was called both inside actions (`playCards`, `completeTrickAndAdvance`, `giveDragonTrick`) AND in the `roundScoring` state entry action, causing double-scoring. Additionally, the `isRoundComplete` guard only checked `countActivePlayers <= 1`, missing the 1-2 finish case (teammates go out 1st and 2nd) where 2 players remain active but the round should end.

**Fix:**
1. Created `isRoundOver()` helper to detect both conditions (1-2 finish AND countActivePlayers <= 1)
2. Removed all `scoreAndFinishRound()` calls from actions — now only called in `roundScoring` entry
3. Actions return `{ currentRound: round }` for round-ending cases, letting `always` transitions handle scoring
4. Updated `isRoundComplete` guard to also detect 1-2 finish

### BUG02 — Dog animation timing
**Fix:** Changed Dog sweep duration from 0.4s (`durations.trickSweep`) to 1.0s literal in TrickDisplay.tsx. Updated page.tsx timing to `(1.0 + 1.0) * animMultiplier` for both animation and block durations.

### BUG03 — Phoenix singleton display value
**Root cause:** `detectCombination()` always returns rank 1.5 for Phoenix singles. When played onto a trick, the stored rank should be `topRank + 0.5`.

**Fix:** After `validatePlay()` in the `playCards` action, check if the combination is a Phoenix single played onto an existing trick. If so, update `combination.rank` to `trickTop.rank + 0.5`.

## Test Results
- 6 new tests (round-ending-edge-cases.test.ts): All passing
- 153 game tests total: All passing
- 395/397 shared tests passing (2 pre-existing protocol.test.ts failures)
- 365/370 server tests passing (5 pre-existing db/queries.test.ts failures)
