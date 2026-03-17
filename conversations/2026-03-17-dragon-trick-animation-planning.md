# Conversation Transcript: Dragon Trick Animation — Planning Phase

**Date:** 2026-03-17
**Branch:** feature/dragon-trick-animation
**Phase:** Implementation Planning

---

## Summary

Designed a 3-milestone plan to implement Dragon trick keep-visible + animate-to-recipient.

### Milestones

| # | Title | Files |
|---|-------|-------|
| M1 | Server: keep trick alive + `dragonGiftedTo` signal | `game.ts`, `game-state-machine.ts`, `state-projection.ts` |
| M2 | Client store + page animation trigger | `uiStore.ts`, `page.tsx` |
| M3 | TrickDisplay: render animation trick + directional sweep | `GameTable.tsx`, `TrickDisplay.tsx` |

### Key Design Decisions

1. **`dragonGiftedTo: Seat | null` in RoundState:** Ephemeral server-side field that signals to the client which direction to sweep. Set when gift resolves (both auto and manual). Reset in `playCards`/`passTurn`.

2. **Remove `round.currentTrick = null` from manual-gift branch:** This is the core server fix. The trick is only cleared when `giveDragonTrick` fires.

3. **`uiStore.dragonGiftAnimation`:** Mirrors the `dogAnimation` pattern already in place. Captures the previous trick before `applyGameState` clears it, giving TrickDisplay the cards it needs to animate.

4. **TrickDisplay `displayTrick` + `displaySweepTarget`:** Clean local override — when `trick` is null but `dragonGiftAnimation` is active, TrickDisplay renders the captured trick with overridden sweep direction. AnimatePresence runs the correct exit when `dragonGiftAnimation` clears.

### Trade-offs Considered

- **Alternative: route auto-gift through `awaitingDragonGift` + XState `always` guard.** Would unify both paths but adds complexity to the state machine and bot runner. Rejected — client-side capture is simpler and the server-side logic is unchanged for auto-gift beyond setting `dragonGiftedTo`.

- **Alternative: delay `applyGameState` until animation completes.** Could cause stale state issues. Rejected.

---

## Full Conversation

### Turn 1 — User
> yes, let's serialize the plan and then pause so I can clear the context and continue.

### Turn 2 — Assistant
Committed spec. Wrote plan to `plans/2026-03-17-dragon-trick-animation.md` and RTM to `specifications/RTM-dragon-trick-animation.md`. Committing plan and pausing for context clear.
