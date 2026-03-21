# Implementation Plan: Empty Seat Filling Behavior Overhaul

## Context

When a player leaves a Tichu game, the current system has a disconnect vote (wait/bot/abandon) and a basic spectator seat queue. This overhaul:
- Distinguishes explicit leave (immediate seat vacancy) from disconnect (Wait/Kick vote)
- Replaces wait/bot/abandon vote with Wait/Kick (45s auto-kick)
- Enhances the FIFO spectator queue with multi-seat picking and visual table
- Shows clear empty seat visuals preserving game state
- Adds green "Join (In Progress)" lobby button
- Handles all edge cases (multi-vacancy, AFK voters, up-for-grabs fallback)

**Spec:** `specifications/2026-03-21-spec-empty-seat-filling.md` (17 functional + 3 non-functional requirements)

---

## Milestone 1: Protocol & Type Foundation

**Requirements:** Foundation for all REQ-F-ES01–ES17

**Goal:** Update shared types, protocol messages, and store interfaces so subsequent milestones build on a stable contract.

### Files to Modify

**`code/packages/shared/src/types/protocol.ts`**
- `DISCONNECT_VOTE` (line 79): Change vote enum from `['wait', 'bot', 'abandon']` to `['wait', 'kick']`
- `CLAIM_SEAT` (line 60): Add optional `seat: seatSchema.optional()` for multi-vacancy seat picking
- `SEAT_OFFERED` (line 101): Change `seat: seatSchema` to `seats: z.array(seatSchema)` (always array)
- `DISCONNECT_VOTE_REQUIRED` (line 142): Change `disconnectedSeat: seatSchema` to `disconnectedSeats: z.array(seatSchema)`
- Add new server message `DISCONNECT_VOTE_UPDATE`: `{ votes: Record<Seat, 'wait'|'kick'|null>, disconnectedSeats: Seat[], timeoutMs: number }`
- `LOBBY_LIST` rooms array (line 98): Add `hasEmptySeats: z.boolean()` field

**`code/packages/shared/src/types/room.ts`**
- `LobbyEntry` (line 41): Add `hasEmptySeats: boolean`

**`code/packages/shared/src/types/game.ts`**
- `ClientGameView` (line 159): Add `disconnectVotes: Record<Seat, 'wait' | 'kick' | null>` and `gameHalted: boolean`

**`code/packages/client/src/stores/uiStore.ts`**
- Change `seatOffer` type from `{ seat: Seat; timeoutMs: number }` to `{ seats: Seat[]; timeoutMs: number }`
- Add `disconnectVotes: Record<Seat, 'wait' | 'kick' | null>` state + setter
- Change `disconnectedSeat` to `disconnectedSeats: Seat[]`

**`code/packages/client/src/stores/gameStore.ts`**
- Add `disconnectVotes` and `gameHalted` to state and `applyGameState`

### Testing
- TypeScript build check across all 3 packages (ensures all message consumers updated)
- Unit tests for Zod schema validation of new/modified messages

---

## Milestone 2: Disconnect Handler Overhaul (Server)

**Requirements:** REQ-F-ES04, REQ-F-ES14, REQ-F-ES17, REQ-F-ES15

**Goal:** Replace wait/bot/abandon with Wait/Kick, 45s auto-kick, multi-disconnect support, and vote broadcasting.

### Files to Modify

**`code/packages/server/src/game/disconnect-handler.ts`** (major rewrite)
- Change `DisconnectVote` from `'wait' | 'bot' | 'abandon'` to `'wait' | 'kick'`
- Change `VoteOutcome` from `'waiting' | 'replace_with_bot' | 'game_abandoned' | 'pending'` to `'waiting' | 'kick' | 'pending'`
- Change `VoteSession.disconnectedSeat` (line 14) to `disconnectedSeats: Set<Seat>`
- Change timeout from 60s to 45s, auto-kick on timeout (was auto-bot)
- `handleDisconnect`: If session already exists, add to `disconnectedSeats` set (REQ-F-ES17 multi-disconnect)
- `handleVote`: After each vote, broadcast `DISCONNECT_VOTE_UPDATE` with per-seat vote map
- `evaluateVotes`: Dynamically calculate voter count based on connected players (4 - disconnectedSeats.size); majority = ceil(voters/2) but at least 2
- `resolveVote`: On kick → callback for each disconnected seat. On wait → keep seats reserved.
- Add `getVoteStatus(roomCode)` for state projection
- `handleReconnect`: Cancel vote if ALL disconnected players reconnected (not just one)

**`code/packages/server/src/game/game-manager.ts`** (lines 178-233)
- `handleDisconnect`: Stop timer, broadcast PLAYER_DISCONNECTED, but do NOT vacate seat yet (wait for vote). Currently calls `disconnectHandler.handleDisconnect` — keep this but don't call `handleSeatVacated` directly on disconnect.
- Wire new `onKickResolved` callback: when kick happens, THEN call `handleSeatVacated` for each kicked seat
- `handleReconnect`: If vote result was "wait" and player reconnects, restore to original seat (already implemented via markReconnected + sendStateTo)

**`code/packages/server/src/app.ts`** (lines 152-168)
- `ws.on('close')`: Currently marks disconnected and broadcasts PLAYER_DISCONNECTED. Need to also trigger disconnect handler's vote flow for seated players when game is in progress:
  ```
  if (gameInProgress && seat) → game.handleDisconnect(seat)
  ```
  Note: The current code only marks disconnected but doesn't start the vote. Need to wire this.

**`code/packages/server/src/ws/state-projection.ts`**
- `projectGameState`: Add `disconnectVotes` from disconnect handler and `gameHalted` (vacatedSeats.length > 0) to output
- `projectSpectatorView`: Add `gameHalted`

**`code/packages/server/src/room/room-manager.ts`** (line 116)
- `leaveRoom`: When all human players are gone and game was in progress, destroy room + notify spectators with ROOM_CLOSED (REQ-F-ES15)

### Testing
- Rewrite `disconnect-handler.test.ts`: Wait/Kick only, 45s timeout, vote changes, multi-disconnect, reconnect cancellation, DISCONNECT_VOTE_UPDATE broadcasting
- Test app.ts close handler triggers vote flow

---

## Milestone 3: Seat Queue Enhancements (Server)

**Requirements:** REQ-F-ES02, ES03, ES06, ES07, ES08, ES09, ES10, ES11, ES13, ES16

**Goal:** Enhance seat queue for multi-seat picking, no-recycle on pass/timeout, per-spectator ordinal positions.

### Files to Modify

**`code/packages/server/src/room/seat-queue.ts`** (significant changes)
- `SeatOfferedMessage` (line 22): Change `seat: Seat` to `seats: Seat[]` — send ALL available seats
- `handleClaim(userId, seat?)` (line 103): Accept optional seat param for multi-vacancy picking. If provided, claim that specific seat. If omitted (up-for-grabs), auto-assign first available.
- `handleDecline` / timeout (lines 137, 260): Remove spectator from queue entirely (no recycle). Currently adds to `declinedUserIds` and they participate in up-for-grabs — change: pass/timeout = removed from queue completely. They are NOT eligible for up-for-grabs.
- `offerToSpectator` (line 228): Send `seats: [...this.availableSeats]` instead of `seat: this.availableSeats[0]`
- `broadcastQueueStatus` (line 248): Send **individual** messages to each non-deciding spectator with their specific position. Currently broadcasts one message with a single position to all. Need to iterate remaining spectators and compute per-spectator position.
- `transitionToUpForGrabs` (line 281): Broadcast to ALL spectators currently in the room (get from callback), not just declined ones. Per spec: "displayed to all current spectators and any spectator that joins from the lobby"
- Add new callback: `onGetCurrentSpectators: (roomCode: string) => string[]` to get live spectator list for up-for-grabs broadcast
- `addToQueue`: If phase is `up-for-grabs`, immediately send SEATS_AVAILABLE to the new joiner

**`code/packages/server/src/room/room-handler.ts`**
- `handleClaimSeat` (line 526): Parse optional `seat` from message, pass to `queue.handleClaim(userId, seat)`
- Wire disconnect handler kick outcome → `tryStartSeatQueue` (when kick resolves, vacated seats trigger queue)
- `getOrCreateQueue` (line 474): Add `onGetCurrentSpectators` callback wiring
- `tryStartSeatQueue`: Also handle pre-room leave (REQ-F-ES13) — currently only triggers when `gameWasInProgress`, but should also work pre-game when spectators exist
- `broadcastRoomUpdate` (line 565): Include queue-active status so lobby can derive hasEmptySeats

**`code/packages/server/src/room/room-manager.ts`**
- `getPublicRooms` (line 280): Add `hasEmptySeats` to LobbyEntry — true when `gameInProgress && players.length < 4`

### Testing
- Update `seat-queue.test.ts`:
  - Multi-seat offer (SEAT_OFFERED with seats array)
  - CLAIM_SEAT with specific seat choice
  - No-recycle: declined/timed-out user NOT re-offered and NOT in up-for-grabs
  - Up-for-grabs broadcasts to ALL current spectators
  - Individual ordinal positions in QUEUE_STATUS per spectator
  - Late joiner added to end of queue
  - Late joiner during up-for-grabs gets SEATS_AVAILABLE immediately
  - All-seats-filled clears queue
- Update `room-handler.test.ts`:
  - Kick outcome triggers seat queue
  - Pre-room leave triggers queue when spectators exist
  - All-leave destroys room

---

## Milestone 4: Client UI Updates

**Requirements:** REQ-F-ES01, ES04, ES05, ES06, ES11, ES12, ES16

**Goal:** All client-side visual changes: empty seat appearance, vote glows, lobby button, multi-seat picker, queue status.

### Files to Modify

**`code/packages/client/src/components/game/PlayerSeat.tsx`**
- Add `emptySeat?: boolean` prop:
  - Name displays "Empty Seat"
  - Avatar shows empty circle (no initial letter, no finish badge)
  - Preserve cardCount, tichuCall, finishOrder display
  - Replace `vacated` overlay ("Waiting for player to join") with this new empty seat look
- Add `voteStatus?: 'wait' | 'kick' | null` prop:
  - `'wait'`: green glow + "Vote: Wait" label (overrides normal indicator text)
  - `'kick'`: red glow + "Vote: Kick" label
  - `null` or absent: normal rendering
- Update `PlayerSeat.module.css`: Add `.emptySeat`, `.voteWait`, `.voteKick` styles

**`code/packages/client/src/components/game/PlayerSeat.module.css`**
- `.emptySeat .avatar`: Empty circle (border only, no background fill, no letter)
- `.voteWait`: Green glow border (similar to passConfirmed but green)
- `.voteKick`: Red glow border

**`code/packages/client/src/components/game/SpectatorOverlay.tsx`** (or PreRoomView center content)
- Update seat offer dialog for multi-seat: show mini visual table with highlighted clickable seats
- `onClaimSeat` callback to accept optional `seat` param: `onClaimSeat(seat?: Seat)`
- Queue status: ensure proper ordinal suffixes (1st, 2nd, 3rd, 4th...)
- Up-for-grabs: "The empty seat(s) are up for grabs!" with "Claim Seat" button
- Add spectator disconnect-vote waiting message: "Waiting for current players to choose what to do about the disconnected player(s)"

**`code/packages/client/src/app/lobby/page.tsx`** (lines 368-390)
- Add new button state in the join column:
  - When `room.gameInProgress && room.hasEmptySeats`: green "Join (In Progress)" button
  - Clicking sends `{ type: 'JOIN_ROOM', roomCode, playerName }` (not as spectator)
- Button priority: Join (In Progress) > Join > Spectate > Full

**`code/packages/client/src/app/game/[gameId]/page.tsx`**
- Handle `DISCONNECT_VOTE_UPDATE`: update uiStore with per-seat votes and timeout
- Handle modified `DISCONNECT_VOTE_REQUIRED` with `disconnectedSeats` array
- Handle modified `SEAT_OFFERED` with `seats` array
- Pass `emptySeat` prop to PlayerSeat for vacated seats (based on gameStore.vacatedSeats)
- Pass `voteStatus` prop from uiStore.disconnectVotes
- Wire `CLAIM_SEAT` to include chosen seat: `{ type: 'CLAIM_SEAT', seat }`
- Add `beforeunload` handler that sends `LEAVE_ROOM` for browser tab close (REQ-F-ES03)
- Disconnect vote UI for seated players: render Wait/Kick buttons + 45s countdown
- When vote resolves: restore normal info box states (clear voteStatus)

**`code/packages/client/src/components/game/PreRoomView.tsx`**
- Update to use modified `seatOffer.seats` array
- Multi-seat picker in center content: show visual table with empty seats highlighted
- Verify pre-room queue works with all changes

### Testing
- Component tests for PlayerSeat empty seat mode and vote glow states
- Lobby page: verify "Join (In Progress)" button renders for correct room states
- SpectatorOverlay: multi-seat visual table, single seat offer, up-for-grabs
- Game page: beforeunload handler, DISCONNECT_VOTE_UPDATE handling

---

## Milestone 5: Integration Testing & Polish

**Requirements:** All REQ-F-ES01–ES17, REQ-NF-ES01–ES03

**Goal:** End-to-end verification, edge case coverage, documentation.

### Files to Create/Modify

**New: `code/packages/server/tests/integration/empty-seat-flow.test.ts`**
- Full flow: explicit leave → empty seat visuals → queue → claim → resume
- Full flow: disconnect → vote kick → seat vacated → queue → claim → resume
- Full flow: disconnect → vote wait → reconnect → auto-restore
- Multi-disconnect: 2 players DC → collective vote → kick → multi-seat queue
- Edge case: all 4 leave → room destroyed
- Edge case: lobby join during active queue → added to end
- Edge case: all spectators decline → up-for-grabs → first-come wins
- Edge case: pre-room queue (same behavior as mid-game)
- Edge case: 45s auto-kick timeout

**`documentation/codebase-index.md`**
- Update WebSocket protocol section with new/changed messages
- Update game state machine section with halt/vote/queue flows
- Document explicit leave vs disconnect distinction

**CSS polish in `PlayerSeat.module.css`**
- Fine-tune empty seat circle icon, vote glow animations
- Ensure visual consistency across game states

### Testing
- All unit tests from milestones 1–4 pass
- Integration tests exercise full server pipeline
- Manual multi-browser smoke test

---

## Requirements Traceability Matrix

| REQ ID | Milestone | Files |
|--------|-----------|-------|
| REQ-F-ES01 | M1, M4 | PlayerSeat.tsx, PlayerSeat.module.css, game.ts |
| REQ-F-ES02 | M2, M3 | game-manager.ts, seat-queue.ts |
| REQ-F-ES03 | M2, M3, M4 | app.ts, room-handler.ts, game/[gameId]/page.tsx |
| REQ-F-ES04 | M1, M2, M4 | disconnect-handler.ts, protocol.ts, PlayerSeat.tsx, game page |
| REQ-F-ES05 | M1, M3, M4 | room.ts, protocol.ts, room-manager.ts, lobby/page.tsx |
| REQ-F-ES06 | M1, M3, M4 | seat-queue.ts, protocol.ts, SpectatorOverlay.tsx |
| REQ-F-ES07 | M3 | seat-queue.ts, room-handler.ts |
| REQ-F-ES08 | M3 | seat-queue.ts |
| REQ-F-ES09 | M3 | seat-queue.ts, room-handler.ts |
| REQ-F-ES10 | M3, M4 | seat-queue.ts, SpectatorOverlay.tsx |
| REQ-F-ES11 | M3, M4 | seat-queue.ts, SpectatorOverlay.tsx/PreRoomView.tsx |
| REQ-F-ES12 | M4 | PreRoomView.tsx (already works via SWAP_SEATS) |
| REQ-F-ES13 | M3 | room-handler.ts (extend tryStartSeatQueue for pre-room) |
| REQ-F-ES14 | M2 | disconnect-handler.ts, game-manager.ts |
| REQ-F-ES15 | M2, M3 | room-manager.ts, app.ts |
| REQ-F-ES16 | M3, M4 | seat-queue.ts, game page, uiStore.ts |
| REQ-F-ES17 | M1, M2 | disconnect-handler.ts, protocol.ts |
| REQ-NF-ES01 | M3 | seat-queue.ts (individual status messages) |
| REQ-NF-ES02 | M3 | seat-queue.ts (server-side claim serialization) |
| REQ-NF-ES03 | M2, M3 | broadcaster.ts (batch updates) |

## Verification

1. **Unit tests**: Run `npm test` in each package after each milestone
2. **Build check**: `npm run build` across all packages after M1 to catch type mismatches
3. **Integration tests**: Full server pipeline tests in M5
4. **Manual testing**: Multi-browser with 4 players + spectators
5. **Edge cases**: All 4 leave, reconnect after wait, multi-vacancy, up-for-grabs, 45s auto-kick
