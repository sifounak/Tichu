# Milestone 7: Game State Machine

**Package(s):** server (with shared types)
**Requirements:** Full game lifecycle management

## Goal

Implement the hierarchical FSM using XState v5 that governs the complete game lifecycle from lobby through rounds to game over.

## Tasks

### 7.1 State machine definition (`packages/server/src/game/game-state-machine.ts`)

States and transitions:
```
LOBBY → DEALING_FIRST_8 → GRAND_TICHU_DECISION → DEALING_REMAINING_6 →
REGULAR_TICHU_DECISION → CARD_PASSING → PLAYING (AWAITING_PLAY ↔ passes/plays) →
AWAITING_DRAGON_GIFT → TRICK_COMPLETE → ROUND_COMPLETE → (next round or GAME_OVER)
```

Events: PLAYER_JOINED, HOST_START_GAME, DEAL_COMPLETE, GRAND_TICHU_CALL/PASS, REGULAR_TICHU_CALL/PASS, CARDS_PASSED, PLAY_CARDS, PASS_TURN, DRAGON_GIFT_CHOSEN, TRICK_COLLECTED, ROUND_SCORED

### 7.2 State context

The machine holds full `GameState` as context. Each transition updates state via actions:
- `dealCards`: shuffle + deal, update player hands
- `recordTichuCall`: mark player's call
- `passCards`: exchange cards between players
- `playCards`: remove from hand, add to trick
- `advanceTurn`: move to next active player (skip finished players)
- `completeTrick`: determine winner, collect points, handle Dragon gift
- `scoreRound`: calculate scores, check game over

### 7.3 Turn management (`packages/server/src/game/turn-timer.ts`)

- `TurnTimer` class: starts countdown per turn, emits timeout event
- Auto-pass on timeout
- Configurable duration (from GameConfig)
- No timer if config says null

### 7.4 Guard conditions

- `canStartGame`: 4 seats filled
- `allDecided`: all players made Tichu decision
- `allPassed`: all players passed cards
- `isTrickComplete`: 3 consecutive passes (or all active players passed)
- `isRoundComplete`: ≤1 player has cards
- `isGameOver`: a team reached target score

## Tests

- Full round lifecycle: deal → tichu decisions → passing → play to completion → scoring
- State transition guards: can't start without 4 players, can't play out of turn
- Turn order: skips finished players correctly
- Dragon gift state: enters AWAITING_DRAGON_GIFT when Dragon wins, skips if one opponent out
- Bomb override: no dragon gift when bomb wins trick with Dragon
- 1-2 finish detection
- Multiple rounds to game over
- Timer timeout triggers auto-pass

## Verification

1. All tests pass
2. Coverage ≥ 80% on state machine
3. State machine visualization (XState inspector) confirms correct transitions
