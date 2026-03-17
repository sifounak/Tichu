# Specification Conversation — Grand Tichu Real-Time Decisions

**Date:** 2026-03-16
**Branch:** feature/grand-tichu-realtime-decisions

## Summary

User requested two related changes to the Grand Tichu decision phase:
1. Real-time visibility of other players' decisions (pass or call) as they are made
2. Bots decide exactly 1 second after receiving their first 8 cards

## Codebase Analysis Findings

- Server already broadcasts `GAME_STATE` after each `GRAND_TICHU_DECISION` via `handleMessage → broadcastState()`
- `ClientGameView.grandTichuDecided: Seat[]` already exists and is populated by `state-projection.ts`
- **Bug 1:** `gameStore.applyGameState` silently drops `grandTichuDecided` (not in state interface)
- **Bug 2:** `game/[gameId]/page.tsx` line 505 hardcodes `grandTichuDecided: []` in local view
- **Bug 3:** `PreGamePhase.tsx` accepts but never renders `grandTichuDecided` / `otherPlayerCalls`
- Bot delay for Grand Tichu uses same 800–1500 ms as all other phases

## Key Decisions

- No server changes needed — broadcast mechanism already works correctly
- Distinguished "passed" (in `grandTichuDecided`, `tichuCall === 'none'`) from "hasn't decided" (not in `grandTichuDecided`)
- Bot timer deduplication via a `Set<Seat>` to prevent multiple timers when state broadcasts arrive during pending decision
- 3 milestones: data plumbing → UI → bot timing

## Requirements

REQ-F-GT01 through REQ-F-GT07, REQ-NF-GT01, REQ-NF-GT02
(See specifications/2026-03-16-grand-tichu-realtime-decisions.md)
