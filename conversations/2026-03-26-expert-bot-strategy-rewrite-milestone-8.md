# Expert Bot Strategy Rewrite — Milestone 8

**Date:** 2026-03-26
**Milestone:** M8 — Risk-Based Tichu Defense (REQ-F-DEF01)

## Summary

Added `evaluateTichuDefense()` method that decides 'fight' or 'concede' based on 4 factors:

1. **Caller's card count:** 1-2 cards = almost out (-3), 3-4 cards (-1), 5+ cards (+1)
2. **Own winner count:** 3+ winners (+2), 2 winners (+1), 0 winners (-2)
3. **Unaccounted power cards:** 4+ unaccounted (+1), ≤1 unaccounted (-1)
4. **Partner's Tichu call:** Partner also called Tichu (+2)

Integrated into `chooseFollowPlay()`: when conceding, passes immediately. When fighting, plays normally (aggressive follow).

## Test Results

- 3 new Tichu defense tests (concede weak vs almost-out, fight strong vs early caller, fight when partner called)
- All 165 bot tests pass

## Files Modified

- `code/packages/server/src/bot/expert-bot.ts` — evaluateTichuDefense() + integration in chooseFollowPlay()
- `code/packages/server/tests/bot/expert-bot.test.ts` — 3 Tichu defense tests
- `specifications/RTM-expert-bot-strategy-rewrite.md` — Updated DEF01 status
