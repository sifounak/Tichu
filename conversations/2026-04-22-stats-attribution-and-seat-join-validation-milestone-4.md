# M4 Milestone Transcript — DB Wipe Script

**Date**: 2026-04-23
**Branch**: `bugfix/stats-attribution-midgame`
**Milestone**: M4 of 5 — DB Wipe Script
**Requirements**: REQ-F-SA14

---

## Summary

M4 delivers the operator-run one-shot CLI that clears the 13 stats/event tables that accumulated incorrectly-attributed rows prior to the M1 attribution fix, while preserving live-session state (`users`, `active_games`, `active_rooms`). The script is opt-in (`pnpm --filter @tichu/server wipe-stats`), prompts for explicit `y/N` confirmation by default, supports `--force` for automated runs and tests, and runs the full delete set as a single transaction with `defer_foreign_keys = ON` so foreign-key order within the transaction is unconstrained and any downstream failure rolls the whole wipe back.

The wipe/preserve table lists are exported from the script module so tests can assert directly on them without re-implementing the list. The CLI surface (argument parsing, prompt, report formatting) is kept thin; the load-bearing logic (`runWipe`, `countRows`) is pure and takes a `better-sqlite3` `Database` — this is what the tests exercise. `main()` is only run when the file is invoked as a script (not when imported by tests), guarded by comparing `import.meta.url` to `process.argv[1]`.

## Key Decisions

- **Children-before-parents delete order** in `WIPE_TABLES`, even though `defer_foreign_keys = ON` makes ordering a correctness non-issue within the transaction. Rationale: readers of the list should be able to reason about it without reading about deferred FKs; and if anyone ever runs these DELETEs individually (e.g., from a REPL), the order is already safe.
- **Per-SQLite-pragma behavior for transactional rollback**: used `defer_foreign_keys = ON` (transaction-scoped, resets per-transaction) rather than `foreign_keys = OFF` (connection-scoped, requires re-enable). Matches the principle of keeping side effects contained.
- **Rollback test uses a BEFORE DELETE trigger on `games`** (10th entry in WIPE_TABLES) that raises `RAISE(FAIL, ...)`. This is the canonical way to prove atomicity: it guarantees 9 earlier DELETEs ran successfully before the failure and must all be rolled back. The trigger is dropped in the test's tail so it doesn't leak across `beforeEach` rebuilds.
- **List-integrity test** asserts `WIPE_TABLES.length === 13`, `PRESERVE_TABLES.length === 3`, and the two sets are disjoint (union size = 16). This is a tripwire for anyone who adds or removes a table without updating the spec/RTM together.
- **Script-vs-import guard** uses `import.meta.url.endsWith(basename(process.argv[1]))` rather than a direct URL equality check, because ESM URL resolution on Windows vs. POSIX differs for drive letters and backslashes. Basename comparison is portable and still rejects accidental imports.

## Test Coverage

**Unit / integration tests** (`tests/scripts/wipe-stats-history.test.ts`, 4 tests, all passing):

1. **Full wipe + preserve**: seed all 16 tables, run `runWipe`, assert all 13 wipe tables have 0 rows post-wipe AND all 3 preserve tables are unchanged.
2. **Idempotent**: running twice with no re-seed leaves wipe tables empty and does not error.
3. **Transactional rollback**: install a blocking `BEFORE DELETE` trigger on `games`, expect `runWipe` to throw, then assert *every* table (wipe + preserve) is at its pre-wipe count — proving no partial commit.
4. **List integrity**: 13 wipe + 3 preserve = 16 disjoint tables.

**Coverage**: script itself is under `scripts/`, not `src/`, so it isn't part of the per-file thresholds. The 4 tests exercise the three exported pure functions (`countRows`, `runWipe`, and the two exported table lists). CLI boilerplate (`parseArgs`, `promptYN`, `formatReport`, `main`) is intentionally untested — it's exercised manually and the logic under it is trivial.

**Test suite**: 812/812 server tests pass (up from 808 at M3 — +4 new from this milestone).

**Typecheck**: clean.

**Lint**: `eslint` binary not installed in `node_modules/.bin` — pre-existing repo issue documented in memory `project_remaining_cleanup.md` and accepted during M1–M3 commits; not introduced by this milestone.

## Files Changed

| File | Change |
|---|---|
| `code/packages/server/scripts/wipe-stats-history.ts` | **NEW** — the wipe script + exported pure helpers |
| `code/packages/server/tests/scripts/wipe-stats-history.test.ts` | **NEW** — 4 tests covering wipe, idempotence, rollback, list integrity |
| `code/packages/server/package.json` | Added `"wipe-stats": "tsx scripts/wipe-stats-history.ts"` |
| `specifications/RTM-stats-attribution-and-seat-join-validation.md` | SA14 status → Passed with code/test references |
| `results/Milestone4/tests/test-results.json` | Archived vitest run for M4 |

## Results Archive

- `results/Milestone4/tests/test-results.json` — vitest JSON for the 4 M4 tests (all passed).
