# Milestone 6: Bomb Window Delay Between Turns

## Context

After a card is played, the next player can act immediately. This leaves no time for other players to consider playing a bomb. A 2-second delay after each play gives all players a window to decide whether to bomb, matching the physical card game experience.

## Approach: Client-Side Queued Play

The server continues to broadcast state immediately (no server changes). All clients implement a consistent delay before allowing non-bomb plays. This is purely a UX timing layer.

**Behavior**:
- After a play is made, a 2-second countdown starts on the client — **only if at least one human player still has cards**
- During countdown: bomb buttons remain active (instant), but the normal Play button queues the action
- When the countdown expires: queued play (if any) is sent automatically
- If a bomb is played during the window: countdown resets for the new play
- Countdown respects animation speed setting (scaled by multiplier)
- When animation speed is `off`: no delay
- **When all humans have finished** (only bots remain with cards): no bomb window — bots play at server-controlled speed as before

**Detection**: The client checks `roomStore.players` (which has `isBot` per seat) against the game's `finishOrder` and `otherPlayers[].cardCount` to determine if any human still has cards.

## Steps

### Step 1: Add `bombWindow` base duration to animation settings
**File**: [useAnimationSettings.ts](code/packages/client/src/hooks/useAnimationSettings.ts)

Add to `AnimationDurations` interface and `BASE_DURATIONS`:
```typescript
bombWindow: number;  // 2.0s base
```

### Step 2: Add bomb window state to uiStore
**File**: [uiStore.ts](code/packages/client/src/stores/uiStore.ts)

Add:
- `bombWindowActive: boolean` — countdown is running
- `bombWindowEndTime: number | null` — timestamp when window expires (for countdown display)
- `queuedPlay: { cardIds: number[], phoenixAs?: Rank, wish?: Rank | null } | null` — play held during window
- `startBombWindow: (durationMs: number) => void`
- `clearBombWindow: () => void`
- `setQueuedPlay: (play) => void`
- `clearQueuedPlay: () => void`

### Step 3: Create `useBombWindow` hook
**New file**: `code/packages/client/src/hooks/useBombWindow.ts`

Manages the bomb window lifecycle:
```typescript
export function useBombWindow(send, uiStore, roomPlayers, gameStore) {
  const { durations, enabled } = useAnimationSettings();

  // Check if any human player still has cards
  const anyHumanActive = useMemo(() => {
    const botSeats = new Set(roomPlayers.filter(p => p.isBot).map(p => p.seat));
    // Check if any non-bot seat still has cards
    const finishedSeats = new Set(gameStore.finishOrder);
    const mySeat = gameStore.mySeat;
    // Human players: all seats not in botSeats
    // Active: not in finishOrder
    for (const seat of ['north', 'east', 'south', 'west']) {
      if (!botSeats.has(seat) && !finishedSeats.has(seat)) return true;
    }
    return false;
  }, [roomPlayers, gameStore.finishOrder, gameStore.mySeat]);

  // Start bomb window when a play is received — only if a human is still active
  const startWindow = useCallback(() => {
    if (!enabled || durations.bombWindow === 0 || !anyHumanActive) return;
    const durationMs = durations.bombWindow * 1000;
    uiStore.startBombWindow(durationMs);
  }, [durations, enabled, uiStore, anyHumanActive]);

  // Timer effect: when bomb window expires, send queued play if any
  useEffect(() => {
    if (!uiStore.bombWindowActive || !uiStore.bombWindowEndTime) return;
    const remaining = uiStore.bombWindowEndTime - Date.now();
    if (remaining <= 0) {
      flushQueuedPlay();
      return;
    }
    const timer = setTimeout(flushQueuedPlay, remaining);
    return () => clearTimeout(timer);
  }, [uiStore.bombWindowActive, uiStore.bombWindowEndTime]);

  const flushQueuedPlay = useCallback(() => {
    const queued = uiStore.queuedPlay;
    uiStore.clearBombWindow();
    uiStore.clearQueuedPlay();
    if (queued) {
      send({ type: 'PLAY_CARDS', ...queued });
      uiStore.clearSelection();
    }
  }, [send, uiStore]);

  return { startWindow, flushQueuedPlay };
}
```

### Step 4: Trigger bomb window on state change
**File**: [page.tsx](code/packages/client/src/app/game/[gameId]/page.tsx)

Detect when a new play appears in the game state (trick changes) and start the bomb window. The bomb window starts after every play while a human is still active.

### Step 5: Modify handlePlay to queue during bomb window
**File**: [page.tsx](code/packages/client/src/app/game/[gameId]/page.tsx)

In `handlePlay`, if bomb window is active and the play is NOT a bomb:
```typescript
if (uiStore.bombWindowActive && !selection.isBombSelection) {
  uiStore.setQueuedPlay({ cardIds, phoenixAs, wish });
  return; // Don't send yet — will be sent when window expires
}
// Otherwise send immediately (bombs bypass the window)
```

Bomb plays always send immediately (no queue).

### Step 6: Add visual countdown indicator
**File**: [ActionBar.tsx](code/packages/client/src/components/game/ActionBar.tsx)

Show visual feedback when bomb window is active:
- Play button shows "Queued" state when a play is waiting
- Subtle countdown/progress indicator

### Step 7: Add tests
1. Bomb window starts on play when human is active
2. No bomb window when only bots remain
3. Non-bomb play is queued during active window
4. Bomb play sends immediately (not queued)
5. Queued play is sent when window expires
6. Window resets when a bomb is played during it
7. No delay when animation speed is `off`

## Verification
```bash
cd code && npx vitest run --project client
```
Manual: play a game, observe 2-second delay between turns, try bombing during the window, verify queued plays send after delay. Verify no delay when all humans finish.
