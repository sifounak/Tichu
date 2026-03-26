# Implementation Plan — Expert Bot Strategy Rewrite

**Date:** 2026-03-25
**Spec:** `specifications/2026-03-25-expert-bot-strategy-rewrite.md`
**Branch:** `feature/expert-bot-strategy-rewrite`

## Files to Modify

| File | Role |
|---|---|
| `code/packages/server/src/bot/expert-bot.ts` | Main bot class — all decision methods |
| `code/packages/server/src/bot/bot-strategy-utils.ts` | Shared utilities — new index computations, passing, endgame |
| `code/packages/server/src/bot/card-tracker.ts` | Point tracking, bomb probability |
| `code/packages/server/src/bot/__tests__/expert-bot.test.ts` | ExpertBot tests |
| `code/packages/server/src/bot/__tests__/bot-strategy-utils.test.ts` | Utility tests |
| `code/packages/server/src/bot/__tests__/card-tracker.test.ts` | Tracker tests |

## Existing Functions to Reuse

- `countTopCards()` — bot-strategy-utils.ts:36
- `countLeadGetters()` — bot-strategy-utils.ts:57
- `evaluateHandStrength()` — bot-strategy-utils.ts:75
- `findBombs()` — bot-strategy-utils.ts:108 (extend for straight-flush)
- `findSingletons()` — bot-strategy-utils.ts:140
- `getCardStrength()` — bot-strategy-utils.ts:173
- `sortByStrength()` — bot-strategy-utils.ts:186
- `rankCombinationsForLead()` — bot-strategy-utils.ts:194
- `rankCombinationsForFollow()` — bot-strategy-utils.ts:216
- `isPartnerWinning()` — bot-strategy-utils.ts:314
- `canGoOut()` — bot-strategy-utils.ts:323
- `getOpponentTichuCallers()` — bot-strategy-utils.ts:480
- `getHandSizes()` — bot-strategy-utils.ts:495
- `isEndgame()` — bot-strategy-utils.ts:507
- `selectDragonRecipient()` — bot-strategy-utils.ts:542
- `CardTracker` — card-tracker.ts (extend with point tracking)
- `detectCombination()` — shared package (for straight-flush detection)

## Milestones

### M1: Grand Tichu & Regular Tichu Calling (REQ-F-GT01, GT02, RT01, RT02)

**New utility functions in bot-strategy-utils.ts:**
- `computeGrandTichuIndex(hand8: GameCard[]): number` — computes Ig
- `computeTichuIndex(hand14: GameCard[]): number` — computes It (needs straight detection + singleton counting)

**Modify expert-bot.ts:**
- `chooseGrandTichu()` — replace heuristic with Ig + score-adaptive thresholds
- `chooseRegularTichu()` — replace heuristic with It + score-adaptive thresholds

**Tests:** Verify Ig/It computation, verify threshold behavior at each score range.

### M2: Card Passing with Parity Convention (REQ-F-PASS01-05)

**Modify expert-bot.ts:**
- `chooseCardsToPass()` — implement strength concentration + parity convention
- Add `passedToLeft: GameCard | null` instance field

**New utility in bot-strategy-utils.ts:**
- `applyParityConvention(cards: GameCard[], leftOpp: Seat, rightOpp: Seat)` — assigns cards by odd/even rank

**Tests:** Verify parity assignment, strength concentration, anti-bomb, passedToLeft tracking.

### M3: Context-Dependent Dog Play (REQ-F-DOG01)

**Modify expert-bot.ts:**
- `chooseLeadPlay()` — replace simple Dog-early logic with 5-condition evaluation
- New private method: `shouldSaveDog(roundState, seat, hand): boolean`

**Tests:** Verify Dog saved when partner called Tichu, when holding bomb/Dragon, when opponent called Tichu. Verify Dog played early in default case.

### M4: Hand-Dependent Phoenix Strategy (REQ-F-PHX01)

**Modify expert-bot.ts:**
- Remove static `phoenixRole` from HandPlan
- New private method: `evaluatePhoenixPlay(hand, validPlays, cardTracker): 'singleton-killer' | 'wild' | 'save'`
- Integrate into `chooseFollowPlay()` and `chooseLeadPlay()`

**Tests:** Verify Phoenix used as wild when it completes critical combo, as singleton-killer vs Ace, saved on lead.

### M5: Bomb Strategy — Offense + Defense + Straight-Flush Detection (REQ-F-BOMB01-03)

**Modify bot-strategy-utils.ts:**
- `findBombs()` — add straight-flush detection (group by suit, find consecutive runs of 5+)

**Modify expert-bot.ts:**
- `shouldBombNow()` — add 1-2 prevention bombing, don't bomb when partner near exit
- New private method: `planBombProofExit(hand, cardTracker): Combination[]` — orders exit plays to avoid Dragon-as-second-to-last
- Integrate bomb-proof planning into `chooseLeadPlay()` when hand size <= 4

**Tests:** Verify straight-flush detection, bomb-proof exit ordering, 1-2 prevention bombing.

### M6: Context-Adaptive Mah Jong Wish (REQ-F-MJ01)

**Modify expert-bot.ts:**
- `chooseMahjongWish()` — use passedToLeft, check if Mah Jong in straight, context-adaptive

**Tests:** Verify wish-what-you-passed, no-wish-in-straight, Ace-wish vs Tichu callers.

### M7: Endgame Strategy (REQ-F-END01-04)

**New utility in bot-strategy-utils.ts:**
- `getEndgamePhase(roundState, seat): 'normal' | '3p-partner-out' | '3p-partner-in' | '2p'`
- `choose2PlayerPlay(hand, validPlays, opponentCardCount): Combination`

**Modify expert-bot.ts:**
- `choosePlay()` — detect endgame and delegate to endgame-specific logic
- New methods: `choose3PlayerPartnerOutPlay()`, `choose3PlayerPartnerInPlay()`, `choose2PlayerPlay()`

**Tests:** Verify aggressive play when partner out, situational when partner in, multi-card-first when opponent has 1 card.

### M8: Risk-Based Tichu Defense (REQ-F-DEF01)

**Modify expert-bot.ts:**
- New private method: `evaluateTichuDefense(roundState, seat, cardTracker): 'fight' | 'concede'`
- Integrate into `chooseFollowPlay()` — when conceding, pass more freely

**Tests:** Verify fight/concede decision based on card counts, power card tracking, partner behavior.

### M9: Card Tracker Enhancements (REQ-F-TRK01, TRK02)

**Modify card-tracker.ts:**
- Add rough point tracking: track 5s, 10s, Ks, Dragon, Phoenix points per team
- New methods: `getApproxTeamPoints(team): number`

**Modify expert-bot.ts:**
- `chooseDragonGiftRecipient()` — use point tracking to maximize damage

**Tests:** Verify point tracking accuracy, Dragon gift goes to lower-scoring team.

### M10: Enhanced Follow Play (REQ-F-FOL01-03)

**Modify expert-bot.ts:**
- `chooseFollowPlay()` — add King safety (lead Kings when all Aces played)
- `chooseFollowPlay()` — enhance pass logic (pass King on low trick when Aces unaccounted)
- `chooseLeadPlay()` — enforce split Aces (never lead Ace pair)

**Tests:** Verify King confidence after Aces gone, pass-King-on-low-trick, Ace splitting.

## Testing Strategy

Each milestone: write unit tests first for new utility functions, then integration tests for ExpertBot methods. Run existing test suite to verify backward compatibility (REQ-NF-COMPAT01).

## Verification

After all milestones:
1. Run full test suite: `npx vitest run` from `code/packages/server/`
2. Check coverage: `npx vitest run --coverage`
3. Manual play testing against bot
4. Verify call rates in automated 4-bot game simulations
