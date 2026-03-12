# Milestone 1: WebSocket Reconnection Fix

**Date:** 2026-03-12
**Requirements:** REQ-F-001 through REQ-F-005, REQ-NF-001, REQ-NF-002

## Changes Implemented

1. **playerName persistence** — Added `sessionStorage.setItem('tichu_player_name', ...)` in all 3 lobby handlers (`handleCreate`, `handleJoinByCode`, `handleJoinRoom`)
2. **broadcastRoomUpdate public** — Changed visibility from `private` to `public` in `room-handler.ts`
3. **markDisconnected on close** — Added `roomHandler.roomManager.markDisconnected(info.userId)` in `ws.on('close')` handler
4. **Server reconnection** — After `addClient()`, check `getUserRoom`/`getUserSeat`, restore room membership via `assignToRoom` + `markReconnected`, send `ROOM_JOINED` + broadcast `ROOM_UPDATE`
5. **Auto-join timing fix** — Added 150ms delay with `useRoomStore.getState()` check to allow server reconnection to arrive first

## Test Results

- 546 tests pass (346 server + 200 client)
- No regressions
- 2 packages cached (shared + engine unchanged)
