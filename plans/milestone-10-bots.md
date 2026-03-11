# Milestone 10: Bot Framework + EasyBot

**Package(s):** server
**Requirements:** Bot AI for single-player and mixed games

## Goal

Implement the bot strategy interface and an EasyBot that plays randomly from valid moves. This enables solo play and testing full game flows.

## Tasks

### 10.1 Bot interface (`packages/server/src/bot/bot-interface.ts`)

```typescript
interface BotStrategy {
  readonly difficulty: 'easy' | 'medium' | 'hard';
  chooseGrandTichu(hand8: GameCard[]): boolean;
  chooseRegularTichu(hand14: GameCard[]): boolean;
  chooseCardsToPass(hand: GameCard[], partnerSeat: Seat): Record<Seat, GameCard>;
  choosePlay(context: BotPlayContext): BotPlayDecision;
  chooseDragonGiftRecipient(opponents: Seat[], trickPoints: number): Seat;
  chooseMahjongWish(hand: GameCard[]): number | null;
}
```

### 10.2 Bot runner (`packages/server/src/bot/bot-runner.ts`)
- Manages bot instances per game
- Called by GameManager when it's a bot's turn
- Adds artificial delay (200-1500ms based on config animation speed)
- Converts BotPlayDecision to ClientMessage

### 10.3 EasyBot (`packages/server/src/bot/easy-bot.ts`)
- Grand Tichu: always pass
- Regular Tichu: always pass
- Card passing: random cards (1 to each other player)
- Play: random valid combination from `getValidPlays()`, or pass if allowed
- Dragon gift: random opponent
- Mahjong wish: null (no wish)

### 10.4 Bot smoke test framework
- Run full 4-bot games to completion
- Verify no invalid states reached
- Verify game terminates (no infinite loops)
- Verify scoring is correct

## Tests

- EasyBot makes valid decisions in all game phases
- BotRunner invokes strategy at correct times
- Full 4-bot game: runs to completion without errors (multiple iterations)
- Bot delay: artificial thinking time applied
- Bot replaces disconnected player mid-game

## Verification

1. All tests pass
2. Coverage ≥ 80%
3. Smoke test: 100 full bot games complete without errors
