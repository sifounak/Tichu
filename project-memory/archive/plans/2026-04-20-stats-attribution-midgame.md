# Stats attribution for mid-game join/leave — correctness fix

## Context

Our room/game layer already supports mid-game player changes: a human can disconnect and have their seat filled by a spectator or a bot, a host can swap bots in/out mid-game, and reconnection is handled. But our **stats layer assumes stable seat→user identity for the whole game**, and as a result attribution is wrong in three places:

1. **Game-level counters (`gamesPlayed`, `gamesWon`, `winRate`, `largestWinDiff`, `largestLossDiff`, `oneTwoWins/Against`, `gamesRequiringTieBreak`, `mostTieBreakRoundsNeeded`)** are computed by filtering the `games` table on `{seat}_user_id = userId`. That column stores only the **final seat occupant**, so a player who played 6 of 8 rounds and then left gets zero game credit; their replacement gets full credit. ([stats-cache.ts:337-343](code/packages/server/src/db/stats-cache.ts#L337-L343), [stats-cache.ts:456-504](code/packages/server/src/db/stats-cache.ts#L456-L504))

2. **Per-play, per-trick, per-bomb, per-dog, per-dragon stats** are filtered by a `validGameSeat` set keyed on `gameId-seat`, with no round dimension. If users A and B shared one seat across different rounds of the same game, A gets credit for B's plays at that seat, and vice versa. ([stats-cache.ts:404-408](code/packages/server/src/db/stats-cache.ts#L404-L408), [stats-cache.ts:435](code/packages/server/src/db/stats-cache.ts#L435))

3. **Per-round aggregates iterated in the "compute game-level stats" loop** (e.g., `oneTwoWins`, tie-break detection) walk every round of every game the user appears in, without checking whether the user actually played that specific round. A late joiner gets credited for 1-2 finishes that happened before they sat down.

The fix has to be done in the cache-rebuild path (`computeStatsForUser`). All event data needed is already captured — `player_rounds` has `(game_id, round_number, seat, user_id)` per round, which is the correct grain for attribution.

**Policy (user-approved):**
- `gamesPlayed` +1 for any user with ≥1 row in `player_rounds` for that game.
- `gamesWon` +1 only if the user is the final seat occupant on the winning team (i.e., present in `games.{seat}_user_id` AND their team won).
- Per-event stats attributed to the user who actually played that `(game, round, seat)` tuple.
- No new UI surface; no new schema columns. Stats just become accurate.

## Scope

In scope:
- [code/packages/server/src/db/stats-cache.ts](code/packages/server/src/db/stats-cache.ts) — `computeStatsForUser` rewrite of the attribution joins.
- Stats cache rebuild after deploy so historical data reflects the fix.
- New unit tests covering mid-game swap scenarios.

Out of scope (note in follow-ups, don't address here):
- Relational stats (`relational_stats_cache`) when a partner changes mid-game — same class of bug, larger surface. File separately.
- Fractional credit / participation-weighted stats.
- UI badges for partial games.
- Changes to the `games` table schema (keeping "final occupant" semantics there).

## Changes

### 1. Replace `userGames` query with a participation-based lookup
[stats-cache.ts:337-343](code/packages/server/src/db/stats-cache.ts#L337-L343)

Current:
```sql
SELECT ... FROM games
WHERE north_user_id = ${userId} OR east_user_id = ${userId}
   OR south_user_id = ${userId} OR west_user_id = ${userId}
```

New: pull game ids from `player_rounds` (the source of truth for "who actually played"), then join `games` for the metadata:
```sql
SELECT g.id, g.winner_team, g.final_score_ns, g.final_score_ew, g.target_score,
       g.north_user_id, g.east_user_id, g.south_user_id, g.west_user_id
FROM games g
WHERE g.id IN (SELECT DISTINCT game_id FROM player_rounds WHERE user_id = ${userId})
```

This makes `stats.gamesPlayed = userGames.length` automatically correct.

### 2. Split the `gamesWon` logic off the "final occupant" check
[stats-cache.ts:458-469](code/packages/server/src/db/stats-cache.ts#L458-L469)

`getUserSeat(game, userId)` currently returns the seat from `games.{seat}_user_id`. With the query change above, that can now return `null` (user participated but wasn't final occupant). Handle that:

- If `seat === null` → user was a mid-game leaver. Credit `gamesPlayed` (already counted), but **do not** credit `gamesWon`, `largestWinDiff`, `largestLossDiff`.
- If `seat !== null` → existing logic runs, unchanged.

### 3. Restrict per-round loop aggregates to rounds the user actually played
[stats-cache.ts:471-502](code/packages/server/src/db/stats-cache.ts#L471-L502)

Build a set `myRoundsByGame: Map<gameId, Set<roundNumber>>` from `myPlayerRounds` (already fetched at [stats-cache.ts:365-373](code/packages/server/src/db/stats-cache.ts#L365-L373)). Inside the round loop:
- `oneTwoWins` / `oneTwoAgainst`: skip rounds the user didn't play in.
- Tie-break detection: still walk all rounds (needed to compute cumulative scores correctly), but only credit `gamesRequiringTieBreak` / `mostTieBreakRoundsNeeded` if the user played any tie-break round.

Also: the user's "team" (`myTeamStr`) currently comes from the final-occupant seat. For a mid-game leaver, derive team from the seat they occupied during the rounds they played. Assert a single team per game (most common case); if a player somehow sat on both teams in one game, skip team-dependent aggregates for that game and log a warning.

### 4. Fix the play/trick/bomb/dog/dragon round-leak bug
[stats-cache.ts:402-450](code/packages/server/src/db/stats-cache.ts#L402-L450)

Replace `validGameSeat: Set<"${gameId}-${seat}">` with `validGameRoundSeat: Set<"${gameId}-${roundNumber}-${seat}">`, built from `myPlayerRounds`. Update every filter call:
- `filteredPlays` (line 408)
- `filteredBombs` (line 435)
- Any downstream use of the set for per-play/per-trick reasoning further down in `computeStatsForUser`.

Also tighten the SQL where applicable — `myPlays` and `myBombs` subqueries should restrict by `(game_id, round_number, seat)` tuples instead of seat-only, to reduce wasted rows pulled over the app boundary. Simplest shape:

```sql
WHERE (game_id, round_number, seat) IN (
  SELECT game_id, round_number, seat FROM player_rounds WHERE user_id = ${userId}
)
```
(SQLite supports row-value IN since 3.15.)

Dog play, dragon gift, and trick queries use `winner_seat`/`gifter_seat`/`recipient_seat`/`player_seat` — apply the same `(game, round, seat)` filter against those columns on the JS side where the query already pulls all rows for the game.

### 5. Rebuild the cache after deploy
The stats_cache table has a rebuild entrypoint ([stats-cache.ts:1110-1160](code/packages/server/src/db/stats-cache.ts#L1110-L1160) writes per-user rows). Trigger a full rebuild on next server start after this change lands so historical games re-attribute correctly. Check whether there's an existing rebuild hook in [connection.ts](code/packages/server/src/db/connection.ts) / [index.ts](code/packages/server/src/index.ts) or if we need a one-shot migration script.

### 6. Tests

Add to [code/packages/server/test/stats-cache.test.ts](code/packages/server/test/stats-cache.test.ts) (create if absent — check `code/packages/server/test/` layout):

- **Mid-game leaver**: Player A plays rounds 1-4 at seat N, leaves; Player B plays rounds 5-8 at seat N; team wins.
  - Expect A: `gamesPlayed=1`, `gamesWon=0`, plays/tichus/bombs only from rounds 1-4.
  - Expect B: `gamesPlayed=1`, `gamesWon=1`, plays/tichus/bombs only from rounds 5-8, `gamesJoinedAfterSpectating=1`.
- **Mid-game leaver on losing team**: same but team loses. A gets `gamesPlayed=1, gamesWon=0`; B gets `gamesPlayed=1, gamesWon=0, largestLossDiff=...`.
- **Bot replaces human**: A plays rounds 1-3, bot fills for 4-8. A: `gamesPlayed=1, gamesWon=0`, bot rounds not attributed to anyone (null `user_id`).
- **Clean game (no swaps)**: existing behavior unchanged — regression guard.
- **Per-play round-leak**: two humans share one seat across different rounds; each gets only their own plays/bombs.

## Critical files

- [code/packages/server/src/db/stats-cache.ts](code/packages/server/src/db/stats-cache.ts) — all attribution logic changes
- [code/packages/server/src/db/schema.ts](code/packages/server/src/db/schema.ts) — reference only; no schema changes
- [code/packages/server/src/db/queries.ts](code/packages/server/src/db/queries.ts) — reference only; read paths unchanged (cache columns are the same)
- [code/packages/server/test/stats-cache.test.ts](code/packages/server/test/stats-cache.test.ts) — new tests (create if needed)

## Verification

1. `cd code && pnpm --filter @tichu/server test` — new unit tests pass, existing tests still pass.
2. `cd code && pnpm --filter @tichu/server test:coverage` — statement coverage ≥ 80% for changed code.
3. `cd code && pnpm typecheck` and `pnpm lint` clean.
4. End-to-end smoke: `bash scripts/dev-start.sh`, run a 4-player game with one bot takeover mid-game, end the game, check profile stats for all 4 human slots — `gamesPlayed` increments for leavers and replacements, `gamesWon` only for players at seat at game-end.
5. Rebuild cache on a dev DB containing historical games with mid-game swaps (use a test fixture) — spot-check that `gamesPlayed` > `games.{seat}UserId` occupancy count for affected users.
6. Confirm `relational_stats_cache` is NOT touched by this change — file a follow-up issue for the analogous relational fix.
