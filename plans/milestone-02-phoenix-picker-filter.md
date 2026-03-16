# Milestone 2: Phoenix Picker Context-Aware Filtering

## Context

`resolvePhoenixValues` returns `choose` with multiple candidate values even when only one produces a combination that beats the current trick. This causes an unnecessary Phoenix picker modal.

**Examples**:
- Trick top is FH 4,4,4,8,8 (rank 4). Player plays 3,3,9,9,Phoenix. Resolver returns `choose: [3, 9]` but Phoenix=3 gives FH rank 3 (can't beat rank 4). Only Phoenix=9 is valid → should auto-resolve.
- Trick top is straight rank 8 (length 5). Player plays 5,6,7,8,Phoenix. Resolver returns `choose: [4, 9]` but Phoenix=4 gives straight rank 8 (can't beat 8). Only Phoenix=9 is valid → should auto-resolve.
- When leading (no trick to beat), both choices remain valid → correctly show picker.

## Steps

### Step 1: Add `filterChoicesByTrick` helper
**File**: [phoenix-resolver.ts](code/packages/shared/src/engine/phoenix-resolver.ts)

Add a helper that filters `choose` candidates against the trick top. Import `canBeat` from `./combination-validator.js`.

```typescript
import { canBeat } from './combination-validator.js';
import { CombinationType } from '../types/combination.js';

function filterChoicesByTrick(
  validValues: number[],
  comboType: CombinationType,
  comboLength: number,
  nonPhoenixMaxRank: number,
  currentTrick: TrickState | null,
): PhoenixResolution {
  if (!currentTrick || currentTrick.plays.length === 0) {
    // Leading — all choices valid
    return { status: 'choose', validValues };
  }
  const trickTop = currentTrick.plays[currentTrick.plays.length - 1].combination;

  const surviving = validValues.filter(value => {
    let comboRank: number;
    if (comboType === CombinationType.FullHouse) {
      comboRank = value; // FH rank = triple rank = phoenix value
    } else {
      comboRank = Math.max(nonPhoenixMaxRank, value); // Straight rank = highest card
    }
    const mock = { type: comboType, cards: [], rank: comboRank, length: comboLength, isBomb: false };
    return canBeat(mock as any, trickTop);
  });

  if (surviving.length === 0) return { status: 'invalid' };
  if (surviving.length === 1) return { status: 'auto', value: surviving[0] };
  return { status: 'choose', validValues: surviving };
}
```

### Step 2: Apply filter after full house `choose`
**File**: [phoenix-resolver.ts:74-78](code/packages/shared/src/engine/phoenix-resolver.ts#L74-L78)

When `resolveFullHousePhoenix` returns `choose`, filter against trick:

```typescript
if (selectedCards.length === 5 && nonPhoenix.length === 4) {
  const fh = resolveFullHousePhoenix(nonPhoenix);
  if (fh.status === 'choose') {
    return filterChoicesByTrick(fh.validValues, CombinationType.FullHouse, 1, 0, currentTrick);
  }
  if (fh.status !== 'invalid') return fh;
  return resolveStraightPhoenix(nonPhoenix, selectedCards.length);
}
```

### Step 3: Apply filter after straight `choose`
**File**: [phoenix-resolver.ts:78,87](code/packages/shared/src/engine/phoenix-resolver.ts#L78)

When `resolveStraightPhoenix` returns `choose`, filter against trick. Need to compute `maxNonPhoenixRank` from the non-Phoenix cards:

```typescript
const straightResult = resolveStraightPhoenix(nonPhoenix, selectedCards.length);
if (straightResult.status === 'choose') {
  const maxRank = Math.max(...nonPhoenix.map(gc =>
    isMahjong(gc.card) ? MAHJONG_RANK : (gc.card as { rank: number }).rank
  ));
  return filterChoicesByTrick(straightResult.validValues, CombinationType.Straight, selectedCards.length, maxRank, currentTrick);
}
return straightResult;
```

Apply at both straight return sites (5-card and 6+-card paths).

### Step 4: Add tests
**File**: [phoenix-resolver.test.ts](code/packages/shared/tests/engine/phoenix-resolver.test.ts)

1. FH 2+2 where only higher triple beats trick → auto-resolves to higher rank
2. FH 2+2 where neither beats trick → returns invalid
3. FH 2+2 when leading → still returns choose (both valid)
4. Straight extension where only top-extend beats trick → auto-resolves to higher
5. Straight extension when leading → still returns choose (both valid)
6. Straight extension where neither beats → returns invalid

## Verification
```bash
cd code && npx vitest run --project shared
```
All existing tests must pass, plus ~6 new tests.
