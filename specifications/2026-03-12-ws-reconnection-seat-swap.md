# Specification: WebSocket Reconnection & Seat Swap

**Date:** 2026-03-12
**Status:** Approved
**Type:** Bugfix + Enhancement

## Problem Statement

When a player creates a room on `/lobby` and navigates to `/lobby/[roomId]`, the room page is broken: no bot buttons, no room state, no ability to interact. Additionally, there is no way for players to choose or swap seats.

## Root Cause Analysis

1. Lobby page creates room via WebSocket, saves roomCode/mySeat to Zustand, navigates away
2. Old WebSocket closes on component unmount (`useWebSocket.ts` disconnect on cleanup)
3. Room page creates a NEW WebSocket with the same userId
4. Server's `ConnectionManager.addClient()` resets `roomCode: null, seat: null` for the new socket
5. Room page's auto-join guard checks `!roomCode` — but Zustand already has roomCode — so `JOIN_ROOM` is never sent
6. Server never associates the new socket with the room — broadcasts miss the player
7. Lobby page never saves `playerName` to sessionStorage, so room page connects as "Guest"

## Requirements

### Functional Requirements

| ID | Description | Priority |
|----|-------------|----------|
| REQ-F-001 | Server must detect and restore room membership when a user reconnects with a new WebSocket | Critical |
| REQ-F-002 | Server must mark players as disconnected when their WebSocket closes | Critical |
| REQ-F-003 | Player name must persist across page navigation | Critical |
| REQ-F-004 | Room page must handle both fresh joins and server-initiated reconnections | Critical |
| REQ-F-005 | `broadcastRoomUpdate` must be accessible for reconnection flow | Critical |
| REQ-F-006 | Players must be able to swap to empty seats, bot seats, or other human seats | Medium |
| REQ-F-007 | Seat swapping must be blocked when a game is in progress | Medium |

### Non-Functional Requirements

| ID | Description | Priority |
|----|-------------|----------|
| REQ-NF-001 | Reconnection must complete within 200ms of WebSocket connection | High |
| REQ-NF-002 | No breaking changes to existing protocol messages | High |

## Success Metrics

1. Creating a room and navigating to it works — player sees their name, bot buttons are visible
2. Adding bots and starting a game works after room creation flow
3. Players can swap seats before game starts
4. Existing tests continue to pass
5. New tests cover reconnection logic and seat swap

## Files Affected

| File | Changes |
|------|---------|
| `code/packages/server/src/app.ts` | Add reconnection logic + markDisconnected on close |
| `code/packages/server/src/ws/connection-manager.ts` | No changes needed |
| `code/packages/server/src/room/room-manager.ts` | Add `swapSeat()` method |
| `code/packages/server/src/room/room-handler.ts` | Make `broadcastRoomUpdate` public, add `SWAP_SEATS` handler |
| `code/packages/shared/src/types/protocol.ts` | Add `SWAP_SEATS` message type |
| `code/packages/client/src/app/lobby/page.tsx` | Save playerName to sessionStorage |
| `code/packages/client/src/app/lobby/[roomId]/page.tsx` | Fix auto-join timing, add seat swap UI |
