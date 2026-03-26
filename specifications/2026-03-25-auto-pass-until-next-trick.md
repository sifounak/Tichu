# Feature Specification: Auto-Pass Until Next Trick

**Date:** 2026-03-25
**Status:** Approved
**Confidence:** High

---

## Goal

Add a client-side toggle that allows a player to automatically pass on every turn until the current trick ends. This is useful when a partner has called Tichu (to avoid overplaying them) or when the player holds sets of cards they don't want to break up for the current trick.

**Goal Type:** Feature (client-only UI + logic)

---

## Requirements

### Functional Requirements

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| REQ-F-AP01 | Toggle component visible during playing phase after card passing is complete, when the player is still in the game (has cards / hasn't finished) | Toggle appears when `phase === 'playing'` AND player has not finished AND player is not leading a new trick |
| REQ-F-AP02 | Toggle hidden when the player has finished (is out of the game) | Toggle disappears when player's seat appears in `finishOrder` |
| REQ-F-AP03 | Default state is off/unchecked | On mount and on each trick reset, toggle state is `false` |
| REQ-F-AP04 | Toggle resets to off immediately when a trick is won/over | On `TRICK_WON` message or when `currentTrick` becomes null, set auto-pass to `false` |
| REQ-F-AP05 | When auto-pass is enabled and it becomes the player's turn, automatically send `PASS_TURN` after a short visual delay (~300-500ms) | Server receives `PASS_TURN`; player sees brief turn indication before auto-pass fires |
| REQ-F-AP06 | Auto-pass checks `canPass` before sending; if the player cannot legally pass (e.g., Mahjong wish enforcement), auto-pass is disabled and the player is notified via error toast | Toggle turns off; toast message displayed (e.g., "Auto-pass disabled: you must play a card matching the wish") |
| REQ-F-AP07 | Auto-pass does not suppress bomb availability; player can still play a bomb at any time while auto-pass is enabled | Bomb button remains functional; bomb selection still works during auto-pass |
| REQ-F-AP08 | Playing any cards (including a bomb) while auto-pass is enabled turns auto-pass off | After `PLAY_CARDS` is sent, auto-pass state resets to `false` |
| REQ-F-AP09 | Auto-pass does not activate when the player is leading a new trick (no current trick or player is lead seat with empty plays) | Toggle can be checked but auto-pass logic does not fire when player must lead |
| REQ-F-AP10 | Auto-pass does not interfere with Dragon gift process; if auto-pass is on and the player wins with Dragon, auto-pass turns off and Dragon gift modal appears normally | `dragonGiftPending` state triggers auto-pass disable |
| REQ-F-AP11 | Toggle is positioned to not conflict with existing UI components (Pass/Play buttons, Tichu button, Bomb button, score panel, chat) | Visual inspection confirms no overlap; toggle is in a distinct area |
| REQ-F-AP12 | Toggle resets on full `GAME_STATE` sync (reconnection) — defaults to off | After reconnect, auto-pass is `false` regardless of prior state |

### Non-Functional Requirements

| ID | Requirement | Acceptance Criteria |
|----|-------------|-------------------|
| REQ-NF-AP01 | Client-only implementation — no server changes, no protocol changes, no shared type changes | No modifications to `@tichu/server` or `@tichu/shared` packages |
| REQ-NF-AP02 | Visual delay before auto-pass (300-500ms) so the player briefly sees it's their turn | Measurable delay between turn change and pass action |
| REQ-NF-AP03 | Toggle design fits the game theme and is intuitive | Checkbox/toggle styled consistently with existing game UI |

---

## Scope

### In Scope
- Client-side auto-pass toggle UI component
- Auto-pass logic in the game page
- Integration with existing `canPass`, bomb window, wish enforcement, and dragon gift systems
- State management in `uiStore`
- Reset on trick end, game state sync, and player finish

### Out of Scope
- Server-side auto-pass awareness
- Bot auto-pass behavior (bots already have their own pass logic)
- Spectator view of auto-pass state
- Persisting auto-pass preference across games/sessions

---

## Assumptions

1. The client already receives `TRICK_WON` messages and `GAME_STATE` syncs that can trigger reset
2. The `canPass` function from `useCardSelection` accurately reflects server-side pass legality
3. The `PASS_TURN` message is always valid when `canPass` is true and it's the player's turn
4. The existing error toast system is sufficient for notifications

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Auto-pass fires when player can't legally pass (wish enforcement) | Medium | Medium | Check `canPass` before sending; disable toggle + notify if false |
| Race condition with bomb window | Low | Low | Auto-pass only fires on player's turn; bomb window is separate timing mechanism |
| Toggle not resetting on trick end | Low | High | Reset in both `TRICK_WON` handler and `GAME_STATE` sync; test both paths |
| Auto-pass sends during dragon gift pending | Low | High | Check `dragonGiftPending` before auto-passing; disable toggle if pending |

---

## Success Metrics

1. **Functional completeness:** All 12 functional requirements pass acceptance criteria
2. **No regressions:** Existing game flow (pass, play, bomb, tichu, dragon gift, wish) unaffected
3. **Test coverage:** 80%+ statement coverage on new code
4. **UX validation:** Toggle is visible, intuitive, and does not conflict with existing components
