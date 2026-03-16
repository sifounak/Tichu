# Milestone 4: Wish Picker UI for Human Players

## Context

When a human player plays the Mahjong, no wish picker is shown. The client never sends a wish. The server/protocol/store infrastructure all exists, but the UI prompt is absent. Only bots handle wish declaration (currently always null).

**Existing infrastructure:**
- `DECLARE_WISH` client message in [protocol.ts:58](code/packages/shared/src/types/protocol.ts#L58)
- Server handles it in [move-handler.ts:220](code/packages/server/src/game/move-handler.ts#L220) and [state machine:783](code/packages/server/src/game/game-state-machine.ts#L783)
- Client store handles `WISH_DECLARED` / `WISH_FULFILLED` in [gameStore.ts:133](code/packages/client/src/stores/gameStore.ts#L133)
- TrickArea shows "Wish: X" indicator
- **Pattern to follow**: [PhoenixValuePicker.tsx](code/packages/client/src/components/cards/PhoenixValuePicker.tsx) + `showPhoenixPicker`/`hidePhoenixPicker` in [uiStore.ts:18-20](code/packages/client/src/stores/uiStore.ts#L18-L20)

**Approach**: Send wish inline with `PLAY_CARDS` message (not separate `DECLARE_WISH`). This avoids the race condition from Milestone 5.

## Steps

### Step 1: Add `wish` field to PLAY_CARDS client message schema
**File**: [protocol.ts:56](code/packages/shared/src/types/protocol.ts#L56)

```typescript
// Change from:
z.object({ type: z.literal('PLAY_CARDS'), cardIds: z.array(...), phoenixAs: rankSchema.optional() }),
// To:
z.object({ type: z.literal('PLAY_CARDS'), cardIds: z.array(...), phoenixAs: rankSchema.optional(), wish: rankSchema.nullable().optional() }),
```

### Step 2: Add wish picker state to uiStore
**File**: [uiStore.ts](code/packages/client/src/stores/uiStore.ts)

Follow the Phoenix picker pattern. Add:
- `wishPickerVisible: boolean` (initial: false)
- `pendingWishPlay: { cardIds: number[], phoenixAs?: Rank } | null` (stores the play while wish is being picked)
- `showWishPicker: (play: { cardIds: number[], phoenixAs?: Rank }) => void`
- `hideWishPicker: () => void`

### Step 3: Create WishPicker component
**New file**: `code/packages/client/src/components/game/WishPicker.tsx`

Follow [PhoenixValuePicker.tsx](code/packages/client/src/components/cards/PhoenixValuePicker.tsx) pattern:
- Overlay + picker modal
- 13 rank buttons (2-A) using `RANK_LABELS`
- "No Wish" button that calls `onSelect(null)`
- Cancel button
- Props: `onSelect: (rank: Rank | null) => void`, `onCancel: () => void`

**New file**: `code/packages/client/src/components/game/WishPicker.module.css`
- Reuse/adapt PhoenixValuePicker styles

### Step 4: Update handlePlay to show wish picker when Mahjong is played
**File**: [page.tsx:117-136](code/packages/client/src/app/game/[gameId]/page.tsx#L117-L136)

In `handlePlay`, after Phoenix resolution, check if Mahjong is in the selection:

```typescript
const hasMahjong = selection.selectedCards?.some(gc => gc.card.kind === 'mahjong')
  ?? hand.some(gc => selectedIds.has(gc.id) && gc.card.kind === 'mahjong');

if (hasMahjong) {
  uiStore.showWishPicker({ cardIds, phoenixAs });
  return;
}
```

Add a `handleWishChoice` callback:
```typescript
const handleWishChoice = useCallback((wish: Rank | null) => {
  const pending = uiStore.pendingWishPlay;
  if (!pending) return;
  send({ type: 'PLAY_CARDS', ...pending, wish });
  uiStore.hideWishPicker();
  uiStore.clearSelection();
}, [send, uiStore]);
```

Flow: Phoenix picker (if needed) → wish picker → send PLAY_CARDS with both phoenixAs and wish.

### Step 5: Wire WishPicker in game page JSX
**File**: [page.tsx](code/packages/client/src/app/game/[gameId]/page.tsx) (near PhoenixValuePicker, ~line 607)

```tsx
{uiStore.wishPickerVisible && (
  <WishPicker
    onSelect={handleWishChoice}
    onCancel={uiStore.hideWishPicker}
  />
)}
```

### Step 6: Update server to forward wish from PLAY_CARDS
**File**: [move-handler.ts:167-199](code/packages/server/src/game/move-handler.ts#L167-L199)

Extract `wish` from the client message and include it in the event sent to the state machine:

```typescript
// In handlePlayCards, when sending to actor:
this.actor.send({ type: 'PLAY_CARDS', seat, cards, wish: msg.wish });
```

The state machine's `playCards` action already handles `event.wish` at [line 540-543](code/packages/server/src/game/game-state-machine.ts#L540-L543).

### Step 7: Add tests

**Client component test**: `WishPicker.test.tsx`
1. Renders 13 rank buttons (2-A) + "No Wish"
2. Clicking rank calls onSelect with that rank
3. Clicking "No Wish" calls onSelect with null
4. Clicking overlay calls onCancel

**Integration test** (manual or e2e):
5. Play Mahjong → wish picker appears → select rank → wish indicator shows
6. Play Mahjong → wish picker appears → "No Wish" → no wish indicator

## Verification
```bash
cd code && npx vitest run --project client
cd code && npx vitest run --project server
```
Manual: play a game, lead with Mahjong, verify picker appears, select a wish, verify "Wish: X" shows in trick area.
