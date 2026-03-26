# Expert Bot Strategy Rewrite — Specification

**Date:** 2026-03-25
**Goal Type:** Feature Enhancement
**Confidence:** High — all requirements elicited through 4-source strategy research + user Q&A

## Goal

Rewrite the ExpertBot to implement a comprehensive, research-backed Tichu strategy covering all game phases: Grand Tichu calling, Regular Tichu calling, card passing, play strategy (lead/follow), Dog management, Phoenix management, bomb timing & bomb-proofing, Mah Jong wishes, endgame play, Tichu defense, and card tracking integration. The result should be a significantly stronger bot than the current heuristic-based ExpertBot.

**Why:** The current ExpertBot has decent heuristics but lacks critical strategy elements identified through Stanford CS229 research (Eric Yang 2018), Aaron Fuegi's strategy guide, and Board Game Arena community tips. Key gaps include: no Stanford-formula-based calling, no parity passing convention, static Dog/Phoenix play, no bomb-proof exit planning, no context-adaptive Mah Jong wishes, no endgame-specific logic, and no risk-based Tichu defense.

## Scope

**In scope:**
- All ExpertBot decision methods (Grand Tichu, Regular Tichu, card passing, play, Dragon gift, Mah Jong wish)
- New utility functions (Tichu index computation, parity passing, bomb-proof exit planning, endgame logic)
- CardTracker enhancements (rough point tracking, bomb probability)
- Straight-flush bomb detection
- All associated unit tests

**Out of scope:**
- RegularBot and HardBot changes
- BotRunner timing changes
- Game engine / rule engine changes
- Client-side changes
- BotStrategy interface changes (existing interface is sufficient)
- New bot difficulty tiers

## Requirements

### Grand Tichu Calling

**REQ-F-GT01: Stanford Grand Tichu Index**
Compute the Grand Tichu index: `Ig = N_Ace + 3*N_dragon + 3*N_phoenix + 3*N_bomb` from the 8-card hand.
*Acceptance:* Function `computeGrandTichuIndex(hand8)` returns correct Ig for any 8-card hand.

**REQ-F-GT02: Score-Adaptive Grand Tichu Thresholds**
Call Grand Tichu based on score deficit using shifted Stanford thresholds:
- Ahead 200+: Ig >= 6 (Dragon+Phoenix only)
- Even/close: Ig >= 4 (Dragon+Ace, Phoenix+Ace, Dragon+Phoenix)
- Behind 200-300: Ig >= 3 (Dragon alone, Phoenix alone, 3 Aces)
- Behind 400+: Ig >= 2 (2 Aces, 1 Ace+bomb)
*Acceptance:* Unit tests verify correct call/no-call for each threshold at each score range.

### Regular Tichu Calling

**REQ-F-RT01: Stanford Tichu Index**
Compute the Tichu index: `It = 2*N_Ace - 2*N_dog + 6*N_dragon + 6*N_phoenix + 5*N_bomb + N_straight - N_small` from the 14-card hand. N_small = singleton cards below Queen not in any straight, pair, or triple.
*Acceptance:* Function `computeTichuIndex(hand14)` correctly counts all components including straights and unmatched singletons.

**REQ-F-RT02: Score-Adaptive Tichu Thresholds**
Call Regular Tichu based on score deficit:
- Ahead 200+: It >= 9
- Even/close: It >= 7 (Stanford 50% threshold)
- Behind 200+: It >= 5
*Acceptance:* Unit tests verify correct call/no-call for each threshold at each score range.

### Card Passing

**REQ-F-PASS01: Strength Concentration**
Evaluate hand strength. If weak hand (below Tichu-call threshold): pass best card to partner. If strong hand: pass 3rd-worst to partner.
*Acceptance:* Weak hands pass highest-value card to partner; strong hands pass 3rd-weakest.

**REQ-F-PASS02: Parity Convention for Opponents**
Pass low odd-ranked cards to left opponent, low even-ranked cards to right opponent. When both opponent cards are same parity: pass lowest even to right, or lowest odd to left.
*Acceptance:* Unit tests verify odd→left, even→right, and same-parity tiebreaking.

**REQ-F-PASS03: Anti-Bomb Check**
Never pass same rank to both opponents (existing, retained).
*Acceptance:* No test case produces same-rank passes to both opponents.

**REQ-F-PASS04: Special Card Rules**
Dragon/Phoenix: keep or pass to partner only. Dog: pass to partner if hand is strong, keep if weak. Mah Jong: keep by default.
*Acceptance:* Dragon/Phoenix never passed to opponents. Dog passed to partner only from strong hands.

**REQ-F-PASS05: Track Passed Card for Mah Jong Wish**
Store the card passed to the left-hand opponent for use in Mah Jong wish selection.
*Acceptance:* `passedToLeft` field populated after `chooseCardsToPass()`.

### Dog Play

**REQ-F-DOG01: Context-Dependent Dog Play**
Dog play decision based on context:
1. Partner called Tichu/Grand Tichu → SAVE (bail partner out later)
2. Bot has bomb or Dragon → SAVE (guaranteed lead recovery makes Dog more valuable later)
3. Opponent called Tichu/Grand Tichu → SAVE (use strategically)
4. Default (no calls, no bomb/Dragon) → Play at first lead opportunity
5. Significantly behind on score → SAVE for critical moment
*Acceptance:* Unit tests verify each of the 5 conditions triggers correct save/play behavior.

### Phoenix Strategy

**REQ-F-PHX01: Hand-Dependent Phoenix Evaluation**
Evaluate Phoenix usage per turn (not static role assignment):
1. Completes critical combination (straight, full house) eliminating multiple losers → wild
2. Unaccounted opponent Aces (card tracker) → save as singleton-killer
3. Lead play with Phoenix as singleton → save (only +0.5, weak lead)
4. Following on opponent's Ace → play as singleton-killer
5. No good combination AND opponent Ace expected → singleton-killer
6. Otherwise → wild for combinations
*Acceptance:* Unit tests verify Phoenix decision in each of the 6 scenarios.

### Bomb Strategy

**REQ-F-BOMB01: Enhanced Offensive Bomb Timing**
Enhance existing bomb timing:
- Bomb when opponent is about to complete 1-2 finish
- Prefer bombing opponent's LAST winning play
- Don't bomb if own partner is about to go out
*Acceptance:* Bombs target 1-2 prevention scenarios; bombs suppressed when partner is near exit.

**REQ-F-BOMB02: Bomb-Proof Exit Planning**
Plan exits to survive opponent bombs:
- Never lead Dragon as second-to-last card if any rank has 3+ unaccounted
- Prefer lead-low-then-go-out over lead-Dragon-then-go-out
- Dragon+low-single last 2: lead low, play Dragon on opponent singleton
- Use `cardTracker.getAbsentRanks()` to assess bomb probability
*Acceptance:* Exit plan avoids Dragon-as-second-to-last when bomb risk exists.

**REQ-F-BOMB03: Straight-Flush Bomb Detection**
Detect straight-flush bombs (5+ consecutive same-suit cards) in addition to existing four-of-a-kind detection.
*Acceptance:* `findBombs()` returns straight-flush bombs when present in hand.

### Mah Jong Wish

**REQ-F-MJ01: Context-Adaptive Mah Jong Wish**
When playing Mah Jong as singleton:
- Opponent called Tichu/Grand Tichu → wish for Ace (force out power card)
- Default → wish for card passed to left opponent (REQ-F-PASS05)
- Fallback → wish for rank not in hand, preferring 5 or 6
When playing Mah Jong in a straight: no wish.
*Acceptance:* Wish matches context; no wish when Mah Jong is in a straight.

### Endgame Strategy

**REQ-F-END01: 3-Player Endgame (Partner Out)**
When partner already went out: play aggressively to go out 2nd and prevent opponent 1-2. Lead winners, break up combinations if needed.
*Acceptance:* Bot leads winners and plays aggressively when partner is out and 3 players remain.

**REQ-F-END02: 3-Player Endgame (Partner Not Out)**
Situational: compare card counts. Partner has fewer cards → feed leads. Bot has fewer → go out. Equal → whoever has more winners.
*Acceptance:* Bot correctly evaluates and acts based on relative card counts.

**REQ-F-END03: 2-Player Endgame (Opponent Has 1 Card)**
Play all multi-card groups first, then singles highest to lowest.
*Acceptance:* Multi-card groups played before singles; singles ordered high→low.

**REQ-F-END04: 2-Player Endgame (Opponent Has Many Cards)**
Lead low, win high (normal strategy applies).
*Acceptance:* Standard lead-low-win-high strategy maintained in 2-player endgame.

### Tichu Defense

**REQ-F-DEF01: Risk-Based Tichu Defense**
Evaluate whether to fight opponent's Tichu call based on:
1. Caller's remaining card count
2. Unaccounted power cards (card tracker)
3. Own hand winner count
4. Partner's apparent strategy (fighting or conceding based on their plays)
Fight when odds favor it; concede when they don't.
*Acceptance:* Bot fights Tichu calls with good odds, concedes with bad odds, coordinates with partner.

### Card Tracker Enhancements

**REQ-F-TRK01: Rough Point Tracking**
Track approximate card points per team: 5s=5pts, 10s/Ks=10pts, Dragon=25pts, Phoenix=-25pts.
*Acceptance:* `getApproxTeamPoints()` returns reasonable approximation after several tricks.

**REQ-F-TRK02: Enhanced Dragon Gift Decision**
Give Dragon trick to opponent whose team has fewer points in pile (maximize damage).
*Acceptance:* Dragon given to opponent on lower-scoring team when point data available.

### Enhanced Follow Play

**REQ-F-FOL01: King Safety Using Card Tracker**
When all 4 Aces played, treat Kings as top singles — lead and play them more confidently.
*Acceptance:* Bot leads Kings when card tracker confirms all Aces played.

**REQ-F-FOL02: Smart Pass on Low Tricks**
Pass when cheapest win costs King and Aces still unaccounted (enhance existing Ace/Dragon pass logic).
*Acceptance:* Bot passes rather than spending King on low trick when Aces remain.

**REQ-F-FOL03: Split Aces**
Never lead Ace pairs. Each Ace should win a separate lead.
*Acceptance:* Bot never leads pair of Aces when individual Ace leads are available.

### Non-Functional Requirements

**REQ-NF-PERF01: Decision Speed**
All bot decisions must complete within 50ms (existing timing unchanged).
*Acceptance:* No decision method exceeds 50ms in testing.

**REQ-NF-MAINT01: Code Organization**
Maintain existing file structure. New utilities go in `bot-strategy-utils.ts`. Keep ExpertBot as single class.
*Acceptance:* No new files created; existing file boundaries respected.

**REQ-NF-TEST01: Test Coverage**
80%+ statement coverage for all new/modified code.
*Acceptance:* Coverage report shows >=80% for bot files.

**REQ-NF-COMPAT01: Backward Compatibility**
BotStrategy interface unchanged. RegularBot and HardBot unaffected. BotRunner integration unchanged.
*Acceptance:* Existing RegularBot and HardBot tests continue passing.

## Assumptions

1. The game engine correctly computes `validPlays` — the bot trusts this list
2. `roundState` provides accurate public information (hand sizes, trick history, calls)
3. Card tracker has access to all completed tricks via `roundState.players[seat].tricksWon`
4. Score diff is set externally via `setScoreDiff()` before each round
5. The bot plays against a mix of skill levels (not exclusively against perfect opponents)

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Stanford formulas trained on average players, not strong | Medium | Medium | Shift thresholds upward from Stanford baseline; score-adaptive |
| Tichu index N_small/N_straight computation too slow | Low | Low | Pre-compute during hand plan creation |
| Bomb-proof exit planning conflicts with hand plan | Medium | Medium | Override hand plan when exit sequence matters (last 3-4 cards) |
| Context-dependent Dog play too conservative (never plays Dog) | Medium | High | Default to "play early" when no special conditions; unit test all branches |
| Straight-flush detection is computationally expensive | Low | Low | Only enumerate within each suit; max 14 cards per suit |

## Success Metrics

1. **Grand Tichu call rate:** 15-20% of hands (realistic for strong play)
2. **Grand Tichu success rate:** 65-75% when called
3. **Regular Tichu call rate:** 40-60% of hands
4. **Regular Tichu success rate:** 60-70% when called
5. **All existing tests pass** (RegularBot, HardBot, BotRunner)
6. **80%+ coverage** on new/modified code
7. **Qualitative:** Bot plays noticeably stronger in manual testing (leads low, saves winners, times bombs well, supports partner)
