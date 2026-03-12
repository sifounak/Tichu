# Implementation Plan: WebSocket Reconnection & Seat Swap

**Date:** 2026-03-12
**Branch:** `bugfix/ws-reconnection-seat-swap`
**Parent:** `main`

## Milestone 1: WebSocket Reconnection Fix (REQ-F-001 through REQ-F-005, REQ-NF-001, REQ-NF-002)

**Goal:** Fix the broken room page by implementing server-side reconnection, disconnect tracking, playerName persistence, and auto-join timing.

### Changes:

1. **Save playerName to sessionStorage** (`client/src/app/lobby/page.tsx`)
   - Add `sessionStorage.setItem('tichu_player_name', playerName.trim())` in `handleCreate`, `handleJoinByCode`, `handleJoinRoom`

2. **Make `broadcastRoomUpdate` public** (`server/src/room/room-handler.ts:218`)
   - Change `private broadcastRoomUpdate` to `public broadcastRoomUpdate`

3. **Add `markDisconnected` on ws close** (`server/src/app.ts:118-126`)
   - In `ws.on('close')` handler, call `roomHandler.roomManager.markDisconnected(info.userId)`

4. **Server reconnection logic** (`server/src/app.ts`, after line 107)
   - After `addClient()`, check if user is already in a room via `getUserRoom(userId)`
   - If yes: `assignToRoom()`, `markReconnected()`, send `ROOM_JOINED`, broadcast `ROOM_UPDATE`

5. **Fix room page auto-join timing** (`client/src/app/lobby/[roomId]/page.tsx:71-75`)
   - Add 150ms timeout before checking if `JOIN_ROOM` is needed
   - Use `useRoomStore.getState()` for latest Zustand value

### Testing:
- Run existing test suite to verify no regressions
- Manual verification: create room → navigate → verify room state

## Milestone 2: Seat Swap Feature (REQ-F-006, REQ-F-007)

**Goal:** Allow players to swap seats before a game starts.

### Changes:

1. **Add `SWAP_SEATS` protocol message** (`shared/src/types/protocol.ts`)
   - Add to `clientMessageSchema` discriminated union

2. **Add `swapSeat()` method** (`server/src/room/room-manager.ts`)
   - Empty seat: move player
   - Bot seat: remove bot, move player
   - Human seat: swap both players
   - Throw if game in progress

3. **Add `SWAP_SEATS` handler** (`server/src/room/room-handler.ts`)
   - Register handler, call `swapSeat()`, update ConnectionManager, broadcast

4. **Add seat swap UI** (`client/src/app/lobby/[roomId]/page.tsx`)
   - "Sit Here" button on empty/bot seats
   - `handleSwapSeat(seat)` sends `SWAP_SEATS` message

### Testing:
- Unit tests for `swapSeat()` in room-manager tests
- Run full test suite
