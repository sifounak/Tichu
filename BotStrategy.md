# Expert Bot Strategy

The expert bot is implemented across 3 files with **10 strategy modules**, based on Stanford CS229 research (Eric Yang 2018) and community Tichu strategy guides.

## Architecture

- `code/packages/server/src/bot/expert-bot.ts` — Main `ExpertBot` class (1,126 lines), implements `BotStrategy` interface
- `code/packages/server/src/bot/bot-strategy-utils.ts` — 20+ shared utility functions (699 lines)
- `code/packages/server/src/bot/card-tracker.ts` — Top-10 card tracker + bomb detection (307 lines)

---

## The 12 Strategy Modules

### M1: Determing if you and/or your partner have strength

1. You have have strength if you have 2 or more power cards (Ace, Dragon, Phoenix), otherwise you have weak hand
2. Your partner has signaled strength if they pass you a card lower than 10 or the dog, otherwise they have weak hand


### M2: Default play

1. Prefer playing Aces as singletons since they are powerful as a singleton and this maximizes their value.
2. Prefer playing Aces later in the round so other players/bots must be cautious about your unaccounted for Aces
3. Prefer to play Aces only when you need control (need to lead to discard low rank cards/hands, need to play Dog to your partner) or to disrupt opponents as they get close to going out or stopping a 1-2
4. Prefer playing multi-card hands instead of breaking hands to play cards as singletons (e.g., play pair Jacks instead of 2 individual Jacks).
5. Prefer playing in low-to-high rank order to discard low rank cards/hands as early as possible
6. If you need to maintain control to win or discard low rank singletons or pairs, account for the probability of whether playing a low multi-card hand without having a high multi-card hand of the same type to follow it.

### M3: Grand/Regular Tichu Calling (Stanford Formula)

**Grand Tichu** uses the `Ig` index on the first 8 cards:

1. At least 3 power cards and a bomb
2. At least 3 power cards and a strong (rank > 10) multi-card hand (e.g., full house, consecutive pairs, triple)
3. At least 2 power cards and a strong (rank > 10) multi-card hand (e.g., full house, consecutive pairs, triple) and opponents are within 1 game of winning game

**Regular Tichu** uses the `It` index on all 14 cards:

```
It = 2*N_Ace - 2*N_dog + 6*N_dragon + 6*N_phoenix + 5*N_bomb + N_straight - N_small
```

Where `N_small` = singleton cards below Queen not in any pair/triple/straight.

Thresholds: Behind 200+ -> It>=5, Even -> It>=7 (Stanford's 50% success), Ahead 200+ -> It>=9.

### M4: Card Passing (Parity Convention + Strength Concentration)

5 sub-rules:

1. **Strength concentration** — Weak hand passes best card (Dragon > Phoenix > Ace) to partner. Strong hand passes 3rd-worst card that does not break a hand (e.g., pair, triple, etc.).
2. **Parity convention** — Odd-ranked cards go to the left opponent, even-ranked to the right opponent. If passing 2 even cards or 2 odd cards, lowest even card goes to the right, lowest odd goes to the left.
3. **Anti-bomb** — If you don't have 2 single cards below 8, you can split a low pair (e.g., pair of 2s, 3s, or 4s) and give one to each opponent.
4. **Special card rules** — Never pass Dragon/Phoenix/Mahjong to opponents. If an opponent has called Grand Tichu or Tichu before the pass, give Dog to to that opponent. Dog goes to partner if you have a strong hand, but may need help regaining control of trick if you lose it. as a signal of strength. Otherwise, pass Dog to the right if you have a strong hand, pass Dog to the left if you have a weak hand.
5. **Track passed-to-right** — Remembers what was passed to the right opponent for Mah Jong wish targeting.

### M5: Context-Dependent Dog Play

Default behavior is to play Dog early (Fuegi principle: "risk of never getting another lead"). But **saves the Dog** when any of these 4 conditions are true:

1. Partner called Tichu/Grand Tichu — save to bail them out later
2. Bot has a bomb or Dragon — guaranteed lead recovery anyway, Dog more valuable later
3. Opponent called Tichu/Grand Tichu — save for strategic disruption
4. Significantly behind on score (200+ deficit) — save for critical moment

### M6: Hand-Dependent Phoenix Evaluation

Prefer to play the Phoenix late in the round, if possible.

Never play Phoenix in any of these situations:
1. On top of any single card less than Ace until all Aces have been played
2. As part of low multi-card hand whose major rank is less than 7, unless playing the hand will make you go out

Acceptable scenarios to play the Phoenix:
1. Over a single Ace
  - Prefer to wait until last unnacounted for Ace is played, but acceptable to play before if leading opponent has <= 5 cards
  - Useful to gain control when necessary (especially when Dragon has already been played), like when you are trying to go out first or second or you have the Dog and want to give control back to your partner
2. Over a King if all the Aces have already been played
3. As part of a straight if it is of high rank or helps get many singletons out of your hand
4. As part of consecutive pairs
5. As part of a triple of medium-to-high rank (>= than 8)
6. As part of a pair of higher rank (> 10)
7. As the start of a trick if all you have left is an Ace (or a King if all Aces have been played) or Dragon

### M7: Bomb Strategy

**Timing** — bombs are saved for late game. Fire when:
- Opponent about to complete 1-2 finish (one opponent out, other has <=3 cards)
- Opponent has 1-2 cards (about to go out)
- Opponent Tichu caller has 1-5 cards remaining
- BUT never bomb against partner

**Bomb-proof exit planning** — When holding exactly 2 cards (Dragon + low single) and bomb risk exists (any rank with 3+ unaccounted cards), lead the low single first. If bombed, Dragon can recover the lead when singles are played again. Exception is when you need one more lead in order to go out.

**Straight-flush detection** — Delegates to shared `detectAllBombs()` which finds both four-of-a-kind and straight-flush (5+ consecutive same suit) bombs.

### M8: Context-Adaptive Mahjong Wish

4-priority system:

1. Mahjong played in a straight:
- **no wish**
  - If you have an Ace or partner has signaled strength
- **wish**
  - If player to the right has called Grand Tichu or Tichu AND partner has not signaled strength AND you do not have an Ace - **wish for Ace** (force out their power card)
2. Opponent to the right called Grand Tichu - **wish for Ace** (force out their power card)
3. Opponent to the right called Tichu AND partner has not signaled strength — **wish for Ace** (force out their power card)
4. Fallback - **wish for the card passed to the right opponent** (parity convention — you know they have it)

### M9: Endgame Strategy

Three sub-phases:

**3-player, partner already out** — Play aggressively to go out 2nd. Lead strongest combos, win every trick.

**3-player, partner still in** — Compare card counts:
- Partner has fewer cards — play Dog to feed them the lead
- Bot has fewer — go out aggressively
- Equal — fall through to normal play

**2-player** — Two sub-cases:
- Opponent has 1 card — lead multi-card groups first (opponent can only play singles), then singles high-to-low
- Opponent has many cards — normal lead-low strategy

### M10: Risk-Based Tichu Defense

4-factor fight/concede score:

| Factor | Fight | Concede |
|---|---|---|
| Caller's cards remaining | 5+ cards: +1 | 1-2 cards: -3 |
| Own winners (Aces, Dragon, bombs) | 3+ winners: +2 | 0 winners: -2 |
| Unaccounted power cards | 4+ unaccounted: +1 | <=1 unaccounted: -1 |
| Partner called Tichu | Always: +2 | — |

Score >= 0 -> fight. Score < 0 -> concede (pass more freely).

### M11: Card Tracker + Point Tracking

The `CardTracker` monitors:

- **Top 10 cards**: 4 Aces, 4 Kings, Dragon, Phoenix — tracks which have been played and by whom
- **Absent ranks**: Flags ranks where 3+ cards are unaccounted for (potential opponent bombs)
- **Team points**: Card point totals (5s=5, 10s/Ks=10, Dragon=25, Phoenix=-25)

Used for: King safety (lead Kings when all Aces accounted for), Dragon gift decisions (give to opponent with most cards), bomb risk assessment, and Tichu defense evaluation.

### M12: Enhanced Follow Play

Three refinements to follow/respond play:
1. **King safety** — Treate Kings as Aces when all Aces are accounted for via the card tracker
2. **Smart pass** — Don't spend a King on a low trick (rank <=8) when unaccounted Aces exist. Don't spend Aces/Dragon on low tricks at all.
3. **Split Aces** — Never lead Ace pairs unless over opponents high rank  (>= Queen) pairs or you need one more control to go out. Otherwise, each Ace should win a separate trick for maximum value.

---

## Hand Planning

On the first play of each round, the bot creates a `HandPlan` that categorizes all cards:

- **Losers to lead**: Dog, low straights (rank <=10), low combos (rank <=8)
- **Winners**: Bombs, Dragon, Aces, high combos (rank >=12)
- **Discards**: Low singles (rank <=6) not in any combo
- **Phoenix role**: "singleton-killer" (if few high singletons) or "wild" (if 3+ high singletons)

The plan is invalidated when 1-2 prevention mode activates.

---

## Decision Flow (choosePlay)

```
1. Update card tracker
2. Create hand plan (first play only)
3. Check for bomb opportunity (opponent near exit / Tichu caller low on cards)
4. Check endgame phase (3-player or 2-player situations)
5. Check 1-2 prevention mode (opponent already went out first)
6. If leading:
   a. Bomb-proof exit planning
   b. Dog play (context-dependent)
   c. King safety
   d. Hand plan losers
   e. Go-out check
   f. Lead lowest non-winner
7. If following:
   a. Partner winning? Pass
   b. Can go out? Play
   c. Tichu defense evaluation
   d. Smart pass (save winners for high tricks)
   e. Phoenix evaluation
   f. Win with minimum force
```
