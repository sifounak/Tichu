# Statistics System Redesign — Data Capture Review

## Context

Reviewing the comprehensive statistics redesign plan (`plans/statistics-system-redesign.md`) before implementation. The redesign replaces pre-aggregated ~80-column `playerStats` table with raw event logging across 8 data layers, enabling retroactive stat computation. This document captures design decisions from the brainstorming review.

## Branch

`feature/stats-redesign-event-capture` (off `main`)

---

## Section 1: Data Layers — Confirmed Structure

| Layer | Records/game | Status |
|-------|-------------|--------|
| 1. Game-level | 1 | Complete — matches existing `games` table |
| 2. Round-level | ~8 | Complete — add `scoreNSAtStart`/`scoreEWAtStart` + `startedAt` timestamp |
| 3. Player-round | ~32 | Mostly complete — see gaps |
| 4+6. Tricks (merged) | ~60-80 | Merged trick-level + trick results into single table |
| 5. Play-level | ~250-350 | Core granular log — see updates |
| 7. Special events | ~10-20 | Wish, Dragon gift, Dog play, Bomb lifecycle |
| 8. Player global | N/A | Chat counters — unchanged |

---

## Section 2: Resolved Gaps

### Gap 1: Action Source (Auto-pass vs AFK vs Player)

**Decision:** Add `actionSource` field on all play-level records.

Values:
- `'player'` — human manually acted
- `'automation'` — system acted on behalf of human per a rule (auto-pass when impossible to play, future user-configured presets like auto-bomb)
- `'timeout'` — human failed to act within time limit, system intervened
- `'bot'` — bot AI decision

**Why:** Separates player-initiated automation (smart play) from system-initiated override (AFK/slow). Prevents polluting decision quality stats (E1 aggressiveness, E2 voluntary vs forced passes, F7 timing).

### Gap 2: Hand Sizes of All Players at Play Time

**Decision:** Pre-compute and store 3 additional ints on every play-level record:
- `partnerCardsRemaining`
- `leftOppCardsRemaining`
- `rightOppCardsRemaining`

**Why:** Enables endgame skill analysis (E7), score-pressure queries, and table state context without expensive cross-player backward scans. ~3.6 KB/game cost is trivial vs ~70 KB total. Can be removed later if not needed.

### Gap 3: Merge Trick-Level + Trick Results

**Decision:** Merge layers 4 (trick record) and 6 (trick result) into a single `tricks` table. They are always 1:1.

**Additional fields for trick type tracking:**
- `leadCombinationType` — what the leader played (single, pair, straight, etc.)
- `leadCombinationRank` — rank of the lead
- `leadCombinationLength` — length for straights/pair sequences
- Existing `winningCombinationType/Rank/Length` stays

**Why:** Captures both what trick started as and what won it. When a bomb overrides, lead type != winning type. Derivable: `wasBombed = winningCombinationType IN ('fourBomb', 'straightFlushBomb') AND lead wasn't a bomb`.

### Gap 4: Bomb Lifecycle — Two-Level Model

**Decision:** Track bombs with a two-level model:

#### Level 1: Bomb Inventory Record (1 per distinct bomb resource, per player, per round)

Created after pass resolution. Contains all common query data.

```
-- Identity
gameId, roundNumber, seat, bombId
bombClass               -- 'fourOfAKind' | 'straightFlush'

-- For fourOfAKind: rank, cards
-- For straightFlush: suit, cards, lowRank, highRank, length (5+)

-- Evolution snapshots
first8Length             -- 0 if not present in first 8
prePassLength           -- after full deal, before pass
postPassLength          -- after pass (= length)

-- Overlap
overlappingBombIds      -- [bombId, ...] bombs sharing cards
overlapType             -- 'none' | 'partial' | 'mutuallyExclusive'

-- Fate
fate                    -- 'playedFull' | 'playedPartial' | 'brokenUp' | 'heldToEnd'
bombPlaysFromRun        -- distinct bomb plays from this resource (0, 1, 2+)

-- Wish impact
affectedByWish          -- boolean
wishEffect              -- 'none' | 'eroded' | 'brokenUp' | 'forcedBombPlay'

-- Play context (aggregate, "any" semantics across all plays from this bomb)
capturedDragon, capturedPhoenix
wasOverbomb, wasOverbombed
wasEndOfTrickBomb, wasOwnTurn, followedByDog
partnerTichuActive, opponentTichuActive
```

For straightFlush bombs, tracks the **maximal consecutive same-suit run** as a single entity, not individual sub-bomb permutations. All possible SFBs are derivable from the run boundaries.

`bombPlaysFromRun` tells consumers when to check Level 2: if >= 2, multiple bomb plays came from the same resource (rare, long SFB split into sub-bombs).

#### Level 2: Bomb Event Records (0+ per bomb)

Two event types:

**`playBomb`** — a bomb was played from this resource:
- cardsPlayed, bombSizePlayed, maxAvailableSize
- targetSeat (who they bombed)
- capturedDragon, capturedPhoenix
- wasOverbomb, wasEndOfTrickBomb, wasOwnTurn
- forcedByWish
- partnerTichuActive, opponentTichuActive
- followedByDog (defaults false, updated when dog is played after winning with this bomb)

**`wishSideEffect`** — wish-forced play affected this bomb without being a bomb play:
- cardLost (which card was played away)
- couldHavePlayedBomb (could they have satisfied wish by playing the bomb instead?)
- runLengthBefore, runLengthAfter (<5 means bomb is dead)
- wishRank

#### Overlap semantics:
- **mutuallyExclusive**: playing either bomb destroys the other (e.g., four-9s + Jade 8-K SFB sharing 9-of-Jade — playing the 4bomb leaves fragments too short for SFB, playing SFB leaves only three 9s)
- **partial**: playing one weakens but doesn't destroy the other (e.g., four-9s + Jade 3-Q SFB — playing 4bomb shortens SFB from 10 to fragments, but one fragment could still be 5+)

#### Creation timing:
After pass resolution — scan hand using `detectAllBombs()`, create inventory records with all three evolution snapshots computed retrospectively from `first8Cards` and `fullHandPrePass`.

### Gap 5: couldHaveGoneOut Computation

**Decision:** Compute `legalPlayCount` and `couldHaveGoneOut` together from a single `getAllValidPlays()` call. No separate computation needed.

### Gap 6: Phoenix Effective Value (Non-Issue)

**Confirmed:** `phoenixUsedAs` (int, for combos) and `phoenixEffectiveValue` (real, for singles) are complementary. No gap.

### Gap 7: Dragon Gift Forced Flag

**Decision:** Add `giftWasForced: boolean` to the Dragon gift event record. Derivable from `recipientCardsLeft === 0 || otherOpponentCardsLeft === 0`, but the boolean makes queries simpler.

---

## Section 3: Missing Insights Review

Cross-referenced 65+ stat catalog against proposed data capture. **No missing raw data found.** All gaps are in the computation layer (deferred).

| Missing Insight | Data Available? | Notes |
|----------------|----------------|-------|
| Pass strategy quality | Yes — full hands pre/post pass, all 6 cards | Needs hand strength heuristic (deferred) |
| Trick momentum / streaks | Yes — trick results sequence | Future computed stat |
| Card efficiency | Yes — play-level + trick results | Future computed stat |
| Defensive plays | Yes — cardsRemainingAfter + playedOnTopOf | Future computed stat |
| First trick behavior | Yes — trickNumber = 1 filter | Future computed stat |
| Round duration | **Needs `startedAt` on round record** | Added to Layer 2 |
| Score context on plays | Yes — trickPointRunningTotal in design | Already planned |
| Multi-game session analysis | Yes — game timestamps | Future analysis layer |

### One addition:
- **Add `startedAt` timestamp to round-level record** — enables round duration analysis without scanning for first play timestamp.

---

## Still To Review

- **Section 4: When/Where We Gather Data** — mapping capture points to game engine hooks
- **Section 5: Database write strategy** — when to persist (in-memory during game, batch at game end, or hybrid)
- Final spec serialization via `/spec-builder`
