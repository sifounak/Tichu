// REQ-F-AU03: Game history persistence — save completed games and rounds to DB

import { eq, desc, or, sql } from 'drizzle-orm';
import type { Database } from './connection.js';
import { games, gameRounds, roundPlayerEvents } from './schema.js';
import type { Seat, Team, RoundScore } from '@tichu/shared';
import { getTeam } from '@tichu/shared';
import { computeGameStats, computeRoundStats } from './stat-computations.js';
import type { RoundEventSummary } from '../game/round-event-types.js';

export interface GameResult {
  roomCode: string;
  startedAt: Date;
  winnerTeam: 'NS' | 'EW';
  finalScoreNS: number;
  finalScoreEW: number;
  targetScore: number;
  roundCount: number;
  players: Record<Seat, { userId: string | null; name: string }>;
  /** Optional: full scores for stat computation (from GameMachineContext) */
  scores?: Record<Team, number>;
  /** Optional: winning team as Team type */
  winner?: Team | null;
  /** Optional: full round scores for detailed stat computation */
  roundScores?: RoundScore[];
  /** Optional: per-round per-player event summaries from RoundEventTracker */
  roundEvents?: Map<number, import('../game/round-event-types.js').RoundEventSummary[]>;
  /** REQ-F-SO14: Set of userIds who joined as spectators then were promoted to players */
  joinedAfterSpectating?: Set<string>;
}

export interface RoundResult {
  roundNumber: number;
  cardPointsNS: number;
  cardPointsEW: number;
  tichuBonusNS: number;
  tichuBonusEW: number;
  oneTwoBonus: 'NS' | 'EW' | null;
  totalNS: number;
  totalEW: number;
  finishOrder: Seat[];
  tichuCalls: Record<string, string>;
}

/**
 * Saves a completed game and all its rounds to the database.
 * Also updates player stats for all human participants.
 */
export function saveGameResult(
  database: Database,
  gameResult: GameResult,
  rounds: RoundResult[],
): number {
  const { db } = database;

  return db.transaction((tx) => {
    // Insert game record
    const game = tx.insert(games).values({
      roomCode: gameResult.roomCode,
      startedAt: gameResult.startedAt.toISOString(),
      endedAt: new Date().toISOString(),
      winnerTeam: gameResult.winnerTeam,
      finalScoreNS: gameResult.finalScoreNS,
      finalScoreEW: gameResult.finalScoreEW,
      targetScore: gameResult.targetScore,
      roundCount: gameResult.roundCount,
      northUserId: gameResult.players.north.userId,
      eastUserId: gameResult.players.east.userId,
      southUserId: gameResult.players.south.userId,
      westUserId: gameResult.players.west.userId,
      northName: gameResult.players.north.name,
      eastName: gameResult.players.east.name,
      southName: gameResult.players.south.name,
      westName: gameResult.players.west.name,
    }).returning({ id: games.id }).get();

    // Insert round records
    if (rounds.length > 0) {
      tx.insert(gameRounds).values(rounds.map(r => ({
        gameId: game.id,
        roundNumber: r.roundNumber,
        cardPointsNS: r.cardPointsNS,
        cardPointsEW: r.cardPointsEW,
        tichuBonusNS: r.tichuBonusNS,
        tichuBonusEW: r.tichuBonusEW,
        oneTwoBonus: r.oneTwoBonus,
        totalNS: r.totalNS,
        totalEW: r.totalEW,
        finishOrder: r.finishOrder,
        tichuCalls: r.tichuCalls,
      }))).run();
    }

    // Update stats for human players
    const humanPlayers = Object.entries(gameResult.players)
      .filter(([, p]) => p.userId !== null)
      .map(([seat, p]) => ({
        seat: seat as Seat,
        userId: p.userId!,
      }));

    for (const { seat, userId } of humanPlayers) {
      // Use new computation functions when roundScores are available (from game context)
      if (gameResult.roundScores && gameResult.scores && gameResult.winner !== undefined) {
        // REQ-F-SO13: Pass targetScore for tie-break detection
        const gameStats = computeGameStats(gameResult.scores, gameResult.winner, gameResult.roundScores, seat, gameResult.targetScore);
        const roundStats = computeRoundStats(gameResult.roundScores, seat);
        // REQ-F-SO14: Track spectator-to-player transitions
        const joinedAfterSpectating = gameResult.joinedAfterSpectating?.has(userId) ? 1 : 0;

        upsertPlayerStats(tx, userId, {
          ...gameStats,
          ...roundStats,
          gamesJoinedAfterSpectating: joinedAfterSpectating,
        });
      } else {
        // Legacy path: compute from RoundResult[] (no roundScores available)
        const isNS = seat === 'north' || seat === 'south';
        const won = (isNS && gameResult.winnerTeam === 'NS') || (!isNS && gameResult.winnerTeam === 'EW');

        let tichuCalls = 0;
        let tichuSuccesses = 0;
        let grandTichuCalls = 0;
        let grandTichuSuccesses = 0;
        let firstFinishes = 0;

        for (const round of rounds) {
          const call = round.tichuCalls[seat];
          if (call === 'tichu') {
            tichuCalls++;
            if (round.finishOrder[0] === seat) tichuSuccesses++;
          } else if (call === 'grandTichu') {
            grandTichuCalls++;
            if (round.finishOrder[0] === seat) grandTichuSuccesses++;
          }
          if (round.finishOrder[0] === seat) firstFinishes++;
        }

        upsertPlayerStats(tx, userId, {
          gamesPlayed: 1,
          gamesWon: won ? 1 : 0,
          largestWinDiff: 0,
          largestLossDiff: 0,
          oneTwoWins: 0,
          oneTwoAgainst: 0,
          gamesRequiringTieBreak: 0,
          mostTieBreakRoundsNeeded: 0,
          totalRoundsPlayed: rounds.length,
          roundsWon: 0,
          firstFinishes,
          tichuCalls,
          tichuSuccesses,
          grandTichuCalls,
          grandTichuSuccesses,
          opponentTichuBroken: 0,
          opponentGrandTichuBroken: 0,
          partnerTichuBroken: 0,
          partnerGrandTichuBroken: 0,
          lastFinishes: 0,
          tichuBrokenByPartner: 0,
          grandTichuBrokenByPartner: 0,
          gamesJoinedAfterSpectating: 0,
        });
      }
    }

    // REQ-F-EC04: Persist round player events and update Group C stats
    if (gameResult.roundEvents) {
      for (const [roundNumber, summaries] of gameResult.roundEvents) {
        for (const summary of summaries) {
          // Find userId for this seat
          const player = gameResult.players[summary.seat];
          if (!player.userId) continue; // Skip bots

          // Insert audit trail row
          tx.insert(roundPlayerEvents).values({
            gameId: game.id,
            roundNumber,
            userId: player.userId,
            seat: summary.seat,
            eventData: summary as any,
          }).run();

          // Upsert Group C stats
          upsertGroupCStats(tx, player.userId, summary);
        }
      }
    }

    // Compute per-team 1-2 count and bomb totals from roundScores
    let oneTwoNS = 0, oneTwoEW = 0, bombsNS = 0, bombsEW = 0;
    if (gameResult.roundScores) {
      for (const round of gameResult.roundScores) {
        if (round.oneTwoBonus === 'northSouth') oneTwoNS++;
        else if (round.oneTwoBonus === 'eastWest') oneTwoEW++;
        bombsNS += round.bombsPerTeam.northSouth;
        bombsEW += round.bombsPerTeam.eastWest;
      }
    }

    // REQ-F-GD01/GD02: Upsert relational stats (partner/opponent)
    for (const { seat, userId } of humanPlayers) {
      const myTeam = getTeam(seat);
      const won = gameResult.winnerTeam === (myTeam === 'northSouth' ? 'NS' : 'EW');
      const isNS = myTeam === 'northSouth';
      const myOneTwos = isNS ? oneTwoNS : oneTwoEW;
      const myBombs = isNS ? bombsNS : bombsEW;

      for (const { seat: otherSeat, userId: otherUserId } of humanPlayers) {
        if (otherSeat === seat) continue;
        const relationship = getTeam(otherSeat) === myTeam ? 'partner' : 'opponent';
        upsertRelationalStats(tx, userId, otherUserId, relationship, won, myOneTwos, myBombs);
      }

      // Bot relational stats: track games with bot partners/opponents as a single "Bot" entity
      const BOT_USER_ID = '__bot__';
      const allSeats: Seat[] = ['north', 'east', 'south', 'west'];
      const botSeats = allSeats.filter(s =>
        !humanPlayers.some(hp => hp.seat === s),
      );

      // Bot partner: if my partner seat is a bot, record once
      const hasPartnerBot = botSeats.some(s => getTeam(s) === myTeam);
      if (hasPartnerBot) {
        upsertRelationalStats(tx, userId, BOT_USER_ID, 'partner', won, myOneTwos, myBombs);
      }

      // Bot opponent: if any opponent seat is a bot, record once (no double-count for 2-bot teams)
      const hasOpponentBot = botSeats.some(s => getTeam(s) !== myTeam);
      if (hasOpponentBot) {
        upsertRelationalStats(tx, userId, BOT_USER_ID, 'opponent', won, myOneTwos, myBombs);
      }
    }

    return game.id;
  });
}

export interface PlayerStatIncrements {
  gamesPlayed: number;
  gamesWon: number;
  // Group A
  largestWinDiff: number;
  largestLossDiff: number;
  oneTwoWins: number;
  oneTwoAgainst: number;
  // REQ-F-SO10: Tie-break stats
  gamesRequiringTieBreak: number;
  mostTieBreakRoundsNeeded: number;
  // Group B
  totalRoundsPlayed: number;
  roundsWon: number;
  firstFinishes: number;
  tichuCalls: number;
  tichuSuccesses: number;
  grandTichuCalls: number;
  grandTichuSuccesses: number;
  opponentTichuBroken: number;
  opponentGrandTichuBroken: number;
  partnerTichuBroken: number;
  partnerGrandTichuBroken: number;
  // REQ-F-SO08/SO09: New round-level stats
  lastFinishes: number;
  tichuBrokenByPartner: number;
  grandTichuBrokenByPartner: number;
  // REQ-F-SO14: Spectator-to-player
  gamesJoinedAfterSpectating: number;
}

function upsertPlayerStats(
  tx: any,
  userId: string,
  increments: PlayerStatIncrements,
): void {
  const winRate = increments.gamesPlayed > 0 ? increments.gamesWon / increments.gamesPlayed : 0;

  tx.run(sql`
    INSERT INTO player_stats (
      user_id, games_played, games_won, win_rate,
      tichu_calls, tichu_successes, grand_tichu_calls, grand_tichu_successes,
      total_rounds_played, first_finishes, last_updated_at,
      largest_win_diff, largest_loss_diff, one_two_wins, one_two_against,
      rounds_won, opponent_tichu_broken, opponent_grand_tichu_broken,
      partner_tichu_broken, partner_grand_tichu_broken,
      last_finishes, tichu_broken_by_partner, grand_tichu_broken_by_partner,
      games_requiring_tie_break, most_tie_break_rounds_needed,
      games_joined_after_spectating
    ) VALUES (
      ${userId}, ${increments.gamesPlayed}, ${increments.gamesWon}, ${winRate},
      ${increments.tichuCalls}, ${increments.tichuSuccesses},
      ${increments.grandTichuCalls}, ${increments.grandTichuSuccesses},
      ${increments.totalRoundsPlayed}, ${increments.firstFinishes}, datetime('now'),
      ${increments.largestWinDiff}, ${increments.largestLossDiff},
      ${increments.oneTwoWins}, ${increments.oneTwoAgainst},
      ${increments.roundsWon}, ${increments.opponentTichuBroken}, ${increments.opponentGrandTichuBroken},
      ${increments.partnerTichuBroken}, ${increments.partnerGrandTichuBroken},
      ${increments.lastFinishes}, ${increments.tichuBrokenByPartner}, ${increments.grandTichuBrokenByPartner},
      ${increments.gamesRequiringTieBreak}, ${increments.mostTieBreakRoundsNeeded},
      ${increments.gamesJoinedAfterSpectating}
    )
    ON CONFLICT (user_id) DO UPDATE SET
      games_played = player_stats.games_played + excluded.games_played,
      games_won = player_stats.games_won + excluded.games_won,
      win_rate = CASE
        WHEN (player_stats.games_played + excluded.games_played) > 0
        THEN CAST((player_stats.games_won + excluded.games_won) AS REAL) / (player_stats.games_played + excluded.games_played)
        ELSE 0
      END,
      tichu_calls = player_stats.tichu_calls + excluded.tichu_calls,
      tichu_successes = player_stats.tichu_successes + excluded.tichu_successes,
      grand_tichu_calls = player_stats.grand_tichu_calls + excluded.grand_tichu_calls,
      grand_tichu_successes = player_stats.grand_tichu_successes + excluded.grand_tichu_successes,
      total_rounds_played = player_stats.total_rounds_played + excluded.total_rounds_played,
      first_finishes = player_stats.first_finishes + excluded.first_finishes,
      largest_win_diff = MAX(player_stats.largest_win_diff, excluded.largest_win_diff),
      largest_loss_diff = MAX(player_stats.largest_loss_diff, excluded.largest_loss_diff),
      one_two_wins = player_stats.one_two_wins + excluded.one_two_wins,
      one_two_against = player_stats.one_two_against + excluded.one_two_against,
      rounds_won = player_stats.rounds_won + excluded.rounds_won,
      opponent_tichu_broken = player_stats.opponent_tichu_broken + excluded.opponent_tichu_broken,
      opponent_grand_tichu_broken = player_stats.opponent_grand_tichu_broken + excluded.opponent_grand_tichu_broken,
      partner_tichu_broken = player_stats.partner_tichu_broken + excluded.partner_tichu_broken,
      partner_grand_tichu_broken = player_stats.partner_grand_tichu_broken + excluded.partner_grand_tichu_broken,
      last_finishes = player_stats.last_finishes + excluded.last_finishes,
      tichu_broken_by_partner = player_stats.tichu_broken_by_partner + excluded.tichu_broken_by_partner,
      grand_tichu_broken_by_partner = player_stats.grand_tichu_broken_by_partner + excluded.grand_tichu_broken_by_partner,
      games_requiring_tie_break = player_stats.games_requiring_tie_break + excluded.games_requiring_tie_break,
      most_tie_break_rounds_needed = MAX(player_stats.most_tie_break_rounds_needed, excluded.most_tie_break_rounds_needed),
      games_joined_after_spectating = player_stats.games_joined_after_spectating + excluded.games_joined_after_spectating,
      last_updated_at = datetime('now')
  `);
}

/** REQ-F-GC01–GC10, CS03–CS22: Upsert Group C card event stats from round event summaries */
function upsertGroupCStats(
  tx: any,
  userId: string,
  summary: RoundEventSummary,
): void {
  tx.run(sql`
    INSERT INTO player_stats (user_id,
      rounds_with_dragon, rounds_with_dragon_won, rounds_with_phoenix, rounds_with_phoenix_won,
      dragon_received_in_pass, phoenix_received_in_pass, ace_received_in_pass, dog_received_in_pass,
      dragon_trick_wins, dragon_given_after_opponent_win,
      dog_given_to_partner, dog_given_to_opponent,
      dog_played_for_tichu_partner, dog_opportunities_for_tichu_partner,
      hands_with_bombs, total_bombs, four_card_bombs, five_card_bombs, six_plus_card_bombs,
      bombs_in_first_8, hands_with_multiple_bombs,
      over_bombed, bomb_forced_by_wish,
      the_tichu_clean, the_tichu_dirty,
      phoenix_used_as_single, phoenix_used_for_pair, phoenix_used_in_triple,
      phoenix_used_in_full_house, phoenix_used_in_consecutive_pairs, phoenix_used_in_straight,
      longest_straight_with_phoenix,
      dog_control_to_partner, dog_control_to_opponent, dog_control_to_self, dog_stuck_as_last_card,
      bomb_size_4, bomb_size_5, bomb_size_6, bomb_size_7, bomb_size_8,
      bomb_size_9, bomb_size_10, bomb_size_11, bomb_size_12, bomb_size_13, bomb_size_14,
      conflicting_bombs,
      you_over_bombed, you_were_over_bombed,
      dragon_gave_in_pass, phoenix_gave_in_pass, ace_gave_in_pass, mahjong_gave_in_pass,
      mahjong_received_in_pass,
      dog_received_from_partner, dog_received_from_opponent,
      bomb_gave_to_partner, bomb_gave_to_opponent,
      bomb_received_from_partner, bomb_received_from_opponent,
      hands_with_dog,
      strong_pre_pass_hand, kept_dog_during_pass,
      all_power_cards_before_pass, all_cards_under_10_after_pass,
      double_bomb_in_trick, all_players_bomb_in_round
    ) VALUES (${userId},
      ${summary.hadDragon ? 1 : 0}, 0, ${summary.hadPhoenix ? 1 : 0}, 0,
      ${summary.dragonReceivedInPass ? 1 : 0}, ${summary.phoenixReceivedInPass ? 1 : 0},
      ${summary.aceReceivedInPass ? 1 : 0}, ${summary.dogReceivedInPass ? 1 : 0},
      ${summary.dragonTrickWins}, ${summary.dragonGivenAfterOpponentWin},
      ${summary.dogGivenToPartner ? 1 : 0}, ${summary.dogGivenToOpponent ? 1 : 0},
      ${summary.dogPlayedForTichuPartner}, ${summary.dogOpportunitiesForTichuPartner},
      ${summary.bombsPlayed > 0 ? 1 : 0}, ${summary.bombsPlayed},
      ${summary.fourCardBombs}, ${summary.fiveCardBombs}, ${summary.sixPlusCardBombs},
      ${summary.bombsInFirst8}, ${summary.bombsPlayed > 1 ? 1 : 0},
      ${summary.overBombed}, ${summary.bombForcedByWish},
      ${summary.theTichuClean}, ${summary.theTichuDirty},
      ${summary.phoenixUsedAsSingle}, ${summary.phoenixUsedForPair}, ${summary.phoenixUsedInTriple},
      ${summary.phoenixUsedInFullHouse}, ${summary.phoenixUsedInConsecutivePairs}, ${summary.phoenixUsedInStraight},
      ${summary.longestStraightWithPhoenix},
      ${summary.dogControlToPartner}, ${summary.dogControlToOpponent}, ${summary.dogControlToSelf}, ${summary.dogStuckAsLastCard},
      ${summary.bombSize4}, ${summary.bombSize5}, ${summary.bombSize6}, ${summary.bombSize7}, ${summary.bombSize8},
      ${summary.bombSize9}, ${summary.bombSize10}, ${summary.bombSize11}, ${summary.bombSize12}, ${summary.bombSize13}, ${summary.bombSize14},
      ${summary.conflictingBombs},
      ${summary.youOverBombed}, ${summary.youWereOverBombed},
      ${summary.dragonGivenInPass ? 1 : 0}, ${summary.phoenixGivenInPass ? 1 : 0},
      ${summary.aceGivenInPass ? 1 : 0}, ${summary.mahjongGivenInPass ? 1 : 0},
      ${summary.mahjongReceivedInPass ? 1 : 0},
      ${summary.dogReceivedFromPartner ? 1 : 0}, ${summary.dogReceivedFromOpponent ? 1 : 0},
      ${summary.bombGivenToPartnerInPass ? 1 : 0}, ${summary.bombGivenToOpponentInPass ? 1 : 0},
      ${summary.bombReceivedFromPartnerInPass ? 1 : 0}, ${summary.bombReceivedFromOpponentInPass ? 1 : 0},
      ${summary.hadDog ? 1 : 0},
      ${summary.strongPrePassHand ? 1 : 0}, ${summary.keptDogDuringPass ? 1 : 0},
      ${summary.allPowerCardsBeforePass ? 1 : 0}, ${summary.allCardsUnder10AfterPass ? 1 : 0},
      ${summary.doubleBombInTrick}, ${summary.allPlayersBombInRound ? 1 : 0}
    )
    ON CONFLICT (user_id) DO UPDATE SET
      rounds_with_dragon = player_stats.rounds_with_dragon + excluded.rounds_with_dragon,
      rounds_with_phoenix = player_stats.rounds_with_phoenix + excluded.rounds_with_phoenix,
      dragon_received_in_pass = player_stats.dragon_received_in_pass + excluded.dragon_received_in_pass,
      phoenix_received_in_pass = player_stats.phoenix_received_in_pass + excluded.phoenix_received_in_pass,
      ace_received_in_pass = player_stats.ace_received_in_pass + excluded.ace_received_in_pass,
      dog_received_in_pass = player_stats.dog_received_in_pass + excluded.dog_received_in_pass,
      dragon_trick_wins = player_stats.dragon_trick_wins + excluded.dragon_trick_wins,
      dragon_given_after_opponent_win = player_stats.dragon_given_after_opponent_win + excluded.dragon_given_after_opponent_win,
      dog_given_to_partner = player_stats.dog_given_to_partner + excluded.dog_given_to_partner,
      dog_given_to_opponent = player_stats.dog_given_to_opponent + excluded.dog_given_to_opponent,
      dog_played_for_tichu_partner = player_stats.dog_played_for_tichu_partner + excluded.dog_played_for_tichu_partner,
      dog_opportunities_for_tichu_partner = player_stats.dog_opportunities_for_tichu_partner + excluded.dog_opportunities_for_tichu_partner,
      hands_with_bombs = player_stats.hands_with_bombs + excluded.hands_with_bombs,
      total_bombs = player_stats.total_bombs + excluded.total_bombs,
      four_card_bombs = player_stats.four_card_bombs + excluded.four_card_bombs,
      five_card_bombs = player_stats.five_card_bombs + excluded.five_card_bombs,
      six_plus_card_bombs = player_stats.six_plus_card_bombs + excluded.six_plus_card_bombs,
      bombs_in_first_8 = player_stats.bombs_in_first_8 + excluded.bombs_in_first_8,
      hands_with_multiple_bombs = player_stats.hands_with_multiple_bombs + excluded.hands_with_multiple_bombs,
      over_bombed = player_stats.over_bombed + excluded.over_bombed,
      bomb_forced_by_wish = player_stats.bomb_forced_by_wish + excluded.bomb_forced_by_wish,
      the_tichu_clean = player_stats.the_tichu_clean + excluded.the_tichu_clean,
      the_tichu_dirty = player_stats.the_tichu_dirty + excluded.the_tichu_dirty,
      phoenix_used_as_single = player_stats.phoenix_used_as_single + excluded.phoenix_used_as_single,
      phoenix_used_for_pair = player_stats.phoenix_used_for_pair + excluded.phoenix_used_for_pair,
      phoenix_used_in_triple = player_stats.phoenix_used_in_triple + excluded.phoenix_used_in_triple,
      phoenix_used_in_full_house = player_stats.phoenix_used_in_full_house + excluded.phoenix_used_in_full_house,
      phoenix_used_in_consecutive_pairs = player_stats.phoenix_used_in_consecutive_pairs + excluded.phoenix_used_in_consecutive_pairs,
      phoenix_used_in_straight = player_stats.phoenix_used_in_straight + excluded.phoenix_used_in_straight,
      longest_straight_with_phoenix = MAX(player_stats.longest_straight_with_phoenix, excluded.longest_straight_with_phoenix),
      dog_control_to_partner = player_stats.dog_control_to_partner + excluded.dog_control_to_partner,
      dog_control_to_opponent = player_stats.dog_control_to_opponent + excluded.dog_control_to_opponent,
      dog_control_to_self = player_stats.dog_control_to_self + excluded.dog_control_to_self,
      dog_stuck_as_last_card = player_stats.dog_stuck_as_last_card + excluded.dog_stuck_as_last_card,
      bomb_size_4 = player_stats.bomb_size_4 + excluded.bomb_size_4,
      bomb_size_5 = player_stats.bomb_size_5 + excluded.bomb_size_5,
      bomb_size_6 = player_stats.bomb_size_6 + excluded.bomb_size_6,
      bomb_size_7 = player_stats.bomb_size_7 + excluded.bomb_size_7,
      bomb_size_8 = player_stats.bomb_size_8 + excluded.bomb_size_8,
      bomb_size_9 = player_stats.bomb_size_9 + excluded.bomb_size_9,
      bomb_size_10 = player_stats.bomb_size_10 + excluded.bomb_size_10,
      bomb_size_11 = player_stats.bomb_size_11 + excluded.bomb_size_11,
      bomb_size_12 = player_stats.bomb_size_12 + excluded.bomb_size_12,
      bomb_size_13 = player_stats.bomb_size_13 + excluded.bomb_size_13,
      bomb_size_14 = player_stats.bomb_size_14 + excluded.bomb_size_14,
      conflicting_bombs = player_stats.conflicting_bombs + excluded.conflicting_bombs,
      you_over_bombed = player_stats.you_over_bombed + excluded.you_over_bombed,
      you_were_over_bombed = player_stats.you_were_over_bombed + excluded.you_were_over_bombed,
      dragon_gave_in_pass = player_stats.dragon_gave_in_pass + excluded.dragon_gave_in_pass,
      phoenix_gave_in_pass = player_stats.phoenix_gave_in_pass + excluded.phoenix_gave_in_pass,
      ace_gave_in_pass = player_stats.ace_gave_in_pass + excluded.ace_gave_in_pass,
      mahjong_gave_in_pass = player_stats.mahjong_gave_in_pass + excluded.mahjong_gave_in_pass,
      mahjong_received_in_pass = player_stats.mahjong_received_in_pass + excluded.mahjong_received_in_pass,
      dog_received_from_partner = player_stats.dog_received_from_partner + excluded.dog_received_from_partner,
      dog_received_from_opponent = player_stats.dog_received_from_opponent + excluded.dog_received_from_opponent,
      bomb_gave_to_partner = player_stats.bomb_gave_to_partner + excluded.bomb_gave_to_partner,
      bomb_gave_to_opponent = player_stats.bomb_gave_to_opponent + excluded.bomb_gave_to_opponent,
      bomb_received_from_partner = player_stats.bomb_received_from_partner + excluded.bomb_received_from_partner,
      bomb_received_from_opponent = player_stats.bomb_received_from_opponent + excluded.bomb_received_from_opponent,
      hands_with_dog = player_stats.hands_with_dog + excluded.hands_with_dog,
      strong_pre_pass_hand = player_stats.strong_pre_pass_hand + excluded.strong_pre_pass_hand,
      kept_dog_during_pass = player_stats.kept_dog_during_pass + excluded.kept_dog_during_pass,
      all_power_cards_before_pass = player_stats.all_power_cards_before_pass + excluded.all_power_cards_before_pass,
      all_cards_under_10_after_pass = player_stats.all_cards_under_10_after_pass + excluded.all_cards_under_10_after_pass,
      double_bomb_in_trick = player_stats.double_bomb_in_trick + excluded.double_bomb_in_trick,
      all_players_bomb_in_round = player_stats.all_players_bomb_in_round + excluded.all_players_bomb_in_round
  `);
}

/** REQ-F-GD01/GD02: Upsert partner/opponent relational stats */
function upsertRelationalStats(
  tx: any,
  userId: string,
  otherUserId: string,
  relationship: 'partner' | 'opponent',
  won: boolean,
  oneTwoWins: number,
  totalTeamBombs: number,
): void {
  tx.run(sql`
    INSERT INTO player_relational_stats (user_id, other_user_id, relationship, games_played, games_won, one_two_wins, total_team_bombs)
    VALUES (${userId}, ${otherUserId}, ${relationship}, 1, ${won ? 1 : 0}, ${oneTwoWins}, ${totalTeamBombs})
    ON CONFLICT (user_id, other_user_id, relationship) DO UPDATE SET
      games_played = player_relational_stats.games_played + 1,
      games_won = player_relational_stats.games_won + ${won ? 1 : 0},
      one_two_wins = player_relational_stats.one_two_wins + ${oneTwoWins},
      total_team_bombs = player_relational_stats.total_team_bombs + ${totalTeamBombs}
  `);
}

/** REQ-F-CS23/CS24: Save pass stats when game is abandoned/restarted after card pass phase.
 *  Only persists pass-related stats (not gameplay stats like bombs, tricks, etc.) */
export function savePassStatsOnAbandon(
  database: Database,
  players: Array<{ seat: Seat; userId: string }>,
  summaries: RoundEventSummary[],
): void {
  const { db } = database;

  db.transaction((tx: any) => {
    for (const summary of summaries) {
      const player = players.find(p => p.seat === summary.seat);
      if (!player) continue;
      // Use full upsertGroupCStats — it handles all fields, and non-pass fields will be 0
      upsertGroupCStats(tx, player.userId, summary);
    }
  });
}

/**
 * Gets game history for a specific player.
 */
export function getPlayerGameHistory(
  database: Database,
  userId: string,
  limit = 20,
  offset = 0,
) {
  const { db } = database;

  // REQ-F-SO19: Include userId columns for player team detection
  return db.select({
    id: games.id,
    roomCode: games.roomCode,
    startedAt: games.startedAt,
    endedAt: games.endedAt,
    winnerTeam: games.winnerTeam,
    finalScoreNS: games.finalScoreNS,
    finalScoreEW: games.finalScoreEW,
    roundCount: games.roundCount,
    northUserId: games.northUserId,
    eastUserId: games.eastUserId,
    southUserId: games.southUserId,
    westUserId: games.westUserId,
    northName: games.northName,
    eastName: games.eastName,
    southName: games.southName,
    westName: games.westName,
  })
    .from(games)
    .where(
      or(
        eq(games.northUserId, userId),
        eq(games.eastUserId, userId),
        eq(games.southUserId, userId),
        eq(games.westUserId, userId),
      ),
    )
    .orderBy(desc(games.endedAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Gets round details for a specific game.
 */
export function getGameRounds(
  database: Database,
  gameId: number,
) {
  const { db } = database;

  return db.select({
    roundNumber: gameRounds.roundNumber,
    cardPointsNS: gameRounds.cardPointsNS,
    cardPointsEW: gameRounds.cardPointsEW,
    tichuBonusNS: gameRounds.tichuBonusNS,
    tichuBonusEW: gameRounds.tichuBonusEW,
    oneTwoBonus: gameRounds.oneTwoBonus,
    totalNS: gameRounds.totalNS,
    totalEW: gameRounds.totalEW,
    finishOrder: gameRounds.finishOrder,
    tichuCalls: gameRounds.tichuCalls,
  })
    .from(gameRounds)
    .where(eq(gameRounds.gameId, gameId))
    .orderBy(gameRounds.roundNumber);
}

/**
 * REQ-F-SO20: Get per-game Tichu call summaries for a batch of game IDs.
 * Returns a map of gameId → { tichuCalls, tichuSuccesses, grandTichuCalls, grandTichuSuccesses }
 * per seat, so the client can compute team-relative totals.
 */
export function getGameTichuSummaries(
  database: Database,
  gameIds: number[],
): Map<number, { tichuCalls: Record<string, string>; finishOrder: Seat[] }[]> {
  if (gameIds.length === 0) return new Map();

  const { db } = database;
  const results = db.all(sql`
    SELECT game_id, tichu_calls, finish_order
    FROM game_rounds
    WHERE game_id IN (${sql.join(gameIds.map(id => sql`${id}`), sql`, `)})
    ORDER BY game_id, round_number
  `) as { game_id: number; tichu_calls: string; finish_order: string }[];

  const summaries = new Map<number, { tichuCalls: Record<string, string>; finishOrder: Seat[] }[]>();
  for (const row of results) {
    if (!summaries.has(row.game_id)) summaries.set(row.game_id, []);
    summaries.get(row.game_id)!.push({
      tichuCalls: typeof row.tichu_calls === 'string' ? JSON.parse(row.tichu_calls) : row.tichu_calls as any,
      finishOrder: typeof row.finish_order === 'string' ? JSON.parse(row.finish_order) : row.finish_order as any,
    });
  }
  return summaries;
}
