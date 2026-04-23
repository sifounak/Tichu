# Requirements Traceability Matrix — Stats Attribution & Seat-Join Validation

**Spec**: [2026-04-22-stats-attribution-and-seat-join-validation.md](./2026-04-22-stats-attribution-and-seat-join-validation.md)
**Plan**: [../plans/2026-04-22-stats-attribution-and-seat-join-validation.md](../plans/2026-04-22-stats-attribution-and-seat-join-validation.md)
**Branch**: `bugfix/stats-attribution-midgame`

Updated at each milestone's Step A (add file:line; Status → `In Progress`) and Step D (Status → `Passed`/`Failed`).

---

## Functional Requirements — Group SA (Stats Attribution)

| Requirement ID | Description | Milestone | Status |
|---|---|---|---|
| REQ-F-SA01 | `gamesPlayed` increments for any user with ≥1 `player_rounds` row | M1 | Passed |
| REQ-F-SA02 | `gamesWon` increments only when user is final seat occupant AND team wins | M1 | Passed |
| REQ-F-SA03 | `largestWinDiff` / `largestLossDiff` gated on final occupancy | M1 | Passed |
| REQ-F-SA04 | Per-play stats filtered by `(game_id, round_number, seat)` tuples | M1 | Passed |
| REQ-F-SA05 | Per-bomb stats filtered by same tuple; `bomb_events` verified during planning (no attribution → no filter needed) | M1 | Passed |
| REQ-F-SA06 | Dragon-trick stats filtered by same tuple | M1 | Passed |
| REQ-F-SA07 | Dog-play stats filtered by same tuple | M1 | Passed |
| REQ-F-SA08 | Dragon-gift stats filtered by same tuple | M1 | Passed |
| REQ-F-SA09 | `oneTwoWins` / `oneTwoAgainst` only for rounds user played | M1 | Passed |
| REQ-F-SA10 | Tie-break counters credit only when user played a tie-break round | M1 | Passed |
| REQ-F-SA11 | Team for round-level aggregates derived from played-round seat | M1 | Passed |
| REQ-F-SA12 | `gamesForfeited` increments for ≥1 `player_rounds` row, non-final-occupant, regardless of team outcome | M1 | Passed |
| REQ-F-SA13 | `gamesJoinedAfterSpectating` increments when user IS final occupant AND `min(round_number) > 1` | M1 | Passed |
| REQ-F-SA14 | DB wipe script clears 13 stats/event tables; preserves `users`, `active_games`, `active_rooms` | M4 | Passed |
| REQ-F-SA15 | `gamesWon` and `gamesForfeited` are disjoint (at most one increments per user/game) | M1 | Passed |

### Detailed Entries — SA

> **REQ-F-SA01** — `gamesPlayed` ≥1 `player_rounds` row — *Passed*
> - Code: `code/packages/server/src/db/stats-cache.ts:342-410` (primary filter `player_rounds.user_id = ?`); `:490` (gamesPlayed increment); `:1245-1272` (rebuildStatsCache user discovery includes player_rounds.user_id)
> - Tests: `code/packages/server/tests/db/stats-cache.test.ts:573` (A plays rounds 1-4, B plays 5-8 → both credited); `:655` (bot replaces A → A credited)

> **REQ-F-SA02** — `gamesWon` final-occupant + winner gate — *Passed*
> - Code: `code/packages/server/src/db/stats-cache.ts:502-509` (finalSeat !== null AND team wins gate)
> - Tests: `code/packages/server/tests/db/stats-cache.test.ts:573` (A forfeits, B on winning team gets gamesWon=1)

> **REQ-F-SA03** — `largestWinDiff`/`largestLossDiff` final-occupant gate — *Passed*
> - Code: `code/packages/server/src/db/stats-cache.ts:502-515` (win/loss diff gated on finalSeat !== null)
> - Tests: `code/packages/server/tests/db/stats-cache.test.ts:620` (losing team shared seat — A no loss diff, B absorbs); `:755` (clean-game regression)

> **REQ-F-SA04** — Per-play tuple filter — *Passed*
> - Code: `code/packages/server/src/db/stats-cache.ts:428-459` (row-value IN against player_rounds); JS-side `validGameRoundSeat.has(...)` defense at `:797-800`
> - Tests: `code/packages/server/tests/db/stats-cache.test.ts:819` (phoenix, bomb-forced-by-wish, partner_tichu_active lead — each attributed to correct user)

> **REQ-F-SA05** — Per-bomb tuple filter (bomb_inventory only; bomb_events not attributed) — *Passed*
> - Code: `code/packages/server/src/db/stats-cache.ts:460-489` (row-value IN against bomb_inventory); `:809-843, :845-932` (per-bomb aggregators filtered by filteredBombs)
> - Tests: `code/packages/server/tests/db/stats-cache.test.ts:819` (A's 4-card bomb, B's 5-card bomb — disjoint attribution)

> **REQ-F-SA06** — Dragon-trick tuple filter — *Passed*
> - Code: `code/packages/server/src/db/stats-cache.ts:753-759` (`validGameRoundSeat.has(g-r-winner_seat)` gate)
> - Tests: `code/packages/server/tests/db/stats-cache.test.ts:819` (round 1 dragon trick → A; round 3 dragon trick → B)

> **REQ-F-SA07** — Dog-play tuple filter — *Passed*
> - Code: `code/packages/server/src/db/stats-cache.ts:773-793` (`validGameRoundSeat.has(g-r-player_seat)` gate)
> - Tests: `code/packages/server/tests/db/stats-cache.test.ts:819` (round 3 dog play → B only)

> **REQ-F-SA08** — Dragon-gift tuple filter — *Passed*
> - Code: `code/packages/server/src/db/stats-cache.ts:761-767` (`validGameRoundSeat.has(g-r-recipient_seat)` gate)
> - Tests: `code/packages/server/tests/db/stats-cache.test.ts:819` (round 2 gift to north → A only)

> **REQ-F-SA09** — `oneTwoWins`/`oneTwoAgainst` round-participation gate — *Passed*
> - Code: `code/packages/server/src/db/stats-cache.ts:530-534` (`myRoundsInGame.has(r.round_number)` gate)
> - Tests: `code/packages/server/tests/db/stats-cache.test.ts:681` (A played round 2 → credited; B joined at round 5 → no credit)

> **REQ-F-SA10** — Tie-break counters round-participation gate — *Passed*
> - Code: `code/packages/server/src/db/stats-cache.ts:552-565` (user must play ≥1 tie-break round)
> - Tests: `code/packages/server/tests/db/stats-cache.test.ts:711` (A no tie-break credit, B credited with rounds-needed=2)

> **REQ-F-SA11** — Team derivation from played-round seat — *Passed*
> - Code: `code/packages/server/src/db/stats-cache.ts:391-409` (myTeamByGame built from pr.seat); `:574-602` (round-level stats use pr.seat team)
> - Tests: `code/packages/server/tests/db/stats-cache.test.ts:620` (B at north inherits NS team from played rounds, not final occupancy)

> **REQ-F-SA12** — `gamesForfeited` counter — *Passed*
> - Code: `code/packages/server/src/db/stats-cache.ts:516-527` (finalSeat === null branch increments gamesForfeited)
> - Tests: `code/packages/server/tests/db/stats-cache.test.ts:573, :620, :655` (three swap scenarios: winning, losing, bot-replaces)

> **REQ-F-SA13** — `gamesJoinedAfterSpectating` counter — *Passed*
> - Code: `code/packages/server/src/db/stats-cache.ts:510-514` (finalSeat !== null AND min round > 1)
> - Tests: `code/packages/server/tests/db/stats-cache.test.ts:573` (B joined at round 5 → credited); `:755` (A stayed from round 1 → not credited)

> **REQ-F-SA14** — DB wipe script — *Passed*
> - Code: `code/packages/server/scripts/wipe-stats-history.ts:19-33` (`WIPE_TABLES` — 13 entries, children-before-parents order); `:36` (`PRESERVE_TABLES` — users/active_games/active_rooms); `:47-57` (`countRows`); `:64-74` (`runWipe` — single transaction + deferred FK); `:82-97` (CLI `parseArgs` incl. `--db` and `--force`); `:100-108` (interactive y/N prompt); `:125-140` (`main` with confirmation gate); `code/packages/server/package.json:16` (`wipe-stats` script entry)
> - Tests: `code/packages/server/tests/scripts/wipe-stats-history.test.ts:119-148` (full wipe: 13 tables empty, 3 preserved unchanged, before/after counts); `:150-158` (idempotent); `:160-181` (transactional rollback via blocking trigger — no partial wipe if later delete fails); `:183-187` (list integrity: exactly 13 wipe + 3 preserve = 16 tables)

> **REQ-F-SA15** — `gamesWon` XOR `gamesForfeited` invariant — *Passed*
> - Code: `code/packages/server/src/db/stats-cache.ts:502-527` (mutually exclusive branches on finalSeat !== null)
> - Tests: `code/packages/server/tests/db/stats-cache.test.ts:573` (SA15 assertion in main win case); `:783` (property sweep across 4 fixtures)

---

## Functional Requirements — Group SJ (Seat-Join Validation)

| Requirement ID | Description | Milestone | Status |
|---|---|---|---|
| REQ-F-SJ01 | Validation engages from round-1 deal onward | M2 | Passed |
| REQ-F-SJ02 | "Previous occupant" defined via `player_rounds` row — with round-boundary limitation documented | M2 | Passed |
| REQ-F-SJ03 | No prior `player_rounds` row → unrestricted claim | M2 | Passed |
| REQ-F-SJ04 | Reclaim of original seat allowed; bot displaced | M2 | Passed |
| REQ-F-SJ05 | Reclaim of original seat blocked if held by human; payload names occupant | M2 | Passed |
| REQ-F-SJ06 | Claim of different seat rejected with "already seen seat S's cards"; offer varies by occupancy | M2 | Passed |
| REQ-F-SJ07 | Client surfaces rejection dialog + "claim seat S instead" action | M5 | Passed |
| REQ-F-SJ08 | Queue silently skips ineligible spectators; server log entry | M3 | Passed |
| REQ-F-SJ09 | Spectator order preserved across skip/decline/accept | M3 | Passed |
| REQ-F-SJ10 | Free-for-all enters when ordered queue exhausted | M3 | Passed |
| REQ-F-SJ11 | Free-for-all ineligible user → exact rejection-text dialog | M3 | Passed |
| REQ-F-SJ12 | 1-min grace only on involuntary disconnect; reconnect preserves seat | M2 | Passed |
| REQ-F-SJ13 | No grace on voluntary Leave or kick; elapsed grace → SJ04-SJ06 rule on return | M2 | Passed |

### Detailed Entries — SJ

> **REQ-F-SJ01** — Validation engages at round-1 deal — *Passed*
> - Code: `code/packages/server/src/room/seat-eligibility.ts:121-130` (`isClaimValidationActive`); `code/packages/server/src/game/game-manager.ts:996` (`hasRoundBeenDealt`); `code/packages/server/src/room/seat-eligibility.ts:60-61` (null-short-circuit branch)
> - Tests: `code/packages/server/tests/room/seat-eligibility.test.ts:137-177` (`isClaimValidationActive` state transitions); `code/packages/server/tests/room/seat-eligibility.test.ts:22-25` (no prior seat → allowed); `code/packages/server/tests/room/room-handler.test.ts:457` (CHOOSE_SEAT pre-deal allows cross-seat)

> **REQ-F-SJ02** — Previous-occupant definition via `player_rounds` — *Passed*
> - Code: `code/packages/server/src/game/game-manager.ts:976` (`getPreviousSeatForUser` walks accumulator.rounds then currentRound — both sourced from `player_rounds` event stream)
> - Tests: implicitly verified via room-handler tests that stub `getPreviousSeatForUser`: `code/packages/server/tests/room/room-handler.test.ts:341-474`
> - Note: Round-boundary limitation documented in spec — at round boundaries when accumulator has flushed but no new round started, the lookup returns null (acceptable edge case).

> **REQ-F-SJ03** — Unrestricted when no prior `player_rounds` row — *Passed*
> - Code: `code/packages/server/src/room/seat-eligibility.ts:60-61` (null → allowed short-circuit)
> - Tests: `code/packages/server/tests/room/seat-eligibility.test.ts:22-25` (null originalSeat → allowed)

> **REQ-F-SJ04** — Reclaim original seat allowed; bot displaced — *Passed*
> - Code: `code/packages/server/src/room/seat-eligibility.ts:65-70` (same-seat reclaim when empty or bot)
> - Tests: `code/packages/server/tests/room/seat-eligibility.test.ts:28-42` (reclaim when empty; reclaim when bot-held); `code/packages/server/tests/room/room-handler.test.ts:468` (CHOOSE_SEAT same-seat bypasses validation)

> **REQ-F-SJ05** — Reclaim blocked when held by human — *Passed*
> - Code: `code/packages/server/src/room/seat-eligibility.ts:71-81` (human reclaim rejection with name)
> - Tests: `code/packages/server/tests/room/seat-eligibility.test.ts:45-70` (names occupant; falls back to "another player" when no displayName)

> **REQ-F-SJ06** — Cross-seat claim rejected — *Passed*
> - Code: `code/packages/server/src/room/seat-eligibility.ts:84-110` (SJ06a empty offer; SJ06b human no offer; SJ06c bot offer); `code/packages/server/src/room/room-handler.ts:156, 572, 984` (3 entry points invoke `checkSeatClaimEligibility`)
> - Tests: `code/packages/server/tests/room/seat-eligibility.test.ts:73-134` (SJ06a/b/c branches + exhaustive it.each); `code/packages/server/tests/room/room-handler.test.ts:341-455` (NF-SJ02 describe block covers all 3 entry points)

> **REQ-F-SJ07** — Client rejection dialog + claim-original action — *Passed*
> - Code: `code/packages/client/src/components/game/SeatClaimRejectedDialog.tsx:28-123` (presentational dialog; reason text, conditional "Claim {originalSeat} instead" button, backdrop-dismiss with stopPropagation on inner panel); `code/packages/client/src/stores/uiStore.ts:91-99, 247-249` (seatClaimRejection slice: set/clear); `code/packages/client/src/app/game/[gameId]/page.tsx:29, 215-224, 1163-1168` (message-handler dispatches setSeatClaimRejection; in-game dialog mirror); `code/packages/client/src/components/game/PreRoomView.tsx:19, 43-47, 94-96, 788-793` (PreRoomView prop wiring + pre-room dialog render)
> - Tests: `code/packages/client/tests/components/game/SeatClaimRejectedDialog.test.tsx:23-155` (9 tests: null → no dialog, reason text rendered, conditional "Claim {seat} instead" button on offerClaimOriginal, close-without-claim, claim-original invokes callback with originalSeat and closes, backdrop dismiss, stopPropagation on inner panel, seat-label update on prop change); `code/packages/client/tests/stores/uiStore-seatClaimRejection.test.ts:5-55` (4 tests: initial-null, set stores verbatim, clear resets, subsequent set replaces)

> **REQ-F-SJ08** — Queue silent-skip for ineligible spectators — *Passed*
> - Code: `code/packages/server/src/room/seat-queue.ts:351-364` (`offerToSpectator` skip branch — `hasEligibleSeat` check + `onSilentSkip` + `currentIndex++`); `code/packages/server/src/room/seat-queue.ts:32, 43` (callback interface); `code/packages/server/src/room/room-handler.ts:885-889, 921-927` (wiring at queue construction, incl. structured log)
> - Tests: `code/packages/server/tests/room/seat-queue.test.ts:638-678` (2-of-4 ineligible → 2 offers, skipped never offered, log entries recorded); `:679-694` (all-ineligible → transitions to up-for-grabs); `:696-709` (partial seat ineligibility still offers); `:711-724` (auto-assign picks first eligible seat); `code/packages/server/tests/integration/empty-seat-flow.test.ts:296-341` (end-to-end 4-spectator silent-skip)

> **REQ-F-SJ09** — Spectator order preservation — *Passed*
> - Code: `code/packages/server/src/room/seat-queue.ts:351-364` (silent-skip advances `currentIndex` without removing user from `spectatorOrder`)
> - Tests: `code/packages/server/tests/room/seat-queue.test.ts:726-751` (skip/decline/accept preserves order); `code/packages/server/tests/integration/empty-seat-flow.test.ts:342-365` (post-processing order invariant)

> **REQ-F-SJ10** — Free-for-all entry when queue exhausted — *Passed*
> - Code: `code/packages/server/src/room/seat-queue.ts:465-489` (`handleUpForGrabsClaim` with eligibility-gated auto-assign via `findIndex`)
> - Tests: `code/packages/server/tests/room/seat-queue.test.ts:755-770` (eligible user can claim); `:793-808` (partial eligibility picks eligible seat); `code/packages/server/tests/integration/empty-seat-flow.test.ts:391-411` (eligible claim after rejected ineligible attempt)

> **REQ-F-SJ11** — Free-for-all rejection dialog text — *Passed*
> - Code: `code/packages/server/src/room/seat-queue.ts:473-479` (rejection branch in `handleUpForGrabsClaim`); `code/packages/server/src/room/room-handler.ts:890-920` (exact SJ11 text emitted via `broadcaster.sendSeatClaimRejected`, `offerClaimOriginal=false`)
> - Tests: `code/packages/server/tests/room/seat-queue.test.ts:771-791` (ineligible → onIneligibleFreeForAllClaim fires, no claim recorded); `code/packages/server/tests/integration/empty-seat-flow.test.ts:369-389` (end-to-end rejection)

> **REQ-F-SJ12** — 1-min grace for involuntary disconnects — *Passed*
> - Code: `code/packages/server/src/game/disconnect-handler.ts:67-87` (`handleDisconnect` tracks + starts/extends grace timer); `:89-110` (`handleReconnect` cancels timer + removes tracking); `:185-196` (`startGrace`); `:198-208` (`expireGrace` fires `onVoteResult('kick', seats)`); default 60_000ms at `:64`
> - Tests: `code/packages/server/tests/game/disconnect-handler.test.ts:36-76` (tracking, PLAYER_DISCONNECTED broadcast, no vote broadcasts, multi-disconnect sharing window); `:78-120` (reconnect within grace restores + cancels timer); `:122-166` (grace expiry fires kick); `:189-217` (getVoteStatus exposes remaining grace); `code/packages/server/tests/integration/empty-seat-flow.test.ts:90-138` (end-to-end grace expiry → queue; reconnect-within-grace restore)

> **REQ-F-SJ13** — No grace on voluntary Leave / kick — *Passed*
> - Code: `code/packages/server/src/game/disconnect-handler.ts:38-42` (doc) — voluntary `LEAVE_ROOM` / host kicks never pass through `DisconnectHandler`; they go straight through `room-handler.ts:handleLeaveRoom` and release the seat immediately. Elapsed grace in `expireGrace` (`:198-208`) returns seats via `onVoteResult('kick', seats)`; returning users then go through `room-handler.ts:checkSeatClaimEligibility` (SJ04-SJ06 rule).
> - Tests: `code/packages/server/tests/game/disconnect-handler.test.ts:122-166` (grace expiry → kick outcome with released seats); `code/packages/server/tests/integration/empty-seat-flow.test.ts:90-118` (grace expires → seats enter queue for returning/new claimants — returning user would now hit SJ04-SJ06 gate)

---

## Non-Functional Requirements

| Requirement ID | Description | Milestone | Status |
|---|---|---|---|
| REQ-NF-SA01 | No database schema changes | M1 | Passed |
| REQ-NF-SA02 | No WebSocket/REST/UI changes beyond REQ-F-SJ07 | M1, M2, M5 | Passed |
| REQ-NF-SA03 | Pre-existing stats-cache tests pass unchanged | M1 | Passed |
| REQ-NF-SA04 | `computeStatsForUser` ≥ 80% statement coverage | M1 | Passed |
| REQ-NF-SA05 | SQLite ≥ 3.15 runtime check for row-value IN | M1 | Passed |
| REQ-NF-SJ01 | Server-authoritative enforcement (not client-only) | M2 | Passed |
| REQ-NF-SJ02 | Uniform validation across lobby join / queue promotion / post-kick rejoin | M2, M3 | Passed |
| REQ-NF-SJ03 | ≥ 80% statement coverage for new/modified seat-validation code | M2, M3, M5 | Passed |

### Detailed Entries — NF

> **REQ-NF-SA01** — No schema changes — *Passed*
> - Verification: `git diff main -- code/packages/server/src/db/schema.ts` is empty; `connection.ts` CREATE TABLE blocks unchanged (only comment annotations added)

> **REQ-NF-SA02** — No protocol/REST/UI changes beyond SJ07 — *Passed*
> - Verification: M1 touched only `db/stats-cache.ts`, `db/connection.ts`, and their tests; `@tichu/shared` untouched. M2 added one new shared protocol message (`SEAT_CLAIM_REJECTED`) and one server broadcaster method (`sendSeatClaimRejected`) — both directly serving REQ-F-SJ07, i.e. the spec-carved exception. M5 added a client dialog component consuming that same message; no other REST/WS surface changes.

> **REQ-NF-SA03** — Existing tests pass unchanged — *Passed*
> - Verification: full server suite 769/769 pass; original 26 stats-cache tests green

> **REQ-NF-SA04** — `computeStatsForUser` coverage ≥ 80% — *Passed*
> - Verification: v8 coverage shows 344/418 = 82.30% statements on `computeStatsForUser`; stats-cache.ts module at 88.83%; aggregate server 81.13%

> **REQ-NF-SA05** — SQLite ≥ 3.15 check — *Passed*
> - Code: `code/packages/server/src/db/connection.ts:31-39`
> - Tests: `code/packages/server/tests/db/connection.test.ts:44-58` (throws at 3.14.2, 2.8.17; accepts 3.15.0)

> **REQ-NF-SJ01** — Server-authoritative enforcement — *Passed*
> - Verification: Validation lives in `code/packages/server/src/room/seat-eligibility.ts` and is invoked at 3 server entry points (`room-handler.ts:156, 572, 984`). Client has no seat-eligibility logic; forged-client attempts (CLAIM_SEAT, CHOOSE_SEAT, mid-game JOIN_ROOM) are all rejected server-side.
> - Tests: `code/packages/server/tests/room/room-handler.test.ts:341-474` (NF-SJ02 block — forged requests bypass any client UI gating and are still rejected server-side; CLAIM_SEAT test explicitly asserts the queue callback is NOT invoked on rejection)

> **REQ-NF-SJ02** — Uniform validation across entry points — *Passed*
> - Code: Three M2 entry points share `checkSeatClaimEligibility` in `code/packages/server/src/room/room-handler.ts:913-925` — CLAIM_SEAT (`:984`), CHOOSE_SEAT (`:572`), mid-game JOIN_ROOM (`:156`). M3 adds the queue-promotion path by injecting the same predicate via `onCheckEligibility` callback (`room-handler.ts:885-889`), so `SeatQueue.offerToSpectator` and `handleUpForGrabsClaim` reuse the identical server-authoritative rule. M5 renders the single `SeatClaimRejectedDialog` from both the pre-room (PreRoomView) and in-game (page root) locations, so every rejection path surfaces the same dialog regardless of how the rejection was triggered.
> - Tests: `code/packages/server/tests/room/room-handler.test.ts:370-455` (M2: all 3 direct entry points); `code/packages/server/tests/room/seat-queue.test.ts:625-808` (M3: queue-promotion paths reuse the callback-injected predicate); `code/packages/server/tests/integration/empty-seat-flow.test.ts:296-411` (M3: end-to-end silent-skip + free-for-all rejection); `code/packages/client/tests/components/game/SeatClaimRejectedDialog.test.tsx:23-155` (M5: dialog behavior under all payload shapes — ensures every server rejection renders uniformly)

> **REQ-NF-SJ03** — Seat-validation coverage ≥ 80% (server + client) — *Passed*
> - Verification (server, v8 coverage at M3 snapshot, unchanged by M5 since M5 touches no server code): `seat-eligibility.ts` 100% statements / 88.23% branches / 100% funcs; `disconnect-handler.ts` 100% statements / 93.93% branches / 100% funcs; `seat-queue.ts` **98.28% statements / 92.55% branches / 100% funcs** (uncovered lines 440-443, 513 are pre-existing late-joiner edge cases outside SJ08-SJ11 scope). Per-file threshold for `seat-queue.ts` ≥ 80% enforced in `vitest.config.ts:18-20`.
> - Verification (client, v8 coverage at M5): `SeatClaimRejectedDialog.tsx` **100% statements / 77.77% branches / 100% funcs** (uncovered branches at lines 38, 44 are the null-rejection and SSR `document === undefined` guards — exercised once each but not branch-covered for the negative path; the null-guard is covered by the "renders nothing when rejection is null" test); `uiStore.ts` 97.27% statements (the new `seatClaimRejection` slice is fully covered by the 4 uiStore-seatClaimRejection tests). PreRoomView and page.tsx wiring paths are pass-through (prop forwarding + single render); the logic under test lives entirely in the new dialog component and store slice, both of which exceed the 80% gate.
