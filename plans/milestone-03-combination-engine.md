# Milestone 3: Combination Engine

**Package(s):** shared
**Requirements:** Core game logic for detecting and comparing card combinations

## Goal

Implement the combination detector (what combination does a set of cards form?) and the combination validator (can this combination beat the current trick?). This is the heart of the game engine.

## Tasks

### 3.1 Combination detector (`packages/shared/src/engine/combination-detector.ts`)
- `detectCombination(cards: GameCard[]): Combination | null`
- Detect all combination types:
  - **Single**: 1 card (any standard, Dragon, Phoenix, Mahjong; NOT Dog alone as a "combination" to beat)
  - **Pair**: 2 cards same rank (Phoenix can substitute)
  - **Triple**: 3 cards same rank (Phoenix can substitute)
  - **Full House**: 3+2 same rank (Phoenix can substitute, but never forms bomb)
  - **Straight**: 5+ consecutive ranks (Phoenix can fill one gap; Mahjong counts as rank 1)
  - **Pair Sequence**: 2+ consecutive pairs (Phoenix can complete one pair)
  - **Four-of-a-kind Bomb**: 4 cards same rank (Phoenix NEVER included)
  - **Straight Flush Bomb**: 5+ consecutive same suit (Phoenix NEVER included)
- Handle special cards:
  - Dog: only valid as a standalone lead (not a combination to beat others)
  - Dragon: only valid as Single
  - Phoenix: wild in non-bomb combinations, rank determined by context
  - Mahjong: rank 1 in straights, valid as single

### 3.2 Combination validator (`packages/shared/src/engine/combination-validator.ts`)
- `canBeat(play: Combination, currentTop: Combination | null): boolean`
- Rules:
  - Same type + same length + higher rank beats
  - Bombs beat everything (higher bomb beats lower bomb)
  - Four-bomb rank ordering: by rank
  - Straight-flush bomb ordering: by length, then rank
  - Straight-flush beats four-of-a-kind
  - Dog and Mahjong lead-only special rules

### 3.3 Combination utilities
- `getRankOrder(combination: Combination): number` — for comparison
- `isBomb(combination: Combination): boolean`
- `getAllValidPlays(hand: GameCard[], currentTrick: Combination | null): Combination[]`

## Tests

- **Singles**: all standard cards, Dragon (highest), Phoenix (+0.5), Mahjong (rank 1)
- **Pairs**: standard pairs, Phoenix + standard, Phoenix + Mahjong (invalid — Phoenix can't be Mahjong)
- **Triples**: standard, with Phoenix
- **Full Houses**: standard, Phoenix completing pair, Phoenix completing triple, 2+2+Phoenix (ambiguous)
- **Straights**: 5-card, 6+ card, with Mahjong, with Phoenix filling gap, with Phoenix extending, Phoenix at low end but can't go below 2
- **Pair Sequences**: 2-pair, 3-pair, with Phoenix
- **Bombs**: four-of-a-kind (no Phoenix), straight flush (no Phoenix)
- **Invalid**: Phoenix forming a bomb, Dragon in multi-card, Dog in multi-card
- **Comparison**: same type higher wins, bombs beat non-bombs, bomb ranking

## Verification

1. `pnpm turbo test --filter=@tichu/shared` — all tests pass
2. 100% statement coverage on combination-detector.ts and combination-validator.ts
3. Build succeeds
