# Expert Bot Strategy Rewrite — Milestone 10

**Date:** 2026-03-26
**Milestone:** M10 — Enhanced Follow Play (REQ-F-FOL01-03)

## Summary

Three enhancements to follow/lead play:

- **REQ-F-FOL01 (King safety):** When all 4 Aces are accounted for (played + in hand), lead Kings as top singles. Check runs BEFORE hand plan to override default lead-low.
- **REQ-F-FOL02 (Smart pass on low tricks):** In chooseFollowPlay, pass when cheapest win costs a King and unaccounted Aces still exist. Added after existing Ace/Dragon save-high-cards check.
- **REQ-F-FOL03 (Split Aces):** Never lead Ace pairs — skip pair-of-Aces in lead selection loop so each Ace wins a separate trick.

## Test Results

- 3 new tests covering King safety, smart King pass, Ace splitting
- All 171 bot tests pass (73 expert + 55 utils + 25 hard + 18 tracker)

## Files Modified

- `code/packages/server/src/bot/expert-bot.ts` — FOL01/02/03 in chooseLeadPlay + chooseFollowPlay
- `code/packages/server/tests/bot/expert-bot.test.ts` — 3 enhanced follow play tests
- `specifications/RTM-expert-bot-strategy-rewrite.md` — Updated FOL01-03 + NF requirements status
