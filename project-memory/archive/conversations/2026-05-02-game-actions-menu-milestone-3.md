# Game Actions Menu — Milestone 3: Pre-Game Integration

**Date:** 2026-05-02
**Branch:** feature/game-actions-menu
**Milestone:** M3 — Pre-Game Integration

## Summary

Wired GameActionsMenu (desktop) and GameActionsDrawer (mobile) into PreRoomView.tsx. Removed room code display, added click-to-copy room name URL, replaced vote dropdown and standalone Settings button with kebab menu.

## Changes

### PreRoomView.tsx
- **Removed**: Room Code copy button (both desktop and mobile), `codeCopied` state, `showVoteDropdown` state + `voteDropdownRef` + click-outside effect, inline vote dropdown JSX, standalone Settings button + `settingsToggle` CSS class
- **Added**: `urlCopied` state, `handleCopyUrl()` (copies `window.location.href`), `transferHostTargetMode` state, `drawerOpen` state, `confirmAction`/`confirmTargetSeat` state for ActionConfirmDialog
- **Room name**: clickable, copies URL, shows "Link copied!" toast, underline on hover
- **Desktop**: GameActionsMenu with `isPreGame=true`, Cancel Vote button replaces kebab during active vote
- **Mobile**: Kebab button opens GameActionsDrawer, Cancel Vote inline button during active vote
- **Settings**: Opened via menu action, standalone button removed, `settingsToggle` CSS removed
- **Target modes**: Kick and Transfer Host target modes are mutually exclusive, opening kebab cancels both
- **Confirmation**: ActionConfirmDialog shown after target selection (kick → non-host gets vote, host gets force; transfer → immediate confirm)
- `ALLOW_SELF_KICK` constant for easy toggling
- `roomCode` destructured as `_roomCode` (unused after removing display)

### page.tsx
- Updated ROOM_UPDATE handler to pass `msg.votingEnabled ?? true` to `roomStore.updateRoom()`

### PreRoomView.module.css
- Removed `.settingsToggle` and `.settingsToggle:hover` styles

## Test Results
- Client typecheck: passes
- Client tests: 216/218 (2 pre-existing failures)

## Requirements Addressed
GA01-06, GA13, GA31-34, GA41-42, GA48-50
