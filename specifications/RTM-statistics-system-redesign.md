# RTM — Statistics System Redesign

**Spec:** `specifications/2026-04-09-statistics-system-redesign.md`
**Date:** 2026-04-09

## Requirements Traceability Matrix

| Requirement ID | Description | Milestone | Implementation | Test | Status |
|---------------|-------------|-----------|----------------|------|--------|
| REQ-F-SC01 | Game-level table (no change) | M1 | | | Pending |
| REQ-F-SC02 | Round-level table extension (+3 cols) | M1 | | | Pending |
| REQ-F-SC03 | Player-round table (new) | M1 | | | Pending |
| REQ-F-SC04 | Merged trick table (new) | M1 | | | Pending |
| REQ-F-SC05 | Play-level table (new) | M1 | | | Pending |
| REQ-F-SC06 | Wish event table (new) | M1 | | | Pending |
| REQ-F-SC07 | Dragon gift event table (new) | M1 | | | Pending |
| REQ-F-SC08 | Dog play event table (new) | M1 | | | Pending |
| REQ-F-SC09 | Bomb inventory table — Level 1 (new) | M1 | | | Pending |
| REQ-F-SC10 | Bomb events table — Level 2 (new) | M1 | | | Pending |
| REQ-F-SC11 | Player global stats (chat counters) | M1 | | | Pending |
| REQ-F-CP01 | Hybrid capture architecture | M3 | | | Pending |
| REQ-F-CP02 | Pre-play enrichment | M3 | | | Pending |
| REQ-F-CP03 | Post-play observation | M3 | | | Pending |
| REQ-F-CP04 | Rejected play cleanup | M3 | | | Pending |
| REQ-F-CP05 | Game-level capture | M3 | | | Pending |
| REQ-F-CP06 | Round-level capture (scores-at-start) | M3 | | | Pending |
| REQ-F-CP07 | Player-round hand capture | M3 | | | Pending |
| REQ-F-CP08 | Player-round call capture | M3 | | | Pending |
| REQ-F-CP09 | Trick capture | M3 | | | Pending |
| REQ-F-CP10 | Play-level capture | M3 | | | Pending |
| REQ-F-CP11 | Out-of-turn bomb capture | M3 | | | Pending |
| REQ-F-CP12 | Wish event capture | M3 | | | Pending |
| REQ-F-CP13 | Dragon gift capture | M3 | | | Pending |
| REQ-F-CP14 | Dog play capture | M3 | | | Pending |
| REQ-F-CP15 | Bomb inventory capture | M3 | | | Pending |
| REQ-F-CP16 | Bomb event capture | M3 | | | Pending |
| REQ-F-CP17 | Bot action capture | M3 | | | Pending |
| REQ-F-CP18 | Chat counter capture | M3 | | | Pending |
| REQ-F-ST01 | In-memory accumulation | M3 | | | Pending |
| REQ-F-ST02 | Recovery file serialization | M4 | | | Pending |
| REQ-F-ST03 | Batch write at game end | M4 | | | Pending |
| REQ-F-ST04 | Recovery file cleanup | M4 | | | Pending |
| REQ-F-ST05 | Server restart recovery | M4 | | | Pending |
| REQ-F-ST06 | Game abandonment handling | M4 | | | Pending |
| REQ-F-MC01 | V1 cache table | M5 | | | Pending |
| REQ-F-MC02 | Full rebuild capability | M5 | | | Pending |
| REQ-F-MC03 | Incremental update after each game | M5 | | | Pending |
| REQ-F-MC04 | Retroactive stat addition | M5 | | | Pending |
| REQ-F-MC05 | Cache disposability | M5 | | | Pending |
| REQ-F-MG01 | Keep games table | M6 | | | Pending |
| REQ-F-MG02 | Extend game_rounds | M1 | | | Pending |
| REQ-F-MG03 | Replace roundPlayerEvents | M6 | | | Pending |
| REQ-F-MG04 | Replace playerStats | M6 | | | Pending |
| REQ-F-MG05 | Replace playerRelationalStats | M6 | | | Pending |
| REQ-F-MG06 | Fresh start for historical data | M6 | | | Pending |
| REQ-NF-01 | Memory overhead ≤150 KB/game | M3 | | | Pending |
| REQ-NF-02 | Write latency ≤500ms | M4 | | | Pending |
| REQ-NF-03 | Recovery file size ≤200 KB | M4 | | | Pending |
| REQ-NF-04 | Cache rebuild ≤10s for 1000 games | M5 | | | Pending |
| REQ-NF-05 | No gameplay impact (<10ms pre-play) | M3 | | | Pending |
| REQ-NF-06 | Backward compatibility | M6 | | | Pending |

## Summary

- **Total requirements:** 51 (11 Schema + 18 Capture + 6 Storage + 5 Cache + 6 Migration + 5 Non-Functional)
- **Milestones:** M1 (Schema), M2 (Interfaces), M3 (Capture), M4 (Storage), M5 (Cache), M6 (Migration)
- **Must-have:** 47 | **Should-have:** 4 (SC11, CP18, and their related NFRs)
