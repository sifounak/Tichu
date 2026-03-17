# Conversation: Fix Phoenix 'choose' Play Button Bug — Milestone 1

**Date:** 2026-03-17
**Branch:** bugfix/phoenix-choose-blocks-play-button
**Milestone:** 1 of 1 (single-milestone small bugfix)

## Summary

Fixed a catch-22 bug where selecting 2+2+Phoenix (e.g. JJ+AA+Phoenix) as a full house
disabled the Play button, making it impossible to play that combination.

## Root Cause

`useCardSelection.ts` line 102 had:
```typescript
if (phoenixResolution.status === 'choose') return false;
```

But `handlePlay` in `page.tsx` only shows the Phoenix picker when `canPlay === true`,
and `canPlay` was `false`. The picker never launched.

## Fix

Removed the `'choose'` guard from `canPlay` in `useCardSelection.ts`. The `'invalid'`
guard remains. The existing `handlePlay` logic in `page.tsx` already correctly intercepts
`status === 'choose'` to show the picker before sending the play — no changes needed there.

## Files Changed

- `code/packages/client/src/hooks/useCardSelection.ts` — removed 1 line (the `'choose'` guard)
- `code/packages/client/tests/hooks/useCardSelection.test.ts` — updated 1 test, added 3 tests

## Test Results

All 14 `useCardSelection` tests pass.
Pre-existing 11 failures in GameEndPhase/PreGamePhase/GameTable are unrelated.

## Key Decisions

- No changes to `phoenix-resolver.ts` — the `'choose'` return is still correct; the
  picker behavior is correct. Only the `canPlay` gate was wrong.
- No changes to `page.tsx` — existing `handlePlay` logic handles `'choose'` correctly.
