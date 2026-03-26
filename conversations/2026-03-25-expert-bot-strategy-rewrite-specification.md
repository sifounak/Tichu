# Expert Bot Strategy Rewrite — Specification Conversation

**Date:** 2026-03-25
**Phase:** Specification

## Summary of Key Decisions

### Strategy Research (4 Sources)
1. **Stanford CS229 Paper (Eric Yang 2018):** Grand Tichu index Ig = N_Ace + 3*N_dragon + 3*N_phoenix + 3*N_bomb (call when Ig >= 2). Tichu index It = 2*N_Ace - 2*N_dog + 6*N_dragon + 6*N_phoenix + 5*N_bomb + N_straight - N_small (call when It >= 7). Dragon+Phoenix 3x more important than Ace.
2. **Aaron Fuegi's Strategy Guide:** Lead low/win high. Split Aces. Play Dog early by default. Support partner's Tichu unconditionally. Bomb late. Concentrate strength in one hand when passing. Don't overplay partner.
3. **Board Game Arena Tips:** Score-adaptive Grand Tichu thresholds. Track top 10 power cards. Timing of Tichu calls. Pass Dragon to partner as signal.
4. **Spotlight on Games:** Bombs overvalued by beginners. Card counting essential.

### User Decisions (4 Rounds of Q&A)

**Round 1:**
- Bot priority: Full integration (all aspects must work together)
- Dog strategy: Context-dependent (evaluate Tichu calls, score, lead recovery)
- Grand Tichu: Score-adaptive (conservative ahead, aggressive behind)
- Card counting: Initially perfect tracking, then changed to top-10 power cards only

**Round 2:**
- Passing: Concentrate + convention (low odd left, low even right)
- Defense: Risk-based (evaluate odds before committing to fight)
- 1-2 finish: Tichu-first (pursue 1-2 only naturally)
- Mah Jong: Context-adaptive (wish what you passed default, disrupt Tichu callers)

**Round 3:**
- Bombs: Full bomb awareness (offensive timing + bomb-proof exits)
- Weak hand: Balanced support (help partner but avoid going out last)
- Phoenix: Hand-dependent evaluation each turn
- Additional topics: Endgame specifics requested

**Round 4 (Endgame):**
- Phoenix endgame: Always go out (don't exploit -25 penalty)
- 3 players, partner out: Go out 2nd priority
- 3 players, partner not out: Situational (help whoever is closer)
- Point tracking: Rough tracking (approximate balance)

### Where Sources Agree
- Lead low, win high (universal)
- Split Aces (Fuegi + BGA)
- Bombs overvalued by beginners, time them late (all sources)
- Dragon+Phoenix is gold standard for Grand Tichu (Stanford + Fuegi)
- Track power cards (Fuegi + BGA)

### Where Sources Disagree (Resolved)
- Grand Tichu threshold: Stanford (Ig>=2) vs Fuegi (need both Dragon+Phoenix) → Score-adaptive compromise
- Dog timing: Fuegi (play early) vs BGA (warns about too early AND too late) → Context-dependent
- Dog value in Grand Tichu: Stanford (not modeled) vs Fuegi (valuable) → User's context-dependent approach
- Pre-pass Tichu: Fuegi (rarely) vs BGA (call early with Dog/Mah Jong/2s) → Depends on partnership conventions

## Specification Output
Written to `specifications/2026-03-25-expert-bot-strategy-rewrite.md`
RTM written to `specifications/RTM-expert-bot-strategy-rewrite.md`
