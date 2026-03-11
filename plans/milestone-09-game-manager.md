# Milestone 9: Game Manager

**Package(s):** server
**Requirements:** Server-side game orchestration tying FSM + engine + WebSocket

## Goal

Implement the GameManager that orchestrates gameplay: receives client messages, validates moves via the shared engine, transitions the state machine, and broadcasts updates.

## Tasks

### 9.1 Game manager (`packages/server/src/game/game-manager.ts`)
- `GameManager` class: one instance per active game
- Holds `GameState`, `GameStateMachine` instance, `BotRunner` reference
- `handleMessage(seat: Seat, message: ClientMessage): void`
  - Validate message is legal in current state/phase
  - Delegate to move handler
  - Trigger state machine transition
  - Check for auto-transitions (trick complete → new trick, round complete → new round)
  - If next player is bot, schedule bot turn
  - Broadcast updated views to all players

### 9.2 Move handler (`packages/server/src/game/move-handler.ts`)
- `validateAndApplyPlay(cards: GameCard[], seat: Seat, state: GameState): MoveResult`
  - Verify it's this player's turn
  - Verify cards are in player's hand
  - Call `shared/engine/rules.validatePlay()`
  - If valid: remove cards from hand, add to trick, advance turn
  - Return result with new state or error

### 9.3 Dragon gift handler
- When Dragon wins a trick: enter AWAITING_DRAGON_GIFT
- If one opponent already out → auto-gift to remaining opponent (skip prompt)
- If bomb wins trick containing Dragon → no gift, winner keeps trick

### 9.4 Disconnect handler (`packages/server/src/game/disconnect-handler.ts`)
- On disconnect: notify remaining players, start vote
- Vote options: wait (with timeout), replace with bot, abandon
- Majority decides (or timeout → replace with bot)
- On reconnect: restore player's seat, send full GAME_STATE

### 9.5 Game lifecycle
- `createGame(room: Room): GameManager`
- `destroyGame(gameId: string): void`
- Active games stored in `Map<string, GameManager>` (in-memory)

## Tests

- Full game flow: create → deal → tichu → pass → play tricks → score → next round
- Invalid move rejection: wrong turn, invalid combination, wish violation
- Dragon gift: normal case, auto-select, bomb override
- Disconnect: vote flow, bot replacement, reconnection
- Multiple concurrent games (isolated state)

## Verification

1. All tests pass
2. Coverage ≥ 80%
3. Integration test: simulate a full game via WebSocket messages
