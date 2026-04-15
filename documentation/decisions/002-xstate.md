# ADR-002: XState 5 for Game State Machine

**Date:** 2026-03
**Status:** Accepted

## Context

Tichu has eight game phases (lobby, grandTichuDecision, regularTichuDecision, cardPassing,
playing, awaitingDragonGift, roundScoring, gameOver) with complex transitions governed by
game rules. Invalid transitions (e.g., playing cards during the passing phase) must be
impossible by construction, not just caught by runtime checks.

## Decision

Use XState 5 to model the server-side game state machine.

## Rationale

- State charts make illegal state transitions structurally impossible rather than relying
  on defensive coding
- Guards enforce game rules (e.g., "can only pass cards after all players have decided
  on Tichu calls") as first-class transition conditions
- Visual state chart debugging via the XState inspector accelerates development and
  makes the game flow auditable
- Persisted snapshots enable graceful server restarts without losing in-progress games
- Fully typed events and context provide compile-time safety for all state transitions
- The alternative (hand-coded switch/case) does not enforce state invariants and becomes
  unwieldy with eight phases and dozens of conditional transitions

## Consequences

- All game logic is centralized in the state machine definition, making it the single
  source of truth for what transitions are legal
- Adding new game phases or rules requires updating the machine definition, which is
  more structured but also more deliberate than ad-hoc code changes
- The team must understand XState concepts (guards, actions, context, invoked services)
  to modify game logic
