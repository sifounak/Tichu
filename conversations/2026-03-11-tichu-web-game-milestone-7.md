# Milestone 7: Game State Machine — Conversation Transcript

**Date:** 2026-03-11
**Feature branch:** `feature/tichu-web-game`
**Milestone:** 7 — Game State Machine

## Summary

Implemented the hierarchical finite state machine (FSM) using XState v5 for the complete Tichu game lifecycle, plus a turn timer class for enforcing time limits.

## Key Decisions

1. **XState v5** chosen as the FSM framework per the master plan — provides typed state machines with guards, actions, and `always` transitions
2. **State flow:** lobby → grandTichuDecision → regularTichuDecision → cardPassing → playing ↔ awaitingDragonGift → roundScoring → (next round or gameOver)
3. **Card storage:** First 8 cards dealt immediately, remaining 6 stored temporarily on PlayerState and merged after Grand Tichu decisions
4. **Guard-based transitions:** Used `always` transitions with guards for automatic phase advancement (e.g., all players decided → advance)
5. **Dragon gift flow:** Separate `awaitingDragonGift` state entered when Dragon wins a trick; auto-gifts when only 1 opponent remains
6. **Turn timer:** Separate `TurnTimer` class (not embedded in XState) — clean separation allows game manager to inject timeout events

## What Was Implemented

### Files Created
- `code/packages/server/src/game/game-state-machine.ts` — XState v5 game state machine with all phases, guards, and actions
- `code/packages/server/src/game/turn-timer.ts` — TurnTimer class with start/stop/remaining/dispose
- `code/packages/server/tests/game/game-state-machine.test.ts` — 43 tests for state machine
- `code/packages/server/tests/game/turn-timer.test.ts` — 10 tests for turn timer

### Files Modified
- `code/packages/server/package.json` — Added xstate ^5.28.0 dependency
- `code/packages/shared/src/engine/phoenix-resolver.ts` — Fixed type error (Rank cast)
- `code/packages/shared/src/engine/scoring.ts` — Removed unused import
- `code/packages/shared/src/engine/wish.ts` — Removed unused import

## Test Results
- **Server:** 54 tests passed, 0 failed
- **Shared:** 367 tests passed (verified no regressions)
- **Coverage:** 81.07% statements (threshold: 80%), turn-timer.ts at 100%

## Requirements Addressed
- REQ-F-GF01: Game lifecycle state machine — Passed
- REQ-F-GF02: Card passing — Passed
- REQ-F-GF03: Mahjong leads first trick + wish — Passed
- REQ-F-GF05: Trick won by 3 consecutive passes — Passed
- REQ-F-GF06: Round ends when ≤1 player has cards — Passed
- REQ-F-GF07: Turn order skips finished players — Passed
- REQ-F-GF08: Tichu declaration +100/-100 — Passed
- REQ-F-GF09: Grand Tichu +200/-200 — Passed
- REQ-F-DR01: Dragon trick given to opponent — In Progress (logic done, full integration M9)
- REQ-F-MP09: Optional turn timer — In Progress (timer done, UI integration M15)
