# Implementation Plan — Stats Attribution Correctness & Seat-Join Validation

**Date**: 2026-04-22
**Branch**: `bugfix/stats-attribution-midgame`
**Derived from**: [specifications/2026-04-22-stats-attribution-and-seat-join-validation.md](../specifications/2026-04-22-stats-attribution-and-seat-join-validation.md)
**Supersedes (as planning source of truth)**: [plans/2026-04-20-stats-attribution-midgame.md](./2026-04-20-stats-attribution-midgame.md) (retained for historical reference — it was the initial sketch that the spec was derived from; this plan covers the full SA + SJ scope)
**Confidence**: High

---

## 1. Context

Two linked defects will be fixed in a single branch:

1. **Stats attribution is wrong whenever a seat's occupant changes mid-game.** `computeStatsForUser` filters on `games.{seat}_user_id` (final occupant only) and a `validGameSeat` Set keyed on `(gameId, seat)` with no round dimension. A player who plays 6 of 8 rounds then leaves gets zero credit; their replacement inherits everything. Users sharing a seat across different rounds get each other's plays.

2. **The room layer permits a user to occupy multiple seats within one game**, which is the root cause that makes attribution ambiguous at the edges AND a fairness bug — a user who has seen seat N's cards could leave, return as a spectator, and claim seat E with prior knowledge.

The spec approves a policy fix for #1 (attribute by `(gameId, roundNumber, seat)` tuples drawn from `player_rounds`) and an enforcement addition for #2 (server-side rule: if you previously held seat S in this game, you can only reclaim S — never a different seat). Grace-period handling also needs to be aligned to a 1-minute involuntary-only hold (the current code uses a vote-based keep/kick scheme that the spec removes).

---

## 2. Milestone Overview

| # | Milestone | Primary Requirements | Files Touched |
|---|---|---|---|
| M1 | Stats Attribution Rewrite + SQLite Version Guard | SA01-SA13, SA15, NF-SA01-NF-SA05 | `db/stats-cache.ts`, `db/connection.ts` |
| M2 | Seat Eligibility Module + Grace-Period Alignment | SJ01-SJ06, SJ12-SJ13, NF-SJ01-NF-SJ02 | new `room/seat-eligibility.ts`; `room-handler.ts`, `game/disconnect-handler.ts`, `game/game-manager.ts`, shared message types |
| M3 | Queue Silent-Skip + Free-for-All Gating | SJ08-SJ11, NF-SJ03 | `room/seat-queue.ts`, `room-handler.ts` |
| M4 | DB Wipe Script | SA14 | new `scripts/wipe-stats-history.ts` |
| M5 | Client Rejection Dialog | SJ07 | `client/.../PreRoomView.tsx`, shared types |

**Key ordering change from the spec's implicit order**: grace-period alignment (M2) ships with the eligibility module rather than separately. Reason: REQ-F-SJ13.c ("grace elapsed + another player claims → original subject to SJ04-SJ06") is an integration scenario that cannot be tested until both systems have final semantics. Shipping them in one milestone removes the need to rewrite fixtures later.

---

## 3. Milestone Details

### M1 — Stats Attribution Rewrite + SQLite Version Guard

**Requirements**: SA01-SA13, SA15 (all stats attribution FRs except SA14 wipe); NF-SA01-NF-SA05.

**Changes**:
1. **SQLite version guard** (NF-SA05) — first code change. In `db/connection.ts::createDatabase`, read `PRAGMA sqlite_version` and assert ≥ 3.15.0 at startup. Abort on failure (no silent fallback). This must land first so the rest of the rewrite can use row-value IN.
2. **Game participation lookup** (SA01). Replace `userGames` query ([code/packages/server/src/db/stats-cache.ts:337-343](../code/packages/server/src/db/stats-cache.ts#L337-L343)) with:
   ```
   SELECT ... FROM games WHERE id IN (SELECT DISTINCT game_id FROM player_rounds WHERE user_id = ?)
   ```
   This makes `gamesPlayed = userGames.length` correct by construction.
3. **Game-won / loss diff gating** (SA02, SA03). `getUserSeat` may now return `null` for mid-game leavers. When null, skip `gamesWon`/`largestWinDiff`/`largestLossDiff` credit entirely.
4. **Tuple-filtered per-event stats** (SA04-SA08). Introduce `validGameRoundSeat: Set<"${gameId}-${roundNumber}-${seat}">` built from `myPlayerRounds`. Replace filter at [stats-cache.ts:408](../code/packages/server/src/db/stats-cache.ts#L408), [stats-cache.ts:435](../code/packages/server/src/db/stats-cache.ts#L435), and tighten the SQL `myPlays`/`myBombs` queries to filter on `(game_id, round_number, seat) IN (SELECT ... FROM player_rounds WHERE user_id = ?)`. Apply the same tuple filter to `dragon_gift_events`, `dog_play_events`, and `tricks.winner_seat` on the JS side.
5. **Per-round loop gating** (SA09-SA11). Build `myRoundsByGame: Map<gameId, Set<roundNumber>>` from `myPlayerRounds`. In the round loop at [stats-cache.ts:471-502](../code/packages/server/src/db/stats-cache.ts#L471-L502):
   - `oneTwoWins`/`oneTwoAgainst` — skip rounds the user didn't play.
   - Tie-break: still walk all rounds (needed for cumulative scores) but only credit `gamesRequiringTieBreak`/`mostTieBreakRoundsNeeded` if the user played at least one tie-break round.
   - Team derivation for mid-game leavers: use seat occupied during played rounds (single team per user is guaranteed by REQ-F-SJ04-SJ06, but assert and log if violated).
6. **New counters** (SA12, SA13). Populate `gamesForfeited` (has player_rounds row, not final occupant — regardless of team outcome) and `gamesJoinedAfterSpectating` (IS final occupant AND `min(round_number for user in game) > 1`). Per spec conversation, both columns already exist in the DB schema but were hardcoded to 0 — now properly populated. **Planning note**: confirm columns exist during M1 Step A; if they don't, REQ-NF-SA01 forbids adding them.
7. **`bomb_events` confirmed out of user-attributed stats** (settles spec §10 deferred #2). No change needed to `bomb_events` — only `bomb_inventory` gets tuple filtering.
8. **R7 verification** (spec §10 deferred #3). Before committing M1, grep `game-manager.ts` + `game-store.ts` crash-recovery paths to confirm `player_rounds` rows are written atomically at round-end. If not, file a follow-up risk.

**Reuse**: `sql`/`db.all` helpers from `db/sql-util.ts`; `getUserSeat`, `getUserTeamStr`, `getTeam`, `getPartner`, `getOpponentSeats` helpers already in stats-cache.ts.

**Tests** (extend `code/packages/server/tests/db/stats-cache.test.ts`):
- `describe('mid-game attribution')` block with 6 fixture scenarios:
  1. Shared seat: A rounds 1-4, B rounds 5-8 at seat N, team wins → A gets `gamesPlayed=1, gamesWon=0, gamesForfeited=1`, plays/bombs only from rounds 1-4; B gets `gamesPlayed=1, gamesWon=1, gamesJoinedAfterSpectating=1` (if `min > 1`), plays only from 5-8.
  2. Shared seat on losing team — same but team loses. A: `gamesPlayed=1, gamesForfeited=1`; B: `gamesPlayed=1, largestLossDiff=N`.
  3. Bot replaces human: A rounds 1-3, bot 4-8 → A: `gamesPlayed=1, gamesForfeited=1`; bot not attributed.
  4. Clean game (no swaps) — regression guard, existing behavior unchanged.
  5. Late joiner with 1-2 finish in unplayed round: user holds `player_rounds` 5-8, round 2 had 1-2 → `oneTwoWins=0`.
  6. Tie-break partially played: user plays rounds 1-4, tie-break rounds 9-10 → `gamesRequiringTieBreak=0` (no tie-break round played).
- **Property sweep for SA15**: parametric `describe.each` over all fixtures asserting `gamesWon XOR gamesForfeited` for each user/game pair.
- Existing tests must continue to pass unchanged (NF-SA03).

**Coverage gate**: add `coverage.thresholds.perFile` entry in `vitest.config.ts` for `src/db/stats-cache.ts` ≥ 80% statements. Verify after tests pass.

**Verification commands**:
```
cd code && pnpm --filter @tichu/server test
cd code && pnpm --filter @tichu/server test:coverage
cd code && pnpm typecheck && pnpm lint
```

---

### M2 — Seat Eligibility Module + Grace-Period Alignment

**Requirements**: SJ01-SJ06, SJ12-SJ13, NF-SJ01-NF-SJ02.

**Changes**:
1. **New module** `code/packages/server/src/room/seat-eligibility.ts` with pure functions:
   - `isPreviousOccupantOfSeat(db, gameId, userId, seat) -> boolean` — checks for any `player_rounds` row matching the triple.
   - `getPreviousSeat(db, gameId, userId) -> Seat | null` — returns the seat the user previously held (if any).
   - `validateClaim(db, gameId, userId, requestedSeat, currentOccupant) -> ClaimResult` — discriminated union `{ kind: 'allowed' } | { kind: 'rejected', reason, originalSeat, currentOccupantDisplayName?, offerClaimOriginal: boolean }`.
   - `isClaimValidationActive(game) -> boolean` — returns true once round 1 has dealt cards (REQ-F-SJ01); before that, all eligibility checks short-circuit to `allowed`.
2. **New shared message type** `SEAT_CLAIM_REJECTED` in `@tichu/shared` — payload: `{ reason: string, originalSeat: Seat, requestedSeat: Seat, currentOccupant: { displayName: string } | null, offerClaimOriginal: boolean }`. No change to REST surface — satisfies REQ-NF-SA02.
3. **Wire validation into all seat-claim entry points in `room-handler.ts`**:
   - `handleClaimSeat` (~line 892): call `validateClaim` before delegating to `SeatQueue.handleClaim`.
   - `handleChooseSeat` (~line 534): call `validateClaim` before `game.handleChooseSeat`.
   - `handleJoinRoom` mid-game branch (~line 102): when the function seats the user (not just spectates), call `validateClaim`.
   - `handleAddBot` / `handleRemoveBot`: no user-validation needed; bots don't have user IDs. But ensure bot displacement on user reclaim (REQ-F-SJ04) is handled in `validateClaim → allowed` flow.
4. **Broadcaster**: add `sendStructuredError(ws, payload: SEAT_CLAIM_REJECTED)` method in `ws/broadcaster.ts`. The existing `sendError(ws, code, msg)` stays for simple cases.
5. **Grace-period alignment** (SJ12, SJ13). This is a behavior change, not just a cosmetic rename:
   - **Current state**: `disconnect-handler.ts` runs a 45-second vote-based keep/kick scheme on involuntary disconnects. `LEAVE_ROOM` releases immediately.
   - **Target state**: Involuntary disconnect → seat held for 60 seconds (configurable via constructor option, same pattern as existing `voteTimeoutMs`). Reconnect within window restores seat without validation. Voluntary `LEAVE_ROOM` and kick release immediately (existing behavior — verify, adjust if needed). Grace elapsed → seat released and enters queue/free-for-all; returning user now subject to SJ04-SJ06.
   - **Scope of removal**: the vote-based keep/kick mechanism is replaced by a passive timer. The `DISCONNECT_VOTE_UPDATE` client message and any vote UI in the client become dead and should be removed or stubbed.
   - Files: `game/disconnect-handler.ts`, `game/game-manager.ts`, `ws/connection-manager.ts` (distinguish WebSocket close/error from explicit LEAVE_ROOM).

**Reuse**:
- `DisconnectHandler` constructor-options pattern for injected clock (fake-timer testing).
- Existing `sendError` pattern in `broadcaster.ts` as the shape reference for `sendStructuredError`.
- `insertTestGame`/`insertUser` fixtures from `stats-cache.test.ts`.
- `reconnection-ttl.test.ts` fake-timer pattern for grace-period tests.

**Tests**:
- New `code/packages/server/tests/room/seat-eligibility.test.ts` — pure-function unit tests covering every branch of `validateClaim` (SJ03, SJ04, SJ05, SJ06 a/b/c, SJ01 pre-deal bypass).
- Extend `tests/room/room-handler.test.ts` — `describe.each` block parameterized over `[CLAIM_SEAT, CHOOSE_SEAT, JOIN_ROOM mid-game]` entry points, same assertions for each (directly addresses NF-SJ02).
- Forged-client test: bypass client-side pre-filter → server rejects (NF-SJ01).
- Extend `tests/game/disconnect-handler.test.ts` — fake-timer tests: involuntary drop → 60s hold → reconnect restores; 60s expires → seat released; voluntary LEAVE → immediate; kick → immediate; grace elapsed + another user claims → original user's return subject to eligibility rule (integration test in `tests/integration/`).
- R3 regression: "user at seat N, disconnect+reconnect to same seat within grace → eligibility predicate never invoked" (spy-based negative assertion).

**Coverage gate**: add `coverage.thresholds.perFile` for `src/room/seat-eligibility.ts` ≥ 80%, `src/room/room-handler.ts` ≥ 80% (for touched paths), `src/game/disconnect-handler.ts` ≥ 80%.

---

### M3 — Queue Silent-Skip + Free-for-All Gating

**Requirements**: SJ08-SJ11, NF-SJ03.

**Changes**:
1. **Extend `SeatQueueCallbacks`** in `room/seat-queue.ts`:
   - Add `onCheckEligibility(userId: string, seat: Seat) -> boolean` — dependency-injection of the M2 eligibility predicate. Keeps SeatQueue pure/testable.
2. **Silent-skip in `offerToSpectator`**: before offering, call `onCheckEligibility` for each available seat. If the spectator is ineligible for ALL available seats, log and advance `currentIndex` without sending `SEAT_OFFERED`. Spectator order is preserved — do not reorder or recycle.
3. **Free-for-all ineligibility rejection** (SJ10, SJ11): in `handleUpForGrabsClaim`, if `onCheckEligibility` returns false for the requested seat (or any seat if auto-assign), emit a `SEAT_CLAIM_REJECTED` with the exact REQ-F-SJ11 text verbatim:
   > *"You are ineligible to take the empty seat because you previously sat in a different seat during this game. You must wait for your previous seat to become available before you can join the game."*
4. **Wire callback** in `room-handler.ts` at SeatQueue construction (where `new SeatQueue(...)` is instantiated).

**Reuse**: existing `seat-queue.test.ts` mock-callback pattern; `empty-seat-flow.test.ts` for integration.

**Tests** (extend `tests/room/seat-queue.test.ts` and `tests/integration/empty-seat-flow.test.ts`):
- All-eligible (regression) — existing behavior unchanged.
- 2-of-4 spectators ineligible — assert: only 2 offers emitted, skipped spectators receive no `SEAT_OFFERED`, spectator list order preserved post-processing, server logs the skips.
- All spectators ineligible → transitions to up-for-grabs.
- Free-for-all ineligible claim → exact-text-match assertion on rejection payload (SJ11).
- Spectator order invariant: after skip/decline/accept combos, `spectatorOrder` minus any accepting spectator is identical to pre-processing minus acceptor (SJ09).

**Coverage gate**: add `coverage.thresholds.perFile` for `src/room/seat-queue.ts` ≥ 80%.

---

### M4 — DB Wipe Script

**Requirements**: SA14.

**Changes**:
1. **Create** `code/packages/server/scripts/wipe-stats-history.ts`:
   - Operator-run CLI (not auto-invoked). Takes a DB path argument or uses the default configured one.
   - Prints preconditions + explicit confirmation prompt (`y/N`) before wiping.
   - In a single transaction, delete all rows from the 13 tables listed in REQ-F-SA14: `games`, `game_rounds`, `player_rounds`, `plays`, `tricks`, `bomb_inventory`, `bomb_events`, `dog_play_events`, `dragon_gift_events`, `wish_events`, `stats_cache`, `relational_stats_cache`, `player_global_stats`.
   - Does NOT touch: `users`, `active_games`, `active_rooms`.
   - Prints row-count diff.
2. **Add script entry** in `code/packages/server/package.json` under `scripts`: `"wipe-stats": "tsx scripts/wipe-stats-history.ts"`.

**Reuse**: `createDatabase` from `db/connection.ts`.

**Tests** (new `tests/scripts/wipe-stats-history.test.ts`):
- Seed an in-memory DB with non-trivial row counts in all 13 targeted tables + preserved tables.
- Invoke the wipe (bypass the confirmation prompt via a `--force` flag or injected stdin).
- Assert: all 13 targeted tables have 0 rows; `users`/`active_games`/`active_rooms` row counts unchanged.

**Coverage gate**: script coverage is less critical; a single integration test exercising the happy path suffices.

---

### M5 — Client Rejection Dialog

**Requirements**: SJ07.

**Changes**:
1. **Modify** `code/packages/client/src/components/game/PreRoomView.tsx`:
   - Handle incoming `SEAT_CLAIM_REJECTED` message. Render a dialog with the `reason` text plus conditional `"Claim seat {originalSeat} instead"` button when `offerClaimOriginal === true`.
   - Dismiss dialog on close; claim-original-seat button dispatches a new `CLAIM_SEAT` with `seat = originalSeat`.
2. **Shared message type** — if not already added in M2, add `SEAT_CLAIM_REJECTED` to the shared types package.

**Reuse**: any existing modal/dialog component pattern in the client. If none exists, introduce a minimal inline dialog (no new design system).

**Tests** (extend or create `tests/components/PreRoomView.test.tsx`):
- Render with a mock `SEAT_CLAIM_REJECTED` message → assert dialog text matches, "claim original" button present when `offerClaimOriginal=true`.
- Click "claim original" → assert `CLAIM_SEAT` sent with correct `seat`.

**Coverage gate**: ≥ 80% on the touched PreRoomView paths.

---

## 4. Requirements Traceability Matrix (RTM)

The RTM lives at [specifications/RTM-stats-attribution-and-seat-join-validation.md](../specifications/RTM-stats-attribution-and-seat-join-validation.md), seeded with all requirement IDs in the spec, status `Not Started`, and milestone assignments per the table below. It will be updated at every Step A (file:line, status `In Progress`) and Step D (status `Passed`/`Failed`) of each milestone.

| Req ID | Milestone |
|---|---|
| SA01–SA13, SA15 | M1 |
| SA14 | M4 |
| NF-SA01–NF-SA05 | M1 |
| SJ01–SJ06 | M2 |
| SJ07 | M5 |
| SJ08–SJ11 | M3 |
| SJ12–SJ13 | M2 |
| NF-SJ01–NF-SJ02 | M2 |
| NF-SJ03 | M2 (eligibility), M3 (queue), M5 (client) |

---

## 5. Critical Files

- [code/packages/server/src/db/stats-cache.ts](../code/packages/server/src/db/stats-cache.ts) — M1 attribution rewrite (~400+ lines affected)
- [code/packages/server/src/db/connection.ts](../code/packages/server/src/db/connection.ts) — M1 SQLite version guard
- **NEW** `code/packages/server/src/room/seat-eligibility.ts` — M2
- [code/packages/server/src/room/room-handler.ts](../code/packages/server/src/room/room-handler.ts) — M2 wiring, M3 callback wiring
- [code/packages/server/src/room/seat-queue.ts](../code/packages/server/src/room/seat-queue.ts) — M3 silent-skip + free-for-all
- [code/packages/server/src/game/disconnect-handler.ts](../code/packages/server/src/game/disconnect-handler.ts) — M2 grace-period alignment (replaces vote logic)
- [code/packages/server/src/game/game-manager.ts](../code/packages/server/src/game/game-manager.ts) — M2 voluntary-vs-involuntary dispatch
- [code/packages/server/src/ws/broadcaster.ts](../code/packages/server/src/ws/broadcaster.ts) — M2 `sendStructuredError`
- [code/packages/client/src/components/game/PreRoomView.tsx](../code/packages/client/src/components/game/PreRoomView.tsx) — M5 dialog
- **NEW** `code/packages/server/scripts/wipe-stats-history.ts` — M4
- **NEW** `code/packages/server/tests/room/seat-eligibility.test.ts` — M2
- **NEW** `code/packages/server/tests/scripts/wipe-stats-history.test.ts` — M4
- Extended tests: `tests/db/stats-cache.test.ts`, `tests/room/room-handler.test.ts`, `tests/room/seat-queue.test.ts`, `tests/game/disconnect-handler.test.ts`, `tests/integration/empty-seat-flow.test.ts`

---

## 6. Risks & Mitigations

| Risk | Addressed By |
|---|---|
| R1 — SQLite row-value IN unsupported | M1 change #1: runtime PRAGMA check at startup, abort if < 3.15 |
| R3 — Legitimate reconnect blocked | M2 includes a dedicated regression test: reconnect does NOT invoke eligibility predicate for same-seat path |
| R5 — Vote scheme vs. 1-min grace divergence | M2 explicitly removes vote-based keep/kick |
| R7 — `player_rounds` incomplete on crash | M1 planning Step A will grep `game-manager.ts`/`game-store.ts` to verify atomic round-end write; file follow-up if broken |
| Spec §10 #1 — grace current impl | Addressed in M2 implementation |
| Spec §10 #2 — `bomb_events` | Resolved pre-plan: not user-attributed, no tuple filter needed |
| Spec §10 #3 — rejection message shape | Resolved in M2 design: new `SEAT_CLAIM_REJECTED` typed message |
| SA12/SA13 schema columns may not exist | M1 Step A verifies; per spec conversation the columns exist but are hardcoded to 0 — this plan only populates them. If columns truly missing, REQ-NF-SA01 forbids adding → fall back to in-memory-only counters or flag blocker |

---

## 7. Verification Strategy

**Per-milestone (Phase 2 Steps B, B.5, B.6 of diligent-developer)**:
- `pnpm --filter @tichu/server test` (or client for M5) — all tests pass
- `pnpm --filter @tichu/server test:coverage` — per-file ≥ 80% thresholds enforced in `vitest.config.ts`
- `pnpm typecheck` and `pnpm lint` clean across all affected packages

**Pre-PR (Phase 3)**:
- Full test suite green across all packages
- Manual smoke test per spec Success Metric 5: a 4-player game exercising mid-game bot takeover, spectator-queue promotion, an attempted cross-seat reclaim, and an involuntary disconnect+reconnect — all produce correct stats and correct join behavior.
- Dry-run of wipe script against a dev DB fixture.

---

## 8. Out of Scope (Explicit)

Per spec §2 "Out of scope": relational stats cache attribution fix (file follow-up), fractional-credit stats, UI badges for partial games, schema changes to `games` table, intra-round-takeover `player_rounds` capture.

---

## 9. Behavioral Change Callout

**The 1-minute grace-period alignment deletes an existing user-visible feature**: the current code has a vote-based keep/kick dialog when a player disconnects mid-game. The spec (REQ-F-SJ12) replaces this with a passive 1-minute hold — no vote, no dialog. This is the spec's intended behavior; recording here for documentation lineage.

---

## 10. Revision History

- **2026-04-22** — Initial plan. Derived from approved spec. Milestone ordering adjusts spec's implicit order by moving grace-period alignment into M2 (rather than a standalone milestone) since SJ13.c acceptance requires both eligibility + final grace semantics.
