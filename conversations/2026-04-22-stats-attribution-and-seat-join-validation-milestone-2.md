# Milestone 2 — Seat Eligibility Module + Grace-Period Alignment

**Branch**: `bugfix/stats-attribution-midgame`
**Spec**: [../specifications/2026-04-22-stats-attribution-and-seat-join-validation.md](../specifications/2026-04-22-stats-attribution-and-seat-join-validation.md)
**Plan**: [../plans/2026-04-22-stats-attribution-and-seat-join-validation.md](../plans/2026-04-22-stats-attribution-and-seat-join-validation.md)
**RTM**: [../specifications/RTM-stats-attribution-and-seat-join-validation.md](../specifications/RTM-stats-attribution-and-seat-join-validation.md)
**Requirements delivered**: REQ-F-SJ01, SJ02, SJ03, SJ04, SJ05, SJ06, SJ12, SJ13; REQ-NF-SJ01, NF-SJ02, NF-SJ03 (M2 slice)

---

## Summary

M2 delivers the server-authoritative seat-claim eligibility engine and realigns the disconnect handler with the passive grace-period spec (SJ12/SJ13), replacing the legacy 45s keep/kick vote scheme. The rule is evaluated uniformly at three entry points so a forged client cannot bypass it.

### What shipped

**New module — `code/packages/server/src/room/seat-eligibility.ts`**
- Pure, data-source-agnostic `validateClaim(originalSeat, requestedSeat, occupants): ClaimResult`
- `isClaimValidationActive()` gate for SJ01 (engages at round-1 deal)
- Discriminated union result: `{ kind: 'allowed' }` or `{ kind: 'rejected', reason, originalSeat, requestedSeat, currentOccupantDisplayName, offerClaimOriginal }`
- Branches SJ04 (same-seat empty/bot → allowed), SJ05 (same-seat human → rejected, names occupant), SJ06a (cross-seat, original empty → offer reclaim), SJ06b (cross-seat, original human → no offer), SJ06c (cross-seat, original bot → offer reclaim)

**Wiring — `code/packages/server/src/room/room-handler.ts`**
- Three entry points share `checkSeatClaimEligibility`:
  - `handleClaimSeat` (line 984) — direct CLAIM_SEAT with explicit seat
  - `handleChooseSeat` (line 572) — lobby seat selection
  - `handleJoinRoom` (line 156) — mid-game JOIN_ROOM anticipates next-seat pick
- `buildOccupantMap` projects `RoomManager` seat state into `SeatOccupant` shape

**GameManager lookup helpers — `code/packages/server/src/game/game-manager.ts`**
- `getPreviousSeatForUser(userId)` walks finalized rounds then current round
- `hasRoundBeenDealt()` → true when `rounds.length > 0 || getCurrentRound() !== null`
- Both exposed for room-handler to compute `originalSeat` without DB hit during live play

**Disconnect handler rewrite — `code/packages/server/src/game/disconnect-handler.ts`**
- Replaced `VoteSession` with passive `GraceSession` (default 60_000ms)
- `handleDisconnect` broadcasts PLAYER_DISCONNECTED and starts/extends a single per-room timer — no more `DISCONNECT_VOTE_REQUIRED`/`DISCONNECT_VOTE_UPDATE`
- `handleReconnect` cancels the timer and broadcasts PLAYER_RECONNECTED; seat restored in place without re-validation (SJ12)
- On expiry → `onVoteResult('kick', seats)` (callback signature preserved; downstream seat-queue wiring unchanged)
- `handleVote` is a back-compat no-op (returns `'pending'`) — the `DISCONNECT_VOTE` client message still exists in the protocol but is ignored until M5 drops the UI
- `hasActiveVote` now always returns false, removing the accidental block on unrelated votes during a grace hold

### Test coverage

| File | Tests | Result |
|---|---|---|
| `tests/room/seat-eligibility.test.ts` | 15 | pass |
| `tests/room/room-handler.test.ts` (NF-SJ02 block) | 5 added (24 total) | pass |
| `tests/game/disconnect-handler.test.ts` | 22 (full rewrite for SJ12/SJ13) | pass |
| `tests/integration/empty-seat-flow.test.ts` | 9 (4 grace-scheme rewrites) | pass |
| **Full server suite** | **782** | **782 pass** |

Coverage (v8):
- `seat-eligibility.ts`: 100% stmts / 88.23% branches / 100% funcs
- `disconnect-handler.ts`: 100% stmts / 93.93% branches / 100% funcs
- Server aggregate: 81.71% statements

Typecheck: `pnpm --filter @tichu/server typecheck` clean.
Lint: pre-existing environmental failure (eslint not installed — noted in memory audit, not M2 regression).

---

## Key decisions

### 1. Pure rule module, caller supplies data
`validateClaim` takes `originalSeat` and `occupants` as parameters rather than calling into `GameManager` or querying `player_rounds` directly. Callers (room-handler for live games, future M3/M5 paths) do the lookup and hand in a plain snapshot. Rationale: zero DB/in-memory coupling makes the rule trivially unit-testable without fixtures, and lets the same module serve both live-game and post-crash paths.

### 2. Three entry points converge at `checkSeatClaimEligibility`
Rather than inline the validation in each WebSocket handler, `room-handler.ts` has one private method invoked from all three paths. This is the NF-SJ02 contract — "uniform validation regardless of entry point" — and the test explicitly exercises all three with the same stub game state to prove the contract holds.

### 3. Preserve `DisconnectHandler` API surface despite scheme swap
The vote scheme was removed but the public API (`handleVote`, `getVoteStatus`, `hasActiveVote`, `onVoteResult`) is retained:
- `handleVote` is a back-compat no-op so the `DISCONNECT_VOTE` client message (still defined in the shared protocol) is accepted-but-ignored until M5 drops the UI
- `getVoteStatus` returns the same shape (`votes`, `disconnectedSeats`, `timeoutMs`) with `votes` now always empty-null, so the client's state projection continues to render the "player disconnected" indicator + countdown without any shared-schema churn
- `onVoteResult` callback still fires `'kick'` on expiry, so `game-manager.ts` and the seat-queue pipeline downstream required zero changes

This kept the M2 blast radius to the handler module itself plus its tests — no protocol churn into `@tichu/shared`, no changes to game-manager wiring.

### 4. CLAIM_SEAT test uses injected mock queue
The seat-queue flow for a real spectator → vacation → CLAIM_SEAT is orchestration-heavy to set up in a unit test. Instead, the NF-SJ02 test injects a mock queue via `(handler as any).seatQueues.set(roomCode, mockQueue)` to assert that CLAIM_SEAT rejection short-circuits before any queue callback fires. Direct structural assertion is sharper than a flakier end-to-end setup.

### 5. Fake-timer grace tests
All SJ12/SJ13 tests use `vi.useFakeTimers()` + `vi.advanceTimersByTime()` — no `await sleep(60s)` anywhere. Makes the full disconnect-handler suite run in <20ms.

---

## Bugs caught during M2

**Mock ConnectionManager missing `assignAsSpectator`** — the room-handler's JOIN_ROOM spectator branch calls `this.connections.assignAsSpectator(ws, roomCode)`. The test mock omitted it. `undefined(…)` threw, the outer try/catch swallowed it, the CLAIM_SEAT test's Bob was never marked in the room, and CLAIM_SEAT returned NOT_IN_ROOM before reaching the eligibility gate — producing "0 calls to sendSeatClaimRejected." Fix: added `assignAsSpectator: vi.fn((ws, roomCode) => { info.roomCode = roomCode; info.seat = null; })` to the mock factory. (Pre-existing test-infra gap, not M2 code.)

**Integration regressions from handler rewrite** — 4 tests in `empty-seat-flow.test.ts` were asserting against the old vote scheme (`handleVote('kick')` → resolution, `getVoteStatus.votes` populated, `voteTimeoutMs` constructor arg). All four were rewritten to the grace model: advance fake timers to trigger expiry, assert `'kick'` outcome from expiry callback, assert empty-null votes map.

---

## Files touched

**Code**
- `code/packages/server/src/room/seat-eligibility.ts` (new, 131 lines)
- `code/packages/server/src/room/room-handler.ts` (3 entry points wired, 2 private helpers added)
- `code/packages/server/src/game/game-manager.ts` (`getPreviousSeatForUser`, `hasRoundBeenDealt`)
- `code/packages/server/src/game/disconnect-handler.ts` (full rewrite, vote scheme → passive grace)

**Tests**
- `code/packages/server/tests/room/seat-eligibility.test.ts` (new, 177 lines, 15 tests)
- `code/packages/server/tests/room/room-handler.test.ts` (NF-SJ02 describe block added, mock fixes)
- `code/packages/server/tests/game/disconnect-handler.test.ts` (full rewrite, 22 tests)
- `code/packages/server/tests/integration/empty-seat-flow.test.ts` (4 describes rewritten, mock updated)

**Traceability**
- `specifications/RTM-stats-attribution-and-seat-join-validation.md` — SJ01-SJ06, SJ12-SJ13, NF-SJ01-NF-SJ03 marked Passed with file:line

**Artifacts**
- `results/Milestone2/tests/test-results.json`
- `results/Milestone2/coverage/` (full v8 HTML + JSON report)

---

## Verification

```bash
cd code
pnpm --filter @tichu/server test                # 782/782 pass
pnpm --filter @tichu/server test:coverage       # aggregate 81.71%
pnpm --filter @tichu/server typecheck           # clean
```

## Next

M3 — Queue Integration (REQ-F-SJ08, SJ09, SJ10, SJ11): queue silently skips ineligible spectators, free-for-all entry, preserves order across skip/decline/accept.
