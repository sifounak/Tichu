# Expert Bot Strategy Rewrite — Milestone 6

**Date:** 2026-03-26
**Milestone:** M6 — Context-Adaptive Mah Jong Wish (REQ-F-MJ01)

## Summary

Rewrote `chooseMahjongWish()` in ExpertBot with a 4-priority context-adaptive system:

1. **Mah Jong in straight → no wish** — Added `mahjongPlayedInStraight` flag set in `toDecision()` when Mah Jong is part of a multi-card combination
2. **Opponent Tichu/Grand Tichu caller → wish for Ace** — Extended to check both Tichu and Grand Tichu (was only Grand Tichu before), using `getOpponentTichuCallers()` utility
3. **Card passed to left → wish for that rank** — Uses `passedToLeft` field from M2's parity convention passing
4. **Fallback → prefer 5 or 6** — Changed from mid-high (10, 9, 8, 7, 11) to low-mid (5, 6, 7, 8, 9, 10) per spec

## Key Decisions

- Added `mySeat` field to track the bot's seat across methods (needed because `chooseMahjongWish` interface doesn't receive seat)
- Used `toDecision()` as the interception point for setting `mahjongPlayedInStraight` — any multi-card combination containing Mah Jong triggers it
- Fallback wish candidates ordered 5, 6, 7, 8, 9, 10 — low ranks are harder for opponents to fulfill while still disrupting their straights

## Test Results

- 7 new tests for REQ-F-MJ01 (replaced 2 old REQ-F-WISH01 tests)
- All 152 bot tests pass
- Pre-existing failures in unrelated test files (auth, db, game-manager, room-handler) confirmed not caused by M6

## Files Modified

- `code/packages/server/src/bot/expert-bot.ts` — Added imports, fields, rewrote `chooseMahjongWish()`
- `code/packages/server/tests/bot/expert-bot.test.ts` — New M6 tests
- `specifications/RTM-expert-bot-strategy-rewrite.md` — Updated REQ-F-MJ01 status
