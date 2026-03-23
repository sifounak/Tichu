# Specification: Vote & Spectator Improvements

**Date:** 2026-03-22
**Type:** Enhancement / Bug Fix
**Status:** Draft
**Parent Spec:** `2026-03-22-player-vote-kick-restart.md`

## 1. Goal

Fix bugs in the bot kick vote flow, extend the voting system to the pre-game phase, improve spectator visibility into votes, allow the host to add bots mid-game to fill vacated seats, and polish vote/spectator UI positioning and styling.

### Why

- **Bot kick bug**: When a bot is kicked via vote, `room.players` is not updated (bots lack userId in seatToUser), causing the lobby to show 4/4 players and no "Join" button. Spectators also cannot fill the empty seat.
- **Spectator visibility**: Spectators can see game state but receive no vote UI, making them unaware of ongoing votes.
- **Pre-game voting**: Players currently cannot vote-kick in the pre-game lobby, only the host can kick. A democratic mechanism is needed.
- **Host add bot**: After a kick mid-game, there's no way to add a bot to fill the vacated seat and resume play.
- **UI polish**: Dropdown and popup positioning obscures buttons below; dropdown background is semi-transparent and hard to read.

## 2. Scope

### In Scope
- Fix bot kick vote to properly remove bot from `room.players`
- Host "Add Bot" button on vacated seats during active gameplay
- Read-only vote notifications for spectators (VoteOverlay)
- Pre-game kick voting (real vote, unanimous, using existing VoteHandler class)
- "Start a Vote" button in PreRoomView with only "Kick Player" option
- Opaque background for vote dropdown
- Reposition Spectators popup to right of button (top-aligned)
- Reposition "Start a Vote" dropdown to right of button (top-aligned)

### Out of Scope
- Spectator voting participation
- Pre-game restart votes (no game to restart)
- Vote history or analytics
- Changes to the XState game state machine

## 3. Functional Requirements

### Bug Fixes

**REQ-F-VI01: Bot kick removes from room.players**
When a bot is kicked via vote, the server must remove the bot from `room.players` so that `playerCount` decreases and `hasEmptySeats` becomes true. Currently the kick callback only handles human players (via `getUserIdAtSeat` which returns undefined for bots).
- *Acceptance:* After bot kick vote passes: `room.players.length` is 3, lobby shows "Join (In Progress)" button, `hasEmptySeats` is true.

**REQ-F-VI02: Spectator seating after bot kick**
After a bot is kicked, the seat queue (`tryStartSeatQueue`) must function correctly, offering the vacated seat to spectators.
- *Acceptance:* Spectators receive SEAT_OFFERED after bot kick; can claim seat and join the game. (Resolved by REQ-F-VI01 fix.)

### Host Add Bot Mid-Game

**REQ-F-VI03: Allow addBot during active game**
The server's `addBot()` method must work when `room.gameInProgress` is true, provided the target seat is unoccupied (vacated).
- *Acceptance:* `addBot()` succeeds for vacated seats mid-game; throws only if seat is occupied.

**REQ-F-VI04: Mid-game bot integration**
When a bot is added to a vacated seat mid-game, the server must register the bot with the game's bot runner, fill the vacated seat (remove from `vacatedSeats`), and resume the game if all seats are filled.
- *Acceptance:* Bot is registered, `vacatedSeats` shrinks, game resumes if no more vacated seats. Seat queue is notified via `handleSeatFilledExternally`.

**REQ-F-VI05: Host "Add Bot" button on vacated seats**
During active gameplay, the host sees an "Add Bot" button on each vacated player seat (below "Waiting for player to join" text). Non-host players do not see this button.
- *Acceptance:* Button visible only to host on vacated seats; clicking sends `ADD_BOT` message with the seat; bot appears and game resumes.

### Spectator Vote Notifications

**REQ-F-VI06: Spectators see vote overlay (read-only)**
When a vote is active, spectators see the VoteOverlay component in read-only mode: they see the vote description, countdown timer, and per-seat vote status, but cannot cast votes.
- *Acceptance:* VoteOverlay renders for spectators with vote info; no vote buttons shown; message "Vote in progress — spectators cannot vote" displayed instead of buttons.

**REQ-F-VI07: Spectators see vote result**
After a vote resolves, spectators see the same vote result center status as players (e.g., "Player was kicked!", "Vote Failed!").
- *Acceptance:* Vote result message appears for spectators with same styling and 2-second auto-dismiss.

### Pre-Game Voting

**REQ-F-VI08: Pre-game VoteHandler instance**
The server creates a room-level VoteHandler instance in RoomHandler for pre-game votes, separate from the per-game VoteHandler used during active gameplay.
- *Acceptance:* `preGameVoteHandler` exists in RoomHandler; handles votes when no game is in progress; cleaned up when game starts or room is destroyed.

**REQ-F-VI09: Pre-game kick vote messages**
New client message types `PRE_GAME_KICK_VOTE` (with `targetSeat`) and `PRE_GAME_VOTE` (with `voteId` and `vote` boolean) are added to the shared protocol, routed to RoomHandler when no game is in progress.
- *Acceptance:* Messages defined in protocol.ts; RoomHandler registers handlers; messages are validated.

**REQ-F-VI10: Pre-game kick vote execution**
When a pre-game kick vote passes, the target player is removed from the room (equivalent to `kickPlayer`), sent a `KICKED` message, and room state is broadcast. Ready states are reset.
- *Acceptance:* Kicked player navigates to lobby; room updates show reduced player count; ready states reset.

**REQ-F-VI11: Pre-game "Start a Vote" button**
In PreRoomView, all seated non-spectator players see a "Start a Vote" button between the Spectators tooltip and Leave Room button. The dropdown shows only "Kick Player" (no "Restart Game" since no game is active).
- *Acceptance:* Button visible for all seated players (not just host); dropdown shows only "Kick Player"; hidden during active vote.

**REQ-F-VI12: Pre-game kick target selection**
Selecting "Kick Player" from the pre-game dropdown enters kick target mode. Clicking another player's seat sends `PRE_GAME_KICK_VOTE`. Escape or clicking empty space cancels.
- *Acceptance:* Player seats become clickable with visual indication; clicking sends vote; Escape cancels.

**REQ-F-VI13: Pre-game vote overlay**
During an active pre-game vote, all seated players see the VoteOverlay component with appropriate vote/result messaging, same as during active gameplay.
- *Acceptance:* VoteOverlay renders in PreRoomView during active vote; countdown, vote buttons, and result display work identically to in-game.

**REQ-F-VI14: Pre-game vote — cannot kick self**
A player cannot initiate a pre-game kick vote targeting themselves.
- *Acceptance:* Server rejects `PRE_GAME_KICK_VOTE` where initiator seat equals target seat with error.

**REQ-F-VI15: Pre-game concurrent vote prevention**
Only one pre-game vote can be active at a time per room.
- *Acceptance:* Attempting a second vote returns an error; no second session created.

### UI Improvements

**REQ-F-VI16: Opaque vote dropdown background**
The "Start a Vote" dropdown background must be opaque (`rgb(0,0,0)`) instead of semi-transparent (`var(--color-bg-panel)`).
- *Acceptance:* Dropdown background is solid black; text is readable against it.

**REQ-F-VI17: Spectators popup positioned right of button**
The Spectators hover tooltip is positioned to the right of the Spectators button (left: 100%, top: 0) with a small left margin, instead of below the button.
- *Acceptance:* Tooltip appears to the right, top-aligned with the button, in both game page and PreRoomView.

**REQ-F-VI18: Vote dropdown positioned right of button**
The "Start a Vote" dropdown is positioned to the right of the button (left: 100%, top: 0) with a small left margin, instead of below the button.
- *Acceptance:* Dropdown appears to the right, top-aligned with the button, in both game page and PreRoomView.

## 4. Non-Functional Requirements

**REQ-NF-VI01: Pre-game vote consistency**
Pre-game voting uses the same VoteHandler class, same unanimous threshold, same 30-second timeout, and same broadcast pattern as in-game voting.
- *Acceptance:* Behavior is indistinguishable from in-game voting (same overlay, same countdown, same resolution).

**REQ-NF-VI02: No message routing conflicts**
Pre-game vote messages (`PRE_GAME_KICK_VOTE`, `PRE_GAME_VOTE`) use distinct message types to avoid conflicts with in-game `START_KICK_VOTE` and `PLAYER_VOTE` which route through GameHandler.
- *Acceptance:* Both pre-game and in-game votes work independently without interference.

**REQ-NF-VI03: Clean pre-game vote cleanup**
When a game starts, any active pre-game vote is cancelled and the pre-game VoteHandler session is cleaned up.
- *Acceptance:* Starting a game while a pre-game vote is active cancels the vote; no orphaned sessions.

## 5. Assumptions

1. The existing VoteHandler class can be instantiated multiple times (one for pre-game in RoomHandler, one per game in GameManager)
2. The `removeBot()` method is safe to call from the kick vote callback
3. `game.registerBot()` + `game.handleSeatFilled()` is sufficient to integrate a bot mid-game
4. The MessageRouter supports registering handlers for new message types without conflicts

## 6. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Pre-game vote active when game starts | Medium | Medium | Cancel pre-game vote on game start (REQ-NF-VI03) |
| Race: host adds bot while spectator claims seat | Low | Medium | Existing `handleSeatFilledExternally` on seat queue handles this |
| Bot added mid-game in wrong game phase | Low | Medium | `handleSeatFilled` resumes from current phase; bot runner handles any phase |
| Duplicate message type registration in router | Low | High | Use distinct `PRE_GAME_*` message types (REQ-NF-VI02) |

## 7. Success Metrics

1. Bot kick via vote correctly shows 3/4 in lobby with "Join (In Progress)" button
2. Spectators receive seat offers after bot kick
3. Host can add bot to vacated seat mid-game; game resumes
4. Spectators see read-only vote overlay during active votes
5. Pre-game kick votes work with unanimous approval from all seated players
6. Dropdown and popup repositioning does not obscure buttons below
7. All existing vote functionality remains unaffected

## 8. Confidence

**High** — All requirements are clear and testable. Bug fixes have well-understood root causes. The pre-game vote reuses the existing VoteHandler class with minimal server-side additions. UI changes are straightforward CSS property adjustments. The main complexity is the pre-game vote routing, mitigated by using distinct message types.
