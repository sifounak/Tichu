// Verifies: REQ-F-ST02–ST06, REQ-NF-02, REQ-NF-03

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createDatabase, type Database } from '../../src/db/connection.js';
import {
  writeEventData,
  writeRecoveryFile,
  deleteRecoveryFile,
  recoverFromCrash,
  writeEventDataOnAbandon,
} from '../../src/db/event-persistence.js';
import type { GameEventAccumulator, RoundEventData, PlayerRoundRecord } from '../../src/game/event-types.js';
import { createEmptyRoundData, createBlankPlayerRound, createGameAccumulator } from '../../src/game/event-types.js';

// ─── Helpers ─────────────────────────────────────────────────────────

const TEST_DB_PATH = './data/test-event-persistence.sqlite';
const RECOVERY_DIR = path.join(process.cwd(), 'data', 'recovery');

function makeTestAccumulator(gameId: number = 1): GameEventAccumulator {
  const acc = createGameAccumulator(gameId);
  const round = createEmptyRoundData(1, 0, 0);

  // Add player rounds
  for (const seat of ['north', 'east', 'south', 'west'] as const) {
    const pr = createBlankPlayerRound(gameId, 1, seat, seat === 'north' ? 'user1' : null);
    pr.first8Cards = [1, 2, 3, 4, 5, 6, 7, 8];
    pr.grandTichuCall = false;
    pr.tichuCall = seat === 'north';
    pr.finishPosition = seat === 'north' ? 1 : seat === 'east' ? 2 : seat === 'south' ? 3 : 4;
    pr.cardPointsCaptured = seat === 'north' ? 50 : 0;
    round.playerRounds.push(pr);
  }

  // Add a trick
  round.tricks.push({
    gameId,
    roundNumber: 1,
    trickNumber: 1,
    leadSeat: 'north',
    leadCombinationType: 'single',
    leadCombinationRank: 5,
    leadCombinationLength: 1,
    winnerSeat: 'east',
    pointValue: 15,
    trickLength: 2,
    uncontested: false,
    winningCombinationType: 'single',
    winningCombinationRank: 10,
    winningCombinationLength: 1,
    containsDragon: false,
    containsPhoenix: false,
    activeTichuSeats: ['north'],
  });

  // Add a play
  round.plays.push({
    gameId,
    roundNumber: 1,
    trickNumber: 1,
    sequenceNumber: 1,
    seat: 'north',
    actionType: 'play',
    actionAt: '2026-01-01T00:00:00.000Z',
    actionSource: 'player',
    cards: [1],
    combinationType: 'single',
    combinationRank: 5,
    combinationLength: 1,
    phoenixUsedAs: null,
    phoenixEffectiveValue: null,
    isBomb: false,
    legalPlayCount: 3,
    outOfTurn: false,
    interruptedSeat: null,
    endOfTrickBomb: null,
    playedOnTopOf: null,
    playerFinished: false,
    cardsRemainingAfter: 13,
    couldHaveGoneOut: false,
    playedMinimum: true,
    partnerCardsRemaining: 14,
    leftOppCardsRemaining: 14,
    rightOppCardsRemaining: 14,
    couldHavePlayed: null,
    hadBombAvailable: null,
    wishActive: false,
    wishRank: null,
    playForcedByWish: null,
    partnerTichuActive: false,
    opponentTichuActive: { left: null, right: null },
    turnStartedAt: '2026-01-01T00:00:00.000Z',
    durationMs: 1500,
  });

  acc.rounds.push(round);
  return acc;
}

function insertTestGame(database: Database): number {
  const { client } = database;
  const result = client.prepare(
    `INSERT INTO games (room_code, started_at, ended_at, winner_team,
      final_score_ns, final_score_ew, target_score, round_count,
      north_user_id, east_user_id, south_user_id, west_user_id,
      north_name, east_name, south_name, west_name)
    VALUES ('TEST', datetime('now'), datetime('now'), 'NS',
      500, 300, 1000, 1,
      null, null, null, null,
      'North', 'East', 'South', 'West')`,
  ).run();
  const gameId = Number(result.lastInsertRowid);
  // Insert a game_rounds row so the UPDATE in writeEventData can find it
  client.prepare(
    `INSERT INTO game_rounds (game_id, round_number, card_points_ns, card_points_ew,
      tichu_bonus_ns, tichu_bonus_ew, total_ns, total_ew, finish_order, tichu_calls)
    VALUES (?, 1, 50, 50, 0, 0, 50, 50, '["north","east","south","west"]', '{}')`,
  ).run(gameId);
  return gameId;
}

function cleanupRecoveryFiles(): void {
  if (fs.existsSync(RECOVERY_DIR)) {
    for (const f of fs.readdirSync(RECOVERY_DIR)) {
      if (f.startsWith('game-') && f.endsWith('.json')) {
        fs.unlinkSync(path.join(RECOVERY_DIR, f));
      }
    }
  }
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('Event Persistence', () => {
  let database: Database;

  beforeEach(() => {
    // Clean up any leftover test DB
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    database = createDatabase(TEST_DB_PATH);
    cleanupRecoveryFiles();
  });

  afterEach(() => {
    database.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    cleanupRecoveryFiles();
  });

  // ─── REQ-F-ST03: Batch write ──────────────────────────────────

  describe('REQ-F-ST03: Batch write at game end', () => {
    it('should write all event data in a single transaction', () => {
      const dbGameId = insertTestGame(database);
      const acc = makeTestAccumulator(dbGameId);

      writeEventData(database, dbGameId, acc);

      // Verify player_rounds were written
      const prRows = database.client.prepare(
        `SELECT * FROM player_rounds WHERE game_id = ${dbGameId}`,
      ).all() as any[];
      expect(prRows).toHaveLength(4);

      // Verify tricks were written
      const trickRows = database.client.prepare(
        `SELECT * FROM tricks WHERE game_id = ${dbGameId}`,
      ).all() as any[];
      expect(trickRows).toHaveLength(1);
      expect(trickRows[0].winner_seat).toBe('east');

      // Verify plays were written
      const playRows = database.client.prepare(
        `SELECT * FROM plays WHERE game_id = ${dbGameId}`,
      ).all() as any[];
      expect(playRows).toHaveLength(1);
      expect(playRows[0].seat).toBe('north');
      expect(playRows[0].action_type).toBe('play');
    });

    it('should update game_rounds with score-at-start fields', () => {
      const dbGameId = insertTestGame(database);
      const acc = makeTestAccumulator(dbGameId);
      acc.rounds[0].scoreNSAtStart = 250;
      acc.rounds[0].scoreEWAtStart = 150;

      writeEventData(database, dbGameId, acc);

      const roundRows = database.client.prepare(
        `SELECT score_ns_at_start, score_ew_at_start FROM game_rounds WHERE game_id = ${dbGameId}`,
      ).all() as any[];
      expect(roundRows[0].score_ns_at_start).toBe(250);
      expect(roundRows[0].score_ew_at_start).toBe(150);
    });

    it('should write special events (wish, dragon, dog)', () => {
      const dbGameId = insertTestGame(database);
      const acc = makeTestAccumulator(dbGameId);

      // Add wish event
      acc.rounds[0].wishEvent = {
        gameId: dbGameId,
        roundNumber: 1,
        wishRank: 8,
        trickNumber: 1,
        cardsOfRankRemaining: 3,
        cardsOfRankInWisherHand: 0,
        wishFulfilledTrick: 2,
        wishFulfilledBy: 'east',
      };

      // Add dragon gift event
      acc.rounds[0].dragonGiftEvents.push({
        gameId: dbGameId,
        roundNumber: 1,
        trickNumber: 2,
        gifterSeat: 'north',
        recipientSeat: 'east',
        trickPointValue: 35,
        recipientCardsLeft: 5,
        otherOpponentCardsLeft: 3,
        gifterFinishedOnPlay: false,
        recipientHasTichu: false,
        otherOpponentHasTichu: false,
        giftWasForced: false,
      });

      // Add dog play event
      acc.rounds[0].dogPlayEvents.push({
        gameId: dbGameId,
        roundNumber: 1,
        trickNumber: 3,
        playerSeat: 'south',
        controlPassedTo: 'north',
        partnerAlreadyOut: false,
        partnerHasTichu: true,
        hadPriorLeadOpportunity: false,
        dogWasLastCard: false,
      });

      writeEventData(database, dbGameId, acc);

      const wishRows = database.client.prepare(`SELECT * FROM wish_events WHERE game_id = ${dbGameId}`).all() as any[];
      expect(wishRows).toHaveLength(1);
      expect(wishRows[0].wish_rank).toBe(8);

      const dragonRows = database.client.prepare(`SELECT * FROM dragon_gift_events WHERE game_id = ${dbGameId}`).all() as any[];
      expect(dragonRows).toHaveLength(1);
      expect(dragonRows[0].trick_point_value).toBe(35);

      const dogRows = database.client.prepare(`SELECT * FROM dog_play_events WHERE game_id = ${dbGameId}`).all() as any[];
      expect(dogRows).toHaveLength(1);
      expect(dogRows[0].partner_has_tichu).toBe(1); // boolean → integer in SQLite
    });

    it('should write bomb inventory and bomb events', () => {
      const dbGameId = insertTestGame(database);
      const acc = makeTestAccumulator(dbGameId);

      acc.rounds[0].bombInventory.push({
        gameId: dbGameId,
        roundNumber: 1,
        playerSeat: 'north',
        bombType: 'fourOfAKind',
        cards: [10, 11, 12, 13],
        rank: 7,
        size: 4,
        acquiredPhase: 'postPass',
        bombPlaysFromRun: 0,
        overlapsWith: [],
        fate: 'heldToEnd',
        fateTrickNumber: null,
        fateTarget: null,
        outOfTurn: null,
        endOfTrickBomb: null,
        playsSeenWhileHeld: 15,
        capturedDragon: false,
        wasOverbomb: false,
        followedByDog: false,
      });

      writeEventData(database, dbGameId, acc);

      const bombRows = database.client.prepare(`SELECT * FROM bomb_inventory WHERE game_id = ${dbGameId}`).all() as any[];
      expect(bombRows).toHaveLength(1);
      expect(bombRows[0].bomb_type).toBe('fourOfAKind');
      expect(bombRows[0].fate).toBe('heldToEnd');
      expect(bombRows[0].plays_seen_while_held).toBe(15);
    });
  });

  // ─── REQ-F-ST02: Recovery file serialization ──────────────────

  describe('REQ-F-ST02: Recovery file serialization', () => {
    it('should write valid JSON recovery file', () => {
      const acc = makeTestAccumulator(42);
      writeRecoveryFile(42, acc);

      const filePath = path.join(RECOVERY_DIR, 'game-42.json');
      expect(fs.existsSync(filePath)).toBe(true);

      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.gameId).toBe(42);
      expect(parsed.rounds).toHaveLength(1);
    });

    it('should overwrite on subsequent writes', () => {
      const acc1 = makeTestAccumulator(42);
      writeRecoveryFile(42, acc1);

      // Add a second round
      acc1.rounds.push(createEmptyRoundData(2, 100, 50));
      writeRecoveryFile(42, acc1);

      const content = fs.readFileSync(path.join(RECOVERY_DIR, 'game-42.json'), 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.rounds).toHaveLength(2);
    });
  });

  // ─── REQ-F-ST04: Recovery file cleanup ─────────────────────────

  describe('REQ-F-ST04: Recovery file cleanup', () => {
    it('should delete recovery file', () => {
      writeRecoveryFile(42, makeTestAccumulator(42));
      const filePath = path.join(RECOVERY_DIR, 'game-42.json');
      expect(fs.existsSync(filePath)).toBe(true);

      deleteRecoveryFile(42);
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should not throw when file does not exist', () => {
      expect(() => deleteRecoveryFile(999)).not.toThrow();
    });
  });

  // ─── REQ-F-ST05: Server restart recovery ───────────────────────

  describe('REQ-F-ST05: Server restart recovery', () => {
    it('should recover data from crash recovery files', () => {
      // Insert a game first (recovery needs game_rounds to exist)
      const dbGameId = insertTestGame(database);

      // Write a recovery file
      const acc = makeTestAccumulator(dbGameId);
      writeRecoveryFile(dbGameId, acc);

      // Simulate server restart — call recoverFromCrash
      recoverFromCrash(database);

      // Recovery file should be cleaned up
      const filePath = path.join(RECOVERY_DIR, `game-${dbGameId}.json`);
      expect(fs.existsSync(filePath)).toBe(false);

      // Data should be in the database
      const prRows = database.client.prepare(
        `SELECT * FROM player_rounds WHERE game_id = ${dbGameId}`,
      ).all() as any[];
      expect(prRows).toHaveLength(4);
    });

    it('should discard corrupt recovery files without crashing', () => {
      // Write a corrupt file
      if (!fs.existsSync(RECOVERY_DIR)) fs.mkdirSync(RECOVERY_DIR, { recursive: true });
      fs.writeFileSync(path.join(RECOVERY_DIR, 'game-999.json'), 'not valid json{{{');

      // Should not throw
      expect(() => recoverFromCrash(database)).not.toThrow();

      // Corrupt file should be cleaned up
      expect(fs.existsSync(path.join(RECOVERY_DIR, 'game-999.json'))).toBe(false);
    });

    it('should discard recovery files with no rounds', () => {
      if (!fs.existsSync(RECOVERY_DIR)) fs.mkdirSync(RECOVERY_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(RECOVERY_DIR, 'game-888.json'),
        JSON.stringify({ gameId: 888, rounds: [] }),
      );

      recoverFromCrash(database);
      expect(fs.existsSync(path.join(RECOVERY_DIR, 'game-888.json'))).toBe(false);
    });
  });

  // ─── REQ-F-ST06: Game abandonment ──────────────────────────────

  describe('REQ-F-ST06: Game abandonment handling', () => {
    it('should persist partial data on abandonment', () => {
      const dbGameId = insertTestGame(database);
      const acc = makeTestAccumulator(dbGameId);

      // Write recovery file first (simulates round-end serialization)
      writeRecoveryFile(dbGameId, acc);

      // Abandon game — should persist and clean up recovery
      writeEventDataOnAbandon(database, dbGameId, acc);

      // Data should be in DB
      const prRows = database.client.prepare(
        `SELECT * FROM player_rounds WHERE game_id = ${dbGameId}`,
      ).all() as any[];
      expect(prRows).toHaveLength(4);

      // Recovery file should be cleaned up
      expect(fs.existsSync(path.join(RECOVERY_DIR, `game-${dbGameId}.json`))).toBe(false);
    });

    it('should handle empty accumulator gracefully', () => {
      const acc = createGameAccumulator(1);
      expect(() => writeEventDataOnAbandon(database, 1, acc)).not.toThrow();
    });
  });

  // ─── REQ-NF-02: Write latency ─────────────────────────────────

  describe('REQ-NF-02: Write latency', () => {
    it('should write a full game in under 500ms', () => {
      const dbGameId = insertTestGame(database);
      const acc = makeTestAccumulator(dbGameId);

      // Add more data to simulate a realistic game
      for (let r = 2; r <= 8; r++) {
        const round = createEmptyRoundData(r, r * 50, r * 30);
        for (const seat of ['north', 'east', 'south', 'west'] as const) {
          round.playerRounds.push(createBlankPlayerRound(dbGameId, r, seat, null));
        }
        // Add some plays
        for (let t = 1; t <= 8; t++) {
          round.tricks.push({
            gameId: dbGameId, roundNumber: r, trickNumber: t,
            leadSeat: 'north', leadCombinationType: 'single',
            leadCombinationRank: t + 1, leadCombinationLength: 1,
            winnerSeat: 'east', pointValue: 10, trickLength: 2,
            uncontested: false, winningCombinationType: 'single',
            winningCombinationRank: t + 5, winningCombinationLength: 1,
            containsDragon: false, containsPhoenix: false,
            activeTichuSeats: [],
          });
          for (let s = 0; s < 4; s++) {
            round.plays.push({
              gameId: dbGameId, roundNumber: r, trickNumber: t,
              sequenceNumber: s + 1, seat: ['north', 'east', 'south', 'west'][s] as any,
              actionType: s < 2 ? 'play' : 'pass', actionAt: new Date().toISOString(),
              actionSource: 'bot', cards: s < 2 ? [s * 10 + t] : null,
              combinationType: s < 2 ? 'single' : null,
              combinationRank: s < 2 ? t + s : null, combinationLength: s < 2 ? 1 : null,
              phoenixUsedAs: null, phoenixEffectiveValue: null,
              isBomb: s < 2 ? false : null, legalPlayCount: 5,
              outOfTurn: s < 2 ? false : null, interruptedSeat: null,
              endOfTrickBomb: null, playedOnTopOf: null,
              playerFinished: false, cardsRemainingAfter: 10 - t,
              couldHaveGoneOut: false, playedMinimum: false,
              partnerCardsRemaining: 10, leftOppCardsRemaining: 10,
              rightOppCardsRemaining: 10,
              couldHavePlayed: s >= 2 ? true : null, hadBombAvailable: s >= 2 ? false : null,
              wishActive: false, wishRank: null, playForcedByWish: null,
              partnerTichuActive: false, opponentTichuActive: { left: null, right: null },
              turnStartedAt: null, durationMs: null,
            });
          }
        }
        // Need game_rounds rows for the UPDATE
        database.client.prepare(
          `INSERT INTO game_rounds (game_id, round_number, card_points_ns, card_points_ew,
            tichu_bonus_ns, tichu_bonus_ew, total_ns, total_ew, finish_order, tichu_calls)
          VALUES (?, ?, 50, 50, 0, 0, 50, 50, '[]', '{}')`,
        ).run(dbGameId, r
        );
        acc.rounds.push(round);
      }

      const start = performance.now();
      writeEventData(database, dbGameId, acc);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(500);
    });
  });

  // ─── REQ-NF-03: Recovery file size ─────────────────────────────

  describe('REQ-NF-03: Recovery file size', () => {
    it('should produce recovery file under 200KB for 8-round game', () => {
      const acc = makeTestAccumulator(1);
      // Add 7 more rounds of data
      for (let r = 2; r <= 8; r++) {
        const round = createEmptyRoundData(r, r * 50, r * 30);
        for (const seat of ['north', 'east', 'south', 'west'] as const) {
          round.playerRounds.push(createBlankPlayerRound(1, r, seat, null));
        }
        for (let t = 1; t <= 8; t++) {
          round.tricks.push({
            gameId: 1, roundNumber: r, trickNumber: t,
            leadSeat: 'north', leadCombinationType: 'single',
            leadCombinationRank: 5, leadCombinationLength: 1,
            winnerSeat: 'east', pointValue: 10, trickLength: 2,
            uncontested: false, winningCombinationType: 'single',
            winningCombinationRank: 10, winningCombinationLength: 1,
            containsDragon: false, containsPhoenix: false,
            activeTichuSeats: [],
          });
        }
        acc.rounds.push(round);
      }

      writeRecoveryFile(1, acc);
      const stats = fs.statSync(path.join(RECOVERY_DIR, 'game-1.json'));
      expect(stats.size).toBeLessThan(200 * 1024); // 200 KB
    });
  });
});
