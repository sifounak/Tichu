# Statistics System Redesign — Milestone 1: Database Schema

**Date:** 2026-04-09
**Phase:** Implementation — Milestone 1
**Branch:** `feature/stats-redesign-event-capture`

## Summary

Created 8 new database tables and extended `game_rounds` with 3 new columns for the raw event logging architecture.

### Changes Made

1. **schema.ts** — Added Drizzle ORM definitions for: `playerRounds` (26 cols), `tricks` (18 cols), `plays` (37 cols), `wishEvents` (9 cols), `dragonGiftEvents` (13 cols), `dogPlayEvents` (10 cols), `bombInventory` (20 cols), `bombEvents` (10 cols), `playerGlobalStats` (3 cols). Extended `gameRounds` with `scoreNSAtStart`, `scoreEWAtStart`, `startedAt`.

2. **connection.ts** — Added `CREATE TABLE IF NOT EXISTS` SQL for all 9 new tables. Added `ALTER TABLE game_rounds ADD COLUMN` for 3 new columns (idempotent, matching existing pattern).

### Verification

- TypeScript compiles cleanly (`tsc --noEmit` — 0 errors)
- Fresh SQLite DB creates all tables with correct column counts
- Existing tests: 30 pre-existing failures, 0 new failures introduced
- `game_rounds` extension columns added idempotently via ALTER TABLE

### Requirements Addressed

SC01-SC11 (all 11 schema requirements) + MG02 (extend game_rounds) = 12/12 Passed
