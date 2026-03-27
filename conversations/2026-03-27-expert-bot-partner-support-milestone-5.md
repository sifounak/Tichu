# Expert Bot Partner Support — Milestone 5: Uncontested Singles Defense

## Summary

Implemented M13 (Uncontested Singles Defense) with 3 requirements:
- USD01: Track per-opponent uncontested single trick wins using tricksWon entry length
- USD02: Break weakest combo (pairs > triples > larger) to contest when 2+ uncontested wins with rank < Jack
- USD03: Stricter threshold (1 win, < Queen) when partner called GT/T

## Key Implementation Details

- Added 4 state fields: uncontestedSingleCounts, uncontestedSingleLastRank, lastTricksWonCounts, lastSeenTrickType
- All reset on round change
- `updateUncontestedSingleTracking()` called from choosePlay after card tracker update
- `getUSDComboBreak()` called from chooseFollowPlay before "save high cards" logic
- Break priority sorts by combo size (pair=2 < triple=3 < larger) then by rank

## Tests Added (10)

All passing. Covers: counter increment, reset on non-single type, reset on new round, threshold enforcement (1 vs 2), rank limits (< Jack vs < Queen), break priority (pair before triple), partner GT/T threshold reduction, no break when freed card can't beat trick.

## Tests: 90 passed, 0 failed
