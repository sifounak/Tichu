# Game Actions Menu — Milestone 2: Shared UI Components

**Date:** 2026-05-02
**Branch:** feature/game-actions-menu
**Milestone:** M2 — Shared UI Components

## Summary

Built three reusable components (GameActionsMenu, GameActionsDrawer, ActionConfirmDialog) and updated Zustand stores with voting/transfer state.

## Changes

### Store Updates

**roomStore.ts**: Added `votingEnabled: boolean` to state, `updateRoom()` signature, `INITIAL_STATE`, and `leaveRoom()` reset.

**uiStore.ts**: Added `transferHostTargetMode: boolean`, `voteCooldowns: Map<string, number>`, `setTransferHostTargetMode()` (mutual exclusion with kickTargetMode), `addVoteCooldown()`. Exported standalone `isOnCooldown()` and `getCooldownRemaining()` functions (can't reference store inside own initializer).

### GameActionsMenu (Desktop Popover)

- Kebab button (⋮) with title="Game Actions"
- Popover dropdown positioned below button
- Conditional menu items based on `isHost`, `isSpectator`, `isPreGame`
- Disabled states with hint text for voting-disabled and cooldown
- Arrow key navigation between items
- Click-outside and Escape dismiss
- Cancel Vote button replaces kebab during active vote (for host + initiator)

### GameActionsDrawer (Mobile Slide-in)

- createPortal to document.body
- Left-edge slide-in with 200ms CSS transition
- Semi-transparent backdrop (click to dismiss)
- Same menu item logic as desktop popover
- Escape to close

### ActionConfirmDialog

- Non-host variant: Cancel + Start Vote (gold primary)
- Host variant: Cancel + Start Vote (gold) + Force [Action] (red destructive)
- Transfer Host variant: Cancel + Transfer (gold)
- Escape to close, backdrop click to close
- Follows LeaveConfirmDialog visual patterns

## Key Decision

`isOnCooldown` and `getCooldownRemaining` are standalone exported functions rather than store methods, because referencing `useUiStore.getState()` inside the store's own initializer causes a TypeScript circular reference error.

## Test Results

- Server: 881/881 passed
- Client: 216/218 passed (2 pre-existing failures)
- Typecheck: All packages pass

## Requirements Addressed

GA07-10, GA12, GA14, GA18, GA20-22, GA24, GA26, GA30, GA39, GA45-47, GA56-58, NF-GA01, NF-GA02
