# Implementation Plan: Spectator Mode

## Context

The Tichu game currently blocks players from joining full rooms and uses a host-only start mechanism. This plan adds spectator mode, a FIFO seat queue, an all-player ready system, flexible seat selection, and mid-game bot removal — enabling a much more dynamic room experience.

Spec: `specifications/2026-03-20-spec-spectator-mode.md` (32 requirements, REQ-F-SP01–SP32)

## Milestones

### Milestone 1: Shared Types & Protocol Foundation

**Goal:** Define all new types, messages, and schemas so everything else compiles.

**Files:**
- `code/packages/shared/src/types/room.ts` — Add `RoomSpectator` interface (`userId, name, joinedAt, isConnected`), add `spectators: RoomSpectator[]` to `Room`, extend `LobbyEntry.config` to include `spectatorsAllowed`
- `code/packages/shared/src/types/protocol.ts` — New client messages: `CLAIM_SEAT`, `DECLINE_SEAT`, `READY_TO_START`, `CANCEL_READY`. Modify `JOIN_ROOM` to add `asSpectator?: boolean`. New server messages: `SEAT_OFFERED`, `QUEUE_STATUS`, `SEATS_AVAILABLE`, `ROOM_CLOSED`. Modify `ROOM_JOINED` seat to `seatSchema.nullable()`. Modify `ROOM_UPDATE` to add `spectatorCount` and `readyPlayers` fields.

**Requirements:** REQ-F-SP03, SP04, SP16 (partial)

---

### Milestone 2: Server Room Spectator Management + Ready System

**Goal:** RoomManager tracks spectators, auto-assigns seats, handles ready-to-start, and bots auto-ready. ConnectionManager supports seatless room assignment.

**Files:**
- `code/packages/server/src/room/room-manager.ts`:
  - New methods: `joinAsSpectator()`, `leaveAsSpectator()`, `isSpectator()`, `getSpectatorRoom()`, `markSpectatorDisconnected()`, `markSpectatorReconnected()`, `promoteSpectatorToPlayer()`
  - Ready system: `setReady()`, `cancelReady()`, `getReadySeats()`, `areAllReady()`, `resetReady()` — stored per-room in `readySeats: Map<string, Set<Seat>>`
  - Modify `joinRoom()` to auto-redirect to `joinAsSpectator()` when full + spectatorsAllowed
  - Modify `getPublicRooms()` to compute real `spectatorCount` and include `spectatorsAllowed` in config
  - Modify `createRoom()` to initialize `room.spectators = []`
  - Modify `destroyRoom()` to clean up spectator maps
  - Modify `leaveRoom()` to call `resetReady()`
  - Modify `removeBot()` to allow during game (remove guard)
- `code/packages/server/src/ws/connection-manager.ts`:
  - New `assignAsSpectator(ws, roomCode)` — sets roomCode, leaves seat null
- `code/packages/server/src/room/room-handler.ts`:
  - Modify `handleJoinRoom()` — handle `asSpectator` flag, send `ROOM_JOINED { seat: null }` for spectators, send game state if game in progress
  - Modify `handleLeaveRoom()` — check `isSpectator()`, call `leaveAsSpectator()` if so
  - New handlers: `READY_TO_START` (set ready, check areAllReady → auto-start), `CANCEL_READY`
  - Modify `broadcastRoomUpdate()` — include `spectatorCount` and `readyPlayers`, also send to spectators
  - Modify `handleStartGame()` — auto-start when all 4 ready; bots auto-ready when added
  - Modify `handleRemoveBot()` — allow mid-game, trigger seat vacate + queue
  - Modify `destroyRoom` path — send `ROOM_CLOSED` to spectators before destroying
- `code/packages/server/src/app.ts`:
  - Modify `close` handler — check if spectator, call `markSpectatorDisconnected()` instead of seat-based disconnect (no `PLAYER_DISCONNECTED` for spectators)
  - Modify reconnection logic — also check `getSpectatorRoom()`, restore spectator with `ROOM_JOINED { seat: null }` + game state if applicable

**Requirements:** REQ-F-SP02, SP04, SP11, SP13, SP15, SP16, SP18–SP23, SP25–SP26, SP29–SP30

---

### Milestone 3: Spectator Game State Projection & Broadcasting

**Goal:** Spectators receive a projected game view with all hands hidden.

**Files:**
- `code/packages/server/src/ws/state-projection.ts`:
  - New `projectSpectatorView(context, machineState, vacatedSeats)` — `mySeat: 'south'`, `myHand: []`, all 4 seats as `otherPlayers` with cardCount only, all public state (tricks, scores, wish, turn) preserved
- `code/packages/server/src/ws/broadcaster.ts`:
  - Modify `broadcastGameState()` — after sending to seated players, also send spectator-projected view to all `seat === null` clients using existing `broadcastToSpectators()` pattern

**Requirements:** REQ-F-SP05, SP06, REQ-NF-SP02

---

### Milestone 4: Seat Queue System

**Goal:** When seats open, spectators are offered them via FIFO queue with 30s timeout, three choices, and up-for-grabs fallback.

**Files:**
- **NEW** `code/packages/server/src/room/seat-queue.ts`:
  - `SeatQueue` class with state per room: `availableSeats`, `spectatorOrder` (snapshot), `currentIndex`, `offerTimeout`, `phase` ('offering' | 'up-for-grabs' | 'idle'), `declinedUserIds`
  - Methods: `startQueue()`, `handleClaim()`, `handleDecline()`, `handleLeave()`, `addToQueue()`, `handleUpForGrabsClaim()`, `isActive()`, `getPhase()`, `cleanup()`
  - Private: `offerNext()`, `startTimeout()` (30s), `transitionToUpForGrabs()`
  - Callbacks: `onSendToSpectator`, `onBroadcastQueueStatus`, `onSeatClaimed`, `onAllSeatsFilled`
- `code/packages/server/src/room/room-handler.ts`:
  - Instantiate `SeatQueue`, wire callbacks
  - New handlers: `CLAIM_SEAT`, `DECLINE_SEAT` — delegate to queue
  - Integrate with `handleLeaveRoom()` — when player leaves mid-game and spectators exist, start queue
  - Integrate with `handleRemoveBot()` mid-game — start queue when bot removed
  - When spectator joins during active queue → `addToQueue()`
  - Queue `onSeatClaimed` callback: promote spectator → player, assign seat, send `ROOM_JOINED` + `GAME_STATE`, call `game.handleSeatFilled()`
  - Queue `onAllSeatsFilled` callback: stop queue, restore remaining spectators to original order

**Requirements:** REQ-F-SP07, SP08, SP08a, SP08b, SP08c, SP09, SP10, SP27, SP28, SP31, SP32

---

### Milestone 5: Client — Lobby, Room Page, and Store Updates

**Goal:** Lobby shows "Join as Spectator" button, room page has ready system + seat selection, stores support spectator state.

**Files:**
- `code/packages/client/src/stores/roomStore.ts`:
  - Change `setRoom` signature to accept `seat: Seat | null`
  - Add `spectatorCount: number`, `readyPlayers: Seat[]` to state
  - Modify `updateRoom` to accept and store `spectatorCount` and `readyPlayers`
- `code/packages/client/src/stores/uiStore.ts`:
  - Add spectator queue state: `seatOffer: { seat, timeoutMs } | null`, `queueStatus: { decidingSpectator, position, timeoutMs } | null`, `availableSeats: Seat[]`
  - Actions: `setSeatOffer()`, `clearSeatOffer()`, `setQueueStatus()`, `setAvailableSeats()`
- `code/packages/client/src/app/lobby/page.tsx`:
  - Modify room list rendering (lines 347-366): When `playerCount >= 4 && config.spectatorsAllowed`, show "Join as Spectator" button with `var(--color-gold-accent)` styling. Handle both full+no-game and full+in-game cases.
  - New `handleJoinAsSpectator()` — sends `JOIN_ROOM` with `asSpectator: true`
  - Handle `ROOM_JOINED` with `seat: null` — navigate to `/game/${roomCode}` (spectator goes directly to game page)
- `code/packages/client/src/app/lobby/[roomId]/page.tsx`:
  - Replace host-only "Start Game" with all-player "Start Game" button when 4 seats filled
  - Add ready glow: when seat is in `readyPlayers`, apply green `boxShadow` + "Ready to Start Game" text
  - Seat selection: "Sit Here" on open seats, "Choose Seat" to lock current seat (sends `SWAP_SEATS` or new `CONFIRM_SEAT`)
  - Host "Add Bot" UI on empty seats: difficulty dropdown (Expert default) + button
  - Handle `READY_TO_START` / `CANCEL_READY` messages
  - Handle `ROOM_CLOSED` — navigate to lobby with message

**Requirements:** REQ-F-SP01, SP12, SP18, SP19, SP20, SP21, SP22, SP24, SP25, SP26, SP29

---

### Milestone 6: Client — Game Page Spectator View & Queue UI

**Goal:** Game page detects spectators, renders read-only view, handles queue overlays and chat restrictions.

**Files:**
- `code/packages/client/src/app/game/[gameId]/page.tsx`:
  - Detect spectator: `const isSpectator = mySeat === null`
  - Spectator rendering: hide ActionBar, card hand, tichu/bomb buttons, phoenix/wish pickers, pre-game prompts
  - Add "Spectating" badge (reuse styles from spectate page)
  - Gate auto-tichu-pass and bomb-window logic with `!isSpectator`
  - Handle new messages: `SEAT_OFFERED`, `QUEUE_STATUS`, `SEATS_AVAILABLE`, `ROOM_CLOSED`
  - Seat offer overlay: "Join Game" / "Continue Spectating" / "Leave Room" with 30s countdown
  - Queue status display: "Waiting for {name}..." with position and countdown
  - "Seats up for grabs" overlay: "Join Game" / "Leave Room"
  - `ROOM_CLOSED` handler: navigate to lobby with message
  - Leave dialog: change text for spectators ("Leave this room?" vs "forfeit" language)
- `code/packages/client/src/components/game/ChatPanel.tsx`:
  - Add `readOnly?: boolean` prop
  - When `readOnly`, hide input form
- **NEW** `code/packages/client/src/components/game/SpectatorOverlay.tsx`:
  - Seat offer overlay with countdown, three buttons
  - Queue status display
  - Seats available (up-for-grabs) overlay
- Deprecate `code/packages/client/src/app/spectate/[gameId]/page.tsx` — redirect to `/game/[gameId]`

**Requirements:** REQ-F-SP05 (client), SP08b (client), SP08c (client), SP09 (client), SP14, SP15 (client), SP17

---

## Key Reusable Infrastructure
- `GameManager.handleSeatVacated()` / `handleSeatFilled()` — existing seat vacancy management
- `Broadcaster.broadcastToSpectators()` — already filters seat=null clients
- `ConnectionManager.seat: Seat | null` — null already represents spectators
- `RoomConfig.spectatorsAllowed` / `maxSpectators` — already defined, just not enforced
- `LobbyEntry.spectatorCount` — field exists, just hardcoded to 0
- Existing `/spectate/[gameId]` page patterns — reuse spectator view construction approach

## Verification

1. **Manual test:** Create room → fill with 3 players + 1 bot → join from lobby as 5th player → verify "Join as Spectator" appears and works
2. **Manual test:** As spectator, verify card counts shown but no hand data; play area cards visible
3. **Manual test:** Remove bot mid-game → verify spectator gets seat offer with 30s countdown
4. **Manual test:** Decline seat → verify moved to end of queue; verify "up for grabs" after all decline
5. **Manual test:** All 4 players → verify each sees "Start Game" → ready glow → auto-start
6. **Manual test:** Player leaves during ready phase → verify all ready states reset
7. **Unit tests:** SeatQueue (new file), RoomManager spectator methods, state projection for spectators, protocol schema validation
8. **Build:** `pnpm build` across all packages
9. **Existing tests:** `pnpm test` — verify no regressions
