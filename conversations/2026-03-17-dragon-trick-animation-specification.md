# Conversation Transcript: Dragon Trick Animation — Specification Phase

**Date:** 2026-03-17
**Branch:** feature/dragon-trick-animation
**Phase:** Specification

---

## Summary of Key Decisions

### User Request
Change the Dragon card behaviour so that:
1. The trick does NOT move out of the play area until the winner chooses a player to give the Dragon to (or a player is automatically chosen).
2. Once chosen, animate the trick going to the chosen player (sweep toward their seat).

### Root Cause Analysis

**Manual gift (human must choose):**
In `completeTrickAndAdvance()` (game-state-machine.ts), when entering `awaitingDragonGift`, the code sets `round.currentTrick = null` immediately (line ~928). This clears the trick from the play area before any recipient is chosen.

**Auto-gift (only 1 eligible opponent or first-out opponent):**
The trick is given synchronously in `completeTrickAndAdvance()` and `round.currentTrick = null` fires on line ~936 with no animation.

### Design Approach Chosen

1. **Server — keep trick alive:** Remove premature `round.currentTrick = null` from the manual-gift branch. Trick is only cleared when `giveDragonTrick` action fires.
2. **Server — ephemeral `dragonGiftedTo` signal:** Add `dragonGiftedTo: Seat | null` to `RoundState` and `ClientGameView`. Set when gift is given (both paths). Reset in `playCards`/`passTurn`.
3. **Client — `uiStore.dragonGiftAnimation`:** When page detects `view.dragonGiftedTo`, capture prevTrick before applying new state, store in uiStore. Schedule clear after sweep duration.
4. **Client — `TrickDisplay`:** Accept `dragonGiftAnimation` prop. Use it to keep trick rendered and override sweep target when `trick` (from store) is null.

### Alternative Considered and Rejected
- Always routing through `awaitingDragonGift` even for auto-gift (adding an XState `always` guard): more complex server change, introduces race conditions with bot runner. Rejected in favour of simpler client-side animation capture.

### Files to be Modified
1. `code/packages/shared/src/types/game.ts`
2. `code/packages/server/src/game/game-state-machine.ts`
3. `code/packages/server/src/ws/state-projection.ts`
4. `code/packages/client/src/stores/uiStore.ts`
5. `code/packages/client/src/app/game/[gameId]/page.tsx`
6. `code/packages/client/src/components/game/GameTable.tsx`
7. `code/packages/client/src/components/game/TrickDisplay.tsx`

---

## Full Conversation

### Turn 1 — User
> Let's change the behavior when a player or bot wins a trick because of the Dragon. Let's not move the trick out of the play area until the winner chooses a player to give the Dragon to (or a player is automatically chosen to receive the Dragon). Once a player is chosen, let's animate the trick going to the player that was given the Dragon.

### Turn 2 — Assistant
Read codebase index, DragonGiftModal.tsx, TrickDisplay.tsx, gameStore.ts, page.tsx, game-state-machine.ts, game-manager.ts, broadcaster.ts, state-projection.ts, protocol.ts, game.ts, uiStore.ts, GameTable.tsx to understand the full flow.

Identified root causes:
- Manual gift: `round.currentTrick = null` in `completeTrickAndAdvance()` before any choice is made.
- Auto-gift: no animation at all.

Proposed the 4-part design approach above. Wrote specification to `specifications/2026-03-17-dragon-trick-animation.md`.

### Turn 3 — User
> yes, let's serialize the plan and then pause so I can clear the context and continue.
