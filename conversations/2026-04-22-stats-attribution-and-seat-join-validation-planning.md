# Planning Conversation — Stats Attribution & Seat-Join Validation

**Date**: 2026-04-22
**Branch**: `bugfix/stats-attribution-midgame`
**Spec**: [specifications/2026-04-22-stats-attribution-and-seat-join-validation.md](../specifications/2026-04-22-stats-attribution-and-seat-join-validation.md)
**Plan**: [plans/2026-04-22-stats-attribution-and-seat-join-validation.md](../plans/2026-04-22-stats-attribution-and-seat-join-validation.md)
**RTM**: [specifications/RTM-stats-attribution-and-seat-join-validation.md](../specifications/RTM-stats-attribution-and-seat-join-validation.md)
**Preceded by**: [conversations/2026-04-22-stats-attribution-and-seat-join-validation-specification.md](./2026-04-22-stats-attribution-and-seat-join-validation-specification.md)

---

## Planning Summary

Planning resumed after the `[Spec]` commit on `bugfix/stats-attribution-midgame`. The spec had already been approved, so planning focused on turning its 28 functional requirements + 8 non-functional requirements into a milestone breakdown with grounded file-level change descriptions, test strategy, coverage gates, and an RTM seed.

Three planning phases ran:
1. **Structural exploration** — I read `stats-cache.ts` lines 300-759 directly, then dispatched one Explore subagent to survey seat-claim entry points, grace-period handling, client UI, DB schema, test patterns, `bomb_events` attribution, and SQLite version-check presence.
2. **Design critique** — one Plan subagent validated a draft 5-milestone structure against the spec.
3. **Plan finalization** — I wrote the plan incorporating the critique's recommendations.

---

## Key Planning Decisions

### 1. Milestone ordering — grace-period alignment moves into M2

**Decision**: Grace-period alignment (REQ-F-SJ12, SJ13) is implemented together with the seat-eligibility module in M2, not as a standalone milestone.

**Why**: REQ-F-SJ13.c acceptance ("grace elapsed + another player claims → original user subject to SJ04-SJ06 on return") is an integration scenario that requires both the eligibility rule AND the final grace semantics in place. Shipping them separately means writing fixture tests against an in-flight grace-period implementation in M2, then rewriting those fixtures in M4. Co-shipping avoids the rework.

**Trade-off**: M2 becomes a larger milestone (eligibility + grace + message types + three handler entry points + broadcaster method). Accepted — the spec treats these as one enforcement concern.

### 2. DB wipe script and client rejection dialog kept as separate milestones

**Decision**: M4 (wipe script, operator tool) and M5 (client dialog) are separate.

**Why**: They're orthogonal (different packages, different reviewers, different deployment windows). The draft plan paired them out of convenience — the Plan subagent correctly flagged that as artificial.

### 3. Vote-based keep/kick scheme is explicitly removed

**Decision**: The existing `DisconnectHandler` vote-based keep/kick (45-second timer) is replaced with a passive 1-minute hold for involuntary disconnects only. The `DISCONNECT_VOTE_UPDATE` WebSocket message and any client vote UI become dead code.

**Why**: REQ-F-SJ12 and REQ-F-SJ13 read literally — 1-minute grace, no mention of a vote. REQ-F-SJ13 explicitly states "Existing reconnect/disconnect code shall be aligned to this specification where it diverges." This is a user-visible behavior change (players previously saw a vote dialog), flagged in plan §9 for documentation lineage.

### 4. `bomb_events` does NOT need tuple filtering (settles spec §10 deferred #2)

**Decision**: Only `bomb_inventory` gets tuple-filter treatment. `bomb_events` is not user-attributed in `computeStatsForUser`; it records timing and side-effects, not per-user stats.

**Why**: Confirmed via Explore subagent survey of stats-cache.ts. REQ-F-SA05's "if used for user-attributed stats" clause is satisfied vacuously.

### 5. SQLite version check is the FIRST code change in M1

**Decision**: Add `PRAGMA sqlite_version` check in `db/connection.ts::createDatabase` at startup. Assert ≥ 3.15.0; abort on failure, no silent fallback.

**Why**: The rest of M1 uses row-value IN syntax (`(game_id, round_number, seat) IN (...)`), which requires SQLite ≥ 3.15. Failing fast at startup is clearer than debugging a mid-query failure. Addresses R1.

### 6. Dependency-injection for SeatQueue eligibility predicate

**Decision**: The M2 eligibility predicate is passed to `SeatQueue` via a new `onCheckEligibility` callback in `SeatQueueCallbacks`.

**Why**: Keeps `SeatQueue` unit tests pure (no DB dependency) and allows `seat-queue.test.ts` to mock eligibility outcomes directly.

### 7. Property-sweep for REQ-F-SA15 invariant

**Decision**: Instead of a single unit test, write a `describe.each` block parameterized over all M1 fixtures that asserts `gamesWon XOR gamesForfeited` for every user/game pair.

**Why**: REQ-F-SA15 is an invariant across all scenarios, not a property of any single scenario. Parametric sweep gives stronger evidence at low marginal cost.

### 8. Per-file coverage thresholds enforced in vitest.config.ts

**Decision**: Add `coverage.thresholds.perFile` entries to `vitest.config.ts` for each modified/new source file as it lands (M1: `stats-cache.ts`; M2: `seat-eligibility.ts`, `room-handler.ts` touched paths, `disconnect-handler.ts`; M3: `seat-queue.ts`; M5: `PreRoomView.tsx`).

**Why**: Prevents end-of-branch coverage surprises. A regression in coverage becomes a test failure instead of a PR-time discovery.

---

## Risks Addressed in Plan

- **R1** (SQLite row-value IN unsupported) → M1 change #1, startup PRAGMA check
- **R3** (legitimate reconnect blocked) → M2 dedicated spy-based regression test
- **R5** (grace-period divergence) → M2 explicit vote-removal
- **R7** (`player_rounds` incomplete on crash) → M1 Step A verification of atomic round-end write
- **Spec §10 deferred #1-3** → all resolved (see decisions 3, 4, and new `SEAT_CLAIM_REJECTED` message type in M2)
- **SA12/SA13 schema columns** → per spec conversation, already exist in schema, hardcoded to 0; verified at M1 Step A

---

## Milestone Summary

| # | Milestone | Requirements | Size |
|---|---|---|---|
| M1 | Stats Attribution Rewrite + SQLite Version Guard | SA01-SA13, SA15, NF-SA01-NF-SA05 | Large — `computeStatsForUser` ~400 LOC rewrite |
| M2 | Seat Eligibility Module + Grace-Period Alignment | SJ01-SJ06, SJ12-SJ13, NF-SJ01-NF-SJ02 | Large — new module + handler wiring + grace refactor |
| M3 | Queue Silent-Skip + Free-for-All Gating | SJ08-SJ11, NF-SJ03 | Medium — additive to seat-queue.ts |
| M4 | DB Wipe Script | SA14 | Small — single script + test |
| M5 | Client Rejection Dialog | SJ07 | Small — single component extension |

Estimated 5 commits (one per milestone) under this plan.

---

## Confidence

High. Every requirement has a concrete milestone assignment. Every milestone has a file-level change list, a test plan, and a coverage gate. The spec's deferred items are all resolved pre-plan. Behavioral-change callout (§9) is documented.
