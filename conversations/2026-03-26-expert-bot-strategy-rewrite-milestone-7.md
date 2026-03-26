# Expert Bot Strategy Rewrite — Milestone 7

**Date:** 2026-03-26
**Milestone:** M7 — Endgame Strategy (REQ-F-END01-04)

## Summary

Added endgame-specific play strategies for 3-player and 2-player situations:

- **REQ-F-END01 (3p-partner-out):** Play aggressively — lead highest to go out 2nd
- **REQ-F-END02 (3p-partner-in):** Feed Dog to partner with fewer cards, coordinate play
- **REQ-F-END03 (2p-opponent-1-card):** Multi-card groups first (opponent can only single), then high→low singles
- **REQ-F-END04 (2p-opponent-many):** Normal lead-low-win-high strategy

## Key Decisions

- Added `getEndgamePhase()` utility in bot-strategy-utils.ts returning 'normal' | '3p-partner-out' | '3p-partner-in' | '2p'
- Endgame detection runs BEFORE 1-2 prevention since endgame handles those scenarios with more nuance
- 2p-opponent-many case handles lead-low directly instead of falling through (prevents 1-2 prevention override)
- Updated existing "one-two prevention own team out first" test expectation to reflect REQ-F-END01 aggressive play

## Test Results

- 6 new endgame tests in expert-bot.test.ts
- 4 new getEndgamePhase utility tests in bot-strategy-utils.test.ts
- All 162 bot tests pass

## Files Modified

- `code/packages/server/src/bot/expert-bot.ts` — Endgame detection + 4 endgame methods
- `code/packages/server/src/bot/bot-strategy-utils.ts` — getEndgamePhase() utility
- `code/packages/server/tests/bot/expert-bot.test.ts` — 6 endgame tests
- `code/packages/server/tests/bot/bot-strategy-utils.test.ts` — 4 getEndgamePhase tests
- `specifications/RTM-expert-bot-strategy-rewrite.md` — Updated END01-04 status
