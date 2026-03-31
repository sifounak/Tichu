# Stats Page Overhaul — Specification

**Date:** 2026-03-31
**Type:** Feature Enhancement
**Status:** Draft
**Confidence:** High
**Extends:** `2026-03-30-player-statistics-system.md`

## 1. Goal

Overhaul the `/stats` page to provide richer, better-organized player statistics:
- Restructure Overview sections with new/reframed stats and 4-column grids
- Wire up the Card Stats tab with lifetime Group C statistics (already tracked in DB)
- Redesign the History tab as a proper table with player-relative data
- Add new tracked stats: tie-break games, last-place finishes, Tichu broken by partner, spectator-to-player transitions
- Fix `firstFinishes` to count ALL 1st-place finishes (not just Tichu callers)

**Why:** The current stats page has placeholder sections, missing stats, and a History tab that doesn't show player-relative information. Players want to see rich lifetime data including card stats, and the History tab needs to show win/loss from their perspective.

## 2. Scope

### In Scope
- UI restructuring: 4-column grids, restructured Overview (3 sections, remove Special), Card Stats tab, History table
- New DB columns: `lastFinishes`, `tichuBrokenByPartner`, `grandTichuBrokenByPartner`, `gamesRequiringTieBreak`, `mostTieBreakRoundsNeeded`, `gamesJoinedAfterSpectating`
- Add `finishOrder` to `RoundScore` type (enables accurate finish tracking)
- Expose Group C card event stats via profile API
- Enrich game history API with userId columns and per-game Tichu summaries
- Spectator-to-player transition tracking in room handler
- Display "-" instead of "N/A" for stats without values

### Out of Scope
- New card event detection logic (Group C tracking already implemented in RoundEventTracker)
- Changes to Relationships tab
- Leaderboard changes
- In-game stats display
- Historical backfill of new stats for past games

## 3. Key Decisions

- **Derived stats computed client-side:** Games Lost, Rounds Lost, Tichu Failed, GT Failed, all rates — no new DB columns needed
- **`finishOrder` in `RoundScore`:** Already passed to `scoreRound()` but not included in output; adding it enables `firstFinishes`, `lastFinishes`, and `tichuBrokenByPartner` without modifying the game engine
- **Tie-break definition:** A game requires tie-break when both teams reach/exceed target score in the same round, requiring additional rounds to determine a winner
- **History Tichu aggregation:** Server-side JOIN with `game_rounds` to avoid N+1 queries
- **Spectator tracking:** Mark userId in GameManager when spectator claims a seat mid-game; increment stat at game end

## 4. Functional Requirements

### 4.1 Shared Types

**REQ-F-SO01: Add finishOrder to RoundScore**
Add `finishOrder: Seat[]` to the `RoundScore` interface in `shared/src/types/game.ts` and include it in the return value of `scoreRound()` in `shared/src/engine/scoring.ts`.
*Acceptance:* `scoreRound()` returns an object with `finishOrder` matching the input parameter. All existing tests still pass.

### 4.2 New Database Columns

**REQ-F-SO02: lastFinishes column**
Add `lastFinishes` (INTEGER NOT NULL DEFAULT 0) to `playerStats` table. Counts rounds where the player finished 4th (last).
*Acceptance:* Column exists with default 0. Existing rows unaffected.

**REQ-F-SO03: tichuBrokenByPartner columns**
Add `tichuBrokenByPartner` and `grandTichuBrokenByPartner` (INTEGER NOT NULL DEFAULT 0) to `playerStats`. Tracks when the player called Tichu/GT and their partner went out first, breaking their call.
*Acceptance:* Columns exist with default 0. Distinct from existing `partnerTichuBroken` (which tracks the inverse).

**REQ-F-SO04: Tie-break tracking columns**
Add `gamesRequiringTieBreak` (INTEGER NOT NULL DEFAULT 0) and `mostTieBreakRoundsNeeded` (INTEGER NOT NULL DEFAULT 0, uses MAX) to `playerStats`.
*Acceptance:* Columns exist. `gamesRequiringTieBreak` increments for tie-break games. `mostTieBreakRoundsNeeded` stores the MAX extra rounds.

**REQ-F-SO05: gamesJoinedAfterSpectating column**
Add `gamesJoinedAfterSpectating` (INTEGER NOT NULL DEFAULT 0) to `playerStats`. Increments when a spectator is promoted to a player seat during an active game.
*Acceptance:* Column exists. Increments only when spectator→player transition occurs mid-game.

**REQ-F-SO06: Database migration**
Add ALTER TABLE migration in `connection.ts` for all new columns, following the existing migration pattern.
*Acceptance:* Server starts without errors. New columns have correct defaults. Existing data preserved.

### 4.3 Stat Computation

**REQ-F-SO07: Fix firstFinishes to count all 1st-place finishes**
Modify `computeRoundStats()` to count `firstFinishes` as rounds where `finishOrder[0] === seat`, regardless of whether a Tichu/GT call was made.
*Acceptance:* A player who finishes 1st without calling Tichu now gets `firstFinishes` incremented.

**REQ-F-SO08: Compute lastFinishes**
In `computeRoundStats()`, count rounds where `finishOrder[3] === seat` (player finished last).
*Acceptance:* `lastFinishes` correctly counts 4th-place finishes across all rounds.

**REQ-F-SO09: Compute tichuBrokenByPartner**
In `computeRoundStats()`, detect when: player called Tichu/GT, lost (`!myResult.won`), AND partner finished 1st (`finishOrder[0] === partner`).
*Acceptance:* `tichuBrokenByPartner` increments only when partner's 1st-place finish caused the player's Tichu failure.

**REQ-F-SO10: Compute tie-break stats**
In `computeGameStats()`, accept `targetScore` parameter. Iterate cumulative round scores. If both teams reach/exceed `targetScore` in the same round and the game has additional rounds, mark as tie-break. Count extra rounds.
*Acceptance:* `gamesRequiringTieBreak` = 1 when both teams hit target simultaneously. `mostTieBreakRoundsNeeded` = number of extra rounds played.

**REQ-F-SO11: Improve partnerTichuBroken with finishOrder**
Use `finishOrder[0] === seat` instead of the current proxy logic for detecting when the player broke their partner's Tichu call.
*Acceptance:* More accurate than the previous approximation based on `myResult?.won`.

### 4.4 Game Persistence

**REQ-F-SO12: Upsert new stat columns**
Update `upsertPlayerStats()` in `game-persistence.ts` to include all new columns in the INSERT/UPDATE SQL. Use `+=` for counters and `MAX()` for `mostTieBreakRoundsNeeded`.
*Acceptance:* New stats are persisted after each game. Existing stats unaffected.

**REQ-F-SO13: Pass targetScore to computeGameStats**
Pass `gameResult.targetScore` to `computeGameStats()` for tie-break detection.
*Acceptance:* `computeGameStats()` receives correct target score from game config.

**REQ-F-SO14: Track joinedAfterSpectating in persistence**
Accept a `joinedAfterSpectating` set in `saveGameResult()`. For each userId in the set, increment `gamesJoinedAfterSpectating`.
*Acceptance:* Players who were spectators before being seated get the stat incremented.

### 4.5 Spectator-to-Player Tracking

**REQ-F-SO15: GameManager joinedAfterSpectating tracking**
Add a `joinedAfterSpectating: Set<string>` field and `markJoinedAfterSpectating(userId)` method to `GameManager`. Include the set in `onGameEnd` callback data.
*Acceptance:* Set is populated when `handleSeatFilled()` is called for a spectator. Set is passed to persistence at game end.

**REQ-F-SO16: RoomHandler spectator promotion tracking**
In `room-handler.ts` `onSeatClaimed` callback, when a game is in progress, call `game.markJoinedAfterSpectating(userId)`.
*Acceptance:* Mid-game spectator promotions are tracked. Pre-game promotions are not.

### 4.6 API Expansion

**REQ-F-SO17: Expand PlayerProfile with Group C stats**
Add all Group C columns to the `PlayerProfile` interface and `getPlayerProfile()` SQL query in `queries.ts`.
*Acceptance:* `/api/players/:userId/profile` returns all ~25 Group C fields (dragon, phoenix, dog, bomb, achievement stats).

**REQ-F-SO18: Expand PlayerProfile with new stats**
Add `lastFinishes`, `tichuBrokenByPartner`, `grandTichuBrokenByPartner`, `gamesRequiringTieBreak`, `mostTieBreakRoundsNeeded`, `gamesJoinedAfterSpectating` to `PlayerProfile` and the SQL query.
*Acceptance:* All 6 new fields returned by profile endpoint.

**REQ-F-SO19: Enrich game history with userId columns**
Add `northUserId`, `eastUserId`, `southUserId`, `westUserId` to `getPlayerGameHistory()` SELECT.
*Acceptance:* Game history entries include seat userId fields so the client can determine player's team.

**REQ-F-SO20: Enrich game history with Tichu summaries**
Add per-game Tichu call aggregation to game history response. For each game, include team Tichu success/total and team GT success/total (aggregated from `game_rounds` via JOIN or subquery).
*Acceptance:* Each history entry includes `teamTichuSuccess`, `teamTichuTotal`, `teamGTSuccess`, `teamGTTotal` relative to the querying player's team.

### 4.7 Client UI — Overview Tab

**REQ-F-SO21: 4-column grid layout**
Change all Overview section grids from `grid-cols-2 sm:grid-cols-3` to `grid-cols-2 sm:grid-cols-4`.
*Acceptance:* All sections display 4 columns on sm+ screens.

**REQ-F-SO22: Display "-" for missing values**
Change the `pct()` helper from returning `'N/A'` to `'-'` when the denominator is 0.
*Acceptance:* All percentage stats show "-" instead of "N/A" when no data exists.

**REQ-F-SO23: Game Record section (11 stats)**
Display: Games Played, Games Won, Games Lost (derived), Game Win Rate, Largest Win, Largest Loss, Games Requiring Tie Break, Most Tie Break Rounds Needed, Games Forfeited, Games Spectated, Games Joined After Spectating.
*Acceptance:* All 11 stats render correctly. Derived stats (Games Lost) computed client-side.

**REQ-F-SO24: Round Record section (12 stats)**
Display: Rounds Played, Rounds Won, Rounds Lost (derived), Round Win Rate, Finished 1st, Finished 1st Rate (derived), Finished Last, Finished Last Rate (derived), Finished 1-2, Finished 1-2 Rate (derived), Beaten by 1-2, Beaten by 1-2 Rate (derived).
*Acceptance:* All 12 stats render correctly. Rate stats use `pct()` helper.

**REQ-F-SO25: Tichu Record section (14 stats)**
Display: Tichu Calls, Tichu Success, Tichu Failed (derived), Tichu Success Rate, Grand Tichu Calls, Grand Tichu Success, Grand Tichu Failed (derived), Grand Tichu Success Rate, Tichu Calls Broken by Partner, GT Calls Broken by Partner, Partner Tichu Calls You Broke, Partner GT Calls You Broke, Opp. Tichu Calls Broken, Opp. GT Calls Broken.
*Acceptance:* All 14 stats render correctly. Failed stats derived as calls - successes.

**REQ-F-SO26: Remove Special section**
Remove the "Special" section entirely. All its stats are relocated: `gamesSpectated` → Game Record, `oneTwoWins`/`oneTwoAgainst` → Round Record, `partnerTichuBroken`/`partnerGrandTichuBroken` → Tichu Record.
*Acceptance:* No "Special" section in the UI. No stats lost.

### 4.8 Client UI — Card Stats Tab

**REQ-F-SO27: Card Stats tab with Group C data**
Replace the placeholder with sections displaying lifetime Group C stats in 4-column grids:
- **Dragon** (6 stats): Rounds with Dragon, Rounds Won with Dragon, Dragon Win Rate (derived), Dragon Trick Wins, Dragon Received in Pass, Dragon Given After Opp. Win
- **Phoenix** (4 stats): Rounds with Phoenix, Rounds Won with Phoenix, Phoenix Win Rate (derived), Phoenix Received in Pass
- **Dog** (5 stats): Dog Received in Pass, Dog Given to Partner, Dog Given to Opponent, Dog Played for Tichu Partner, Dog Opportunities for Tichu Partner
- **Bombs** (9 stats): Hands with Bombs, Total Bombs, 4-Card Bombs, 5-Card Bombs, 6+ Card Bombs, Bombs in First 8, Hands with Multiple Bombs, Over-Bombed, Bomb Forced by Wish
- **Achievements** (2 stats): The Tichu (Clean), The Tichu (Dirty)
*Acceptance:* Card Stats tab displays all 26 stats organized in 5 sections. Uses same StatCard and Section components.

### 4.9 Client UI — History Tab

**REQ-F-SO28: History tab table redesign**
Replace the current card-list layout with a table containing columns (in order): Date, Result (Win/Loss badge), Your Score, Opp Score, # Rounds, Team Tichu (success/total), Team Grand Tichu (success/total), Partner names, Opponent names.
*Acceptance:* History displays as a table. Result shows green "Win" or red "Loss" badge. Scores are relative to the player's team. Partner/opponent names derived from seat positions.

**REQ-F-SO29: Player team detection in History**
Determine the player's team by matching their userId against `northUserId`/`southUserId` (NS) or `eastUserId`/`westUserId` (EW). Use this to compute player-relative scores, win/loss, partner names, and opponent names.
*Acceptance:* All history data is relative to the player. Score shows player's team first.

## 5. Non-Functional Requirements

**REQ-NF-SO01: No game engine modification**
All changes must avoid modifying the XState game state machine. Only additive changes to `GameManager` and pure computation functions.
*Acceptance:* `game-state-machine.ts` has zero changes.

**REQ-NF-SO02: Backward compatibility**
All new DB columns use DEFAULT 0. Existing player data is preserved. No data migration required.
*Acceptance:* Server starts with existing DB. All existing stats unchanged.

**REQ-NF-SO03: Build passes**
`npm run build` passes for all packages (shared, server, client) after changes.
*Acceptance:* Zero build errors.

## 6. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `finishOrder` not always 4 elements (player disconnect) | Medium | Medium | Guard with `.length >= 4` check before accessing index 3 |
| Tie-break detection edge case (exact same score both teams) | Low | Low | Clear definition: both >= target AND game continued |
| History table too wide on mobile | Medium | Low | Horizontal scroll on mobile; prioritize key columns |
| Group C stats all zero (event tracking not fully wired) | Low | Medium | Verify `upsertGroupCStats` is called in `saveGameResult` |

## 7. Success Metrics

1. All 11 Game Record stats display correctly with sample data
2. All 12 Round Record stats display correctly
3. All 14 Tichu Record stats display correctly
4. Card Stats tab shows all 26 Group C stats organized in sections
5. History tab shows player-relative table with Tichu summaries
6. `npm run build` passes for all packages
7. All existing tests continue to pass
8. New stat computation tests pass (tie-break, lastFinishes, tichuBrokenByPartner, fixed firstFinishes)
