# Milestone 4: ExpertBot Implementation — Conversation Transcript

**Date:** 2026-03-16
**Branch:** feature/hard-bot
**Milestone:** 4 of 5

## Summary

Implemented the ExpertBot class with full hand planning, card tracking, score-aware Tichu calls, anti-bomb passing, one-two prevention, and always-optimal play.

## Key Decisions

1. **CardTracker tracks from tricksWon + currentTrick**: Since RoundState doesn't have a trick history array, the tracker processes all `tricksWon` arrays from all players plus the current trick in progress. Uses card IDs to avoid double-counting.

2. **Score-awareness via setScoreDiff()**: The BotStrategy interface only accepts `hand14: GameCard[]` for `chooseRegularTichu()`. Since we can't change the interface (constraint), score awareness is injected via a `setScoreDiff()` method that the BotRunner or external code can call before Tichu decisions.

3. **Hand planning approach**: The plan categorizes valid lead plays into losers (rank ≤ 8), winners (Dragon, Aces, rank ≥ 12, bombs), and decides Phoenix role. The plan guides subsequent lead selections but falls back to standard strategy when planned plays are no longer available.

4. **One-two prevention**: Activates when an opponent went out first and the other opponent is still active. In this mode, the bot plays highest instead of lowest to control the game and prevent the opponent one-two.

5. **Anti-bomb passing**: Checks if base `selectPassCards` would send two same-rank cards to both opponents, and swaps one with the partner card to break the pair.

## Files Created
- `code/packages/server/src/bot/card-tracker.ts` — CardTracker class
- `code/packages/server/src/bot/expert-bot.ts` — ExpertBot class
- `code/packages/server/tests/bot/card-tracker.test.ts` — 18 tests
- `code/packages/server/tests/bot/expert-bot.test.ts` — 33 tests

## Files Modified
- `code/packages/server/src/bot/index.ts` — Added ExpertBot and CardTracker exports
- `code/packages/server/src/game/game-manager.ts` — ExpertBot import + factory case
- `code/packages/server/src/room/room-manager.ts` — Added 'expert' to difficulty type
- `specifications/RTM-hard-expert-bot.md` — Updated all M4 requirements to Passed
- `results/Milestone4/coverage/summary.md` — Coverage report

## Test Results
- 130 bot tests passed, 0 failed
- card-tracker.ts: 100% statement coverage
- expert-bot.ts: 93.38% statement coverage
