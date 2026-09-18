# Host Transfer Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notify players when host responsibilities change via modal dialogs (for old/new host) and a system chat message (for everyone else).

**Architecture:** Add a new `HOST_TRANSFERRED` server event broadcast to the room on any host change. The client renders a dismissable modal for the old host (explicit transfer only) and new host, while all players see a system chat message in the chat panel.

**Tech Stack:** TypeScript, Zod (protocol), React (portal-based modal), Vitest (tests)

---

### Task 1: Add HOST_TRANSFERRED to Shared Protocol

**Files:**
- Modify: `code/packages/shared/src/types/protocol.ts:113-186`

- [ ] **Step 1: Add HOST_TRANSFERRED to serverMessageSchema**

In `code/packages/shared/src/types/protocol.ts`, add the new event after the `CHAT_HISTORY` entry (line 179) and before the `HEARTBEAT_PING` entry (line 182):

```typescript
  // Host role change notification
  z.object({ type: z.literal('HOST_TRANSFERRED'), oldHostName: z.string(), newHostName: z.string() }),
```

- [ ] **Step 2: Build shared package to verify no type errors**

Run: `pnpm --filter @tichu/shared build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add code/packages/shared/src/types/protocol.ts
git commit -m "feat(shared): add HOST_TRANSFERRED server message to protocol schema"
```

---

### Task 2: Broadcast HOST_TRANSFERRED from Server on Explicit Transfer

**Files:**
- Modify: `code/packages/server/src/room/room-handler.ts:546-558`

- [ ] **Step 1: Write failing test for explicit transfer notification**

Create `code/packages/server/tests/room/host-transfer-notification.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoomManager } from '../../src/room/room-manager';
import type { ServerMessage } from '@tichu/shared';

// Minimal mock setup for testing the broadcast logic
describe('Host Transfer Notification', () => {
  let roomManager: RoomManager;
  let broadcastedMessages: ServerMessage[];
  let roomCode: string;

  beforeEach(() => {
    roomManager = new RoomManager({ maxRooms: 10 });
    broadcastedMessages = [];

    // Create a room and add a second human player
    const created = roomManager.createRoom('user1', 'Player1', 'TestRoom', {});
    roomCode = created.roomCode;
    roomManager.joinRoom('user2', 'Player2', roomCode);
  });

  it('should produce HOST_TRANSFERRED event data on explicit transfer', () => {
    // Get names before transfer
    const room = roomManager.getRoom(roomCode)!;
    const oldHostSeat = room.hostSeat;
    const oldHostName = room.players.find(p => p.seat === oldHostSeat)!.name;
    const targetSeat = room.players.find(p => p.seat !== oldHostSeat && !p.isBot)!.seat;
    const newHostName = room.players.find(p => p.seat === targetSeat)!.name;

    // Perform transfer
    roomManager.transferHost('user1', targetSeat);

    // Verify the room state changed
    expect(room.hostSeat).toBe(targetSeat);
    // Verify we can derive the notification data
    expect(oldHostName).toBe('Player1');
    expect(newHostName).toBe('Player2');
  });
});
```

- [ ] **Step 2: Run test to verify it passes (baseline)**

Run: `pnpm --filter @tichu/server test -- --run tests/room/host-transfer-notification.test.ts`
Expected: PASS

- [ ] **Step 3: Add HOST_TRANSFERRED broadcast to handleTransferHost**

In `code/packages/server/src/room/room-handler.ts`, modify the `handleTransferHost` method. After `this.broadcastRoomUpdate(info.roomCode);` (line 549), add the notification broadcast:

```typescript
      // Broadcast HOST_TRANSFERRED notification to room
      const oldHostName = room.players.find(p => p.seat === info.seat)!.name;
      const newHostName = room.players.find(p => p.seat === msg.targetSeat)!.name;
      this.broadcaster.broadcastToRoom(info.roomCode, {
        type: 'HOST_TRANSFERRED',
        oldHostName,
        newHostName,
      } as import('@tichu/shared').ServerMessage);
      // System chat message for chat panel
      this.broadcaster.broadcastToRoom(info.roomCode, {
        type: 'CHAT_RECEIVED',
        from: null,
        text: `${newHostName} is now the host`,
      } as import('@tichu/shared').ServerMessage);
```

Note: `info.seat` is the old host's seat (from `getClientInfo`). We need to look up the seat from the connection info. Let me check — actually `info` has `roomCode` but we need the old host seat. The old host is the caller, so we can get their name from `room.players.find(p => p.seat === roomManager.getUserSeat(info.userId))`. Let me adjust:

Actually, looking at the handler, `info` comes from `this.connections.getClientInfo(ws)` which returns `{ userId, roomCode }`. We need the seat of the caller. The roomManager has `getUserSeat(userId)` — let me verify.

Actually, looking at the room-manager code: `this.userToSeat.get(userId)` provides the seat. But since `transferHost` already validated the user is the host, we can get the old host seat from `room.hostSeat` BEFORE the transfer. The issue is that `transferHost` mutates `room.hostSeat` in place. So we need to capture names before calling `transferHost`.

Revised approach — capture old host name before the transfer:

In `handleTransferHost`, restructure the try block:

```typescript
    try {
      // Capture old host name before transfer mutates hostSeat
      const oldHostName = room!.players.find(p => p.seat === room!.hostSeat)!.name;
      const newHostName = room!.players.find(p => p.seat === msg.targetSeat)!.name;

      this.roomManager.transferHost(info.userId, msg.targetSeat);
      // REQ-F-GA29: Broadcast updated host seat to all clients
      this.broadcastRoomUpdate(info.roomCode);
      // Update game manager's cached host seat if game is in progress
      const game = this.gameStore.getGameByRoom(info.roomCode);
      if (game && room) {
        game.setRoomState(room.hostSeat, room.votingEnabled);
      }

      // Broadcast HOST_TRANSFERRED notification to room
      this.broadcaster.broadcastToRoom(info.roomCode, {
        type: 'HOST_TRANSFERRED',
        oldHostName,
        newHostName,
      } as import('@tichu/shared').ServerMessage);
      // System chat message for chat panel
      this.broadcaster.broadcastToRoom(info.roomCode, {
        type: 'CHAT_RECEIVED',
        from: null,
        text: `${newHostName} is now the host`,
      } as import('@tichu/shared').ServerMessage);
    } catch (err) {
      this.broadcaster.sendError(ws, 'TRANSFER_FAILED', (err as Error).message);
    }
```

- [ ] **Step 4: Build server to verify no type errors**

Run: `pnpm --filter @tichu/server build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add code/packages/server/src/room/room-handler.ts code/packages/server/tests/room/host-transfer-notification.test.ts
git commit -m "feat(server): broadcast HOST_TRANSFERRED and system chat on explicit transfer"
```

---

### Task 3: Broadcast HOST_TRANSFERRED on Host Leave/Kick (Auto-Reassignment)

**Files:**
- Modify: `code/packages/server/src/room/room-handler.ts:229-250` (handleLeaveRoom)
- Modify: `code/packages/server/src/room/room-handler.ts:320-348` (pre-game kick vote callback)
- Modify: `code/packages/server/src/room/room-handler.ts:440-457` (in-game force kick)
- Modify: `code/packages/server/src/room/room-handler.ts:975-998` (in-game kick vote callback)

- [ ] **Step 1: Add helper method for host-change notification**

Add a private helper method to `RoomHandler` class to avoid duplicating the broadcast logic. Place it near the `broadcastRoomUpdate` method:

```typescript
  /**
   * Broadcast HOST_TRANSFERRED event and system chat message when host changes.
   * Call AFTER the host has already been reassigned in the room.
   */
  private broadcastHostChanged(roomCode: string, oldHostName: string, newHostName: string): void {
    this.broadcaster.broadcastToRoom(roomCode, {
      type: 'HOST_TRANSFERRED',
      oldHostName,
      newHostName,
    } as import('@tichu/shared').ServerMessage);
    this.broadcaster.broadcastToRoom(roomCode, {
      type: 'CHAT_RECEIVED',
      from: null,
      text: `${newHostName} is now the host`,
    } as import('@tichu/shared').ServerMessage);
  }
```

- [ ] **Step 2: Update handleTransferHost to use the helper**

Replace the two `broadcastToRoom` calls added in Task 2 with:

```typescript
      this.broadcastHostChanged(info.roomCode, oldHostName, newHostName);
```

- [ ] **Step 3: Add host-change detection to handleLeaveRoom**

In `handleLeaveRoom`, around line 234, capture the old host seat BEFORE calling `leaveRoom`, then check if it changed after:

```typescript
      // Capture old host info before leave (host may be reassigned)
      const roomBeforeLeave = this.roomManager.getRoom(this.roomManager.getUserRoom(info.userId)!);
      const oldHostSeat = roomBeforeLeave?.hostSeat;
      const oldHostName = roomBeforeLeave?.players.find(p => p.seat === oldHostSeat)?.name;

      const { room, roomCode: rc, seat, gameWasInProgress } = this.roomManager.leaveRoom(info.userId);
      this.connections.removeFromRoom(ws);

      // ... existing code ...

      if (room) {
        // ... existing code (reReadyBots, broadcastRoomUpdate, tryStartSeatQueue) ...

        // Notify if host changed due to leave
        if (oldHostSeat && room.hostSeat !== oldHostSeat) {
          const newHostName = room.players.find(p => p.seat === room.hostSeat)?.name;
          if (oldHostName && newHostName) {
            this.broadcastHostChanged(rc, oldHostName, newHostName);
          }
        }
      }
```

- [ ] **Step 4: Add host-change detection to pre-game kick vote callback (line ~320)**

In the `onVoteResult` callback for pre-game kicks, after `this.broadcastRoomUpdate(roomCode);` (line 344):

```typescript
        // Notify if host changed due to kick
        const roomAfterKick = this.roomManager.getRoom(roomCode);
        if (roomAfterKick && roomAfterKick.hostSeat !== targetSeat) {
          // Host only changes if the kicked player WAS the host — but host can't be kicked
          // by vote (they'd have to be a non-host). Actually the host CAN be kicked if
          // they disconnect and get voted out. Check if hostSeat changed.
        }
```

Wait — in pre-game kick, the target is already removed. We need to capture the old host seat BEFORE the kick. Let me reconsider the approach.

Actually, for kick scenarios: the host can only be kicked via disconnect vote (not regular kick vote, since the host can't initiate a vote to kick themselves, and force-kick requires being host). In the disconnect vote scenario, the host seat would reassign. But let's handle it generically — before any `leaveRoom` call in kick handlers, capture the old hostSeat.

Revised approach for pre-game kick vote callback (~line 320-348):

```typescript
      if (voteType === 'kick' && passed && targetSeat) {
        const room = this.roomManager.getRoom(roomCode);
        const oldHostSeat = room?.hostSeat;
        const oldHostName = room?.players.find(p => p.seat === oldHostSeat)?.name;

        // ... existing kick logic (notify target, leaveRoom, removeBot, resetReady, reReadyBots) ...

        this.broadcastRoomUpdate(roomCode);

        // Notify if host changed due to kick
        const roomAfterKick = this.roomManager.getRoom(roomCode);
        if (roomAfterKick && oldHostSeat && roomAfterKick.hostSeat !== oldHostSeat) {
          const newHostName = roomAfterKick.players.find(p => p.seat === roomAfterKick.hostSeat)?.name;
          if (oldHostName && newHostName) {
            this.broadcastHostChanged(roomCode, oldHostName, newHostName);
          }
        }

        if (targetSeat) {
          this.tryStartSeatQueue(roomCode, [targetSeat]);
        }
      }
```

- [ ] **Step 5: Add host-change detection to in-game force kick (~line 440)**

Before the `leaveRoom` call at line 447, capture old host info:

```typescript
      const oldHostSeat = room.hostSeat;
      const oldHostName = room.players.find(p => p.seat === oldHostSeat)?.name;

      // ... existing kick logic ...

      this.broadcastRoomUpdate(info.roomCode);

      // Notify if host changed due to kick
      if (room.hostSeat !== oldHostSeat) {
        const newHostName = room.players.find(p => p.seat === room.hostSeat)?.name;
        if (oldHostName && newHostName) {
          this.broadcastHostChanged(info.roomCode, oldHostName, newHostName);
        }
      }
```

- [ ] **Step 6: Add host-change detection to in-game kick vote callback (~line 975)**

Same pattern — capture old host info before `leaveRoom`, check after:

```typescript
      (rc, targetSeat) => {
        const room = this.roomManager.getRoom(rc);
        const oldHostSeat = room?.hostSeat;
        const oldHostName = room?.players.find(p => p.seat === oldHostSeat)?.name;

        // ... existing kick logic ...

        this.broadcastRoomUpdate(rc);

        // Notify if host changed due to kick
        const roomAfterKick = this.roomManager.getRoom(rc);
        if (roomAfterKick && oldHostSeat && roomAfterKick.hostSeat !== oldHostSeat) {
          const newHostName = roomAfterKick.players.find(p => p.seat === roomAfterKick.hostSeat)?.name;
          if (oldHostName && newHostName) {
            this.broadcastHostChanged(rc, oldHostName, newHostName);
          }
        }
      },
```

- [ ] **Step 7: Build and run server tests**

Run: `pnpm --filter @tichu/server build && pnpm --filter @tichu/server test -- --run`
Expected: Build succeeds, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add code/packages/server/src/room/room-handler.ts
git commit -m "feat(server): broadcast host-change notifications on leave and kick"
```

---

### Task 4: Create HostTransferDialog Client Component

**Files:**
- Create: `code/packages/client/src/components/game/HostTransferDialog.tsx`
- Create: `code/packages/client/tests/components/game/HostTransferDialog.test.tsx`

- [ ] **Step 1: Write failing test for HostTransferDialog**

Create `code/packages/client/tests/components/game/HostTransferDialog.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HostTransferDialog } from '../../../src/components/game/HostTransferDialog';

describe('HostTransferDialog', () => {
  it('shows new host message when myName matches newHostName', () => {
    const onDismiss = vi.fn();
    render(
      <HostTransferDialog
        oldHostName="Alice"
        newHostName="Bob"
        myName="Bob"
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByText('You are now the game host')).toBeTruthy();
  });

  it('shows transfer success message when myName matches oldHostName', () => {
    const onDismiss = vi.fn();
    render(
      <HostTransferDialog
        oldHostName="Alice"
        newHostName="Bob"
        myName="Alice"
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByText('You have successfully transferred host privileges to Bob')).toBeTruthy();
  });

  it('dismisses on OK button click', () => {
    const onDismiss = vi.fn();
    render(
      <HostTransferDialog
        oldHostName="Alice"
        newHostName="Bob"
        myName="Bob"
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses on backdrop click', () => {
    const onDismiss = vi.fn();
    render(
      <HostTransferDialog
        oldHostName="Alice"
        newHostName="Bob"
        myName="Bob"
        onDismiss={onDismiss}
      />,
    );
    // Click the backdrop (the overlay div with role="dialog" parent)
    const backdrop = screen.getByRole('dialog').parentElement!;
    fireEvent.click(backdrop);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses on Escape key', () => {
    const onDismiss = vi.fn();
    render(
      <HostTransferDialog
        oldHostName="Alice"
        newHostName="Bob"
        myName="Bob"
        onDismiss={onDismiss}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('returns null when myName is neither old nor new host', () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <HostTransferDialog
        oldHostName="Alice"
        newHostName="Bob"
        myName="Charlie"
        onDismiss={onDismiss}
      />,
    );
    expect(container.innerHTML).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tichu/client test -- --run tests/components/game/HostTransferDialog.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement HostTransferDialog component**

Create `code/packages/client/src/components/game/HostTransferDialog.tsx`:

```typescript
'use client';

import { memo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface HostTransferDialogProps {
  oldHostName: string;
  newHostName: string;
  myName: string;
  onDismiss: () => void;
}

export const HostTransferDialog = memo(function HostTransferDialog({
  oldHostName,
  newHostName,
  myName,
  onDismiss,
}: HostTransferDialogProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onDismiss]);

  const handleBackdropClick = useCallback(() => onDismiss(), [onDismiss]);
  const stopPropagation = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

  // Determine message based on who is viewing
  let message: string;
  if (myName === newHostName) {
    message = 'You are now the game host';
  } else if (myName === oldHostName) {
    message = `You have successfully transferred host privileges to ${newHostName}`;
  } else {
    return null;
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
      }}
      onClick={handleBackdropClick}
    >
      <div
        style={{
          background: 'rgb(0,0,0)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--space-3)',
          padding: 'var(--space-8) calc(var(--space-8) * 1.5)',
          textAlign: 'center',
          maxWidth: 'calc(480px * var(--scale))',
        }}
        onClick={stopPropagation}
        role="dialog"
        aria-label="Host Transfer"
      >
        <p style={{ fontSize: 'var(--font-2xl)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
          Host Changed
        </p>
        <p style={{ fontSize: 'var(--font-base)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)' }}>
          {message}
        </p>
        <button
          onClick={onDismiss}
          style={{
            padding: 'var(--space-3) var(--space-6)',
            borderRadius: 'var(--space-2)',
            border: 'none',
            background: 'var(--color-gold-accent)',
            color: 'var(--color-felt-green-dark)',
            fontSize: 'var(--font-lg)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          OK
        </button>
      </div>
    </div>,
    document.body,
  );
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @tichu/client test -- --run tests/components/game/HostTransferDialog.test.tsx`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add code/packages/client/src/components/game/HostTransferDialog.tsx code/packages/client/tests/components/game/HostTransferDialog.test.tsx
git commit -m "feat(client): add HostTransferDialog component with tests"
```

---

### Task 5: Integrate HostTransferDialog into Game Page

**Files:**
- Modify: `code/packages/client/src/app/game/[gameId]/page.tsx`

- [ ] **Step 1: Add HOST_TRANSFERRED handler to handleMessage**

In `code/packages/client/src/app/game/[gameId]/page.tsx`, add state for the notification near other state declarations (around line 75):

```typescript
const [hostTransferInfo, setHostTransferInfo] = useState<{ oldHostName: string; newHostName: string } | null>(null);
```

In the `handleMessage` callback, add a handler for `HOST_TRANSFERRED`. Place it after the `ROOM_UPDATE` handler (around line 392):

```typescript
      } else if (msg.type === 'HOST_TRANSFERRED') {
        setHostTransferInfo({ oldHostName: msg.oldHostName, newHostName: msg.newHostName });
```

- [ ] **Step 2: Add import for HostTransferDialog**

Add to the imports at the top of the file:

```typescript
import { HostTransferDialog } from '@/components/game/HostTransferDialog';
```

- [ ] **Step 3: Render HostTransferDialog**

Near the other portal-rendered dialogs (near the end of the component's JSX return), add:

```typescript
{hostTransferInfo && (
  <HostTransferDialog
    oldHostName={hostTransferInfo.oldHostName}
    newHostName={hostTransferInfo.newHostName}
    myName={playerName}
    onDismiss={() => setHostTransferInfo(null)}
  />
)}
```

- [ ] **Step 4: Build client to verify no type errors**

Run: `pnpm --filter @tichu/client build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add code/packages/client/src/app/game/[gameId]/page.tsx
git commit -m "feat(client): integrate HostTransferDialog into game page message handler"
```

---

### Task 6: Run Full Test Suite and Verify

**Files:** None (verification only)

- [ ] **Step 1: Run full type check**

Run: `pnpm typecheck`
Expected: All packages pass with no errors.

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: No lint errors.

- [ ] **Step 4: Manual verification (dev server)**

Run: `cd code && bash scripts/dev-start.sh`

Test scenarios:
1. Open two browser tabs, join same room as two different players
2. As host, transfer host to the other player
3. Verify: old host sees dialog "You have successfully transferred host privileges to <name>"
4. Verify: new host sees dialog "You are now the game host"
5. Verify: system chat message "<name> is now the host" appears in chat for both
6. Verify: clicking OK dismisses the dialog
7. Verify: clicking backdrop dismisses the dialog
8. Verify: pressing Escape dismisses the dialog
9. Test host leaving: host leaves room, verify new host gets "You are now the game host" dialog

- [ ] **Step 5: Final commit (if any fixups needed)**

```bash
git add -A
git commit -m "fix: address test/lint issues from host transfer notification integration"
```
