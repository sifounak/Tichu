# Graceful Disconnection Handling — Milestone 2

## What was implemented

Kick Dialog Server Logic (REQ-F-KM01–KM14): A non-vote mechanism where any single player can trigger immediate removal of a disconnected player after 2+ minutes.

### New files

1. **`packages/server/src/game/kick-dialog-handler.ts`** — Full KickDialogHandler class:
   - Queue: `QueueEntry[]` with `{ seat, crossedAt, dismissedByPlayers, dismissedBySystem }`
   - Active dialog: `{ targetSeat, responses: Map<Seat, 'kick'|'decline'>, eligibleSeats }`
   - `onThresholdCrossed()`: add to queue, show next if no active dialog
   - `handleResponse()`: any 'kick' → fire callback & advance; all decline → mark dismissed & advance
   - `handleReconnect()`: remove from queue or dismiss active dialog
   - `dismissForVote()`: system-dismiss (can reappear after vote per REQ-F-KM13)
   - `reappearAfterVote()`: re-show if still applicable and not player-dismissed
   - `onKick` and `onDialogDismissed` callbacks

2. **`packages/server/tests/game/kick-dialog-handler.test.ts`** — 30 unit tests covering:
   - Threshold crossing triggers dialog (KM01)
   - Any single kick triggers immediate removal (KM02)
   - All decline dismisses one-time (KM03, KM10)
   - Reconnect dismisses dialog or removes from queue (KM05, KM09)
   - Queue ordering by timestamp (KM08)
   - Vote priority dismiss/reappear (KM12, KM13)
   - Edge cases: no eligible seats, duplicate responses, no-op scenarios

### Modified files

3. **`packages/server/src/game/game-manager.ts`**:
   - Import and instantiate KickDialogHandler
   - Wire `disconnectHandler.onThresholdCrossed` → `kickDialogHandler.onThresholdCrossed`
   - Wire `kickDialogHandler.onKick` → vacate seat + callback
   - Route `KICK_DIALOG_RESPONSE` messages
   - Pass `kickDialog` to state projection in `broadcastState()`, `sendStateTo()`, `sendSpectatorState()`
   - Added `getConnectedHumanSeats()` helper
   - Added `onKickDialogKick` callback property
   - Updated `static restore()` to initialize kickDialogHandler with same wiring

4. **`packages/server/src/ws/state-projection.ts`**:
   - Added `kickDialog` parameter to `projectGameState()` (passes through to players)
   - Added `_kickDialog` parameter to `projectSpectatorView()` (always returns `null` per REQ-F-UI03)
   - Both return objects include `kickDialog` field

5. **`packages/server/src/ws/broadcaster.ts`**:
   - Extended `broadcastGameState` signature with `kickDialog` parameter
   - Passes through to both projection functions

6. **`packages/shared/src/types/protocol.ts`**:
   - Added `KICK_DIALOG_RESPONSE` (C→S): `{ response: 'kick' | 'decline' }`
   - Added `KICK_DIALOG_SHOW` (S→C): `{ targetSeat }`
   - Added `KICK_DIALOG_DISMISSED` (S→C): `{ targetSeat, reason: 'kicked'|'declined'|'reconnected'|'vote_priority' }`

7. **`packages/shared/src/types/game.ts`**:
   - Added `kickDialog?: { targetSeat: Seat } | null` to `ClientGameView`

8. **`packages/server/tests/game/game-manager.test.ts`**:
   - Added `null` (kickDialog) to broadcastGameState assertion

## Test results

- All 912 server tests pass (882 existing + 30 new)
- All 224 client tests pass
- Typecheck clean across all packages

## Requirements addressed

- REQ-F-KM01: Kick dialog fires after threshold ✓
- REQ-F-KM02: Any single kick → immediate removal ✓
- REQ-F-KM03: All decline → dismissed ✓
- REQ-F-KM04: Kick callback vacates seat ✓
- REQ-F-KM05: Reconnect dismisses active dialog ✓
- REQ-F-KM08: Queue ordered by crossedAt ✓
- REQ-F-KM09: Reconnect removes from queue ✓
- REQ-F-KM10: Player-dismissed = no reappearance ✓
- REQ-F-KM12: Vote takes priority, system-dismisses dialog ✓
- REQ-F-KM13: System-dismissed can reappear after vote ✓
- REQ-F-UI03: Spectators don't see kick dialog ✓
