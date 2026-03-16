# Specification: Hard & Expert Bot Implementation + Bug Fixes

**Version:** 1.0
**Date:** 2026-03-16
**Status:** Draft
**Confidence:** High — All requirements are concrete and testable; strategy logic is well-sourced from three expert guides with conflicts resolved; the BotStrategy interface is stable; Hard vs Expert capability boundaries are clearly delineated.

## 1. Goal

Implement two new bot difficulty levels — **HardBot** (strong intermediate) and **ExpertBot** (near-expert) — for the Tichu card game, informed by expert strategy guides. Refactor the bot architecture so all three tiers (Regular, Hard, Expert) compose from shared strategy utilities. Additionally, fix three known bugs: round-ending edge cases, Dog animation timing, and Phoenix singleton display values.

### Strategy Sources

- [Spotlight on Games — Tichu Strategy](https://spotlightongames.com/analysis/tichu.html)
- [Aaron Fuegi's Tichu Strategy Guide](http://scv.bu.edu/~aarondf/Games/Tichu/tichu_strategy.html)
- [Steve's HFoG Blog — Tichu Part 2: Strategy](http://hfog.blogspot.com/2006/04/tichu-part-2-strategy.html)

## 2. Context & Background

### Current State

- **RegularBot** (`regular-bot.ts`): plays randomly from valid moves. Never calls Tichu, passes random cards, picks random valid plays (30% pass chance), random Dragon gift, no Mahjong wish.
- **BotStrategy interface** (`bot-interface.ts`): 6 methods — `chooseGrandTichu`, `chooseRegularTichu`, `chooseCardsToPass`, `choosePlay`, `chooseDragonGiftRecipient`, `chooseMahjongWish`.
- **BotRunner** (`bot-runner.ts`): orchestrates bot decisions with artificial thinking delays (800-1500ms for mixed games, 50-150ms for bot-only).
- **Difficulty tiers**: currently `'regular' | 'hard'` — only `regular` is implemented.
- **Bots have full RoundState access** including opponent hands, but the new bots must NOT use opponent hand data.

### Known Bugs

1. Edge cases where the game gets stuck at the end of a round (cause unknown — needs investigation).
2. Dog animation timing is incorrect — too long overall and sequencing is wrong.
3. Phoenix singleton display always shows "1.5" instead of the contextual value based on the card being beaten.

## 3. Requirements

### 3.1 Functional Requirements — Bug Fixes

| ID | Requirement | Priority | Acceptance Criteria |
|----|------------|----------|-------------------|
| REQ-F-BUG01 | Audit and fix round-ending edge cases where the game gets stuck | Must | No game state gets stuck during round transitions; all round-ending paths tested |
| REQ-F-BUG02 | Fix Dog animation timing: play to area normally → block all plays → wait 1s → sweep toward receiving player over 1s → allow play to commence | Must | Dog animation completes in exactly 2s total; plays are blocked during animation; sequencing matches the specified rules |
| REQ-F-BUG03 | Fix Phoenix singleton display to show `{beaten card rank} + 0.5` with named face cards; verify server/client consistency | Must | Phoenix on top of 8 shows "8.5"; on top of Jack shows "Jack + 0.5"; on top of Queen shows "Queen + 0.5"; on top of King shows "King + 0.5"; on top of Ace shows "Ace + 0.5"; as lead or on Mahjong shows "1.5"; server game logic matches displayed value |

### 3.2 Functional Requirements — Information Model

| ID | Requirement | Priority | Acceptance Criteria |
|----|------------|----------|-------------------|
| REQ-F-INFO01 | Hard and Expert bots must only use human-available information: own hand, cards played/passed, hand sizes, Tichu calls, trick history, scores, finish order. No access to opponent hands. | Must | Bot methods never access `roundState.players[opponentSeat].hand`; verified by code inspection and test |
| REQ-F-INFO02 | Expert bot tracks the "top 10" cards (4 Aces, 4 Kings, Dragon, Phoenix) plus flags absent ranks as potential bombs | Must | Card tracker correctly identifies which top-10 cards are still in play and which ranks have not appeared; unit tested through a full round |

### 3.3 Functional Requirements — Tichu Calls

| ID | Requirement | Priority | Acceptance Criteria |
|----|------------|----------|-------------------|
| REQ-F-CALL01 | Evaluate hand strength for Grand Tichu decisions (first 8 cards). Hard bot uses heuristic thresholds (e.g., count of "top 8" cards: Phoenix, Dragon, 4 Aces, Mahjong, Dog). Expert bot uses refined evaluation with Dragon+Phoenix = almost always call. | Must | Grand Tichu called with Dragon+Phoenix in first 8; never called with 0-1 top cards; tested with known hands |
| REQ-F-CALL02 | Evaluate hand strength for Regular Tichu decisions (full 14 cards). Both use "lead getter" counting and hand quality assessment. Expert bot also considers current score. | Must | Tichu called when hand has more winners than losers; Expert bot suppresses call when comfortably ahead; tested with known hands |

### 3.4 Functional Requirements — Card Passing

| ID | Requirement | Priority | Acceptance Criteria |
|----|------------|----------|-------------------|
| REQ-F-PASS01 | Pass strategically: low unmatched singletons to opponents, best spare card to partner | Must | Strong hand keeps power, weak hand sends best to partner; tested for both scenarios |
| REQ-F-PASS02 | Dog passing is strategic: pass to opponent who called Grand Tichu; pass to partner when partner has the stronger hand. Dragon and Phoenix stay on the team. | Must | Dog passed to opponent when they called Grand Tichu; Dog passed to partner when own hand is weak; Dragon/Phoenix never passed to opponents; tested |
| REQ-F-PASS03 | Adjust passing based on hand strength: weak hand sends best card to partner; strong hand keeps power | Must | Tested with known strong and weak hands |
| REQ-F-PASS04 | Expert bot uses passing conventions to avoid creating opponent bombs (e.g., split suits between opponents) | Should | Expert bot avoids passing two cards of the same rank to one opponent; tested |

### 3.5 Functional Requirements — Play Strategy

| ID | Requirement | Priority | Acceptance Criteria |
|----|------------|----------|-------------------|
| REQ-F-PLAY01 | "Lead low, win high": lead weakest combinations, preserve winners for later. Never lead a winner unless about to go out or holding nothing but winners. | Must | When leading, bot plays lowest-ranked valid combination; tested |
| REQ-F-PLAY02 | Special card handling: Dragon (hold until needed, play Aces first as singletons), Phoenix (Hard bot: best use at the moment; Expert bot: decide during hand planning — singleton-killer vs. wild — and stick with it), Dog (play early to support partner; save if holding bombs/Dragon for later rescue), Mahjong (wish strategically when singleton; no wish when part of straight) | Must | Each special card behavior verified with targeted unit tests |
| REQ-F-PLAY03 | Bomb timing: save bombs for critical moments — opponent about to go out, breaking Tichu calls. Don't waste bombs early. | Must | Bot does not play bomb when opponent has many cards remaining; plays bomb when opponent has 1-2 cards and is about to win; tested |
| REQ-F-PLAY04 | Partner support: don't overplay partner's winning tricks. Support partner's Tichu calls by sacrificing own hand quality if needed. Play as if partner is competent regardless of partner's actual bot type. | Must | Bot passes when partner is currently winning the trick (unless strategic reason to play); tested |
| REQ-F-PLAY05 | Endgame adaptation: change strategy when 3 or 2 players remain. Prevent opponent one-two. Hard bot plays normally and hopes for the best. Expert bot aggressively prevents one-two (breaks own combinations if needed). | Must | Expert bot plays differently when opponent teammate already went out; tested |
| REQ-F-PLAY06 | Hard bot introduces ~10-15% randomness (occasionally makes suboptimal plays). Expert bot always plays optimally. Random source is injectable for deterministic testing. | Must | With seeded random at 0.05 (< threshold), Hard bot makes suboptimal play; with seeded random at 0.5, it plays optimally; Expert bot always plays optimally regardless |
| REQ-F-PLAY07 | Hard bot evaluates on a per-trick basis. Expert bot performs full hand planning at round start (categorize cards into losers-to-lead, easy-discards, winners) and updates the plan as play progresses. | Must | Expert bot produces a hand plan; plan influences play order; tested |

### 3.6 Functional Requirements — Dragon Gift & Mahjong Wish

| ID | Requirement | Priority | Acceptance Criteria |
|----|------------|----------|-------------------|
| REQ-F-DRAG01 | Give Dragon trick to the opponent most likely to go out last (based on hand size and game state) | Must | Dragon given to opponent with most cards remaining; tested |
| REQ-F-WISH01 | When playing Mahjong as singleton, wish for a card that disrupts opponents (card just passed to them, or mid-rank that breaks straights). No wish when Mahjong is part of a straight. | Must | Mahjong in straight → null wish; Mahjong as singleton → non-null wish targeting a disruptive rank; tested |

### 3.7 Functional Requirements — Difficulty Tiers & Integration

| ID | Requirement | Priority | Acceptance Criteria |
|----|------------|----------|-------------------|
| REQ-F-TIER01 | Update difficulty type from `'regular' \| 'hard'` to `'regular' \| 'hard' \| 'expert'` across shared types (`game.ts`), protocol schema (`protocol.ts`), server bot system, and client UI lobby dropdown | Must | Type compiles; protocol validates `'expert'`; lobby shows three options; tested |
| REQ-F-TIER02 | `GameManager.registerBot()` instantiates the correct bot class (`RegularBot`, `HardBot`, `ExpertBot`) based on difficulty parameter | Must | Each difficulty value creates the correct class instance; tested |

### 3.8 Functional Requirements — Opponent Tichu Defense

| ID | Requirement | Priority | Acceptance Criteria |
|----|------------|----------|-------------------|
| REQ-F-DEF01 | Both Hard and Expert bots react to opponent Tichu/Grand Tichu calls: save bombs for the caller, prioritize preventing them from going out first | Must | When opponent has called Tichu, bot holds bombs and plays them when caller is about to go out; tested |

### 3.9 Non-Functional Requirements

| ID | Requirement | Category | Acceptance Criteria |
|----|------------|----------|-------------------|
| REQ-NF-PERF01 | Bot decision time must not exceed ~100ms (excluding artificial thinking delay) | Performance | Profiled decision methods complete in <100ms for typical hands |
| REQ-NF-MAINT01 | All three bots (Regular, Hard, Expert) compose from shared `bot-strategy-utils.ts`. Regular uses minimal strategy, Hard uses heuristic evaluation, Expert adds planning and advanced analysis. | Maintainability | Shared utility file exists; all three bots import from it; no duplicated strategy logic between Hard and Expert |
| REQ-NF-TEST01 | Both new bots must have unit tests covering all 6 BotStrategy methods and key strategy decisions. 80%+ statement coverage for new code. | Quality | Coverage report shows ≥80% on all new files |

### 3.10 Constraints

- Must implement the existing `BotStrategy` interface — no changes to the interface itself
- Must work within the existing `BotRunner` orchestration (timing, phase handling)
- TypeScript, part of the existing monorepo (`code/packages/server/src/bot/`)
- Client UI changes limited to adding `'expert'` option to the existing lobby dropdown

### 3.11 Assumptions

- The existing `getValidPlays()` engine correctly computes all valid moves (no bugs there) — **if wrong, would require engine fixes first**
- The `BotPlayContext.validPlays` array is sufficient for decision-making without re-computing combinations — **if wrong, bots may need direct access to combination detection**
- The artificial thinking delay (800-1500ms) provides enough wall-clock time for even Expert bot computations — **if wrong, may need to profile and optimize**

## 4. Scope

### 4.1 In Scope

- `HardBot` class implementation with strategic heuristics
- `ExpertBot` class implementation with hand planning and optimal play
- Shared `bot-strategy-utils.ts` utility module
- Refactoring `RegularBot` to compose from shared utilities
- Difficulty tier update (`regular | hard | expert`) across types, protocol, server, client
- Unit tests for all new code (80%+ coverage)
- Fix: round-ending edge cases (REQ-F-BUG01)
- Fix: Dog animation timing (REQ-F-BUG02)
- Fix: Phoenix singleton display value (REQ-F-BUG03)

### 4.2 Out of Scope

- Full-game simulation for win-rate benchmarking (deferred to later)
- Bot vs. bot tournament mode
- Machine learning or adaptive strategy
- Changes to the `BotStrategy` interface itself
- Spectator-visible bot "thinking" indicators

## 5. Edge Cases & Boundary Conditions

| ID | Scenario | Expected Behavior |
|----|---------|------------------|
| EC-001 | Bot has only bombs in hand (no low cards to lead) | Lead with the lowest bomb; recognized as "nothing but winners" |
| EC-002 | Both opponents called Tichu simultaneously | Prioritize defending against the opponent who acts next (closer in turn order) |
| EC-003 | Partner called Tichu but bot has a very strong hand | Support partner (don't counter-call); sacrifice own hand quality to help partner go out first |
| EC-004 | Bot holds Dog but partner already went out | Dog is unplayable (partner not in game); bot must plan around this dead card |
| EC-005 | Phoenix is the only card left in hand | Play it; accept -25 point penalty |
| EC-006 | Expert bot's hand plan becomes invalid mid-round (e.g., bomb played on a planned winner) | Re-evaluate and update the plan |
| EC-007 | Mahjong wish forces bot to play a card it was saving | Comply with wish (mandatory); adjust remaining strategy |
| EC-008 | All valid plays are equally ranked (no clear "best" move) | Hard bot picks randomly among equals; Expert bot uses tiebreaking heuristics (prefer plays that advance the hand plan) |
| EC-009 | Round ends with one team going out 1-2 | Scoring handles correctly; no stuck state |
| EC-010 | Dog played when partner has already gone out | Per Tichu rules, lead passes to the next active player (opponent); animation still follows 1s+1s timing |

## 6. Risks & Concerns

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|-----------|
| R-001 | Hand evaluation heuristic produces poor Tichu calls (too aggressive or too conservative) | Medium | High | Tune thresholds based on strategy guides' concrete examples; unit test edge cases; adjustable later |
| R-002 | Bot decision time exceeds thinking delay for complex Expert hands | Low | Medium | Profile Expert bot's hand planning; valid plays are pre-computed; keep combination enumeration bounded |
| R-003 | Shared utility refactor breaks existing RegularBot behavior | Medium | Medium | Regression tests — verify RegularBot still behaves randomly after refactoring onto shared utilities |
| R-004 | Strategy conflicts between sources lead to inconsistent bot behavior | Low | Low | Conflicts already resolved during spec elicitation; resolutions documented |
| R-005 | "Strong intermediate" vs "near-expert" boundary is subjective | Medium | Medium | Concrete capability matrix defines what each bot does/doesn't do; adjustable later |
| R-006 | Round-ending bug investigation may reveal deeper game engine issues | Medium | High | Time-box investigation; if root cause is deep, create separate follow-up spec |

## 7. Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| All three bots selectable and functional | RegularBot, HardBot, ExpertBot all playable from lobby | Manual verification |
| Statement coverage for new code | ≥ 80% | Coverage report from test runner |
| Bot decision time | < 100ms | Profiling in unit tests |
| No round-ending stuck states | 0 occurrences | Manual testing + regression tests |
| Dog animation timing | 2s total (1s pause + 1s sweep) | Manual verification + timing tests |
| Phoenix display correctness | Shows contextual value for all face cards and numbers | Unit tests + manual verification |
| Hard bot plays noticeably better than Regular bot | Qualitative assessment during play | Manual observation |
| Expert bot plays noticeably better than Hard bot | Qualitative assessment during play | Manual observation |

## 8. Open Questions

None — all questions resolved during elicitation.

## 9. Capability Matrix: Hard vs Expert

| Capability | RegularBot | HardBot | ExpertBot |
|-----------|-----------|---------|-----------|
| Tichu calls | Never | Heuristic thresholds | Refined eval + score-aware |
| Card passing | Random | Strategic (hand-strength-based) | Strategic + anti-bomb conventions |
| Play evaluation | Random from valid plays | Per-trick heuristic ("lead low, win high") | Full hand planning at round start |
| Special card usage | Random | Purposeful (strategy-guided) | Planned (decided during hand planning) |
| Bomb timing | Random | Save for critical moments | Save for critical moments |
| Partner support | None | Don't overplay partner | Don't overplay + sacrifice for partner Tichu |
| Opponent Tichu defense | None | React (save bombs, block) | React (save bombs, block) |
| Endgame adaptation | None | Basic (hope for the best) | Aggressive one-two prevention |
| Card counting | None | None | Top 10 + absent rank detection |
| Score awareness | None | None | Adjusts risk based on score |
| Randomness | 30% random pass | 10-15% suboptimal plays | Always optimal |
| Information model | Full state (legacy) | Human-available only | Human-available only |

## 10. Strategy Reference Summary

Key principles synthesized from the three strategy sources:

1. **Lead low, win high** — only lead winners when about to go out or holding nothing but winners
2. **Split Aces** — play as singletons for two separate leads rather than as a pair
3. **Hold Dragon** — play Aces before Dragon; give Dragon trick to opponent most likely to go out last
4. **Dog is valuable** — guaranteed unbombable lead transfer to partner; play early unless holding bombs/Dragon for partner rescue
5. **Phoenix is the best card** — decide early: singleton-killer vs. wild card for combinations
6. **Bombs are one lead** — don't waste early; save for Tichu-caller about to go out
7. **Mahjong wish** — don't wish when part of a straight; wish for card you passed to opponent when singleton
8. **Partner support** — don't overplay partner's winning tricks; sacrifice own hand for partner's Tichu
9. **Pass strategically** — low singletons to opponents; best spare to partner; Dog to opponents only when they called Grand Tichu
10. **Defend against Tichu** — save bombs for the caller; prioritize preventing their exit
