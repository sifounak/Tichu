# Milestone 5: Hand Filter — Conversation Transcript

**Date:** 2026-03-11
**Feature:** Progressive card selection filtering
**Branch:** feature/tichu-web-game

## Summary

Implemented the hand filtering algorithm (Milestone 5) that determines which cards remain selectable as the player builds a combination. This runs on both client (instant UI feedback) and server (authoritative validation).

## Key Decisions

1. **Prefix matching approach**: Rather than checking exact combinations only, the prefix matcher uses structural checks (same rank, consecutive ranks, same suit+consecutive) to determine if selected cards could become part of a valid final play. This is more permissive — e.g., two distant-but-within-range ranks are considered valid straight prefixes.

2. **Would-be bomb detection**: Since `detectCombination` prevents Phoenix from forming bombs (returns null), `wouldFormBomb` uses structural pattern matching: 3 same rank + Phoenix = would-be four-bomb; 4+ same-suit consecutive + Phoenix = would-be straight flush bomb.

3. **Wish enforcement**: Conservative approach — nearby cards (within 4 ranks of wish) are allowed as potential straight components. Four-bomb-eligible cards remain selectable regardless of wish.

4. **Straight prefix flexibility**: Any two ranks that could fit within a 1-14 window are considered valid straight prefixes, since more cards can be added to fill gaps.

## Files Modified/Created

- **Created:** `code/packages/shared/src/engine/hand-filter.ts` — main filtering logic
- **Created:** `code/packages/shared/tests/engine/hand-filter.test.ts` — 47 tests
- **Modified:** `code/packages/shared/src/index.ts` — added barrel export
- **Modified:** `specifications/RTM-tichu-web-game.md` — updated 6 requirements to Passed

## Test Results

- 295 total tests passing (47 new for hand-filter)
- hand-filter.ts: 91.12% statement coverage, 80.55% branch coverage, 100% function coverage
- Performance: filtering a 14-card hand completes in < 1ms (verified across 300 iterations)

## Requirements Addressed

- REQ-F-HV01: Progressive card filtering
- REQ-F-HV02: Dragon/Dog disables all others
- REQ-F-HV03: Dog disabled when trick active
- REQ-F-HV04: Phoenix disabled if would form bomb
- REQ-F-HV05: Prefix matching for partial selections
- REQ-NF-P01: Hand filter < 1ms
