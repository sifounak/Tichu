# Hard & Expert Bot — Planning Conversation

**Date:** 2026-03-16
**Phase:** Implementation Planning (Phase 1.4)
**Branch:** feature/hard-bot

## Summary of Key Decisions

1. **5 milestones**: Bug Fixes → Shared Utils + Tier Update → HardBot → ExpertBot → Integration Testing
2. **Bug fixes first**: Independent of bot work, unblock testing
3. **Tier update in M2** (not M5): So HardBot and ExpertBot can be wired in immediately when implemented
4. **Composition over inheritance**: Both HardBot and ExpertBot implement BotStrategy independently, sharing utilities via bot-strategy-utils.ts
5. **BUG01 investigation areas**: isTrickComplete() active player changes, Dragon gift vs round-complete race, getNextActiveSeat() loop safety
6. **BUG02 fix**: Change Dog sweep from 0.4s to 1.0s (currently uses trickSweep duration, need dedicated Dog sweep)
7. **BUG03 fix**: Server-side — update Phoenix single combination.rank to topRank + 0.5 after validatePlay() in playCards action
8. **HardBot caches roundState**: From choosePlay() for use in chooseDragonGiftRecipient() (which doesn't receive roundState)
9. **ExpertBot CardTracker**: Separate class tracking top-10 cards and absent ranks for bomb detection
10. **Injectable randomness**: HardBot constructor takes optional randomSource for deterministic testing

## Files Explored

- bot-interface.ts: BotStrategy interface (6 methods), BotPlayContext, BotPlayDecision
- regular-bot.ts: Random plays, 30% pass, no strategy
- bot-runner.ts: Phase handlers, timing (800-1500ms default, 50-150ms bot-only)
- game-state-machine.ts: playCards action, isTrickComplete, completeTrickAndAdvance, scoreAndFinishRound
- game-manager.ts: registerBot() factory with switch on difficulty
- TrickDisplay.tsx: Dog animation (framer-motion), Phoenix formatPhoenixValue()
- page.tsx: Dog animation timing constants (1.0 + 0.4)
- useAnimationSettings.ts: trickSweep = 0.4s base duration
- combination-detector.ts: Phoenix single rank = 1.5 (PHOENIX_SINGLE_VALUE)
- rules.ts: getValidPlays, canPlayerPass
- combination-validator.ts: canBeat, Phoenix special handling
- game.ts: GameConfig.botDifficulty, RoundState, PlayerState
- protocol.ts: ADD_BOT message with difficulty enum
