# Statistics System Redesign — Milestone 2: Data Structure Interfaces

**Date:** 2026-04-09
**Phase:** Implementation — Milestone 2
**Branch:** `feature/stats-redesign-event-capture`

## Summary

Created TypeScript interfaces for all 7 data layers plus the in-memory accumulation structures and pre-play enrichment helpers.

### New Files

1. **event-types.ts** — 11 interfaces + 6 type aliases + 3 factory functions:
   - `PrePlayContext` — pre-play enrichment fields (10 fields)
   - `PlayerRoundRecord` — hands, passes, calls, finish, points (25 fields)
   - `TrickRecord` — lead + result info (17 fields)
   - `PlayRecord` — per-action with all contextual flags (34 fields)
   - `WishEventRecord`, `DragonGiftEventRecord`, `DogPlayEventRecord` — special events
   - `BombInventoryRecord` (Level 1), `BombEventRecord` (Level 2) — bomb lifecycle
   - `RoundEventData` — per-round accumulator container
   - `GameEventAccumulator` — full game container
   - Factory functions: `createEmptyRoundData()`, `createGameAccumulator()`, `createBlankPlayerRound()`

2. **pre-play-context.ts** — 4 computation helpers:
   - `isPlayedMinimum()` — lowest-ranking legal option of same combination type
   - `couldGoOut()` — any legal play empties hand
   - `getOtherPlayerCardCounts()` — partner/leftOpp/rightOpp card counts
   - `buildPrePlayContext()` — assembles complete PrePlayContext

### Verification

- TypeScript compiles cleanly (0 errors)
- All interfaces match spec field lists from SC03-SC11
- Existing tests unaffected (no changes to existing code)
