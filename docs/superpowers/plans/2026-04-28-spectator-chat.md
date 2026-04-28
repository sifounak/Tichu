# Spectator Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow spectators to send chat messages (when enabled by host), with a host toggle in the chat panel that works pre-game and mid-game.

**Architecture:** Add `spectatorChatEnabled: boolean` to `GameConfig`. Carve out a mid-game exception in `configureRoom()` for this field only. Extend `CHAT_RECEIVED` to support `from: null` with optional `spectatorName`. Host toggle lives inside `ChatPanel` header.

**Tech Stack:** TypeScript, Zod (protocol validation), React, Zustand, Vitest, React Testing Library

---

### Task 1: Add `spectatorChatEnabled` to shared types

**Files:**
- Modify: `code/packages/shared/src/types/game.ts:125-138`
- Modify: `code/packages/shared/src/types/protocol.ts:29-34`

- [ ] **Step 1: Add field to `GameConfig` interface**

In `code/packages/shared/src/types/game.ts`, add `spectatorChatEnabled` to the interface and default:

```typescript
// At line 129, after isPrivate: boolean;
spectatorChatEnabled: boolean;
```

And in `DEFAULT_GAME_CONFIG` at line 137, after `isPrivate: false,`:

```typescript
spectatorChatEnabled: false,
```

- [ ] **Step 2: Add field to `roomConfigSchema` in protocol.ts**

In `code/packages/shared/src/types/protocol.ts`, add to `roomConfigSchema` (line 29-34):

```typescript
spectatorChatEnabled: z.boolean().optional(),
```

- [ ] **Step 3: Build shared package to verify no type errors**

Run: `cd code && pnpm --filter @tichu/shared build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add code/packages/shared/src/types/game.ts code/packages/shared/src/types/protocol.ts
git commit -m "feat(shared): add spectatorChatEnabled to GameConfig and protocol schema"
```

---

### Task 2: Extend `CHAT_RECEIVED` protocol to support spectator and system messages

**Files:**
- Modify: `code/packages/shared/src/types/protocol.ts:162`

- [ ] **Step 1: Update `CHAT_RECEIVED` schema**

In `code/packages/shared/src/types/protocol.ts`, replace line 162:

```typescript
z.object({ type: z.literal('CHAT_RECEIVED'), from: seatSchema, text: z.string() }),
```

with:

```typescript
z.object({ type: z.literal('CHAT_RECEIVED'), from: seatSchema.nullable(), text: z.string(), spectatorName: z.string().optional() }),
```

- [ ] **Step 2: Build shared package**

Run: `cd code && pnpm --filter @tichu/shared build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add code/packages/shared/src/types/protocol.ts
git commit -m "feat(shared): extend CHAT_RECEIVED to support spectator and system messages"
```

---

### Task 3: Allow `spectatorChatEnabled` to be changed mid-game (server)

**Files:**
- Modify: `code/packages/server/src/room/room-manager.ts:212-220`
- Test: `code/packages/server/tests/room/room-manager.test.ts`

- [ ] **Step 1: Write failing tests for mid-game spectatorChatEnabled**

Add to `code/packages/server/tests/room/room-manager.test.ts`, inside the `configureRoom` describe block:

```typescript
it('should allow spectatorChatEnabled change during game', () => {
  const room = manager.createRoom('u1', 'P1');
  manager.addBot(room.roomCode, 'north');
  manager.addBot(room.roomCode, 'east');
  manager.addBot(room.roomCode, 'west');
  manager.startGame(room.roomCode);
  manager.configureRoom(room.roomCode, { spectatorChatEnabled: true });
  expect(room.config.spectatorChatEnabled).toBe(true);
});

it('should reject non-spectatorChatEnabled config changes during game', () => {
  const room = manager.createRoom('u1', 'P1');
  manager.addBot(room.roomCode, 'north');
  manager.addBot(room.roomCode, 'east');
  manager.addBot(room.roomCode, 'west');
  manager.startGame(room.roomCode);
  expect(() => manager.configureRoom(room.roomCode, { targetScore: 500 })).toThrow('Game already in progress');
});

it('should reject mixed config with non-spectatorChatEnabled fields during game', () => {
  const room = manager.createRoom('u1', 'P1');
  manager.addBot(room.roomCode, 'north');
  manager.addBot(room.roomCode, 'east');
  manager.addBot(room.roomCode, 'west');
  manager.startGame(room.roomCode);
  expect(() => manager.configureRoom(room.roomCode, { spectatorChatEnabled: true, targetScore: 500 })).toThrow('Game already in progress');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd code && pnpm --filter @tichu/server test -- --run room-manager`
Expected: First test fails (currently throws "Game already in progress" for all config changes)

- [ ] **Step 3: Implement mid-game exception in `configureRoom()`**

In `code/packages/server/src/room/room-manager.ts`, replace the `configureRoom` method (lines 212-220):

```typescript
/** Update room configuration. */
configureRoom(roomCode: string, updates: Partial<GameConfig>): Room {
  const room = this.rooms.get(roomCode);
  if (!room) throw new Error('Room not found.');

  if (room.gameInProgress) {
    // Only spectatorChatEnabled can be changed mid-game
    const keys = Object.keys(updates) as (keyof GameConfig)[];
    if (keys.length !== 1 || keys[0] !== 'spectatorChatEnabled') {
      throw new Error('Game already in progress.');
    }
  }

  Object.assign(room.config, updates);
  return room;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd code && pnpm --filter @tichu/server test -- --run room-manager`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add code/packages/server/src/room/room-manager.ts code/packages/server/tests/room/room-manager.test.ts
git commit -m "feat(server): allow spectatorChatEnabled toggle mid-game in configureRoom"
```

---

### Task 4: Broadcast system chat message on spectator chat toggle (server)

**Files:**
- Modify: `code/packages/server/src/room/room-handler.ts:401-419`

- [ ] **Step 1: Update `handleConfigureRoom` to broadcast system chat on toggle**

In `code/packages/server/src/room/room-handler.ts`, replace the `handleConfigureRoom` method (lines 401-419):

```typescript
private handleConfigureRoom(ws: WebSocket, msg: ClientMessage & { type: 'CONFIGURE_ROOM' }): void {
  const info = this.connections.getClientInfo(ws);
  if (!info?.roomCode) {
    this.broadcaster.sendError(ws, 'NOT_IN_ROOM', 'Not in a room');
    return;
  }

  if (!this.roomManager.isHost(info.userId)) {
    this.broadcaster.sendError(ws, 'NOT_HOST', 'Only the host can configure the room');
    return;
  }

  // Capture previous value for change detection
  const room = this.roomManager.getRoom(info.roomCode);
  const prevSpectatorChat = room?.config.spectatorChatEnabled;

  try {
    this.roomManager.configureRoom(info.roomCode, msg.config);
    this.broadcastRoomUpdate(info.roomCode);

    // Broadcast system chat message when spectator chat is toggled
    const newSpectatorChat = room?.config.spectatorChatEnabled;
    if (prevSpectatorChat !== newSpectatorChat && newSpectatorChat !== undefined) {
      const text = newSpectatorChat
        ? 'Spectator chat has been enabled by the host'
        : 'Spectator chat has been disabled by the host';
      this.broadcaster.broadcastToRoom(info.roomCode, {
        type: 'CHAT_RECEIVED',
        from: null,
        text,
      } as import('@tichu/shared').ServerMessage);
    }
  } catch (err) {
    this.broadcaster.sendError(ws, 'CONFIGURE_FAILED', (err as Error).message);
  }
}
```

- [ ] **Step 2: Build server to verify no type errors**

Run: `cd code && pnpm --filter @tichu/server build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add code/packages/server/src/room/room-handler.ts
git commit -m "feat(server): broadcast system chat message on spectator chat toggle"
```

---

### Task 5: Allow spectators to send chat messages (server)

**Files:**
- Modify: `code/packages/server/src/game/game-handler.ts:77-89`

- [ ] **Step 1: Update `handleChatMessage` to support spectator chat**

In `code/packages/server/src/game/game-handler.ts`, first add the import for RoomManager at the top (after existing imports):

```typescript
import type { RoomManager } from '../room/room-manager.js';
```

Update the constructor to accept `roomManager`:

```typescript
export class GameHandler {
  constructor(
    router: MessageRouter,
    private readonly connections: ConnectionManager,
    private readonly broadcaster: Broadcaster,
    private readonly gameStore: GameStore,
    private readonly roomManager: RoomManager,
  ) {
```

Replace the `handleChatMessage` method (lines 77-89):

```typescript
/**
 * REQ-F-GMR03: Handle chat messages by broadcasting to the room.
 * Chat is not a game-engine action, so it bypasses GameManager.
 * SC-03: Spectators can send chat when spectatorChatEnabled is true.
 */
private handleChatMessage(ws: WebSocket, msg: ClientMessage & { type: 'CHAT_MESSAGE' }): void {
  const info = this.connections.getClientInfo(ws);
  if (!info?.roomCode) {
    this.broadcaster.sendError(ws, 'NOT_IN_GAME', 'You must be in a game to chat');
    return;
  }

  if (info.seat) {
    // Player chat — existing behavior
    this.broadcaster.broadcastToRoom(info.roomCode, {
      type: 'CHAT_RECEIVED',
      from: info.seat,
      text: msg.text,
    });
  } else {
    // Spectator chat — only when enabled
    const room = this.roomManager.getRoom(info.roomCode);
    if (!room?.config.spectatorChatEnabled) return; // SC-10: silently ignore

    this.broadcaster.broadcastToRoom(info.roomCode, {
      type: 'CHAT_RECEIVED',
      from: null,
      spectatorName: info.playerName,
      text: msg.text,
    } as import('@tichu/shared').ServerMessage);
  }
}
```

- [ ] **Step 2: Update GameHandler construction site to pass roomManager**

Find where `GameHandler` is constructed. Search for `new GameHandler` and add the `roomManager` argument.

Run: `cd code && grep -rn "new GameHandler" packages/server/src/`

Update that call site to pass the `roomManager` instance (from `RoomHandler.roomManager` which is public `readonly`).

- [ ] **Step 3: Build server to verify no type errors**

Run: `cd code && pnpm --filter @tichu/server build`
Expected: Build succeeds

- [ ] **Step 4: Run all server tests**

Run: `cd code && pnpm --filter @tichu/server test -- --run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add code/packages/server/src/game/game-handler.ts
git commit -m "feat(server): allow spectators to send chat when spectatorChatEnabled is true"
```

Note: Include any additional files modified in step 2 in the `git add`.

---

### Task 6: Update client `ChatMessage` type and store

**Files:**
- Modify: `code/packages/client/src/components/game/ChatPanel.tsx:8-12`
- Modify: `code/packages/client/src/stores/uiStore.ts:7`

- [ ] **Step 1: Update `ChatMessage` interface**

In `code/packages/client/src/components/game/ChatPanel.tsx`, replace the `ChatMessage` interface (lines 8-12):

```typescript
export interface ChatMessage {
  from: Seat | null;
  text: string;
  timestamp: number;
  spectatorName?: string;
}
```

- [ ] **Step 2: Build client to check for type errors**

Run: `cd code && pnpm --filter @tichu/client build`
Expected: Build may show errors in ChatPanel message rendering (line 97) due to `msg.from` being nullable — that's expected and will be fixed in Task 7.

- [ ] **Step 3: Commit**

```bash
git add code/packages/client/src/components/game/ChatPanel.tsx
git commit -m "feat(client): update ChatMessage type for spectator and system messages"
```

---

### Task 7: Update `ChatPanel` UI — spectator/system message rendering and host toggle

**Files:**
- Modify: `code/packages/client/src/components/game/ChatPanel.tsx`
- Modify: `code/packages/client/src/components/game/ChatPanel.module.css`
- Test: `code/packages/client/tests/components/game/ChatPanel.test.tsx`

- [ ] **Step 1: Write failing tests for new ChatPanel features**

Add to `code/packages/client/tests/components/game/ChatPanel.test.tsx`:

```typescript
it('renders spectator message with name and label', () => {
  const msgs: ChatMessage[] = [
    { from: null, text: 'Nice play!', timestamp: 1000, spectatorName: 'Alice' },
  ];
  render(
    <ChatPanel messages={msgs} onSend={vi.fn()} isOpen={true} onToggle={vi.fn()} unreadCount={0} />,
  );
  expect(screen.getByText('Alice (spectator)')).toBeInTheDocument();
  expect(screen.getByText('Nice play!')).toBeInTheDocument();
});

it('renders system message without sender', () => {
  const msgs: ChatMessage[] = [
    { from: null, text: 'Spectator chat has been enabled by the host', timestamp: 1000 },
  ];
  render(
    <ChatPanel messages={msgs} onSend={vi.fn()} isOpen={true} onToggle={vi.fn()} unreadCount={0} />,
  );
  expect(screen.getByText('Spectator chat has been enabled by the host')).toBeInTheDocument();
});

it('shows host toggle when isHost is true', () => {
  render(
    <ChatPanel
      messages={[]}
      onSend={vi.fn()}
      isOpen={true}
      onToggle={vi.fn()}
      unreadCount={0}
      isHost={true}
      spectatorChatEnabled={false}
      onToggleSpectatorChat={vi.fn()}
    />,
  );
  expect(screen.getByLabelText('Toggle spectator chat')).toBeInTheDocument();
});

it('does not show host toggle when isHost is false', () => {
  render(
    <ChatPanel messages={[]} onSend={vi.fn()} isOpen={true} onToggle={vi.fn()} unreadCount={0} />,
  );
  expect(screen.queryByLabelText('Toggle spectator chat')).not.toBeInTheDocument();
});

it('shows input for spectator when spectator chat is enabled', () => {
  render(
    <ChatPanel
      messages={[]}
      onSend={vi.fn()}
      isOpen={true}
      onToggle={vi.fn()}
      unreadCount={0}
      isSpectator={true}
      spectatorChatEnabled={true}
    />,
  );
  expect(screen.getByLabelText('Chat message')).toBeInTheDocument();
});

it('hides input for spectator when spectator chat is disabled', () => {
  render(
    <ChatPanel
      messages={[]}
      onSend={vi.fn()}
      isOpen={true}
      onToggle={vi.fn()}
      unreadCount={0}
      isSpectator={true}
      spectatorChatEnabled={false}
    />,
  );
  expect(screen.queryByLabelText('Chat message')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd code && pnpm --filter @tichu/client test -- --run ChatPanel`
Expected: New tests fail

- [ ] **Step 3: Update ChatPanel props and rendering**

Replace the full `ChatPanel.tsx` with updated version. Key changes:

Add new props to `ChatPanelProps`:

```typescript
export interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  unreadCount: number;
  seatNames?: Record<Seat, string>;
  readOnly?: boolean;
  isHost?: boolean;
  isSpectator?: boolean;
  spectatorChatEnabled?: boolean;
  onToggleSpectatorChat?: () => void;
}
```

Update the destructured props:

```typescript
export const ChatPanel = memo(function ChatPanel({
  messages,
  onSend,
  isOpen,
  onToggle,
  unreadCount,
  seatNames,
  readOnly = false,
  isHost = false,
  isSpectator = false,
  spectatorChatEnabled = false,
  onToggleSpectatorChat,
}: ChatPanelProps) {
```

Compute effective readOnly:

```typescript
// Spectators can type when spectator chat is enabled; players always can
const effectiveReadOnly = isSpectator ? !spectatorChatEnabled : readOnly;
```

Add host toggle in the header (after the `<span className={styles.headerTitle}>Chat</span>`):

```tsx
{isHost && onToggleSpectatorChat && (
  <label className={styles.spectatorToggle} aria-label="Toggle spectator chat">
    <input
      type="checkbox"
      checked={spectatorChatEnabled}
      onChange={onToggleSpectatorChat}
    />
    <span className={styles.spectatorToggleLabel}>Spectator Chat</span>
  </label>
)}
```

Update message rendering to handle `from: null`:

```tsx
{messages.map((msg, i) => {
  if (msg.from === null && msg.spectatorName) {
    // Spectator message
    return (
      <div key={i} className={`${styles.message} ${styles.spectatorMessage}`}>
        <span className={styles.spectatorSender}>{msg.spectatorName} (spectator)</span>
        <span className={styles.messageText}>{msg.text}</span>
      </div>
    );
  }
  if (msg.from === null) {
    // System message
    return (
      <div key={i} className={styles.systemMessage}>
        <span className={styles.systemText}>{msg.text}</span>
      </div>
    );
  }
  // Player message (existing)
  return (
    <div key={i} className={styles.message}>
      <span className={styles.sender}>{seatNames?.[msg.from] ?? SEAT_LABELS[msg.from]}</span>
      <span className={styles.messageText}>{msg.text}</span>
    </div>
  );
})}
```

Replace `{!readOnly && (` with `{!effectiveReadOnly && (` for the input form.

- [ ] **Step 4: Add CSS styles for spectator/system messages and host toggle**

Add to `code/packages/client/src/components/game/ChatPanel.module.css`:

```css
/* Spectator chat toggle in header */
.spectatorToggle {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  cursor: pointer;
  font-size: var(--font-base);
}

.spectatorToggleLabel {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
  white-space: nowrap;
}

/* Spectator message styling */
.spectatorMessage {
  opacity: 0.85;
}

.spectatorSender {
  font-size: var(--font-base);
  font-weight: 700;
  font-style: italic;
  color: var(--color-text-muted);
  margin-right: var(--space-1);
}

/* System message styling */
.systemMessage {
  padding: var(--space-1) 0;
  text-align: center;
}

.systemText {
  font-size: var(--font-sm);
  color: var(--color-text-muted);
  font-style: italic;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd code && pnpm --filter @tichu/client test -- --run ChatPanel`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add code/packages/client/src/components/game/ChatPanel.tsx code/packages/client/src/components/game/ChatPanel.module.css code/packages/client/tests/components/game/ChatPanel.test.tsx
git commit -m "feat(client): add spectator/system message rendering and host toggle to ChatPanel"
```

---

### Task 8: Wire up ChatPanel props in game view and handle CHAT_RECEIVED changes

**Files:**
- Modify: `code/packages/client/src/app/game/[gameId]/page.tsx`

- [ ] **Step 1: Update CHAT_RECEIVED handler to pass new fields**

In `code/packages/client/src/app/game/[gameId]/page.tsx`, update the `CHAT_RECEIVED` handler (around line 150-156):

```typescript
} else if (msg.type === 'CHAT_RECEIVED') {
  // REQ-F-MP07: Chat message received — SC-04: spectator + system messages
  uiStore.addChatMessage({
    from: (msg.from as Seat | null),
    text: msg.text as string,
    timestamp: Date.now(),
    spectatorName: (msg as Record<string, unknown>).spectatorName as string | undefined,
  });
}
```

- [ ] **Step 2: Pass new props to ChatPanel in game view**

Find the `<ChatPanel` usage around line 1574. Update it to:

```tsx
<ChatPanel
  messages={uiStore.chatMessages}
  onSend={handleChatSend}
  isOpen={uiStore.chatOpen}
  onToggle={uiStore.toggleChat}
  unreadCount={uiStore.chatUnread}
  seatNames={seatNames}
  readOnly={false}
  isHost={mySeatFromRoom === hostSeat}
  isSpectator={isSpectator}
  spectatorChatEnabled={roomStore.config?.spectatorChatEnabled ?? false}
  onToggleSpectatorChat={() => send({
    type: 'CONFIGURE_ROOM',
    config: { spectatorChatEnabled: !(roomStore.config?.spectatorChatEnabled ?? false) },
  })}
/>
```

Note: Need to import `useRoomStore` state. Check if `hostSeat` and `roomStore` are already accessible — `hostSeat` comes from `useRoomStore((s) => s.hostSeat)` and the config can be accessed via `useRoomStore.getState()` or a selector. Look at existing patterns in the file.

Also find the second ChatPanel instance (if there's one in PreRoomView rendering path around line 1594) and update similarly.

- [ ] **Step 3: Build client to verify**

Run: `cd code && pnpm --filter @tichu/client build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add code/packages/client/src/app/game/[gameId]/page.tsx
git commit -m "feat(client): wire spectator chat props to ChatPanel in game view"
```

---

### Task 9: Add spectator chat toggle to CreateGamePopup and PreRoomView

**Files:**
- Modify: `code/packages/client/src/components/lobby/CreateGamePopup.tsx`
- Modify: `code/packages/client/src/components/game/PreRoomView.tsx`

- [ ] **Step 1: Add toggle to CreateGamePopup**

In `code/packages/client/src/components/lobby/CreateGamePopup.tsx`:

Add `spectatorChatEnabled` to `CreateGameConfig` interface:

```typescript
export interface CreateGameConfig {
  targetScore: number;
  turnTimerSeconds: 30 | 60 | 90 | null;
  isPrivate: boolean;
  spectatorsAllowed: boolean;
  spectatorChatEnabled: boolean;
}
```

Add to `DEFAULTS`:

```typescript
const DEFAULTS: CreateGameConfig = {
  targetScore: 1000,
  turnTimerSeconds: null,
  isPrivate: false,
  spectatorsAllowed: true,
  spectatorChatEnabled: false,
};
```

Add checkbox after the "Allow Spectators" checkbox (after line 96, before the closing `</div>` of the grid):

```tsx
{/* Spectator Chat */}
<label className={styles.checkboxRow}>
  <input
    type="checkbox"
    checked={config.spectatorChatEnabled}
    onChange={(e) => setConfig({ ...config, spectatorChatEnabled: e.target.checked })}
  />
  <span className={styles.checkboxLabel}>Spectator Chat</span>
</label>
```

- [ ] **Step 2: Add toggle to PreRoomView settings panel**

In `code/packages/client/src/components/game/PreRoomView.tsx`:

Add to the host editable settings (after the Spectators checkbox, around line 755):

```tsx
<label className={styles.settingsCheckRow}>
  <input
    type="checkbox"
    checked={config.spectatorChatEnabled}
    onChange={(e) => handleConfigChange({ spectatorChatEnabled: e.target.checked })}
  />
  <span className={styles.settingsCheckLabel}>Spectator Chat</span>
</label>
```

Add to the read-only summary (after line 762):

```tsx
<span>Spectator Chat: {config.spectatorChatEnabled ? 'Yes' : 'No'}</span>
```

- [ ] **Step 3: Build client**

Run: `cd code && pnpm --filter @tichu/client build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add code/packages/client/src/components/lobby/CreateGamePopup.tsx code/packages/client/src/components/game/PreRoomView.tsx
git commit -m "feat(client): add spectator chat toggle to game creation and pre-room settings"
```

---

### Task 10: Full build, typecheck, lint, and test pass

**Files:** None (verification only)

- [ ] **Step 1: Build all packages**

Run: `cd code && pnpm build`
Expected: All packages build successfully

- [ ] **Step 2: Run typecheck**

Run: `cd code && pnpm typecheck`
Expected: No type errors

- [ ] **Step 3: Run lint**

Run: `cd code && pnpm lint`
Expected: No lint errors (or only pre-existing ones)

- [ ] **Step 4: Run all tests**

Run: `cd code && pnpm test`
Expected: All tests pass

- [ ] **Step 5: Fix any issues found, then commit**

If any issues found, fix them and commit:

```bash
git commit -m "fix: resolve build/lint/test issues from spectator chat feature"
```
