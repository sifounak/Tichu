# Milestone 3: Wish Rank Validation in Move Handler

## Context

`handleDeclareWish` in the server's move-handler has no runtime validation that the wished rank is 2-14. The Zod schema in [protocol.ts:58](code/packages/shared/src/types/protocol.ts#L58) uses `rankSchema.nullable()` which validates 2-14 at the WebSocket message parsing layer, providing partial protection. This adds defense-in-depth at the move-handler level.

## Steps

### Step 1: Add rank validation
**File**: [move-handler.ts:220-239](code/packages/server/src/game/move-handler.ts#L220-L239)

After the `mahjongPlayed` check (line 234), add:

```typescript
if (rank !== null && (typeof rank !== 'number' || rank < 2 || rank > 14 || !Number.isInteger(rank))) {
  return { ok: false, error: 'Wish rank must be an integer between 2 and 14' };
}
```

### Step 2: Add tests
**File**: Server tests (create or add to existing move-handler tests)

1. `handleDeclareWish` rejects rank 1 (Mahjong)
2. `handleDeclareWish` rejects rank 0
3. `handleDeclareWish` rejects rank 15
4. `handleDeclareWish` rejects rank 7.5 (non-integer)
5. `handleDeclareWish` accepts rank null (no wish)
6. `handleDeclareWish` accepts rank 7 (valid)

## Verification
```bash
cd code && npx vitest run --project server
```
