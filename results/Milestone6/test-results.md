# Milestone 6: Scoring + Rules — Test Results

**Date:** 2026-03-11
**Status:** All Passing

## Summary

| Metric | Value |
|---|---|
| Total tests | 367 |
| Passing | 367 |
| Failing | 0 |
| New tests (M6) | 72 |
| Duration | 2.06s |

## New Test Files

### scoring.test.ts — 34 tests
- getCardsPoints: 11 tests (all card types, multi-card sums, full deck = 100)
- getTrickPoints: 2 tests (empty, multi-trick)
- scoreRound: 15 tests (standard, 1-2 finish, redistribution, Tichu/Grand Tichu bonuses)
- checkGameOver: 6 tests (not reached, exact, exceeded, both teams, tied, custom target)

### wish.test.ts — 16 tests
- isWishFulfilled: 6 tests (single, pair, straight, Phoenix, Dragon)
- canFulfillWish: 7 tests (has rank, no rank, beat trick, can't beat, pair, Phoenix)
- mustFulfillWish: 3 tests (equivalence, true, false)

### rules.test.ts — 22 tests
- validatePlay: 11 tests (valid lead, empty, invalid combo, can't beat, beats trick, Dog, wish enforcement, bomb)
- getValidPlays: 4 tests (leading, wish filter, unfulfillable wish, beat trick, wish+trick)
- canPlayerPass: 5 tests (leading, empty trick, following, wish fulfillable, wish unfulfillable, wish can't beat)

## Coverage

| File | Stmts | Branch | Funcs | Lines |
|---|---|---|---|---|
| scoring.ts | 100% | 91.17% | 100% | 100% |
| wish.ts | 100% | 100% | 100% | 100% |
| rules.ts | 100% | 96.77% | 100% | 100% |
| **Overall** | **95.11%** | **89.97%** | **100%** | **95.11%** |
