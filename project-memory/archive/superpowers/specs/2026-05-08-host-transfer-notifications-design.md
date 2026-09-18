# Host Transfer Notifications

## Overview

Notify players when host responsibilities change. The new host and (on explicit transfer) the old host see a dismissable modal dialog. All players see a system chat message recording the change.

## Triggers

Host change occurs in three scenarios:
1. **Explicit transfer** — current host uses TRANSFER_HOST action
2. **Host leaves** — host voluntarily leaves the room, host auto-reassigns to first human player
3. **Host kicked** — host is force-kicked, host auto-reassigns

All three scenarios produce the same notifications (except the old host dialog only appears for explicit transfer, since in other cases the old host is no longer in the room).

## Server Changes

### New Protocol Event

Add to `ServerMessage` union in `code/packages/shared/src/types/protocol.ts`:

```typescript
z.object({ type: z.literal('HOST_TRANSFERRED'), oldHostName: z.string(), newHostName: z.string() })
```

### Broadcast Logic (`room-handler.ts`)

After any successful host change, broadcast two messages to the room:

1. **HOST_TRANSFERRED event** — enables client dialogs
   ```typescript
   { type: 'HOST_TRANSFERRED', oldHostName: string, newHostName: string }
   ```

2. **System chat message** — appears in chat panel for all players
   ```typescript
   { type: 'CHAT_RECEIVED', from: null, text: '<newHostName> is now the host' }
   ```

### Integration Points

- `handleTransferHost` (line ~526): after successful `transferHost()` call and `broadcastRoomUpdate()`
- `handleLeaveRoom` (line ~234): after `leaveRoom()` when room still exists and hostSeat changed
- Kick handlers (lines ~330, 447, 986): after kick when hostSeat changed

For leave/kick scenarios, compare `room.hostSeat` before and after the operation to detect a host change.

## Client Changes

### New Component: `HostTransferDialog.tsx`

**Location:** `code/packages/client/src/components/game/HostTransferDialog.tsx`

**Props:**
```typescript
interface HostTransferDialogProps {
  oldHostName: string;
  newHostName: string;
  myName: string;
  onDismiss: () => void;
}
```

**Behavior:**
- If `myName === newHostName` → display "You are now the game host"
- If `myName === oldHostName` → display "You have successfully transferred host privileges to <newHostName>"
- Otherwise → do not render (should not be called, but guard defensively)

**UI:**
- Rendered via `createPortal(content, document.body)`
- Fixed overlay: `position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.6)`
- Centered dialog box matching `ActionConfirmDialog` styling:
  - Dark background (`rgb(0,0,0)`)
  - Border: `1px solid var(--color-border)`
  - Border radius: `var(--space-3)`
  - Padding: `var(--space-8) calc(var(--space-8) * 1.5)`
  - Max width: `calc(480px * var(--scale))`
- Single "OK" button with gold accent styling (`var(--color-gold-accent)`)
- Dismiss on: OK button click, backdrop click, Escape key

### Integration

**Files:** `PreRoomView.tsx` and `game/[gameId]/page.tsx`

- Listen for `HOST_TRANSFERRED` messages from WebSocket
- Store `{ oldHostName, newHostName } | null` in component state
- Render `HostTransferDialog` when state is non-null
- Clear state on dismiss

**Message filtering:** Only show dialog if local player is the old host or new host. Other players only see the system chat message (no dialog needed for them).

## Messages

| Viewer | Channel | Text |
|--------|---------|------|
| New host | Modal dialog | "You are now the game host" |
| Old host (explicit transfer only) | Modal dialog | "You have successfully transferred host privileges to \<newHostName\>" |
| All players | System chat message | "\<newHostName\> is now the host" |

## Non-Goals

- No sound or animation effects
- No persistence — if the player misses the dialog, the chat message remains as a record
- No changes to the existing ROOM_UPDATE flow (hostSeat still updates UI controls)
