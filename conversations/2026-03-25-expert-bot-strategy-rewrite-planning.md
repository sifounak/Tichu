# Expert Bot Strategy Rewrite — Planning Conversation

**Date:** 2026-03-25
**Phase:** Planning

## Summary

Implementation plan created with 10 milestones covering all 29 requirements.
Plan serialized to `plans/2026-03-25-expert-bot-strategy-rewrite.md`.

## Key Planning Decisions

1. **Milestone ordering:** Calling (M1) → Passing (M2) → Dog (M3) → Phoenix (M4) → Bombs (M5) → Mah Jong (M6) → Endgame (M7) → Defense (M8) → Tracking (M9) → Follow Play (M10). This order builds capabilities bottom-up: index functions → passing context → play decisions → advanced features.

2. **No new files:** All changes go in existing bot files (expert-bot.ts, bot-strategy-utils.ts, card-tracker.ts). Keeps architecture clean.

3. **Reuse existing utilities:** Many existing functions (countTopCards, findBombs, findSingletons, etc.) are reused or extended rather than replaced.

4. **Stanford formulas adapted:** Raw Stanford thresholds shifted upward for strong play, then modulated by score deficit. This resolves the Stanford-vs-Fuegi disagreement.

5. **Straight-flush bomb detection** added to findBombs() — currently only detects four-of-a-kind.
