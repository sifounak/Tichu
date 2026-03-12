# Milestone 4: Phoenix Resolver — Conversation Transcript

**Date:** 2026-03-11
**Milestone:** M4 — Phoenix Resolver
**Branch:** feature/tichu-web-game

## Summary

Implemented the Phoenix resolution algorithm that determines valid Phoenix values for any card selection. This is the most complex piece of game logic in Tichu.

## Key Decisions

1. **Dispatch routing with fallthrough**: For 5-card selections, try full house first; if invalid, fall through to straight. For 4-card selections, try pair sequence first, then three-with-Phoenix (bomb check). For 6+ even-count, try pair sequence then straight.

2. **Test correction — [10,J,Q,K,Phoenix]**: Originally expected `auto 14`, but both extending low (9-K) and high (10-A) are valid. Corrected to `choose [9, 14]`.

3. **Defensive code for unreachable paths**: Lines 184-196 (pair-sequence in resolveThreeWithPhoenix) and 259-260 (non-standard check in straight resolver) are defensive guards for states that can't occur due to upstream filtering. Kept for safety; left uncovered.

## Implementation

- **Source**: `code/packages/shared/src/engine/phoenix-resolver.ts`
  - `resolvePhoenixValues()` — main entry point with card-count dispatch
  - `resolveSinglePhoenix()` — single lead (1.5) or on-trick (rank+0.5)
  - `resolvePairPhoenix()` — auto at other card's rank
  - `resolveTriplePhoenix()` — auto at pair's rank
  - `resolveFullHousePhoenix()` — 3+1 auto / 2+2 choose
  - `resolveStraightPhoenix()` — gap-fill auto / open-ended choose / SF bomb invalid
  - `resolvePairSequencePhoenix()` — auto at incomplete pair's rank
  - `resolveThreeWithPhoenix()` — 3-of-a-kind bomb rejection / pair-seq fallback

- **Tests**: `code/packages/shared/tests/engine/phoenix-resolver.test.ts` (33 tests)

- **Export**: Added barrel export in `code/packages/shared/src/index.ts`

## Test Results

- 248 tests total, all passed
- Phoenix resolver: 33 tests, all passed
- Coverage: 90.57% statements, 90.74% branches, 100% functions

## Requirements Verified

REQ-F-PH01 through REQ-F-PH08 — all Passed
