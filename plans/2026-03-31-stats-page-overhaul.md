# Stats Page Overhaul — Implementation Plan

**Date:** 2026-03-31
**Spec:** `specifications/2026-03-31-stats-page-overhaul.md`
**Branch:** `feature/stats-page-overhaul`
**Parent:** `main`

## Milestones

### Milestone 1: Shared Types + DB Schema + Stat Computations
**Requirements:** REQ-F-SO01–SO06, REQ-F-SO07–SO11, REQ-NF-SO02

**Files to modify:**
- `code/packages/shared/src/types/game.ts` — Add `finishOrder: Seat[]` to `RoundScore`
- `code/packages/shared/src/engine/scoring.ts` — Include `finishOrder` in `scoreRound()` return
- `code/packages/server/src/db/schema.ts` — Add 6 new columns to `playerStats`
- `code/packages/server/src/db/connection.ts` — Add ALTER TABLE migration for new columns
- `code/packages/server/src/db/stat-computations.ts` — New computation logic for tie-break, lastFinishes, tichuBrokenByPartner; fix firstFinishes

**Testing:**
- Update `code/packages/server/tests/db/stat-computations.test.ts` — test new computations
- Verify `scoreRound()` includes `finishOrder` in output

### Milestone 2: Game Persistence + Spectator Tracking + API Expansion
**Requirements:** REQ-F-SO12–SO20, REQ-NF-SO01

**Files to modify:**
- `code/packages/server/src/db/game-persistence.ts` — Update upsert, enriched history query
- `code/packages/server/src/db/queries.ts` — Expand `PlayerProfile` with Group C + new stats, update SQL
- `code/packages/server/src/game/game-manager.ts` — Add `joinedAfterSpectating` set + method
- `code/packages/server/src/room/room-handler.ts` — Call `markJoinedAfterSpectating` on mid-game seat claim

**Testing:**
- Update `code/packages/server/tests/db/game-persistence.test.ts` — verify new columns persisted
- Verify API returns expanded profile

### Milestone 3: Client UI — Overview Tab + Card Stats Tab
**Requirements:** REQ-F-SO21–SO27, REQ-NF-SO03

**Files to modify:**
- `code/packages/client/src/app/stats/page.tsx` — Grid layout, missing values, restructured Overview sections, Card Stats tab

**Testing:**
- `npm run build` passes for client package
- Visual verification of layout

### Milestone 4: Client UI — History Tab Redesign
**Requirements:** REQ-F-SO28–SO29, REQ-NF-SO03

**Files to modify:**
- `code/packages/client/src/app/stats/page.tsx` — History tab table with player-relative data

**Testing:**
- `npm run build` passes
- Visual verification of history table

## Implementation Order

M1 → M2 → M3 → M4 (sequential — each depends on the previous)

## Key Patterns to Reuse

- **Migration pattern:** `connection.ts` uses `db.run(sql\`ALTER TABLE ... ADD COLUMN ... DEFAULT 0\`)` with try/catch for idempotency
- **Upsert pattern:** `game-persistence.ts` `upsertPlayerStats()` uses raw SQL INSERT ON CONFLICT with column-specific update expressions
- **StatCard/Section components:** Reuse existing shared components in `page.tsx`
- **pct/ratio helpers:** Existing helpers in `OverviewTab`, just need to change "N/A" to "-"
