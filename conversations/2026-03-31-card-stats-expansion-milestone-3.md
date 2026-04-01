# Card / Hand Stats Expansion — Milestone 3

**Date:** 2026-03-31
**Milestone:** M3: Persistence + Pass Abandon Handling
**Requirements:** REQ-F-CS23, CS24, REQ-NF-CS02

## What Was Implemented

1. **upsertGroupCStats()** — Expanded with all 36 new columns (INSERT + ON CONFLICT UPDATE). Uses `MAX()` for longestStraightWithPhoenix, `+=` for all others.
2. **Over-bomb migration** — Added one-time idempotent `UPDATE player_stats SET you_were_over_bombed = over_bombed WHERE you_were_over_bombed = 0 AND over_bombed > 0` in syncSchema().
3. **GameManager.getCurrentRoundSummaries()** — New public method exposing event tracker state.
4. **GameManager.isPastCardPassPhase()** — Returns true when round is past card passing (pass data available).
5. **savePassStatsOnAbandon()** — New exported function in game-persistence.ts that persists round event summaries for specified players.
6. **RoomHandler.savePassStatsBeforeDestroy()** — Private helper called before game destruction in both restartGame() and leaveRoom() paths. Only runs if game was past card pass phase.

## Key Decisions

- Used full upsertGroupCStats for pass-on-abandon (not a pass-only subset) since non-pass fields will be 0 in the summary, adding 0 is harmless.
- savePassStatsBeforeDestroy catches all errors — persistence failure must not block game destruction.
- Uses roomManager.getUserIdAtSeat() to resolve userId (consistent with existing persistGameResult flow).

## Test Results

- tsc --noEmit passes for server package
