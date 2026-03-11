# Milestone 4: Phoenix Resolver

**Package(s):** shared
**Requirements:** Phoenix value determination for all combination types

## Goal

Implement the Phoenix resolution algorithm that determines valid Phoenix values for any card selection. This is the most intricate piece of game logic.

## Core Rules

- Phoenix NEVER forms a bomb (four-of-a-kind or straight flush)
- Phoenix NEVER acts as Dragon, Dog, or Mahjong
- Phoenix value cannot equal or be lower than Mahjong (rank 1); minimum Phoenix rank in combinations is 2
- Leading single Phoenix = 1.5 always
- Phoenix on existing single trick = current leader + 0.5

## Tasks

### 4.1 Phoenix resolver (`packages/shared/src/engine/phoenix-resolver.ts`)

```typescript
type PhoenixResolution =
  | { status: 'not_present' }
  | { status: 'auto'; value: number }
  | { status: 'choose'; validValues: number[] }
  | { status: 'single_lead'; value: 1.5 }
  | { status: 'single_ontrick'; value: number }
  | { status: 'invalid' };
```

- `resolvePhoenixValues(selectedCards: GameCard[], currentTrick: TrickState | null): PhoenixResolution`

### 4.2 Resolution logic by combination type

1. **No Phoenix in selection** → `not_present`
2. **Single, leading** → `{ status: 'single_lead', value: 1.5 }`
3. **Single, on trick** → `{ status: 'single_ontrick', value: topRank + 0.5 }`
4. **Pair (2 cards, 1 other)** → Phoenix = other card's rank → `auto`
5. **Triple (3 cards, 2 others must be pair)** → Phoenix = that rank → `auto`
6. **Full House (5 cards, 4 others)**:
   - 3+1 → Phoenix matches the 1 → `auto`
   - 2+2 → Phoenix could join either pair → `choose` with both ranks
7. **Straight (5+ cards)**:
   - Sort non-Phoenix by rank, enumerate valid starting positions
   - For each valid start S: target = [S..S+N], missing = target - nonPhoenix
   - If |missing| == 1 and missing[0] >= 2: candidate
   - If 1 candidate → `auto`; if 2+ → `choose`; if 0 → `invalid`
   - Special: starting with non-Phoenix 2, only high end is valid
8. **Pair Sequence**: Find the incomplete pair → `auto` (or `choose` if ambiguous)
9. **Would form bomb** → `invalid`

## Tests

- Single lead: Phoenix alone → 1.5
- Single on trick (trick has 7): Phoenix → 7.5
- Pair: Phoenix + 5♠ → auto 5
- Triple: Phoenix + 8♠ + 8♦ → auto 8
- Full house 3+1+Phoenix: [K,K,K,5,Phoenix] → auto 5
- Full house 2+2+Phoenix: [K,K,5,5,Phoenix] → choose [K, 5]
- Straight with gap: [3,4,6,7,Phoenix] → auto 5
- Straight open-ended: [3,4,5,6,Phoenix] → choose [2, 7] (but 2 is valid since >= 2)
- Straight starting with 2: [2,3,4,5,Phoenix] → auto 6 (can't go below 2)
- Straight with Mahjong: [Mahjong,2,3,4,Phoenix] → auto 5 (Phoenix can't be Mahjong)
- Phoenix would form four-of-a-kind: [K,K,K,Phoenix] as bomb → invalid
- Phoenix in straight flush: all same suit + Phoenix → invalid (would be bomb)
- Pair sequence: [3,3,4,4,5,Phoenix] → auto 5
- Invalid combinations: Phoenix + Dragon, Phoenix + Dog

## Verification

1. All tests pass with 100% coverage on phoenix-resolver.ts
2. Build succeeds
3. Integration with combination-detector: `detectCombination` + `resolvePhoenixValues` agree
