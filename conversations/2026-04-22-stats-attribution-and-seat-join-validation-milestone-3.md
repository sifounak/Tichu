# M3 Milestone Transcript — Queue Silent-Skip + Free-for-All Gating

**Date**: 2026-04-22
**Branch**: `bugfix/stats-attribution-midgame`
**Milestone**: M3 of 5 — Queue Silent-Skip + Free-for-All Gating
**Requirements**: REQ-F-SJ08, SJ09, SJ10, SJ11; closes M3 slice of REQ-NF-SJ02, REQ-NF-SJ03

---

## Summary

M3 wires the M2 eligibility predicate (`checkSeatClaimEligibility`) into the `SeatQueue` so that queue-promotion paths enforce the same server-authoritative rule as the three direct entry points (CLAIM_SEAT / CHOOSE_SEAT / mid-game JOIN_ROOM) covered by M2. Two distinct queue behaviors are gated:

1. **Ordered queue silent-skip (SJ08, SJ09)** — when the next spectator up is ineligible for every currently available seat, they are silently advanced past (no `SEAT_OFFERED`, no client-visible error), a structured server log entry is emitted, and spectator order is preserved (no removal, no reshuffle). The spectator remains in the queue if new seats open later for which they *would* be eligible.

2. **Free-for-all eligibility gate (SJ10, SJ11)** — in `up-for-grabs` phase, the first eligible claimant still wins, but an ineligible claimant is rejected with the exact `REQ-F-SJ11` rejection text, emitted via `broadcaster.sendSeatClaimRejected` with `offerClaimOriginal=false` (spec: "must wait for your previous seat to become available").

Both paths use dependency-injected callbacks (`onCheckEligibility`, `onIneligibleFreeForAllClaim`, `onSilentSkip`) so the `SeatQueue` remains pure and unit-testable — the eligibility rule lives in `room-handler.ts` and is mock-injected at the test boundary.

## Key Decisions

- **Auto-assign picks first *eligible* seat**, not first available. The prior `shift()` in `handleClaim` and `handleUpForGrabsClaim` was replaced with `find`/`findIndex` over `availableSeats` filtered by `onCheckEligibility`. This matters for partial-eligibility cases: a user who previously held north and is now returning after a kick could legitimately be eligible for north (reclaim) but not east; auto-assign must pick north.
- **`handleUpForGrabsClaim` returns `true` when rejecting** so the caller does not pile a generic `CLAIM_FAILED` error on top of the structured `SEAT_CLAIM_REJECTED` dialog.
- **`onIneligibleFreeForAllClaim` looks up `originalSeat` in room-handler** rather than in seat-queue. Rationale: seat-queue is pure and has no DB handle. Room-handler already has the game reference and invariant (callback fired only after eligibility returned false → a prior seat must exist); the warn-and-fall-back branch handles the impossible case defensively.
- **Silent-skip does NOT remove the user from `spectatorOrder`** — it only advances `currentIndex`. If seats later change composition (e.g., a new seat opens that the user IS eligible for), existing `addSeats`/`resendStateToSpectator` logic will re-evaluate.
- **No protocol changes**. `SEAT_CLAIM_REJECTED` was added in M2 and is reused here; no new shared types.

## Test Coverage

**Unit tests** (`tests/room/seat-queue.test.ts`):
- Silent-skip: all-eligible regression, 2-of-4 ineligible, all-ineligible → up-for-grabs, partial seat ineligibility still offers, auto-assign picks first eligible seat, order preservation across skip/decline/accept
- Free-for-all: eligible can claim, ineligible → onIneligibleFreeForAllClaim fires, partial eligibility picks eligible seat

**Integration tests** (`tests/integration/empty-seat-flow.test.ts`):
- End-to-end 4-spectator queue with 2 ineligible → exactly 2 offers, log entries recorded, ineligible never offered
- Spectator order invariant across skip/decline/accept
- Free-for-all rejection via callback
- Eligible claim after prior rejected ineligible attempt

**Coverage results (v8, M3 snapshot)**:
- `seat-queue.ts`: 98.28% statements / 92.55% branches / 100% funcs (was ~65% pre-M3; uncovered lines 440-443, 513 are pre-existing late-joiner edges outside SJ scope)
- `seat-eligibility.ts`: 100% / 88.23% / 100% (unchanged from M2)
- `disconnect-handler.ts`: 100% / 93.93% / 100% (unchanged from M2)
- Full server aggregate: 82.16% statements (up from 81.71% at M2)
- Per-file threshold `seat-queue.ts ≥ 80%` enforced in `vitest.config.ts`

**Test suite**: 808/808 pass (up from 769 at M2 — +39 new tests from M3 queue + eligibility suites and the incidental pre-existing tests for `addSeats`/`resendStateToSpectator`/`handleSeatFilledExternally` that landed in this pass).

**Typecheck**: clean (turbo cache hits, no regressions).

**Lint**: `eslint` still broken project-wide (pre-existing, tracked in backlog) — not a regression from M3.

## Files Changed

- `code/packages/server/src/room/seat-queue.ts` — callback interface + silent-skip + free-for-all gate
- `code/packages/server/src/room/room-handler.ts` — wired `onCheckEligibility` / `onIneligibleFreeForAllClaim` / `onSilentSkip` at queue construction
- `code/packages/server/tests/room/seat-queue.test.ts` — M3 eligibility suites (+ ancillary tests filling `addSeats`/`resendStateToSpectator`/`handleSeatFilledExternally` coverage)
- `code/packages/server/tests/integration/empty-seat-flow.test.ts` — end-to-end SJ08-SJ11 scenarios
- `code/packages/server/vitest.config.ts` — per-file coverage threshold for `seat-queue.ts`
- `specifications/RTM-stats-attribution-and-seat-join-validation.md` — SJ08-SJ11 → Passed, NF-SJ02/NF-SJ03 extended with M3 slices
- `documentation/codebase-index.md` — `seat-queue.ts` entry updated; `seat-eligibility.ts` row added
- `.claude/settings.json` — allowlist additions for M3 test/coverage commands

## Next Milestone

**M4 — DB Wipe Script (REQ-F-SA14)** — standalone operator CLI. Independent of the SJ series.
