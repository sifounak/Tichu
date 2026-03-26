# Expert Bot Strategy Rewrite — Milestone 1

**Date:** 2026-03-25
**Milestone:** M1 — Grand Tichu & Regular Tichu Calling

## What Was Implemented

### New utility functions (bot-strategy-utils.ts):
- `computeGrandTichuIndex(hand8)` — Stanford Ig = N_Ace + 3*N_dragon + 3*N_phoenix + 3*N_bomb
- `computeTichuIndex(hand14)` — Stanford It = 2*N_Ace - 2*N_dog + 6*N_dragon + 6*N_phoenix + 5*N_bomb + N_straight - N_small
- `countStraights(hand)` — Counts straights of 5+ consecutive ranks (Phoenix fills 1 gap)
- `countSmallSingletons(hand)` — Counts singletons below Queen not in straights/pairs/triples

### Modified ExpertBot methods:
- `chooseGrandTichu()` — Now uses Ig index with score-adaptive thresholds (2/3/4/6)
- `chooseRegularTichu()` — Now uses It index with score-adaptive thresholds (5/7/9)

## Key Decisions
- Shifted Stanford thresholds upward from baseline (Ig>=2 → Ig>=4 at even score) for strong play
- Non-consecutive pairs in test hands to avoid unintended straight detection
- Phoenix gap-filling in countStraights uses runLength+=2 (fills gap + counts current rank)

## Test Results
- 142 tests pass across 5 bot test files
- 8 pre-existing failures in bot-integration.test.ts and regular-bot.test.ts (not caused by M1)
- New tests: 7 Grand Tichu tests, 5 Regular Tichu tests, 12 utility tests
