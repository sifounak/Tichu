# Expert Bot Strategy Rewrite — Milestone 9

**Date:** 2026-03-26
**Milestone:** M9 — Card Tracker Enhancements (REQ-F-TRK01, TRK02)

## Summary

- **REQ-F-TRK01:** Added `getApproxTeamPoints()` to CardTracker computing rough card points per team (5s=5, 10s/Ks=10, Dragon=25, Phoenix=-25) from tricksWon data
- **REQ-F-TRK02:** Enhanced `chooseDragonGiftRecipient()` to consider team point data and card counts — gives Dragon to opponent with more cards (most likely to go out last)

## Test Results

- 3 new point tracking tests in card-tracker.test.ts
- All 168 bot tests pass

## Files Modified

- `code/packages/server/src/bot/card-tracker.ts` — getApproxTeamPoints() + getCardPointValue()
- `code/packages/server/src/bot/expert-bot.ts` — Enhanced chooseDragonGiftRecipient()
- `code/packages/server/tests/bot/card-tracker.test.ts` — 3 point tracking tests
- `specifications/RTM-expert-bot-strategy-rewrite.md` — Updated TRK01-02 status
