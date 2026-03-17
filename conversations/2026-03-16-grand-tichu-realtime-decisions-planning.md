# Planning Conversation — Grand Tichu Real-Time Decisions

**Date:** 2026-03-16
**Branch:** feature/grand-tichu-realtime-decisions

## Milestones

- M1: Data plumbing (gameStore + game page) — no visual change, just wire up data
- M2: Real-time UI (PreGamePhase + CSS) — show status before/after decision
- M3: Bot timing (bot-runner) — fixed 1000ms + deduplication

## Key Design Decisions

- `PreGamePhaseProps` gains `myGrandTichuCall?: TichuCall` so the component can show "You called/passed" on the waiting screen without reaching outside its props
- Bot deduplication via `Set<Seat> grandTichuTimerSeats`, cleared in `dispose()` and per-seat on timer fire
- Grand Tichu delay is a named constant `GRAND_TICHU_DELAY_MS = 1000` (not piped through `scheduleAction` which uses randomized range)
- In `INSTANT_CONFIG` (minDelayMs=0), Grand Tichu also fires at 0ms (existing test behaviour preserved)
