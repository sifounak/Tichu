# Auto-Pass Until Next Trick — Specification Conversation

**Date:** 2026-03-25
**Phase:** Specification (Phase 1.2)

## Summary

Defined a client-only "auto-pass until next trick" feature that adds a toggle to automatically pass on each turn until the current trick ends.

## Key Decisions

1. **Client-only implementation** — No server or shared package changes. The client detects its turn and sends `PASS_TURN` automatically.
2. **Wish enforcement** — If the player can't legally pass (Mahjong wish), auto-pass disables itself and shows an error toast notification.
3. **Bomb interaction** — Auto-pass does not suppress bomb availability. Playing any cards (including bombs) disables auto-pass.
4. **Trick leadership** — Auto-pass does not fire when the player is leading a new trick (no trick to pass on).
5. **Dragon gift** — Auto-pass turns off if the player wins with Dragon, allowing normal gift modal flow.
6. **Visual delay** — 300-500ms delay before auto-pass fires so the player briefly sees it's their turn.
7. **Reset triggers** — Trick won, game state sync (reconnect), player finishes, dragon gift pending, playing cards.

## Requirements Count

- 12 functional requirements (REQ-F-AP01 through REQ-F-AP12)
- 3 non-functional requirements (REQ-NF-AP01 through REQ-NF-AP03)

## Risks Identified

- Wish enforcement edge case (mitigated by canPass check)
- Dragon gift interaction (mitigated by dragonGiftPending check)
- Reset reliability (mitigated by dual reset paths: TRICK_WON + GAME_STATE)
