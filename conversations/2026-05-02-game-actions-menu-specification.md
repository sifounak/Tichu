# Game Actions Menu — Specification Conversation

**Date:** 2026-05-02
**Phase:** Specification (Phase 1.2)
**Branch:** feature/game-actions-menu

## Summary of Key Decisions

### Design Decisions
1. **Top-left layout:** Room Name (click to copy URL) → Spectators: # → Kebab (⋮) / Cancel Vote → Leave Game
2. **Room Code removed entirely** — clicking room name copies full game URL instead
3. **Kebab icon (⋮)** chosen over text labels — universal "more actions" pattern, tooltip "Game Actions" on hover
4. **Desktop:** popover dropdown anchored to kebab button
5. **Mobile:** slide-in side panel from left edge with backdrop dismiss
6. **Leave Game stays standalone** — it's a navigation action, not a game action

### Menu Structure
- **Pre-game:** Kick Player, Transfer Host Role (host-only), Game Settings
- **In-game:** Kick Player, Restart Round, Restart Game, Transfer Host Role (host-only), Game Settings
- **Spectator:** Game Settings only
- Game Settings replaces the standalone "Settings" button in top-right

### Host Powers
- **Force actions:** Host gets Cancel / Start Vote / Force [Action] dialog (Force is red/destructive, Start Vote is primary)
- **Transfer Host:** Target selection → confirmation → immediate transfer (no voting)
- **Cancel Vote:** Replaces kebab icon during active vote; visible to host AND vote initiator
- **Toggle Voting:** Host can disable/enable non-host voting; persists across rounds/games in room
- **Direct kick button on seats remains** alongside menu flow for convenience

### Edge Cases Resolved
- Opening kebab cancels any active target selection mode
- Only one target selection mode at a time (kick vs transfer — new one cancels old)
- While vote is active: kebab replaced by Cancel Vote (host/initiator) or disabled (others)
- Transfer Host disabled during active vote
- Transfer Host only targets human players (not bots)
- Self-kick allowed (guarded by ALLOW_SELF_KICK constant for easy removal)
- Mobile drawer closes immediately before entering target mode or opening settings
- Vote cooldown: 120s for non-host after failed vote (same type + target), client-side only
- Cancelled votes show "Vote cancelled by [Name]" to all players/spectators
- Voting-disabled state: menu items visible but greyed out with "Voting disabled by host" hint

### Keyboard Accessibility
- Arrow key navigation (Up/Down) in menu
- Enter to select, Escape to close

## Requirements Count
- 61 functional requirements (REQ-F-GA01 through REQ-F-GA61)
- 3 non-functional requirements (REQ-NF-GA01 through REQ-NF-GA03)
- Confidence: High
