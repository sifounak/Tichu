# Restart Round Vote + Restart Data Cleanup

**Date:** 2026-04-27
**Status:** Draft

## Problem

1. There is no way to restart just the current round — only the entire game.
2. When a game is restarted via vote, orphaned event data (player_rounds, tricks, plays, etc.) is written to the DB with no corresponding `games` entry. This pollutes the database.

## Goals

- Add a "Restart Round" vote action that keeps prior-round scores and restarts the current round from the deal phase.
- Clean up data handling on restarts so restarted games/rounds leave no trace in the database.
- Rename the existing `'restart'` vote type to `'restartGame'` for clarity alongside the new `'restartRound'`.

## Non-Goals

- Changing abandonment behavior (all humans leave) — that continues to write data as-is.
- Adding restart-round to the pre-game vote menu (it only makes sense during an active game).

---

## Design

### 1. Vote Type Rename

Rename across the entire stack:

| Before | After |
|--------|-------|
| `PlayerVoteType = 'kick' \| 'restart'` | `PlayerVoteType = 'kick' \| 'restartGame' \| 'restartRound'` |
| `START_RESTART_VOTE` message | `START_RESTART_GAME_VOTE` message |
| `voteType: z.enum(['kick', 'restart'])` | `voteType: z.enum(['kick', 'restartGame', 'restartRound'])` |

All server, shared, and client references updated accordingly.

### 2. Restart Round — Server Mechanics

**Vote flow:** Identical to existing restart-game vote — unanimous approval from all human seats, 30s timeout, available in any game phase (Grand Tichu decision, card passing, playing).

**State machine:** Add a `RESTART_ROUND` event that transitions from `grandTichuDecision`, `cardPassing`, and `playing` states back to `grandTichuDecision`, triggering the existing `startRound` action. This action:
- Creates a fresh round state with `roundNumber = roundHistory.length + 1`
- Shuffles and deals a new deck (first 8 cards)
- Resets `grandTichuDecisions` and `cardPassDecisions` sets

Since `roundHistory` (completed rounds with scores) is untouched, all prior-round scores are preserved.

**Round number:** The restarted round gets the same round number as the round being replaced, because `roundHistory.length` hasn't changed (the aborted round was never finalized into history). This is correct behavior — round 3 restart still shows as round 3.

**Event capture:** Add a `discardCurrentRound()` method on `GameEventCapture` that clears the in-memory current round data and resets tracking state (trick numbers, sequence numbers, pending pre-play contexts, bomb inventory, etc.) without touching the finalized rounds in the accumulator.

**Recovery file:** Delete the existing recovery file before the round restarts (it may contain stale data for the aborted round). The next state change will write a fresh one.

### 3. Restart Game — Data Cleanup

**Current behavior (broken):** `savePassStatsBeforeDestroy()` writes orphaned event rows to the DB.

**New behavior:** Skip `savePassStatsBeforeDestroy()` entirely when restarting via vote. Instead, just delete the recovery file if one exists. The in-memory accumulator is discarded when the `GameManager` is destroyed.

Implementation: Add a boolean parameter to `restartGame(roomCode, { eraseData: true })` or simply inline the change — remove the `savePassStatsBeforeDestroy` call and replace with `deleteRecoveryFile`.

### 4. Restart Round — Data Cleanup

When a restart-round vote passes:
1. Call `discardCurrentRound()` on the event capture (clears in-memory data for this round)
2. Delete recovery file (stale data)
3. Send `RESTART_ROUND` event to the state machine actor

Prior rounds' data in the accumulator is preserved and will be written normally when the game eventually ends.

### 5. Abandonment — No Change

When all humans leave (game abandoned), the existing `savePassStatsBeforeDestroy()` path continues to run. This data stays in the DB as incomplete game data.

### 6. Client UI

**Vote menu order** (in-game `page.tsx`):
1. Kick Player
2. Restart Round (new)
3. Restart Game

The "Restart Round" button sends `{ type: 'START_RESTART_ROUND_VOTE' }`.

**VoteOverlay.tsx** — new display strings:
- Message: `"${initiatorName} has started a vote to restart the round"`
- Buttons: "Restart" / "Don't Restart" (same labels as restart-game, since context is clear from the message)

**Vote result message:** "Restarting round!" on pass, "Restart round vote failed!" on fail.

**Pre-game:** No restart-round option in the pre-game vote menu (makes no sense before a game starts).

---

## Files to Modify

### Shared Package
- `shared/src/types/protocol.ts` — add `START_RESTART_ROUND_VOTE` message, rename `START_RESTART_VOTE` → `START_RESTART_GAME_VOTE`, update `voteType` enum to `['kick', 'restartGame', 'restartRound']`
- `shared/src/types/game.ts` — update `voteType` in `activeVote` type

### Server Package
- `server/src/game/vote-handler.ts` — update `PlayerVoteType`, add `startRestartRoundVote` method, rename `'restart'` → `'restartGame'` in existing methods
- `server/src/game/game-manager.ts` — add `START_RESTART_ROUND_VOTE` handler, rename `handleStartRestartVote` → `handleStartRestartGameVote`, add `restartRound()` method that discards round data and sends `RESTART_ROUND` to actor
- `server/src/game/game-handler.ts` — register `START_RESTART_ROUND_VOTE` and rename `START_RESTART_VOTE` → `START_RESTART_GAME_VOTE` in `GAME_MESSAGE_TYPES`
- `server/src/game/game-state-machine.ts` — add `RESTART_ROUND` event with transitions from `grandTichuDecision`, `cardPassing`, `playing` → `grandTichuDecision` via `startRound` action
- `server/src/game/game-event-capture.ts` — add `discardCurrentRound()` method
- `server/src/room/room-handler.ts` — wire `restartRound` callback (send `RESTART_ROUND` to actor after 2s delay), fix `restartGame` to skip `savePassStatsBeforeDestroy` and instead delete recovery file, rename `'restart'` → `'restartGame'` in vote callback
- `server/src/ws/state-projection.ts` — update vote type references if any

### Client Package
- `client/src/app/game/[gameId]/page.tsx` — add "Restart Round" button to vote menu, handle `restartRound` vote result, rename `'restart'` → `'restartGame'` references
- `client/src/components/game/VoteOverlay.tsx` — add `restartRound` display strings
- `client/src/components/game/PreRoomView.tsx` — rename `'restart'` → `'restartGame'` in pre-game vote handling (if referenced)

### Test Files
- Update existing vote tests to use `'restartGame'` instead of `'restart'`
- Add tests for restart-round vote flow
- Add tests for data cleanup (verify no orphaned DB rows on restart)

---

## Verification

1. `pnpm typecheck` — all packages pass
2. `pnpm test` — all existing + new tests pass
3. Manual testing:
   - Start a game, play a round or two, then vote to restart round — verify scores preserved, new cards dealt, round number correct
   - Restart game via vote — verify no orphaned data in DB
   - Abandon game (all humans leave) — verify data still written to DB
   - Test restart-round from each phase (Grand Tichu, card passing, playing)
