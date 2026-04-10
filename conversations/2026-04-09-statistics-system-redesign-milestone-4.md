# Statistics System Redesign — Milestone 4: Storage

**Date:** 2026-04-09
**Branch:** feature/stats-redesign-event-capture

## Summary

Implemented the storage layer for persisting captured event data — batch writes at game end, recovery file system for crash resilience, and game abandonment handling.

## Key Decisions

1. **Single transaction batch write:** All event data (player_rounds, tricks, plays, wish/dragon/dog events, bomb inventory/events) written in one `db.transaction()` call. If any insert fails, entire transaction rolls back.

2. **Recovery files:** JSON serialization to `data/recovery/game-{id}.json` at each round end. One file per game, overwritten each round. Cleaned up on successful batch write.

3. **Server restart recovery:** `recoverFromCrash()` called in `app.ts` at startup. Scans recovery directory, parses JSON, writes to DB, discards corrupt files gracefully.

4. **Game abandonment:** `writeEventDataOnAbandon()` writes whatever data was accumulated (completed rounds only). Extends existing `savePassStatsOnAbandon` pattern.

5. **persistGameResult returns gameId:** Changed from `void` to `number | null` so the game-end callback can pass the DB game ID to `writeEventData()`.

## Files Created

- `code/packages/server/src/db/event-persistence.ts` — Batch write, recovery files, crash recovery, abandonment
- `code/packages/server/tests/db/event-persistence.test.ts` — 15 tests covering all M4 requirements + NFRs

## Files Modified

- `code/packages/server/src/app.ts` — Added `recoverFromCrash()` call at startup
- `code/packages/server/src/game/game-manager.ts` — Added recovery file write at round end
- `code/packages/server/src/room/room-handler.ts` — Integrated event data write into game-end callback + abandonment handler

## Test Results

- 15 tests passed, 0 failed
- Performance: batch write <500ms, recovery file <200KB
- No regressions

## RTM Status

7/7 M4 requirements Passed (ST02-ST06, NF-02, NF-03)
