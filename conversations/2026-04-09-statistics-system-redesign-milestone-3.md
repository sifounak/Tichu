# Statistics System Redesign — Milestone 3: Event Capture

**Date:** 2026-04-09
**Branch:** feature/stats-redesign-event-capture
**Previous milestones:** M1 (Schema — commit 2cc6a8d), M2 (Interfaces — commit 37e1850)

## Summary

Implemented the hybrid event capture architecture (REQ-F-CP01) that captures all game events in memory during gameplay for later batch persistence.

## Key Decisions

1. **New class vs extending existing:** Created a new `GameEventCapture` class rather than modifying the existing `RoundEventTracker`. The old tracker produces `RoundEventSummary` (flat counters) while the new system produces `RoundEventData` (structured event records). Both run in parallel — the old tracker will be retired in M6 (migration).

2. **Bot action capture (REQ-F-CP17):** Rather than threading pre-play callbacks through `BotRunner`, the capture class computes pre-play context retroactively from the previous state diff when no pending context exists. This avoids modifying `BotRunner` while still capturing `legalPlayCount`, `playedMinimum`, `couldHaveGoneOut`, and hand sizes for bot plays.

3. **Pre-play context timing:** Pre-play contexts must be recorded AFTER round initialization (which clears the pending map) but BEFORE the state machine transition. The `GameManager.recordPrePlayForAction()` method handles this in `handleMessage()` just before `moveHandler` calls.

4. **Trick numbering:** Fixed an issue where empty tricks (no plays yet) were not treated as "new trick" starts. Added detection for `prevTrick.plays.length === 0 && currTrick.plays.length > 0` to correctly increment trick counters.

5. **Chat counter capture (REQ-F-CP18):** Deferred as a Should-have. Requires integration with the chat message handler, which is outside the game event capture scope.

## Files Created

- `code/packages/server/src/game/game-event-capture.ts` — New capture class (~600 lines)
  - Pre-play context management (record/discard)
  - Phase transition detection (hand snapshots, pass data, bomb inventory)
  - Play/pass detection via state diffs
  - Trick creation and completion
  - Tichu/GT call detection
  - Special event detection (wish, dragon gift, dog play)
  - Bomb lifecycle tracking (inventory, erosion, fate)
  - Round/game finalization (scoring, finish positions)
  - Retroactive pre-play computation for bot actions

- `code/packages/server/tests/game/game-event-capture.test.ts` — 23 unit tests covering all capture requirements

## Files Modified

- `code/packages/server/src/game/game-manager.ts` — Integration hooks:
  - Added imports for new capture system
  - Created `GameEventCapture` instance in constructor
  - Added `recordPrePlayForAction()` helper for pre-play enrichment
  - Hooked into `handleMessage()` for PLAY_CARDS and PASS_TURN
  - Hooked into `onStateChange()` for state diff observation
  - Hooked into auto-pass and turn timeout paths
  - Added turn start time tracking
  - Exposed `getEventAccumulator()` for future persistence (M4)

## Test Results

- 23 tests passed, 0 failed
- Statement coverage: 92.32% (threshold: 80%)
- No regressions in existing test suite

## RTM Status

19/20 M3 requirements Passed, 1 Deferred (CP18 — chat counters, Should-have)
