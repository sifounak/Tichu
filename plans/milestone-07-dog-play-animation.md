# Milestone 7: Dog Card Play Animation

## Context

When the Dog is played, the server immediately sets `currentTrick = null` (no trick created) and passes the lead. On the client, the Dog card is never shown — the trick area stays empty and the turn indicator just jumps to the partner. This is visually confusing.

**Desired behavior**: Show the Dog in the play area for 2 seconds, then animate it sweeping toward the player who receives the lead (partner or next active), similar to how trick cards sweep toward the winner.

## Approach: Client-Side Ephemeral Animation State

The server behavior stays the same (Dog sets `currentTrick = null`). The client intercepts the `CARDS_PLAYED` event for Dog plays and renders a temporary animation overlay.

## Steps

### Step 1: Add Dog animation state to uiStore
**File**: [uiStore.ts](code/packages/client/src/stores/uiStore.ts)

Add:
- `dogAnimation: { cardId: number, fromSeat: Seat, toSeat: Seat } | null`
- `startDogAnimation: (cardId: number, fromSeat: Seat, toSeat: Seat) => void`
- `clearDogAnimation: () => void`

### Step 2: Detect Dog play in server message handler
**File**: [page.tsx](code/packages/client/src/app/game/[gameId]/page.tsx)

When processing `CARDS_PLAYED` with a Dog card, start the Dog animation instead of immediately updating the trick area:

```typescript
if (msg.type === 'CARDS_PLAYED' && msg.combinationType === 'dog') {
  // Determine who receives the lead from the game state
  const toSeat = gameStore.currentTurn; // Updated by GAME_STATE
  uiStore.startDogAnimation(msg.cardIds[0], msg.seat, toSeat);

  // Clear after animation completes (2s pause + sweep)
  setTimeout(() => uiStore.clearDogAnimation(), 2500 * animMultiplier);
}
```

The `toSeat` comes from the updated game state (`currentTurn` after the Dog play).

### Step 3: Render Dog animation in TrickDisplay
**File**: [TrickDisplay.tsx](code/packages/client/src/components/game/TrickDisplay.tsx)

Add a `dogAnimation` prop. When set, render the Dog card in the play area with:

1. **Entry phase** (0-0.25s): Dog slides in from the playing seat (same as normal card play animation using `ENTRY_OFFSETS`)
2. **Pause phase** (0.25s-2.25s): Dog card sits in center of play area
3. **Sweep phase** (2.25s-2.65s): Dog sweeps toward `toSeat` (same animation as trick sweep using `EXIT_OFFSETS`)

Use Framer Motion with `AnimatePresence`:
```tsx
{dogAnimation && (
  <motion.div
    key="dog-play"
    className={styles.dogCard}
    initial={ENTRY_OFFSETS[seatPosition(dogAnimation.fromSeat, mySeat)]}
    animate={{ x: 0, y: 0, opacity: 1 }}
    exit={{
      ...EXIT_OFFSETS[seatPosition(dogAnimation.toSeat, mySeat)],
      opacity: 0,
    }}
    transition={{
      animate: { type: 'spring', stiffness: 200, damping: 20 },
      exit: { duration: durations.trickSweep, ease: 'easeIn', delay: 2.0 * multiplier },
    }}
  >
    <Card card={{ kind: 'dog' }} />
  </motion.div>
)}
```

### Step 4: Pass dogAnimation through component hierarchy
**File**: [GameTable.tsx](code/packages/client/src/components/game/GameTable.tsx)

Pass `dogAnimation` from uiStore down to TrickDisplay:
```typescript
const dogAnimation = useUiStore(s => s.dogAnimation);
// Pass to TrickArea → TrickDisplay
```

**File**: [TrickArea.tsx](code/packages/client/src/components/game/TrickArea.tsx)

Accept and forward `dogAnimation` prop to TrickDisplay.

### Step 5: Scale animation timing with animation speed
All timing (2s pause, sweep duration) should be multiplied by the animation speed multiplier from `useAnimationSettings`. When speed is `off`, skip the Dog animation entirely (just show instant turn change as before).

### Step 6: Coordinate with bomb window (Milestone 6)
If Milestone 6 is implemented, the bomb window timer should NOT start for Dog plays (since the Dog doesn't create a trick and can't be bombed — per FAQ: "Bombs cannot be used to take the hound").

### Step 7: Add tests

**Component test**: TrickDisplay with dogAnimation prop
1. Dog card renders in play area when dogAnimation is set
2. Dog card not rendered when dogAnimation is null
3. Entry animation starts from correct seat position
4. Exit animation goes toward correct recipient seat

**Integration test** (manual):
5. Play Dog → Dog appears in center → pauses → sweeps to partner
6. Dog as last card → animation plays → player marked finished

## Verification
```bash
cd code && npx vitest run --project client
```
Manual: play the Dog in a game, verify it appears in play area, pauses, then sweeps toward the lead recipient.
