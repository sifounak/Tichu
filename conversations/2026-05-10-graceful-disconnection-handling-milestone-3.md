# Graceful Disconnection Handling — Milestone 3: Vote Integration

## Summary

Implemented vote integration with disconnection handling per REQ-F-VI01–VI09, REQ-F-KM12, REQ-F-KM13.

## Key Decisions

- **Timer pause/reset approach**: Added `pause()` and `resetToFull()` to TurnTimer class. Pause saves remaining time but keeps `currentSeat` so resetToFull knows who to restart for. 
- **Excluded seats via parameter**: Rather than having VoteHandler query DisconnectHandler directly (coupling), the exclusion list is passed as a parameter from GameManager.
- **Interrupted vote snapshot**: Stored as a simple `{ voteType, initiatorSeat, targetSeat? }` on GameManager. Cleared after restart or if moot.
- **Vote restart after kick dialog**: Uses `onDialogDismissed` callback (reconnect or declined) to trigger restart. Kick callback handles the kicked case.
- **REQ-F-VI07 (< 2 min during vote)**: No code change needed — the existing 30s vote timeout naturally handles non-responding players.

## Changes Made

### turn-timer.ts
- Added `pausedRemainingMs` field
- Added `pause()` method — saves remaining, clears timeout, keeps currentSeat
- Added `resetToFull()` method — restarts timer at full duration for current seat
- Added `isPaused()` method
- Updated `getRemainingMs()` to return paused time when paused
- Updated `stop()` to clear paused state

### vote-handler.ts
- Added `excludedSeats: Seat[] = []` parameter to `startKickVote`, `startRestartGameVote`, `startRestartRoundVote`
- Added `getVoteSnapshot()` method for interrupted vote saving

### game-manager.ts
- Added `interruptedVote` field for tracking interrupted votes
- Updated `onThresholdCrossed` wiring: if vote active, save snapshot, cancel vote, reset timer, then show kick dialog (REQ-F-VI03/VI04)
- Added `onDialogDismissed` wiring: restart interrupted vote on reconnect or decline (REQ-F-VI05/VI06)
- Updated `onKick` wiring: restart interrupted vote after kick (REQ-F-VI05)
- Updated all three `handleStartXVote` methods: dismiss kick dialog (KM12), pass excluded seats (VI01), pause timer (VI08)
- Updated `wireVoteCallback`: reset timer (VI09), reappear kick dialog (KM13)
- Added `restartInterruptedVoteIfApplicable()` private method
- Same wiring applied in `restore()` static method

### vote-integration.test.ts (NEW)
- 21 tests covering all M3 requirements
- Timer pause/reset tests
- Excluded seats tests
- Vote snapshot tests
- KM12/KM13 dismiss/reappear tests
- Integration: threshold during vote test
- Integration: vote restart after kick dialog test

## Test Results

- All 933 tests pass
- Typecheck passes across all packages (shared, server, client)
