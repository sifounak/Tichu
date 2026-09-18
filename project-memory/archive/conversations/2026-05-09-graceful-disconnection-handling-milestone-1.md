# Graceful Disconnection Handling — Milestone 1

## What was implemented

Rewrote the disconnect handler from a per-room grace-period model to per-seat independent tracking:

1. **disconnect-handler.ts** — Complete rewrite:
   - Per-seat `Map<Seat, SeatDisconnectState>` with independent `disconnectedAt` timestamps
   - Each seat gets its own threshold timer (125s = 2min + 5s)
   - `onThresholdCrossed` callback fires per-seat when threshold hit
   - Solo-human frozen sessions preserved (separate `FrozenSession` with grace expiry)
   - `getVoteStatus()` always returns null (legacy stub for transition)
   - New methods: `getDisconnectDurationMs()`, `getSeatsOverThreshold()`

2. **game-manager.ts** — No-pause behavior:
   - `handleDisconnect()`: removed `timer.stop()` for multi-human games; only freezes solo-human
   - `handleReconnect()`: only resumes game flow if was frozen (solo-human)
   - `onStateChange()`: `isFrozen()` check unchanged (only fires for solo-human)
   - Added `computeWaitingForReconnect()` — determines if game is waiting at a disconnected player's untimed action
   - `broadcastState()`/`sendStateTo()`: pass `waitingForReconnect` and `disconnectedSeats` to projection

3. **state-projection.ts** — New fields:
   - `waitingForReconnect: Seat | null` — computed server-side
   - `disconnectedSeats: Seat[]` — list of currently disconnected seats
   - `gameHalted` no longer set by disconnect status (only vacated seats)

4. **shared/types/game.ts** — Added `waitingForReconnect` and `disconnectedSeats` to `ClientGameView`

5. **broadcaster.ts** — Updated `broadcastGameState` signature with new params

6. **game-store.ts** — Updated constructor to pass correct options to new DisconnectHandler

## Test results

- All 882 server tests pass
- All 224 client tests pass
- Typecheck clean across all packages

## Requirements addressed

- REQ-F-DC01: Seat preserved on disconnect ✓
- REQ-F-DC02: Timer starts from zero each disconnect ✓
- REQ-F-DC03: Timer fully reset on reconnect ✓
- REQ-F-DC04: Track elapsed disconnect time per player ✓
- REQ-F-GF01: No pause/freeze/auto-play on disconnect (multi-human) ✓
- REQ-F-GF02: Turn timer runs for disconnected players ✓
- REQ-F-GF03: Bomb window runs naturally ✓
- REQ-F-GF04: Untimed phases wait for disconnected player ✓
- REQ-NF-GF01: Bomb window duration identical regardless of disconnect ✓
