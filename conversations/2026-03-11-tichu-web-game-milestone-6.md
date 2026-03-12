# Milestone 6: Scoring + Rules — Conversation Transcript

**Date:** 2026-03-11
**Branch:** feature/tichu-web-game
**Status:** Complete

## Summary

Implemented three new engine modules for the Tichu shared package:

### scoring.ts
- `getCardsPoints()` — sum card point values for a collection
- `getTrickPoints()` — sum points across multiple tricks
- `scoreRound()` — complete round scoring with:
  - Standard card point distribution per team
  - 1-2 finish bonus (200 pts when both partners finish 1st+2nd)
  - Last player redistribution (tricks to first-out, hand points to opponents)
  - Tichu (+100/-100) and Grand Tichu (+200/-200) bonuses/penalties
- `checkGameOver()` — target score check with tie handling

### wish.ts
- `isWishFulfilled()` — checks if a play contains the wished rank as a real card (not Phoenix)
- `canFulfillWish()` — checks if player has wished rank AND can play it in a valid beating combination
- `mustFulfillWish()` — equivalent to canFulfillWish (in Tichu, can = must for wishes)

### rules.ts
- `validatePlay()` — full validation chain: detect → canBeat → wish enforcement
- `getValidPlays()` — all valid plays respecting trick and wish constraints
- `canPlayerPass()` — pass logic: can't pass when leading or when wish fulfillable

## Key Decisions

1. **Wish enforcement architecture**: The wish module uses `getAllValidPlays` from combination-utils to determine if any valid play contains the wished rank. This ensures correctness — a player must fulfill the wish only if they can play a valid combination containing that rank that also beats the current trick.

2. **Phoenix cannot fulfill wish**: `isWishFulfilled` explicitly checks for `isStandard(gc.card)`, ensuring Phoenix substituting for the wished rank does NOT count as fulfilling the wish. The real card must be played.

3. **1-2 finish scoring**: When both partners finish 1st and 2nd, their team gets a flat 200 points (not the sum of card points). Opponents get 0.

4. **Last player redistribution**: Last player's won tricks go to the first-out player. Last player's remaining hand points go to the opposing team. This can result in negative points if Phoenix is in the hand.

5. **Tie handling in checkGameOver**: If both teams reach the target score in the same round, the higher score wins. If tied at/above target, play continues (return null).

## Test Results

- **367 total tests** (72 new for M6), all passing
- **Coverage**: scoring.ts 100%, wish.ts 100%, rules.ts 100% statements
- **Overall**: 95.11% statements, 89.97% branch, 100% functions

## Requirements Addressed

| Requirement | Status |
|---|---|
| REQ-F-SC01 (Standard scoring) | Passed |
| REQ-F-SC02 (1-2 finish bonus) | Passed |
| REQ-F-SC03 (Last player redistribution) | Passed |
| REQ-F-GF04 (Wish enforcement) | Passed |
| REQ-F-GF08 (Tichu +100/-100) | In Progress (scoring done, M7 state machine pending) |
| REQ-F-GF09 (Grand Tichu +200/-200) | In Progress (scoring done, M7 state machine pending) |
| REQ-F-GF10 (Customizable target score) | Passed |
