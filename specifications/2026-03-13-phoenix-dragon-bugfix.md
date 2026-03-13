# Specification: Phoenix Cannot Beat Dragon — Bugfix & Regression Tests

**Date**: 2026-03-13
**Type**: Bugfix + Test Hardening
**Branch**: `bugfix/phoenix-dragon-rules-audit`
**Parent**: `main`

## Goal

Fix a UX bug where the client Play button is incorrectly enabled when a player selects Phoenix against a Dragon trick, and add regression tests for the edge case where `[4-of-a-kind + Phoenix]` is correctly rejected as a full house.

Identified during a rules audit against the [official Tichu rules PDF](https://fatamorgana.ch/media/pages/fatamorgana/tichu/english-rules/ee9126a1b5-1703236359/tichu_e.pdf).

## Requirements

### Functional

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| REQ-F-PD01 | `resolveSinglePhoenix` must return `{ status: 'invalid' }` when Dragon (rank ≥ 25) is the trick top | Unit test: Phoenix on Dragon trick → `invalid` |
| REQ-F-PD02 | `resolveSinglePhoenix` must still return `{ status: 'single_ontrick', value: 14.5 }` when Ace is the trick top | Unit test: Phoenix on Ace trick → `single_ontrick`, value 14.5 |
| REQ-F-PD03 | Client Play button must be disabled when Phoenix is selected against a Dragon trick | Flows automatically from PD01 — `useCardSelection.ts:82` already checks `phoenixResolution.status === 'invalid'` |
| REQ-F-RT01 | `detectCombination([3,3,3,3,Phoenix])` must return `null` (not a valid full house) | Unit test: returns `null` |
| REQ-F-RT02 | `detectCombination([7,7,7,7,Phoenix])` must return `null` (generalized) | Unit test: returns `null` |

### Non-Functional

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| REQ-NF-PD01 | No breaking changes to existing tests | All existing shared engine tests pass |

## Scope

### In Scope
- Guard clause in `resolveSinglePhoenix` for Dragon rank
- New test cases in `phoenix-resolver.test.ts` and `combination-detector.test.ts`

### Out of Scope
- Out-of-turn bomb mechanic (deferred to future milestone — see plan file)
- Client code changes (PD03 is satisfied automatically by PD01)
- Server-side changes (server already correctly rejects Phoenix beating Dragon)

## Files to Modify

| File | Change |
|---|---|
| `code/packages/shared/src/engine/phoenix-resolver.ts` | Add `if (topRank >= DRAGON_RANK) return { status: 'invalid' }` in `resolveSinglePhoenix` |
| `code/packages/shared/tests/engine/phoenix-resolver.test.ts` | Add tests for PD01, PD02, and `[4-of-kind + Phoenix]` → `invalid` |
| `code/packages/shared/tests/engine/combination-detector.test.ts` | Add tests for RT01, RT02 |

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Existing tests break from Phoenix resolver change | Low | Medium | Run full test suite before commit |
| Edge case: Phoenix on "Ace and a half" (Phoenix over Ace, rank 14.5) | Very Low | Low | Only real trick-top ranks matter (integers + Dragon 25); Phoenix-over-Phoenix isn't a valid game state |

## Confidence

**High** — All requirements are clear, testable, non-conflicting. The fix is a 3-line guard clause. Server validation is already correct.
