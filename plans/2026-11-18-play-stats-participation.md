# Approved implementation plan

Parent: main. Branch: bugfix/play-stats-participation. Specification: ../specifications/2026-11-18-play-stats-participation.md.

1. **Statistics repair** (PS01–PS03): repair cache calculations, add exact bomb-pass helper and regression tests; additive stat columns/types and query projections. Validate server stats suite, coverage, typecheck/lint. Document metrics and commit.
2. **Participation persistence and filtered APIs** (PS04–PS06): record sticky actual-bot flag and human IDs; preserve snapshots; infer legacy participation; migrate caches to user/view keys; refresh all affected views; validate routes and filter before history pagination/leaderboard eligibility. Validate persistence, cache, API tests and migration/restart scenarios. Document and commit.
3. **Shared UI and final validation** (PS07, NF-PS01): URL selector and request helper across stats/profile/leaderboard; discard stale fetch responses; show provenance and labels; test navigation/rendering. Run all package suites, typecheck/lint and coverage, update traceability, archive results and commit.

Keep gameplay bomb enumeration and final-occupant game-win rules. Personal default all; leaderboard explicitly human-only; omitted API parameter all. Historical classifications inferred, displayed as such. No production database access is required: startup migration/backfill and cache version refresh repair deployed records.

Repository workflow is applied using pnpm/Vitest/TypeScript equivalents for MATLAB-only commands. Automatic context compaction replaces unavailable /clear; progress and decisions persist in these documents and milestone transcripts.
