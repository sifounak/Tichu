# Player Statistics System — Specification

**Date:** 2026-03-30
**Type:** Feature
**Status:** Draft
**Confidence:** High

## 1. Goal

Implement a comprehensive player statistics tracking system that:
- Captures ~35 detailed stats per human player across 4 categories (game-level, round-level, card events, relational)
- Persists stats in SQLite via the existing Drizzle ORM layer
- Wires the existing but never-called `saveGameResult()` into the game lifecycle
- Displays stats in a redesigned tabbed profile page
- Tracks mid-round card events via a new state-diff observer in GameManager

**Why:** Players want performance history. The persistence layer is built but disconnected — this completes the data pipeline end-to-end.

## 2. Scope

### In Scope
- Extend `playerStats` schema with ~35 new stat columns
- New `playerRelationalStats` table for per-partner/per-opponent stats
- New `roundPlayerEvents` table for per-player per-round event audit trail
- `RoundEventTracker` class for mid-round event detection via state diffs
- Wire `saveGameResult()` into game lifecycle via callback pattern
- Extended profile API and new relational stat endpoints
- Redesigned profile page with 4 tabs (Overview, Card Stats, Relationships, History)
- Spectator count tracking (increment on entering spectator mode)

### Out of Scope
- Bot statistics (bots have no user accounts)
- Historical backfill of games played before this feature (no event data exists)
- Real-time live stats during gameplay
- Global achievement/badge system
- Stat reset functionality

## 3. Key Decisions

- **Bot stats:** Humans only
- **Forfeit definition:** Player disconnects and never reconnects before game ends (bot replacement still counts as forfeit for the disconnected player)
- **Spectated definition:** Any time a player enters spectator mode in a room
- **Database approach:** Wide `playerStats` table (~50 columns) — fast O(1) reads by PK, trivial for SQLite
- **Event capture:** State-diff observer in `GameManager.onStateChange()` rather than modifying XState machine actions

## 4. Functional Requirements

### 4.1 Persistence Wiring

**REQ-F-PW01: Game end callback**
Wire `saveGameResult()` into the game lifecycle. Add `wireGameEndCallback()` to `GameManager` (following existing `wireKickCallback`/`wireVoteCallback` patterns). Register the callback in `RoomHandler`/`GameHandler` where DB access is available.
*Acceptance:* After a game reaches `gameOver` state, a row exists in `games`, `gameRounds`, and `playerStats` tables.

**REQ-F-PW02: Human-only persistence**
Only persist stats for human players (those with a userId in `ConnectionManager`). Skip bot seats.
*Acceptance:* Bot seats produce no `playerStats` or `roundPlayerEvents` rows.

**REQ-F-PW03: Forfeit tracking**
Track forfeits as: player disconnects and never reconnects before game ends. A player replaced by a bot is still counted as having forfeited.
*Acceptance:* `gamesForfeited` increments for a player who disconnected and did not reconnect by game end.

**REQ-F-PW04: Spectator tracking**
Increment `gamesSpectated` when a player enters spectator mode in any room.
*Acceptance:* Entering spectator mode increments the counter regardless of whether a game starts or finishes.

### 4.2 Group A: Game-Level Stats

**REQ-F-GA01: Games played and win rate**
Track `gamesPlayed`, `gamesWon`, and computed `winRate` (gamesWon / gamesPlayed).
*Acceptance:* Values increment correctly after each completed game. winRate recalculated on each upsert.

**REQ-F-GA02: Largest win/loss score difference**
Track `largestWinDiff` and `largestLossDiff` as the maximum absolute score difference in games the player won/lost respectively.
*Acceptance:* Updated via MAX comparison: `largestWinDiff = MAX(existing, |finalScoreNS - finalScoreEW|)` when player's team won.

**REQ-F-GA03: Games forfeited and forfeit rate**
Track `gamesForfeited`. Forfeit rate = gamesForfeited / gamesPlayed.
*Acceptance:* Per REQ-F-PW03 definition. Rate computed on read (not stored).

**REQ-F-GA04: Games spectated**
Track `gamesSpectated` count.
*Acceptance:* Per REQ-F-PW04 definition.

**REQ-F-GA05: 1-2 finish wins and against**
Track `oneTwoWins` (player's team went out 1st and 2nd) and `oneTwoAgainst` (opponents went out 1st and 2nd).
*Acceptance:* Computed from `RoundScore.oneTwoBonus` across all rounds in the game.

### 4.3 Group B: Round-Level Stats

**REQ-F-GB01: Rounds played and won**
Track `totalRoundsPlayed` and `roundsWon` (player's team scored more points that round).
*Acceptance:* `roundsWon` increments when `roundScore.total[myTeam] > roundScore.total[otherTeam]`.

**REQ-F-GB02: Tichu calls and successes**
Track `tichuCalls`, `tichuSuccesses`, `grandTichuCalls`, `grandTichuSuccesses`.
*Acceptance:* Already partially implemented. Verify correct increment from `RoundScore.tichuResults`.

**REQ-F-GB03: Opponent Tichu/Grand Tichu broken**
Track `opponentTichuBroken` and `opponentGrandTichuBroken`. An opponent's Tichu is "broken" when they called Tichu/GT but their team did NOT have the first-out player.
*Acceptance:* Increments when an opponent called Tichu/GT and `tichuResults[opponentSeat].won === false`.

**REQ-F-GB04: Partner Tichu/Grand Tichu broken**
Track `partnerTichuBroken` and `partnerGrandTichuBroken`. Your partner's call is "broken by you" when they called Tichu/GT and YOU went out first (you are finishOrder[0]).
*Acceptance:* Increments when partner called Tichu/GT AND `finishOrder[0] === mySeat`.

**REQ-F-GB05: Hands (rounds) won**
Same as `roundsWon` in REQ-F-GB01 (a "hand" = a "round" in Tichu).
*Note:* This is the same stat as REQ-F-GB01.roundsWon. No separate column needed.

### 4.4 Group C: Card Event Stats

**REQ-F-GC01: Rounds with Dragon / Phoenix**
Track `roundsWithDragon`, `roundsWithDragonWon`, `roundsWithPhoenix`, `roundsWithPhoenixWon`.
*Acceptance:* Determined by checking the player's full 14-card hand (after pass exchange). "Won" means their team won the round.

**REQ-F-GC02: Special cards received in pass**
Track `dragonReceivedInPass`, `phoenixReceivedInPass`, `aceReceivedInPass`, `dogReceivedInPass`.
*Acceptance:* Determined by diffing player's hand before and after card exchange. Cards in post-pass hand that were not in pre-pass hand are received cards.

**REQ-F-GC03: Dragon trick wins**
Track `dragonTrickWins` — number of times the player won a trick because they played the Dragon as the highest single.
*Acceptance:* Detected when a trick completes and the winning play is a Dragon single played by this player.

**REQ-F-GC04: Dragon given after opponent's Dragon victory**
Track `dragonGivenAfterOpponentWin` — times you received the Dragon trick cards after an opponent won with Dragon and gifted to you.
*Acceptance:* Detected when `dragonGiftPending` resolves and the gift recipient is on the opposing team of the Dragon player.

**REQ-F-GC05: Dog pass tracking**
Track `dogGivenToPartner` and `dogGivenToOpponent` during the card pass phase.
*Acceptance:* Determined from `passedCards.to` — check if any passed card is a Dog and whether the recipient is partner or opponent.

**REQ-F-GC06: Dog played for Tichu partner**
Track `dogPlayedForTichuPartner` (times you played the Dog to give control to partner when they had called Tichu or Grand Tichu) and `dogOpportunitiesForTichuPartner` (times you had the Dog and partner had called).
*Acceptance:* Detected via `lastDogPlay` state change when partner's `tichuCall !== 'none'`. Opportunities tracked by checking hand for Dog when partner calls.

**REQ-F-GC07: Bomb statistics**
Track: `handsWithBombs`, `totalBombs`, `fourCardBombs`, `fiveCardBombs`, `sixPlusCardBombs`, `bombsInFirst8`, `handsWithMultipleBombs`.
*Acceptance:*
- `handsWithBombs`: rounds where player played at least one bomb
- `totalBombs`: cumulative bombs played (includes multiple per round)
- Size breakdown: determined from bomb combination length (4=four, 5=five, 6+=sixPlus)
- `bombsInFirst8`: rounds where player's first 8 cards contained a bomb combination (using `detectAllBombs()`)
- `handsWithMultipleBombs`: rounds where player played 2+ bombs

**REQ-F-GC08: Over-bombed**
Track `overBombed` — times an opponent played a bomb that beat your bomb in the same trick.
*Acceptance:* Detected when a trick has two consecutive bomb plays from different teams, and the second one wins.

**REQ-F-GC09: Bomb forced by wish**
Track `bombForcedByWish` — times you played a bomb because it was the only valid play satisfying the active Mahjong wish.
*Acceptance:* Detected when a bomb is played, an active wish exists, and the bomb contains the wished rank.

**REQ-F-GC10: "The Tichu" straight**
Track `theTichuClean` (1-through-Ace straight without Phoenix) and `theTichuDirty` (1-through-Ace straight with Phoenix substituting).
*Acceptance:* Detected when a 13-card straight is played spanning ranks 1 through Ace. Clean = no Phoenix in the combination. Dirty = Phoenix used as a substitute.

### 4.5 Group D: Relational Stats

**REQ-F-GD01: Partner stats**
Track per-partner: `gamesPlayed` and `gamesWon` for each unique human partner.
*Acceptance:* Stored in `playerRelationalStats` with `relationship = 'partner'`. Win rate computed on read.

**REQ-F-GD02: Opponent stats**
Track per-opponent: `gamesPlayed` and `gamesWon` for each unique human opponent.
*Acceptance:* Stored in `playerRelationalStats` with `relationship = 'opponent'`. Win rate computed on read.

### 4.6 Event Capture System

**REQ-F-EC01: RoundEventTracker class**
Create a `RoundEventTracker` that accumulates per-player events during a round by observing state transitions in `GameManager.onStateChange()`.
*Acceptance:* Tracker detects all Group C events without modifying XState machine actions.

**REQ-F-EC02: State-diff detection**
Detect events by comparing previous and current `RoundState` snapshots on each state transition.
*Acceptance:* Correctly identifies: bomb plays (+ size), over-bombs, Dragon trick wins, Dragon gifts, Dog plays for Tichu partner, wish-forced bombs, "The Tichu" straight.

**REQ-F-EC03: Hand snapshots for pass tracking**
Snapshot each player's hand at grandTichuDecision (first 8) and after card exchange (full 14) to compute received cards and bombs-in-first-8.
*Acceptance:* Hand diffs correctly identify received cards; `detectAllBombs()` correctly identifies bombs in first 8.

**REQ-F-EC04: Round event persistence**
Persist per-player round event summaries as JSON in `roundPlayerEvents` table.
*Acceptance:* One row per human player per round, with structured JSON containing all event flags/counts.

### 4.7 Database Schema

**REQ-F-DB01: Extended playerStats table**
Add ~35 new integer columns to `playerStats` (all DEFAULT 0). Existing columns unchanged.
*Acceptance:* Schema compiles, migrations apply cleanly, existing data preserved.

**REQ-F-DB02: playerRelationalStats table**
New table with `(userId, otherUserId, relationship)` unique constraint. Columns: gamesPlayed, gamesWon.
*Acceptance:* Supports upsert via INSERT ON CONFLICT.

**REQ-F-DB03: roundPlayerEvents table**
New table for per-player per-round event audit trail. JSON `eventData` column.
*Acceptance:* Indexed on (gameId, roundNumber) and (userId).

**REQ-F-DB04: Atomic stat updates**
All stat updates for a game (games, gameRounds, roundPlayerEvents, playerStats, playerRelationalStats) happen in a single SQLite transaction.
*Acceptance:* If any insert fails, no data is persisted.

### 4.8 API

**REQ-F-API01: Extended profile endpoint**
`GET /api/players/:userId/profile` returns all stats grouped into `gameStats`, `roundStats`, `cardStats` sections.
*Acceptance:* Returns all ~50 stat fields with correct grouping.

**REQ-F-API02: Partner stats endpoint**
`GET /api/players/:userId/partners` returns top partners by games played, with win rates.
*Acceptance:* Returns array of `{userId, displayName, gamesPlayed, gamesWon, winRate}`.

**REQ-F-API03: Opponent stats endpoint**
`GET /api/players/:userId/opponents` returns top opponents by games played, with win rates.
*Acceptance:* Same shape as REQ-F-API02.

### 4.9 UI

**REQ-F-UI01: Stats button in lobby**
Add a button in the top-right corner of the lobby page that navigates to the player's stats page.
*Acceptance:* Button visible on lobby page (top-right of header area). Clicking navigates to `/stats`. Button styled consistently with lobby theme (gold accent).

**REQ-F-UI02: Dedicated stats page**
New page at `/stats` displaying all statistics for the current player, organized with tabs: Overview, Card Stats, Relationships, History.
*Acceptance:* Page loads current player's stats. Tabs switch content (client-side state). Back navigation returns to lobby.

**REQ-F-UI03: Overview tab**
Display game record (W-L, win rate, largest win/loss diff, forfeits), round record (played, won, win rate), Tichu record (calls/successes/rates for both types), and special stats (1-2 wins, opponent 1-2s, first finishes).
*Acceptance:* All Group A and B stats displayed with appropriate labels and formatting.

**REQ-F-UI04: Card Stats tab**
Display Dragon, Phoenix, Dog, Ace sections with pass/play stats. Bomb section with all bomb stats. Achievement section with "The Tichu" counts.
*Acceptance:* All Group C stats displayed in organized sections.

**REQ-F-UI05: Relationships tab**
Two tables: Partners and Opponents. Each shows name, games together, wins, win rate. Sorted by games played descending.
*Acceptance:* Tables populated from REQ-F-API02 and REQ-F-API03 endpoints.

**REQ-F-UI06: History tab**
Existing game history table, moved to a tab.
*Acceptance:* Same functionality as current profile page game history.

## 5. Non-Functional Requirements

**REQ-NF-P01: Profile page load time**
Profile page stats load in < 200ms for users with up to 10,000 games.
*Acceptance:* Wide table single-row lookup by PK.

**REQ-NF-P02: Game end persistence latency**
`saveGameResult()` completes in < 100ms and does not block the game-over broadcast.
*Acceptance:* Transaction time measured, called after broadcast.

**REQ-NF-P03: No game engine modification**
Event tracking must not modify XState state machine actions or guards. Observer pattern only.
*Acceptance:* `game-state-machine.ts` has zero changes.

**REQ-NF-P04: Backward compatibility**
Existing `games`, `gameRounds`, and `users` table data is preserved. New columns have DEFAULT values.
*Acceptance:* Existing DB file works after schema update without data loss.

## 6. Assumptions

1. The SQLite migration (PG -> SQLite) is complete and stable (confirmed by recent commits)
2. `saveGameResult()` logic for games/gameRounds insertion is correct — only the calling is missing
3. `detectAllBombs()` from shared engine correctly identifies all bomb combinations in a hand
4. The game always reaches `gameOver` state for completed games (no silent termination)
5. Spectator mode entry is detectable at the `RoomHandler` level

## 7. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| State-diff observer misses events in rapid transitions | Low | Medium | Comprehensive test suite for each event type; observer runs synchronously in `onStateChange` |
| Schema migration breaks existing DB | Low | High | New columns all have DEFAULT 0; test with existing DB file |
| Performance impact of cloning RoundState for diffs | Low | Low | RoundState is ~10KB; structuredClone is fast; already done in XState |
| `passedCards.received` is boolean, not card list | Known | Medium | Use hand-diff approach (post-pass hand minus pre-pass hand) |
| Over-bombed detection edge case: 3+ bombs in one trick | Low | Low | Track consecutive bomb pairs; count each victim separately |

## 8. Success Metrics

1. **All 35 stats tracked correctly** — verified by playing test games and checking DB values
2. **Profile page displays all stats** — all 4 tabs render with real data
3. **Zero regression** — existing tests pass, game flow unaffected
4. **Persistence wired end-to-end** — every completed game produces DB records
5. **Statement coverage >= 80%** for new code
