# Requirements Traceability Matrix — Dragon Trick Animation

**Feature:** Dragon trick: keep visible + animate to recipient
**Branch:** feature/dragon-trick-animation
**Spec:** `specifications/2026-03-17-dragon-trick-animation.md`
**Plan:** `plans/2026-03-17-dragon-trick-animation.md`

---

| Req ID | Description | Milestone | Source File(s) | Test File(s) | Status |
|--------|-------------|-----------|---------------|-------------|--------|
| REQ-F-DRA01 | Trick stays visible while `dragonGiftPending` | M1, M3 | `game-state-machine.ts:935` (keep `currentTrick`), `TrickDisplay.tsx:94` (`displayTrick` fallback) | `dragon-trick-animation.test.ts`, `TrickDisplay-dragonGift.test.tsx` | Passed |
| REQ-F-DRA02 | Manual gift sweeps trick toward recipient | M2, M3 | `uiStore.ts` (animation state), `page.tsx:108-118` (detect + schedule), `TrickDisplay.tsx:97-100` (`displaySweepTarget` override) | `uiStore-dragonGift.test.ts`, `TrickDisplay-dragonGift.test.tsx` | Passed |
| REQ-F-DRA03 | Auto-gift also animates trick toward recipient | M1, M2, M3 | `game-state-machine.ts:930` (auto-gift `dragonGiftedTo`), same client path as DRA02 | `dragon-trick-animation.test.ts`, `uiStore-dragonGift.test.ts` | Passed |
| REQ-F-DRA04 | Dragon gift chooser UI visible while trick shows | M3 | `TrickDisplay.tsx:135-139` (notification rendered alongside `displayTrick`) | `TrickDisplay-dragonGift.test.tsx` | Passed |
| REQ-F-DRA05 | Play area returns to empty state after sweep | M3 | `TrickDisplay.tsx:254-256` (empty state when `displayTrick` is null) | `TrickDisplay-dragonGift.test.tsx` | Passed |
| REQ-NF-DRA01 | Animation respects `animationSpeed` setting | M2 | `page.tsx:113-114` (sweep duration × `animMultiplier`) | `uiStore-dragonGift.test.ts` | Passed |
| REQ-NF-DRA02 | Animations off → trick disappears immediately | M2, M3 | `page.tsx:108` (`animEnabled` guard), `TrickDisplay.tsx:94` (no animation trick captured) | `TrickDisplay-dragonGift.test.tsx` | Passed |
| REQ-NF-DRA03 | No change to game logic or scoring | M1 | `game-state-machine.ts:134,548,667` (init + reset) | `dragon-trick-animation.test.ts`, 174 game tests pass | Passed |
