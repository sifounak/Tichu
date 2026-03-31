# Card / Hand Stats Expansion — Specification

**Date:** 2026-03-31
**Type:** Feature Enhancement
**Status:** Draft
**Confidence:** High
**Extends:** `2026-03-31-stats-page-overhaul.md`

## 1. Goal

Expand the Card Stats tab with detailed lifetime tracking of Phoenix play types, Dog control outcomes, bomb size distribution, conflicting bombs, over-bomb directions, and a comprehensive pass tracking matrix. Also restructure the tab layout, add pass persistence tied to the passing player (surviving game abandonment), and rename the tab to "Card / Hand Stats".

**Why:** Players want deep card-play analytics — how often Phoenix was used as a single vs in a straight, whether their bombs conflict, who they give/receive special cards from, and their bomb size distribution.

## 2. Scope

### In Scope
- Rename tab from "Card Stats" to "Card / Hand Stats"
- Move Achievements section to top
- Phoenix play type tracking (7 new stats + longest straight MAX)
- Dog control outcome tracking (3 new stats + stuck-with-dog detection)
- Per-size bomb tracking (11 sizes: 4-card through 14-card)
- Conflicting bomb detection (bombs sharing cards in initial hand)
- Over-bomb direction split (you over-bombed vs you were over-bombed)
- Extended pass tracking matrix (gave/received × 8 card types)
- Bomb completion detection in pass phase
- Pass persistence tied to passing player (not seat replacement)
- Pass stat saving on game abandon/restart before round end
- Custom UI cards: Bomb Sizes table and Pass Tracking table

### Out of Scope
- In-game live stat display
- Historical backfill of new stats for past games
- Changes to Overview or History tabs

## 3. Key Decisions

- **Phoenix play type detection**: Use `Combination.type` and check if Phoenix is in `combination.cards` during `detectBombPlays`-style state diff on trick plays
- **Dog control**: Read `round.lastDogPlay.toSeat` already tracked by game-state-machine
- **Stuck with Dog**: Detect any time a player's hand reaches exactly 1 card and it's the Dog, regardless of round outcome
- **Conflicting bombs**: Analyze full hand after deal. Find all 4-of-a-kind bombs and the longest straight flush per suit. Check if any 4-of-a-kind shares a card with a straight flush such that playing either makes the other impossible. Straight flushes >5 cards do NOT conflict with their own sub-combinations.
- **Bomb sizes**: Replace 3 existing columns (fourCardBombs, fiveCardBombs, sixPlusCardBombs) with 11 individual columns (bombSize4 through bombSize14)
- **Over-bomb split**: Existing `overBombed` becomes `youWereOverBombed`. New `youOverBombed` tracks when you play a higher bomb over an opponent's.
- **Pass bomb completion**: After card exchange, check if a received card completed a 4-of-a-kind in the recipient's hand by comparing pre-pass rank counts with post-pass rank counts.
- **Pass persistence**: Track which userId performed each pass. Save pass stats on game abandon/restart even if round didn't complete.

## 4. Functional Requirements

### 4.1 UI Structure

**REQ-F-CS01: Rename tab to "Card / Hand Stats"**
Change the tab label from "Card Stats" to "Card / Hand Stats".
*Acceptance:* Tab displays "Card / Hand Stats".

**REQ-F-CS02: Move Achievements section to top**
Achievements section appears above Dragon section.
*Acceptance:* Achievements is the first section in the Card / Hand Stats tab.

### 4.2 Phoenix Play Type Tracking

**REQ-F-CS03: Detect Phoenix play types**
When Phoenix is played in a trick, classify the combination type and increment the corresponding counter. Track:
- `phoenixUsedAsSingle` — `CombinationType.Single` containing Phoenix
- `phoenixUsedForPair` — `CombinationType.Pair` containing Phoenix
- `phoenixUsedInTriple` — `CombinationType.Triple` containing Phoenix
- `phoenixUsedInFullHouse` — `CombinationType.FullHouse` containing Phoenix
- `phoenixUsedInConsecutivePairs` — `CombinationType.PairSequence` containing Phoenix
- `phoenixUsedInStraight` — `CombinationType.Straight` containing Phoenix
- `longestStraightWithPhoenix` — MAX of `combination.length` for straights containing Phoenix

*Acceptance:* Each Phoenix play increments exactly one type counter. `longestStraightWithPhoenix` uses MAX across all games.

**REQ-F-CS04: Phoenix play type DB columns**
Add 7 INTEGER columns (DEFAULT 0) to `playerStats`: `phoenix_used_as_single`, `phoenix_used_for_pair`, `phoenix_used_in_triple`, `phoenix_used_in_full_house`, `phoenix_used_in_consecutive_pairs`, `phoenix_used_in_straight`, `longest_straight_with_phoenix`.
*Acceptance:* Columns exist with correct defaults.

**REQ-F-CS05: Phoenix play type UI**
Display in Phoenix section: Hands with Phoenix, Tricks Won with Phoenix, Phoenix Win Rate, Phoenix Used as Single Card, Phoenix Used for Pair, Phoenix Used in Three-of-a-Kind, Phoenix Used in Full House, Phoenix Used in Consecutive Pairs, Phoenix Used in Straight, Longest Straight with Phoenix.
*Acceptance:* All 10 stats render in the Phoenix section.

### 4.3 Dog Control Tracking

**REQ-F-CS06: Detect Dog control outcomes**
When the Dog is played, read `round.lastDogPlay.toSeat` and classify:
- `dogControlToPartner` — toSeat is partner
- `dogControlToOpponent` — toSeat is an opponent
- `dogControlToSelf` — toSeat is the player who played the Dog (partner and left opponent both finished)

*Acceptance:* Each Dog play increments exactly one control counter.

**REQ-F-CS07: Detect stuck with Dog as last card**
Detect any time a player's hand is reduced to exactly 1 card and that card is the Dog. Increment `dogStuckAsLastCard` when this state is reached, regardless of round outcome.
*Acceptance:* Stat increments the moment the hand reaches 1 card = Dog, whether or not the player subsequently plays it.

**REQ-F-CS08: Dog tracking DB columns**
Add 4 INTEGER columns (DEFAULT 0) to `playerStats`: `dog_control_to_partner`, `dog_control_to_opponent`, `dog_control_to_self`, `dog_stuck_as_last_card`.
*Acceptance:* Columns exist with correct defaults.

**REQ-F-CS09: Dog tracking UI**
Display in Dog section: Hands with Dog, Dog Used to Give Control to Partner, Dog Used to Give Control to Opponent, Dog Used to Give Control to Self, Stuck with Dog as Last Card.
*Acceptance:* All 5 stats render in the Dog section.

### 4.4 Bomb Size Tracking

**REQ-F-CS10: Track individual bomb sizes**
Replace existing 3-column tracking (fourCardBombs, fiveCardBombs, sixPlusCardBombs) with 11 individual columns: `bombSize4` through `bombSize14`. A 4-of-a-kind bomb counts as size 4. A straight flush bomb counts as its card count (5–14).
*Acceptance:* Each bomb play increments exactly one size column based on `combination.cards.length`.

**REQ-F-CS11: Bomb size DB columns**
Add 11 INTEGER columns (DEFAULT 0): `bomb_size_4` through `bomb_size_14`. Keep existing columns for backward compatibility but stop incrementing them.
*Acceptance:* Columns exist. New bomb plays only increment the new per-size columns.

**REQ-F-CS12: Bomb Sizes UI card**
Display a single StatCard-sized component with a table inside:
- 2 rows × 11 columns
- Header row: "4-card", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14"
- Data row: counts for each size
*Acceptance:* Bomb Sizes card renders as a table within the Bombs section.

### 4.5 Conflicting Bombs

**REQ-F-CS13: Detect conflicting bombs in dealt hand**
After full hand is dealt (14 cards), analyze for bomb conflicts:
1. Find all 4-of-a-kind bombs (4 cards of same rank)
2. Find the longest straight flush in each suit (5+ consecutive same-suit cards)
3. For each (4-of-a-kind, straight flush) pair that shares a card: check if playing the 4-of-a-kind leaves a valid 5+ straight flush from the remaining suited cards. If NOT, count as 1 conflict.
4. Straight flushes >5 cards do NOT conflict with their own sub-combinations.
5. Two 4-of-a-kind bombs conflicting with the same straight flush count as 2 conflicts.

*Acceptance:* Conflicting bombs correctly detected per the algorithm. J-bomb + 8-A flush = 1 conflict. 9-bomb + 9-A flush = 0 (10-A remains). Long flush self-subsets = 0.

**REQ-F-CS14: Conflicting bombs DB column**
Add `conflicting_bombs` INTEGER DEFAULT 0 to `playerStats`.
*Acceptance:* Column exists.

**REQ-F-CS15: Conflicting bombs UI**
Display "Conflicting Bombs" stat in the Bombs section.
*Acceptance:* Stat renders in Bombs section.

### 4.6 Over-Bomb Direction

**REQ-F-CS16: Split over-bomb tracking**
Track both directions:
- `youOverBombed` — you played a higher bomb over an opponent's bomb
- `youWereOverBombed` — an opponent played a higher bomb over your bomb (existing `overBombed` behavior)

*Acceptance:* Each over-bomb event increments both the attacker's `youOverBombed` and the victim's `youWereOverBombed`.

**REQ-F-CS17: Over-bomb DB columns**
Add `you_over_bombed` INTEGER DEFAULT 0. Rename/keep existing `over_bombed` as `you_were_over_bombed` (migration maps old to new).
*Acceptance:* Both columns exist.

**REQ-F-CS18: Over-bomb UI**
Display "You Over-Bombed" and "You Were Over-Bombed" in the Bombs section.
*Acceptance:* Both stats render.

### 4.7 Extended Pass Tracking

**REQ-F-CS19: Track gave/received for all card types**
Track pass statistics for 8 card categories × 2 directions (gave/received):
- Dragon gave/received
- Phoenix gave/received
- Ace gave/received
- Mahjong gave/received
- Dog (Partner) gave/received
- Dog (Opponent) gave/received
- Bomb (Partner) gave/received — card passed completed a 4-of-a-kind bomb for the recipient
- Bomb (Opponent) gave/received — same for opponent

*Acceptance:* All 16 pass stats tracked correctly per round.

**REQ-F-CS20: Bomb completion detection in pass**
After card exchange, for each player: compare pre-pass rank counts with post-pass hand. If a received card's rank now appears 4 times (and appeared 3 times before receiving), a bomb was completed. Track which relationship (partner/opponent) the completing card came from.
*Acceptance:* Bomb completion correctly detected. Only 4-of-a-kind completion counted (not straight flush).

**REQ-F-CS21: Pass tracking DB columns**
Add new columns to `playerStats`:
- `dragon_gave_in_pass`, `phoenix_gave_in_pass`, `ace_gave_in_pass`, `mahjong_gave_in_pass`
- `mahjong_received_in_pass`
- `dog_received_from_partner`, `dog_received_from_opponent`
- `bomb_gave_to_partner`, `bomb_gave_to_opponent`
- `bomb_received_from_partner`, `bomb_received_from_opponent`

Total: 11 new columns (INTEGER DEFAULT 0).
*Acceptance:* Columns exist.

**REQ-F-CS22: Pass Tracking UI card**
Display a single component with a table:
- 3 rows × 9 columns
- Column 1 header blank, then: Dragon, Phoenix, Ace, Mahjong, Dog (Partner), Dog (Opponent), Bomb (Partner), Bomb (Opponent)
- Row 2 "Gave": counts for each
- Row 3 "Received": counts for each
*Acceptance:* Pass Tracking card renders as a table in the Pass Tracking section.

### 4.8 Pass Persistence

**REQ-F-CS23: Associate pass stats with passing player**
Pass statistics are always attributed to the player who performed the pass, even if that player later leaves and is replaced by another player who finishes the round.
*Acceptance:* If Player A passes cards, then leaves and Player B takes the seat, Player A's pass stats are recorded (not Player B's).

**REQ-F-CS24: Save pass stats on game abandon/restart**
When a game is abandoned, quit, or restarted after the card pass phase but before the round ends, save the pass stats for all players who performed the pass. The pass event data should be saved before the game/room is destroyed.
*Acceptance:* Pass stats are persisted even if the round never completes. Only stats from completed passes are saved (not partial passes).

### 4.9 Updated Bomb Section Stats

**REQ-F-CS25: Bombs section stat list**
Display in this order: Total Bombs, Hands with Bombs, Hands with Multiple Bombs, Conflicting Bombs, Bombs in First 8, You Over-Bombed, You Were Over-Bombed, Bomb Forced by Wish, then the Bomb Sizes table card.
*Acceptance:* All 8 stats plus the Bomb Sizes table render in the Bombs section.

### 4.10 Updated Dragon Section

**REQ-F-CS26: Dragon section stat list**
Display: Hands with Dragon, Tricks Won with Dragon, Dragon Win Rate.
*Acceptance:* 3 stats in Dragon section. "Hands with Dragon" uses existing `roundsWithDragon`. "Tricks Won with Dragon" uses existing `dragonTrickWins`.

## 5. Non-Functional Requirements

**REQ-NF-CS01: No game engine modification**
All detection logic lives in `RoundEventTracker` or new observer code. No changes to `game-state-machine.ts`.
*Acceptance:* `game-state-machine.ts` has zero changes.

**REQ-NF-CS02: Backward compatibility**
All new DB columns use DEFAULT 0. Existing stats preserved. Old columns kept for backward compat.
*Acceptance:* Server starts with existing DB without errors.

**REQ-NF-CS03: Build passes**
`npm run build` passes for all packages after changes.
*Acceptance:* Zero build errors.

## 6. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Conflicting bomb detection is computationally expensive | Low | Low | Only runs once per hand (14 cards max); O(n²) is fine |
| Bomb completion detection in pass requires pre/post hand comparison | Medium | Medium | Snapshot rank counts before exchange, compare after |
| Pass persistence on abandon requires new save path | Medium | Medium | Hook into room destruction / game restart flow |
| Phoenix play type detection misses edge cases | Low | Medium | Comprehensive tests with all combination types |
| Many new DB columns (~35) may slow ALTER TABLE | Low | Low | SQLite ALTER is fast; one-time migration |

## 7. Success Metrics

1. All Phoenix play type stats track correctly with test data
2. Dog control outcomes match `lastDogPlay.toSeat` in all cases
3. Conflicting bomb algorithm handles all specified edge cases
4. Bomb Sizes table and Pass Tracking table render correctly
5. Pass stats persist on game abandon after pass phase
6. Pass stats attributed to correct player after seat swap
7. `npm run build` passes for all packages
8. All existing tests continue to pass
