# Conversation: Vote & Spectator Improvements — Milestone 2

**Date:** 2026-03-23
**Phase:** Implementation — M2
**Branch:** feature/player-vote-kick-restart

## Summary

### Changes Made
1. **VoteOverlay readOnly prop** (VoteOverlay.tsx): Added `readOnly?: boolean` prop. When true, shows "Vote in progress — spectators cannot vote" instead of vote buttons.
2. **Game page VoteOverlay gate** (game/page.tsx:1369): Removed `!isSpectator` condition so spectators see the overlay. Pass `readOnly={isSpectator}` and handle nullable mySeat with fallback `'south'`.

### Requirements Addressed
- REQ-F-VI06: Spectators see vote overlay (read-only)
- REQ-F-VI07: Spectators see vote result (already ungated — voteResult center status was never gated by isSpectator)
