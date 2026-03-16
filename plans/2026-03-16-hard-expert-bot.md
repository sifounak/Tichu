# Implementation Plan: Hard & Expert Bot + 3 Bug Fixes

**Spec:** `specifications/2026-03-16-hard-expert-bot.md`
**Branch:** `feature/hard-bot`

## Context

The Tichu card game has only a RegularBot (random plays). This plan adds HardBot (heuristic strategy) and ExpertBot (hand planning + card tracking + optimal play), plus fixes three known bugs. The spec is committed; this plan covers implementation across 5 milestones.

---

## Milestone 1: Bug Fixes

**Requirements:** REQ-F-BUG01, REQ-F-BUG02, REQ-F-BUG03

### BUG01 — Round-ending edge cases (game gets stuck)

**Root cause investigation areas** in `game-state-machine.ts`:
- `isTrickComplete()` (L176-190): When trick winner goes out mid-trick, active player set changes. If winner is the only "non-pass" player, `nonWinnerActive.every(passes)` could be vacuously true or wrong.
- `completeTrickAndAdvance()` (L907-948): Dragon gift pending + round should end simultaneously — the `always` transitions (L861-870) check `needsDragonGift` before `isRoundComplete`, so Dragon gift state could prevent round scoring.
- `getNextActiveSeat()`: Could return a finished player if all are finished (loop of 4).
- Player finishing on their own winning trick: `removeCardsAndCheckFinish` marks them out, then `isTrickComplete` sees fewer active players — need to verify the trick-complete check still works.

**Files:**
- Modify: `code/packages/server/src/game/game-state-machine.ts`
- Create: `code/packages/server/tests/game/round-ending-edge-cases.test.ts`

### BUG02 — Dog animation timing

**Current:** 1s pause + 0.4s sweep = 1.4s anim, 2.4s block. **Spec:** 1s pause + 1s sweep = 2s anim, 2s block (no post-sweep pause needed since sweep IS 1s).

**Fixes:**
- `TrickDisplay.tsx` L163: Dog exit `duration` uses `durations.trickSweep` (0.4s) — change to a dedicated `1.0` literal or add a `dogSweep` duration
- `page.tsx` L92-94: Update timing constants to `(1.0 + 1.0)` for both dogAnimMs and dogBlockMs

**Files:**
- Modify: `code/packages/client/src/components/game/TrickDisplay.tsx` (L163)
- Modify: `code/packages/client/src/app/game/[gameId]/page.tsx` (L92-94)

### BUG03 — Phoenix singleton display value

**Problem:** `detectCombination()` always sets Phoenix single rank to `1.5` (PHOENIX_SINGLE_VALUE). When Phoenix beats a King, the client displays "(1.5)" instead of "(King + 0.5)".

**Fix:** In `game-state-machine.ts` `playCards` action, after `validatePlay()` succeeds, if the combination is a Phoenix single played onto a trick, update `combination.rank` to `currentTopRank + 0.5` and set `combination.phoenixUsedAs` to the effective rank. The `formatPhoenixValue()` in TrickDisplay.tsx already handles formatting correctly once the rank is right.

**Files:**
- Modify: `code/packages/server/src/game/game-state-machine.ts` (playCards action, after L560)
- Test: Verify in `round-ending-edge-cases.test.ts` or create dedicated test

---

## Milestone 2: Shared Strategy Utilities + Difficulty Tier Update

**Requirements:** REQ-NF-MAINT01, REQ-F-INFO01, REQ-F-TIER01, REQ-F-TIER02

### Strategy Utilities (`bot-strategy-utils.ts`)

Pure functions composing all bot strategies. Key function groups:

1. **Hand evaluation:**
   - `countTopCards(hand)` — count Dragon, Phoenix, Aces, Kings
   - `evaluateHandStrength(hand)` — score based on winners/losers/combo quality
   - `countLeadGetters(hand)` — Aces, Dragon, bombs, Dog
   - `categorizeHand(hand, validPlays)` — split into losers, discards, winners
   - `findBombs(hand)` — detect four-of-a-kind and straight flush bombs

2. **Card sorting/ranking:**
   - `getCardStrength(card)` — numeric strength
   - `sortByStrength(cards)` — ascending sort
   - `rankCombinationsByStrength(combos)` — strategic ordering

3. **Passing logic:**
   - `selectPassCards(hand, seat, strategy)` — strategic pass selection
   - `identifyWeakCards(hand)` — unmatched low singletons

4. **Play selection:**
   - `selectLeadPlay(validPlays, hand, options)` — lead-low logic
   - `selectFollowPlay(validPlays, context, options)` — follow-high logic
   - `shouldPlayBomb(context)` — bomb timing evaluation
   - `isPartnerWinning(trick, seat)` — partner winning check

5. **State analysis:**
   - `getOpponentTichuCallers(roundState, seat)` — find Tichu callers
   - `getHandSizes(roundState)` — card counts per seat
   - `isEndgame(roundState)` — 2 or fewer active players

### Tier Update

- `game.ts`: `botDifficulty: 'regular' | 'hard' | 'expert'`
- `protocol.ts`: `z.enum(['regular', 'hard', 'expert'])`
- `bot-interface.ts`: `difficulty: 'regular' | 'hard' | 'expert'`
- `game-manager.ts`: Add `case 'hard'` and `case 'expert'` to `registerBot()`
- `lobby/[roomId]/page.tsx`: Add 'expert' to dropdown

### RegularBot refactor

Minimal: import a few helpers from `bot-strategy-utils.ts` (e.g., `isPhoenix` already imported). Keep random behavior — regression test to verify.

**Files:**
- Create: `code/packages/server/src/bot/bot-strategy-utils.ts`
- Modify: `code/packages/server/src/bot/regular-bot.ts` (minor refactor)
- Modify: `code/packages/server/src/bot/bot-interface.ts` (difficulty type)
- Modify: `code/packages/server/src/bot/index.ts` (exports)
- Modify: `code/packages/shared/src/types/game.ts` (difficulty type)
- Modify: `code/packages/shared/src/types/protocol.ts` (Zod schema)
- Modify: `code/packages/server/src/game/game-manager.ts` (factory)
- Modify: `code/packages/client/src/app/lobby/[roomId]/page.tsx` (dropdown)
- Create: `code/packages/server/tests/bot/bot-strategy-utils.test.ts`
- Create: `code/packages/server/tests/bot/regular-bot-regression.test.ts`

---

## Milestone 3: HardBot Implementation

**Requirements:** REQ-F-CALL01, REQ-F-CALL02, REQ-F-PASS01, REQ-F-PASS02, REQ-F-PASS03, REQ-F-PLAY01, REQ-F-PLAY02, REQ-F-PLAY03, REQ-F-PLAY04, REQ-F-PLAY06, REQ-F-DRAG01, REQ-F-WISH01, REQ-F-DEF01, REQ-F-INFO01

### Implementation

`HardBot` implements `BotStrategy` with `difficulty = 'hard'`. Constructor takes optional `randomSource: () => number` for deterministic testing.

| Method | Strategy |
|--------|----------|
| `chooseGrandTichu(hand8)` | Call if 4+ top-8 cards (Dragon, Phoenix, Aces, Mahjong, Dog). Dragon+Phoenix = always call. 0-1 = never. |
| `chooseRegularTichu(hand14)` | Call if `evaluateHandStrength()` exceeds threshold (winners > losers). |
| `chooseCardsToPass(hand, seat)` | Low unmatched singletons to opponents, best spare to partner. Never pass Dragon/Phoenix to opponents. Dog kept unless hand very weak. |
| `choosePlay(context)` | **Leading:** lowest combination. Never lead winner unless all-winners or going out. **Following:** pass if partner winning (unless can go out). Play lowest winning combo vs opponent. **Special cards:** Dragon held (play Aces first), Phoenix as singleton-killer, Dog early when leading, strategic Mahjong wish. **Bombs:** save for opponent Tichu / about to go out. **Randomness:** 10-15% random plays via `randomSource`. |
| `chooseDragonGiftRecipient` | Give to opponent with most cards (cache `roundState` from last `choosePlay`). |
| `chooseMahjongWish(hand)` | Wish for mid-rank (7-10) not in hand when played as singleton. Null when in straight. |

**Files:**
- Create: `code/packages/server/src/bot/hard-bot.ts`
- Modify: `code/packages/server/src/bot/index.ts`
- Create: `code/packages/server/tests/bot/hard-bot.test.ts`

### Key test cases
- Grand Tichu: Dragon+Phoenix in 8 = call; 0-1 top cards = never
- Leading: plays lowest combo from mixed hand
- Partner winning: passes
- Opponent Tichu + 1-2 cards: bombs
- Random seed 0.05 (<0.12): suboptimal play; seed 0.5: optimal

---

## Milestone 4: ExpertBot Implementation

**Requirements:** REQ-F-INFO02, REQ-F-CALL01, REQ-F-CALL02, REQ-F-PASS04, REQ-F-PLAY05, REQ-F-PLAY06, REQ-F-PLAY07, REQ-F-DEF01

### Architecture

ExpertBot implements `BotStrategy` independently (composition over inheritance). Shares utilities with HardBot via `bot-strategy-utils.ts`.

### Key additions over HardBot

| Feature | Implementation |
|---------|---------------|
| **Card tracker** (REQ-F-INFO02) | `CardTracker` class tracks top-10 cards (4 Aces, 4 Kings, Dragon, Phoenix) — which played, which unaccounted. Flags absent ranks as potential bombs. Updated each `choosePlay()` from trick history. |
| **Hand planning** (REQ-F-PLAY07) | On first play of round, categorize hand into losers-to-lead, discards, winners. Decide Phoenix role (singleton-killer vs wild). Re-evaluate after bombs invalidate planned winners. |
| **Score-aware Tichu** (REQ-F-CALL02) | Suppress call when team leads by 200+. More aggressive when behind. |
| **Anti-bomb passing** (REQ-F-PASS04) | Never pass two same-rank cards to one opponent. Split between opponents. |
| **One-two prevention** (REQ-F-PLAY05) | When opponent's teammate went out 1st, break own combos to prevent 2nd opponent from going out. Play highest to win tricks. |
| **Always optimal** (REQ-F-PLAY06) | No randomness. Every decision is the computed best. |

**Files:**
- Create: `code/packages/server/src/bot/expert-bot.ts`
- Create: `code/packages/server/src/bot/card-tracker.ts`
- Modify: `code/packages/server/src/bot/bot-strategy-utils.ts` (add hand planning functions if needed)
- Modify: `code/packages/server/src/bot/index.ts`
- Create: `code/packages/server/tests/bot/expert-bot.test.ts`
- Create: `code/packages/server/tests/bot/card-tracker.test.ts`

---

## Milestone 5: Integration Testing & Documentation

**Requirements:** REQ-NF-PERF01, REQ-NF-TEST01

### Scope

1. **End-to-end bot game test:** Run a full game with 4 bots of each difficulty. Verify no stuck states, correct scoring, round transitions.
2. **Performance validation:** Assert bot decision time < 100ms in unit tests.
3. **Coverage:** Verify 80%+ statement coverage on all new files.
4. **Documentation:** Update `documentation/codebase-index.md` with new bot files, architecture, and capability matrix.
5. **Final cleanup:** Verify all REQ traceability comments in code and tests.

**Files:**
- Create: `code/packages/server/tests/bot/bot-integration.test.ts`
- Modify: `documentation/codebase-index.md`
- Verify: All test files have `% Verifies: REQ-*` comments

---

## Milestone-Requirement Traceability

| Milestone | Requirements |
|-----------|-------------|
| M1 | REQ-F-BUG01, REQ-F-BUG02, REQ-F-BUG03 |
| M2 | REQ-NF-MAINT01, REQ-F-INFO01, REQ-F-TIER01, REQ-F-TIER02 |
| M3 | REQ-F-CALL01/02, REQ-F-PASS01/02/03, REQ-F-PLAY01-04/06, REQ-F-DRAG01, REQ-F-WISH01, REQ-F-DEF01, REQ-F-INFO01 |
| M4 | REQ-F-INFO02, REQ-F-CALL01/02, REQ-F-PASS04, REQ-F-PLAY05/06/07, REQ-F-DEF01 |
| M5 | REQ-NF-PERF01, REQ-NF-TEST01 |

## Verification

- **Unit tests:** Each milestone includes test files covering all new code
- **Integration test:** M5 runs full games with all bot types
- **Manual:** Play against HardBot and ExpertBot in browser to verify behavior
- **Coverage:** `vitest --coverage` on `code/packages/server/` — target 80%+ on new files

## Key Reusable Utilities (DO NOT rebuild)

| Utility | File |
|---------|------|
| `getValidPlays(hand, trick, wish)` | `shared/src/engine/rules.ts` |
| `canPlayerPass(hand, trick, wish)` | `shared/src/engine/rules.ts` |
| `detectCombination(cards)` | `shared/src/engine/combination-detector.ts` |
| `canBeat(play, top)` | `shared/src/engine/combination-validator.ts` |
| `getAllValidPlays(hand, top)` | `shared/src/engine/combination-utils.ts` |
| `getCardPoints(card)` | `shared/src/constants.ts` |
| `isPhoenix/isDragon/isDog/isMahjong` | `shared/src/types/card.ts` |
| `getCardRank(card)` | `shared/src/types/card.ts` |
| `getTeam(seat)`, `getPartner(seat)` | `shared/src/types/game.ts` |
| `RANK_ORDER`, `ALL_RANKS` | `shared/src/constants.ts` |
| `scoreRound()` | `shared/src/engine/scoring.ts` |
