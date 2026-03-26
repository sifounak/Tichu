# Expert Bot Strategy Rewrite — Milestone 5 Conversation

**Date:** 2026-03-26
**Phase:** Implementation — Milestone 5: Bomb Strategy

## Summary

Implemented all 3 bomb strategy requirements for ExpertBot:

### REQ-F-BOMB03: Straight-Flush Bomb Detection
- Replaced manual four-of-a-kind-only `findBombs()` in `bot-strategy-utils.ts` with delegation to shared `detectAllBombs()` which handles both four-of-a-kind AND straight-flush bombs
- Fixed 12 existing tests that accidentally created straight-flush bombs by using same-suit consecutive cards (now use alternating suits)

### REQ-F-BOMB01: Enhanced Offensive Bomb Timing
- Enhanced `shouldBombNow()` in `expert-bot.ts`:
  - **Partner protection**: Don't bomb if partner has 1-2 cards (about to go out — waste of bomb)
  - **1-2 finish prevention**: Bomb when one opponent already out and the other has ≤3 cards
  - Retained existing logic (bomb opponent near exit, bomb Tichu callers with ≤5 cards)

### REQ-F-BOMB02: Bomb-Proof Exit Planning
- New `getBombProofExitPlay()` method in `expert-bot.ts`
- When 2 cards remain (Dragon + low single) and bomb risk exists (any rank with 3+ unaccounted in card tracker), leads the low card instead of Dragon
- Rationale: if bombed on low card, Dragon still available to recover lead

### Tests
- 5 new tests in expert-bot.test.ts covering all bomb strategy scenarios
- 3 new tests in bot-strategy-utils.test.ts for straight-flush bomb detection
- All 107 tests across expert-bot.test.ts and bot-strategy-utils.test.ts pass
- All 15 card-tracker tests pass

### Key Decisions
1. Reused shared `detectAllBombs()` rather than reimplementing straight-flush detection — avoids code duplication
2. Fixed pre-existing test data that accidentally created straight-flush bombs when using default (all-jade) suits
3. Bomb-proof exit planning only activates with exactly 2 cards remaining (Dragon + other) — keeps logic simple and focused on the most critical exit scenario
