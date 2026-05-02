# Game Actions Menu — Milestone 4: In-Game Integration

**Date:** 2026-05-02
**Branch:** feature/game-actions-menu
**Milestone:** M4 — In-Game Integration

## Summary

Wired GameActionsMenu (desktop popover) and GameActionsDrawer (mobile slide-in) into the in-game view (page.tsx). Replaced room code display with click-to-copy room name, removed inline vote dropdown, added kebab menu with all in-game actions (Kick, Restart Round, Restart Game, Transfer Host, Toggle Voting, Game Settings). Added ActionConfirmDialog for host force actions and non-host vote initiation. Extended GameTable with transfer host target mode support. Implemented GA44 (Transfer Host disabled during active vote) in GameActionsMenu.

## Changes

### page.tsx
- **Removed**: `codeCopied` state, `showVoteDropdown`/`voteDropdownRef`, click-outside vote dropdown effect, Room Code display (desktop and mobile), inline vote dropdown JSX
- **Added**: `urlCopied`/`handleCopyUrl`, `drawerOpen`, `confirmAction`/`confirmTargetSeat`/`showSettings` state, imports for GameActionsMenu, GameActionsDrawer, ActionConfirmDialog, GameSettingsForm, isOnCooldown, getCooldownRemaining
- **Room name**: clickable, copies URL, "Link copied!" toast (same pattern as PreRoomView)
- **Desktop**: GameActionsMenu with `isPreGame=false`, Cancel Vote button replaces kebab during active vote
- **Mobile**: Kebab button opens GameActionsDrawer, Cancel Vote inline button
- **handleMenuAction**: dispatches kickPlayer→setKickTargetMode, restartRound/restartGame→ActionConfirmDialog, transferHost→setTransferHostTargetMode, gameSettings→setShowSettings, toggleVoting/cancelVote→send
- **Force actions**: FORCE_KICK, FORCE_RESTART_ROUND, FORCE_RESTART_GAME messages sent from host confirmation dialog
- **Vote actions**: START_KICK_VOTE, START_RESTART_ROUND_VOTE, START_RESTART_GAME_VOTE from non-host dialog
- **In-game settings**: read-only GameSettingsForm panel for all users (GA40)
- **Kick target**: now shows ActionConfirmDialog instead of directly sending START_KICK_VOTE
- **Escape handler**: updated to handle transferHostTargetMode
- **ROOM_UPDATE handler**: passes `msg.votingEnabled ?? true` to roomStore (from M3)

### GameTable.tsx
- Added `onTransferHostTarget?: (seat: Seat) => void` prop
- Added `transferHostTargetMode` from uiStore
- Unified `isTargetMode = kickTargetMode || transferHostTargetMode`
- Updated seat click logic: kickTargetMode → onKickTarget, transferHostTargetMode → onTransferHostTarget
- Updated `kickVoteTarget` and `hideNormalLabels` to use unified `isTargetMode`

### GameActionsMenu.tsx
- Added GA44: Transfer Host item disabled during active vote with "Vote in progress" hint

## Test Results
- Client typecheck: passes
- Client tests: 216/218 (2 pre-existing failures)
- Server tests: 881/881 passed

## Requirements Addressed
GA15, GA16, GA17, GA19 (in-game), GA23, GA25, GA27, GA31 (in-game), GA33 (in-game), GA34 (in-game), GA40, GA44, GA48 (in-game), GA50 (in-game), NF-GA03
