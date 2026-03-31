# Card / Hand Stats Expansion — Planning Conversation

**Date:** 2026-03-31
**Phase:** Implementation Planning (Phase 1.4)

## Summary

Designed a 4-milestone implementation plan for the Card / Hand Stats expansion feature (~35 new DB columns, complex detection logic, UI overhaul).

## Key Decisions

1. **4 milestones:** Types/Schema → Detection → Persistence → UI (sequential dependency chain)
2. **Phoenix detection** follows existing `detectBombPlays()` pattern — iterate new trick plays, check for Phoenix in combination.cards, classify by CombinationType
3. **Dog control** extends existing `detectDogPlay()` method with partner/opponent/self classification using `getPartner()`
4. **Dog stuck** requires new `Set<Seat>` tracking field to count once per round per player
5. **Bomb sizes** replace 3-bucket system (4/5/6+) with 11 per-size counters (4–14); old columns kept for backward compat
6. **Conflicting bombs** run once after card exchange in `captureFullHands()` — pure computation on 14-card hand
7. **Over-bomb split** modifies existing over-bomb detection to track both attacker (`youOverBombed`) and victim (`youWereOverBombed`)
8. **Extended pass** expands existing `capturePassData()` with gave/received tracking for all card types + bomb completion detection
9. **Pass persistence on abandon** hooks into `restartGame()` and `leaveRoom()` destroy paths to save pass stats before game destruction
10. **Over-bomb data migration** — one-time idempotent UPDATE to migrate existing `overBombed` → `youWereOverBombed`

## Trade-offs

- Keeping old bomb size columns (fourCardBombs, fiveCardBombs, sixPlusCardBombs) for backward compatibility even though they're no longer incremented
- Pass persistence on abandon touches room-handler.ts (large file) but change is additive — just a save call before destroy
- 36 new DB columns is a lot but follows established migration pattern and SQLite ALTER is fast

## Artifacts

- Plan: `plans/2026-03-31-card-stats-expansion.md`
- RTM: `specifications/RTM-card-stats-expansion.md`
- Spec: `specifications/2026-03-31-card-stats-expansion.md` (committed earlier as bf18124)
