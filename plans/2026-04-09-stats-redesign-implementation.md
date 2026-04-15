# Statistics System Redesign — Implementation Plan

## Context

The current statistics system pre-aggregates ~96 counters in a `playerStats` table and stores round-level event summaries as JSON blobs in `roundPlayerEvents`. This approach locks stats at capture time — new stats can't be added retroactively, computation bugs can't be fixed over historical data, and JSON blobs are hard to query across games.

**Goal:** Replace with a raw event logging architecture that captures the full game narrative across 7 data layers, enabling ~100+ named insights to be computed on demand. Uses a hybrid capture architecture (pre-play enrichment in GameManager + post-play observation in EventTracker) with batch-at-game-end DB writes and JSON recovery files for crash resilience.

**Branch:** `feature/stats-redesign-event-capture`

### Scope

**In scope:** Database schema (new tables + extensions), event capture infrastructure, batch write + recovery, materialized cache (v1 covering current UI stats + rebuild mechanism), migration from old schema.

**Out of scope:** UI changes (next spec), hand strength heuristic (spec after UI).

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Cache refresh | After each game + full rebuild capability | Stats always up-to-date; rebuild for migrations/fixes |
| Old playerStats | Drop after migration | Clean break; new cache replaces it |
| SFB tracking | Explicit maximal same-suit runs + bombPlaysFromRun | Precise for implementation |
| Historical data | Fresh start | Old JSON blobs lack trick-level granularity |
| Bot actions | Captured | Needed for complete trick reconstruction |
| Capture architecture | Hybrid pre-play enrichment + post-play observation | Pre-play computes expensive fields; post-play observes state diffs |
| DB writes | Batch at game end + recovery files at round end | ~80 KB in-memory is trivial; one write path keeps it simple |

---

## Specification Summary

Full spec will be serialized to `specifications/` as Milestone 0. Below is the requirement index.

### Schema Requirements (REQ-F-SC01–SC11)

| ID | Table | Change | Key Fields |
|----|-------|--------|------------|
| SC01 | `games` | No change | Existing fields sufficient |
| SC02 | `game_rounds` | Extend | +`scoreNSAtStart`, `scoreEWAtStart`, `startedAt` |
| SC03 | `player_rounds` | **New** (replaces `roundPlayerEvents`) | Hands (first8, prePass, postPass), passes (6 fields), calls (GT/Tichu + phase/trick/handSizes/success), finish (position, trick#), points (captured, surrendered), trickPointRunningTotal |
| SC04 | `tricks` | **New** (merged trick+result) | Lead info (seat, combo type/rank/length), result (winner, points, trickLength, uncontested), winning combo, containsDragon/Phoenix, activeTichuSeats |
| SC05 | `plays` | **New** | Identity, action (type/timestamp/source), cards+combo, contextual flags (outOfTurn, interruptedSeat, endOfTrickBomb, playedOnTopOf, playerFinished, cardsRemainingAfter, couldHaveGoneOut, playedMinimum), hand sizes (partner/leftOpp/rightOpp), pass fields, wish context, Tichu context, timing |
| SC06 | `wish_events` | **New** | wishRank, trickNumber, cardsOfRankRemaining, fulfillment info |
| SC07 | `dragon_gift_events` | **New** | gifter, recipient, pointValue, context (cardsLeft, Tichu status, giftWasForced) |
| SC08 | `dog_play_events` | **New** | player, controlPassedTo, context (partnerOut, partnerTichu, priorLead, lastCard) |
| SC09 | `bomb_inventory` | **New** (Level 1) | Identity (seat, type, cards, rank, size), acquiredPhase, evolution snapshots, overlap, fate, fateTarget, playsSeenWhileHeld, aggregate flags. SFBs as maximal same-suit runs with bombPlaysFromRun |
| SC10 | `bomb_events` | **New** (Level 2) | playBomb (details + followedByDog) and wishSideEffect (card lost, couldHavePlayedBomb, runLengthChange) |
| SC11 | `player_global_stats` | Extend/create | totalChatMessages, totalChatCharacters per userId |

### Capture Requirements (REQ-F-CP01–CP18)

| ID | What | Hook Point |
|----|------|------------|
| CP01 | Hybrid capture architecture | Pre-play in GameManager + post-play in EventTracker |
| CP02 | Pre-play enrichment | GameManager computes legalPlayCount, playedMinimum, couldHaveGoneOut, actionSource, hand sizes, timing → `eventTracker.recordPrePlayContext(seat, prePlay)` |
| CP03 | Post-play observation | EventTracker `onStateChange()` matches pre-play context to observed play |
| CP04 | Rejected play cleanup | Unmatched pre-play contexts discarded |
| CP05 | Game-level capture | `onGameEnd` callback (existing) |
| CP06 | Round-level capture | `startRound` for startedAt/scores-at-start (BEFORE scoring modifies scores), `scoreAndFinishRound` for scoring |
| CP07 | Player-round hands | `captureInitialHands` (first 8), `detectPhaseTransitions` (pre/post-pass), `executeCardExchange` (pass cards) |
| CP08 | Player-round calls | State diff: prev no call → curr has call; read hand sizes from same snapshot |
| CP09 | Trick capture | Lead fields from first play; result from `completeTrickAndAdvance()`; detected via state diff |
| CP10 | Play-level capture | Pre-play context from GameManager + post-play from state diff |
| CP11 | Out-of-turn bombs | `isOutOfTurn` flag, `interruptedSeat = currentTurn`, `endOfTrickBomb` from state |
| CP12 | Wish events | Detect `mahjongWish` null → value transition |
| CP13 | Dragon gifts | `giveDragonTrick` action / auto-gift; `dragonGiftedTo` transition |
| CP14 | Dog plays | `playCards` Dog branch; `lastDogPlay` transition |
| CP15 | Bomb inventory | After pass resolution; scan with `detectAllBombs()`; evolution at first8/prePass/postPass |
| CP16 | Bomb events | Erosion on each play; play events on `combination.isBomb`; followedByDog on Dog; fate at round end |
| CP17 | Bot actions | Capture all bot plays (same pipeline as human) |
| CP18 | Chat counters | Increment on each chat event |

### Storage Requirements (REQ-F-ST01–ST06)

| ID | What |
|----|------|
| ST01 | In-memory accumulation (~80 KB/game) |
| ST02 | Recovery file (JSON) serialized at each round end |
| ST03 | Batch write: single transaction at game end for all layers |
| ST04 | Delete recovery file on successful write |
| ST05 | Server restart: detect + replay recovery files |
| ST06 | Game abandonment: write partial data, clean up recovery file |

### Cache Requirements (REQ-F-MC01–MC05)

| ID | What |
|----|------|
| MC01 | V1 cache table covering stats the current UI displays |
| MC02 | Full rebuild from raw event data via script |
| MC03 | Incremental update after each game |
| MC04 | Retroactive stat addition: new stats computed over all historical data on rebuild |
| MC05 | Cache is disposable — can be dropped + redesigned without data loss |

### Migration Requirements (REQ-F-MG01–MG06)

| ID | What |
|----|------|
| MG01 | Keep + extend `games` table (no changes) |
| MG02 | Keep + extend `game_rounds` (+scoreNSAtStart, scoreEWAtStart, startedAt) |
| MG03 | Replace `round_player_events` JSON blobs → structured `player_rounds` |
| MG04 | Replace `player_stats` (96 columns) → materialized cache |
| MG05 | Replace `player_relational_stats` → computed from raw data |
| MG06 | Fresh start for historical data (old blobs lack trick-level granularity) |

### Non-Functional Requirements (REQ-NF01–NF06)

| ID | What | Acceptance Criteria |
|----|------|---------------------|
| NF01 | Memory: in-game overhead ≤150 KB per active game | Measure with 8-round game |
| NF02 | Write latency: batch write ≤500ms for typical game | Benchmark with 8-round, 4-player game |
| NF03 | Recovery file size ≤200 KB | Measure after 8 rounds |
| NF04 | Cache rebuild: full rebuild ≤10s for 1000 games | Benchmark |
| NF05 | No gameplay impact: capture logic must not add perceptible latency to play actions | Existing auto-pass timing (500ms) is the floor |
| NF06 | Backward compatibility: existing game flow, WebSocket protocol, and client behavior unchanged | All existing tests pass |

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| EventTracker complexity explosion | Medium | High | Incremental milestone delivery; each data layer tested independently |
| Pre-play enrichment adds latency | Low | Medium | Computation is cheap (legal play enumeration already happens in validation); benchmark early |
| Recovery file corruption | Low | High | Validate JSON on read; log and discard corrupt files gracefully |
| Schema design locks in wrong structure | Medium | Medium | Raw events are the source of truth; cache + views can be redesigned freely |
| Large transaction at game end | Low | Low | ~80 KB across ~400 rows is well within SQLite's comfort zone |
| Bomb lifecycle complexity | Medium | Medium | Two-level model is well-specified; implement Level 1 first, then Level 2 |

---

## Implementation Approach

### Milestone 0: Spec Serialization
Serialize the full specification (all requirements with acceptance criteria) to `specifications/2026-04-09-statistics-system-redesign.md` + RTM file.

### Milestone 1: Database Schema (New Tables)
Create all new table definitions and extend existing tables.

**Files to modify:**
- [schema.ts](code/packages/server/src/db/schema.ts) — Add Drizzle ORM definitions for all new tables
- [connection.ts](code/packages/server/src/db/connection.ts) — Add `CREATE TABLE IF NOT EXISTS` for new tables; `ALTER TABLE` for game_rounds extensions

**New tables:** `player_rounds`, `tricks`, `plays`, `wish_events`, `dragon_gift_events`, `dog_play_events`, `bomb_inventory`, `bomb_events`

**Extended tables:** `game_rounds` (+3 columns)

**Verification:** Server starts without errors; tables exist in SQLite; schema matches spec.

### Milestone 2: Enhanced Event Tracker — Data Structures
Define new TypeScript interfaces for all data layers (replacing `RoundEventSummary` blob approach) and the in-memory accumulation structures.

**Files to modify:**
- [round-event-types.ts](code/packages/server/src/game/round-event-types.ts) — New interfaces: `PlayerRoundRecord`, `TrickRecord`, `PlayRecord`, `WishEvent`, `DragonGiftEvent`, `DogPlayEvent`, `BombInventoryRecord`, `BombEventRecord`, `GameEventAccumulator`

**New file:** `code/packages/server/src/game/pre-play-context.ts` — `PrePlayContext` interface + computation helpers

**Verification:** TypeScript compiles; interfaces match spec field lists.

### Milestone 3: Enhanced Event Tracker — Capture Logic
Rewrite `RoundEventTracker` to capture all 7 data layers using the hybrid architecture.

**Files to modify:**
- [round-event-tracker.ts](code/packages/server/src/game/round-event-tracker.ts) — Major rewrite: new `recordPrePlayContext()` method, enhanced `onStateChange()` to populate all data layers, new `finalizeRound()` writing to accumulator
- [game-manager.ts](code/packages/server/src/game/game-manager.ts) — Add pre-play enrichment before `actor.send()`: compute legalPlayCount, playedMinimum, couldHaveGoneOut, actionSource, hand sizes, timing. Call `eventTracker.recordPrePlayContext(seat, prePlay)`
- [move-handler.ts](code/packages/server/src/game/move-handler.ts) — Pass turn timing info; coordinate with pre-play enrichment

**Existing code to reuse:**
- `getValidPlays()` from [rules.ts](code/packages/shared/src/engine/rules.ts) — for legalPlayCount
- `detectAllBombs()` from [combination-detector.ts](code/packages/shared/src/engine/combination-detector.ts) — for bomb inventory
- Existing state-diff pattern in `onStateChange()` — extend, don't replace
- Existing phase transition detection — `captureInitialHands()`, `detectPhaseTransitions()`

**Verification:** Unit tests for each capture hook; play a full game and verify all data layers populated in memory.

### Milestone 4: Batch Write + Recovery
Implement the storage layer: batch transaction at game end, recovery file at round end, crash recovery on startup.

**Files to modify:**
- [game-persistence.ts](code/packages/server/src/db/game-persistence.ts) — New `saveGameEvents()` function: single transaction inserting all layers. Update `saveGameResult()` to call it. New `saveRecoveryFile()` / `loadRecoveryFiles()` / `deleteRecoveryFile()` functions
- [game-manager.ts](code/packages/server/src/game/game-manager.ts) — Call `saveRecoveryFile()` at round end; pass accumulated data to persistence at game end
- [connection.ts](code/packages/server/src/db/connection.ts) — Call `loadRecoveryFiles()` on startup
- [room-handler.ts](code/packages/server/src/room/room-handler.ts) — Update `savePassStatsBeforeDestroy()` to use new data structures for abandonment

**New directory:** `code/packages/server/data/recovery/` — recovery file storage

**Verification:** Play full game → verify all rows written to all tables. Kill server mid-game → restart → verify recovery file replayed. Abandon game → verify partial data written.

### Milestone 5: Materialized Cache (v1)
Design and implement the cache table covering current UI stats, plus rebuild mechanism.

**Files to modify:**
- [schema.ts](code/packages/server/src/db/schema.ts) — New cache table definition (v1: columns matching current UI needs)
- [connection.ts](code/packages/server/src/db/connection.ts) — Create cache table
- [game-persistence.ts](code/packages/server/src/db/game-persistence.ts) — Incremental cache update after each game write
- [queries.ts](code/packages/server/src/db/queries.ts) — Update `getLeaderboard()`, `getPlayerProfile()`, `getPlayerPartners()`, `getPlayerOpponents()` to read from new cache
- [stat-computations.ts](code/packages/server/src/db/stat-computations.ts) — Replace with cache rebuild logic (aggregate raw events → cache rows)

**Verification:** Play game → cache updated → UI shows correct stats. Run rebuild script → cache matches from-scratch computation.

### Milestone 6: Migration + Cleanup
Drop old tables, remove old code paths, verify end-to-end.

**Files to modify:**
- [schema.ts](code/packages/server/src/db/schema.ts) — Remove old `playerStats`, `playerRelationalStats`, `roundPlayerEvents` definitions
- [connection.ts](code/packages/server/src/db/connection.ts) — Drop old tables (or rename to `_legacy` temporarily)
- [game-persistence.ts](code/packages/server/src/db/game-persistence.ts) — Remove old `upsertGroupCStats()`, old `saveGameResult()` stat paths
- [stat-computations.ts](code/packages/server/src/db/stat-computations.ts) — Remove old `computeGameStats()`, `computeRoundStats()` (replaced by cache rebuild)

**Verification:** All existing tests pass. Play full game end-to-end. Verify no references to old tables remain. UI stats page works correctly.

---

## Critical Files

| File | Role | Milestones |
|------|------|------------|
| `code/packages/server/src/db/schema.ts` | Table definitions | 1, 5, 6 |
| `code/packages/server/src/db/connection.ts` | DB init, table creation | 1, 4, 5, 6 |
| `code/packages/server/src/db/game-persistence.ts` | Game result + event persistence | 4, 5, 6 |
| `code/packages/server/src/db/queries.ts` | Leaderboard/profile queries | 5 |
| `code/packages/server/src/db/stat-computations.ts` | Stat computation logic | 5, 6 |
| `code/packages/server/src/game/round-event-tracker.ts` | Event capture (major rewrite) | 2, 3 |
| `code/packages/server/src/game/round-event-types.ts` | Data structure interfaces | 2 |
| `code/packages/server/src/game/game-manager.ts` | Pre-play enrichment + orchestration | 3, 4 |
| `code/packages/server/src/game/move-handler.ts` | Turn timing coordination | 3 |
| `code/packages/server/src/game/game-state-machine.ts` | Read-only reference (state transitions) | 3 |
| `code/packages/shared/src/engine/rules.ts` | `getValidPlays()` — reuse for legalPlayCount | 3 |
| `code/packages/shared/src/engine/combination-detector.ts` | `detectAllBombs()` — reuse for bomb inventory | 3 |
| `code/packages/server/src/room/room-handler.ts` | Abandonment handling | 4 |

## Verification Strategy

### Per-Milestone Testing
- **M1:** Server starts; `PRAGMA table_info(plays)` etc. confirms schema
- **M2:** TypeScript compiles; interface field counts match spec
- **M3:** Unit tests per capture hook; integration test: play full game, inspect in-memory accumulator
- **M4:** Integration test: full game → verify DB rows; kill/restart → recovery; abandon → partial write
- **M5:** Integration test: game → cache update → query returns correct stats; rebuild → same result
- **M6:** All existing tests pass; no old table references; end-to-end game + UI verification

### End-to-End Acceptance
1. Play a complete 4-player game (with bots) through all phases
2. Verify all 8 table types have correct data
3. Verify materialized cache matches manual computation
4. Kill server mid-game, restart, verify recovery
5. Verify UI stats page displays correctly from new cache
6. Run `npm test` — all tests pass
