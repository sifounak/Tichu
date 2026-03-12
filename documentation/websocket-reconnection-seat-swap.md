# WebSocket Reconnection Fix & Seat Swap Feature

**Date:** 2026-03-12
**Branch:** `bugfix/ws-reconnection-seat-swap`

## WebSocket Reconnection Fix

### Problem
When a player created a room on the lobby page and navigated to the room page, the room appeared broken — no bot buttons, no room state, and no ability to interact. The player's name also reverted to "Guest".

### Root Cause
The lobby page's WebSocket closed on navigation. The room page opened a new WebSocket, but the server's `ConnectionManager.addClient()` reset the user's room association. The room page never re-sent `JOIN_ROOM` because Zustand still held the old room code.

### Fix
- **Server-side reconnection:** When a new WebSocket connects, the server checks if the user was already in a room and automatically restores their membership.
- **Disconnect tracking:** The server marks players as disconnected when their WebSocket closes, enabling proper reconnection detection.
- **Player name persistence:** The lobby page now saves the player name to `sessionStorage`, so it survives page navigation.
- **Auto-join timing:** The room page waits briefly for server-initiated reconnection before attempting a manual `JOIN_ROOM`.

## Seat Swap Feature

### Usage
Before a game starts, players can swap seats in the room lobby:

- Click **"Sit Here"** on any empty seat or bot-occupied seat to move there.
- Click **"Swap"** on another human player's seat to exchange positions.
- Seat swapping is **disabled once a game is in progress**.

### Protocol
The feature uses a new `SWAP_SEATS` WebSocket message with `{ targetSeat: number }`.

### Behavior
| Target Seat | Action |
|------------|--------|
| Empty | Player moves to the empty seat |
| Bot | Bot is removed, player takes the seat |
| Other human | Both players swap positions |
