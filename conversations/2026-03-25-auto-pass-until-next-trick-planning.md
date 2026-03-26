# Auto-Pass Until Next Trick — Planning Conversation

**Date:** 2026-03-25
**Phase:** Planning (Phase 1.4)

## Summary

Designed a 3-milestone implementation plan for the client-only auto-pass feature.

## Key Decisions

1. **3 milestones:** State+Logic → UI+Styling → Tests
2. **Auto-pass useEffect** approach: single effect with guards for all edge cases, 350ms setTimeout with cleanup
3. **Reset triggers:** GAME_STATE sync, trick won (currentTrick null), play cards (all play handlers), dragon gift pending
4. **Toggle placement:** In ActionBar splitLeft, above Pass button, styled as compact label with hidden checkbox
5. **showAutoPass computation:** phase=playing && !spectator && !finished && !showReceivedCards
6. **RTM created** with 15 requirements mapped to source and test files
