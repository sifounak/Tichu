# Statistics System Redesign — Specification

**Version:** 1.0
**Date:** 2026-04-09
**Status:** Approved
**Confidence:** High — All data layers, capture hooks, and storage strategy are fully designed and cross-referenced against the game engine. ~100+ named insights verified derivable from proposed data capture.

## 1. Goal

Replace the current pre-aggregated statistics system with a raw event logging architecture that captures the full game narrative across 7 data layers, enabling ~100+ named insights to be computed on demand and new stats to be added retroactively over historical games.

**Why:** The current system pre-aggregates ~96 counters in a `playerStats` table and stores round-level event summaries as JSON blobs in `roundPlayerEvents`. This locks stats at capture time — new stats can't be added retroactively, computation bugs can't be fixed over historical data, and JSON blobs are hard to query across games. The raw event approach (learned from poker/bridge/MTG analytics) decouples capture from computation.

## 2. Context & Background

### Current System

| Component | Description |
|-----------|-------------|
| `playerStats` table | 96 pre-aggregated counter columns per player, updated via `upsertGroupCStats()` |
| `playerRelationalStats` table | Per-partner/opponent stats (8 columns) |
| `roundPlayerEvents` table | JSON blob per player per round (~80+ fields in `RoundEventSummary`) |
| `RoundEventTracker` class | State-diff observer that populates `RoundEventSummary` during gameplay |
| `stat-computations.ts` | Pure functions: `computeGameStats()`, `computeRoundStats()` |
| `game-persistence.ts` | `saveGameResult()` writes games, rounds, stats; `savePassStatsOnAbandon()` for abandoned games |

### Design Philosophy

**Store raw events, compute stats on top.** This allows:
- New stats added retroactively over old games
- Bug fixes to stat computation apply to all historical data
- Cache can be rebuilt from scratch at any time

### Prior Work

- Original spec: `specifications/2026-03-30-player-statistics-system.md` (29 FR + 4 NFR) — superseded by this redesign
- Data capture review: `docs/superpowers/specs/2026-04-05-stats-redesign-data-capture-review.md`
- Full design document: `plans/statistics-system-redesign.md` (insights catalog, data layers, capture architecture, DB write strategy)

## 3. Requirements

### 3.1 Schema Requirements — Functional

#### REQ-F-SC01: Game-level table (no change)
Maintain existing `games` table fields: gameId, targetScore, startedAt, endedAt, seats (4 userId + 4 name columns), winnerTeam, finalScoreNS, finalScoreEW, roundCount.
**Priority:** Must
**Acceptance:** Existing `games` table unchanged. All current queries continue to work.

#### REQ-F-SC02: Round-level table extension
Extend `game_rounds` with three new fields: `scoreNSAtStart` (int — NS score entering this round), `scoreEWAtStart` (int — EW score entering this round), `startedAt` (timestamp — when round began).
**Priority:** Must
**Acceptance:** New columns exist in `game_rounds`. `scoreNSAtStart`/`scoreEWAtStart` are populated before round scoring modifies `context.scores`. `startedAt` is populated at round creation. Existing columns retained and unmodified.

#### REQ-F-SC03: Player-round table
New `player_rounds` table replacing `roundPlayerEvents` JSON blobs. Composite key: gameId + roundNumber + seat. One row per player per round.
**Priority:** Must
**Fields:**
- Identity: gameId (FK), roundNumber, seat, userId (nullable for bots)
- Hands: first8Cards (JSON array of 8 card IDs), fullHandPrePass (JSON array of 14), passedToLeft/passedToPartner/passedToRight (JSON card ID each), receivedFromLeft/receivedFromPartner/receivedFromRight (JSON card ID each), handAfterPass (JSON array of 14)
- Calls: grandTichuCall (bool), tichuCall (bool), tichuCallPhase (text: 'prePassing'/'midRound'/null), tichuCallTrickNumber (int, null if not mid-round), tichuCallHandSizes (JSON: {partner, leftOpp, rightOpp}), tichuCallSuccess (bool)
- Finish: finishPosition (int 1-4, null if didn't finish), finishTrickNumber (int)
- Points: cardPointsCaptured (int), handPointsGivenToOpponents (int), capturedPointsGivenToFirstOut (int)
- Running total: trickPointRunningTotal (JSON array of cumulative card points after each trick)

**Acceptance:** Table created with all fields. One row per player per round inserted at round end. JSON fields valid and parseable. Replaces `roundPlayerEvents` data.

#### REQ-F-SC04: Merged trick table
New `tricks` table combining trick identity and result into a single row. Composite key: gameId + roundNumber + trickNumber.
**Priority:** Must
**Fields:**
- Identity: gameId (FK), roundNumber, trickNumber (1-indexed)
- Lead: leadSeat, leadCombinationType, leadCombinationRank, leadCombinationLength
- Result: winnerSeat, pointValue (card points in trick), trickLength (number of plays, not counting passes), uncontested (bool — leader led and all others passed)
- Winning combination: winningCombinationType, winningCombinationRank, winningCombinationLength
- Content flags: containsDragon (bool), containsPhoenix (bool)
- Context: activeTichuSeats (JSON — seats with unresolved Tichu/GT calls at trick time)

**Acceptance:** One row per trick per round. Lead fields populated from first play. Result fields populated when trick completes via `completeTrickAndAdvance()`. All combination types use the standard enum (Single, Pair, Triple, FullHouse, Straight, PairSequence, FourBomb, StraightFlushBomb).

#### REQ-F-SC05: Play-level table
New `plays` table — one row per action (play, pass, or bomb) within a trick. Includes bot actions for complete trick reconstruction.
**Priority:** Must
**Fields:**
- Identity: gameId (FK), roundNumber, trickNumber, sequenceNumber (1-indexed within trick), seat
- Action: actionType ('play'/'pass'/'bomb'), actionAt (timestamp), actionSource ('player'/'automation'/'timeout'/'bot')
- Card details (play/bomb only): cards (JSON array of card IDs), combinationType, combinationRank, combinationLength, phoenixUsedAs (rank, null if no Phoenix), phoenixEffectiveValue (real — Phoenix-as-single effective value, null otherwise), isBomb (bool), legalPlayCount (int — legal combinations available)
- Contextual flags: outOfTurn (bool), interruptedSeat (text — seat whose turn was interrupted, null if not out-of-turn), endOfTrickBomb (bool — bomb after last pass blocking trick resolution vs mid-turn, null if not OOT), playedOnTopOf (text — seat of current trick winner at time of play), playerFinished (bool — play emptied hand), cardsRemainingAfter (int), couldHaveGoneOut (bool — had legal play that would empty hand but chose otherwise), playedMinimum (bool — lowest-ranking legal option of same combination type)
- Hand sizes: partnerCardsRemaining (int), leftOppCardsRemaining (int), rightOppCardsRemaining (int)
- Pass-specific (actionType='pass'): couldHavePlayed (bool), legalPlayCount (int), hadBombAvailable (bool)
- Wish context: wishActive (bool), wishRank (int), playForcedByWish (bool)
- Tichu context: partnerTichuActive (bool), opponentTichuActive (JSON: {left, right} with 'tichu'/'grandTichu'/null)
- Timing: turnStartedAt (timestamp), durationMs (int)

**Acceptance:** One row per action within each trick. Bot actions captured (actionSource='bot'). Pre-play enrichment fields (legalPlayCount, playedMinimum, couldHaveGoneOut, hand sizes, timing) populated from GameManager computation. Post-play observation fields populated from EventTracker state diff.

#### REQ-F-SC06: Wish event table
New `wish_events` table — 0-1 per round (only when Mah Jong wish is declared).
**Priority:** Must
**Fields:** gameId (FK), roundNumber, wishRank (int 2-14), trickNumber, cardsOfRankRemaining (int), cardsOfRankInWisherHand (int), wishFulfilledTrick (int, null if never), wishFulfilledBy (text seat, null if never)
**Acceptance:** Row created when wish declared. Fulfillment fields updated when wish satisfied or left null at round end. `cardsOfRankRemaining` reflects count at declaration time.

#### REQ-F-SC07: Dragon gift event table
New `dragon_gift_events` table — 0+ per round. Created only when Dragon player wins trick and must gift it (NOT when Dragon trick is bombed).
**Priority:** Must
**Fields:** gameId (FK), roundNumber, trickNumber, gifterSeat, recipientSeat, trickPointValue (int), recipientCardsLeft (int), otherOpponentCardsLeft (int), gifterFinishedOnPlay (bool), recipientHasTichu (bool), otherOpponentHasTichu (bool), giftWasForced (bool — only one valid opponent recipient)
**Acceptance:** Row created on Dragon gift. Not created when Dragon trick is bombed. `giftWasForced` true when only one opponent is eligible (other is already out or not present).

#### REQ-F-SC08: Dog play event table
New `dog_play_events` table — 0+ per round.
**Priority:** Must
**Fields:** gameId (FK), roundNumber, trickNumber, playerSeat, controlPassedTo (seat), partnerAlreadyOut (bool), partnerHasTichu (bool), hadPriorLeadOpportunity (bool — won a trick earlier but didn't lead Dog then), dogWasLastCard (bool)
**Acceptance:** Row created when Dog is played. `hadPriorLeadOpportunity` derived from checking if player led any prior trick this round.

#### REQ-F-SC09: Bomb inventory table (Level 1)
New `bomb_inventory` table — one record per distinct bomb resource per player per round. Created after pass resolution.
**Priority:** Must
**Fields:**
- Identity: gameId (FK), roundNumber, playerSeat, bombId (auto-increment)
- Bomb: bombType ('fourOfAKind'/'straightFlush'), cards (JSON), rank (int — four-of-a-kind rank or high card of straight flush), size (int — number of cards: 4, 5, 6, ...)
- Evolution: acquiredPhase ('first8'/'fullDeal'/'postPass')
- SFB tracking: For straight flush bombs, tracked as maximal same-suit runs. `bombPlaysFromRun` (int) count tells consumers when Level 2 disambiguation is needed.
- Overlap: overlapsWith (JSON — bombIds of other bombs sharing cards)
- Fate: fate ('played'/'brokenUp'/'heldToEnd'), fateTrickNumber (int), fateTarget (seat — bombed player), outOfTurn (bool), endOfTrickBomb (bool)
- Context: playsSeenWhileHeld (int — incremented each play by other players while bomb held)
- Aggregate flags: capturedDragon (bool), wasOverbomb (bool), followedByDog (bool)

**Acceptance:** Inventory created after pass resolution by scanning hands with `detectAllBombs()`. Evolution snapshots track bomb state at first8, prePass, postPass. SFBs stored as maximal same-suit runs, not individual sub-bomb permutations. Fate finalized at round end for any remaining bombs.

#### REQ-F-SC10: Bomb events table (Level 2)
New `bomb_events` table — two event types linked to bomb inventory records.
**Priority:** Must
**Fields:**
- Common: gameId (FK), roundNumber, bombId (FK to bomb_inventory), eventType ('playBomb'/'wishSideEffect')
- playBomb: trickNumber, play details, followedByDog (bool — updated retroactively on Dog play)
- wishSideEffect: cardLost (card ID), couldHavePlayedBomb (bool), runLengthChange (int — for SFB run shortening)

**Acceptance:** playBomb events created when a bomb is played. wishSideEffect events created when a wish forces playing a card that erodes a bomb. `followedByDog` on playBomb updated when Dog is played in the next trick by the same player.

#### REQ-F-SC11: Player global stats
Maintain or create lifetime chat counters per user, stored outside the per-game event log.
**Priority:** Should
**Fields:** userId (FK), totalChatMessages (int), totalChatCharacters (int)
**Acceptance:** Counters increment on each chat event. Values persist across games. Works for chat sent outside active rounds.

### 3.2 Capture Requirements — Functional

#### REQ-F-CP01: Hybrid capture architecture
Implement a two-phase capture system: pre-play enrichment in GameManager computes expensive contextual fields, post-play observation in EventTracker captures results via state diffs.
**Priority:** Must
**Acceptance:** Pre-play context computed before `actor.send()`. Post-play observation matches context to observed play. No modification to XState state machine actions.

#### REQ-F-CP02: Pre-play enrichment
GameManager computes before each play: legalPlayCount (via `getValidPlays().length`), playedMinimum (bool — lowest-ranking legal option of same combination type), couldHaveGoneOut (bool — legal play exists that empties hand), actionSource ('player'/'automation'/'timeout'/'bot'), hand sizes of all other players (partnerCardsRemaining, leftOppCardsRemaining, rightOppCardsRemaining), turnStartedAt/durationMs timestamps.
**Priority:** Must
**Acceptance:** All 6 enrichment fields computed and passed to `eventTracker.recordPrePlayContext(seat, prePlay)` before `actor.send()`. `playedMinimum` on leads means lowest of the same combination type chosen.

#### REQ-F-CP03: Post-play observation
EventTracker's `onStateChange()` detects new plays/passes via state diff (comparing previous and current trick state), matches them with pending pre-play contexts by seat, and assembles complete `PlayRecord` objects.
**Priority:** Must
**Acceptance:** Every play action results in a matched PlayRecord with both pre-play enrichment fields and post-play observation fields populated.

#### REQ-F-CP04: Rejected play cleanup
When a pre-play context is recorded but no corresponding play appears in the state diff (play was rejected by state machine validation), the pre-play context is discarded.
**Priority:** Must
**Acceptance:** No orphaned pre-play contexts accumulate over a round.

#### REQ-F-CP05: Game-level capture
Game-level data captured via existing `onGameEnd` callback pattern.
**Priority:** Must
**Acceptance:** Game record written with correct winnerTeam, finalScores, seats, timestamps.

#### REQ-F-CP06: Round-level capture
`scoreNSAtStart`/`scoreEWAtStart` captured at round start BEFORE round scoring modifies `context.scores`. `startedAt` captured at round creation. Scoring fields captured at round end.
**Priority:** Must
**Acceptance:** Score-at-start values match `context.scores` at the moment the round begins. They do NOT reflect any points scored during the round.

#### REQ-F-CP07: Player-round hand capture
Hand snapshots captured at phase transitions: first 8 cards at GT decision phase (`captureInitialHands`), full 14-card hand pre-pass at card passing phase, pass cards at `executeCardExchange`, received cards after exchange, handAfterPass post-exchange.
**Priority:** Must
**Acceptance:** All 9 hand/pass fields populated for every player every round. `handAfterPass = fullHandPrePass - passedCards + receivedCards`.

#### REQ-F-CP08: Player-round call capture
Tichu/GT calls detected via state diff (previous snapshot has no call, current has call). Hand sizes read from the same snapshot.
**Priority:** Must
**Acceptance:** `tichuCallPhase` correctly distinguishes 'prePassing' (called during GT/pass phase) from 'midRound' (called during play). `tichuCallHandSizes` captures partner/leftOpp/rightOpp card counts at call time. Caller is always 14.

#### REQ-F-CP09: Trick capture
Lead fields populated from first play of trick. Result fields populated when trick completes via `completeTrickAndAdvance()`, detected via state diff (previous trick existed, current trick is null or different).
**Priority:** Must
**Acceptance:** One TrickRecord per trick with both lead and result fields. `trickLength` counts plays (not passes). `uncontested` true only when leader's play won with all others passing.

#### REQ-F-CP10: Play-level capture
Every action (play, pass, bomb) within a trick produces a PlayRecord. Pre-play context from GameManager provides enrichment fields. Post-play observation from EventTracker provides card details, contextual flags, wish/Tichu context.
**Priority:** Must
**Acceptance:** `sequenceNumber` correctly orders all actions within a trick (1-indexed). Both human and bot actions captured.

#### REQ-F-CP11: Out-of-turn bomb capture
When a bomb is played out of turn: `outOfTurn = true`, `interruptedSeat` = the seat whose turn was interrupted (`currentTurn`), `endOfTrickBomb` = true if bomb played after last pass blocking trick resolution (state was `awaitingEndOfTrickBomb`), false if during another player's active turn.
**Priority:** Must
**Acceptance:** All three fields correctly populated for OOT bombs. All three null for normal-turn plays.

#### REQ-F-CP12: Wish event capture
Wish declared when `mahjongWish` transitions from null to a value in state diff. `cardsOfRankRemaining` computed at declaration time. Fulfillment tracked when wish is satisfied.
**Priority:** Must
**Acceptance:** WishEvent created with correct rank. `cardsOfRankRemaining` counts all unplayed cards of that rank across all hands at declaration time. Fulfillment fields updated when wish satisfied.

#### REQ-F-CP13: Dragon gift capture
Dragon gift detected when `dragonGiftedTo` transitions from null to a seat in state diff, or via auto-gift in `completeTrickAndAdvance`. NOT created when Dragon trick is bombed.
**Priority:** Must
**Acceptance:** DragonGiftEvent created with correct gifter, recipient, point value, and context fields. `giftWasForced` true when only one valid opponent recipient exists.

#### REQ-F-CP14: Dog play capture
Dog play detected via `lastDogPlay` state transition. `hadPriorLeadOpportunity` derived from checking if player led any prior trick this round.
**Priority:** Must
**Acceptance:** DogPlayEvent created with all context fields. `controlPassedTo` reflects actual recipient (partner if alive, else next active player).

#### REQ-F-CP15: Bomb inventory capture
After pass resolution (Card Passing → Playing transition), scan all players' hands with `detectAllBombs()` to create bomb inventory records. Track evolution snapshots at first8, prePass, postPass phases.
**Priority:** Must
**Acceptance:** All bomb resources detected and inventoried. SFBs stored as maximal same-suit runs. Evolution shows when bomb was first acquirable.

#### REQ-F-CP16: Bomb event capture
Bomb erosion tracked on each play (check if played card overlaps with a tracked bomb's cards). Play events created when `combination.isBomb`. `followedByDog` updated retroactively when Dog played in next trick by same player. Fate finalized at round end for remaining bombs.
**Priority:** Must
**Acceptance:** All bomb fate values ('played'/'brokenUp'/'heldToEnd') correctly assigned. `playsSeenWhileHeld` accurately counts plays by other players while bomb was held.

#### REQ-F-CP17: Bot action capture
Bot plays processed through the same capture pipeline as human plays. `actionSource = 'bot'` distinguishes them.
**Priority:** Must
**Acceptance:** Bot plays appear in `plays` table with correct actionSource. Complete trick reconstruction possible from play records.

#### REQ-F-CP18: Chat counter capture
Increment `totalChatMessages` and `totalChatCharacters` on each chat event.
**Priority:** Should
**Acceptance:** Counters accurate. Chat outside active rounds still counted.

### 3.3 Storage Requirements — Functional

#### REQ-F-ST01: In-memory accumulation
All event data accumulates in memory in the enhanced `RoundEventTracker` / `GameEventAccumulator` during gameplay.
**Priority:** Must
**Acceptance:** No database writes during gameplay. Data accessible for recovery file serialization.

#### REQ-F-ST02: Recovery file serialization
Serialize accumulated event data to a JSON recovery file at each round end. One file per active game, overwritten each round.
**Priority:** Must
**Acceptance:** Recovery file written to `data/recovery/` directory. File contains all accumulated data up to current round. File is valid JSON.

#### REQ-F-ST03: Batch write at game end
Single database transaction writes all data layers: game, rounds, player-rounds, tricks, plays, special events (wish, dragon, dog), bomb inventory, bomb events.
**Priority:** Must
**Acceptance:** All rows inserted in one transaction. If any insert fails, entire transaction rolls back. No partial data in database.

#### REQ-F-ST04: Recovery file cleanup
Delete recovery file on successful batch write.
**Priority:** Must
**Acceptance:** No recovery files remain after successful game completion.

#### REQ-F-ST05: Server restart recovery
On server startup, check for recovery files. If found, reconstruct data and persist to database.
**Priority:** Must
**Acceptance:** Recovery files from crashed games result in data being written to database on next startup. Corrupt files are logged and discarded, not crash the server.

#### REQ-F-ST06: Game abandonment handling
When a game is abandoned, write whatever accumulated data exists up to the abandonment point. Clean up recovery file.
**Priority:** Must
**Acceptance:** Partial game data persisted (rounds completed before abandonment). Extends existing `savePassStatsOnAbandon` pattern.

### 3.4 Cache Requirements — Functional

#### REQ-F-MC01: V1 cache table
Materialized cache table covering the stats that the current UI displays. Replaces the 96-column `playerStats` table with a structure that can be recomputed from raw events.
**Priority:** Must
**Acceptance:** Cache table created. Current UI stats page displays correctly reading from cache.

#### REQ-F-MC02: Full rebuild capability
Cache can be completely rebuilt from raw event data at any time via a rebuild script/function. Rebuild drops and recreates cache data.
**Priority:** Must
**Acceptance:** Running rebuild produces identical cache to incremental updates. Can be triggered programmatically.

#### REQ-F-MC03: Incremental update after each game
After a game's batch write completes, incrementally update the cache for all players in that game.
**Priority:** Must
**Acceptance:** Cache reflects new game data immediately after batch write. No manual rebuild needed for ongoing play.

#### REQ-F-MC04: Retroactive stat addition
New stats can be defined and computed over all historical raw event data by adding computation logic and running a rebuild.
**Priority:** Must
**Acceptance:** Adding a new computed stat + running rebuild produces correct values for all historical games.

#### REQ-F-MC05: Cache disposability
Cache can be dropped and redesigned without any data loss — raw events are the source of truth.
**Priority:** Must
**Acceptance:** Dropping cache table + rebuilding restores all stats. No data stored only in cache.

### 3.5 Migration Requirements — Functional

#### REQ-F-MG01: Keep games table
Existing `games` table unchanged.
**Priority:** Must
**Acceptance:** All existing `games` rows preserved. No schema changes to this table.

#### REQ-F-MG02: Extend game_rounds
Add `scoreNSAtStart`, `scoreEWAtStart`, `startedAt` columns to existing `game_rounds` table. Existing columns unchanged.
**Priority:** Must
**Acceptance:** New columns added via `ALTER TABLE ADD COLUMN`. Existing rows have NULL for new columns (historical data). New games populate all fields.

#### REQ-F-MG03: Replace roundPlayerEvents
New `player_rounds` table replaces the JSON blob approach. Old `roundPlayerEvents` table dropped.
**Priority:** Must
**Acceptance:** Old table removed. New table created. No code references old table.

#### REQ-F-MG04: Replace playerStats
New materialized cache replaces the 96-column `playerStats` table.
**Priority:** Must
**Acceptance:** Old table dropped. Cache table created. All query paths updated.

#### REQ-F-MG05: Replace playerRelationalStats
Relational stats (per-partner, per-opponent) computed from raw data rather than stored in a separate table.
**Priority:** Must
**Acceptance:** Old table dropped. Relational queries derive from raw events or cache.

#### REQ-F-MG06: Fresh start for historical data
Old JSON blobs lack trick-level data and cannot be migrated to the new schema. New system starts fresh.
**Priority:** Must
**Acceptance:** No migration of old `roundPlayerEvents` data attempted. Old `playerStats` counters not carried over.

### 3.6 Non-Functional Requirements

#### REQ-NF-01: Memory overhead
In-game memory overhead ≤150 KB per active game for event accumulation.
**Category:** Performance
**Acceptance:** Measured with an 8-round, 4-player game. Peak memory for accumulated event data ≤150 KB.

#### REQ-NF-02: Write latency
Batch write at game end completes in ≤500ms for a typical game.
**Category:** Performance
**Acceptance:** Benchmarked with 8-round, 4-player game (~400 rows across all tables).

#### REQ-NF-03: Recovery file size
Recovery file ≤200 KB after 8 rounds of accumulated data.
**Category:** Performance
**Acceptance:** Measured with 8-round game.

#### REQ-NF-04: Cache rebuild performance
Full cache rebuild completes in ≤10 seconds for 1000 games.
**Category:** Performance
**Acceptance:** Benchmarked with 1000 game dataset.

#### REQ-NF-05: No gameplay impact
Capture logic must not add perceptible latency to play actions. Pre-play enrichment computation must be negligible compared to existing auto-pass timing (500ms).
**Category:** Performance
**Acceptance:** Pre-play enrichment completes in <10ms. No player-visible delay introduced.

#### REQ-NF-06: Backward compatibility
Existing game flow, WebSocket protocol, and client behavior unchanged. No client-side changes required.
**Category:** Compatibility
**Acceptance:** All existing tests pass. Client receives identical WebSocket messages. Game mechanics unaffected.

### 3.7 Constraints

- **Platform:** SQLite via better-sqlite3, Drizzle ORM for type-safe schema
- **Schema management:** Idempotent `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN` (no migration files — matches existing pattern in `connection.ts`)
- **State machine:** EventTracker must remain a pure observer — no mutations to XState state machine
- **Bot handling:** Bot actions captured but bot seats have null userId
- **Card IDs:** Card identifiers use existing `GameCard` ID system (0-55)

### 3.8 Assumptions

1. **SQLite handles the transaction size** — ~400 rows / ~80 KB per game is well within SQLite's limits. *If wrong: would need chunked writes.*
2. **`getValidPlays()` is fast enough for pre-play enrichment** — it's already called during validation; calling it once more adds negligible overhead. *If wrong: would need caching or lazy computation.*
3. **Recovery files on local filesystem are sufficient** — no distributed storage needed (single-server deployment). *If wrong: would need shared storage or DB-based recovery.*
4. **One recovery file per game is sufficient** — overwriting at each round end means at most one round of data lost on crash. *If wrong: would need more frequent serialization.*

## 4. Scope

### 4.1 In Scope

- Database schema: 8 new tables + extension of `game_rounds`
- Event capture infrastructure: hybrid pre-play enrichment + post-play observation
- Batch write at game end with single transaction
- Recovery file system for crash resilience
- Materialized cache (v1): covers current UI stats + full rebuild capability
- Migration: drop old tables (`playerStats`, `playerRelationalStats`, `roundPlayerEvents`)
- Chat counter tracking (lifetime per user)

### 4.2 Out of Scope

- **UI/stats page changes** — separate specification (next step)
- **Hand strength heuristic** — deferred until after backend + UI are complete (needed for insights C3, C4, I1-I4)
- **Real-time stats during gameplay** — stats computed post-game only
- **Historical data migration** — old JSON blobs lack required granularity
- **Distributed/multi-server deployment** — single server assumed

## 5. Edge Cases & Boundary Conditions

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| EC-01 | Game abandoned before any round completes | No event data to persist. Recovery file cleaned up. No rows written. |
| EC-02 | Game abandoned after card pass but before play | Pass-related data written (extends existing `savePassStatsOnAbandon`). Trick/play tables empty for that round. |
| EC-03 | Server crashes mid-round | Data from completed rounds recovered from recovery file on restart. Current in-progress round data lost. |
| EC-04 | Server crashes during batch write | SQLite transaction ensures atomicity — either all data written or none. Recovery file still exists for next startup. |
| EC-05 | Recovery file is corrupt JSON | Log warning, discard file, continue startup. No crash. |
| EC-06 | Player disconnects and bot takes over mid-round | Plays before disconnect: `actionSource='player'`. Bot plays after: `actionSource='bot'`. Both captured. userId remains the human's for the seat. |
| EC-07 | 1-2 finish (round ends with players still holding cards) | Last two players get finishPosition=null (they didn't go out). Their remaining hand points go to opponents. |
| EC-08 | Dragon trick bombed | No DragonGiftEvent created. Trick result has `containsDragon=true` and bomb as winning combination type. |
| EC-09 | No wish declared in a round | No row in `wish_events`. |
| EC-10 | Multiple bombs played in same trick (over-bombing) | Each bomb is a separate play row. Bomb inventory tracks `wasOverbomb` flag. Second bomb's `playedOnTopOf` references the first bomber's seat. |
| EC-11 | Player has overlapping bombs (4-of-a-kind shares cards with straight flush) | Both tracked in `bomb_inventory` with `overlapsWith` cross-referencing. Playing one erodes the other. |
| EC-12 | Auto-pass (system automatically passes for player with no legal plays) | `actionSource='automation'`, `couldHavePlayed=false`, `legalPlayCount=0`. |
| EC-13 | Timeout pass (player AFK, timer expires) | `actionSource='timeout'`, `couldHavePlayed` may be true (they had legal plays but didn't act). |
| EC-14 | Phoenix played as single (half-rank above current) | `phoenixEffectiveValue` stores the computed effective value. `phoenixUsedAs` stores null (only set when Phoenix substitutes for a specific rank in combinations). |
| EC-15 | Round with 0 tricks (theoretically impossible in Tichu) | No trick or play rows. Player-round rows still created with empty hand/call/finish data. |
| EC-16 | Cache rebuild with 0 games | Cache table exists but empty. No errors. |

## 6. Risks & Concerns

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|------------|
| R-01 | EventTracker complexity explosion — 7 data layers in one class | Medium | High | Incremental milestone delivery; each data layer tested independently; consider extracting per-layer capture into separate modules |
| R-02 | Pre-play enrichment adds latency to play actions | Low | Medium | `getValidPlays()` is already called during validation; benchmark early in M3 |
| R-03 | Recovery file corruption on crash | Low | High | Validate JSON on read; log and discard corrupt files; at most one round of data lost |
| R-04 | Schema design locks in wrong structure | Medium | Medium | Raw events are source of truth; cache can be redesigned freely; schema can be extended with new columns |
| R-05 | Bomb lifecycle two-level model is over-engineered | Low | Low | Level 1 (inventory) provides most value; Level 2 (events) can be simplified if too complex |
| R-06 | Migration breaks existing UI | Medium | High | V1 cache covers all current UI stats; update queries before dropping old tables; verify UI end-to-end |

## 7. Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Data completeness | All ~100+ named insights derivable from captured data | Spot-check 10 representative insights across categories after M3 |
| Capture accuracy | 100% of plays/tricks/events captured for a full game | Play test game, compare DB rows to game replay |
| Write reliability | 0 data loss for completed games | Play 10 games, verify all have complete data |
| Recovery reliability | Recovered data matches completed rounds | Simulate crash at round boundary, verify recovery |
| Cache correctness | Incremental update matches full rebuild | Play 5 games, compare incremental cache to rebuilt cache |
| Performance: write latency | ≤500ms per game | Benchmark 8-round game batch write |
| Performance: pre-play overhead | <10ms per play | Benchmark pre-play enrichment |
| Backward compatibility | All existing tests pass | `npm test` after each milestone |

## 8. Insights Catalog (Traceability Reference)

The ~100+ named insights below are derivable from the data captured by this specification. Each insight maps to the requirements that provide its source data. Full descriptions in `plans/statistics-system-redesign.md`.

| Category | Insights | Primary Data Sources |
|----------|----------|---------------------|
| A: Game Outcomes (A1-A18) | Win rate, streaks, margins, comebacks, 1-2 finish, game length | SC01 (games), SC02 (game_rounds) |
| B: Round Performance (B1-B14) | Finish position, points, round streaks, shutouts | SC02 (game_rounds), SC03 (player_rounds) |
| C: Tichu/GT Calling (C1-C13) | Call rate, success, calibration, timing, context, races | SC03 (player_rounds — call fields) |
| D: Card Events (D1-D14) | Dragon/Phoenix/Dog/Wish/Bomb analysis | SC06-SC10 (special events), SC05 (plays) |
| E: Decision Quality (E1-E13) | Aggressiveness, restraint, efficiency, play style | SC05 (plays — contextual flags, legalPlayCount, playedMinimum) |
| F: Table Control (F1-F11) | Lead %, trick wins, tempo, disruption | SC04 (tricks), SC05 (plays — timing) |
| G: Partnership (G1-G10) | Coordination, rescue sequences, friendly fire | SC03 (player_rounds), SC05 (plays — partnerTichuActive, playedOnTopOf) |
| H: Opponent Disruption (H1-H7) | Tichu break, wish disruption, point capture | SC04 (tricks), SC05 (plays), SC06 (wish_events) |
| I: Luck vs Skill (I1-I7) | Hand quality, bomb luck, overperformance | SC03 (player_rounds — hands), SC09 (bomb_inventory) |
| J: Situational (J1-J7) | Score-pressure behavior, endgame, swing rounds | SC02 (game_rounds — scores at start), SC05 (plays) |
| K: Chat Activity (K1-K4) | Chat volume, timing | SC11 (player_global_stats) |

## 9. Open Questions

1. **Hand strength heuristic** — Deferred. Needed for C3, C4, I1-I4, I7. Will be a separate spec after UI work.
2. **Index strategy** — Specific column indexes for common query patterns (per-player lifetime, per-game drill-down, per-partnership) to be determined during M1 implementation based on cache query patterns.
3. **Cache table exact schema** — V1 covers current UI stats. Exact columns determined during M5 implementation by examining current `queries.ts` read patterns.
4. **K3/K4 chat timing insights** — Require timestamps on chat messages. May need a separate chat_events table if chat timing analysis is desired. Deferred — current spec only covers lifetime counters (K1/K2).
