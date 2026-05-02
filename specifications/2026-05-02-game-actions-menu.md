# Game Actions Menu — Specification

**Date:** 2026-05-02
**Status:** Approved
**Branch:** feature/game-actions-menu

## 1. Goal

Redesign the top-left corner UI in both pre-game (PreRoomView) and in-game (page.tsx) views. Replace the current cluttered layout (Room Name, Room Code, Spectators, Start a Vote, Leave Game) with a cleaner, more extensible design:

1. **Room Name** — clickable to copy room URL
2. **Spectators: #** — count with name tooltip
3. **Kebab menu (⋮)** — consolidated game actions (popover on desktop, slide-in drawer on mobile)
4. **Leave Game** — standalone button

The kebab menu replaces the "Start a Vote" button and the standalone "Settings" button, consolidating all game actions into a single discoverable menu. Host players gain new powers: force actions (kick/restart without voting), vote cancellation, voting toggle, and host role transfer.

### Why

- Room Code is redundant once the room name copies the URL
- "Start a Vote" is a limiting label now that more actions exist
- The kebab (⋮) is a universal "more actions" pattern — compact, scalable, instantly recognized
- Host controls are currently scattered (kick on seats, settings in top-right, voting inline)

## 2. Scope

### In Scope

- Top-left corner UI redesign (both pre-game and in-game, both layout tiers)
- Kebab menu with popover (desktop) and slide-in drawer (mobile)
- Room name click-to-copy-URL (replacing Room Code display)
- Confirmation dialogs for all destructive actions (vote vs force for host)
- New server messages: FORCE_KICK, FORCE_RESTART_ROUND, FORCE_RESTART_GAME, TRANSFER_HOST, CANCEL_VOTE, TOGGLE_VOTING
- Vote cooldown for non-host players after failed votes
- Keyboard accessibility for the menu

### Out of Scope

- Changes to the VoteOverlay component itself (existing vote display is unchanged)
- Changes to the game table, card hand, or other UI areas
- Server-side rate limiting for vote cooldowns (client-side only)
- Lobby or join-flow changes

## 3. Requirements

### Room Name & URL Copy

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| REQ-F-GA01 | Clicking the room name copies the current game URL (`window.location.href`) to the clipboard | Given a player in any view, when they click the room name, then the current page URL is written to `navigator.clipboard` |
| REQ-F-GA02 | A brief toast ("Link copied!") appears after copying, auto-dismisses after 2 seconds | Given the URL was copied, then a toast appears near the room name and disappears after 2s |
| REQ-F-GA03 | Room name shows a subtle visual hint that it's clickable (underline on hover + copy icon) | Given desktop layout, when hovering the room name, then an underline and/or copy icon appear |
| REQ-F-GA04 | The standalone Room Code display is removed from both pre-game and in-game views | Given any game view, then no "Room Code: XXXXX" element exists |

### Spectators Display

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| REQ-F-GA05 | Spectators count displays as "Spectators: #" in both layouts | Given any view, then spectator count is shown with gold-accented number |
| REQ-F-GA06 | Desktop: hover reveals tooltip with spectator names. Mobile: tap reveals names. | Given spectators are present, when hovering (desktop) or tapping (mobile), then a tooltip/popover shows all spectator names |

### Kebab Menu — Trigger & Container

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| REQ-F-GA07 | A kebab icon (⋮) button is shown in the top-left corner for all users (players and spectators) | Given any user in the room, then a ⋮ button is visible in the top-left chrome |
| REQ-F-GA08 | Desktop (full layout): clicking the kebab opens a popover/dropdown menu anchored to the button | Given full layout, when clicking ⋮, then a dropdown appears positioned to the right of the button |
| REQ-F-GA09 | Mobile (compact layout): tapping the kebab opens a slide-in side panel from the left edge, with a semi-transparent backdrop that dismisses on tap | Given mobile layout, when tapping ⋮, then a panel slides in from the left with a backdrop overlay |
| REQ-F-GA10 | The menu dismisses on Escape key, click/tap outside, or selecting an action | Given the menu is open, when pressing Escape or clicking outside, then the menu closes |
| REQ-F-GA11 | The menu is disabled while an active vote is in progress (replaced by Cancel Vote per REQ-F-GA45) | Given an active vote, then the ⋮ button is not shown; Cancel Vote button is shown instead |
| REQ-F-GA57 | Desktop: hovering the kebab button shows a "Game Actions" tooltip | Given desktop layout, when hovering ⋮, then "Game Actions" tooltip appears |
| REQ-F-GA58 | The kebab menu supports arrow-key navigation (Up/Down to move, Enter to select, Escape to close) | Given the menu is open, when pressing Up/Down arrow keys, then focus moves between items; Enter selects the focused item |

### Kebab Menu — Items (Pre-Game)

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| REQ-F-GA12 | Pre-game menu contains: Kick Player, Transfer Host Role (host-only), Game Settings | Given pre-game state, when opening the menu, then exactly these items are shown (Transfer Host only for host) |
| REQ-F-GA13 | Selecting "Kick Player" enters target selection mode (click a player seat to select target) | Given a player selects Kick Player, then seat highlighting activates and a hint is shown |

### Kebab Menu — Items (In-Game)

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| REQ-F-GA14 | In-game menu contains: Kick Player, Restart Round, Restart Game, Transfer Host Role (host-only), Game Settings | Given in-game state, when opening the menu, then exactly these items are shown |
| REQ-F-GA15 | Selecting "Kick Player" enters target selection mode | Same as REQ-F-GA13 but sends in-game message types |
| REQ-F-GA16 | Selecting "Restart Round" opens a confirmation dialog | Given a player selects Restart Round, then a confirmation dialog appears |
| REQ-F-GA17 | Selecting "Restart Game" opens a confirmation dialog | Given a player selects Restart Game, then a confirmation dialog appears |

### Kebab Menu — Spectator View

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| REQ-F-GA39 | Spectators see the kebab menu with Game Settings only (Kick/Restart/Transfer items are hidden) | Given a spectator opens the menu, then only Game Settings is shown |
| REQ-F-GA40 | In-game Game Settings are read-only for all players; pre-game settings are editable for host only | Given any player opens Game Settings in-game, then all fields are read-only |

### Confirmation Dialogs — Non-Host

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| REQ-F-GA18 | Non-host selecting Kick (after target), Restart Round, or Restart Game sees a dialog with "Cancel" and "Start Vote" buttons | Given a non-host player confirms an action, then a two-button dialog appears |
| REQ-F-GA19 | "Start Vote" sends the appropriate vote message to the server | Given the user clicks "Start Vote", then the correct message type is sent (PRE_GAME_KICK_VOTE, START_KICK_VOTE, START_RESTART_ROUND_VOTE, or START_RESTART_GAME_VOTE) |

### Confirmation Dialogs — Host

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| REQ-F-GA20 | Host selecting Kick (after target), Restart Round, or Restart Game sees a dialog with "Cancel", "Start Vote", and "Force [Action]" buttons | Given a host player confirms an action, then a three-button dialog appears |
| REQ-F-GA21 | "Force [Action]" button has destructive styling (red background) to prevent accidental use | Given the host dialog is shown, then the Force button is visually distinct with red/destructive styling |
| REQ-F-GA22 | "Start Vote" is the default/primary button in the host dialog | Given the host dialog is shown, then "Start Vote" has primary styling and is visually emphasized over "Force" |
| REQ-F-GA23 | "Force [Action]" sends a force message to the server which executes immediately without voting | Given the host clicks "Force Kick", then FORCE_KICK is sent and the player is kicked immediately |

### Transfer Host Role

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| REQ-F-GA24 | "Transfer Host Role" menu item is only visible to the current host | Given a non-host player opens the menu, then Transfer Host Role is not shown |
| REQ-F-GA25 | Selecting "Transfer Host" enters target selection mode (click a human player seat) | Given the host selects Transfer Host, then seat highlighting activates for human-occupied seats only |
| REQ-F-GA26 | After selecting a target, a confirmation dialog appears: "Transfer host to **PlayerName**?" with "Cancel" and "Transfer" buttons | Given the host clicks a target seat, then a confirmation dialog names the target player |
| REQ-F-GA27 | On confirmation, a TRANSFER_HOST message is sent to the server | Given the host clicks "Transfer", then `{ type: 'TRANSFER_HOST', targetSeat }` is sent |
| REQ-F-GA28 | Server immediately transfers host role — target becomes host, original host becomes a regular player | Given the server receives TRANSFER_HOST, then hostSeat is updated atomically |
| REQ-F-GA29 | All clients receive updated host seat via ROOM_UPDATE broadcast | Given host transfer completes, then all clients see the new host reflected in their UI |
| REQ-F-GA48 | Transfer Host target selection only highlights human player seats (bot seats are not clickable) | Given Transfer Host target mode, when a bot seat exists, then it is not highlighted or clickable |

### Game Settings (in kebab menu)

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| REQ-F-GA30 | "Game Settings" appears as the last item in the kebab menu for all players and spectators | Given any user opens the menu, then Game Settings is the last item listed |
| REQ-F-GA31 | Opens the existing GameSettingsForm — editable for host (pre-game only), read-only otherwise | Given the host opens settings pre-game, then fields are editable; all other cases are read-only |
| REQ-F-GA32 | The standalone "Settings" button in the top-right corner is removed from pre-game view | Given pre-game view, then no separate Settings button exists outside the kebab menu |

### Leave Game

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| REQ-F-GA33 | "Leave Game" remains a standalone button, not inside the kebab menu | Given any view, then a Leave Game button is always visible in the top-left chrome |
| REQ-F-GA34 | Behavior unchanged — shows confirmation dialog, then navigates to lobby | Given the user clicks Leave Game and confirms, then they are returned to the lobby |

### Target Selection Mode

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| REQ-F-GA41 | Only one target selection mode can be active at a time; starting a new selection cancels the previous one | Given kick target mode is active, when the user selects Transfer Host, then kick mode is cancelled and transfer mode activates |
| REQ-F-GA42 | Opening the kebab menu cancels any active target selection mode | Given target selection is active, when the user clicks ⋮, then selection mode is cancelled and the menu opens |
| REQ-F-GA49 | Self-kick is allowed — a player can start a vote to kick themselves. Flagged for easy removal. | Given a player in kick target mode clicks their own seat, then the kick confirmation dialog appears for that player. Implementation note: guard this with a constant `ALLOW_SELF_KICK = true` for easy toggling. |
| REQ-F-GA50 | Mobile drawer closes immediately before entering target selection mode or opening the settings panel | Given mobile layout with drawer open, when selecting Kick Player, then drawer closes first, then target mode activates |

### Vote Management

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| REQ-F-GA43 | While a vote is in progress, kebab menu actions that would start a vote or force action are disabled | Given an active vote, then the kebab is replaced by Cancel Vote (per GA45); no new actions can be initiated |
| REQ-F-GA44 | Transfer Host is also disabled while a vote is in progress | Given an active vote, then Transfer Host cannot be initiated |
| REQ-F-GA45 | While a vote is active, the kebab icon is replaced by a visible "Cancel Vote" button for the host and the vote initiator; other users see the kebab as disabled | Given an active vote, then the host and initiator see a "Cancel Vote" button where ⋮ was; others see a disabled ⋮ |
| REQ-F-GA46 | Host can toggle whether non-host players are allowed to start votes via "Disable Voting" / "Enable Voting" in the kebab menu | Given the host opens the menu, then a toggle item shows current voting state and allows changing it |
| REQ-F-GA47 | When voting is disabled, non-host players see vote-related actions as visible but greyed out with hint "Voting disabled by host" | Given voting is disabled, when a non-host opens the menu, then Kick/Restart items are greyed out with explanation text |
| REQ-F-GA54 | When a vote is cancelled by the host or initiator, all players and spectators see "Vote cancelled by [Name]" | Given the host cancels a vote, then all clients see a vote result message with cancellation text |
| REQ-F-GA55 | The voting-disabled state persists for the lifetime of the room (across rounds and games) | Given the host disables voting, when a new game starts, then voting remains disabled |
| REQ-F-GA56 | Non-host players see vote-related actions as visible but disabled when voting is disabled (not hidden) | Given voting is disabled, then menu items are rendered but not interactive, with explanatory text |

### Vote Cooldown

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| REQ-F-GA59 | After a non-host player's vote fails, that player cannot initiate the same vote type (same action + same target for kicks) for 120 seconds | Given a non-host's kick vote against Player X fails, then "Kick Player" is disabled for 120s (but kick against Player Y is allowed) |
| REQ-F-GA60 | The vote cooldown does not apply to the host | Given a host's vote fails, then no cooldown is applied |
| REQ-F-GA61 | The vote cooldown is tracked client-side (resets on page refresh) | Given a cooldown is active, when the page is refreshed, then the cooldown is cleared |

### Server — Force Actions

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| REQ-F-GA35 | Server accepts FORCE_KICK (with targetSeat) from the host only — kicks the player immediately | Given the host sends FORCE_KICK, then the target is removed from the room/game immediately; non-host senders are rejected |
| REQ-F-GA36 | Server accepts FORCE_RESTART_ROUND from the host only — restarts the current round immediately | Given the host sends FORCE_RESTART_ROUND, then the round resets; non-host senders are rejected |
| REQ-F-GA37 | Server accepts FORCE_RESTART_GAME from the host only — restarts the game immediately | Given the host sends FORCE_RESTART_GAME, then the game resets to pre-game; non-host senders are rejected |
| REQ-F-GA38 | Server accepts TRANSFER_HOST (with targetSeat) from the host only, targeting a human player, when no vote is active | Given the host sends TRANSFER_HOST targeting a human seat with no active vote, then hostSeat is reassigned and ROOM_UPDATE is broadcast |

### Server — Vote Management

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| REQ-F-GA51 | Server accepts CANCEL_VOTE from the host or the vote initiator only — immediately ends the active vote | Given the host or initiator sends CANCEL_VOTE, then the vote ends with a "cancelled" result |
| REQ-F-GA52 | Server accepts TOGGLE_VOTING from the host — enables/disables vote initiation by non-host players; state broadcast via ROOM_UPDATE | Given the host sends TOGGLE_VOTING, then the votingEnabled flag toggles and all clients are notified |
| REQ-F-GA53 | Server rejects vote-start messages from non-host players when voting is disabled; host can always start votes | Given voting is disabled and a non-host sends START_KICK_VOTE, then the server rejects the message |

### Non-Functional Requirements

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| REQ-NF-GA01 | Kebab menu opens/closes within one animation frame (no perceptible delay on desktop) | Given desktop layout, when clicking ⋮, then the popover appears instantly (no transition) |
| REQ-NF-GA02 | Mobile slide-in drawer uses a CSS transition (~200ms slide from left) | Given mobile layout, when tapping ⋮, then the panel slides in smoothly over ~200ms |
| REQ-NF-GA03 | All new UI works at both layout tiers (full ≥900px, mobile <900px) | Given either layout tier, then all features are functional and visually correct |

## 4. Assumptions

1. The existing vote system (VoteHandler, VoteOverlay) works correctly and does not need refactoring — only new entry points and cancellation are added.
2. The GameSettingsForm component already supports a `readOnly` prop and needs no changes.
3. `navigator.clipboard.writeText` is available in all target browsers.
4. The host seat is always set (at least one human player exists in the room).

## 5. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Mobile slide-in drawer z-index conflicts with VoteOverlay, settings modal, or leave dialog | Medium | Medium | Assign z-index hierarchy: drawer=40, settings=50, vote overlay=60, leave dialog=100 |
| Force actions bypassing game state validation | Low | High | Server force handlers go through the same state transition logic as vote-resolved actions |
| Transfer Host race condition (two messages simultaneously) | Low | Medium | Server handles TRANSFER_HOST atomically; reject if sender is no longer host |
| Vote cooldown easily bypassed by page refresh | Medium | Low | Acceptable per REQ-F-GA61; server-side rate limiting can be added later |
| Scope: touches PreRoomView, page.tsx, server handlers, shared protocol | Medium | Medium | Milestone carefully — UI first, then server, then integration |
| "Game Settings" during active game not previously designed for | Low | Medium | Read-only mode already exists in GameSettingsForm |
| Self-kick vote could confuse or enable griefing | Low | Low | Guarded by ALLOW_SELF_KICK constant per REQ-F-GA49 |

## 6. Success Metrics

1. Top-left corner shows exactly 4 elements (Room Name, Spectators, Kebab/Cancel Vote, Leave Game) in both layout tiers
2. All existing vote functionality works identically through the new menu (zero regressions)
3. Host force actions and Transfer Host work end-to-end
4. Mobile drawer opens/closes smoothly with proper backdrop dismissal
5. Keyboard navigation works for the menu (arrow keys, Enter, Escape)
6. All tests pass with ≥80% statement coverage on new code

## 7. Confidence

**High** — All requirements are clear, testable, and non-conflicting. Edge cases thoroughly explored. Server additions extend existing patterns. UI changes are well-scoped with one new pattern (mobile drawer) that follows a standard approach.
