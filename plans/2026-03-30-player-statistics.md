# Player Statistics System — Implementation Plan

## Context

The Tichu game has a persistence layer (SQLite + Drizzle ORM) with `saveGameResult()` that inserts games/rounds and upserts player stats — but **this function is never called**. No game data is being saved. The spec requires ~35 stats across 4 groups, a new event tracker for mid-round card events, and a redesigned stats UI.

**Critical gap:** `GameManager` has no game-end callback, and `RoomHandler` has no database reference. The wiring must go through `app.ts` (which has both) or by injecting `database` into `RoomHandler`.

## Milestone Overview

| # | Name | Requirements | Estimated Files |
|---|------|-------------|-----------------|
| 1 | Schema + Persistence Wiring | REQ-F-PW01-04, REQ-F-DB01-04, REQ-NF-P02-P04 | 5 modified, 1 new |
| 2 | Group A/B Stat Computation | REQ-F-GA01-05, REQ-F-GB01-05, REQ-F-API01 | 4 modified, 1 new |
| 3 | RoundEventTracker + Group C Stats | REQ-F-GC01-10, REQ-F-EC01-04 | 3 modified, 2 new |
| 4 | Relational Stats + API | REQ-F-GD01-02, REQ-F-API02-03, REQ-NF-P01 | 3 modified |
| 5 | Stats UI | REQ-F-UI01-06 | 2 modified, 1 new |

---

## Milestone 1: Schema + Persistence Wiring

**Goal:** Extend the DB schema with all new columns/tables, wire `saveGameResult()` into the game lifecycle, and verify that completing a game creates DB records.

### Changes

#### 1a. Extend `playerStats` schema
**File:** [schema.ts](code/packages/server/src/db/schema.ts) (line 64-76)

Add ~35 new integer columns (all `.notNull().default(0)`):
- Group A: `gamesForfeited`, `gamesSpectated`, `largestWinDiff`, `largestLossDiff`, `oneTwoWins`, `oneTwoAgainst`
- Group B: `roundsWon`, `opponentTichuBroken`, `opponentGrandTichuBroken`, `partnerTichuBroken`, `partnerGrandTichuBroken`
- Group C: `roundsWithDragon`, `roundsWithDragonWon`, `roundsWithPhoenix`, `roundsWithPhoenixWon`, `dragonReceivedInPass`, `phoenixReceivedInPass`, `aceReceivedInPass`, `dragonTrickWins`, `dragonGivenAfterOpponentWin`, `dogReceivedInPass`, `dogGivenToPartner`, `dogGivenToOpponent`, `dogPlayedForTichuPartner`, `dogOpportunitiesForTichuPartner`, `handsWithBombs`, `totalBombs`, `fourCardBombs`, `fiveCardBombs`, `sixPlusCardBombs`, `bombsInFirst8`, `handsWithMultipleBombs`, `overBombed`, `bombForcedByWish`, `theTichuClean`, `theTichuDirty`

#### 1b. Add `playerRelationalStats` table
**File:** [schema.ts](code/packages/server/src/db/schema.ts) — new table after `playerStats`

```
playerRelationalStats: userId, otherUserId, relationship ('partner'|'opponent'), gamesPlayed, gamesWon
UNIQUE(userId, otherUserId, relationship)
```

#### 1c. Add `roundPlayerEvents` table
**File:** [schema.ts](code/packages/server/src/db/schema.ts) — new table

```
roundPlayerEvents: id, gameId (FK→games), roundNumber, userId (FK→users), seat, eventData (JSON)
```

#### 1d. Add `wireGameEndCallback` to GameManager
**File:** [game-manager.ts](code/packages/server/src/game/game-manager.ts)

Following the `wireKickCallback` (line 229) / `wireVoteCallback` (line 248) pattern:
- Add callback field: `private onGameEnd?: (context: GameMachineContext) => void`
- Add `wireGameEndCallback(cb)` method
- In `onStateChange()` (line 449): detect `gameOver` state (after the `roundScoring` block at line 468), call `this.onGameEnd?.(this.context)`
- **Important:** Call AFTER broadcasting state so clients see game-over before persistence runs (REQ-NF-P02)

#### 1e. Wire callback in RoomHandler + inject Database
**File:** [room-handler.ts](code/packages/server/src/room/room-handler.ts)

- Add `private database: Database | null` to constructor (line 30-40)
- In `startGameInternal()` (line 596), after wiring vote callback (line 647):
  ```typescript
  if (this.database) {
    game.wireGameEndCallback((context) => {
      // Build GameResult + RoundResult[] from context
      // Call saveGameResult(this.database!, gameResult, rounds)
    });
  }
  ```
- Extract player userId mapping from `roomManager.getUserIdAtSeat()` for each seat

**File:** [app.ts](code/packages/server/src/app.ts) — pass `database` to `RoomHandler` constructor

#### 1f. Ensure schema sync on startup
**File:** [connection.ts](code/packages/server/src/db/connection.ts)

The `createDatabase()` already runs `db.run(sql\`CREATE TABLE IF NOT EXISTS...\`)` or uses Drizzle push. Verify the new columns/tables are created. If using manual CREATE TABLE, add ALTER TABLE statements or re-create with new schema.

### Testing Strategy
- **New test file:** `code/packages/server/tests/db/schema-extended.test.ts`
  - Verify all new columns exist with correct defaults
  - Verify new tables can be inserted into
- **Update:** `code/packages/server/tests/db/game-persistence.test.ts`
  - Verify `saveGameResult()` still works with existing columns
- **New test:** `code/packages/server/tests/game/game-end-callback.test.ts`
  - Verify `wireGameEndCallback` fires when game reaches `gameOver`
  - Verify callback receives correct `GameMachineContext`

### Requirements Covered
REQ-F-PW01, REQ-F-PW02, REQ-F-DB01, REQ-F-DB02, REQ-F-DB03, REQ-F-DB04, REQ-NF-P02, REQ-NF-P04

---

## Milestone 2: Group A/B Stat Computation

**Goal:** Compute all game-level and round-level stats from `GameMachineContext` and persist them via the extended `upsertPlayerStats()`.

### Changes

#### 2a. Create stat computation module
**New file:** `code/packages/server/src/db/stat-computations.ts`

Pure functions that take `GameMachineContext` + seat info and return stat increments:

```typescript
computeGameStats(context, seat, isWinner): GroupAIncrements
computeRoundStats(roundHistory, seat, partnerSeat): GroupBIncrements
```

- **Group A:** `gamesPlayed` (always 1), `gamesWon`, `largestWinDiff`/`largestLossDiff` (from `context.scores`), `oneTwoWins`/`oneTwoAgainst` (from `roundHistory[].oneTwoBonus`)
- **Group B:** `totalRoundsPlayed`, `roundsWon` (team scored more), `tichuCalls`/`Successes` (already implemented — keep), `grandTichuCalls`/`Successes` (keep), `opponentTichuBroken`/`opponentGrandTichuBroken` (when opponent called and `tichuResults[opponentSeat].won === false`), `partnerTichuBroken`/`partnerGrandTichuBroken` (partner called and YOU are `finishOrder[0]`)

Helper: `getTeamForSeat(seat)`, `getPartnerSeat(seat)`, `getOpponentSeats(seat)` — check if these exist in shared, reuse if so.

#### 2b. Extend upsertPlayerStats
**File:** [game-persistence.ts](code/packages/server/src/db/game-persistence.ts) (lines 127-170)

- Expand `increments` interface to include all Group A/B fields
- Update raw SQL `INSERT ... ON CONFLICT` to include new columns
- `largestWinDiff`/`largestLossDiff` use `MAX(existing, new)` not `+= increment`
- Update `saveGameResult()` (lines 89-121) to call `computeGameStats()` and `computeRoundStats()` instead of inline tichu counting

#### 2c. Extend profile API response
**File:** [queries.ts](code/packages/server/src/db/queries.ts) — `getPlayerProfile()` (line 98)

Add all new Group A/B columns to the SELECT.

**File:** [auth-routes.ts](code/packages/server/src/auth/auth-routes.ts) — no route changes, just returns more data

### Testing Strategy
- **New test file:** `code/packages/server/tests/db/stat-computations.test.ts`
  - Unit test each computation function with known game contexts
  - Test edge cases: 0 rounds, ties, all 4 tichu calls in one round
- **Update:** `code/packages/server/tests/db/game-persistence.test.ts`
  - Verify all Group A/B stats are persisted correctly after a game

### Requirements Covered
REQ-F-GA01-05, REQ-F-GB01-05, REQ-F-PW03 (forfeit tracking logic), REQ-F-API01

---

## Milestone 3: RoundEventTracker + Group C Stats

**Goal:** Create the state-diff observer that detects mid-round card events (bombs, Dragon tricks, Dog plays, pass contents, "The Tichu" straight) and persist them.

### Changes

#### 3a. Create RoundEventTracker
**New file:** `code/packages/server/src/game/round-event-tracker.ts`

```typescript
class RoundEventTracker {
  private seatSummaries: Map<Seat, RoundEventSummary>;
  private prevContext: GameMachineContext | null;

  // Called on every state transition (from GameManager.onStateChange)
  onStateChange(context: GameMachineContext): void;

  // Return accumulated summaries at round end
  getSummaries(): Map<Seat, RoundEventSummary>;

  // Reset for new round
  reset(): void;
}
```

**Detection logic (by comparing `prevContext` vs `context`):**

| Event | Detection |
|-------|-----------|
| **Initial hand (first 8)** | When `phase` enters `grandTichuDecision`: snapshot `players[seat].hand` (8 cards). Use `detectAllBombs()` from shared to check for bombs-in-first-8 |
| **Pass contents** | When `phase` transitions from `cardPassing` to `playing`: read `players[fromSeat].passedCards.to[targetSeat]` for all seat pairs. Check if passed card is Dragon/Phoenix/Dog/Ace |
| **Received in pass** | Read `players[otherSeat].passedCards.to[mySeat]` for each other seat |
| **Full 14-card hand** | After card exchange: snapshot hand, check for Dragon/Phoenix presence |
| **Bomb played** | `bombsPerTeam[team]` increased: scan `currentTrick.plays` for new bomb play, classify by size |
| **Over-bombed** | Current trick has 2+ bomb plays from different teams; the earlier bomber was over-bombed |
| **Dragon trick win** | Trick completes (plays reset), previous trick's winning card was Dragon |
| **Dragon gifted to opponent** | `dragonGiftedTo` set + recipient is on opposing team of Dragon player |
| **Dog played for Tichu partner** | `lastDogPlay` set + `toSeat`'s partner has tichu/grandTichu call |
| **Wish-forced bomb** | Bomb played + active wish + bomb contains wished rank |
| **"The Tichu" straight** | 13-card straight played (combination.cards.length === 13 && type === Straight) |
| **Dog given to partner/opponent** | From pass data: if passed card type is 'dog', check relationship |

#### 3b. Integrate into GameManager
**File:** [game-manager.ts](code/packages/server/src/game/game-manager.ts)

- Add `private eventTracker: RoundEventTracker` field
- In `onStateChange()`: call `this.eventTracker.onStateChange(this.context)` before other logic
- In `wireGameEndCallback`: pass event summaries along with context

#### 3c. Extend persistence for Group C
**File:** [game-persistence.ts](code/packages/server/src/db/game-persistence.ts)

- Add `RoundEventSummary[]` parameter to `saveGameResult()`
- Insert `roundPlayerEvents` rows (one per human player per round)
- Add Group C increments to `upsertPlayerStats()`

#### 3d. Add shared types
**New file:** `code/packages/server/src/game/round-event-types.ts`

```typescript
interface RoundEventSummary {
  // Per-player per-round event accumulator
  bombsPlayed: number;
  fourCardBombs: number;
  fiveCardBombs: number;
  sixPlusCardBombs: number;
  overBombed: number;
  bombForcedByWish: number;
  dragonTrickWins: number;
  dragonGivenAfterOpponentWin: number;
  dogPlayedForTichuPartner: number;
  dogOpportunitiesForTichuPartner: number;
  theTichuClean: number;
  theTichuDirty: number;
  hadDragon: boolean;
  hadPhoenix: boolean;
  bombsInFirst8: number;
  // Pass tracking stored separately per round
  dragonReceivedInPass: boolean;
  phoenixReceivedInPass: boolean;
  aceReceivedInPass: boolean;
  dogReceivedInPass: boolean;
  dogGivenToPartner: boolean;
  dogGivenToOpponent: boolean;
}
```

### Testing Strategy
- **New test file:** `code/packages/server/tests/game/round-event-tracker.test.ts`
  - Test each detection scenario with mock state transitions
  - Test pass card detection with known passedCards data
  - Test bomb classification by size
  - Test over-bomb detection
  - Test "The Tichu" straight detection
- Reuse `detectAllBombs()` from `code/packages/shared/src/engine/combination-detector.ts:523`
- Verify REQ-NF-P03: `game-state-machine.ts` has zero changes

### Requirements Covered
REQ-F-GC01-10, REQ-F-EC01-04, REQ-NF-P03

---

## Milestone 4: Relational Stats + API

**Goal:** Track per-partner and per-opponent win rates, add new API endpoints.

### Changes

#### 4a. Upsert relational stats in saveGameResult
**File:** [game-persistence.ts](code/packages/server/src/db/game-persistence.ts)

After upserting `playerStats`, for each pair of human players:
- Determine relationship (partner if same team, opponent if different team)
- Upsert into `playerRelationalStats` with `gamesPlayed += 1`, `gamesWon += won ? 1 : 0`

#### 4b. Add query functions
**File:** [queries.ts](code/packages/server/src/db/queries.ts)

- `getPlayerPartners(database, userId)` — JOIN `playerRelationalStats` with `users` WHERE `relationship = 'partner'`, ORDER BY `gamesPlayed DESC`
- `getPlayerOpponents(database, userId)` — same but `relationship = 'opponent'`

#### 4c. Add API endpoints
**File:** [auth-routes.ts](code/packages/server/src/auth/auth-routes.ts)

- `GET /api/players/:userId/partners` → calls `getPlayerPartners()`
- `GET /api/players/:userId/opponents` → calls `getPlayerOpponents()`

### Testing Strategy
- **Update:** `code/packages/server/tests/db/game-persistence.test.ts`
  - Verify relational stats upserted correctly for 2-player game (partner + opponent entries)
- **Update:** `code/packages/server/tests/auth/auth-routes.test.ts`
  - Test new endpoints return correct data shape

### Requirements Covered
REQ-F-GD01-02, REQ-F-API02-03, REQ-NF-P01

---

## Milestone 5: Stats UI

**Goal:** Create the `/stats` page with 4 tabs and add stats button to lobby.

### Changes

#### 5a. Create stats page
**New file:** `code/packages/client/src/app/stats/page.tsx`

Follow [profile/page.tsx](code/packages/client/src/app/profile/page.tsx) patterns:
- Fetch from `/api/players/:userId/profile`, `/partners`, `/opponents`, `/games`
- 4 tabs: Overview, Card Stats, Relationships, History
- **Overview:** Game record (W-L, win rate, diffs, forfeits), Round record, Tichu record, Special stats
- **Card Stats:** Dragon/Phoenix/Dog/Ace sections, Bomb section, Achievements
- **Relationships:** Partner table, Opponent table (name, games, wins, rate)
- **History:** Existing game history (moved from profile page)

#### 5b. Add stats button to lobby
**File:** [lobby/page.tsx](code/packages/client/src/app/lobby/page.tsx)

Add a "Stats" button in the header area (near player name, top-right), styled with `--color-gold-accent`. Links to `/stats`.

### Testing Strategy
- Manual verification: navigate to `/stats`, verify all tabs render
- Verify lobby button appears and navigates correctly

### Requirements Covered
REQ-F-UI01-06

---

## Key Files Reference

| File | Role |
|------|------|
| `code/packages/server/src/db/schema.ts` | Schema definitions (extend) |
| `code/packages/server/src/db/game-persistence.ts` | Save game + upsert stats (extend) |
| `code/packages/server/src/db/queries.ts` | Profile/leaderboard queries (extend) |
| `code/packages/server/src/game/game-manager.ts` | Game lifecycle, state changes (add callback + tracker) |
| `code/packages/server/src/room/room-handler.ts` | Room ops, game wiring (add DB, wire callback) |
| `code/packages/server/src/app.ts` | App bootstrap (pass DB to RoomHandler) |
| `code/packages/server/src/auth/auth-routes.ts` | API routes (add endpoints) |
| `code/packages/server/src/game/round-event-tracker.ts` | **NEW** — state-diff observer |
| `code/packages/server/src/game/round-event-types.ts` | **NEW** — event summary types |
| `code/packages/server/src/db/stat-computations.ts` | **NEW** — pure stat computation functions |
| `code/packages/client/src/app/stats/page.tsx` | **NEW** — stats page |
| `code/packages/shared/src/engine/combination-detector.ts` | Reuse `detectAllBombs()` (line 523) |

## Existing Functions to Reuse

- `detectAllBombs()` — `code/packages/shared/src/engine/combination-detector.ts:523` — bomb detection in first-8 cards
- `wireKickCallback()`/`wireVoteCallback()` patterns — `game-manager.ts:229-263` — callback wiring model
- `upsertPlayerStats()` — `game-persistence.ts:127-170` — extend, don't rewrite from scratch
- `getPlayerProfile()` — `queries.ts:98-126` — extend SELECT columns
- `StatCard` component — `profile/page.tsx:172-179` — reusable stat display component
- `passedCards.to` — `game-state-machine.ts:515-527` — pass data is available after exchange (not cleared)
- Team/seat helpers from shared: check for `getTeamForSeat`, `getPartnerSeat` in shared types

## Verification

1. Start server + client, play a game with bots to completion
2. Check SQLite DB: `games`, `gameRounds`, `playerStats`, `roundPlayerEvents` rows exist
3. Navigate to `/stats` — verify all tabs show real data
4. Play a game involving Dragon/bombs/passes — verify Group C stats increment
5. Play multiple games — verify relational stats accumulate
6. Run `pnpm test` in all packages — zero regressions
7. Run `pnpm build` — clean TypeScript compilation
