# Card / Hand Stats Expansion — Milestone 1

**Date:** 2026-03-31
**Milestone:** M1: Types + DB Schema + RoundEventSummary Fields
**Requirements:** REQ-F-CS04, CS08, CS11, CS14, CS17, CS21, REQ-NF-CS02

## What Was Implemented

Added ~36 new fields/columns across 5 files:

1. **round-event-types.ts** — Extended `RoundEventSummary` with 30+ new fields covering Phoenix play types (7), Dog control (4), bomb sizes (11), conflicting bombs (1), over-bomb direction (2), extended pass tracking (11 booleans)
2. **schema.ts** — Added 36 new columns to `playerStats` Drizzle schema
3. **connection.ts** — Added 36 new columns to migration array for existing DBs
4. **queries.ts** — Added fields to `PlayerProfile` interface and `getPlayerProfile()` SQL SELECT
5. **page.tsx** (client) — Added fields to client-side `PlayerProfile` type

## Key Decisions

- Extended pass tracking uses boolean fields in RoundEventSummary (per-round) but integer columns in DB (accumulated counts)
- Old bomb columns (fourCardBombs, fiveCardBombs, sixPlusCardBombs, overBombed) kept for backward compatibility
- DB column names use snake_case, TypeScript uses camelCase with aliases in SQL SELECT

## Test Results

- `tsc --noEmit` passes for all 3 packages (shared, server, client)
