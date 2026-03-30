# Player Statistics System — Planning Conversation

**Date:** 2026-03-30
**Phase:** 1.4-1.5 (Implementation Planning + Commit)

## Summary

Designed a 5-milestone implementation plan for the player statistics system based on the approved specification (29 FR + 4 NFR).

## Key Decisions

1. **5 milestones** (not 4 as in the draft plan):
   - M1: Schema + Persistence Wiring (the critical gap)
   - M2: Group A/B Stat Computation
   - M3: RoundEventTracker + Group C Stats
   - M4: Relational Stats + API
   - M5: Stats UI

2. **Database injection approach:** Pass `Database | null` to `RoomHandler` constructor via `app.ts`, since `RoomHandler` currently has no DB access.

3. **Pass card tracking is simpler than expected:** `passedCards.to` data is NOT cleared after `executeCardExchange` — only `received` is set to true. So we can read exact pass data directly instead of hand-diff.

4. **wireGameEndCallback pattern:** Follows existing `wireKickCallback`/`wireVoteCallback` patterns in `GameManager`. Fires after broadcast so clients see game-over first (REQ-NF-P02).

5. **Test framework:** vitest, tests in `code/packages/{server,shared,client}/tests/`

## Codebase Exploration Summary

- `saveGameResult()` exists at `game-persistence.ts:36-125` but is never called
- `upsertPlayerStats()` at `game-persistence.ts:127-170` handles ON CONFLICT upsert
- `GameManager.onStateChange()` at `game-manager.ts:449` handles all FSM transitions
- `startGameInternal()` at `room-handler.ts:596-676` wires kick/vote callbacks
- `playerStats` table has 10 columns currently, needs ~35 more
- `GameMachineContext` at `game-state-machine.ts:66-79` has scores, roundHistory, winner
- `RoundState` at `shared/types/game.ts:101-120` has bombsPerTeam, finishOrder, dragonGiftPending, lastDogPlay
- `detectAllBombs()` at `combination-detector.ts:523-573` for bomb detection in first-8 cards
