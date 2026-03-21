# Spec: Empty Seat Filling Behavior Overhaul

## Context

When a player leaves a Tichu game, the current system has a disconnect vote (wait/bot/abandon) and a basic spectator seat queue. The user wants a comprehensive overhaul that:
- Clearly distinguishes explicit leave vs disconnect
- Provides a fair FIFO spectator queue with visual countdown
- Shows clear empty seat visuals
- Allows lobby joiners to fill seats
- Handles all edge cases (multi-vacancy, AFK voters, up-for-grabs fallback)

## Requirements

### REQ-F-ES01: Empty Seat Visuals
When a player leaves mid-game:
- Seat name changes to "Empty Seat"
- Seat icon becomes an empty circle (removes player avatar)
- Maintain full previous game state: card count + stacked cards visual, tichu/grand tichu banners, finish order badges
- All players and spectators see these changes immediately

**Acceptance:** Empty seat shows "Empty Seat" label, empty circle icon, and preserves card count, tichu call, and finish order from departed player.

### REQ-F-ES02: Game Halt on Player Leave
When a player leaves mid-game:
- Play is immediately halted (no game actions allowed)
- Turn timer stops
- Chat remains available
- Game resumes only when all 4 seats are filled

**Acceptance:** No game state transitions occur while any seat is vacant. Chat still works.

### REQ-F-ES03: Explicit Leave — Immediate Queue
When a player explicitly leaves (clicks "Leave Room" or closes browser):
- Immediately mark seat as empty (REQ-F-ES01 visuals)
- Halt game (REQ-F-ES02)
- If spectators exist: start spectator queue (REQ-F-ES06)
- If no spectators: show lobby "Join" button (REQ-F-ES05), wait for joins

**Acceptance:** Explicit leave triggers empty seat + queue within 1 second.

### REQ-F-ES04: Disconnect — Vote Then Queue
When a player disconnects (connection loss, not explicit leave):
- Halt game (REQ-F-ES02)
- Display vote dialog to remaining 3 players:
  - Options: "Wait for player to rejoin" / "Kick player"
  - No timeout on voting itself, but auto-kick after 45 seconds if no 2/3 majority
  - Players can switch their vote at will
  - 2/3 majority required (2 of 3 players)
- Vote UI:
  - Temporarily reset player info box states (remove glow/indicator text)
  - Show vote choice on each player's info box:
    - "Vote: Wait" → green glow
    - "Vote: Kick" → red glow
  - Once resolved, restore previous info box states (Leading Trick, turn indicator, etc.)
- Spectators see status message: "Waiting for current players to choose what to do about the disconnected player(s)"
- If majority = Kick: restore info boxes, clear spectator status, start empty seat + queue (REQ-F-ES03 flow)
- If majority = Wait: keep seat reserved; if player reconnects, auto-restore to original seat
- If auto-kick (45s timeout): treat as Kick result

**Acceptance:** Disconnect triggers vote UI. 2/3 majority or 45s timeout resolves. Vote choices visible on player info boxes with correct glow colors. Spectators see waiting message.

### REQ-F-ES05: Lobby "Join (In Progress)" Button
When a game has empty seats mid-game and no spectators in queue:
- Lobby entry shows a green "Join (In Progress)" button
- Clicking it:
  - If queue is active: join as spectator, added to end of queue (REQ-F-ES09)
  - If no queue active and seats available: join as spectator, then immediately start queue or go to "up for grabs" state
- When all seats are filled, button reverts to normal "Spectate" or "Full"

**Acceptance:** Green "Join (In Progress)" button visible in lobby for games with empty seats. Clicking joins and enters queue process.

### REQ-F-ES06: Spectator Queue — FIFO Offering Phase
When seats become available and spectators exist:
1. Create FIFO queue ordered by spectator join time
2. Remove first spectator from queue → they become "deciding spectator"
3. Show deciding spectator a dialog:
   ```
   A seat has become available!
   [Visual table layout with empty seats highlighted — clickable]
   ["Pass" button] ["Claim Seat" button]
   (small text) You have ## seconds to choose...
   ```
   - If 2+ seats open: deciding spectator sees visual table with highlighted empty seats, picks which seat
   - If 1 seat open: claim/pass only (no seat selection needed, but still show table for visual consistency)
   - 30-second countdown timer
4. Only 1 deciding spectator at a time

**Acceptance:** FIFO order respected. Deciding spectator sees dialog with countdown. Visual table shows empty seats when multi-vacancy. 30s timeout.

### REQ-F-ES07: Queue — Claim Seat
When deciding spectator claims a seat:
- They are promoted to player in the chosen seat
- Dropped straight into the game (no onboarding message)
- If no more empty seats: queue ends, game resumes
- If seats still available: continue processing queue (next spectator becomes deciding)

**Acceptance:** Claim promotes spectator to player. Game resumes when all seats filled.

### REQ-F-ES08: Queue — Pass or Timeout
When deciding spectator passes or times out (30s):
- They lose deciding spectator status
- They are removed from the queue (not recycled)
- Next spectator in queue becomes deciding spectator
- If no more spectators in queue: transition to "up for grabs" (REQ-F-ES10)

**Acceptance:** Pass/timeout advances queue. Spectator removed from queue, not recycled.

### REQ-F-ES09: Queue — Lobby Join During Processing
When a player joins from lobby while queue is active:
- They join as a spectator
- Added to end of the queue
- See queue status message (REQ-F-ES11)

**Acceptance:** Lobby joiner becomes spectator at end of queue, sees position.

### REQ-F-ES10: Up For Grabs Phase
When all spectators in queue have passed/timed out but seats remain AND spectators still exist in the game:
- Display to all current spectators and any newly joining spectator:
  ```
  The empty seat(s) are up for grabs!
  ["Claim Seat" button]
  ```
- First click wins (server-side ordering)
- Auto-assign to first available seat (no seat choice in this phase)
- If seats still available after claim: dialog remains for remaining spectators
- When all seats filled: clear all dialogs, resume game

**Acceptance:** Up-for-grabs dialog shown to all spectators. First CLAIM_SEAT wins. Auto-assign seat.

### REQ-F-ES11: Queue Status for Non-Deciding Spectators
While queue is active, non-deciding spectators see:
```
You are #st/nd/rd/th in line
Current spectator has ## seconds to decide
```
- # = their position in queue (with proper ordinal suffix: 1st, 2nd, 3rd, 4th, etc.)
- ## = live countdown matching the deciding spectator's timeout
- Position updates as queue is processed (e.g., 3rd → 2nd when someone ahead passes)

**Acceptance:** Correct ordinal suffixes. Live countdown synced with deciding spectator's timer. Position updates in real time.

### REQ-F-ES12: Pre-Room Seat Change
When the game has not yet begun (pre-room) and at least 1 seat is available:
- All current players see an option to change seats (swap to any empty seat)
- This applies regardless of spectator presence

**Acceptance:** Players in pre-room can swap to empty seats when available.

### REQ-F-ES13: Pre-Room Queue
When a player leaves in pre-room and spectators exist:
- Same FIFO queue process applies (REQ-F-ES06 through REQ-F-ES11)
- Consistent behavior whether pre-room or mid-game

**Acceptance:** Queue works identically in pre-room and mid-game.

### REQ-F-ES14: Reconnect After Wait Vote
When disconnect vote results in "Wait" and the player reconnects:
- Auto-restore to their original seat
- Game resumes immediately
- No queue process needed

**Acceptance:** Reconnecting player returns to original seat without queue.

### REQ-F-ES15: All Players Leave — Destroy Game
If all 4 players leave the game (0 seated players):
- Game room is destroyed and removed from lobby

**Acceptance:** Room cleanup occurs when last player leaves.

### REQ-F-ES16: Queue Completion
When all seats are filled (by any mechanism):
- All spectator status menus, queue messages, and dialogs are cleared
- Spectators return to normal spectator view
- Game play resumes

**Acceptance:** Clean state transition back to normal gameplay. No lingering UI artifacts.

### REQ-F-ES17: Multi-Player Disconnect Vote
When multiple players disconnect simultaneously:
- Same vote process applies
- Remaining connected players vote on all disconnected players collectively
- Spectator message references "disconnected player(s)" (plural-aware)

**Acceptance:** Vote handles 1-3 disconnected players. UI text adapts to singular/plural.

## Non-Functional Requirements

### REQ-NF-ES01: Queue Responsiveness
Queue status updates (position changes, countdown ticks) should reach clients within 500ms of server state change.

### REQ-NF-ES02: Race Condition Safety
All seat claims must be serialized server-side to prevent double-assignment. Only one spectator can occupy a seat.

### REQ-NF-ES03: State Consistency
All connected clients (players + spectators) must see consistent seat states within 1 second of any change.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Race conditions in up-for-grabs claims | Medium | High | Server-side mutex/lock on seat assignment |
| Complex state overlap (vote + queue + game) | Medium | Medium | Clear state machine with exclusive phases |
| Browser close detection vs disconnect | Low | Medium | Use `beforeunload` event + WebSocket close reason codes |
| UI flicker during vote→queue transition | Low | Low | Batch state updates, use transitions |

## Scope

**In scope:** All requirements above. Modifications to server (room-handler, room-manager, seat-queue, game-manager, disconnect-handler), client (PlayerSeat, PreRoomView, GameTable, game page, lobby page, uiStore, roomStore), and shared types (protocol, room).

**Out of scope:** Bot replacement (removed from disconnect flow), spectator chat, game abandonment vote.

## Success Metrics

- All 17 functional requirements pass acceptance criteria
- No race conditions in seat assignment under concurrent load
- Queue UI updates within 500ms
- Clean state transitions with no lingering UI artifacts
- Consistent behavior across pre-room and mid-game contexts

## Confidence: HIGH

All requirements are clear, testable, and non-conflicting. Edge cases thoroughly explored through structured elicitation.
