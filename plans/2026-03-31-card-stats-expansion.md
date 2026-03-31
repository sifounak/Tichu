# Card / Hand Stats Expansion — Implementation Plan

**Date:** 2026-03-31
**Spec:** `specifications/2026-03-31-card-stats-expansion.md`
**Branch:** `feature/stats-page-overhaul` (continuing existing branch)
**Parent:** `main`

## Context

The Card Stats tab currently shows basic lifetime card event stats (Dragon, Phoenix, Dog, Bombs, Pass Tracking, Achievements). Players want deeper analytics — Phoenix play types, Dog control outcomes, bomb size distribution, conflicting bombs, over-bomb direction, and comprehensive pass tracking. This is ~35 new DB columns, new detection logic in RoundEventTracker, and UI overhaul of the Card Stats tab.

## Milestones

### Milestone 1: Types + DB Schema + RoundEventSummary Fields
**Requirements:** REQ-F-CS04, CS08, CS11, CS14, CS17, CS21, REQ-NF-CS02

**Files to modify:**
- `code/packages/server/src/game/round-event-types.ts` — Add ~30 new fields to `RoundEventSummary` and `createBlankSummary()`
- `code/packages/server/src/db/schema.ts` — Add ~35 new columns to `playerStats` table
- `code/packages/server/src/db/connection.ts` — Add new columns to `newColumns` migration array
- `code/packages/server/src/db/queries.ts` — Add fields to `PlayerProfile` interface + SQL SELECT
- `code/packages/client/src/app/stats/page.tsx` — Add fields to client-side `PlayerProfile` type

**New RoundEventSummary fields:**

Phoenix play types (7): `phoenixUsedAsSingle`, `phoenixUsedForPair`, `phoenixUsedInTriple`, `phoenixUsedInFullHouse`, `phoenixUsedInConsecutivePairs`, `phoenixUsedInStraight`, `longestStraightWithPhoenix` (MAX)

Dog control (4): `dogControlToPartner`, `dogControlToOpponent`, `dogControlToSelf`, `dogStuckAsLastCard`

Bomb sizes (11): `bombSize4` through `bombSize14`

Conflicting bombs (1): `conflictingBombs`

Over-bomb direction (2): `youOverBombed`, `youWereOverBombed`

Extended pass tracking (7 new event booleans): `dragonGivenInPass`, `phoenixGivenInPass`, `aceGivenInPass`, `mahjongGivenInPass`, `mahjongReceivedInPass`, `bombGivenToPartnerInPass`, `bombGivenToOpponentInPass`

**New DB columns (11 per spec REQ-F-CS21 + others):**
- 7 phoenix play type columns
- 4 dog control columns
- 11 bomb size columns (bombSize4–bombSize14)
- 1 conflicting bombs
- 2 over-bomb direction (youOverBombed, youWereOverBombed)
- 11 pass tracking: `dragon_gave_in_pass`, `phoenix_gave_in_pass`, `ace_gave_in_pass`, `mahjong_gave_in_pass`, `mahjong_received_in_pass`, `dog_received_from_partner`, `dog_received_from_opponent`, `bomb_gave_to_partner`, `bomb_gave_to_opponent`, `bomb_received_from_partner`, `bomb_received_from_opponent`

Total: ~36 new columns

**Testing:** `npm run build` passes across all packages.

---

### Milestone 2: Detection Logic in RoundEventTracker
**Requirements:** REQ-F-CS03, CS06, CS07, CS10, CS13, CS16, CS19, CS20

**Files to modify:**
- `code/packages/server/src/game/round-event-tracker.ts` — New detection methods + expand existing ones
- `code/packages/server/tests/game/round-event-tracker.test.ts` — New test cases

**Detection changes:**

**A. `detectPhoenixPlay(prev, curr)` — NEW** (CS03)
- Same pattern as `detectBombPlays()`: iterate new trick plays
- Check if Phoenix is in `play.combination.cards`
- Classify by `play.combination.type` (Single/Pair/Triple/FullHouse/PairSequence/Straight)
- Track `longestStraightWithPhoenix = Math.max(...)` for Straight type

**B. Extend `detectDogPlay(prev, curr)` — MODIFY** (CS06)
- Add dog control classification using `getPartner(fromSeat)` vs `toSeat`
- Existing Tichu partner tracking remains unchanged

**C. `detectDogStuck(prev, curr)` — NEW** (CS07)
- Check all seats: `hand.length === 1 && isDog(hand[0].card)`
- Track with `private dogStuckDetected = new Set<Seat>()` to count once per round per player
- Clear set in `reset()`

**D. Modify `detectBombPlays()` — MODIFY** (CS10, CS16)
- Replace 3-size buckets with per-size counter: `bombSize${cards.length}`
- Stop incrementing `fourCardBombs/fiveCardBombs/sixPlusCardBombs`
- Split over-bomb: track both `youOverBombed` (attacker) and `youWereOverBombed` (victim)
- Stop incrementing old `overBombed`

**E. `detectConflictingBombs(round)` — NEW** (CS13)
- Called once in `captureFullHands()` after card exchange
- Algorithm per spec: find 4-of-a-kind + straight flush conflicts
- Group standard cards by rank (find 4-of-a-kind) and by suit (find 5+ consecutive runs)
- Check if 4-of-a-kind rank overlaps straight flush; removing it must break the flush below 5

**F. Expand `capturePassData(round)` — MODIFY** (CS19, CS20)
- "GAVE" loop: track dragon, phoenix, ace, mahjong given
- "RECEIVED" loop: track mahjong received, dog received from partner vs opponent
- Bomb completion: after exchange, check if received card's rank appears 4x in hand
- Bomb gave: check if given card's rank appears 4x in recipient's hand

**Testing:** Unit tests for each new detection method with crafted RoundState scenarios.

---

### Milestone 3: Persistence + Pass Abandon Handling
**Requirements:** REQ-F-CS23, CS24, REQ-NF-CS02

**Files to modify:**
- `code/packages/server/src/db/game-persistence.ts` — Expand `upsertGroupCStats()` with all new columns
- `code/packages/server/src/db/connection.ts` — Add over-bomb data migration
- `code/packages/server/src/game/game-manager.ts` — Expose `getCurrentRoundSummaries()` + `getAllRoundEventHistory()`
- `code/packages/server/src/room/room-handler.ts` — Save pass stats before game destroy on restart/leave

**Persistence changes:**

**A. Expand `upsertGroupCStats()`** — Add all ~36 new columns to INSERT/ON CONFLICT SQL
- Most use `+= excluded.column` (counters)
- `longestStraightWithPhoenix` uses `MAX(old, new)`

**B. Over-bomb migration** — One-time UPDATE in `syncSchema()`:
```sql
UPDATE player_stats SET you_were_over_bombed = over_bombed
WHERE you_were_over_bombed = 0 AND over_bombed > 0;
```

**C. Pass persistence on abandon (CS23-CS24)**
- Add `GameManager.getCurrentRoundSummaries()` to expose event tracker state
- In `room-handler.ts` `restartGame()` and `leaveRoom()` game-destroy paths:
  - Before `destroyGameByRoom()`, read summaries from game manager
  - Call `upsertGroupCStats()` for pass-related fields only (create a `savePassStatsOnAbandon()` helper)
  - Only if game was past CardPassing phase

**D. Pass attribution (CS23)** — Pass stats are captured during CardPassing→Playing transition. The userId at that seat is the passer. On abandon, we use the current room players to look up userId per seat (same as normal persistence).

**Testing:** Integration tests for persistence; verify pass stats saved on restart.

---

### Milestone 4: Client UI — Card / Hand Stats Tab Overhaul
**Requirements:** REQ-F-CS01, CS02, CS05, CS09, CS12, CS15, CS18, CS22, CS25, CS26, REQ-NF-CS03

**Files to modify:**
- `code/packages/server/src/db/queries.ts` — Add new columns to `getPlayerProfile()` SQL SELECT
- `code/packages/client/src/app/stats/page.tsx` — Full UI overhaul of CardStatsTab

**UI changes:**

**A. Tab rename (CS01):** "Card Stats" → "Card / Hand Stats"

**B. Section reorder (CS02):** Achievements section moves to top

**C. Dragon section (CS26):** Reduce to 3 stats: Hands with Dragon, Tricks Won with Dragon, Dragon Win Rate

**D. Phoenix section (CS05):** Expand to 10 stats (existing 4 + 6 new play types + longest straight)

**E. Dog section (CS09):** Expand to 5 stats: Hands with Dog + 4 control outcomes

**F. Bombs section (CS25):** 8 stat cards + Bomb Sizes table card
- Stat cards: Total Bombs, Hands with Bombs, Hands with Multiple, Conflicting Bombs, Bombs in First 8, You Over-Bombed, You Were Over-Bombed, Bomb Forced by Wish
- Table card: 2 rows × 11 columns (sizes 4–14)

**G. Pass Tracking section (CS22):** Table card with 3 rows × 9 columns
- Headers: Dragon, Phoenix, Ace, Mahjong, Dog(Partner), Dog(Opponent), Bomb(Partner), Bomb(Opponent)
- Rows: Gave, Received

**Testing:** `npm run build` passes. Visual verification of layout.

---

## Implementation Order

M1 → M2 → M3 → M4 (sequential — each builds on the previous)

## Key Patterns to Reuse

- **Detection pattern:** `detectBombPlays()` in `round-event-tracker.ts` — iterate new trick plays via prevPlayCount/currPlayCount diff
- **Migration pattern:** `connection.ts` try/catch `ALTER TABLE ADD COLUMN` array
- **Upsert pattern:** `upsertGroupCStats()` raw SQL INSERT ON CONFLICT with `+= excluded.column`
- **UI pattern:** `<Section>` + `<StatCard>` + 4-col grid in `CardStatsTab`
- **Card helpers:** `isDragon()`, `isPhoenix()`, `isDog()`, `isMahjong()` from `@tichu/shared`
- **Bomb detection:** `detectAllBombs()` from `@tichu/shared` for conflicting bomb analysis

## Verification

1. `npm run build` — all packages compile
2. `npm run test` — all tests pass (existing + new)
3. Manual: start fresh DB, play a game with bots, verify Card / Hand Stats tab shows new stats
4. Verify `game-state-machine.ts` has zero changes (`git diff`)
5. Verify existing data preserved on server restart with old DB
