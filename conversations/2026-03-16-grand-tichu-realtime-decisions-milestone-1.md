# M1 Conversation — Grand Tichu Real-Time Decisions

**Date:** 2026-03-16

## What was implemented

- `gameStore.ts`: Added `grandTichuDecided: Seat[]` to interface, initialState, and `applyGameState`
- `game/[gameId]/page.tsx`: Changed hardcoded `grandTichuDecided: []` to `gameStore.grandTichuDecided`
- `gameStore.test.ts`: Added 3 new tests (stores from view, resets on new round, clears on reset); fixed `makeView` factory to include `receivedCards`, `lastDogPlay`, `grandTichuDecided` fields

## Test results

- gameStore tests: 15/15 passed
- PreGamePhase tests: 5 pre-existing failures (unrelated to M1 changes, will be fixed in M2)

## Notes

Pre-existing PreGamePhase test failures existed before this branch. Root causes: missing `passSelection` prop in test defaults, and Tichu Decision UI no longer matches test expectations. M2 will rewrite the Grand Tichu UI section and fix/update all PreGamePhase tests.
