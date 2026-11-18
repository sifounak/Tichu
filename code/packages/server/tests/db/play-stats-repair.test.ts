// Verifies: REQ-F-PS01–PS03. Real detector -> capture -> persistence -> cache -> profile.
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { createDeck, detectCombination, GamePhase, SEATS_IN_ORDER, type RoundState } from '@tichu/shared';
import { createDatabase, type Database } from '../../src/db/connection.js';
import { writeEventData } from '../../src/db/event-persistence.js';
import { rebuildStatsCache } from '../../src/db/stats-cache.js';
import { getPlayerProfile, getPlayerRelationships } from '../../src/db/queries.js';
import { countBombContributions, getPassBombs, getReceivedBombStats } from '../../src/db/bomb-pass-stats.js';
import { GameEventCapture } from '../../src/game/game-event-capture.js';
import type { GameMachineContext } from '../../src/game/game-state-machine.js';

describe('Play statistics repairs', () => {
  let database: Database;
  let gameId: number;
  beforeEach(() => {
    database = createDatabase(':memory:');
    database.client.exec(`INSERT INTO users (id, display_name) VALUES ('a','A'), ('b','B'), ('c','C'), ('d','D'), ('e','E');
      INSERT INTO games (room_code,winner_team,final_score_ns,final_score_ew,round_count,
        north_user_id,east_user_id,south_user_id,west_user_id,north_name,east_name,south_name,west_name)
      VALUES ('TEST','NS',1000,500,1,'a','b','c','d','A','B','C','D');
      INSERT INTO game_rounds (game_id,round_number,card_points_ns,card_points_ew,total_ns,total_ew,finish_order)
      VALUES (1,1,50,50,50,50,'[]');`);
    gameId = 1;
  });
  afterEach(() => database.client.close());

  function addRound(round = 1, north = 'a', south = 'c') {
    for (const [seat, userId] of [['north', north], ['east', 'b'], ['south', south], ['west', 'd']]) {
      database.client.prepare('INSERT INTO player_rounds (game_id,round_number,seat,user_id) VALUES (?,?,?,?)')
        .run(gameId, round, seat, userId);
    }
  }

  it.each([
    ['single', [54], 'phoenixUsedAsSingle'],
    ['pair', [0, 54], 'phoenixUsedForPair'],
    ['triple', [0, 13, 54], 'phoenixUsedInTriple'],
    ['fullHouse', [0, 13, 26, 1, 54], 'phoenixUsedInFullHouse'],
    ['pairSequence', [0, 13, 1, 54], 'phoenixUsedInConsecutivePairs'],
    ['straight', [0, 1, 2, 3, 54], 'phoenixUsedInStraight'],
  ])('counts Phoenix %s through actual capture', (type, ids, field) => {
    const deck = createDeck();
    const cards = (ids as number[]).map(id => deck[id]);
    const combination = detectCombination(cards)!;
    expect(combination.type).toBe(type);
    const round = {
      roundNumber: 1, phase: GamePhase.Playing,
      players: Object.fromEntries(SEATS_IN_ORDER.map(seat => [seat, {
        seat, hand: seat === 'north' ? [...cards, deck[55]] : [], tricksWon: [],
        tipiCall: 'none', hasPlayed: false, finishOrder: null,
        passedCards: { to: {}, received: false },
      }])),
      currentTrick: null, currentTurn: 'north', mahjongWish: null, wishFulfilled: false,
      finishOrder: [], dragonGiftPending: null, dragonGiftedTo: null, lastDogPlay: null,
      bombsPerTeam: { northSouth: 0, eastWest: 0 },
    } as unknown as RoundState;
    const context = {
      gameId: String(gameId), currentRound: round, scores: { northSouth: 0, eastWest: 0 },
    } as GameMachineContext;
    const capture = new GameEventCapture(gameId);
    capture.wireSeatUserIdResolver(seat => ({ north: 'a', east: 'b', south: 'c', west: 'd' })[seat]);
    capture.onStateChange(context);
    round.players.north.hand = [deck[55]];
    round.currentTrick = { leadSeat: 'north', currentWinner: 'north', passes: [], plays: [{ seat: 'north', combination }] };
    capture.onStateChange(context);
    capture.finalizeRound();
    const play = capture.getAccumulator().rounds[0].plays[0];
    expect(play.combinationType).toBe(type);
    if (type === 'single') expect(play.phoenixUsedAs).toBeNull();
    writeEventData(database, gameId, capture.getAccumulator());
    rebuildStatsCache(database);
    expect(getPlayerProfile(database, 'a')).toHaveProperty(field as string, 1);
  });

  it('tracks general/Phoenix longest straights and clean/dirty achievements', () => {
    addRound();
    for (const [sequence, cards, length] of [[1, '[0,14,2,16,4,18,6,20,8,22,10,24,12]', 13], [2, '[0,14,2,16,4,18,6,20,8,22,10,24,54]', 13]]) {
      database.client.prepare(`INSERT INTO plays (game_id,round_number,trick_number,sequence_number,seat,
        action_type,cards,combination_type,combination_length) VALUES (1,1,1,?,'north','play',?,'straight',?)`)
        .run(sequence, cards, length);
    }
    rebuildStatsCache(database);
    expect(getPlayerProfile(database, 'a')).toMatchObject({ longestStraight: 13, longestStraightWithPhoenix: 13,
      theTichuClean: 1, theTichuDirty: 1 });
  });

  it('tracks a longer ordinary straight independently of the Phoenix record', () => {
    addRound();
    database.client.exec(`INSERT INTO plays (game_id,round_number,trick_number,sequence_number,seat,
      action_type,cards,combination_type,combination_length) VALUES
      (1,1,1,1,'north','play','[0,14,2,16,4,18,6,20,8]','straight',9),
      (1,1,2,2,'north','play','[0,14,2,16,4,18,54]','straight',7);`);
    rebuildStatsCache(database);
    expect(getPlayerProfile(database, 'a')).toMatchObject({ longestStraight: 9, longestStraightWithPhoenix: 7 });
  });

  it('counts only maximal runs, while retaining an overlapping four-of-a-kind', () => {
    const hand = [0, 1, 2, 3, 4, 5, 6, 15, 28, 41];
    expect(getPassBombs(hand)).toHaveLength(2);
    expect(countBombContributions(hand, [2])).toBe(2);
    expect(countBombContributions(hand, [55])).toBe(0);
    expect(countBombContributions([0, 1, 2, 3, 4, 5], [5])).toBe(1);
    expect(getPassBombs([0, 1, 2, 3, 4, 8, 9, 10, 11, 12])).toHaveLength(2);
    expect(getPassBombs([54, 55, -1, 56])).toHaveLength(0);
  });

  it('credits both received directions once and the distinct bomb total once', () => {
    expect(getReceivedBombStats([0, 13, 26, 39], [0], [13, 26])).toEqual({ partner: 1, opponent: 1, total: 1 });
    expect(getReceivedBombStats([0, 13, 26, 39], [], [13, 26])).toEqual({ partner: 0, opponent: 1, total: 1 });
    expect(getReceivedBombStats([0, 13, 26, 39], [0], [])).toEqual({ partner: 1, opponent: 0, total: 1 });
  });

  it('attributes given bombs to recipient hands and receives shared bombs without duplication', () => {
    addRound();
    database.client.exec(`UPDATE player_rounds SET hand_after_pass='[0,13,26,39]',
      received_from_partner='0',received_from_left='13',received_from_right='26',
      passed_to_partner='1',passed_to_left='2',passed_to_right='55' WHERE seat='north';
      UPDATE player_rounds SET hand_after_pass='[1,14,27,40]' WHERE seat='south';
      UPDATE player_rounds SET hand_after_pass='[2,15,28,41]' WHERE seat='east';
      UPDATE player_rounds SET hand_after_pass='[3,16,29,42]' WHERE seat='west';`);
    rebuildStatsCache(database);
    expect(getPlayerProfile(database, 'a')).toMatchObject({ bombGivenToPartner: 1, bombGivenToOpponent: 1,
      bombReceivedFromPartner: 1, bombReceivedFromOpponent: 1, totalBombsReceived: 1 });
  });

  it('credits two bombs by one seat and separates Blind Grand broken calls', () => {
    addRound();
    database.client.exec(`UPDATE player_rounds SET blind_grand_tichu_call=1,tichu_call_success=0 WHERE seat IN ('south','east');
      UPDATE player_rounds SET finish_position=1 WHERE seat='north';
      INSERT INTO plays (game_id,round_number,trick_number,sequence_number,seat,action_type,is_bomb)
      VALUES (1,1,1,1,'north','bomb',1),(1,1,1,2,'north','bomb',1);`);
    rebuildStatsCache(database);
    expect(getPlayerProfile(database, 'a')).toMatchObject({ doubleBombInTrick: 1, opponentBlindGrandTichuBroken: 1,
      partnerBlindGrandTichuBroken: 1, opponentGrandTichuBroken: 0 });
    expect(getPlayerProfile(database, 'c')).toMatchObject({ blindGrandTichuBrokenByPartner: 1 });
  });

  it('uses shared rounds for replaced partners, including a non-final participant', () => {
    addRound(1, 'a', 'c');
    addRound(2, 'e', 'c');
    database.client.exec(`UPDATE games SET north_user_id='e';
      UPDATE game_rounds SET one_two_bonus='NS';
      INSERT INTO game_rounds (game_id,round_number,card_points_ns,card_points_ew,total_ns,total_ew,finish_order,one_two_bonus)
      VALUES (1,2,50,50,50,50,'[]','NS');`);
    rebuildStatsCache(database);
    expect(getPlayerRelationships(database, 'a').find(row => row.userId === 'c')).toMatchObject({
      partnerGamesPlayed: 1, partnerGamesWon: 0, partnerOneTwoWins: 1,
    });
    expect(getPlayerRelationships(database, 'c').find(row => row.userId === 'a')).toMatchObject({ partnerOneTwoWins: 1 });
  });
});
