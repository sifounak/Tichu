# Player Statistics System — Milestone 3: RoundEventTracker + Group C Stats

**Date:** 2026-03-30
**Phase:** 2 (Implementation) — Milestone 3

## Summary

Created the RoundEventTracker state-diff observer and integrated it into GameManager for detecting mid-round card events (bombs, Dragon tricks, Dog plays, pass contents, "The Tichu" straight). Added Group C stat persistence.

## Changes Made

1. **round-event-types.ts** (NEW): `RoundEventSummary` interface with ~20 fields for per-player per-round events.
2. **round-event-tracker.ts** (NEW): `RoundEventTracker` class that observes `GameMachineContext` transitions and detects all Group C events via state diffs.
3. **game-manager.ts**: Added eventTracker field, feeds it on every state change, archives summaries at roundScoring, passes event history to game-end callback.
4. **game-persistence.ts**: Added `upsertGroupCStats()` for Group C column upserts, inserted `roundPlayerEvents` rows for audit trail.
5. **room-handler.ts**: Updated callback signature to receive round events.

## Key Decisions

- Event detection uses prev/current RoundState comparison — no XState modification
- Pass data read from `passedCards.to` which persists after exchange
- Bomb classification by combination type and card count
- Over-bombed detected by consecutive bomb plays from different teams
- Dragon trick win detected when trick completes and winner played Dragon single

## Test Results

- 9/9 RoundEventTracker tests pass (new)
- 49/49 DB tests pass (no regressions)
- game-state-machine.ts has zero changes (REQ-NF-P03 verified)
