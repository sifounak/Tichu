# Specification: Spectator Mode

**Date:** 2026-03-20
**Type:** Feature
**Confidence:** High

## Goal

Allow players to join full game rooms as spectators, watch the game with a restricted view (card counts only, play area visible), and get FIFO priority to fill open seats. Spectators can join rooms before or during a game. The main `/game/[gameId]` page handles both player and spectator views; the existing `/spectate/[gameId]` page is deprecated.

## Requirements

### Functional Requirements

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| REQ-F-SP01 | Lobby shows "Join as Spectator" button when room is full and `spectatorsAllowed` is true | Button uses `var(--color-gold-accent)` styling (same as Create Room). Replaces both "Full" badge and "In Game" badge when spectators allowed. When `spectatorsAllowed` is false, existing "Full" badge remains. |
| REQ-F-SP02 | Server supports joining a room as spectator | New `joinAsSpectator(userId, roomCode, playerName)` on RoomManager. Adds to `spectators` array with join timestamp. Enforces `spectatorsAllowed` and `maxSpectators` limits. Returns room data. |
| REQ-F-SP03 | Room type tracks spectators in FIFO order | `Room` interface gets `spectators: RoomSpectator[]` where `RoomSpectator = { name: string, userId: string, joinedAt: number, isConnected: boolean }`. Order determines seat priority. |
| REQ-F-SP04 | Protocol supports spectator join | Server sends `ROOM_JOINED` with `seat: null` to indicate spectator status. Client detects `seat === null` to enter spectator mode. |
| REQ-F-SP05 | Spectators see card counts only, no hand data | State projection for spectators: `mySeat` defaults to `'south'`, `myHand: []`, all 4 players appear in `otherPlayers` with `cardCount` only. Play area (trick state) shows full card values (already public). |
| REQ-F-SP06 | `broadcastGameState()` includes spectators | Broadcaster sends spectator-projected view to all seat=null clients in the room. Uses new `projectSpectatorView()` function. |
| REQ-F-SP07 | Spectator seat priority — FIFO queue processing | When a seat opens and spectators exist, server begins queue processing. Snapshots current queue order. Offers seat to first spectator with 30-second timeout and three options: "Join Game", "Continue Spectating", or "Leave Room". |
| REQ-F-SP08 | Seat offer with 30-second timeout and three choices | Server sends `SEAT_OFFERED { seat, timeoutMs: 30000 }`. Spectator responds with `CLAIM_SEAT`, `DECLINE_SEAT`, or `LEAVE_ROOM`. On timeout or "Continue Spectating": spectator is moved out of the active queue round and must wait for all other spectators (including those who joined during processing) to decide before being offered the seat again. On "Leave Room": spectator is removed from the room entirely. |
| REQ-F-SP08a | Queue stops when all seats are filled | When a spectator claims a seat and all 4 seats become occupied, queue processing stops immediately. Remaining spectators (who were not yet asked) are returned to their original queue order (pre-processing snapshot), minus those who joined the game. |
| REQ-F-SP08b | Non-deciding spectators see queue status | All spectators not currently deciding receive `QUEUE_STATUS { decidingSpectator: string, position: number, timeoutMs: number }`. Shows "Waiting for {name} to decide whether to join the game" with "You are #N in line" and the deciding spectator's countdown. Position updates as the queue advances. |
| REQ-F-SP08c | "Up for grabs" fallback when all spectators decline | If every spectator in the queue (including those who joined during processing) has declined or timed out, server sends `SEATS_AVAILABLE { seats: Seat[] }` to ALL spectators with options "Join Game" or "Leave Room". First to respond with `CLAIM_SEAT` gets the seat. |
| REQ-F-SP09 | Spectator→player transition is seamless | When spectator claims seat: server moves them from `spectators[]` to `players[]`, assigns seat in ConnectionManager, sends `ROOM_JOINED { seat }` + `GAME_STATE`. Client UI transitions from read-only to interactive without page navigation. |
| REQ-F-SP10 | New lobby joiners enter as spectator during queue processing | If queue processing is active, any new player joining from lobby enters as spectator at end of queue. They are included in the current processing round (will be offered seat after existing spectators). |
| REQ-F-SP11 | `spectatorCount` reflects actual count in lobby | `getPublicRooms()` computes `spectatorCount` from `room.spectators.length` instead of hardcoded 0. |
| REQ-F-SP12 | Spectators see "Waiting for game to start" pre-game | When spectator joins a full room with no game in progress, the game page shows a waiting state. When game starts, spectator receives `GAME_STATE` and sees the spectator view. |
| REQ-F-SP13 | Spectator reconnection resets queue position | On disconnect, spectator is marked `isConnected: false` and stays in queue. On reconnect, spectator is moved to the end of the queue (position is reset, not preserved). After stale timeout, spectator is removed from queue entirely. |
| REQ-F-SP14 | Spectators can read chat but not send | Chat messages are broadcast to all room clients (including spectators). The `CHAT_MESSAGE` handler continues to require a seat — spectators cannot send. Client hides the chat input for spectators. |
| REQ-F-SP15 | Room destruction returns spectators to lobby | When room is destroyed, all spectator data is removed. Spectators receive `ROOM_CLOSED { message: "The room was closed" }`. Client navigates spectator to lobby and displays the message. |
| REQ-F-SP16 | ROOM_UPDATE includes spectator count | The `ROOM_UPDATE` message includes `spectatorCount` so the room page can display it. |
| REQ-F-SP17 | Deprecate `/spectate/[gameId]` page | The existing spectate page is no longer used. Spectators use `/game/[gameId]` with spectator detection. |
| REQ-F-SP18 | All-player ready-to-start replaces host-only start | When all 4 seats are filled, every player (not just host) sees a "Start Game" button. Clicking it sends `READY_TO_START`. The current host-only `START_GAME` flow is replaced. |
| REQ-F-SP19 | Ready player visual indicator | When a player confirms ready, their player info box glows green (same glow style as the card-pass-ready state) and displays "Ready to Start Game" indicator text. All players see each other's ready state via `ROOM_UPDATE`. |
| REQ-F-SP20 | Game begins when all 4 players are ready | Server tracks per-player ready state. When all 4 players have sent `READY_TO_START`, the server automatically starts the game and deals the first 8 cards. No additional host action needed. |
| REQ-F-SP21 | Ready state resets when a player leaves | If a player leaves or disconnects while others are ready, all ready states reset. Players must re-confirm readiness once the seat is filled again. |
| REQ-F-SP22 | Host can create room with empty seats | Rooms no longer require 4 players to exist in the lobby. Host creates room, other players join from lobby to fill seats. The current requirement of 4 players before starting is replaced by the ready system (SP18–SP20). |
| REQ-F-SP23 | Auto-assign seat when joining from lobby with no spectators | When a player joins from lobby and there are no spectators in the room, the server automatically assigns them to an open seat. Player receives `ROOM_JOINED { seat }` as normal. |
| REQ-F-SP24 | Seat selection UI when multiple seats available | When a player is assigned a seat and there are other open seats, all open seats display a "Sit Here" button. The player's current seat displays a "Choose Seat" button. Clicking "Choose Seat" locks the player into that seat (no further seat changes). |
| REQ-F-SP25 | Auto-assign and seat selection for subsequent joiners | Players who join after an earlier player has locked their seat are also auto-assigned to an open seat. If there is still at least one other open seat, they see the same seat selection UI. If there is only one seat left, they are locked in automatically. |
| REQ-F-SP26 | Ready prompt when last seat is taken | Once the 4th seat is filled (either by a player joining or a spectator claiming a seat), all players are prompted with the "Start Game" ready flow (SP18). |
| REQ-F-SP27 | Lobby joiner with spectators and active queue | When a player joins from lobby and spectators exist with an active queue processing, the new player is added to the end of the spectator queue (not auto-assigned a seat). |
| REQ-F-SP28 | Lobby joiner with spectators after queue finished | When a player joins from lobby and spectators exist but queue has finished processing (all declined/timed out), the new player sees the "Seats up for grabs" prompt alongside existing spectators. First to respond gets the seat. |
| REQ-F-SP29 | Host can add bots to empty seats | While there are empty seats, the host sees an "Add Bot" UI in each empty seat's player info box. Layout: "Bot Difficulty" label, dropdown of difficulty options (Expert default), then "Add Bot" button. |
| REQ-F-SP30 | Bots auto-ready when start is available | When all 4 seats are filled and the ready-to-start prompt appears (SP18), bots automatically confirm ready. Only human players need to manually confirm. |
| REQ-F-SP31 | Host can remove bot at any time including mid-game | Host sees a "Remove Bot" button on bot-occupied seats at all times (pre-game and during game). Removing a bot vacates the seat and triggers the empty-seat flow: spectator queue processing if spectators exist (SP07), or seat stays open for lobby/bot joins. |
| REQ-F-SP32 | Bot removal mid-game pauses game until seat filled | When a bot is removed during an active game, the seat is vacated. The game pauses (same as player disconnect behavior) until the seat is filled by a spectator, lobby joiner, or a new bot. |

### Non-Functional Requirements

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| REQ-NF-SP01 | Max spectators per room: configurable via `maxSpectators` (default 10) | Server rejects spectator join when limit reached |
| REQ-NF-SP02 | Spectator view must not leak hand data | No card IDs or card objects in spectator projection — only `cardCount` integers |

## Protocol Changes

### New Server → Client messages

```typescript
// Seat offered to deciding spectator (FIFO priority)
z.object({
  type: z.literal('SEAT_OFFERED'),
  seat: seatSchema,
  timeoutMs: z.number(),  // 30000
})

// Queue status for non-deciding spectators
z.object({
  type: z.literal('QUEUE_STATUS'),
  decidingSpectator: z.string(),  // player name
  position: z.number().int().min(1),  // "You are #N in line"
  timeoutMs: z.number(),  // remaining time for current decider
})

// All spectators declined — seats up for grabs (first-come-first-served)
z.object({
  type: z.literal('SEATS_AVAILABLE'),
  seats: z.array(seatSchema),
})

// Room was closed while spectator was connected
z.object({
  type: z.literal('ROOM_CLOSED'),
  message: z.string(),
})
```

### New Client → Server messages

```typescript
// Spectator claims the offered seat (or grabs available seat)
z.object({ type: z.literal('CLAIM_SEAT') })

// Spectator declines — continues spectating, moves to end of queue round
z.object({ type: z.literal('DECLINE_SEAT') })
```

### Modified messages

### New Client → Server messages (ready system)

```typescript
// Player signals ready to start the game
z.object({ type: z.literal('READY_TO_START') })

// Player cancels their ready state
z.object({ type: z.literal('CANCEL_READY') })
```

### Modified messages

**ROOM_JOINED**: Change `seat` to `seatSchema.nullable()`. When `seat` is `null`, client knows it's a spectator.

**ROOM_UPDATE**: Add `spectatorCount: z.number()` and `readyPlayers: z.array(seatSchema)` fields. `readyPlayers` lists seats that have confirmed ready-to-start.

**JOIN_ROOM**: Add optional `asSpectator: z.boolean().optional()` field so lobby can explicitly request spectator join. When room is full and `asSpectator` is not set, server auto-joins as spectator if `spectatorsAllowed`.

**START_GAME**: Repurposed — no longer host-only. Replaced by `READY_TO_START` from each player. Server auto-starts when all 4 are ready.

## Implementation Scope

### In Scope
- Server: RoomManager spectator tracking (join, leave, reconnect, queue)
- Server: State projection for spectators
- Server: Broadcaster updates for spectator game state
- Server: Seat offer/claim/decline/timeout flow
- Server: Protocol message additions
- Server: Ready-to-start system replacing host-only start
- Server: Auto-seat assignment for lobby joiners (no spectators present)
- Client: Lobby button changes
- Client: Game page spectator detection and read-only view
- Client: Seat offer UI (accept/decline with countdown)
- Client: Seat selection UI ("Sit Here" / "Choose Seat" buttons)
- Client: Ready-to-start UI with green glow indicator
- Client: Chat read-only for spectators
- Client: Room page updates (remove host-only start button, add ready flow)
- Shared: Protocol schema updates, Room type updates

### Out of Scope
- Spectator-only chat channel
- Spectator count display in game UI (beyond room page)
- Spectator list visible to players
- Spectator-to-spectator messaging

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Game page complexity from spectator branching | Medium | Medium | Clean separation: spectator renders GameTable in read-only mode with empty hand; seat-offer as modal overlay |
| Seat offer race conditions (multiple seats open simultaneously) | Low | Medium | Process one offer at a time; queue additional seat openings |
| Spectator reconnect during active seat offer | Low | Low | If reconnecting spectator had an active offer, restart their timeout from remaining time |

## Success Metrics

1. Spectator can join a full room from lobby and see game state
2. Spectator sees card counts only (no hand data leaks)
3. Spectator sees play area card values
4. When seat opens, first spectator gets offered it within 1 second with 30s countdown
5. Deciding spectator sees "Join Game", "Continue Spectating", "Leave Room" options
6. Non-deciding spectators see queue position and deciding spectator's countdown
7. Timeout/decline moves spectator to end of queue round; offer passes to next
8. When all seats filled during processing, remaining spectators return to original order
9. After all decline/timeout, "Seats up for grabs" prompt sent to all spectators
10. Spectator claiming seat transitions to player without page reload
11. New lobby joiner during queue processing enters as spectator at end of queue
12. Spectator can read chat messages but cannot send
13. Disconnect+reconnect resets spectator to end of queue
14. Room destruction returns spectator to lobby with "room was closed" message
15. All 4 players see "Start Game" button when room is full
16. Ready player's info box glows green with "Ready to Start Game" text
17. Game auto-starts when all 4 players are ready
18. Ready states reset when a player leaves or disconnects
19. Host can create room and players join to fill seats from lobby
20. Player auto-assigned seat when joining with no spectators present
21. Player sees "Sit Here" / "Choose Seat" UI when multiple seats open
22. "Choose Seat" locks the player into their seat
23. Subsequent joiners auto-assigned and see seat selection if seats remain
24. Ready prompt appears when 4th seat is filled
25. Lobby joiner during active queue enters as spectator at end of queue
26. Lobby joiner after queue finished sees "up for grabs" prompt
27. Host sees "Add Bot" with difficulty dropdown (Expert default) on empty seats
28. Bots auto-ready when start prompt appears
29. Host can remove bot mid-game; seat vacates and triggers empty-seat flow
30. Game pauses when bot removed mid-game until seat is filled
