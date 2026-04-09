# Tichu Statistics System — Complete Data Capture & Insights Inventory

## Context

We want to capture comprehensive game data that enables professional-level statistical analysis of Tichu play. The design philosophy (learned from poker/bridge/MTG analytics) is: **store the raw events, compute stats on top.** This allows new stats to be added retroactively over old games.

The current system pre-aggregates ~140 counters in a `playerStats` table and stores round-level event summaries as JSON blobs. This proposal replaces that approach with a richer raw event log that captures the full game narrative, from which all current and future stats can be derived.

---

## Part 1: Exhaustive Insights Catalog

### Category A: Game Outcomes
| # | Insight | Description |
|---|---------|-------------|
| A1 | Win rate | Overall, by partner, by opponent, by score context |
| A2 | Win/loss streaks | Current and longest, across games |
| A3 | Score differential | Average margin of victory/defeat |
| A4 | Comeback wins | Won games after trailing by 100+ at any point |
| A5 | Blowout wins/losses | Games won/lost by 300+ |
| A6 | Close games | Games decided by ≤50 points |
| A7 | 1-2 finish rate | How often team finishes 1st and 2nd |
| A8 | 1-2 finish against | How often opponents 1-2 against you |
| A9 | Games requiring tiebreak | Games that went to overtime rounds |
| A10 | Forfeit/spectator tracking | Games forfeited, spectated, joined-after-spectating |

### Category B: Round Performance
| # | Insight | Description |
|---|---------|-------------|
| B1 | Finish position distribution | % of rounds finishing 1st, 2nd, 3rd, 4th |
| B2 | Average finish position | Lifetime and by context |
| B3 | Rounds won/lost | Team round outcomes |
| B4 | Points from Tichu bonuses/penalties | Net contribution from Tichu calls |
| B5 | Rounds won without Tichu | Team wins from card points alone |
| B6 | Card points captured (per player) | Average per round, individual not just team |
| B7 | End-of-round point redistribution | Points given to opponents from last player's hand; captured tricks given to first-out player |

### Category C: Tichu/Grand Tichu Calling
| # | Insight | Description |
|---|---------|-------------|
| C1 | Call rate | % of rounds where player calls Tichu or GT |
| C2 | Call success rate | % of calls that succeed |
| C3 | Call calibration | Did they call on strong hands and avoid weak ones? (requires hand strength heuristic) |
| C4 | GT regret | Didn't call GT but finished 1st anyway (missed opportunity) |
| C5 | Call context: score differential | Call rate when ahead vs. behind, bucketed |
| C6 | Call context: cards remaining | Hand sizes of all OTHER players when mid-round Tichu called |
| C7 | Call context: hand composition | What did the hand look like when they called? |
| C8 | Tichu timing | Called during GT phase, during passing, or mid-round? At what point in the round? |
| C9 | Desperation GT calls | GT calls when trailing badly + success rate |
| C10 | Conservative closing | Stops calling when near target score |

### Category D: Card Events & Special Cards
| # | Insight | Description |
|---|---------|-------------|
| D1 | Dragon management | Trick points gifted, gift choice analysis, forced vs. chosen |
| D2 | Phoenix usage patterns | As single (effective value stored), pair, triple, full house, straight — timing and effectiveness |
| D3 | Dog play analysis | Timing, partner alive or out, had prior lead opportunity, played for Tichu partner |
| D4 | Mah Jong wish analysis | Wish rank, was it possible, how long did it persist, did it constrain opponents |
| D5 | Bomb lifecycle | Acquired when, played/broken-up/held-to-end, hold duration, restraint metrics |
| D6 | Bomb context | Out-of-turn (mid-turn vs. end-of-trick), interrupted player, target player, broke a Tichu |
| D7 | Over-bombing | Bombed someone's bomb (direction: you over-bombed vs. you were over-bombed) |
| D8 | Pass contents | What was passed to partner vs. opponents, special cards given/received |
| D9 | "The Tichu" straight | 2-Ace clean or with Phoenix |
| D10 | Dragon bombed | Dragon trick captured by bomb instead of Dragon player (derived: containsDragon + winningCombinationType is bomb) |

### Category E: Decision Quality & Play Style
| # | Insight | Description |
|---|---------|-------------|
| E1 | Aggressiveness profile | Tendency to play vs. pass, call rate, bomb timing, lead style |
| E2 | Voluntary vs. forced passes | Could have played but chose not to (strategic restraint vs. passivity). legalPlayCount distinguishes "1 option held back" from "15 options and still passed" |
| E3 | Bomb restraint | How long bombs are held, opportunities passed up |
| E4 | Lead style | Singles (probing) vs. structured combos (aggressive), strongest vs. weakest option chosen. legalPlayCount on leads shows how many options they had |
| E5 | Run-out efficiency | Once taking control, tricks to go out |
| E6 | Blown leads | Was in 1st-to-finish position but lost it |
| E7 | Endgame skill | Finish rate when ≤3 cards remain |
| E8 | Stranded cards | Stuck with unplayable cards at round end |
| E9 | Playing over partner | How often they beat their own partner's winning play |
| E10 | "Could have gone out" | Had a winning play that would empty hand but chose something else |

### Category F: Table Control & Tempo
| # | Insight | Description |
|---|---------|-------------|
| F1 | Lead percentage | Fraction of tricks where they led |
| F2 | Lead retention | Win the trick they led, and lead again |
| F3 | Control recovery | Tricks between losing a trick and regaining the lead |
| F4 | Uncontested leads | Led and everyone passed |
| F5 | Trick length when leading | How many plays before their led trick resolves |
| F6 | Table dominance | Setting the combination type for the round |
| F7 | Action timing | How fast a player acts, tempo changes, potential pre-planning signals |

### Category G: Partnership Coordination
| # | Insight | Description |
|---|---------|-------------|
| G1 | Win rate by partner | Performance with specific partners |
| G2 | 1-2 finish coordination | When one finishes 1st, how often does partner finish 2nd |
| G3 | Tichu support score | Dog plays, voluntary passes, avoiding playing over partner during their Tichu |
| G4 | Friendly fire rate | Playing on top of partner's winning play |
| G5 | Pass synergy | Cards passed to partner that partner actually plays (and how quickly) |
| G6 | Partner Tichu broken | Called Tichu, partner's actions broke it |
| G7 | Passing into a Tichu | Voluntarily passes when partner has Tichu and is next to play |
| G8 | Bomb gifting via pass | Did the cards you passed complete a bomb in partner's or opponent's hand? (derivable from hand + pass data) |

### Category H: Opponent Disruption
| # | Insight | Description |
|---|---------|-------------|
| H1 | Tichu break rate | How often opponent Tichu fails when you're at the table |
| H2 | Tichu break contribution | Did YOU directly cause it (bombed, finished first, bombed right before their turn) |
| H3 | Wish effectiveness | How often wish constrained an opponent |
| H4 | Defensive Dragon use | Gift to opponent with fewer points vs. blocking finish |

### Category I: Luck vs. Skill Separation
| # | Insight | Description |
|---|---------|-------------|
| I1 | Hand quality distribution | Are they getting dealt better/worse than average? |
| I2 | Win rate vs. hand quality | Do they win more than hand quality predicts? (= skill) |
| I3 | Post-pass improvement | Do they consistently improve their hand through passing? (= passing skill) |
| I4 | Overperformance with weak hands | High finish despite low hand quality |

### Category K: Chat Activity
| # | Insight | Description |
|---|---------|-------------|
| K1 | Chat volume | Total messages sent per player (lifetime) |
| K2 | Chat verbosity | Total characters sent per player (lifetime) |

### Category J: Situational / Score-Dependent
| # | Insight | Description |
|---|---------|-------------|
| J1 | Score-pressure behavior | All stats bucketed by score differential |
| J2 | Comeback contribution | When team recovered from 200+ deficit, how much came from this player's Tichu bonuses vs. card points |
| J3 | Close-game performance | Play style changes when both teams near target |

---

## Part 2: Raw Data to Capture

### 2.1 Game-Level Record (1 per game)

| Field | Type | Description | Captured When | Used By |
|-------|------|-------------|---------------|---------|
| gameId | int | Unique game identifier | Game start | Everything — joins all tables |
| targetScore | int | Points needed to win (usually 1000) | Game start | A5, A6, J3 |
| startedAt | timestamp | When game began | Game start | Trending/session analysis |
| endedAt | timestamp | When game ended | Game end | Session analysis |
| seats | object | Map of seat → {userId, displayName} | Game start | Player identification |
| winnerTeam | text | 'NS' or 'EW' | Game end | A1-A10 |
| finalScoreNS | int | Final score North-South | Game end | A3, A5, A6 |
| finalScoreEW | int | Final score East-West | Game end | A3, A5, A6 |

**Status vs. current:** Mostly the same as existing `games` table. No changes needed.

---

### 2.2 Round-Level Record (1 per round)

| Field | Type | Description | Captured When | Used By |
|-------|------|-------------|---------------|---------|
| gameId | int | FK to game | Round start | Joins |
| roundNumber | int | 1-indexed | Round start | B1-B6, J1 |
| scoreNSAtStart | int | **NEW** — NS score entering this round | Round start | C5, C9, C10, J1-J3 |
| scoreEWAtStart | int | **NEW** — EW score entering this round | Round start | C5, C9, C10, J1-J3 |
| cardPointsNS | int | Card points captured by NS | Round end | B5, B6 |
| cardPointsEW | int | Card points captured by EW | Round end | B5, B6 |
| tichuBonusNS | int | Net Tichu bonus for NS | Round end | B4 |
| tichuBonusEW | int | Net Tichu bonus for EW | Round end | B4 |
| oneTwoBonus | text | 'NS', 'EW', or null | Round end | A7, A8 |
| totalNS | int | Total points NS this round | Round end | B3 |
| totalEW | int | Total points EW this round | Round end | B3 |
| finishOrder | json | Array of 4 seats in finish order | Round end | B1, B2, E6, G2 |

**Status vs. current:** Existing `gameRounds` table plus two new fields: `scoreNSAtStart` and `scoreEWAtStart`.

---

### 2.3 Player Round Record (1 per player per round)

This replaces the current `roundPlayerEvents` JSON blob approach with structured data.

| Field | Type | Description | Captured When | Used By |
|-------|------|-------------|---------------|---------|
| gameId | int | FK to game | Round start | Joins |
| roundNumber | int | Round within game | Round start | Joins |
| seat | text | N/E/S/W | Round start | Joins |
| userId | text | FK to user (null for bots) | Round start | Joins |

#### Hands

| Field | Type | Description | Captured When | Used By |
|-------|------|-------------|---------------|---------|
| first8Cards | json | Array of 8 card IDs — initial deal | After deal (GT phase) | C4, C7, I1, I2, D5 (bomb acquired phase) |
| fullHandPrePass | json | Array of 14 card IDs — before passing | After full deal | D8, I1, I3 |
| passedToLeft | json | Card ID passed to left opponent | After pass submission | D8, G5, H3 |
| passedToPartner | json | Card ID passed to partner | After pass submission | D8, G5 |
| passedToRight | json | Card ID passed to right opponent | After pass submission | D8, H3 |
| receivedFromLeft | json | Card ID received from left opponent | After pass resolution | D8, I3 |
| receivedFromPartner | json | Card ID received from partner | After pass resolution | D8, G5 |
| receivedFromRight | json | Card ID received from right opponent | After pass resolution | D8, I3 |
| handAfterPass | json | Array of 14 card IDs — after passing | After pass resolution | C7, E1, I3 |

> **Note:** `handAfterPass` is technically derivable from `fullHandPrePass` - passed cards + received cards. Storing it avoids recomputation and serves as a sanity check.

#### Calls

| Field | Type | Description | Captured When | Used By |
|-------|------|-------------|---------------|---------|
| grandTichuCall | bool | Whether GT was called | GT phase | C1-C10 |
| tichuCall | bool | Whether Tichu was called | When called | C1-C10 |
| tichuCallPhase | text | 'prePassing' / 'midRound' / null | When called | C8 |
| tichuCallTrickNumber | int | Trick # when mid-round Tichu was called (null if not mid-round) | When called | C6, C8 |
| tichuCallHandSizes | json | {partner, leftOpp, rightOpp} card counts at call time (caller is always 14) | When called | C6 |
| tichuCallSuccess | bool | Did the call succeed? | Round end | C1-C10 |

#### Finish & End-of-Round Points

| Field | Type | Description | Captured When | Used By |
|-------|------|-------------|---------------|---------|
| finishPosition | int | 1st, 2nd, 3rd, or 4th (null if didn't finish — e.g., round ended by 1-2) | Round end | B1, B2 |
| finishTrickNumber | int | Trick # when they played their last card | When they go out | E5, E7 |
| cardPointsCaptured | int | **NEW** — Card points this player's tricks captured (before end-of-round redistribution) | Round end | B6 |
| handPointsGivenToOpponents | int | **NEW** — Sum of card points remaining in hand at round end (given to opponents). 0 if the player went out. | Round end | B7, E8 |
| capturedPointsGivenToFirstOut | int | **NEW** — If the first-out player is on the opposing team, the last player's captured trick points go to them. This records how many captured points were surrendered. 0 if first-out is on same team or player is not last. | Round end | B7 |

#### Running Point Total

| Field | Type | Description | Captured When | Used By |
|-------|------|-------------|---------------|---------|
| trickPointRunningTotal | json | **NEW** — Array of cumulative card points captured after each trick, e.g. [0, 0, 15, 15, 30, 45] | Updated per trick | J1, J2 (score-context analysis within a round) |

---

### 2.4 Trick-Level Record (1 per trick per round) — **NEW**

This is the core new data structure that enables most advanced analytics.

| Field | Type | Description | Captured When | Used By |
|-------|------|-------------|---------------|---------|
| gameId | int | FK to game | Trick creation | Joins |
| roundNumber | int | Round within game | Trick creation | Joins |
| trickNumber | int | 1-indexed within round | Trick creation | F1-F6, E5 |
| leadSeat | text | Who led | Trick creation | F1, F2, E4 |

---

### 2.5 Play-Level Record (1 per play/pass within a trick) — **NEW**

This is the most granular level — every individual action in the game. Includes bots for complete trick reconstruction.

| Field | Type | Description | Captured When | Used By |
|-------|------|-------------|---------------|---------|
| gameId | int | FK | Play time | Joins |
| roundNumber | int | FK | Play time | Joins |
| trickNumber | int | FK | Play time | Joins |
| sequenceNumber | int | Order within the trick (1-indexed) | Play time | Reconstruction |
| seat | text | Who acted | Play time | Everything |
| actionType | text | 'play' / 'pass' / 'bomb' | Play time | E1, E2 |
| actionAt | timestamp | **NEW** — When the action was submitted | Play time | F7 (timing analysis) |

#### If actionType = 'play' or 'bomb':

| Field | Type | Description | Captured When | Used By |
|-------|------|-------------|---------------|---------|
| cards | json | Array of card IDs played | Play time | D1-D9, reconstruction |
| combinationType | text | Single, Pair, Triple, FullHouse, Straight, PairSequence, FourBomb, StraightFlushBomb | Play time | E4, F6 |
| combinationRank | int | Primary rank of the combination | Play time | Analysis |
| combinationLength | int | For straights/pair sequences | Play time | D9 |
| phoenixUsedAs | int | Rank Phoenix substituted for (null if no Phoenix) | Play time | D2 |
| phoenixEffectiveValue | real | **NEW** — When Phoenix played as single, the effective value (half-rank above current highest). Null otherwise. | Play time | D2 |
| isBomb | bool | Was this a bomb play? | Play time | D5-D7 |
| legalPlayCount | int | **NEW** — Number of legal combinations available at time of play (for leads: shows how many options they had) | Play time | E4, E10 |

#### Contextual flags (captured at play time because they're expensive to reconstruct):

| Field | Type | Description | Captured When | Used By |
|-------|------|-------------|---------------|---------|
| outOfTurn | bool | Bomb played when it wasn't their turn | Play time | D6, H2 |
| interruptedSeat | text | **NEW** — If outOfTurn: the seat whose turn was interrupted. If endOfTrickBomb: the trick leader who was about to win. Null if not out-of-turn. | Play time | D6, H2 |
| endOfTrickBomb | bool | **NEW** — True if bomb was played after last pass but before trick resolved (blocking the trick winner). False if bomb was during another player's active turn. Null if not out-of-turn. | Play time | D6 |
| playedOnTopOf | text | Seat of the current trick winner at time of play (who they beat) | Play time | E9, G4, H2 |
| playerFinished | bool | This play emptied their hand | Play time | E5, E7, B1 |
| cardsRemainingAfter | int | Cards left in hand after this play | Play time | E6, E7 |
| couldHaveGoneOut | bool | **NEW** — Had a legal play that would have emptied their hand, but played something else instead | Play time | E10 |

#### If actionType = 'pass':

| Field | Type | Description | Captured When | Used By |
|-------|------|-------------|---------------|---------|
| couldHavePlayed | bool | Had at least one legal play | Play time | E1, E2, G3, G7 |
| legalPlayCount | int | Number of legal combinations available | Play time | E2 |
| hadBombAvailable | bool | Held a bomb but didn't use it | Play time | E3 |

#### Wish context (on plays where wish is relevant):

| Field | Type | Description | Captured When | Used By |
|-------|------|-------------|---------------|---------|
| wishActive | bool | Was a wish in effect during this action? | Play time | D4, H3 |
| wishRank | int | The wished-for rank (if active) | Play time | D4 |
| playForcedByWish | bool | This play was forced to satisfy the wish | Play time | D4 |

#### Tichu context:

| Field | Type | Description | Captured When | Used By |
|-------|------|-------------|---------------|---------|
| partnerTichuActive | bool | **NEW** — Partner has an unresolved Tichu/GT call | Play time | G3, G4, G7 |
| opponentTichuActive | json | **NEW** — Which opponents have unresolved Tichu/GT calls, e.g. {left: "tichu", right: null} | Play time | H2 |

#### Turn timing:

| Field | Type | Description | Captured When | Used By |
|-------|------|-------------|---------------|---------|
| turnStartedAt | timestamp | **NEW** — When this player's turn began (null for out-of-turn bombs) | Turn start | F7 |
| durationMs | int | **NEW** — Milliseconds from turn start to action. For out-of-turn bombs: milliseconds since the interrupted player's turn started (how long into their turn the bomb happened). | Play time | F7 |

---

### 2.6 Trick Result Record (1 per completed trick) — **NEW**

Captured when a trick completes.

| Field | Type | Description | Captured When | Used By |
|-------|------|-------------|---------------|---------|
| gameId | int | FK | Trick end | Joins |
| roundNumber | int | FK | Trick end | Joins |
| trickNumber | int | FK | Trick end | Joins |
| winnerSeat | text | Who won the trick | Trick end | F1-F6, table control |
| pointValue | int | Total card points in the trick | Trick end | D1, B6 |
| trickLength | int | Number of plays (not counting passes) | Trick end | F5 |
| uncontested | bool | Winner led and everyone else passed | Trick end | F4 |
| activeTichuSeats | json | Seats with unresolved Tichu/GT calls at trick time | Trick end | D6, G3, H2 |
| winningCombinationType | text | **NEW** — The combination type that won the trick | Trick end | Analysis, D10 |
| winningCombinationRank | int | **NEW** — The rank of the winning combination | Trick end | Analysis |
| winningCombinationLength | int | **NEW** — Length (for straights/pair sequences) | Trick end | Analysis |
| containsDragon | bool | **NEW** — A Dragon was played in this trick | Trick end | D1, D10 |
| containsPhoenix | bool | **NEW** — A Phoenix was played in this trick | Trick end | D2 |

---

### 2.7 Special Event Records — **NEW**

One-off events within a round that carry rich context.

#### Mah Jong Wish Event (0-1 per round)

| Field | Type | Description | Captured When | Used By |
|-------|------|-------------|---------------|---------|
| wishRank | int | Rank wished for (2-14) | Wish declared | D4, H3 |
| trickNumber | int | When the wish was made | Wish declared | D4 |
| cardsOfRankRemaining | int | How many cards of that rank are still unplayed | Wish declared | D4 (impossible wish detection) |
| cardsOfRankInWisherHand | int | Does the wisher hold any of the wished rank? | Wish declared | D4 |
| wishFulfilledTrick | int | Trick # when wish was fulfilled (null if never) | Wish fulfilled or round end | D4 |
| wishFulfilledBy | text | Seat that fulfilled it | Wish fulfilled | D4 |

#### Dragon Gift Event (0+ per round)

Only created when the Dragon player wins the trick and must gift it. NOT created when the Dragon trick is bombed (that's tracked in the trick result as `dragonBombed: true`).

| Field | Type | Description | Captured When | Used By |
|-------|------|-------------|---------------|---------|
| trickNumber | int | Which trick | Gift time | D1 |
| gifterSeat | text | Who played the Dragon | Gift time | D1 |
| recipientSeat | text | Who received the trick | Gift time | D1 |
| trickPointValue | int | Points in the gifted trick | Gift time | D1, H4 |
| recipientCardsLeft | int | Cards remaining for recipient (0 = already out) | Gift time | D1 |
| otherOpponentCardsLeft | int | Cards remaining for other opponent (0 = already out) | Gift time | D1 |
| gifterFinishedOnPlay | bool | Dragon was their last card | Gift time | D1 |
| recipientHasTichu | bool | Recipient has active Tichu/GT | Gift time | D1, H4 |
| otherOpponentHasTichu | bool | Other opponent has active Tichu/GT | Gift time | D1, H4 |

#### Dog Play Event (0+ per round)

| Field | Type | Description | Captured When | Used By |
|-------|------|-------------|---------------|---------|
| trickNumber | int | Which trick | Dog played | D3 |
| playerSeat | text | Who played the Dog | Dog played | D3 |
| controlPassedTo | text | Who received control | Dog played | D3 |
| partnerAlreadyOut | bool | Partner finished before Dog played | Dog played | D3 |
| partnerHasTichu | bool | Partner has active Tichu/GT | Dog played | D3, G3 |
| hadPriorLeadOpportunity | bool | Won a trick earlier but didn't lead Dog then | Dog played | D3 |
| dogWasLastCard | bool | Dog was the player's final card | Dog played | D3 |

#### Bomb Lifecycle Records (0+ per player per round)

| Field | Type | Description | Captured When | Used By |
|-------|------|-------------|---------------|---------|
| playerSeat | text | Who held the bomb | Post-pass (init) | D5, D6, E3 |
| bombType | text | 'fourOfAKind' / 'straightFlush' | Post-pass | D5 |
| cards | json | Card IDs forming the bomb | Post-pass | D5 |
| rank | int | Primary rank (four-of-a-kind rank, or high card of straight flush) | Post-pass | D5 |
| size | int | Number of cards (4, 5, 6, ...) | Post-pass | D5 |
| acquiredPhase | text | 'first8' / 'fullDeal' / 'postPass' | Post-pass | D5, I1 |
| fate | text | 'played' / 'brokenUp' / 'heldToEnd' | When resolved | D5, E3 |
| fateTrickNumber | int | Trick # when played or first card broken off | When resolved | D5, E3 |
| fateTarget | text | Seat of player bombed (if played). For end-of-trick bombs: the trick leader who was about to win. For mid-turn bombs: the player whose turn was interrupted. | When resolved | D6 |
| outOfTurn | bool | Played out of turn | When resolved | D6 |
| endOfTrickBomb | bool | Bomb played after last pass to block trick resolution (vs. during another player's active turn) | When resolved | D6 |
| playsSeenWhileHeld | int | Number of plays by other players while bomb was held | Incremented each play | E3 |

---

### 2.8 Player Global Stats (lifetime counters, not per-game)

Some stats are simple lifetime counters that don't need per-game raw event storage.

| Field | Type | Description | Captured When | Used By |
|-------|------|-------------|---------------|---------|
| userId | text | FK to user | — | Joins |
| totalChatMessages | int | Lifetime chat messages sent | Each chat message | K1 |
| totalChatCharacters | int | Lifetime characters sent in chat | Each chat message | K2 |

> **Note:** These are incremented on each chat event, not derived from game data. They live outside the game event log since chat can happen outside of active rounds.

---

## Part 3: Storage Design

### Approach: Relational tables, not JSON blobs

The current system stores a JSON blob per player per round. This is hard to query across games. The new design uses normalized relational tables that SQLite can index and query efficiently.

### Table Summary

| Table | Rows per game (8 rounds, 4 players) | Est. bytes/row | Est. per game |
|-------|--------------------------------------|-----------------|---------------|
| `games` | 1 | ~200 | 200 B |
| `game_rounds` | 8 | ~150 | 1.2 KB |
| `player_rounds` | 32 | ~450 | 14.4 KB |
| `plays` | ~250-350 | ~160 | 40-56 KB |
| `trick_results` | ~60-80 | ~130 | 8-10 KB |
| `wish_events` | ~4-6 | ~80 | 0.5 KB |
| `dragon_gift_events` | ~2-4 | ~100 | 0.4 KB |
| `dog_play_events` | ~2-6 | ~80 | 0.5 KB |
| `bomb_lifecycles` | ~2-8 | ~120 | 1 KB |
| **Total** | | | **~66-84 KB** |

### What Happens to Existing Tables

| Current table | Decision | Rationale |
|---------------|----------|-----------|
| `games` | **Keep, extend** | Add `scoreNSAtStart`/`scoreEWAtStart` to `game_rounds` instead |
| `game_rounds` | **Keep, extend** | Add score-at-start fields |
| `round_player_events` | **Replace** | JSON blob → structured `player_rounds` table |
| `player_stats` (~98 counter columns) | **Replace with computed views** | All counters become derivable from raw data. Can be materialized as a cache table, rebuilt on demand |
| `player_relational_stats` | **Replace with computed views** | Derivable from raw data + game seats |

### Materialized Stats (Cache Layer)

The 98-column `playerStats` table becomes a **cache** that can be recomputed from raw data at any time. This means:
- New stats can be added retroactively
- Bug fixes to stat computation apply to all historical data
- The cache can be rebuilt with a single migration/script
- Read performance stays fast (pre-computed for the UI)

---

## Part 4: Resolved Decisions

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | Hand strength heuristic | **Defer** — design after data capture is finalized | Important but it's analysis code, not capture |
| 2 | Timestamps per action | **Yes** — `actionAt` on every play, `turnStartedAt` on turn start | Enables timing/tempo analysis; cheap to capture |
| 3 | Historical data migration | **Start fresh** | Old JSON blobs don't have trick-level data |
| 4 | Bot actions | **Yes** — capture bot plays | Needed for complete trick reconstruction |
| 5 | Cards in hand at trick time | **No** — derivable from handAfterPass minus plays | Adds ~8-10 KB/game for convenience; not worth it |
| 6 | Team bomb count at trick time | **No** | Derivable; not useful enough for separate collection |
| 7 | Trick point running total | **Yes** — added as `trickPointRunningTotal` in player round record | Useful for within-round score-context analysis |
| 8 | "Could have gone out" flag | **Yes** — added as `couldHaveGoneOut` on play actions | Expensive to reconstruct |
| 9 | Next expected player / bomb interruption context | **Yes** — replaced with `interruptedSeat` + `endOfTrickBomb` (user's more detailed proposal) | Captures full context: who was interrupted AND whether it was mid-turn vs. end-of-trick |
| 10 | Phoenix effective value | **Yes** — added as `phoenixEffectiveValue` on plays | Deriving is a pain |
| 11 | legalPlayCount on leads | **Yes** — added to all play/bomb actions | Shows how many options they had when leading |
| 12 | "Passing into a Tichu" flag | **Yes** — captured via `partnerTichuActive` on all actions | Simple boolean; enables G3, G7 analysis |
| 13 | Pass card tracking to outcome | **Derivable** — cross-join pass records with play-level card data | Complex join but no extra capture needed |

---

## Part 5: Derived Features (No Extra Capture Needed)

These insights require computation but NOT additional data capture beyond what's defined above:

| Feature | How to compute | Data sources |
|---------|---------------|--------------|
| Bomb completion via pass (G8) | Check if received cards complete a 4-of-a-kind or straight flush not present pre-pass | `fullHandPrePass` + received cards per player |
| `currentTrickWinner` at any point | Lead player, updated to each subsequent player who plays (not passes) | Play sequence in trick |
| `recipientAlreadyOut` for Dragon gifts | `recipientCardsLeft = 0` | Already in Dragon gift event |
| Dragon bombed (D10) | `containsDragon = true` AND `winningCombinationType` is FourBomb or StraightFlushBomb | Trick result fields |
| Pass card played by recipient (G5) | Join pass records with play-level card data | `passedToPartner` + `plays.cards` |
| Hand at any point mid-round | `handAfterPass` minus all cards played by that player up to that point | `handAfterPass` + play records |

---

## Part 6: Open Items

### Still To Design (after data review is complete)

1. **Hand strength heuristic** — Formula to score a 14-card Tichu hand. Needed for Categories C3, C4, I1-I4. This is important and should be designed carefully.

2. **Materialized cache schema** — What pre-computed stats tables look like for the UI. This is the replacement for the current 98-column `playerStats` table.

3. **Index strategy** — Which columns to index for common query patterns (per-player lifetime stats, per-game drill-down, per-partnership analysis).

4. **Migration plan** — Schema changes, new tables, deprecation of old tables, cache rebuild logic.

---

## Part 7: Data Capture Review Amendments (2026-04-05)

Review session cross-referencing the proposed capture against the game engine implementation. Full details in `plans/temporal-swimming-glacier.md` (brainstorm review doc).

### New/Changed Fields

| Change | Layer | Details |
|--------|-------|---------|
| `actionSource` on plays | Play-level (2.5) | `'player' \| 'automation' \| 'timeout' \| 'bot'` — distinguishes manual play, system automation, AFK timeout, and bot actions |
| Hand sizes of all players | Play-level (2.5) | `partnerCardsRemaining`, `leftOppCardsRemaining`, `rightOppCardsRemaining` on every play |
| Merge trick + trick result | Trick (2.4 + 2.6) | Single `tricks` table instead of two separate tables |
| Lead combination tracking | Trick (merged) | `leadCombinationType`, `leadCombinationRank`, `leadCombinationLength` alongside existing winning combination fields |
| `giftWasForced` | Dragon gift event (2.7) | Boolean — true when only one valid opponent recipient |
| `startedAt` timestamp | Round-level (2.2) | Enables round duration analysis |
| Bomb lifecycle redesign | Special events (2.7) | Two-level model replacing flat bomb lifecycle records — see below |

### Bomb Lifecycle: Two-Level Model

Replaces the original flat bomb lifecycle records in Section 2.7.

**Level 1 — Bomb Inventory:** One record per distinct bomb resource (fourOfAKind or straightFlush maximal run). Created after pass resolution. Contains identity, evolution snapshots (first8→prePass→postPass), overlap with other bombs, fate, wish impact, and aggregate play context flags (capturedDragon, wasOverbomb, followedByDog, etc.).

**Level 2 — Bomb Events:** Two event types: `playBomb` (specific bomb play details + `followedByDog` flag updated on dog play) and `wishSideEffect` (card lost, could have played bomb instead, run length change).

SFBs tracked as maximal same-suit runs, not individual sub-bomb permutations. `bombPlaysFromRun` count tells consumers when Level 2 disambiguation is needed.

### Resolved Decision Updates

| # | Original Decision | Updated Decision |
|---|-------------------|-----------------|
| 5 | Cards in hand at trick time: No | **Yes** — store `partnerCardsRemaining`, `leftOppCardsRemaining`, `rightOppCardsRemaining` on every play (~3.6 KB/game) |
| 14 | `playedMinimum` on plays | **New** — boolean, true when chosen play is lowest-ranking legal option. On leads: lowest of the same combination type chosen. |

### New Insights Catalog Additions (2026-04-09)

Comprehensive review of all 11 insight categories. All new insights are derivable from existing proposed data capture unless noted otherwise.

#### Category A: Game Outcomes
| # | Insight | Description |
|---|---------|-------------|
| A11 | Win method breakdown | How does team typically win — Tichu bonuses vs card points vs 1-2 finishes? |
| A12 | Game length distribution | Rounds per game with this player (short/dominant vs long/grindy) |
| A13 | Scoring trajectory | Score volatility across rounds within games |
| A14 | First-round impact | Team win rate in round 1 |
| A15 | Largest win margin | Biggest victory margin (lifetime max) |
| A16 | Largest loss margin | Biggest defeat margin (lifetime max) |
| A17 | Narrowest win margin | Closest game won (lifetime min of win differentials) |
| A18 | Narrowest loss margin | Closest game lost (lifetime min of loss differentials) |

#### Category B: Round Performance
| # | Insight | Description |
|---|---------|-------------|
| B8 | Captured points kept (last out) | Trick points kept by team when going out last (partner went out first) |
| B9 | Captured points surrendered (last out) | Trick points given to opponents when going out last (opponent went out first) |
| B10 | Hand points surrendered (last out) | Card points remaining in hand when finishing last, given to opponents |
| B11 | Second-place finish context | 2nd after partner (1-2 support) vs 2nd after opponent |
| B12 | Round point contribution ratio | Percentage of team's round points from this player |
| B13 | Round win streak | Consecutive rounds won by team |
| B14 | Shutout rounds | Rounds where opponents scored 0 or negative |

#### Category C: Tichu/GT Calling
| # | Insight | Description |
|---|---------|-------------|
| C11 | Tichu race | Opposing Tichu/GT active simultaneously — who wins the race? |
| C12 | Call frequency trend | Does calling rate change as game progresses (early vs late rounds, by score context)? |
| C13 | Double partner Tichu | Player calls Tichu over partner's existing Tichu/GT — how often, success rate of second caller, did original caller succeed, did it result in 1-2 finish? Note: at most one partner's Tichu can succeed (whoever goes out first). |

#### Category D: Card Events & Special Cards
| # | Insight | Description |
|---|---------|-------------|
| D11 | Mahjong lead strategy | Combination type/length of trick-1 lead (single=probing, straight=aggressive) |
| D12 | Phoenix effectiveness | Did the trick where Phoenix was played result in a win for the Phoenix player? |
| D13 | Wish backfire | Wish fulfilled by wisher's own partner or by wisher themselves (wishSatisfiedByPartner, wishSatisfiedBySelf) |
| D14 | Dragon + Dog pattern | Player wins trick with Dragon, then leads Dog next trick to pass control to partner |

#### Category E: Decision Quality & Play Style
| # | Insight | Description |
|---|---------|-------------|
| E11 | Trick type preference | What combination types does player prefer to lead? Filtered to leads with legalPlayCount > 1 |
| E12 | Pass-to-play ratio | When couldHavePlayed=true, fraction of time player actually played vs passed |
| E13 | Over-commitment detection | Ratio of trick wins in first half vs second half of round |
| — | `playedMinimum` field | Boolean on play-level records — true when chosen play is lowest-ranking legal option of same combination type. **Requires new data field.** |

#### Category F: Table Control & Tempo
| # | Insight | Description |
|---|---------|-------------|
| F2 | Trick win rate when leading | (Clarified) When you led a trick, how often did you win it? |
| F8 | Individual trick win streak | Consecutive tricks won by this player |
| F9 | Team trick win streak | Consecutive tricks won by either partner |
| F10 | Trick theft rate | Fraction of trick wins where winnerSeat != leadSeat (won someone else's trick) |
| F11 | Tempo disruption | How play speed changes within a round (speeding up vs slowing down) |

#### Category G: Partnership Coordination
| # | Insight | Description |
|---|---------|-------------|
| G9 | Partner rescue | Multi-trick sequence: partner has active T/GT, passes on opponent's play, you win and sustain control until partner plays or goes out. Five resolutions: success (Dog), success (partner plays), failed (opponent goes out), failed (opponent wins trick), failed (you go out). Track chain length. |
| G10 | Rescued by partner | Inverse of G9 — same sequence from the Tichu caller's perspective |

#### Category H: Opponent Disruption
| # | Insight | Description |
|---|---------|-------------|
| H5 | Mutual Tichu break | Player goes out first to break both partner's and opponent's Tichu simultaneously. Track point swing negated (200-600 points). |
| H6 | Wish disruption | From opponent's perspective — how often were you constrained by a wish? |
| H7 | Point capture rate | How often you win tricks containing high-point cards played by opponents |

#### Category I: Luck vs Skill
| # | Insight | Description |
|---|---------|-------------|
| I5 | Bomb luck | Frequency of bombs dealt vs acquired through passing. From bomb inventory evolution fields. |
| I6 | Special card distribution luck | How often dealt Dragon, Phoenix, multiple power cards |
| I7 | Opponent hand quality | Strength of opponents' hands when you play (needs hand strength heuristic) |

#### Category J: Situational / Score-Dependent
| # | Insight | Description |
|---|---------|-------------|
| J4 | Endgame round behavior | How play patterns shift when both teams within one round of winning |
| J5 | Performance when trailing vs leading | All play patterns bucketed by score position |
| J6 | Swing round contribution | Player's contribution in high-delta rounds (50+ point swing) |
| J7 | Target score proximity behavior | Strategy changes when your team is within 100 of target |

#### Category K: Chat Activity
| # | Insight | Description |
|---|---------|-------------|
| K3 | Chat timing | Chat frequency during active play vs between rounds |
| K4 | Chat after events | Chat frequency after bombs, Tichu calls, losses |

### Summary

**New data fields required:** Only `playedMinimum` (boolean) on play-level records. All other new insights are derivable from existing proposed capture.

**Total insights catalog:** Original 65+ expanded to ~100+ named insights across 11 categories.

### Section 4: Capture Points in Game Engine (2026-04-09)

#### Capture Architecture: Hybrid (Pre-Play Enrichment + Post-Play Observation)

**Pre-play enrichment (GameManager):**
- Computes context before sending event to state machine: `legalPlayCount`, `playedMinimum`, `couldHaveGoneOut`, `actionSource`, hand sizes of all players, `turnStartedAt`/`durationMs`
- Passes to tracker via direct method call: `eventTracker.recordPrePlayContext(seat, prePlay)`
- Then sends event to state machine: `actor.send({ type: 'PLAY_CARDS', ... })`

**Post-play observation (EventTracker):**
- Observes state diffs via `onStateChange()` (existing pattern)
- Matches pre-play context to observed play
- Captures trick completion, special events, round-end data
- Discards unmatched pre-play contexts (rejected plays)

#### Data Layer → Hook Point Mapping

**Layer 1 (Game):** `onGameEnd` callback — existing pattern, no changes.

**Layer 2 (Round):** `startRound` action for `startedAt`/scores-at-start. `scoreAndFinishRound` for scoring fields. Score-at-start must be captured BEFORE round scoring modifies `context.scores`.

**Layer 3 (Player-Round):**
- Hands: `captureInitialHands` (first 8), `detectPhaseTransitions` (pre-pass, post-pass)
- Passes: Card Passing → Playing transition in `executeCardExchange`
- Calls: `recordGrandTichuCall`/`recordRegularTichuCall` — detect via state diff (prev no call, curr has call), read hand sizes from same snapshot
- Finish: `playCards` action when `hand.length === 0`
- Points: Computed from `player.tricksWon` at scoring time

**Layer 4+6 (Tricks — merged):**
- Lead fields: First play of trick (trick creation in `playCards`)
- Result fields: `completeTrickAndAdvance()` — all trick completion paths funnel here
- Detected via state diff (prevTrick existed, currTrick is null)

**Layer 5 (Plays):**
- Pre-play context: GameManager computes and passes via `recordPrePlayContext()`
- Post-play observation: State diff detects new play in `currentTrick.plays`
- Passes: State diff detects new seat in `currentTrick.passes`
- Out-of-turn bombs: `isOutOfTurn` flag from `playCards` action; `interruptedSeat = currentTurn`; `endOfTrickBomb = (state === 'awaitingEndOfTrickBomb')`

**Layer 7 (Special Events):**
- Wish: Detected when `mahjongWish` transitions null → value (state diff)
- Dragon gift: `giveDragonTrick` action or auto-gift in `completeTrickAndAdvance`; detected via `dragonGiftedTo` transition
- Dog: `playCards` Dog branch; detected via `lastDogPlay` transition
- Bomb inventory: Created after pass resolution (Card Passing → Playing); scan hands with `detectAllBombs()`
- Bomb events: Erosion on each `playCards` (check overlap with tracked bombs); play events when `combination.isBomb`; `followedByDog` updated on Dog play; fate finalized at round end

### Section 5: Database Write Strategy (2026-04-09)

**Decision: Batch at game end + recovery file serialization**

**During gameplay:**
- All event data accumulates in memory in the enhanced `RoundEventTracker`
- At each round end, serialize accumulated data to a JSON recovery file (one per active game)

**At game end:**
- Single transaction writes all layers: game, rounds, player-rounds, tricks, plays, special events, bomb inventory + events
- Delete recovery file on successful write

**On server restart:**
- Check for recovery files; if found, reconstruct and persist salvaged data

**On game abandonment:**
- Write whatever data exists up to abandonment point (extends existing `savePassStatsOnAbandon`)
- Clean up recovery file

**Rationale:** ~80 KB in-memory cost is trivial. Server crashes during a 15-30 min card game are rare. One write path with one transaction keeps the system simple. Recovery file provides crash resilience without DB writes during gameplay.
