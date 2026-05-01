# Disconnect & Room Lifecycle Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Differentiate disconnect/leave behavior based on game composition — solo-human games get a 3-day freeze, multi-human games get a 3-minute grace.

**Architecture:** Add a human participant history set to `GameManager` (populated at game start and on mid-game seat claims). Pass the game type to `DisconnectHandler` per-disconnect so it selects the right timeout. Gate bot actions on a `isFrozen()` check for solo-human pauses. On grace expiry, destroy the room if no humans are currently seated or in grace.

**Tech Stack:** TypeScript, Vitest, XState (existing game state machine)

**Key design insight:** Voluntary leave already works correctly for both game types. When the last human voluntarily leaves, `roomManager.leaveRoom()` auto-destroys the room (room-manager.ts:142-145), which returns `room: null`, triggering the existing room-handler cleanup path (room-handler.ts:243-268) that notifies spectators, cleans up queues, and destroys the game. No changes needed for voluntary leave.

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `code/packages/server/src/game/disconnect-handler.ts` | Accept per-disconnect timeout; expose freeze status |
| Modify | `code/packages/server/src/game/game-manager.ts` | Human participant history; pass game type to disconnect handler; gate bots on freeze |
| Modify | `code/packages/server/src/game/game-serializer.ts` | Add `humanParticipants` to `GameSnapshot` |
| Modify | `code/packages/server/src/room/room-handler.ts` | Grace expiry → destroy room if no humans remain |
| Modify | `code/packages/server/src/room/room-manager.ts` | Add public `forceDestroyRoom` method |
| Modify | `code/packages/server/tests/game/disconnect-handler.test.ts` | Tests for variable timeout, freeze semantics |
| Create | `code/packages/server/tests/game/game-manager-participants.test.ts` | Tests for participant tracking and `isMultiHuman()` |

---

### Task 1: DisconnectHandler — Variable Timeout Per Disconnect

**Files:**
- Modify: `code/packages/server/src/game/disconnect-handler.ts`
- Modify: `code/packages/server/tests/game/disconnect-handler.test.ts`

The disconnect handler currently uses a single `graceTimeoutMs` for all disconnects. We need it to accept a timeout per `handleDisconnect` call and expose whether a room is in a frozen (solo-human pause) state.

- [ ] **Step 1: Write failing tests for variable timeout**

Add to `code/packages/server/tests/game/disconnect-handler.test.ts`:

```typescript
describe('variable grace timeout', () => {
  it('uses the per-disconnect timeout instead of the constructor default', () => {
    const onResult = vi.fn();
    handler.onVoteResult = onResult;
    // Default is 60_000 but we pass 5_000 per-call
    handler.handleDisconnect('ROOM1', 'north', { graceTimeoutMs: 5_000 });

    vi.advanceTimersByTime(4_999);
    expect(onResult).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onResult).toHaveBeenCalledWith('ROOM1', 'kick', ['north']);
  });

  it('uses the constructor default when no per-call timeout is provided', () => {
    const onResult = vi.fn();
    handler.onVoteResult = onResult;
    handler.handleDisconnect('ROOM1', 'north');

    vi.advanceTimersByTime(60_000);
    expect(onResult).toHaveBeenCalledWith('ROOM1', 'kick', ['north']);
  });

  it('a second disconnect in the same room does not reset the timer', () => {
    const onResult = vi.fn();
    handler.onVoteResult = onResult;
    handler.handleDisconnect('ROOM1', 'north', { graceTimeoutMs: 10_000 });

    vi.advanceTimersByTime(5_000);
    // Second disconnect merges into existing session — original timer stands
    handler.handleDisconnect('ROOM1', 'east', { graceTimeoutMs: 20_000 });

    vi.advanceTimersByTime(5_000); // 10s total from first disconnect
    expect(onResult).toHaveBeenCalledWith(
      'ROOM1',
      'kick',
      expect.arrayContaining(['north', 'east']),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd code && pnpm --filter @tichu/server test -- --run tests/game/disconnect-handler.test.ts`
Expected: FAIL — `handleDisconnect` does not accept an options parameter

- [ ] **Step 3: Write failing tests for freeze status**

Add to `code/packages/server/tests/game/disconnect-handler.test.ts`:

```typescript
describe('freeze status (solo-human pause)', () => {
  it('isFrozen returns true when frozen flag was passed', () => {
    handler.handleDisconnect('ROOM1', 'north', { graceTimeoutMs: 5_000, frozen: true });
    expect(handler.isFrozen('ROOM1')).toBe(true);
  });

  it('isFrozen returns false for a normal (non-frozen) disconnect', () => {
    handler.handleDisconnect('ROOM1', 'north', { graceTimeoutMs: 5_000 });
    expect(handler.isFrozen('ROOM1')).toBe(false);
  });

  it('isFrozen returns false when no session exists', () => {
    expect(handler.isFrozen('ROOM1')).toBe(false);
  });

  it('isFrozen returns false after reconnect clears the session', () => {
    handler.handleDisconnect('ROOM1', 'north', { graceTimeoutMs: 5_000, frozen: true });
    handler.handleReconnect('ROOM1', 'north');
    expect(handler.isFrozen('ROOM1')).toBe(false);
  });

  it('isFrozen returns false after grace expiry', () => {
    handler.handleDisconnect('ROOM1', 'north', { graceTimeoutMs: 5_000, frozen: true });
    vi.advanceTimersByTime(5_000);
    expect(handler.isFrozen('ROOM1')).toBe(false);
  });

  it('isFrozen returns false after cleanupRoom', () => {
    handler.handleDisconnect('ROOM1', 'north', { graceTimeoutMs: 5_000, frozen: true });
    handler.cleanupRoom('ROOM1');
    expect(handler.isFrozen('ROOM1')).toBe(false);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd code && pnpm --filter @tichu/server test -- --run tests/game/disconnect-handler.test.ts`
Expected: FAIL — `isFrozen` does not exist

- [ ] **Step 5: Implement variable timeout and freeze status**

In `code/packages/server/src/game/disconnect-handler.ts`:

1. Add an options type for `handleDisconnect` (after the `VoteOutcome` type):

```typescript
/** Options for a single disconnect event. */
export interface DisconnectOptions {
  /** Override the grace timeout for this specific disconnect (ms). */
  graceTimeoutMs?: number;
  /** If true, the game is frozen (solo-human pause) — bots should not act. */
  frozen?: boolean;
}
```

2. Update `GraceSession` to include `frozen` and `timeoutMs`:

```typescript
interface GraceSession {
  /** REQ-F-SJ12: All disconnected seats currently under grace in this room. */
  disconnectedSeats: Set<Seat>;
  /** Timeout handle for the grace expiry. */
  timeoutHandle: ReturnType<typeof setTimeout>;
  /** Wall-clock start time — used to compute remaining time for projection. */
  startedAt: number;
  /** True when this session represents a solo-human freeze. */
  frozen: boolean;
  /** The timeout duration for this specific session (ms). */
  timeoutMs: number;
}
```

3. Update `handleDisconnect` signature to accept options:

```typescript
handleDisconnect(roomCode: string, seat: Seat, options?: DisconnectOptions): void {
  if (!this.disconnected.has(roomCode)) {
    this.disconnected.set(roomCode, new Set());
  }
  this.disconnected.get(roomCode)!.add(seat);

  this.broadcaster.broadcastToRoom(roomCode, {
    type: 'PLAYER_DISCONNECTED',
    seat,
  });

  const existing = this.sessions.get(roomCode);
  if (existing) {
    existing.disconnectedSeats.add(seat);
  } else {
    this.startGrace(
      roomCode,
      seat,
      options?.graceTimeoutMs ?? this.graceTimeoutMs,
      options?.frozen ?? false,
    );
  }
}
```

4. Update `startGrace` to accept timeout and frozen:

```typescript
private startGrace(roomCode: string, seat: Seat, timeoutMs: number, frozen: boolean): void {
  const timeoutHandle = setTimeout(() => {
    this.expireGrace(roomCode);
  }, timeoutMs);

  this.sessions.set(roomCode, {
    disconnectedSeats: new Set([seat]),
    timeoutHandle,
    startedAt: Date.now(),
    frozen,
    timeoutMs,
  });
}
```

5. In `getVoteStatus`, replace `this.graceTimeoutMs` with session-level timeout:

```typescript
const remaining = Math.max(0, session.timeoutMs - elapsed);
```

6. Add `isFrozen` method:

```typescript
/** True when `roomCode` is in a solo-human freeze (game fully paused). */
isFrozen(roomCode: string): boolean {
  return this.sessions.get(roomCode)?.frozen ?? false;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd code && pnpm --filter @tichu/server test -- --run tests/game/disconnect-handler.test.ts`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add code/packages/server/src/game/disconnect-handler.ts code/packages/server/tests/game/disconnect-handler.test.ts
git commit -m "feat(server): variable grace timeout and freeze status in DisconnectHandler"
```

---

### Task 2: GameManager — Human Participant History

**Files:**
- Modify: `code/packages/server/src/game/game-manager.ts`
- Create: `code/packages/server/tests/game/game-manager-participants.test.ts`

Track which humans have sat in any seat while the game is active. Expose `isMultiHuman()` and `addHumanParticipant()`.

- [ ] **Step 1: Write failing tests for participant tracking**

Create `code/packages/server/tests/game/game-manager-participants.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GameManager } from '../../src/game/game-manager.js';
import type { Broadcaster } from '../../src/ws/broadcaster.js';
import { DisconnectHandler } from '../../src/game/disconnect-handler.js';
import { VoteHandler } from '../../src/game/vote-handler.js';

function createMockBroadcaster(): Broadcaster {
  return {
    send: vi.fn().mockReturnValue(true),
    sendToPlayer: vi.fn().mockReturnValue(true),
    broadcastToRoom: vi.fn().mockReturnValue(3),
    broadcastGameState: vi.fn().mockReturnValue(4),
    broadcastToSpectators: vi.fn().mockReturnValue(0),
    sendError: vi.fn().mockReturnValue(true),
    sendSeatClaimRejected: vi.fn().mockReturnValue(true),
  } as unknown as Broadcaster;
}

describe('GameManager — human participant history', () => {
  let game: GameManager;
  let broadcaster: Broadcaster;
  let disconnectHandler: DisconnectHandler;
  let voteHandler: VoteHandler;

  beforeEach(() => {
    broadcaster = createMockBroadcaster();
    disconnectHandler = new DisconnectHandler(broadcaster);
    voteHandler = new VoteHandler(broadcaster);
    game = new GameManager('1', 'ROOM1', broadcaster, disconnectHandler, voteHandler);
  });

  afterEach(() => {
    game.destroy();
    disconnectHandler.dispose();
  });

  it('isMultiHuman returns false initially', () => {
    expect(game.isMultiHuman()).toBe(false);
  });

  it('isMultiHuman returns false with one human participant', () => {
    game.addHumanParticipant('user-1');
    expect(game.isMultiHuman()).toBe(false);
  });

  it('isMultiHuman returns true with two distinct human participants', () => {
    game.addHumanParticipant('user-1');
    game.addHumanParticipant('user-2');
    expect(game.isMultiHuman()).toBe(true);
  });

  it('adding the same user twice does not double-count', () => {
    game.addHumanParticipant('user-1');
    game.addHumanParticipant('user-1');
    expect(game.isMultiHuman()).toBe(false);
  });

  it('isMultiHuman remains true even after more humans are added', () => {
    game.addHumanParticipant('user-1');
    game.addHumanParticipant('user-2');
    game.addHumanParticipant('user-3');
    expect(game.isMultiHuman()).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd code && pnpm --filter @tichu/server test -- --run tests/game/game-manager-participants.test.ts`
Expected: FAIL — `addHumanParticipant` and `isMultiHuman` do not exist

- [ ] **Step 3: Implement participant tracking on GameManager**

In `code/packages/server/src/game/game-manager.ts`:

1. Add the field after the existing `joinedAfterSpectating` field (around line 95):

```typescript
/** Human user IDs who have occupied a seat while the game is active. */
private readonly humanParticipants = new Set<string>();
```

2. Add public methods after `markJoinedAfterSpectating` (around line 342):

```typescript
/** Record a human user as having participated in this game. */
addHumanParticipant(userId: string): void {
  this.humanParticipants.add(userId);
}

/** True when 2+ distinct humans have occupied seats during this game. */
isMultiHuman(): boolean {
  return this.humanParticipants.size >= 2;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd code && pnpm --filter @tichu/server test -- --run tests/game/game-manager-participants.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add code/packages/server/src/game/game-manager.ts code/packages/server/tests/game/game-manager-participants.test.ts
git commit -m "feat(server): human participant history tracking on GameManager"
```

---

### Task 3: Populate Participant History at Game Start and Mid-Game Seat Claims

**Files:**
- Modify: `code/packages/server/src/room/room-handler.ts:678-690` (startGameInternal)
- Modify: `code/packages/server/src/room/room-handler.ts` (seat queue completion — wherever `game.handleSeatFilled` is called for a human)

- [ ] **Step 1: Add participant registration at game start**

In `code/packages/server/src/room/room-handler.ts`, in the `startGameInternal` method (around line 678-690), add `game.addHumanParticipant(userId)` inside the `if (!player.isBot)` block, right after the userId check succeeds.

Find this code:
```typescript
if (!player.isBot) {
  const userId = this.roomManager.getUserIdAtSeat(roomCode, player.seat);
  if (userId) {
    for (const playerWs of this.connections.getSocketsByUserId(userId)) {
```

Change to:
```typescript
if (!player.isBot) {
  const userId = this.roomManager.getUserIdAtSeat(roomCode, player.seat);
  if (userId) {
    game.addHumanParticipant(userId);
    for (const playerWs of this.connections.getSocketsByUserId(userId)) {
```

- [ ] **Step 2: Find and update mid-game seat claim paths**

Search for all call sites of `game.handleSeatFilled` in `room-handler.ts`. For each site where a human (not bot) fills a seat during an active game, add `game.addHumanParticipant(userId)` immediately before the `handleSeatFilled` call. The userId should already be available in the surrounding code (it's needed to wire the WebSocket).

Also check the reconnection path in `app.ts` (where `game.handleReconnect` is called) — but reconnection within grace doesn't change the seat occupant, so it shouldn't need registration (the human was already registered at game start).

- [ ] **Step 3: Run the full test suite to check for regressions**

Run: `cd code && pnpm --filter @tichu/server test -- --run`
Expected: All existing tests PASS

- [ ] **Step 4: Commit**

```bash
git add code/packages/server/src/room/room-handler.ts
git commit -m "feat(server): populate human participant history at game start and mid-game seat claims"
```

---

### Task 4: GameManager — Pass Game Type to DisconnectHandler

**Files:**
- Modify: `code/packages/server/src/game/game-manager.ts:251-262` (handleDisconnect)

Wire `handleDisconnect` to pass the correct timeout and freeze flag based on `isMultiHuman()`.

- [ ] **Step 1: Add constants at the top of game-manager.ts**

After the imports (around line 53), add:

```typescript
/** Grace period for involuntary disconnect in a multi-human game (3 minutes). */
const MULTI_HUMAN_GRACE_MS = 180_000;
/** Grace period for involuntary disconnect in a solo-human game (3 days). */
const SOLO_HUMAN_GRACE_MS = 259_200_000;
```

- [ ] **Step 2: Update handleDisconnect to pass game type**

Replace the body of the `handleDisconnect` method (lines 251-262):

```typescript
handleDisconnect(seat: Seat): void {
  this.timer.stop();
  // REQ-F-PV26/PV27: Cancel active player vote if initiator or target disconnects
  const activeVote = this.voteHandler.getActiveVote(this.roomCode);
  if (activeVote) {
    if (activeVote.initiatorSeat === seat || activeVote.targetSeat === seat) {
      this.voteHandler.cancelVote(this.roomCode);
    }
  }

  const multiHuman = this.isMultiHuman();
  this.disconnectHandler.handleDisconnect(this.roomCode, seat, {
    graceTimeoutMs: multiHuman ? MULTI_HUMAN_GRACE_MS : SOLO_HUMAN_GRACE_MS,
    frozen: !multiHuman,
  });

  this.broadcastState();
}
```

- [ ] **Step 3: Run tests to check for regressions**

Run: `cd code && pnpm --filter @tichu/server test -- --run`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add code/packages/server/src/game/game-manager.ts
git commit -m "feat(server): pass game-type-aware timeout and freeze flag to DisconnectHandler"
```

---

### Task 5: Gate Bot Actions During Solo-Human Freeze

**Files:**
- Modify: `code/packages/server/src/game/game-manager.ts:543-706` (onStateChange)

When the game is frozen (solo-human disconnect), bots must not act and timers must not advance.

- [ ] **Step 1: Add freeze gate in onStateChange**

In `code/packages/server/src/game/game-manager.ts`, in the `onStateChange` method, add a freeze check right after the existing vacated-seats early return (lines 569-574):

After:
```typescript
// Game pauses when any seat is vacated — stop timer and don't trigger bot actions
if (this.vacatedSeats.size > 0) {
  this.timer.stop();
  this.broadcastState();
  return;
}
```

Add:
```typescript
// Game freezes when in solo-human pause — stop timer and don't trigger bot actions
if (this.disconnectHandler.isFrozen(this.roomCode)) {
  this.timer.stop();
  this.broadcastState();
  return;
}
```

- [ ] **Step 2: Run existing tests to check for regressions**

Run: `cd code && pnpm --filter @tichu/server test -- --run`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add code/packages/server/src/game/game-manager.ts
git commit -m "feat(server): gate bot actions and timers during solo-human freeze"
```

---

### Task 6: RoomManager — Add Public `forceDestroyRoom` Method

**Files:**
- Modify: `code/packages/server/src/room/room-manager.ts`

The existing `destroyRoom` is private. The room-handler needs to destroy rooms when grace expires and no humans remain. Add a public wrapper.

- [ ] **Step 1: Add public `forceDestroyRoom` method**

In `code/packages/server/src/room/room-manager.ts`, add a public method that delegates to the existing private `destroyRoom` (around line 657):

```typescript
/** Force-destroy a room — used when disconnect grace expires and no humans remain. */
forceDestroyRoom(roomCode: string): void {
  if (!this.rooms.has(roomCode)) return;
  this.destroyRoom(roomCode);
}
```

- [ ] **Step 2: Run tests to check for regressions**

Run: `cd code && pnpm --filter @tichu/server test -- --run`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add code/packages/server/src/room/room-manager.ts
git commit -m "feat(server): add public forceDestroyRoom method on RoomManager"
```

---

### Task 7: Room Handler — Grace Expiry Destroys Room When No Humans Remain

**Files:**
- Modify: `code/packages/server/src/room/room-handler.ts:710-715` (wireKickCallback in wireGameCallbacks)

When the grace period expires and no humans are currently seated (excluding the seats being released) or in grace (excluding the seats being released), destroy the room.

- [ ] **Step 1: Update wireKickCallback to check for remaining humans**

In `code/packages/server/src/room/room-handler.ts`, in `wireGameCallbacks` (line 712), replace the wireKickCallback block:

```typescript
game.wireKickCallback((rc, seats) => {
  // Check if any humans are still seated or in grace (excluding the seats being released)
  const room = this.roomManager.getRoom(rc);
  const disconnectedSeats = game.getDisconnectHandler().getDisconnectedSeats(rc);
  const hasHumanSeated = room?.players.some(
    p => !p.isBot && !seats.includes(p.seat),
  ) ?? false;
  const hasHumanInGrace = disconnectedSeats.some(s => !seats.includes(s));

  if (!hasHumanSeated && !hasHumanInGrace) {
    // No humans left — destroy room and game
    const spectators = this.roomManager.getSpectatorUserIds(rc);
    for (const spectatorId of spectators) {
      for (const specWs of this.connections.getSocketsByUserId(spectatorId)) {
        this.broadcaster.send(specWs, {
          type: 'ROOM_CLOSED',
          message: 'All players have disconnected. The room has been closed.',
        });
        this.connections.removeFromRoom(specWs);
      }
    }
    const queue = this.seatQueues.get(rc);
    if (queue) {
      queue.cleanup();
      this.seatQueues.delete(rc);
    }
    this.gameStore.destroyGameByRoom(rc);
    this.roomManager.forceDestroyRoom(rc);
    return;
  }

  // Humans remain — vacate seats and start queue as before
  this.tryStartSeatQueue(rc, seats);
  this.broadcastRoomUpdate(rc);
});
```

- [ ] **Step 2: Run tests to check for regressions**

Run: `cd code && pnpm --filter @tichu/server test -- --run`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add code/packages/server/src/room/room-handler.ts
git commit -m "feat(server): destroy room on grace expiry when no humans remain"
```

---

### Task 8: Serialize/Restore — Persist Human Participants

**Files:**
- Modify: `code/packages/server/src/game/game-serializer.ts:93-105` (GameSnapshot)
- Modify: `code/packages/server/src/game/game-manager.ts` (serialize and restore)

The `humanParticipants` set must survive game snapshots (used for active game persistence on graceful restart).

- [ ] **Step 1: Add `humanParticipants` to GameSnapshot**

In `code/packages/server/src/game/game-serializer.ts`, add `humanParticipants: string[];` to the `GameSnapshot` interface, after `joinedAfterSpectating`:

```typescript
export interface GameSnapshot {
  gameId: string;
  roomCode: string;
  machineSnapshot: unknown;
  vacatedSeats: Seat[];
  choosingSeats: Seat[];
  joinedAfterSpectating: string[];
  humanParticipants: string[];
  endOfTrickBombWindowEndTime: number | null;
  timerState: TimerSnapshot | null;
  botSeats: Seat[];
  botStates: Record<string, BotSnapshot>;
  config: GameConfig;
}
```

- [ ] **Step 2: Update GameManager.serialize()**

In `code/packages/server/src/game/game-manager.ts`, in the `serialize` method (around line 890), add `humanParticipants: [...this.humanParticipants],` after the `joinedAfterSpectating` line in the return object.

- [ ] **Step 3: Update GameManager.restore()**

In the `restore` static method (around line 975), after restoring `joinedAfterSpectating`, add:

```typescript
(instance as unknown as { humanParticipants: Set<string> }).humanParticipants =
  new Set(snapshot.humanParticipants ?? []);
```

The `?? []` provides backwards compatibility with snapshots saved before this change.

- [ ] **Step 4: Run the serializer and restore tests**

Run: `cd code && pnpm --filter @tichu/server test -- --run tests/game/game-serializer.test.ts tests/game/serialize-restore.test.ts tests/integration/graceful-restart.test.ts`
Expected: All PASS (may need to update test fixtures if they construct `GameSnapshot` objects directly)

- [ ] **Step 5: Run the full test suite**

Run: `cd code && pnpm --filter @tichu/server test -- --run`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add code/packages/server/src/game/game-serializer.ts code/packages/server/src/game/game-manager.ts
git commit -m "feat(server): serialize/restore human participant history in game snapshots"
```

---

### Task 9: Final Verification

- [ ] **Step 1: Run full project build**

Run: `cd code && pnpm build`
Expected: Build succeeds

- [ ] **Step 2: Run full test suite**

Run: `cd code && pnpm test`
Expected: All tests pass

- [ ] **Step 3: Run typecheck across all packages**

Run: `cd code && pnpm typecheck`
Expected: No type errors

- [ ] **Step 4: Run lint**

Run: `cd code && pnpm lint`
Expected: No lint errors
