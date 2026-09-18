# Spectator Chat Feature Design

**Date:** 2026-04-28
**Status:** Approved

## Overview

Allow spectators to send chat messages within the game interface. The feature is off by default during game creation and can be toggled on/off by the host at any time, including mid-game.

## Requirements

### Functional Requirements

| ID | Requirement |
|---|---|
| SC-01 | Add `spectatorChatEnabled: boolean` field to `GameConfig`, defaulting to `false` |
| SC-02 | Host can toggle spectator chat on/off from the chat panel during pre-game and mid-game |
| SC-03 | When enabled, spectators can send chat messages visible to all room participants (players + spectators) |
| SC-04 | Spectator messages display as "{name} (spectator): {text}" with a visually distinct style |
| SC-05 | System messages announce when spectator chat is enabled/disabled by the host |
| SC-06 | When disabled mid-game, spectator chat input disappears immediately with a system notification |
| SC-07 | The `CONFIGURE_ROOM` handler allows `spectatorChatEnabled` to be changed mid-game (exception to the existing pre-game-only restriction) |
| SC-08 | Spectator chat toggle appears in the game creation form (`CreateGamePopup`), defaulting to off |
| SC-09 | Spectator chat toggle appears in the pre-game settings panel (`PreRoomView`) |
| SC-10 | When spectator chat is disabled, spectator `CHAT_MESSAGE` requests are silently ignored by the server |

### Non-Functional Requirements

| ID | Requirement |
|---|---|
| SC-NFR-01 | No changes to existing player chat behavior |
| SC-NFR-02 | No changes to spectator game state projection (hands remain hidden) |
| SC-NFR-03 | Existing tests continue to pass |

## Design

### 1. Data Model & Protocol

**Shared types — `GameConfig` in `room.ts`:**

Add `spectatorChatEnabled: boolean` to `GameConfig`. Defaults to `false`.

```typescript
interface GameConfig {
  targetScore: number;
  turnTimerSeconds: number | null;
  spectatorsAllowed: boolean;
  isPrivate: boolean;
  spectatorChatEnabled: boolean; // NEW — default: false
}
```

**Protocol — `CHAT_RECEIVED` in `protocol.ts`:**

Extend the server→client `CHAT_RECEIVED` message to support spectator and system messages:

- Player message (existing): `{ type: 'CHAT_RECEIVED', from: Seat, text: string }`
- Spectator message (new): `{ type: 'CHAT_RECEIVED', from: null, spectatorName: string, text: string }`
- System message (new): `{ type: 'CHAT_RECEIVED', from: null, text: string }` (no `spectatorName`)

The `from` field becomes `Seat | null`. The optional `spectatorName?: string` field distinguishes spectator messages from system messages when `from` is `null`.

**Protocol — `CONFIGURE_ROOM`:**

No schema change needed. The message already accepts partial `GameConfig` fields.

### 2. Server-Side Chat Handling

**`game-handler.ts` — `handleChatMessage()`:**

Currently requires `info.seat` to be non-null (players only). Change to:

- If `info.seat` is non-null (player): existing behavior, unchanged
- If `info.seat` is null (spectator):
  - Look up the room config and check `spectatorChatEnabled`
  - If enabled: broadcast `{ type: 'CHAT_RECEIVED', from: null, spectatorName: info.name, text }`
  - If disabled: silently ignore the message

**`room-manager.ts` — `configureRoom()`:**

Currently throws if `room.gameInProgress === true`. Change to:

- If `gameInProgress === true`: only allow `spectatorChatEnabled` to be updated. Reject (throw) if any other fields are included.
- If `gameInProgress === false`: existing behavior, all fields allowed.

**`room-handler.ts` — `handleConfigureRoom()` mid-game path:**

After applying the config change:

- Broadcast `ROOM_UPDATE` (existing mechanism, carries updated config)
- If `spectatorChatEnabled` changed, broadcast a system chat message:
  - Enabled: "Spectator chat has been enabled by the host"
  - Disabled: "Spectator chat has been disabled by the host"

### 3. Client-Side Changes

**`ChatPanel.tsx`:**

New props:

- `isHost?: boolean`
- `spectatorChatEnabled?: boolean`
- `onToggleSpectatorChat?: () => void`
- `isSpectator?: boolean`

Behavior:

- **Host toggle:** When `isHost` is true, render a small toggle at the top of the chat panel labeled "Spectator Chat" with the current on/off state.
- **Spectator input:** `readOnly` becomes conditional — `true` when `spectatorChatEnabled === false` or when the user is not a spectator, `false` when the user is a spectator and chat is enabled. (Players always have input enabled regardless of this flag.)
- **Message rendering:**
  - `from: Seat` (non-null): existing player message rendering
  - `from: null` + `spectatorName` present: render as "{spectatorName} (spectator): {text}" with distinct visual style (muted color or italic)
  - `from: null` + no `spectatorName`: render as a centered system message

**`uiStore.ts`:**

Update `ChatMessage` type: `from` becomes `Seat | null`, add optional `spectatorName?: string`.

**`CreateGamePopup.tsx`:**

Add "Spectator Chat" toggle to the game creation form. Default: off.

**`PreRoomView.tsx`:**

Add "Spectator Chat" to both the editable (host) and read-only (non-host) settings displays.

**Game view (parent rendering `ChatPanel`):**

Pass new props: `isHost`, `spectatorChatEnabled`, `isSpectator`, and a toggle callback that sends `CONFIGURE_ROOM` with `{ spectatorChatEnabled: !current }`.

## Files to Modify

| Package | File | Change |
|---|---|---|
| shared | `src/types/room.ts` | Add `spectatorChatEnabled` to `GameConfig` |
| shared | `src/types/protocol.ts` | Extend `CHAT_RECEIVED` schema (`from: Seat \| null`, `spectatorName?: string`) |
| server | `src/room/room-manager.ts` | Allow `spectatorChatEnabled` mid-game in `configureRoom()` |
| server | `src/room/room-handler.ts` | Broadcast system chat message on toggle change |
| server | `src/game/game-handler.ts` | Allow spectator `CHAT_MESSAGE` when enabled |
| client | `src/components/game/ChatPanel.tsx` | Host toggle, conditional spectator input, spectator/system message rendering |
| client | `src/stores/uiStore.ts` | Update `ChatMessage` type |
| client | `src/components/lobby/CreateGamePopup.tsx` | Add spectator chat toggle to creation form |
| client | `src/components/game/PreRoomView.tsx` | Add spectator chat to settings display |
| client | Game view parent component | Pass new props to `ChatPanel` |
