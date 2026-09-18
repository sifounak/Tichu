# Implementation Plan: Reliable Action Delivery

## Context

On unreliable networks, the current fire-and-forget WebSocket sends silently fail. The client clears UI state optimistically but the server never receives the message, leaving the player stuck. This feature adds client-side retry with server-side ACK/NACK and idempotency so player actions are guaranteed to reach the server without risk of duplicate execution.

Specification: `specifications/2026-05-18-reliable-action-delivery.md`

---

## Milestone 1: Protocol Layer (Shared Package)

**Goal:** Add optional `messageId` to all client messages; add `ACK`/`NACK` server message types.

**Requirements:** REQ-F-RAD01, REQ-F-RAD03, REQ-F-RAD04

**Files to modify:**
- `code/packages/shared/src/types/protocol.ts`

**Implementation:**

1. Add `messageId: z.string().optional()` to each of the 37 `z.object()` entries in `clientMessageSchema` (lines 37–107). This preserves the discriminated union on `type` and keeps backward compat.

2. Add two new entries to `serverMessageSchema` (before the ERROR entry):
   ```typescript
   z.object({ type: z.literal('ACK'), messageId: z.string() }),
   z.object({ type: z.literal('NACK'), messageId: z.string(), code: z.string(), message: z.string() }),
   ```

3. `ClientMessage` and `ServerMessage` types auto-update via `z.infer`.

**Tests:** Validate messages with/without messageId pass; validate ACK/NACK shapes.

---

## Milestone 2: Server-Side ACK/NACK + Idempotency Map

**Goal:** Server acknowledges processed messages and prevents duplicate execution.

**Requirements:** REQ-F-RAD03, REQ-F-RAD04, REQ-F-RAD06, REQ-NF-RAD01, REQ-NF-RAD02

**Files to create:**
- `code/packages/server/src/ws/idempotency-map.ts`

**Files to modify:**
- `code/packages/server/src/ws/message-router.ts`
- `code/packages/server/src/ws/broadcaster.ts`
- `code/packages/server/src/ws/index.ts`
- `code/packages/server/src/app.ts` (wire idempotency map, cleanup on room destroy)

**Implementation:**

1. **IdempotencyMap** class:
   - `Map<string, Map<string, { result: 'ack'|'nack'; code?: string; msg?: string; expiresAt: number }>>`
   - Keyed by roomCode → messageId → entry
   - For non-room messages (CREATE_ROOM, JOIN_ROOM, GET_LOBBY): use a global `'__lobby'` key
   - Max 1000 entries per room; evict oldest on overflow
   - TTL 60s; periodic cleanup every 10s via `setInterval`
   - `removeRoom(roomCode)` for cleanup on room destruction
   - `dispose()` to clear the interval

2. **MessageRouter** changes:
   - Accept `IdempotencyMap` in constructor
   - After Zod validation, extract `messageId` from `message`
   - Determine room context: `connections.getClientInfo(ws)?.roomCode ?? '__lobby'`
   - If `messageId` present:
     - Check idempotency map → if hit, replay stored ACK/NACK, return
     - Otherwise: wrap handler execution in try/catch
       - Success → store ACK, send `{ type: 'ACK', messageId }`
       - Handler throws → store NACK, send `{ type: 'NACK', messageId, code: 'HANDLER_ERROR', message }`
   - If no `messageId` → current behavior unchanged (no ACK sent)
   - Exception: `HEARTBEAT_PONG` — never ACK (even with messageId), skip idempotency

3. **Broadcaster** — add `sendAck(ws, messageId)` and `sendNack(ws, messageId, code, msg)` helpers.

4. **Error-path NACK:** The existing `sendError()` calls for INVALID_JSON, INVALID_MESSAGE, NOT_AUTHENTICATED, UNKNOWN_TYPE should also send NACK if messageId was present in the raw parsed JSON (extract before Zod validation fails).

**Tests:** IdempotencyMap unit tests (TTL, max cap, room isolation). MessageRouter tests (ACK on success, NACK on error, replay on duplicate, no ACK without messageId).

---

## Milestone 3: Client PendingActionManager + Hook Integration

**Goal:** Client tracks pending actions with retry, handles ACK/NACK, retries on reconnect.

**Requirements:** REQ-F-RAD01, REQ-F-RAD02, REQ-F-RAD05, REQ-F-RAD09, REQ-F-RAD10, REQ-F-RAD11, REQ-F-RAD12, REQ-F-RAD13, REQ-NF-RAD03

**Files to create:**
- `code/packages/client/src/services/PendingActionManager.ts`

**Files to modify:**
- `code/packages/client/src/hooks/useWebSocket.ts`

**Implementation:**

1. **PendingActionManager** (pure TS class, no React dependency):
   ```typescript
   interface PendingAction {
     messageId: string;
     payload: ClientMessage & { messageId: string };
     sentAt: number;
     retryCount: number;
     retryTimer: ReturnType<typeof setTimeout> | null;
     spinnerTimer: ReturnType<typeof setTimeout> | null;
     snapshot?: UISnapshot;
   }
   ```
   - `submit(message, snapshot?)` — generate `crypto.randomUUID()`, attach as `messageId`, send, start retry chain (2s/4s/6s) and spinner timer (3s)
   - `handleAck(messageId)` — clear timers, remove from map, call `onResolved('ack', messageId)`
   - `handleNack(messageId, code, msg)` — clear timers, remove from map, call `onResolved('nack', messageId, code, msg)`
   - `retryAll()` — reset sentAt, immediately re-send all pending (called on reconnect)
   - `cancelAll()` — clear all timers, clear map (called on intentional disconnect)
   - Callbacks injected: `rawSend(payload): boolean`, `onSpinnerNeeded(messageId)`, `onResolved(result, messageId, ...)`

2. **useWebSocket changes:**
   - Instantiate `PendingActionManager` in a `useRef`
   - New internal `rawSend(msg)` that does the actual ws.send (current `send` logic)
   - Public `send(message, snapshot?)`:
     - If `HEARTBEAT_PONG` → rawSend directly, no tracking
     - Otherwise → `pendingActionManager.submit(message, snapshot)` which calls rawSend internally
   - In `onmessage`: intercept `ACK` and `NACK` types, route to pendingActionManager, don't bubble to consumer's onMessage
   - In `ws.onopen` (reconnect path, retryCount was > 0): call `pendingActionManager.retryAll()`
   - In `disconnect()`: call `pendingActionManager.cancelAll()`
   - Return type updated: `{ status, send, disconnect, reconnect, pendingActions }` (pendingActions = ref to manager for UI wiring)

**Tests:** PendingActionManager unit tests with fake timers: retry fires at correct intervals, ACK clears pending, NACK triggers failure callback, retryAll re-sends all, HEARTBEAT_PONG bypasses.

---

## Milestone 4: Client UI — Spinner Overlay + State Restoration

**Goal:** Spinner after 3s, pre-action snapshot capture, restore state on failure.

**Requirements:** REQ-F-RAD07, REQ-F-RAD08, REQ-F-RAD10, REQ-F-RAD11, REQ-F-RAD13

**Files to modify:**
- `code/packages/client/src/stores/uiStore.ts`
- `code/packages/client/src/app/game/[gameId]/page.tsx`

**Files to create:**
- `code/packages/client/src/components/game/ActionSpinner.tsx`

**Implementation:**

1. **UISnapshot type** (in PendingActionManager file):
   ```typescript
   export interface UISnapshot {
     selectedCardIds: number[];
     autoPassEnabled: boolean;
   }
   ```

2. **uiStore additions:**
   - `pendingActionSpinner: boolean` (default false)
   - `setPendingActionSpinner: (v: boolean) => void`
   - `restoreSnapshot: (snapshot: UISnapshot) => void` — sets selectedCardIds + autoPassEnabled

3. **Game page changes:**
   - In `handlePlay`, `handlePass`, `handlePhoenixChoice`, `handleWishChoice`, `handleConfirmPass`: capture snapshot before `send()`, pass as second arg
   - Wire PendingActionManager callbacks to uiStore:
     - `onSpinnerNeeded` → `uiStore.setPendingActionSpinner(true)`
     - `onResolved('ack')` → `uiStore.setPendingActionSpinner(false)`
     - `onResolved('nack')` → `uiStore.setPendingActionSpinner(false)`, `uiStore.restoreSnapshot(action.snapshot)`, `uiStore.showErrorToast(msg)`

4. **ActionSpinner component:**
   - Renders a semi-transparent overlay with spinner + "Sending..." text
   - Conditionally rendered when `uiStore.pendingActionSpinner === true`
   - Positioned over the action bar area

**Tests:** Component renders when spinner state is true; snapshot restoration sets correct state.

---

## Milestone 5: Integration + Edge Cases + Coverage

**Goal:** End-to-end verification, backward compat, reconnect retry, coverage target.

**Requirements:** REQ-F-RAD09, REQ-NF-RAD04

**Files to modify/create:**
- `code/packages/server/src/ws/__tests__/idempotency-map.test.ts`
- `code/packages/server/src/ws/__tests__/message-router-ack.test.ts`
- `code/packages/client/src/services/__tests__/PendingActionManager.test.ts`
- Minor fixes across milestones as discovered

**Implementation:**

1. Integration scenarios to verify:
   - Send action → ACK received → pending cleared, no spinner
   - Send action → no response → retries at 2s, 4s, 6s → spinner at 3s → final failure → state restored + toast
   - Send action → connection drops → reconnect → retryAll → server deduplicates → ACK
   - Send action without messageId (legacy) → no ACK, no crash
   - Chat message → tracked + retried like any other action
   - HEARTBEAT_PONG → no messageId, no tracking, no ACK expected

2. Room destroy cleanup: verify idempotency map entries cleared

3. Coverage: target 80%+ statement coverage on all new files

---

## Dependency Graph

```
Milestone 1 (protocol)
       ↓
  ┌────┴────┐
  M2         M3
  (server)   (client manager)
  └────┬────┘
       ↓
    Milestone 4 (UI)
       ↓
    Milestone 5 (integration)
```

M2 and M3 are independent after M1 completes.

---

## Verification

After all milestones:
1. `pnpm build` — all packages compile
2. `pnpm test` — all tests pass
3. `pnpm test:coverage` — 80%+ on new code
4. `pnpm typecheck` — no TS errors
5. Manual test: start dev server, play a game, observe ACK in browser devtools Network/WS tab
6. Manual test: throttle network in devtools → verify spinner appears, retries fire, then succeeds or shows error
