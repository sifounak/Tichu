# Milestone 2: Seat Swap Feature

**Date:** 2026-03-12
**Requirements:** REQ-F-006, REQ-F-007

## Changes Implemented

1. **SWAP_SEATS protocol message** — Added `z.object({ type: z.literal('SWAP_SEATS'), targetSeat: seatSchema })` to `clientMessageSchema`
2. **swapSeat() method** — Added to `room-manager.ts` with 3 modes: empty seat (move), bot seat (replace), human seat (swap). Returns affected user IDs for ConnectionManager updates.
3. **SWAP_SEATS handler** — Registered in `room-handler.ts`, calls `swapSeat()`, updates ConnectionManager seat assignments, sends `ROOM_JOINED` to affected players, broadcasts `ROOM_UPDATE`
4. **Seat swap UI** — "Sit Here" button on empty/bot seats for any player, alongside existing "+ Bot" button for host

## Test Results

- 554 tests pass (354 server + 200 client)
- 8 new tests for swapSeat: empty seat, bot seat, human swap, host migration, game-in-progress block, same-seat rejection, not-in-room rejection
- No regressions
