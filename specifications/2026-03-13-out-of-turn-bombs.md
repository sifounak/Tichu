# Specification: Out-of-Turn Bomb Playing

**Date:** 2026-03-13
**Type:** Feature
**Status:** Draft
**Confidence:** High — all requirements clear, testable, non-conflicting; existing bomb infrastructure proven

## Goal

Implement out-of-turn bomb interrupts per official Tichu rules. Currently, bombs can only be played when it is the player's turn. In Tichu, any player may interrupt an active trick with a bomb at any time, even after passing. This is a core game mechanic that is currently missing.

**Why:** The game spec (REQ-F-CB02) references bomb interrupt rules, and the combination display on line 278 of the main spec states: "Bomb: Four-of-a-kind or straight flush; can be played out of turn and beats any non-bomb." This feature completes the bomb implementation.

## Scope

**In scope:**
- Server-side: Allow bomb plays from non-current-turn players during active tricks
- Client-side: Enable bomb card selection and "Bomb!" button when off-turn
- Unit tests for all new server paths

**Out of scope:**
- Bot out-of-turn bomb AI (deferred; bots only bomb on their turn)
- Bomb animation/sound enhancements beyond existing bomb effects
- Bomb window/timer mechanics (instant interrupt, matching standard digital Tichu implementations)

## Requirements

### Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| REQ-F-BI01 | Any non-finished player may play a bomb during an active trick, regardless of whose turn it is | Must | PLAY_CARDS with bomb cards accepted from non-current-turn seat when trick has plays |
| REQ-F-BI02 | Out-of-turn bomb must beat the current trick top (bomb beats non-bomb; higher bomb beats lower bomb) | Must | `validatePlay` rejects bombs that don't beat current trick top |
| REQ-F-BI03 | After an out-of-turn bomb, turn passes to the next active player after the bomber | Must | `currentTurn` set to `getNextActiveSeat(bomber)` after bomb play |
| REQ-F-BI04 | Bombs cannot be used to lead a new trick out of turn (no active trick or empty trick) | Must | PLAY_CARDS with bomb rejected when `currentTrick` is null or has no plays |
| REQ-F-BI05 | Bombs cannot be played during dragon gift pending state | Must | PLAY_CARDS rejected when `dragonGiftPending` is set or machine is in `awaitingDragonGift` |
| REQ-F-BI06 | A player who has already passed in the current trick may still play a bomb | Must | Bomb accepted from seat that is in `trick.passes` array |
| REQ-F-BI07 | Finished players (hand empty, finishOrder set) cannot play bombs | Must | PLAY_CARDS rejected when `player.finishOrder !== null` |
| REQ-F-BI08 | Pass count resets after a bomb is played (existing behavior preserved) | Must | `trick.passes` cleared to `[]` after bomb play |
| REQ-F-BI09 | Client shows "Bomb!" button when player is off-turn, in playing phase, and has a valid bomb selected | Must | Red "Bomb!" button visible; clicking sends PLAY_CARDS |
| REQ-F-BI10 | Client allows card selection for bomb-forming combinations when off-turn | Must | Cards clickable during playing phase even when not player's turn; only bomb-forming selections allowed |
| REQ-F-BI11 | Client restricts off-turn `canPlay` to bomb selections only | Must | `canPlay` false for non-bomb combinations when off-turn |
| REQ-F-BI12 | No new protocol message type required — reuse existing `PLAY_CARDS` | Must | No changes to `protocol.ts` message schemas |

### Non-Functional Requirements

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| REQ-NF-BI01 | Race condition safety: simultaneous bomb + normal play handled by sequential XState event processing | Must | No state corruption when two PLAY_CARDS events arrive near-simultaneously |
| REQ-NF-BI02 | Backward compatibility: on-turn play behavior unchanged | Must | All existing game-state-machine and move-handler tests still pass |

## Edge Cases

| ID | Scenario | Expected Behavior |
|---|---|---|
| EC-BI01 | Player tries to bomb when no trick is active (leading position) | Rejected: "Not your turn" |
| EC-BI02 | Finished player tries to bomb | Rejected: guard/handler blocks finished players |
| EC-BI03 | Bomb played during dragon gift pending | Rejected: machine in `awaitingDragonGift` state |
| EC-BI04 | Two players send bombs simultaneously | First processed wins; second validated against updated trick top |
| EC-BI05 | Player passed in current trick, then bombs | Allowed — passes don't prevent bombing |
| EC-BI06 | Bomb played that doesn't beat current trick top (lower bomb) | Rejected by `validatePlay` → `canBeat` |
| EC-BI07 | Normal (non-bomb) play attempted out of turn | Rejected: "Not your turn" |

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Bomb detection adds latency to move handler | Low | Low | `detectCombination` is fast (< 1ms); only called on off-turn plays |
| Client card selection complexity increases | Low | Medium | Reuse existing `getSelectableCards` with `isMyTurn` flag; add `isBombSelection` check |
| Bot confusion from unexpected turn changes | Low | Medium | Bots only act on their turn; out-of-turn bombs from humans just shift `currentTurn` |

## Success Metrics

1. All existing tests pass (backward compatibility)
2. New unit tests for: bomb accepted off-turn, non-bomb rejected off-turn, bomb rejected with no trick, bomb rejected for finished player, bomb rejected during dragon gift, turn advances to next-after-bomber
3. Manual E2E: select 4-of-a-kind off-turn → "Bomb!" button appears → click → trick updates → turn changes correctly
4. Manual E2E: bomb after passing in current trick works
5. 80%+ statement coverage for modified files

## Design Decisions

| Decision | Rationale |
|---|---|
| Reuse `PLAY_CARDS` event, not new `PLAY_BOMB` | Avoids duplicating validation logic; bomb detection at guard level is sufficient |
| Array transition in XState (`isBombPlay` first, then `isPlayersTurn`) | XState evaluates in order; first matching guard wins; clean separation |
| Bomb-only card selection off-turn via `isMyTurn` param in hook | Minimal changes to existing hook; no separate bomb selection mechanism |
| Bots don't bomb out of turn (MVP) | Simplifies implementation; bot strategy enhancement deferred |

## Files to Modify

| File | Change |
|---|---|
| `code/packages/server/src/game/move-handler.ts` | Relax turn check for bombs; add bomb/trick/dragon validation |
| `code/packages/server/src/game/game-state-machine.ts` | Add `isBombPlay` guard; change PLAY_CARDS to array transition |
| `code/packages/client/src/hooks/useCardSelection.ts` | Add `isMyTurn` param; add `isBombSelection` return; off-turn filtering |
| `code/packages/client/src/components/game/ActionBar.tsx` | Add `hasBombReady`/`onBomb` props; show Bomb! button |
| `code/packages/client/src/components/game/ActionBar.module.css` | Add `.bombButton` style |
| `code/packages/client/src/app/game/[gameId]/page.tsx` | Wire `isMyTurn` to hook; add `handleBomb`; connect ActionBar/GameTable |
