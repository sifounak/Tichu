# Milestone 5: Hand Filter (Progressive Card Selection)

**Package(s):** shared
**Requirements:** Progressive filtering for card selection UX

## Goal

Implement the hand filtering algorithm that determines which cards remain selectable as the player builds a combination. Runs on both client (instant UI feedback) and server (authoritative validation).

## Tasks

### 5.1 Hand filter (`packages/shared/src/engine/hand-filter.ts`)

- `getSelectableCards(hand: GameCard[], selected: GameCard[], currentTrick: TrickState | null, wish: number | null): Set<CardId>`

### 5.2 Filtering logic

**Phase 1 — No selection (empty):**
- All cards selectable
- Exception: Dog only selectable if leading (no current trick)

**Phase 2 — Cards selected:**
- For each remaining card C in hand:
  - candidates = selected + [C]
  - If `canFormValidCombination(candidates, currentTrick)` → selectable
  - Else if `canFormValidPrefix(candidates, currentTrick)` → selectable
  - Else → greyed out

**Special rules (always enforced):**
- Dragon selected → all others disabled (solo-only)
- Dog selected → all others disabled (solo-only)
- Dog disabled when trick is active (can only lead)
- Phoenix disabled if adding it would form a bomb
- If wish is active and player holds wished rank, enforce wish compliance

### 5.3 Prefix matching (`canFormValidPrefix`)

Checks if the current selection could be a subset of a valid final play:
- All same rank (or Phoenix): could be pair/triple → true
- Ranks consecutive (with ≤1 gap fillable by Phoenix): could be straight → true
- 2 distinct ranks, counts compatible with full house → true
- All same suit + consecutive: could be straight flush → true
- All pairs + consecutive: could be pair sequence → true
- Filter by trick constraint (if trick has pair, prefix must be compatible with pair, unless bomb)

### 5.4 Full validation (`canFormValidCombination`)

- Detect combination type via combination-detector
- If on a trick, verify it beats the current top via combination-validator
- Verify special card rules
- Verify wish compliance

## Tests

- Empty selection: all cards enabled (except Dog when trick active)
- Select Dragon: all others disabled
- Select Dog: all others disabled
- Select a 5: cards that can form pairs, triples, straights with 5 stay enabled
- Select 5+6: cards forming straights (4,7,8... or 3,4,7...) stay enabled; unrelated cards grey out
- Select 5+5: cards that can form triple (another 5), full house, pair sequence stay enabled
- Phoenix + 3 Kings: Phoenix disabled (would form bomb)
- Wish active with wished rank in hand: non-wish plays filtered if wish is fulfillable
- Trick constraint: current trick is pair → only pair-compatible selections enabled (plus bombs)
- Dog filtering: Dog enabled when leading, disabled when trick active

## Verification

1. All tests pass with 100% coverage on hand-filter.ts
2. Build succeeds
3. Performance: filtering a 14-card hand completes in < 1ms
