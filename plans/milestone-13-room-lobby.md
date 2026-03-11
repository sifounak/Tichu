# Milestone 13: Room & Lobby System

**Package(s):** server, client
**Requirements:** Room creation, joining, configuration, public lobby

## Goal

Implement the room/lobby system so players can create rooms, share codes, browse public games, configure settings, and start games.

## Tasks

### 13.1 Room manager (`packages/server/src/room/room-manager.ts`)
- Create room: generate 6-char code, set host, apply config
- Join room: by code, assign to seat
- Leave room: remove from seat, reassign host if needed
- Add bot: fill a seat with bot of specified difficulty
- Room lifecycle: waiting → configuring → game started → game ended

### 13.2 Lobby (`packages/server/src/room/matchmaking.ts`)
- List public rooms (with filtering: available seats, config)
- Auto-cleanup stale rooms (no activity for 30 min)

### 13.3 Room API (WebSocket messages)
- JOIN_ROOM, LEAVE_ROOM, CONFIGURE_ROOM, ADD_BOT, START_GAME
- ROOM_STATE broadcast on any change

### 13.4 Client lobby page (`packages/client/src/app/lobby/page.tsx`)
- Room list: filterable, shows seat availability
- Create room button → config form
- Join by code input

### 13.5 Room config form (`packages/client/src/components/lobby/CreateRoomForm.tsx`)
- Target score (slider/input, default 1000)
- Bot difficulty (easy/medium/hard)
- Animation speed (slow/normal/fast/off)
- Spectators allowed (toggle)
- Private/public (toggle)
- Turn timer (off/30s/60s/90s)

### 13.6 Room waiting area (`packages/client/src/app/lobby/[roomId]/page.tsx`)
- 4 seat slots: player name or empty/bot
- Host controls: add bot, rearrange seats, start game
- Share room code/link
- Settings summary

## Tests

- Room CRUD: create, join, leave, destroy
- Room code uniqueness
- Seat management: fill all 4, can't overfill
- Public lobby: rooms appear/disappear correctly
- Config validation: valid ranges for all settings
- Bot addition: fills seat, correct difficulty
- Start game: transitions to game state correctly

## Verification

1. All tests pass
2. E2E: create room → share code → join → add bot → configure → start
3. Public lobby updates in real-time
