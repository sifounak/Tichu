# Implementation Plan: Dragon Trick — Keep Visible & Animate to Recipient

**Date:** 2026-03-17
**Branch:** feature/dragon-trick-animation
**Spec:** `specifications/2026-03-17-dragon-trick-animation.md`
**RTM:** `specifications/RTM-dragon-trick-animation.md`

---

## Revision History

| Version | Date | Summary |
|---------|------|---------|
| 1.0 | 2026-03-17 | Initial plan |

---

## Overview

Three milestones:

| # | Title | Requirements |
|---|-------|-------------|
| M1 | Server: keep trick alive + add `dragonGiftedTo` | REQ-F-DRA01, REQ-F-DRA03, REQ-NF-DRA03 |
| M2 | Client store + page: dragon gift animation trigger | REQ-F-DRA02, REQ-F-DRA03, REQ-NF-DRA01, REQ-NF-DRA02 |
| M3 | TrickDisplay: render animation trick + directional sweep | REQ-F-DRA01–05, REQ-NF-DRA01–02 |

---

## Milestone 1 — Server: Keep Trick Alive + `dragonGiftedTo` Signal

### Goal
Keep `currentTrick` non-null during `awaitingDragonGift`. Add an ephemeral `dragonGiftedTo: Seat | null` field so the client knows the sweep direction when the gift resolves.

### Files
- `code/packages/shared/src/types/game.ts`
- `code/packages/server/src/game/game-state-machine.ts`
- `code/packages/server/src/ws/state-projection.ts`

### Steps

**A. `game.ts` — add `dragonGiftedTo` to `RoundState` and `ClientGameView`**
```typescript
// RoundState (existing field block)
dragonGiftedTo: Seat | null;   // ephemeral: set when gift resolves, cleared on next play/pass

// ClientGameView (add alongside dragonGiftPending)
dragonGiftedTo: Seat | null;
```

**B. `game-state-machine.ts`**

1. `createRoundState()` — initialise `dragonGiftedTo: null`

2. `completeTrickAndAdvance()` — two changes:
   - **Manual gift branch (else):** Remove `round.currentTrick = null`. Keep trick alive so client sees it during `awaitingDragonGift`.
   - **Auto-gift branch (if autoRecipient):** Add `round.dragonGiftedTo = autoRecipient` before the existing lines (trick is still cleared on line 936 as normal).

3. `giveDragonTrick` action — add `round.dragonGiftedTo = event.recipient` immediately before `round.currentTrick = null`.

4. `playCards` action — add `round.dragonGiftedTo = null` at the very start (resets ephemeral signal for subsequent plays). Same in `passTurn`.

**C. `state-projection.ts`**
Add `dragonGiftedTo: round.dragonGiftedTo ?? null` to the returned `ClientGameView` object (alongside existing `dragonGiftPending`).

### Testing
- Unit tests for `completeTrickAndAdvance` and `giveDragonTrick` in the existing game-state-machine test suite.
- Verify `currentTrick` is non-null after Dragon wins trick (manual gift case).
- Verify `dragonGiftedTo` is set correctly after auto-gift and after `giveDragonTrick`.
- Verify `dragonGiftedTo` is null after a subsequent `playCards`.

---

## Milestone 2 — Client: Store + Page Animation Trigger

### Goal
Add `dragonGiftAnimation` to `uiStore`. In `page.tsx`, detect `view.dragonGiftedTo` on GAME_STATE, capture the previous trick, start the animation, and schedule clearing it after the sweep duration.

### Files
- `code/packages/client/src/stores/uiStore.ts`
- `code/packages/client/src/app/game/[gameId]/page.tsx`

### Steps

**A. `uiStore.ts`**
```typescript
import type { TrickState } from '@tichu/shared';

/* --- Dragon Gift Animation (REQ-F-DRA02) --- */
dragonGiftAnimation: { recipient: Seat; trick: TrickState } | null;
startDragonGiftAnimation: (recipient: Seat, trick: TrickState) => void;
clearDragonGiftAnimation: () => void;
```
Implementations:
```typescript
dragonGiftAnimation: null,
startDragonGiftAnimation: (recipient, trick) =>
  set({ dragonGiftAnimation: { recipient, trick } }),
clearDragonGiftAnimation: () => set({ dragonGiftAnimation: null }),
```

**B. `page.tsx` — in `handleMessage`, inside the `GAME_STATE` branch**

Add detection before calling `gameStore.applyGameState(view)`:
```typescript
// REQ-F-DRA02/03: Dragon gift animation — sweep trick toward recipient
if (view.dragonGiftedTo && animEnabled) {
  const prevTrick = gameStore.currentTrick;
  if (prevTrick) {
    uiStore.startDragonGiftAnimation(view.dragonGiftedTo as Seat, prevTrick);
    const BASE_TRICK_SWEEP = 0.40;
    const sweepMs = BASE_TRICK_SWEEP * animMultiplier * 1000;
    setTimeout(() => uiStore.clearDragonGiftAnimation(), sweepMs + 100);
  }
}
```

Also update the `handleMessage` dependency array to include `uiStore` (already present).

Also update `gameStore.ts` `applyGameState` to read `dragonGiftedTo`:
```typescript
// In applyGameState set():
// (dragonGiftedTo is used only for the uiStore animation; no need to store it in gameStore)
```
Actually `dragonGiftedTo` only needs to be read in the page handler — gameStore does not need to store it.

### Testing
- Mock `view.dragonGiftedTo` being set; verify `uiStore.startDragonGiftAnimation` is called with correct args.
- Verify `clearDragonGiftAnimation` fires after the sweep duration.

---

## Milestone 3 — TrickDisplay: Render Animation Trick + Directional Sweep

### Goal
When `trick` (from game state) is null but `dragonGiftAnimation` is active, `TrickDisplay` should display the captured trick cards and sweep toward the recipient seat.

### Files
- `code/packages/client/src/components/game/GameTable.tsx`
- `code/packages/client/src/components/game/TrickDisplay.tsx`

### Steps

**A. `GameTable.tsx`**
Read `dragonGiftAnimation` from `uiStore` and pass it to `TrickDisplay`:
```typescript
const dragonGiftAnimation = useUiStore((s) => s.dragonGiftAnimation);
// ...
<TrickDisplay
  // existing props...
  dragonGiftAnimation={dragonGiftAnimation}
/>
```

**B. `TrickDisplay.tsx`**

1. Add `dragonGiftAnimation` to `TrickDisplayProps`:
```typescript
/** REQ-F-DRA02: Dragon gift animation — keeps trick visible during sweep */
dragonGiftAnimation?: { recipient: Seat; trick: TrickState } | null;
```

2. Compute `displayTrick` and `displaySweepTarget`:
```typescript
// Use the animation trick when the store trick is gone
const displayTrick = trick ?? dragonGiftAnimation?.trick ?? null;

// Override sweep direction toward the gift recipient
const displaySweepTarget = dragonGiftAnimation
  ? seatPosition(dragonGiftAnimation.recipient, mySeat)
  : displayTrick?.currentWinner
    ? seatPosition(displayTrick.currentWinner, mySeat)
    : null;
```

3. Replace all uses of `trick` in the render with `displayTrick`, and `sweepTarget` with `displaySweepTarget`.

   Key changes:
   - The `AnimatePresence` condition: `displayTrick && displayTrick.plays.length > 0`
   - `exitAnim` uses `displaySweepTarget`
   - Bomb detection uses `displayTrick`
   - Plays rendered from `displayTrick.plays`

### Animation Flow (with our changes)

**Manual gift:**
1. Dragon wins → server keeps `currentTrick = <trick>`, sets `dragonGiftPending = true`
2. Client GAME_STATE: `currentTrick = <trick>` → `displayTrick = trick` (trick shown, chooser UI visible)
3. Winner picks → server sets `dragonGiftedTo = recipient`, clears `currentTrick`
4. Client GAME_STATE: `view.dragonGiftedTo` detected → `startDragonGiftAnimation(recipient, prevTrick)`
5. `applyGameState` runs → `currentTrick = null`
6. TrickDisplay: `displayTrick = dragonGiftAnimation.trick`, `displaySweepTarget = recipient`
7. After `sweepMs + 100` ms → `clearDragonGiftAnimation()` → `displayTrick = null`
8. AnimatePresence runs exit on `key="trick-active"` with correct sweep target → trick sweeps to recipient ✓

**Auto-gift:**
1. Dragon wins → server sets `dragonGiftedTo = autoRecipient`, clears `currentTrick`
2. Same client path as steps 4–8 above ✓

### Testing
- TrickDisplay renders animation trick when `trick` is null but `dragonGiftAnimation` is set.
- Exit animation direction matches `dragonGiftAnimation.recipient`.
- When `dragonGiftAnimation` is null, behaviour is unchanged from current implementation.

---

## Cross-Cutting Concerns

- **Animation off:** When `animEnabled` is false, `startDragonGiftAnimation` is not called. `displayTrick` falls back to `trick` from store (which is null), so trick disappears immediately. ✓ REQ-NF-DRA02
- **Bot plays:** Bot-triggered auto-gift goes through the same code path. ✓
- **Round reset:** `createRoundState()` initialises `dragonGiftedTo: null` each round. ✓
- **No scoring impact:** `dragonGiftedTo` is purely ephemeral — scoring reads `tricksWon` which is set correctly before this field. ✓ REQ-NF-DRA03
