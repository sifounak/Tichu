# Milestone 1 Results — Stats Attribution Rewrite + SQLite Version Guard

**Branch**: `bugfix/stats-attribution-midgame`
**Date**: 2026-04-22

## Test Results
- **Server**: 769/769 passed (43 test files)
- **Client**: 198/198 passed (23 test files)
- **Shared**: passed (workspace-level `pnpm test` green)

## Coverage
- `computeStatsForUser` (target: ≥ 80% per REQ-NF-SA04): **82.30%** (344 / 418 statements)
- `stats-cache.ts` module: **88.83%** statements
- `connection.ts`: **97.95%** statements
- Server aggregate (v8 threshold `statements: 80`): **81.13%** ✓

## Requirements Status (M1 scope)
- REQ-F-SA01–SA13, SA15: **Passed** (13 requirements)
- REQ-NF-SA01–SA05: **Passed** (5 requirements)
- REQ-F-SA14: deferred to M4 (DB wipe script)
- REQ-NF-SA02: partial — M1 slice clean; full closure at M2/M5

## Key Changes
1. `stats-cache.ts:338-1003` — `computeStatsForUser` rewritten:
   - Attribution driven from `player_rounds(game_id, round_number, seat, user_id)` tuples
   - `validGameRoundSeat` Set + row-value IN SQL gate all per-event aggregates
   - `myRoundsByGame` gates round-level aggregates (1-2, tie-break)
   - `myTeamByGame` derived from played-round seats (REQ-F-SA11)
   - New branches: `gamesForfeited` (SA12), `gamesJoinedAfterSpectating` (SA13), `gamesWon`/diff gated on final-seat occupancy (SA02/SA03)
2. `stats-cache.ts:1245-1270` — `rebuildStatsCache` user discovery extended to include `player_rounds.user_id` so swapped-out users are rebuilt
3. `stats-cache.ts:1276-1300` — `updateCacheAfterGame` switched to `player_rounds`-driven user discovery
4. `connection.ts:31-39` — SQLite ≥ 3.15 version guard (REQ-NF-SA05)

## Tests Added
- `stats-cache.test.ts` → new `describe('mid-game attribution')` block with 8 tests covering SA01–SA13, SA15 and exercising plays/bomb_inventory/tricks/dragon_gift_events/dog_play_events attribution (SA04–SA08)
- `connection.test.ts` → 3 new tests verifying SQLite version guard

## Regression Safety
- Pre-existing 26 stats-cache tests pass unchanged (REQ-NF-SA03)
- No schema changes (REQ-NF-SA01)
- No protocol/REST/UI changes in M1 (REQ-NF-SA02)
