# Statistics System Redesign — Specification Conversation

**Date:** 2026-04-09
**Phase:** Spec-builder + Implementation Planning
**Branch:** `feature/stats-redesign-event-capture`

## Summary

Built the formal specification for the statistics system redesign, converting the comprehensive design document (`plans/statistics-system-redesign.md`) into a structured spec with 51 requirement IDs, acceptance criteria, edge cases, risks, and success metrics.

### Key Decisions

1. **Scope:** Backend only — UI changes and hand strength heuristic deferred to separate specs
2. **Materialized cache approach:** Option C — rebuild mechanism + v1 cache covering current UI stats. Cache is fully disposable; can be dropped and redesigned without data loss.
3. **Cache refresh:** After each game (incremental) + full rebuild capability
4. **Old playerStats:** Drop after migration (clean break)
5. **SFB tracking:** Explicit — maximal same-suit runs with `bombPlaysFromRun` count
6. **Insights catalog:** ~100+ insights treated as traceability reference, not requirements themselves

### Requirements Summary

- 11 Schema (SC01-SC11): 8 new tables + extension of game_rounds
- 18 Capture (CP01-CP18): Hybrid pre-play enrichment + post-play observation
- 6 Storage (ST01-ST06): In-memory accumulation, recovery files, batch write
- 5 Cache (MC01-MC05): V1 cache + rebuild + incremental + disposable
- 6 Migration (MG01-MG06): Drop old tables, fresh start
- 5 Non-Functional (NF01-NF06): Memory, latency, compatibility

### Implementation Plan

6 milestones approved:
- M1: Database schema (new tables + extensions)
- M2: Data structure interfaces
- M3: Capture logic (hybrid architecture)
- M4: Batch write + recovery
- M5: Materialized cache v1
- M6: Migration + cleanup

### Artifacts

- Specification: `specifications/2026-04-09-statistics-system-redesign.md`
- RTM: `specifications/RTM-statistics-system-redesign.md`
- Implementation plan: `plans/2026-04-09-stats-redesign-implementation.md`
- Design document (input): `plans/statistics-system-redesign.md`
