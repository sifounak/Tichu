# Player Statistics System — Milestone 2: Group A/B Stat Computation

**Date:** 2026-03-30
**Phase:** 2 (Implementation) — Milestone 2

## Summary

Created pure stat computation functions and extended the persistence layer to compute and store all Group A (game-level) and Group B (round-level) statistics.

## Changes Made

1. **stat-computations.ts** (NEW): Pure functions `computeGameStats()` and `computeRoundStats()` that extract stat increments from `RoundScore[]` data. Helper `getOpponentSeats()`.

2. **game-persistence.ts**:
   - Extended `GameResult` interface with optional `scores`, `winner`, `roundScores` fields
   - New path in `saveGameResult()` that uses computation functions when roundScores available
   - Legacy path preserved for backward compatibility
   - Extended `upsertPlayerStats()` with Group A/B columns including MAX for largestWinDiff/LossDiff
   - Exported `PlayerStatIncrements` interface

3. **queries.ts**: Extended `PlayerProfile` interface and `getPlayerProfile()` SELECT with all Group A/B columns.

4. **room-handler.ts**: Updated `persistGameResult()` to pass `scores`, `winner`, `roundScores` to `GameResult`.

## Test Results

- 49/49 DB tests pass (+15 new stat computation tests)
- 0 regressions
