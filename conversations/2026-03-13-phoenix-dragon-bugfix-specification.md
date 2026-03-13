# Conversation: Phoenix-Dragon Bugfix — Specification

**Date**: 2026-03-13
**Phase**: Specification (Phase 1.2-1.3)

## Summary

Performed a rules audit of the Tichu implementation against the official rules PDF. Key findings:

### Bug Found
- **Phoenix can appear to beat Dragon** in the client UI. `resolveSinglePhoenix` returns `{ status: 'single_ontrick', value: 25.5 }` when Dragon (rank 25) is on trick. The client's `useCardSelection.ts:82` only disables Play when `status === 'invalid'`, so the button stays enabled. Server correctly rejects the play, but UX is confusing.

### Edge Case Verified (needs tests)
- `[3,3,3,3,Phoenix]` is correctly rejected as a full house by `detectFullHouse` (line 252: "4+Phoenix is not a valid full house"), but has no test coverage.

### Missing Mechanic (deferred)
- Out-of-turn bombs: "Bombs can be played at any moment (e.g. out of turn)" — fundamental architecture change, deferred to future milestone.

### Correctly Implemented (no action needed)
- Mahjong wish mechanic, Dog lead-pass, Dragon gift, Phoenix as joker, all 8 combination types, scoring, Tichu declarations, card passing, trick completion, round end conditions.

## Key Decisions
- Fix is a 3-line guard clause in `resolveSinglePhoenix` — check `topRank >= DRAGON_RANK` and return `invalid`
- No client code changes needed — existing `invalid` status check handles it
- No server code changes needed — server already rejects correctly
- Out-of-turn bombs deferred (3-5 day effort, needs full spec/plan cycle)
