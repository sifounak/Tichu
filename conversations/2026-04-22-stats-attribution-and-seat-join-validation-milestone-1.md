# Conversation Transcript — M1: Stats Attribution Rewrite + SQLite Version Guard

**Date**: 2026-04-22
**Branch**: `bugfix/stats-attribution-midgame`
**Scope**: Milestone 1 of 5 — REQ-F-SA01–SA13, SA15; REQ-NF-SA01–NF-SA05

## Summary of Key Decisions

### 1. Attribution model
- `player_rounds(game_id, round_number, seat, user_id)` is authoritative for "who was where when."
- `games.{seat}_user_id` is treated as "final occupant" only; no longer used as the primary filter for per-event stats.
- `gamesPlayed` (SA01) driven off `DISTINCT game_id FROM player_rounds WHERE user_id = ?`.
- `gamesWon` / win-diff / loss-diff (SA02/SA03) gated on final-seat occupancy; mid-game leavers do not accrue these.
- `gamesForfeited` (SA12) increments when user played ≥1 round but is not the final occupant — disjoint from `gamesWon` (SA15 invariant).
- `gamesJoinedAfterSpectating` (SA13) increments when user is final occupant and min(round_number) > 1.

### 2. Per-event gating pattern
- Primary SQL filter: row-value IN tuple `(game_id, round_number, seat) IN (SELECT ... FROM player_rounds WHERE user_id = ?)`
- Defensive JS-side `validGameRoundSeat: Set<"g-r-seat">` check for all aggregators that walk returned rows.
- Dragon-trick (SA06): gated on `winner_seat` tuple; dragon-gift (SA08): gated on `recipient_seat` tuple; dog-play (SA07): gated on `player_seat` tuple; per-play (SA04), per-bomb (SA05) filtered by the primary tuple.

### 3. Round-level gating pattern
- `myRoundsByGame: Map<gameId, Set<roundNumber>>` gates 1-2 finish credit (SA09), tie-break credit (SA10), round-level aggregations.

### 4. Team derivation
- `myTeamByGame` built from the seat the user occupied during their played rounds (SA11), not from final occupancy.
- If a user somehow has two different team-seats across rounds (should be impossible once M2 enforces SJ04–SJ06), we keep the first-seen team and log a warning. Tracked as an invariant to be enforced by seat-eligibility (M2).

### 5. SQLite version guard (NF-SA05)
- Added at `createDatabase`: after opening the connection, query `sqlite_version()`, parse maj.min, throw if < 3.15.
- Row-value IN tuple syntax requires 3.15+. Better to fail fast at startup than silently return wrong results.

### 6. User discovery for rebuildStatsCache
- **Bug discovered during M1 Step B**: `rebuildStatsCache` was iterating only users present in `games.{seat}_user_id`. Swapped-out users never had their cache rebuilt → tests failed with `rowA undefined`.
- **Fix**: extended the UNION to include `SELECT user_id FROM player_rounds WHERE user_id IS NOT NULL`.
- Same fix applied to `updateCacheAfterGame` (switched from final-occupant list to `DISTINCT user_id FROM player_rounds WHERE game_id = ?`).

### 7. Coverage strategy
- Initial coverage after primary refactor: 77.23% on stats-cache.ts, 64.35% on `computeStatsForUser`.
- Added a rich-event fixture test (`SA04-SA08: per-event stats attributed by tuple`) that inserts raw SQL rows into `plays`, `bomb_inventory`, `tricks`, `dragon_gift_events`, `dog_play_events` to exercise phoenix-usage, bomb-counters, dragon-trick, dragon-gift, dog-play attribution paths.
- Result: 82.30% on `computeStatsForUser`, 88.83% on stats-cache.ts module.

## Test Results
- 769/769 server tests pass (8 new mid-game attribution tests + 3 new SQLite version tests)
- 198/198 client tests pass (unchanged)
- All 26 pre-existing stats-cache tests pass unchanged (REQ-NF-SA03)

## Files Modified
- `code/packages/server/src/db/connection.ts` (+10 lines — SQLite version guard)
- `code/packages/server/src/db/stats-cache.ts` (major rewrite of `computeStatsForUser`; extended `rebuildStatsCache` + `updateCacheAfterGame` user discovery)
- `code/packages/server/tests/db/connection.test.ts` (+3 tests + mock extension)
- `code/packages/server/tests/db/stats-cache.test.ts` (+8 tests in new `describe('mid-game attribution')` block)
- `specifications/RTM-stats-attribution-and-seat-join-validation.md` (M1 reqs → Passed)

## Risks Deferred to Later Milestones
- M2 enforces SJ04–SJ06 (seat-eligibility), which eliminates the cross-team-conflict warning case in `myTeamByGame` build.
- M4 adds DB wipe script (SA14).
- M5 adds client-side rejection dialog (SJ07).

## What's Next
M2 — Seat Eligibility Module + Grace-Period Alignment (REQ-F-SJ01–SJ06, SJ12–SJ13).
