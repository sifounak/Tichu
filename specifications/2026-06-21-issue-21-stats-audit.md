# Issue #21 Stats Audit Specification

**Type**: Audit + specification
**Date**: 2026-06-21
**Issue**: #21, "Some stats are missing or incorrect"
**Plan**: [../plans/2026-06-21-issue-21-stats-audit.md](../plans/2026-06-21-issue-21-stats-audit.md)
**Status**: Audit phase only; no production behavior changes

---

## 1. Goal

Define every visible stats value on `/stats`, `/stats/cards`, `/stats/tichu`, `/stats/players`, `/leaderboard`, and `/profile`; map each value to its API field, cache/database column, and raw event source; and classify the current implementation before any production fix is attempted.

This document is intentionally descriptive and diagnostic. It records confirmed discrepancies and implementation choices that still need product/engineering review.

---

## 2. Scope Rules

- `gamesPlayed` means count of completed games where the user has at least one `player_rounds` row.
- `gamesWon` keeps the current final-occupant semantics for this audit: the user must be a final seat occupant and their team must win.
- Blind Grand Tichu is separate from Grand Tichu. Blind Grand calls and successes must not increment Grand Tichu calls or successes.
- Bot filtering is out of scope for #21 and belongs to #24.
- Round-by-round persistence gaps are out of scope for #21 and belong to #25.
- Current completed-game raw event tables remain the source of truth for this audit.
- Unsupported or approximate visible stats should be precisely implemented or hidden after audit review.
- API/schema rename/add/remove decisions are deferred until the audit findings are accepted.

---

## 3. Source Levels

| Source level | Raw source |
|---|---|
| Game | `games`, with final occupant columns and final score metadata |
| Round | `game_rounds`, `player_rounds` |
| Trick | `tricks`, `dragon_gift_events`, `dog_play_events` |
| Play | `plays` |
| Pass | `player_rounds` pass columns: `passed_to_*`, `received_from_*`, `full_hand_pre_pass`, `hand_after_pass` |
| Bomb inventory | `bomb_inventory`, plus `plays.is_bomb` for some display-derived counters |
| Relational aggregate | `relational_stats_cache` |
| Derived display value | Client-only arithmetic or formatting over one or more API fields |

---

## 4. API Surfaces

| Surface | API endpoint | Data shape |
|---|---|---|
| `/stats` | `GET /api/players/:userId/profile` | `profile` object from `stats_cache` |
| `/stats/cards` | `GET /api/players/:userId/profile` | `profile` object from `stats_cache` |
| `/stats/tichu` | `GET /api/players/:userId/profile` | `profile` object from `stats_cache` |
| `/stats/players` | `GET /api/players/:userId/relationships` | merged rows from `relational_stats_cache` |
| `/leaderboard` | `GET /api/leaderboard` | leaderboard projection from `stats_cache` |
| `/profile` | `GET /api/players/:userId/profile`; `GET /api/players/:userId/games` | profile summary from `stats_cache`; game history from `games` |

---

## 5. Audited Stat Definitions

### 5.1 Core Record Stats

| Stat ID | Labels / surfaces | Intended definition | Source | API field(s) | Cache field(s) | Status | Recommended action |
|---|---|---|---|---|---|---|---|
| STAT-CORE-01 | Games, Games Played, leaderboard Games | Completed games where user has one or more `player_rounds` rows. | Round | `gamesPlayed` | `stats_cache.games_played` | Correct | Keep. Add API and UI regression coverage for `/stats`, `/leaderboard`, `/profile`. |
| STAT-CORE-02 | Games Won, Record W value | Completed games where user is final occupant and user's team won. | Game + round participation | `gamesWon` | `stats_cache.games_won` | Needs Implementation Decision | Keep current semantics until reviewed; decide whether non-final participants on winning team should ever receive win credit. |
| STAT-CORE-03 | Win Rate | `gamesWon / gamesPlayed`; display as percent. | Derived display/cache | `winRate`; or client `gamesWon/gamesPlayed` | `stats_cache.win_rate` | Defined | Keep numerator/denominator explicit; ensure all surfaces use same source or same calculation. |
| STAT-CORE-04 | Record L value | Display-only losses as `gamesPlayed - gamesWon`. | Derived display | `gamesPlayed`, `gamesWon` | none | Ambiguous | Decide whether forfeits/non-final participation should display as losses or separate record components. |
| STAT-CORE-05 | Rounds | Count player-round rows for the user. | Round | `totalRoundsPlayed` | `stats_cache.total_rounds_played` | Correct | Keep. Add profile serialization assertion. |
| STAT-CORE-06 | Finished 1st, First Finishes | Count player rounds where `finish_position = 1`. | Round | `firstFinishes` | `stats_cache.first_finishes` | Correct | Keep. |
| STAT-CORE-07 | Last finishes | Count player rounds where `finish_position = 4`; currently not directly visible except via API type. | Round | `lastFinishes` | `stats_cache.last_finishes` | Defined | No visible follow-up unless surfaced later. |
| STAT-CORE-08 | 1-2 Finishes | Count rounds the user played where their team earned the 1-2 bonus. | Round | `oneTwoWins` | `stats_cache.one_two_wins` | Correct | Keep. |
| STAT-CORE-09 | 1-2 Against | Count rounds the user played where opponent team earned the 1-2 bonus. | Round | `oneTwoAgainst` | `stats_cache.one_two_against` | Correct | Keep; not directly visible today. |
| STAT-CORE-10 | Best Win Margin | Maximum final-score difference in games where user is final occupant and user's team won. | Game | `largestWinDiff` | `stats_cache.largest_win_diff` | Needs Implementation Decision | Decide whether final-occupant gating remains desired. |
| STAT-CORE-11 | Worst Loss | Maximum final-score difference in games where user is final occupant and user's team lost. | Game | `largestLossDiff` | `stats_cache.largest_loss_diff` | Needs Implementation Decision | Decide whether final-occupant gating remains desired. |
| STAT-CORE-12 | Games forfeited | Count games where user participated but was not a final occupant; not directly visible. | Game + round | `gamesForfeited` | `stats_cache.games_forfeited` | Correct | Keep hidden or add explicit display if record semantics are revised. |
| STAT-CORE-13 | Games joined after spectating | Final occupant whose first player-round in game is after round 1; not directly visible. | Round + game | `gamesJoinedAfterSpectating` | `stats_cache.games_joined_after_spectating` | Correct | Keep hidden unless future UX needs it. |
| STAT-CORE-14 | Tie-break games / max tie-break rounds | Count games where user played a tie-break round; max extra rounds needed. | Game + round | `gamesRequiringTieBreak`, `mostTieBreakRoundsNeeded` | `stats_cache.games_requiring_tie_break`, `most_tie_break_rounds_needed` | Correct | Keep hidden unless surfaced later. |

### 5.2 Tichu Call Stats

| Stat ID | Labels / surfaces | Intended definition | Source | API field(s) | Cache field(s) | Status | Recommended action |
|---|---|---|---|---|---|---|---|
| STAT-TICHU-01 | Tichu, Tichu Success, Tichu Calls/Successes/Rate, leaderboard Tichu % | Normal Tichu calls and successes only. Success means caller finished first. | Round | `tichuCalls`, `tichuSuccesses`, leaderboard `tichuSuccessRate` | `stats_cache.tichu_calls`, `tichu_successes` | Correct | Keep. Add API and UI assertions for normal Tichu rate. |
| STAT-TICHU-02 | Grand Tichu, Grand Tichu Success, Grand Tichu Calls/Successes/Rate, leaderboard Grand % | Grand Tichu calls and successes only; excludes Blind Grand. | Round | `grandTichuCalls`, `grandTichuSuccesses`, leaderboard `grandTichuSuccessRate` | `stats_cache.grand_tichu_calls`, `grand_tichu_successes` | Correct | Keep. Add regression ensuring Blind Grand does not increment Grand. |
| STAT-TICHU-03 | Blind Grand, Blind Grand Success, Blind Grand Calls/Successes/Rate, leaderboard BG % | Blind Grand Tichu calls and successes only. | Round | `blindGrandTichuCalls`, `blindGrandTichuSuccesses`, leaderboard `blindGrandTichuSuccessRate` | `stats_cache.blind_grand_tichu_calls`, `blind_grand_tichu_successes` | Correct | Keep. Add regression for separate counting. |
| STAT-TICHU-04 | Total Calls Made | Sum of normal, Grand, and Blind Grand calls. | Derived display | `tichuCalls`, `grandTichuCalls`, `blindGrandTichuCalls` | none | Correct | Keep as display-only derived value. |
| STAT-TICHU-05 | Opponent Tichus Broken | Opponent normal Tichu calls in rounds user played where opponent failed. | Round relational within game | `opponentTichuBroken` | `stats_cache.opponent_tichu_broken` | Correct | Keep. |
| STAT-TICHU-06 | Opponent GTs Broken | Opponent Grand Tichu calls in rounds user played where opponent failed. | Round relational within game | `opponentGrandTichuBroken` | `stats_cache.opponent_grand_tichu_broken` | Correct | Keep label as Grand-only, or add separate Blind Grand broken stat later. |
| STAT-TICHU-07 | Opponent Calls Broken | Sum of opponent normal Tichu broken and opponent Grand Tichu broken. | Derived display | `opponentTichuBroken`, `opponentGrandTichuBroken` | none | Ambiguous | Decide whether "Calls" should include Blind Grand; no Blind Grand broken field exists. |
| STAT-TICHU-08 | Partner Tichus You Broke | Partner normal Tichu failed because user finished first. | Round relational within game | `partnerTichuBroken` | `stats_cache.partner_tichu_broken` | Correct | Keep. |
| STAT-TICHU-09 | Partner GTs You Broke | Partner Grand Tichu failed because user finished first. | Round relational within game | `partnerGrandTichuBroken` | `stats_cache.partner_grand_tichu_broken` | Correct | Keep label as Grand-only, or add separate Blind Grand field later. |
| STAT-TICHU-10 | Your Tichu Broken by Partner | User's normal Tichu failed because partner finished first. | Round relational within game | `tichuBrokenByPartner` | `stats_cache.tichu_broken_by_partner` | Correct | Keep. |
| STAT-TICHU-11 | Your GT Broken by Partner | User's Grand Tichu failed because partner finished first. | Round relational within game | `grandTichuBrokenByPartner` | `stats_cache.grand_tichu_broken_by_partner` | Correct | Keep label as Grand-only, or add separate Blind Grand field later. |

### 5.3 Dragon Stats

| Stat ID | Labels / surfaces | Intended definition | Source | API field(s) | Cache field(s) | Status | Recommended action |
|---|---|---|---|---|---|---|---|
| STAT-DRAGON-01 | Dragon Trick Wins, Dragon trick wins | Count tricks containing Dragon won by the user's seat in a round they played. | Trick | `dragonTrickWins` | `stats_cache.dragon_trick_wins` | Correct | Keep. |
| STAT-DRAGON-02 | Dragon Rounds Held, Dragon held N rounds | Count rounds where user's post-pass hand contained Dragon. | Pass/round | `roundsWithDragon` | `stats_cache.rounds_with_dragon` | Defined | Label should specify post-pass if precision matters. |
| STAT-DRAGON-03 | Rounds Won w/ Dragon | Count post-pass Dragon-held rounds where user's team scored more in that round. | Pass/round | `roundsWithDragonWon` | `stats_cache.rounds_with_dragon_won` | Defined | Keep or clarify "round score won" vs game won. |
| STAT-DRAGON-04 | Captured w/ Bomb | Count user's bomb-inventory records marked `captured_dragon`. | Bomb inventory + trick capture | `capturedDragonWithBomb` | `stats_cache.captured_dragon_with_bomb` | Correct | Keep. Add regression with real Dragon trick captured by bomb. |

### 5.4 Phoenix And Straight Stats

| Stat ID | Labels / surfaces | Intended definition | Source | API field(s) | Cache field(s) | Status | Recommended action |
|---|---|---|---|---|---|---|---|
| STAT-PHOENIX-01 | Phoenix Rounds Held | Count rounds where user's post-pass hand contained Phoenix. | Pass/round | `roundsWithPhoenix` | `stats_cache.rounds_with_phoenix` | Defined | Label should specify post-pass if precision matters. |
| STAT-PHOENIX-02 | Phoenix Rounds Won | Count post-pass Phoenix-held rounds where user's team scored more in that round. | Pass/round | `roundsWithPhoenixWon` | `stats_cache.rounds_with_phoenix_won` | Defined | Keep or clarify "round score won" vs game won. |
| STAT-PHOENIX-03 | Phoenix Total Uses | Sum Phoenix use counters for single, pair, triple, full house, consecutive pairs, and straight. | Derived display over play stats | six `phoenixUsed*` fields | `stats_cache.phoenix_used_*` | Incorrect | Fix combination-type matching to lowercase enum values before trusting this total. |
| STAT-PHOENIX-04 | As Single | Count Phoenix plays with `combination_type = 'single'` and `phoenix_used_as IS NOT NULL`. | Play | `phoenixUsedAsSingle` | `stats_cache.phoenix_used_as_single` | Incorrect | Current cache checks `'Single'`; real capture stores `'single'`. |
| STAT-PHOENIX-05 | In Pair | Count Phoenix plays with `combination_type = 'pair'`. | Play | `phoenixUsedForPair` | `stats_cache.phoenix_used_for_pair` | Incorrect | Current cache checks `'Pair'`; real capture stores `'pair'`. |
| STAT-PHOENIX-06 | In Triple | Count Phoenix plays with `combination_type = 'triple'`. | Play | `phoenixUsedInTriple` | `stats_cache.phoenix_used_in_triple` | Incorrect | Current cache checks `'Triple'`; real capture stores `'triple'`. |
| STAT-PHOENIX-07 | In Full House | Count Phoenix plays with `combination_type = 'fullHouse'`. | Play | `phoenixUsedInFullHouse` | `stats_cache.phoenix_used_in_full_house` | Incorrect | Current cache checks `'FullHouse'`; real capture stores `'fullHouse'`. |
| STAT-PHOENIX-08 | In Consecutive Pairs | Count Phoenix plays with `combination_type = 'pairSequence'`. | Play | `phoenixUsedInConsecutivePairs` | `stats_cache.phoenix_used_in_consecutive_pairs` | Incorrect | Current cache checks `'PairSequence'`; real capture stores `'pairSequence'`. |
| STAT-PHOENIX-09 | In Straight | Count Phoenix plays with `combination_type = 'straight'`. | Play | `phoenixUsedInStraight` | `stats_cache.phoenix_used_in_straight` | Incorrect | Current cache checks `'Straight'`; real capture stores `'straight'`. |
| STAT-PHOENIX-10 | Longest Straight, longest w/ Phoenix | Intended issue #21 definition: longest straight played by user, with or without Phoenix. Current field means longest Phoenix straight only. | Play / derived display | `longestStraightWithPhoenix` | `stats_cache.longest_straight_with_phoenix` | Needs Implementation Decision | Decide whether to add `longestStraight`, rename existing field, or hide Phoenix-only display. Also fix lowercase check if retained. |

### 5.5 Dog Stats

| Stat ID | Labels / surfaces | Intended definition | Source | API field(s) | Cache field(s) | Status | Recommended action |
|---|---|---|---|---|---|---|---|
| STAT-DOG-01 | Dog Hands Held | Count rounds where user's post-pass hand contained Dog. | Pass/round | `handsWithDog` | `stats_cache.hands_with_dog` | Defined | Label should specify post-pass if precision matters. |
| STAT-DOG-02 | Dog To Partner, percent to partner | Count Dog plays where control passed to partner; percent uses total Dog control outcomes. | Dog play event + derived display | `dogControlToPartner` | `stats_cache.dog_control_to_partner` | Correct | Keep. |
| STAT-DOG-03 | Dog To Opponent | Count Dog plays where control passed to an opponent. | Dog play event | `dogControlToOpponent` | `stats_cache.dog_control_to_opponent` | Correct | Keep. |
| STAT-DOG-04 | Control to self | Count Dog plays where control stayed with same seat. | Dog play event | `dogControlToSelf` | `stats_cache.dog_control_to_self` | Correct | Keep. |
| STAT-DOG-05 | Stuck as Last Card | Count Dog play events where Dog emptied player's hand. | Dog play event | `dogStuckAsLastCard` | `stats_cache.dog_stuck_as_last_card` | Correct | Keep. |
| STAT-DOG-06 | Played for Tichu partner | Count Dog play events where partner had active Tichu/Grand/Blind Grand. | Dog play event | `dogPlayedForTichuPartner` | `stats_cache.dog_played_for_tichu_partner` | Correct | Keep; decide whether UI wording should mention any active Tichu level. |
| STAT-DOG-07 | Opportunities for Tichu partner | Count trick leads by user while partner had active Tichu/Grand/Blind Grand. | Play | `dogOpportunitiesForTichuPartner` | `stats_cache.dog_opportunities_for_tichu_partner` | Ambiguous | Current label is Dog-specific, but calculation counts all leads, not only Dog availability. Clarify or rename. |
| STAT-DOG-08 | Kept during pass | Count rounds where Dog was in pre-pass hand and still in post-pass hand. | Pass/round | `keptDogDuringPass` | `stats_cache.kept_dog_during_pass` | Correct | Keep. |

### 5.6 Bomb Stats

| Stat ID | Labels / surfaces | Intended definition | Source | API field(s) | Cache field(s) | Status | Recommended action |
|---|---|---|---|---|---|---|---|
| STAT-BOMB-01 | Total Bombs, Total Bombs Played | Count bomb-inventory records with `fate = 'played'`. | Bomb inventory | `totalBombs` | `stats_cache.total_bombs` | Correct | Keep. |
| STAT-BOMB-02 | 4-of-a-Kind | Count played bomb-inventory records with size 4. | Bomb inventory | `fourCardBombs`, `bombSize4` | `stats_cache.four_card_bombs`, `bomb_size_4` | Correct | Keep. |
| STAT-BOMB-03 | Straight Flushes | Count played straight-flush bombs. UI uses size 5 plus size >= 6 counters. | Bomb inventory + derived display | `fiveCardBombs`, `sixPlusCardBombs` | `stats_cache.five_card_bombs`, `six_plus_card_bombs` | Correct | Keep. |
| STAT-BOMB-04 | Dealt a Bomb, Dealt in First 8 | Count bomb-inventory records whose cards were all in first 8 cards. | Bomb inventory + first-8 hand | `bombsInFirst8` | `stats_cache.bombs_in_first_8` | Correct | Keep. |
| STAT-BOMB-05 | Multiple Bombs in Hand | Count rounds with more than one bomb-inventory record. | Bomb inventory | `handsWithMultipleBombs` | `stats_cache.hands_with_multiple_bombs` | Correct | Keep. |
| STAT-BOMB-06 | Bomb Size Distribution | Count played bombs by size 4 through 14. | Bomb inventory | `bombSize4`...`bombSize14` | `stats_cache.bomb_size_4`...`bomb_size_14` | Correct | Keep. |
| STAT-BOMB-07 | You over-bombed | Count user's played bombs marked `was_overbomb = 1`. | Bomb inventory | `youOverBombed`, legacy `overBombed` | `stats_cache.you_over_bombed`, `over_bombed` | Correct | Keep; consider hiding legacy `overBombed` from public type if unused. |
| STAT-BOMB-08 | You were over-bombed | Count another player's played overbomb where `fate_target` matches a seat the user held that round. | Bomb inventory | `youWereOverBombed` | `stats_cache.you_were_over_bombed` | Correct | Keep. |
| STAT-BOMB-09 | Conflicting bombs in hand | Count rounds where user's bomb inventory has overlapping bombs. | Bomb inventory | `conflictingBombs` | `stats_cache.conflicting_bombs` | Correct | Keep. |
| STAT-BOMB-10 | Bomb forced by wish | Count user's bomb plays where play fulfilled active wish. | Play | `bombForcedByWish` | `stats_cache.bomb_forced_by_wish` | Correct | Keep. |
| STAT-BOMB-11 | Double Bomb | Count tricks with two or more bomb plays, credited to any user who played that round. | Play aggregate | `doubleBombInTrick` | `stats_cache.double_bomb_in_trick` | Correct | Keep. |
| STAT-BOMB-12 | All Players Bomb In Round | Count rounds where all four seats played a bomb; not currently visible. | Play aggregate | `allPlayersBombInRound` | `stats_cache.all_players_bomb_in_round` | Correct | Keep hidden unless surfaced later. |
| STAT-BOMB-13 | Bomb to partner/opponent | Intended: count passes where user's passed card(s) created or contributed to a recipient's post-pass bomb. | Pass + bomb inventory | `bombGivenToPartner`, `bombGivenToOpponent` | `stats_cache.bomb_gave_to_partner`, `bomb_gave_to_opponent` | Approximate | Current logic is heuristic and can overcount by recipient post-pass bomb, not exact contribution. Precisely implement or hide. |
| STAT-BOMB-14 | Bomb from partner/opponent | Intended: count user's post-pass bombs completed or contributed by partner/opponent pass cards. | Pass + bomb inventory | `bombReceivedFromPartner`, `bombReceivedFromOpponent` | `stats_cache.bomb_received_from_partner`, `bomb_received_from_opponent` | Approximate | Current logic checks whether received card is in a post-pass bomb; define exact semantics and test. |

### 5.7 Pass And Hand Composition Stats

| Stat ID | Labels / surfaces | Intended definition | Source | API field(s) | Cache field(s) | Status | Recommended action |
|---|---|---|---|---|---|---|---|
| STAT-PASS-01 | Strong Pre-Pass Hand | Count rounds where pre-pass hand had at least two power cards: Dragon, Phoenix, or Aces. | Pass/round | `strongPrePassHand` | `stats_cache.strong_pre_pass_hand` | Ambiguous | Define "strong" with product language or hide. Current threshold is two power cards. |
| STAT-PASS-02 | Stacked Deck | Count rounds where pre-pass hand had at least six power cards. | Pass/round | `allPowerCardsBeforePass` | `stats_cache.all_power_cards_before_pass` | Ambiguous | Define "power cards" and threshold in UI or rename. |
| STAT-PASS-03 | All cards under 10 after pass | Count post-pass hands with no rank 10+ standard cards and no Dragon; not visible. | Pass/round | `allCardsUnder10AfterPass` | `stats_cache.all_cards_under_10_after_pass` | Defined | Keep hidden unless surfaced later. |
| STAT-PASS-04 | Dragon given/received in pass | Count pass cards with Dragon given or received. | Pass | `dragonGivenInPass`, `dragonReceivedInPass` | `stats_cache.dragon_gave_in_pass`, `dragon_received_in_pass` | Correct | Keep. |
| STAT-PASS-05 | Phoenix given/received in pass | Count pass cards with Phoenix given or received. | Pass | `phoenixGivenInPass`, `phoenixReceivedInPass` | `stats_cache.phoenix_gave_in_pass`, `phoenix_received_in_pass` | Correct | Keep. |
| STAT-PASS-06 | Ace given/received in pass | Count pass cards with any Ace given or received. | Pass | `aceGivenInPass`, `aceReceivedInPass` | `stats_cache.ace_gave_in_pass`, `ace_received_in_pass` | Correct | Keep. |
| STAT-PASS-07 | Mahjong given/received in pass | Count pass cards with Mahjong given or received. | Pass | `mahjongGivenInPass`, `mahjongReceivedInPass` | `stats_cache.mahjong_gave_in_pass`, `mahjong_received_in_pass` | Correct | Keep. |
| STAT-PASS-08 | Dog to partner/opponent | Count Dog pass direction. | Pass | `dogGivenToPartner`, `dogGivenToOpponent` | `stats_cache.dog_given_to_partner`, `dog_given_to_opponent` | Correct | Keep. |
| STAT-PASS-09 | Dog from partner/opponent | Count Dog receive direction. | Pass | `dogReceivedFromPartner`, `dogReceivedFromOpponent` | `stats_cache.dog_received_from_partner`, `dog_received_from_opponent` | Correct | Keep. |

### 5.8 The Tichu Achievements

| Stat ID | Labels / surfaces | Intended definition | Source | API field(s) | Cache field(s) | Status | Recommended action |
|---|---|---|---|---|---|---|---|
| STAT-ACH-01 | The Tichu (Clean) | Count 13-card straight plays without Phoenix. | Play | `theTichuClean` | `stats_cache.the_tichu_clean` | Incorrect | Current cache checks `'Straight'`; real capture stores `'straight'`. |
| STAT-ACH-02 | The Tichu (Dirty) | Count 13-card straight plays with Phoenix. | Play | `theTichuDirty` | `stats_cache.the_tichu_dirty` | Incorrect | Current cache checks `'Straight'`; real capture stores `'straight'`. |

### 5.9 Relationship Stats

| Stat ID | Labels / surfaces | Intended definition | Source | API field(s) | Cache field(s) | Status | Recommended action |
|---|---|---|---|---|---|---|---|
| STAT-REL-01 | Player display name | Other user's display name, or Bot for synthetic bot row. | Relational aggregate + users | `displayName` | `relational_stats_cache.other_user_id`, `users.display_name` | Defined | Bot filtering deferred to #24. |
| STAT-REL-02 | As Partner Games | Count games played with the other user as partner. | Relational aggregate | `partnerGamesPlayed` | `relational_stats_cache.games_played` where `relationship='partner'` | Incorrect | Current relational computation uses final occupant columns, not `player_rounds`; fix attribution or document final-only semantics. |
| STAT-REL-03 | As Partner Win% | Partner wins divided by partner games. | Relational aggregate + derived display | `partnerGamesWon`, `partnerWinRate` | `relational_stats_cache.games_won`, `games_played` | Incorrect | Same final-occupant attribution risk as partner games. |
| STAT-REL-04 | As Partner 1-2s | Team 1-2 wins per partner game. | Relational aggregate + derived display | `partnerOneTwoWins` | `relational_stats_cache.one_two_wins` | Incorrect | Current relation is game/final-seat based and round participation is not tuple-filtered. |
| STAT-REL-05 | As Partner Bombs | Team bomb plays per partner game. | Relational aggregate + derived display | `partnerTotalTeamBombs` | `relational_stats_cache.total_team_bombs` | Incorrect | Current relation uses final-seat team and `plays.is_bomb`; not round tuple-filtered for shared seats. |
| STAT-REL-06 | As Opponent Games | Count games played with the other user as opponent. | Relational aggregate | `opponentGamesPlayed` | `relational_stats_cache.games_played` where `relationship='opponent'` | Incorrect | Same final-occupant attribution risk. |
| STAT-REL-07 | As Opponent Win% | User's wins divided by opponent games. | Relational aggregate + derived display | `opponentGamesWon`, `opponentWinRate` | `relational_stats_cache.games_won`, `games_played` | Incorrect | Same final-occupant attribution risk. |
| STAT-REL-08 | As Opponent 1-2s | User's team 1-2 wins per opponent game. | Relational aggregate + derived display | `opponentOneTwoWins` | `relational_stats_cache.one_two_wins` | Incorrect | Same final-occupant attribution risk. |
| STAT-REL-09 | As Opponent Bombs | User's team bomb plays per opponent game. | Relational aggregate + derived display | `opponentTotalTeamBombs` | `relational_stats_cache.total_team_bombs` | Incorrect | Same final-occupant attribution risk. |

### 5.10 Leaderboard Stats

| Stat ID | Labels / surfaces | Intended definition | Source | API field(s) | Cache field(s) | Status | Recommended action |
|---|---|---|---|---|---|---|---|
| STAT-LB-01 | Leaderboard Player | User display name linked to profile. | Users + stats cache | `displayName`, `userId` | `users.display_name`, `stats_cache.user_id` | Correct | Keep. |
| STAT-LB-02 | Leaderboard Games | `gamesPlayed`, with minimum games threshold. | Cache | `gamesPlayed` | `stats_cache.games_played` | Correct | Keep. |
| STAT-LB-03 | Leaderboard Win Rate | `stats_cache.win_rate`, ordered descending. | Cache | `winRate` | `stats_cache.win_rate` | Defined | Ensure rate follows final reviewed win semantics. |
| STAT-LB-04 | Leaderboard Tichu % | `tichu_successes / tichu_calls`, zero when no calls. | Cache + derived SQL | `tichuSuccessRate` | `stats_cache.tichu_successes`, `tichu_calls` | Correct | Keep. |
| STAT-LB-05 | Leaderboard BG % | `blind_grand_tichu_successes / blind_grand_tichu_calls`, zero when no calls. | Cache + derived SQL | `blindGrandTichuSuccessRate` | `stats_cache.blind_grand_tichu_successes`, `blind_grand_tichu_calls` | Correct | Keep. |
| STAT-LB-06 | Leaderboard Grand % | `grand_tichu_successes / grand_tichu_calls`, zero when no calls. | Cache + derived SQL | `grandTichuSuccessRate` | `stats_cache.grand_tichu_successes`, `grand_tichu_calls` | Correct | Keep. |

### 5.11 Profile Summary And History

| Stat ID | Labels / surfaces | Intended definition | Source | API field(s) | Cache/database field(s) | Status | Recommended action |
|---|---|---|---|---|---|---|---|
| STAT-PROFILE-01 | Profile summary stats | Same fields as core/Tichu profile rows: games, wins, win rate, Tichu rates, first finishes. | Cache | profile fields above | `stats_cache` fields above | Defined | Keep profile summary in sync with `/stats` decisions. |
| STAT-PROFILE-02 | Game History score/winner/round count | Completed-game history, not a stats-cache aggregate. | Game | `games[]` | `games` | Out of #21 stats-cache scope | No issue #21 action unless history labels are later considered stats. |

---

## 6. Confirmed Discrepancies

1. Phoenix use-by-type counters are incorrect for real captured data. `GameEventCapture` persists `play.combination.type`, whose enum values are lowercase (`single`, `pair`, `triple`, `fullHouse`, `pairSequence`, `straight`), but `stats-cache.ts` compares against capitalized strings (`Single`, `Pair`, `Triple`, `FullHouse`, `PairSequence`, `Straight`).
2. The visible "Longest Straight" is not the issue #21 intended stat. Current API/cache field is `longestStraightWithPhoenix`, and the UI labels it "Longest Straight" on `/stats/cards`; the plan says longest straight should mean any straight, with or without Phoenix.
3. "The Tichu (Clean)" and "The Tichu (Dirty)" 13-card straight achievements have the same combination-type casing bug as Phoenix straight tracking.
4. Bomb pass stats are approximate by code comment and implementation. `bombGivenToPartner`, `bombGivenToOpponent`, `bombReceivedFromPartner`, and `bombReceivedFromOpponent` infer post-pass bomb contribution from `bomb_inventory.acquired_phase = 'postPass'` plus pass-card presence, not from an exact contribution model.
5. Relationship stats on `/stats/players` are not aligned with the current main stats attribution model. `computeRelationalStatsForUser` queries games by final occupant columns and computes partner/opponent, wins, 1-2s, and team bombs from final seats, not from `player_rounds` tuples.
6. Several labels are semantically weak even when the current math is deterministic: "Rounds Held" means post-pass hand contained the card; "Strong Pre-Pass Hand" means at least two power cards; "Stacked Deck" means at least six power cards; "Opportunities for Tichu partner" counts leads while partner had active Tichu, not Dog-specific opportunities.
7. Blind Grand is separated for calls/successes, but "broken" call stats have no Blind Grand-specific fields. Existing "Opponent Calls Broken" excludes Blind Grand because it sums only normal Tichu and Grand Tichu broken counters.

---

## 7. Future Regression Test Plan

Do not add tests during the audit-only phase. The minimum future suite should include:

| Scenario | Minimum test level |
|---|---|
| Phoenix used as single, pair, triple, full house, pair sequence, and straight | Cache-level raw event fixture; API profile assertion; `/stats/cards` component assertion for table labels |
| Longest straight with Phoenix | Cache fixture and UI assertion |
| Longest straight without Phoenix | Cache fixture and UI assertion after field/schema decision |
| 13-card "The Tichu" clean and dirty | Cache fixture; API assertion; `/stats` achievement card assertion |
| Dragon captured by a bomb | Cache fixture using `bomb_inventory.captured_dragon`; API assertion |
| Blind Grand calls and successes separate from Grand | Cache fixture; API profile and leaderboard assertions; `/stats/tichu` UI assertion |
| Relationship partner/opponent stats with seat swaps | Cache fixture using `player_rounds` tuples; `/stats/players` assertion |
| Leaderboard rates | API query assertion for threshold, sorting, and rate fields |
| `/profile` summary stats | API profile assertion and component assertion for displayed summary fields |
| Approximate stats retained after review | Cache fixture proving exact intended definition; UI assertion if visible |
| Stats removed/hidden after review | UI assertion that unsupported labels no longer render |

---

## 8. Verification

Baseline command run before this docs-only change:

```bash
pnpm --filter @tichu/server test -- tests/db/stats-cache.test.ts
```

Result: 40 tests passed.

Because this audit phase changes documentation only, the same baseline stats cache test is the relevant post-change verification. No production behavior changed.

---

## 9. Open Implementation Decisions

| Decision ID | Decision |
|---|---|
| DEC-21-01 | Should `gamesWon`, `largestWinDiff`, and `largestLossDiff` keep final-occupant-only semantics or shift to participation/team semantics? |
| DEC-21-02 | Should "Record" show forfeits/non-final participation separately instead of deriving losses as `gamesPlayed - gamesWon`? |
| DEC-21-03 | Should `longestStraightWithPhoenix` be replaced by `longestStraight`, supplemented with a new field, renamed, or hidden? |
| DEC-21-04 | Should "Longest Straight" display any straight, Phoenix-only straight, or both as separate stats? |
| DEC-21-05 | Should Blind Grand broken-call stats be added, or should existing broken-call labels explicitly exclude Blind Grand? |
| DEC-21-06 | Should approximate bomb pass stats be precisely implemented from pass-card contribution, renamed as approximate, or removed/hidden? |
| DEC-21-07 | Should relationship stats be rebuilt using `player_rounds` tuple attribution in #21, or split into a separate issue because it is broader than scalar stats? |
| DEC-21-08 | Should "Rounds Held" labels be changed to "Held After Pass" for Dragon/Phoenix/Dog? |
| DEC-21-09 | Should "Strong Pre-Pass Hand" and "Stacked Deck" keep current power-card thresholds, be renamed, or be removed? |
| DEC-21-10 | Should "Opportunities for Tichu partner" become a lead-opportunity stat, a Dog-availability stat, or be hidden? |

---

## 10. Recommended Implementation Batch

1. Fix combination-type comparisons for Phoenix usage and 13-card straight detection, using shared `CombinationType` enum values or lowercase literals consistently.
2. Add regression fixtures for all Phoenix usage types, longest Phoenix straight, and clean/dirty 13-card straights.
3. Resolve and implement the longest-straight product/API decision.
4. Add Blind Grand separation regression coverage across cache, API, leaderboard, and UI.
5. Either define exact bomb pass contribution and implement it, or hide the approximate bomb pass rows.
6. Rework relationship stats attribution or file it as a dedicated follow-up if the change is too broad for #21.
