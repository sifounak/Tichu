# Player Statistics System — Milestone 4: Relational Stats + API

**Date:** 2026-03-30
**Phase:** 2 (Implementation) — Milestone 4

## Summary

Added per-partner and per-opponent relational stat upserts and new API endpoints.

## Changes Made

1. **game-persistence.ts**: Added `upsertRelationalStats()` function and integrated it into `saveGameResult()` for all human player pairs.
2. **queries.ts**: Added `getPlayerPartners()` and `getPlayerOpponents()` query functions with JOIN to users table.
3. **auth-routes.ts**: Added `GET /api/players/:userId/partners` and `GET /api/players/:userId/opponents` endpoints.
4. **game-persistence.test.ts**: Updated expected `tx.run` call count from 4 to 16 (4 upsertPlayerStats + 12 relational).

## Test Results

- 49/49 DB tests pass
- 0 new regressions (auth-routes failures are pre-existing)
