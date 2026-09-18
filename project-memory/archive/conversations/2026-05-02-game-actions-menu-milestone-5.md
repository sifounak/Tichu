# Game Actions Menu — Milestone 5: Vote Management & Polish

**Date:** 2026-05-02
**Branch:** feature/game-actions-menu
**Milestone:** M5 — Vote Management & Polish

## Summary

Implemented vote cooldown recording on failed votes (per-target for kicks, per-type for restarts), disabled Transfer Host in the mobile drawer during active votes, and verified that GA11/GA43/GA54 were already satisfied by existing implementations.

## Changes

### page.tsx
- Added cooldown recording in VOTE_RESULT handler: when a vote fails and the current user was the non-host initiator, records a 120s cooldown keyed by `kick:${targetSeat}` or the vote type
- Added per-target kick cooldown check at kick target selection — shows error toast if target is on cooldown

### PreRoomView.tsx
- Added per-target kick cooldown check in `handlePreGameKickTarget` — silently blocks if target is on cooldown

### GameActionsMenu.tsx
- Removed generic `'kick'` cooldown check from menu item (cooldown is per-target, checked at selection)
- Added GA44: Transfer Host disabled with "Vote in progress" hint during active vote (from M4 work)

### GameActionsDrawer.tsx
- Removed generic `'kick'` cooldown check from menu item (same as menu)
- Added GA44: Transfer Host disabled during active vote
- Fixed missing `activeVote` destructuring from props

## Requirements Addressed

### GA11 — Menu disabled during active vote
Already satisfied by GA45: Cancel Vote button replaces the kebab during active votes. The menu cannot be opened.

### GA43 — Vote actions disabled during active vote
Same as GA11 — the menu is replaced by Cancel Vote, so no new actions can be initiated.

### GA44 — Transfer Host disabled during active vote
Implemented in both GameActionsMenu and GameActionsDrawer: disabled with "Vote in progress" hint.

### GA54 — "Vote cancelled by [Name]" message
Server (M1) sends `"Vote cancelled by ${cancellerName}"` in VOTE_RESULT message. Client VOTE_RESULT handler displays `msg.message` via `uiStore.setVoteResult()`. End-to-end flow works.

### GA59 — Vote cooldown 120s (same type+target)
Recorded in page.tsx VOTE_RESULT handler. Kicks use `kick:${targetSeat}` key (per-target). Restarts use `restartRound`/`restartGame` key. Menu items for restart round/game check cooldown and show countdown. Kick targets checked at selection time with error toast.

### GA60 — No cooldown for host
Cooldown recording only triggers when `mySeatFromRoom !== hostSeat`.

### GA61 — Cooldown client-side only
Stored in Zustand `voteCooldowns` Map — resets on page refresh.

## Test Results
- Client typecheck: passes
- Client tests: 216/218 (2 pre-existing failures)
