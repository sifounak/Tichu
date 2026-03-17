# Specification: Dragon Trick — Keep Visible & Animate to Recipient

**Date:** 2026-03-17
**Branch:** feature/dragon-trick-animation
**Status:** Draft

---

## 1. Goal

When a Dragon wins a trick, the trick cards must remain visible in the play area until a recipient is chosen. Once a recipient is determined (by the human player or automatically), the trick sweeps toward that player via an animation identical to the normal trick-sweep mechanic.

---

## 2. Background & Current Behaviour

When the Dragon wins a trick, the server enters `awaitingDragonGift` state. Currently:

- **Manual gift (human chooses):** `round.currentTrick` is immediately set to `null` in `completeTrickAndAdvance()`. The trick disappears from the play area before the player picks a recipient.
- **Auto-gift (only one eligible opponent, or first-out opponent):** The trick is given automatically without any animation; it disappears instantly.

Both cases need fixing.

---

## 3. Requirements

### Functional

| ID | Requirement |
|----|-------------|
| REQ-F-DRA01 | While `dragonGiftPending` is true (human must choose), the current trick MUST remain visible in the play area. |
| REQ-F-DRA02 | Once the Dragon gift recipient is determined (human choice or auto), the trick MUST animate toward the recipient's seat position, mirroring the normal trick-sweep animation. |
| REQ-F-DRA03 | Auto-gift (only one eligible opponent, or first-out opponent) MUST also produce a sweep animation toward the auto-recipient before the trick disappears. |
| REQ-F-DRA04 | The Dragon gift chooser UI (PlayerSeat click targets) MUST remain visible while the trick is showing. |
| REQ-F-DRA05 | After the sweep animation completes, the trick area returns to the empty "Play Area" state as normal. |

### Non-Functional

| ID | Requirement |
|----|-------------|
| REQ-NF-DRA01 | Animation duration MUST respect the `animationSpeed` setting (slow/normal/fast/off). |
| REQ-NF-DRA02 | When animation is disabled (`off`) or `prefers-reduced-motion` is set, the trick disappears immediately (no sweep) once the recipient is chosen. |
| REQ-NF-DRA03 | The change must not alter game logic or scoring — only rendering and animation timing. |

---

## 4. Design Approach

### 4.1 Server: Keep currentTrick alive during awaitingDragonGift

In `completeTrickAndAdvance()` (game-state-machine.ts), remove the premature `round.currentTrick = null` from the manual-gift branch. The trick is only cleared when the gift is actually given (in `giveDragonTrick` action).

### 4.2 Server: Add `dragonGiftedTo` ephemeral signal

Add `dragonGiftedTo: Seat | null` to `RoundState` and `ClientGameView`. This is set (briefly) when a gift is given — both manually and automatically — so the client knows which direction to sweep the trick. It is cleared on the next play/pass action.

- **Auto-gift:** Set `round.dragonGiftedTo = autoRecipient` in `completeTrickAndAdvance` before clearing the trick.
- **Manual gift:** Set `round.dragonGiftedTo = event.recipient` in `giveDragonTrick` before clearing the trick.

### 4.3 Client: Dragon gift animation in uiStore

Add `dragonGiftAnimation: { recipient: Seat; trick: TrickState } | null` to `uiStore`. When the game page detects `view.dragonGiftedTo` in a GAME_STATE update, it:
1. Captures the current `gameStore.currentTrick` (before applying the new state).
2. Calls `uiStore.startDragonGiftAnimation(recipient, prevTrick)`.
3. Applies the new game state (trick becomes null).
4. Schedules `uiStore.clearDragonGiftAnimation()` after the sweep duration.

### 4.4 Client: TrickDisplay renders the animation trick

TrickDisplay accepts a `dragonGiftAnimation` prop. When `trick` (from game state) is null but `dragonGiftAnimation` is set, TrickDisplay:
- Renders `dragonGiftAnimation.trick` cards (keeping the element mounted under the same `key="trick-active"`).
- Overrides the sweep target to `dragonGiftAnimation.recipient`.

When `dragonGiftAnimation` is cleared, the element exits with the correct directional sweep.

---

## 5. Files Modified

| File | Change |
|------|--------|
| `code/packages/shared/src/types/game.ts` | Add `dragonGiftedTo: Seat \| null` to `RoundState` and `ClientGameView` |
| `code/packages/server/src/game/game-state-machine.ts` | Keep trick alive; set `dragonGiftedTo` on gift; reset in `playCards`/`passTurn` |
| `code/packages/server/src/ws/state-projection.ts` | Project `dragonGiftedTo` in client view |
| `code/packages/client/src/stores/uiStore.ts` | Add dragon gift animation state and actions |
| `code/packages/client/src/app/game/[gameId]/page.tsx` | Trigger dragon gift animation on `dragonGiftedTo` in GAME_STATE |
| `code/packages/client/src/components/game/GameTable.tsx` | Pass `dragonGiftAnimation` to TrickDisplay |
| `code/packages/client/src/components/game/TrickDisplay.tsx` | Render animation trick; override sweep target |

---

## 6. Out of Scope

- Changing the Dragon gift UI interaction (still uses PlayerSeat clicks).
- Server-side timing or delays.
- Any changes to scoring or game logic.

---

## 7. Success Metrics

- Trick cards remain visible on screen from the moment the Dragon wins until the recipient's seat is chosen.
- Trick cards visibly sweep toward the chosen opponent's seat before disappearing.
- Both manual and auto-gift cases animate correctly.
- Animation honours the speed setting (including `off`).
