# Requirements Traceability Matrix - Issue #21 Stats Audit

**Spec**: [2026-06-21-issue-21-stats-audit.md](./2026-06-21-issue-21-stats-audit.md)
**Plan**: [../plans/2026-06-21-issue-21-stats-audit.md](../plans/2026-06-21-issue-21-stats-audit.md)
**Phase**: Audit/spec/RTM only

Statuses used: `Defined`, `Correct`, `Incorrect`, `Ambiguous`, `Approximate`, `Unsupported`, `Remove or Hide`, `Needs Implementation Decision`, `Out of #21 stats-cache scope`.

---

## RTM

| Req ID | UI surface | UI label / value | API/profile field | Cache/database field | Raw event source | Status | Follow-up |
|---|---|---|---|---|---|---|---|
| REQ-21-CORE-01 | `/stats`, `/leaderboard`, `/profile` | Games / Games Played / Games | `gamesPlayed` | `stats_cache.games_played` | `player_rounds` distinct game count | Correct | Add API/UI regression. |
| REQ-21-CORE-02 | `/stats`, `/profile` | Games Won / Record W | `gamesWon` | `stats_cache.games_won` | `games` final occupant + `player_rounds` team | Needs Implementation Decision | Review final-occupant semantics. |
| REQ-21-CORE-03 | `/stats`, `/leaderboard`, `/profile` | Win Rate | `winRate` or derived from `gamesWon/gamesPlayed` | `stats_cache.win_rate` | Derived | Defined | Keep consistent after win decision. |
| REQ-21-CORE-04 | `/stats` | Record L | `gamesPlayed`, `gamesWon` | none | Derived display | Ambiguous | Decide whether forfeits are losses. |
| REQ-21-CORE-05 | `/stats` | Rounds | `totalRoundsPlayed` | `stats_cache.total_rounds_played` | `player_rounds` | Correct | Add API/UI regression. |
| REQ-21-CORE-06 | `/stats`, `/profile` | Finished 1st / First Finishes | `firstFinishes` | `stats_cache.first_finishes` | `player_rounds.finish_position` | Correct | Keep. |
| REQ-21-CORE-07 | API only | Last finishes | `lastFinishes` | `stats_cache.last_finishes` | `player_rounds.finish_position` | Defined | Hidden today. |
| REQ-21-CORE-08 | `/stats`, `/stats/players` | 1-2 Finishes / 1-2s | `oneTwoWins`, relational `partnerOneTwoWins`, `opponentOneTwoWins` | `stats_cache.one_two_wins`, `relational_stats_cache.one_two_wins` | `game_rounds.one_two_bonus`, `player_rounds` | Correct for profile; Incorrect for relational | Fix relational attribution. |
| REQ-21-CORE-09 | API only | 1-2 Against | `oneTwoAgainst` | `stats_cache.one_two_against` | `game_rounds.one_two_bonus`, `player_rounds` | Correct | Hidden today. |
| REQ-21-CORE-10 | `/stats` | Best Win Margin | `largestWinDiff` | `stats_cache.largest_win_diff` | `games` final score + final occupant | Needs Implementation Decision | Review final-occupant semantics. |
| REQ-21-CORE-11 | `/stats` | Worst Loss | `largestLossDiff` | `stats_cache.largest_loss_diff` | `games` final score + final occupant | Needs Implementation Decision | Review final-occupant semantics. |
| REQ-21-TICHU-01 | `/stats`, `/stats/tichu`, `/leaderboard`, `/profile` | Tichu success/calls/rate | `tichuCalls`, `tichuSuccesses`, `tichuSuccessRate` | `stats_cache.tichu_calls`, `tichu_successes` | `player_rounds.tichu_call`, `tichu_call_success` | Correct | Add cache/API/UI rate regression. |
| REQ-21-TICHU-02 | `/stats`, `/stats/tichu`, `/leaderboard`, `/profile` | Grand Tichu success/calls/rate | `grandTichuCalls`, `grandTichuSuccesses`, `grandTichuSuccessRate` | `stats_cache.grand_tichu_calls`, `grand_tichu_successes` | `player_rounds.grand_tichu_call`, `tichu_call_success` | Correct | Assert Blind Grand exclusion. |
| REQ-21-TICHU-03 | `/stats`, `/stats/tichu`, `/leaderboard`, `/profile` | Blind Grand success/calls/rate | `blindGrandTichuCalls`, `blindGrandTichuSuccesses`, `blindGrandTichuSuccessRate` | `stats_cache.blind_grand_tichu_calls`, `blind_grand_tichu_successes` | `player_rounds.blind_grand_tichu_call`, `tichu_call_success` | Correct | Assert Grand exclusion. |
| REQ-21-TICHU-04 | `/stats/tichu` | Total Calls Made | `tichuCalls`, `grandTichuCalls`, `blindGrandTichuCalls` | none | Derived display | Correct | Keep. |
| REQ-21-TICHU-05 | `/stats`, `/stats/tichu` | Opponent Tichus Broken | `opponentTichuBroken` | `stats_cache.opponent_tichu_broken` | `player_rounds` in same round | Correct | Keep. |
| REQ-21-TICHU-06 | `/stats`, `/stats/tichu` | Opponent GTs Broken | `opponentGrandTichuBroken` | `stats_cache.opponent_grand_tichu_broken` | `player_rounds` in same round | Correct | Decide Blind Grand broken story. |
| REQ-21-TICHU-07 | `/stats/tichu` | Opponent Calls Broken | `opponentTichuBroken + opponentGrandTichuBroken` | none | Derived display | Ambiguous | Decide whether label includes Blind Grand. |
| REQ-21-TICHU-08 | `/stats/tichu` | Partner Tichus You Broke | `partnerTichuBroken` | `stats_cache.partner_tichu_broken` | `player_rounds` partner finish/call | Correct | Keep. |
| REQ-21-TICHU-09 | `/stats/tichu` | Partner GTs You Broke | `partnerGrandTichuBroken` | `stats_cache.partner_grand_tichu_broken` | `player_rounds` partner finish/call | Correct | Decide Blind Grand broken story. |
| REQ-21-TICHU-10 | `/stats/tichu` | Your Tichu Broken by Partner | `tichuBrokenByPartner` | `stats_cache.tichu_broken_by_partner` | `player_rounds` partner finish/call | Correct | Keep. |
| REQ-21-TICHU-11 | `/stats/tichu` | Your GT Broken by Partner | `grandTichuBrokenByPartner` | `stats_cache.grand_tichu_broken_by_partner` | `player_rounds` partner finish/call | Correct | Decide Blind Grand broken story. |
| REQ-21-DRAGON-01 | `/stats`, `/stats/cards` | Dragon trick wins / Trick Wins | `dragonTrickWins` | `stats_cache.dragon_trick_wins` | `tricks.contains_dragon`, `tricks.winner_seat` | Correct | Add Dragon captured fixture. |
| REQ-21-DRAGON-02 | `/stats`, `/stats/cards` | Dragon held rounds / Rounds Held | `roundsWithDragon` | `stats_cache.rounds_with_dragon` | `player_rounds.hand_after_pass` | Defined | Consider label "Held After Pass". |
| REQ-21-DRAGON-03 | `/stats/cards` | Rounds Won w/ Dragon | `roundsWithDragonWon` | `stats_cache.rounds_with_dragon_won` | `player_rounds.hand_after_pass`, `game_rounds.total_*` | Defined | Clarify round-score win. |
| REQ-21-DRAGON-04 | `/stats/cards` | Captured w/ Bomb | `capturedDragonWithBomb` | `stats_cache.captured_dragon_with_bomb` | `bomb_inventory.captured_dragon` | Correct | Add regression. |
| REQ-21-PHOENIX-01 | `/stats/cards` | Phoenix Rounds Held | `roundsWithPhoenix` | `stats_cache.rounds_with_phoenix` | `player_rounds.hand_after_pass` | Defined | Consider label "Held After Pass". |
| REQ-21-PHOENIX-02 | `/stats/cards` | Phoenix Rounds Won | `roundsWithPhoenixWon` | `stats_cache.rounds_with_phoenix_won` | `player_rounds.hand_after_pass`, `game_rounds.total_*` | Defined | Clarify round-score win. |
| REQ-21-PHOENIX-03 | `/stats/cards` | Phoenix Total Uses | six Phoenix usage fields | `stats_cache.phoenix_used_*` | `plays.combination_type`, `plays.phoenix_used_as` | Incorrect | Fix enum casing; add fixtures. |
| REQ-21-PHOENIX-04 | `/stats/cards` | As Single | `phoenixUsedAsSingle` | `stats_cache.phoenix_used_as_single` | `plays` | Incorrect | Match `single`. |
| REQ-21-PHOENIX-05 | `/stats/cards` | In Pair | `phoenixUsedForPair` | `stats_cache.phoenix_used_for_pair` | `plays` | Incorrect | Match `pair`. |
| REQ-21-PHOENIX-06 | `/stats/cards` | In Triple | `phoenixUsedInTriple` | `stats_cache.phoenix_used_in_triple` | `plays` | Incorrect | Match `triple`. |
| REQ-21-PHOENIX-07 | `/stats/cards` | In Full House | `phoenixUsedInFullHouse` | `stats_cache.phoenix_used_in_full_house` | `plays` | Incorrect | Match `fullHouse`. |
| REQ-21-PHOENIX-08 | `/stats/cards` | In Consecutive Pairs | `phoenixUsedInConsecutivePairs` | `stats_cache.phoenix_used_in_consecutive_pairs` | `plays` | Incorrect | Match `pairSequence`. |
| REQ-21-PHOENIX-09 | `/stats/cards` | In Straight | `phoenixUsedInStraight` | `stats_cache.phoenix_used_in_straight` | `plays` | Incorrect | Match `straight`. |
| REQ-21-PHOENIX-10 | `/stats`, `/stats/cards` | Longest Straight / longest w/ Phoenix | `longestStraightWithPhoenix` | `stats_cache.longest_straight_with_phoenix` | `plays.combination_length` | Needs Implementation Decision | Define any-straight vs Phoenix-only field. |
| REQ-21-DOG-01 | `/stats/cards` | Hands Held | `handsWithDog` | `stats_cache.hands_with_dog` | `player_rounds.hand_after_pass` | Defined | Consider label "Held After Pass". |
| REQ-21-DOG-02 | `/stats`, `/stats/cards` | To Partner / percent to partner | `dogControlToPartner` | `stats_cache.dog_control_to_partner` | `dog_play_events.control_passed_to` | Correct | Keep. |
| REQ-21-DOG-03 | `/stats/cards` | To Opponent | `dogControlToOpponent` | `stats_cache.dog_control_to_opponent` | `dog_play_events.control_passed_to` | Correct | Keep. |
| REQ-21-DOG-04 | `/stats/cards` | Control to self | `dogControlToSelf` | `stats_cache.dog_control_to_self` | `dog_play_events.control_passed_to` | Correct | Keep. |
| REQ-21-DOG-05 | `/stats`, `/stats/cards` | Stuck as Last Card | `dogStuckAsLastCard` | `stats_cache.dog_stuck_as_last_card` | `dog_play_events.dog_was_last_card` | Correct | Keep. |
| REQ-21-DOG-06 | `/stats/cards` | Played for Tichu partner | `dogPlayedForTichuPartner` | `stats_cache.dog_played_for_tichu_partner` | `dog_play_events.partner_has_tichu` | Correct | Keep. |
| REQ-21-DOG-07 | `/stats/cards` | Opportunities for Tichu partner | `dogOpportunitiesForTichuPartner` | `stats_cache.dog_opportunities_for_tichu_partner` | `plays.sequence_number = 1`, `partner_tichu_active` | Ambiguous | Clarify or rename. |
| REQ-21-DOG-08 | `/stats/cards` | Kept during pass | `keptDogDuringPass` | `stats_cache.kept_dog_during_pass` | `player_rounds.full_hand_pre_pass`, `hand_after_pass` | Correct | Keep. |
| REQ-21-BOMB-01 | `/stats`, `/stats/cards` | Total Bombs / Total Bombs Played | `totalBombs` | `stats_cache.total_bombs` | `bomb_inventory.fate` | Correct | Keep. |
| REQ-21-BOMB-02 | `/stats`, `/stats/cards` | 4-of-a-Kind / 4-card | `fourCardBombs`, `bombSize4` | `stats_cache.four_card_bombs`, `bomb_size_4` | `bomb_inventory.size`, `fate` | Correct | Keep. |
| REQ-21-BOMB-03 | `/stats`, `/stats/cards` | Straight Flushes | `fiveCardBombs`, `sixPlusCardBombs`, size fields | `stats_cache.five_card_bombs`, `six_plus_card_bombs`, `bomb_size_*` | `bomb_inventory.size`, `fate` | Correct | Keep. |
| REQ-21-BOMB-04 | `/stats`, `/stats/cards` | Dealt a Bomb / Dealt in First 8 | `bombsInFirst8` | `stats_cache.bombs_in_first_8` | `bomb_inventory.acquired_phase` | Correct | Keep. |
| REQ-21-BOMB-05 | `/stats/cards` | Multiple Bombs in Hand | `handsWithMultipleBombs` | `stats_cache.hands_with_multiple_bombs` | `bomb_inventory` per round | Correct | Keep. |
| REQ-21-BOMB-06 | `/stats/cards` | Bomb Size Distribution | `bombSize4`...`bombSize14` | `stats_cache.bomb_size_4`...`bomb_size_14` | `bomb_inventory.size`, `fate` | Correct | Keep. |
| REQ-21-BOMB-07 | `/stats/cards` | You over-bombed | `youOverBombed` | `stats_cache.you_over_bombed` | `bomb_inventory.was_overbomb` | Correct | Keep. |
| REQ-21-BOMB-08 | `/stats/cards` | You were over-bombed | `youWereOverBombed` | `stats_cache.you_were_over_bombed` | `bomb_inventory.fate_target`, `was_overbomb` | Correct | Keep. |
| REQ-21-BOMB-09 | `/stats/cards` | Conflicting bombs in hand | `conflictingBombs` | `stats_cache.conflicting_bombs` | `bomb_inventory.overlaps_with` | Correct | Keep. |
| REQ-21-BOMB-10 | `/stats/cards` | Bomb forced by wish | `bombForcedByWish` | `stats_cache.bomb_forced_by_wish` | `plays.play_forced_by_wish`, `plays.is_bomb` | Correct | Keep. |
| REQ-21-BOMB-11 | `/stats` | Double Bomb | `doubleBombInTrick` | `stats_cache.double_bomb_in_trick` | `plays.is_bomb` per trick | Correct | Keep. |
| REQ-21-BOMB-12 | API only | All players bomb in round | `allPlayersBombInRound` | `stats_cache.all_players_bomb_in_round` | `plays.is_bomb` per round | Correct | Hidden today. |
| REQ-21-BOMB-13 | `/stats/cards` | Bomb to partner | `bombGivenToPartner` | `stats_cache.bomb_gave_to_partner` | `player_rounds.passed_to_partner`, `bomb_inventory` | Approximate | Precisely implement or hide. |
| REQ-21-BOMB-14 | `/stats/cards` | Bomb to opponent | `bombGivenToOpponent` | `stats_cache.bomb_gave_to_opponent` | `player_rounds.passed_to_left/right`, `bomb_inventory` | Approximate | Precisely implement or hide. |
| REQ-21-BOMB-15 | `/stats/cards` | Bomb from partner | `bombReceivedFromPartner` | `stats_cache.bomb_received_from_partner` | `player_rounds.received_from_partner`, `bomb_inventory` | Approximate | Precisely implement or hide. |
| REQ-21-BOMB-16 | `/stats/cards` | Bomb from opponent | `bombReceivedFromOpponent` | `stats_cache.bomb_received_from_opponent` | `player_rounds.received_from_left/right`, `bomb_inventory` | Approximate | Precisely implement or hide. |
| REQ-21-PASS-01 | `/stats/cards` | Strong Pre-Pass Hand | `strongPrePassHand` | `stats_cache.strong_pre_pass_hand` | `player_rounds.full_hand_pre_pass` | Ambiguous | Define threshold or hide. |
| REQ-21-PASS-02 | `/stats` | Stacked Deck | `allPowerCardsBeforePass` | `stats_cache.all_power_cards_before_pass` | `player_rounds.full_hand_pre_pass` | Ambiguous | Define label/threshold or hide. |
| REQ-21-PASS-03 | API only | All cards under 10 after pass | `allCardsUnder10AfterPass` | `stats_cache.all_cards_under_10_after_pass` | `player_rounds.hand_after_pass` | Defined | Hidden today. |
| REQ-21-PASS-04 | `/stats/cards` | Dragon given in pass | `dragonGivenInPass` | `stats_cache.dragon_gave_in_pass` | `player_rounds.passed_to_*` | Correct | Keep. |
| REQ-21-PASS-05 | `/stats/cards` | Dragon received in pass | `dragonReceivedInPass` | `stats_cache.dragon_received_in_pass` | `player_rounds.received_from_*` | Correct | Keep. |
| REQ-21-PASS-06 | `/stats/cards` | Phoenix given in pass | `phoenixGivenInPass` | `stats_cache.phoenix_gave_in_pass` | `player_rounds.passed_to_*` | Correct | Keep. |
| REQ-21-PASS-07 | `/stats/cards` | Phoenix received in pass | `phoenixReceivedInPass` | `stats_cache.phoenix_received_in_pass` | `player_rounds.received_from_*` | Correct | Keep. |
| REQ-21-PASS-08 | `/stats/cards` | Ace given in pass | `aceGivenInPass` | `stats_cache.ace_gave_in_pass` | `player_rounds.passed_to_*` | Correct | Keep. |
| REQ-21-PASS-09 | `/stats/cards` | Ace received in pass | `aceReceivedInPass` | `stats_cache.ace_received_in_pass` | `player_rounds.received_from_*` | Correct | Keep. |
| REQ-21-PASS-10 | `/stats/cards` | Mahjong given in pass | `mahjongGivenInPass` | `stats_cache.mahjong_gave_in_pass` | `player_rounds.passed_to_*` | Correct | Keep. |
| REQ-21-PASS-11 | `/stats/cards` | Mahjong received in pass | `mahjongReceivedInPass` | `stats_cache.mahjong_received_in_pass` | `player_rounds.received_from_*` | Correct | Keep. |
| REQ-21-PASS-12 | `/stats/cards` | Dog to partner | `dogGivenToPartner` | `stats_cache.dog_given_to_partner` | `player_rounds.passed_to_partner` | Correct | Keep. |
| REQ-21-PASS-13 | `/stats/cards` | Dog to opponent | `dogGivenToOpponent` | `stats_cache.dog_given_to_opponent` | `player_rounds.passed_to_left/right` | Correct | Keep. |
| REQ-21-PASS-14 | `/stats/cards` | Dog from partner | `dogReceivedFromPartner` | `stats_cache.dog_received_from_partner` | `player_rounds.received_from_partner` | Correct | Keep. |
| REQ-21-PASS-15 | `/stats/cards` | Dog from opponent | `dogReceivedFromOpponent` | `stats_cache.dog_received_from_opponent` | `player_rounds.received_from_left/right` | Correct | Keep. |
| REQ-21-ACH-01 | `/stats` | The Tichu (Clean) | `theTichuClean` | `stats_cache.the_tichu_clean` | `plays.combination_type`, `combination_length` | Incorrect | Match `straight`; add clean fixture. |
| REQ-21-ACH-02 | `/stats` | The Tichu (Dirty) | `theTichuDirty` | `stats_cache.the_tichu_dirty` | `plays.combination_type`, `combination_length`, `phoenix_used_as` | Incorrect | Match `straight`; add dirty fixture. |
| REQ-21-REL-01 | `/stats/players` | Player | `displayName`, `userId` | `users.display_name`, `relational_stats_cache.other_user_id` | Relational aggregate | Defined | Bot filtering belongs to #24. |
| REQ-21-REL-02 | `/stats/players` | Partner Games | `partnerGamesPlayed` | `relational_stats_cache.games_played` | `games` final occupants currently | Incorrect | Rebuild from `player_rounds` or split follow-up. |
| REQ-21-REL-03 | `/stats/players` | Partner Win% | `partnerWinRate` | `relational_stats_cache.games_won/games_played` | `games` final occupants currently | Incorrect | Rebuild from `player_rounds` or split follow-up. |
| REQ-21-REL-04 | `/stats/players` | Partner 1-2s | `partnerOneTwoWins` | `relational_stats_cache.one_two_wins` | `game_rounds`, final-seat relation currently | Incorrect | Rebuild from round tuples. |
| REQ-21-REL-05 | `/stats/players` | Partner Bombs | `partnerTotalTeamBombs` | `relational_stats_cache.total_team_bombs` | `plays.is_bomb`, final-seat team currently | Incorrect | Rebuild from round tuples. |
| REQ-21-REL-06 | `/stats/players` | Opponent Games | `opponentGamesPlayed` | `relational_stats_cache.games_played` | `games` final occupants currently | Incorrect | Rebuild from `player_rounds` or split follow-up. |
| REQ-21-REL-07 | `/stats/players` | Opponent Win% | `opponentWinRate` | `relational_stats_cache.games_won/games_played` | `games` final occupants currently | Incorrect | Rebuild from `player_rounds` or split follow-up. |
| REQ-21-REL-08 | `/stats/players` | Opponent 1-2s | `opponentOneTwoWins` | `relational_stats_cache.one_two_wins` | `game_rounds`, final-seat relation currently | Incorrect | Rebuild from round tuples. |
| REQ-21-REL-09 | `/stats/players` | Opponent Bombs | `opponentTotalTeamBombs` | `relational_stats_cache.total_team_bombs` | `plays.is_bomb`, final-seat team currently | Incorrect | Rebuild from round tuples. |
| REQ-21-LB-01 | `/leaderboard` | Player | `displayName`, `userId` | `users.display_name`, `stats_cache.user_id` | Users + cache | Correct | Keep. |
| REQ-21-LB-02 | `/leaderboard` | Games | `gamesPlayed` | `stats_cache.games_played` | `player_rounds` | Correct | Keep threshold test. |
| REQ-21-LB-03 | `/leaderboard` | Win Rate | `winRate` | `stats_cache.win_rate` | Derived cache | Defined | Follow win-semantics decision. |
| REQ-21-LB-04 | `/leaderboard` | Tichu % | `tichuSuccessRate` | `stats_cache.tichu_successes/tichu_calls` | SQL derived | Correct | Keep. |
| REQ-21-LB-05 | `/leaderboard` | BG % | `blindGrandTichuSuccessRate` | `stats_cache.blind_grand_tichu_successes/blind_grand_tichu_calls` | SQL derived | Correct | Keep. |
| REQ-21-LB-06 | `/leaderboard` | Grand % | `grandTichuSuccessRate` | `stats_cache.grand_tichu_successes/grand_tichu_calls` | SQL derived | Correct | Keep. |
| REQ-21-PROFILE-01 | `/profile` | Summary Statistics card | profile summary fields | `stats_cache` summary fields | Cache | Defined | Keep in sync with `/stats`. |
| REQ-21-PROFILE-02 | `/profile` | Game History score/winner/round count | `games[]` | `games` | Completed game rows | Out of #21 stats-cache scope | No #21 stats fix. |

---

## Issue #25 Round-by-Round Stats Update

Issue #25 implements the round-by-round persistence gap that was explicitly deferred by the issue #21 audit. The entries below trace the new behavior added after the audit commit.

| Req ID | Requirement | Implementation evidence | Test evidence | Status |
|---|---|---|---|---|
| REQ-25-RR-01 | Persist a database game shell only after at least one round is complete, and mark it `in_progress` until game over. | `code/packages/server/src/db/schema.ts:33`; `code/packages/server/src/db/connection.ts:75`; `code/packages/server/src/db/game-persistence.ts:119`; `code/packages/server/src/room/room-handler.ts:1137` | `code/packages/server/tests/db/game-persistence.test.ts:207` | Passed |
| REQ-25-RR-02 | Persist each completed round into `game_rounds` and raw event tables without duplicating previously persisted rounds. | `code/packages/server/src/db/game-persistence.ts:52`; `code/packages/server/src/db/event-persistence.ts:51`; `code/packages/server/src/room/room-handler.ts:1152` | `code/packages/server/tests/db/game-persistence.test.ts:216`; `code/packages/server/tests/db/event-persistence.test.ts` | Passed |
| REQ-25-RR-03 | Defer `stats_cache` updates while a game is in progress; stats-page reads rebuild a stale/missing player cache on demand from persisted completed-round data. | `code/packages/server/src/game/game-manager.ts:402`; `code/packages/server/src/room/room-handler.ts:1152`; `code/packages/server/src/db/stats-cache.ts:1363` | `code/packages/server/tests/db/stats-cache.test.ts:502` | Passed |
| REQ-25-RR-04 | Keep final game-history and final-result stats from treating in-progress rows as completed games. | `code/packages/server/src/db/game-persistence.ts:288`; `code/packages/server/src/db/stats-cache.ts:489`; `code/packages/server/src/db/stats-cache.ts:1034` | `code/packages/server/tests/db/game-persistence.test.ts:212`; `code/packages/server/tests/db/stats-cache.test.ts:184` | Passed |
| REQ-25-RR-05 | On game over, complete the existing progress row instead of inserting a duplicate completed game. | `code/packages/server/src/db/game-persistence.ts:213`; `code/packages/server/src/room/room-handler.ts:1169` | `code/packages/server/tests/db/game-persistence.test.ts:226` | Passed |
| REQ-25-RR-06 | Reuse an existing in-progress row after restore and mark interrupted progress rows as `abandoned` when the active game is restarted. | `code/packages/server/src/db/game-persistence.ts:132`; `code/packages/server/src/room/room-handler.ts:1228` | Full server suite, including graceful restart and restart-round/game coverage | Passed |
| REQ-25-RR-07 | Refresh leaderboard cache on demand when completed-game data is newer or the cache is missing. | `code/packages/server/src/auth/auth-routes.ts:161`; `code/packages/server/src/db/stats-cache.ts:1330` | `code/packages/server/tests/db/stats-cache.test.ts:609` | Passed |

---

## Required Future Test Trace

| Scenario | Requirement coverage | Minimum future test |
|---|---|---|
| Phoenix used as single, pair, triple, full house, pair sequence, and straight | REQ-21-PHOENIX-03 through REQ-21-PHOENIX-09 | Cache fixture, API assertion, `/stats/cards` UI assertion |
| Longest straight with Phoenix | REQ-21-PHOENIX-10 | Cache fixture and UI assertion |
| Longest straight without Phoenix | REQ-21-PHOENIX-10 | Cache fixture and UI assertion after API decision |
| Clean and dirty 13-card straight | REQ-21-ACH-01, REQ-21-ACH-02 | Cache fixture, API assertion, achievement UI assertion |
| Dragon captured by bomb | REQ-21-DRAGON-04 | Cache fixture and API assertion |
| Blind Grand separate from Grand | REQ-21-TICHU-02, REQ-21-TICHU-03, REQ-21-LB-05, REQ-21-LB-06 | Cache, API, leaderboard, `/stats/tichu` UI assertions |
| Relationship stats | REQ-21-REL-02 through REQ-21-REL-09 | Cache fixture with seat swap and `/stats/players` UI assertion |
| Leaderboard rates | REQ-21-LB-02 through REQ-21-LB-06 | API query assertion for threshold, ordering, rates |
| `/profile` summary | REQ-21-PROFILE-01 | API profile and component assertion |
| Approximate stats retained | REQ-21-BOMB-13 through REQ-21-BOMB-16 | Exact contribution fixture and UI assertion |
| Unsupported/removed stats | Any `Remove or Hide` outcome | UI non-render assertion |

---

## Audit Verification

Baseline verification command from the audit-only commit:

```bash
pnpm --filter @tichu/server test -- tests/db/stats-cache.test.ts
```

Baseline result before docs: 40 tests passed.

Issue #25 implementation verification:

```bash
pnpm --filter @tichu/server test -- tests/db/game-persistence.test.ts tests/db/event-persistence.test.ts tests/db/stats-cache.test.ts tests/room/room-handler.test.ts
pnpm --filter @tichu/server test
pnpm --filter @tichu/server typecheck
```

Issue #25 result: focused persistence/stats suite passed 95 tests after deferred in-progress cache refresh; full server suite passed 998 tests; server typecheck passed.
