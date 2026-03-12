# Milestone 3: Combination Engine — Conversation Transcript

**Date:** 2026-03-11
**Branch:** feature/tichu-web-game

## Summary

Implemented the core combination engine for Tichu — the heart of the game logic.

### Key Decisions

1. **Combination Detector Architecture**: Implemented as a dispatcher (`detectCombination`) that routes to type-specific detectors. Bombs are checked first (since Phoenix is excluded from bombs), then type-by-type based on card count.

2. **Phoenix in Full House (2+2+Phoenix)**: When Phoenix appears with two pairs, the higher rank becomes the triple (more advantageous). This is an ambiguous case — Phoenix joins the higher-ranked pair to form the triple.

3. **Phoenix in Straights**: Phoenix can fill one internal gap or extend at the top. Extension at the bottom is limited to rank >= 2 (REQ-F-PH03 from M4 — Phoenix value >= 2 in combinations). Extension at top is preferred when both are possible.

4. **3 Same Rank + Phoenix (4 cards)**: Returns null — not a valid combination. It's not a bomb (Phoenix excluded), not a triple (needs exactly 3 cards), not a pair sequence or straight.

5. **Dog as Single**: Dog is detected as a Single with rank 0 (cannot beat anything). It's treated as a lead-only action, filtered out of `getAllValidPlays` when a trick is active.

6. **getAllValidPlays Strategy**: Brute-force candidate generation approach — generates all possible subsets by type (singles, pairs, triples, bombs, full houses, straights, pair sequences, straight flush bombs) and filters through `detectCombination` + `canBeat`. Will be replaced by the optimized hand filter in M5.

### Files Created

- `code/packages/shared/src/engine/combination-detector.ts` — Combination detection (all 8 types)
- `code/packages/shared/src/engine/combination-validator.ts` — canBeat, getRankOrder, isBomb
- `code/packages/shared/src/engine/combination-utils.ts` — getAllValidPlays
- `code/packages/shared/tests/engine/combination-detector.test.ts` — 56 tests
- `code/packages/shared/tests/engine/combination-validator.test.ts` — 29 tests
- `code/packages/shared/tests/engine/combination-utils.test.ts` — 17 tests

### Files Modified

- `code/packages/shared/src/index.ts` — Added barrel exports for new engine modules

### Test Results

- 215 tests passed (0 failed)
- Statement coverage: 96.45%
- Branch coverage: 92.23%
- Function coverage: 100%

### Requirements Addressed

- REQ-F-CB01: Detect all combination types — Passed
- REQ-F-CB02: Combination comparison/ranking — Passed
- REQ-F-CB03: Dragon only as single — Passed
- REQ-F-CB04: Dog only as lead — Passed
- REQ-F-CB05: Mahjong rank 1 in straights — Passed
- REQ-F-CB06: Enumerate all valid plays — Passed
