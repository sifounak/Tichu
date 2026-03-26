# Expert Bot Strategy Rewrite — Milestones 1-4

**Date:** 2026-03-25
**Branch:** feature/expert-bot-strategy-rewrite

## Completed Milestones

### M1: Grand Tichu & Regular Tichu Calling
- New: `computeGrandTichuIndex()` — Ig = N_Ace + 3*N_dragon + 3*N_phoenix + 3*N_bomb
- New: `computeTichuIndex()` — It = 2*N_Ace - 2*N_dog + 6*N_dragon + 6*N_phoenix + 5*N_bomb + N_straight - N_small
- New: `countStraights()`, `countSmallSingletons()` helper functions
- Score-adaptive thresholds for Grand Tichu (Ig: 2/3/4/6) and Regular Tichu (It: 5/7/9)
- Key learning: Non-consecutive pairs in test hands to avoid unintended straights
- Key fix: Phoenix gap-fill in countStraights needs runLength += 2 (not 1)

### M2: Card Passing with Parity Convention
- Strength concentration: weak hand → best to partner, strong hand → 3rd-worst
- Parity convention: odd → left (next seat clockwise), even → right
- Anti-bomb check retained
- Special cards: Dragon/Phoenix team-only, Dog to partner from strong hand
- `passedToLeft` field tracks card for Mah Jong wish
- Uses Stanford It >= 7 to determine strong vs weak hand

### M3: Context-Dependent Dog Play
- 5-condition evaluation via `shouldSaveDog()`:
  1. Partner called Tichu → save
  2. Bot has bomb/Dragon → save
  3. Opponent called Tichu → save
  4. Behind 200+ → save
  5. Default → play early
- Key fix: Dog check must run BEFORE hand plan loop (hand plan puts Dog in losersToLead)

### M4: Hand-Dependent Phoenix Strategy
- New: `evaluatePhoenixPlay()` returns 'prefer'/'avoid'/'neutral'
- Skip Phoenix singleton leads in both hand plan and ranked play loops
- In follow play: skip Phoenix when 'avoid', prefer when 'prefer'
- Key fix: Skip Phoenix singletons in hand plan loop too (not just lead-select loop)

## Test Status
- 51 expert-bot tests pass
- 86 total bot tests pass (excluding 8 pre-existing integration failures)
- New tests added: ~24 tests across M1-M4

## Files Modified
- `code/packages/server/src/bot/expert-bot.ts` — All 4 milestones
- `code/packages/server/src/bot/bot-strategy-utils.ts` — M1 (Stanford indices)
- `code/packages/server/tests/bot/expert-bot.test.ts` — All 4 milestones
- `code/packages/server/tests/bot/bot-strategy-utils.test.ts` — M1 (index tests)
- `specifications/RTM-expert-bot-strategy-rewrite.md` — Updated for M1-M4

## Next: M5-M10
M5: Bomb-proof exits + straight-flush detection
M6: Context-adaptive Mah Jong wish
M7: Endgame strategy
M8: Risk-based Tichu defense
M9: Card tracker point tracking
M10: Enhanced follow play
