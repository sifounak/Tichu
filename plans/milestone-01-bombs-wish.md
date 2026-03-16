# Milestone 1: Out-of-Turn Bombs Must Bypass Wish Enforcement

## Context

Per the official Tichu FAQ: "When must a player fulfill the wish of the Mah Jong? **In his ordinary turn only.** A player does not need to fulfill a wish of the Mah Jong when playing a bomb out of turn."

Currently, `validatePlay()` enforces the wish for ALL plays, including out-of-turn bombs. This incorrectly blocks out-of-turn bombs that don't contain the wished rank.

**Important nuance**: In-turn play (including in-turn bombs) MUST still fulfill the wish. Only out-of-turn bombs are exempt.

## Steps

### Step 1: Skip wish for out-of-turn bombs in state machine
**File**: [game-state-machine.ts:521-535](code/packages/server/src/game/game-state-machine.ts#L521-L535)

In the `playCards` action, before calling `validatePlay`, detect out-of-turn bombs and pass `null` wish:

```typescript
const isOutOfTurn = seat !== round.currentTurn;
const combo = detectCombination(cards);
const isOutOfTurnBomb = isOutOfTurn && combo?.isBomb;
const activeWish = round.mahjongWish && !round.wishFulfilled ? round.mahjongWish : null;
const effectiveWish = isOutOfTurnBomb ? null : activeWish;

const validation = validatePlay(
  cards,
  round.players[seat].hand,
  round.currentTrick,
  effectiveWish,
);
```

`validatePlay` and `getValidPlays` in [rules.ts](code/packages/shared/src/engine/rules.ts) remain unchanged — their wish enforcement logic is correct for in-turn play.

### Step 2: Ensure hand filter allows bomb card selection during active wish
**File**: [hand-filter.ts:95-99](code/packages/shared/src/engine/hand-filter.ts#L95-L99)

The hand filter runs on the client and doesn't know about turn state. It should be permissive with bomb-forming cards since the player might play an out-of-turn bomb. The existing `canParticipateInWishPlay` already allows four-bomb cards (line 436) but misses straight flush bomb cards. Add a fallback:

```typescript
if (mustFulfillWish) {
  if (canParticipateInWishPlay(gc, hand, wish!, currentTop)) {
    selectable.add(gc.id);
  } else if (canParticipateInBomb(gc, hand)) {
    selectable.add(gc.id);  // bombs always playable (out-of-turn)
  }
  continue;
}
```

Add helper `canParticipateInBomb(gc, hand)` that returns true if:
- Card is standard with 3 others of same rank in hand (four-bomb)
- Card is standard and part of a 5+ same-suit consecutive sequence in hand (straight flush bomb)

### Step 3: Add tests
**File**: [rules.test.ts](code/packages/shared/tests/engine/rules.test.ts)
1. `validatePlay` with `wish=null` (out-of-turn bomb scenario): bomb without wished rank is valid
2. `validatePlay` with `wish=8` (in-turn scenario): bomb without wished rank is rejected when player can fulfill wish
3. `validatePlay` with `wish=8` (in-turn scenario): bomb WITH wished rank is valid
4. `getValidPlays`: in-turn filters to wish-fulfilling plays only (no non-wish bombs)
5. `canPlayerPass`: still false when wish fulfillable (no regression)

**File**: State machine integration tests or dedicated test
6. Out-of-turn bomb play succeeds when wish is active and player has wished rank
7. In-turn non-wish bomb is rejected when wish is active and fulfillable

**File**: [hand-filter.test.ts](code/packages/shared/tests/engine/hand-filter.test.ts)
8. Four-bomb cards selectable during active wish
9. Straight flush bomb cards selectable during active wish

## Verification
```bash
cd code && npx vitest run --project shared
cd code && npx vitest run --project server
```
All existing tests must pass, plus ~9 new tests.
