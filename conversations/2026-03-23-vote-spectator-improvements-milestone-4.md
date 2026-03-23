# Conversation: Vote & Spectator Improvements — Milestone 4

**Date:** 2026-03-23
**Phase:** Implementation — M4
**Branch:** feature/player-vote-kick-restart

## Summary

### Changes Made

**Shared Protocol:**
- Added `PRE_GAME_KICK_VOTE` and `PRE_GAME_VOTE` message types to protocol.ts to avoid conflicts with in-game vote messages routed through GameHandler.

**Server (room-handler.ts):**
- Added `preGameVoteHandler: VoteHandler` field — room-level VoteHandler instance for pre-game votes
- Registered `PRE_GAME_KICK_VOTE` and `PRE_GAME_VOTE` message handlers
- `wirePreGameVoteCallback()`: On kick vote pass, removes player from room (or bot), sends KICKED, resets ready states, broadcasts room update
- `handlePreGameKickVote()`: Validates seat, checks no active vote, gets human seats, starts kick vote
- `handlePreGameVote()`: Forwards vote to preGameVoteHandler
- `startGameInternal()`: Cancels any active pre-game vote before game starts (REQ-NF-VI03)

**Client (PreRoomView.tsx):**
- Added `showVoteDropdown` and `preGameKickTargetMode` state
- Added "Start a Vote" button with "Kick Player" dropdown (positioned right, opaque background)
- Added kick target mode with Escape key cancel, click-to-kick on player seats
- Added VoteOverlay integration reading from uiStore (activeVote, voteCountdown, voteResult)
- Added vote result center status display
- Built seatNames mapping for VoteOverlay
- Sends `PRE_GAME_VOTE` (not `PLAYER_VOTE`) for pre-game votes

### Requirements Addressed
REQ-F-VI08–VI15, REQ-NF-VI01–VI03

### Key Design Decisions
- Reuses existing VoteHandler class (same unanimous threshold, 30s timeout)
- Distinct message types avoid MessageRouter conflicts with GameHandler
- PreRoomView reads from uiStore which is already populated by game page's message handler
