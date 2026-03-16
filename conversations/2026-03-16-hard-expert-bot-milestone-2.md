# Hard & Expert Bot — Milestone 2: Shared Strategy Utilities + Tier Update

**Date:** 2026-03-16
**Phase:** Implementation (Phase 2, Milestone 2)
**Branch:** feature/hard-bot

## Summary

Created shared bot strategy utilities module and updated difficulty tier to `regular | hard | expert` across the full stack.

## Changes

### Tier Update (REQ-F-TIER01)
- `game.ts`: `botDifficulty: 'regular' | 'hard' | 'expert'`
- `protocol.ts`: Both `CONFIGURE_ROOM` and `ADD_BOT` Zod schemas updated
- `bot-interface.ts`: `difficulty: 'regular' | 'hard' | 'expert'`
- `game-manager.ts`: `registerBot()` accepts all 3 tiers (hard/expert placeholder to RegularBot until M3/M4)
- `lobby/[roomId]/page.tsx`: Added 'Expert' option to dropdown

### Shared Strategy Utilities (REQ-NF-MAINT01)
Created `bot-strategy-utils.ts` with 30+ pure functions in 5 categories:
1. **Hand evaluation**: countTopCards, countLeadGetters, evaluateHandStrength, findBombs, findSingletons
2. **Card sorting**: getCardStrength, sortByStrength, rankCombinationsForLead, rankCombinationsForFollow
3. **Passing**: identifyWeakCards, selectPassCards (with configurable PassStrategy)
4. **Play selection**: isPartnerWinning, canGoOut, isAllWinners, selectLeadPlay, selectFollowPlay, shouldPlayBomb
5. **State analysis**: getOpponentTichuCallers, getHandSizes, isEndgame, selectMahjongWish, selectDragonRecipient

All functions comply with REQ-F-INFO01 (human-available information only).

## Test Results
- 27 new bot-strategy-utils tests: All passing
- 210 game+bot tests total: All passing
- No regressions in existing tests
