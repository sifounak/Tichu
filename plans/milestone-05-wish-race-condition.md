# Milestone 5: Fix Wish Declaration Race Condition

## Context

Two mechanisms exist for declaring the Mahjong wish:
1. **Inline** with `PLAY_CARDS` via `event.wish` field ([state machine:540-543](code/packages/server/src/game/game-state-machine.ts#L540-L543))
2. **Separate** `DECLARE_WISH` event ([state machine:783-799](code/packages/server/src/game/game-state-machine.ts#L783-L799))

If only mechanism 2 is used, the turn advances before the wish is set. The next player could play without wish enforcement.

After Milestone 4, human players use the inline mechanism. This milestone tightens the separate `DECLARE_WISH` path (used by bots) and migrates bots to inline as well.

## Steps

### Step 1: Migrate bots to inline wish with PLAY_CARDS
**File**: [bot-runner.ts](code/packages/server/src/bot/bot-runner.ts)

Currently bots use `handleMahjongWishAfterPlay` to send a separate `DECLARE_WISH`. Change to include wish inline:

```typescript
// When bot plays cards, check if Mahjong is among them:
const mahjongPlayed = playedCards.some(gc => isMahjong(gc.card));
const wish = mahjongPlayed ? bot.chooseMahjongWish(remainingHand) : undefined;

// Send PLAY_CARDS with wish inline:
this.send({ type: 'PLAY_CARDS', seat, cards: decision.cards, wish });
```

Remove the `handleMahjongWishAfterPlay` method and its `scheduleAction` call.

**Note**: Pass `remainingHand` (hand after removing played cards) to `chooseMahjongWish`, not the full hand before the play.

### Step 2: Add guard to DECLARE_WISH handler
**File**: [game-state-machine.ts:783-799](code/packages/server/src/game/game-state-machine.ts#L783-L799)

Add a guard so `DECLARE_WISH` only works if the Mahjong play was the MOST RECENT play in the trick (no other play has been made since):

```typescript
DECLARE_WISH: {
  actions: assign(({ context, event }) => {
    if (event.type !== 'DECLARE_WISH' || !context.currentRound) return {};
    const round = structuredClone(context.currentRound) as RoundState;
    if (!round.currentTrick) return {};

    // Only process if the last play was by this player and contained Mahjong
    const lastPlay = round.currentTrick.plays[round.currentTrick.plays.length - 1];
    if (!lastPlay || lastPlay.seat !== event.seat) return {}; // Too late — someone else played

    const mahjongPlayed = lastPlay.combination.cards.some(gc => isMahjong(gc.card));
    if (!mahjongPlayed) return {};

    round.mahjongWish = event.rank;
    if (event.rank !== null) {
      round.wishFulfilled = false;
    }
    return { currentRound: round };
  }),
},
```

### Step 3: Add validation in move-handler
**File**: [move-handler.ts:220-239](code/packages/server/src/game/move-handler.ts#L220-L239)

Tighten `handleDeclareWish` to reject if another play occurred since the Mahjong play:

```typescript
// After existing mahjongPlayed check, add:
const lastPlay = round.currentTrick.plays[round.currentTrick.plays.length - 1];
if (!lastPlay || lastPlay.seat !== seat) {
  return { ok: false, error: 'Cannot declare wish after another player has played' };
}
```

### Step 4: Add tests

**Server/state machine tests**:
1. Wish set correctly when inline with `PLAY_CARDS` event
2. `DECLARE_WISH` accepted when it's the last play in trick
3. `DECLARE_WISH` rejected when another player played after Mahjong
4. Bot sends wish inline correctly (no separate DECLARE_WISH)

## Verification
```bash
cd code && npx vitest run --project server
```
Manual: play with bots, verify Mahjong wish works correctly when bots play Mahjong.
