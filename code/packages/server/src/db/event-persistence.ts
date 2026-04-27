// REQ-F-ST02–ST06: Event data persistence — batch writes, recovery files, abandonment handling

import { sql } from 'drizzle-orm';
import type { Database } from './connection.js';
import {
  playerRounds,
  tricks,
  plays,
  wishEvents,
  dragonGiftEvents,
  dogPlayEvents,
  bombInventory,
  bombEvents,
} from './schema.js';
import type { GameEventAccumulator } from '../game/event-types.js';
import { updateCacheAfterGame } from './stats-cache.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ─── Recovery File Path ─────────────────────────────────────────────────
// Derive recovery directory from DATABASE_PATH so it lives alongside the
// database file (e.g. /files/.www/tichu/data/recovery in production) rather
// than under process.cwd() which may not be writable by the service user.

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'tichu.sqlite');
const RECOVERY_DIR = path.join(path.dirname(dbPath), 'recovery');

/** Ensure the recovery directory exists */
function ensureRecoveryDir(): void {
  if (!fs.existsSync(RECOVERY_DIR)) {
    fs.mkdirSync(RECOVERY_DIR, { recursive: true });
  }
}

/** Get the recovery file path for a given game ID */
function getRecoveryPath(gameId: number): string {
  return path.join(RECOVERY_DIR, `game-${gameId}.json`);
}

// ─── REQ-F-ST03: Batch Write ────────────────────────────────────────────

/**
 * REQ-F-ST03: Write all accumulated event data for a completed game in a single transaction.
 * Inserts into: player_rounds, tricks, plays, wish_events, dragon_gift_events,
 * dog_play_events, bomb_inventory, bomb_events, and updates game_rounds with score-at-start.
 *
 * @param database - The database connection
 * @param dbGameId - The database game ID (from games table insert)
 * @param accumulator - The in-memory accumulated event data
 */
export function writeEventData(database: Database, dbGameId: number, accumulator: GameEventAccumulator): void {
  const { db } = database;
  db.transaction((tx: any) => {
    for (const round of accumulator.rounds) {
      // Update game_rounds with score-at-start fields (REQ-F-SC02)
      tx.run(sql`UPDATE game_rounds SET
        score_ns_at_start = ${round.scoreNSAtStart},
        score_ew_at_start = ${round.scoreEWAtStart},
        started_at = ${round.startedAt}
        WHERE game_id = ${dbGameId} AND round_number = ${round.roundNumber}`);

      // Insert player rounds (REQ-F-SC03)
      for (const pr of round.playerRounds) {
        tx.insert(playerRounds).values({
          gameId: dbGameId,
          roundNumber: pr.roundNumber,
          seat: pr.seat,
          userId: pr.userId,
          first8Cards: pr.first8Cards,
          fullHandPrePass: pr.fullHandPrePass,
          passedToLeft: pr.passedToLeft as any,
          passedToPartner: pr.passedToPartner as any,
          passedToRight: pr.passedToRight as any,
          receivedFromLeft: pr.receivedFromLeft as any,
          receivedFromPartner: pr.receivedFromPartner as any,
          receivedFromRight: pr.receivedFromRight as any,
          handAfterPass: pr.handAfterPass,
          grandTichuCall: pr.grandTichuCall,
          tichuCall: pr.tichuCall,
          tichuCallPhase: pr.tichuCallPhase,
          tichuCallTrickNumber: pr.tichuCallTrickNumber,
          tichuCallHandSizes: pr.tichuCallHandSizes as any,
          tichuCallSuccess: pr.tichuCallSuccess,
          finishPosition: pr.finishPosition,
          finishTrickNumber: pr.finishTrickNumber,
          cardPointsCaptured: pr.cardPointsCaptured,
          handPointsGivenToOpponents: pr.handPointsGivenToOpponents,
          capturedPointsGivenToFirstOut: pr.capturedPointsGivenToFirstOut,
          trickPointRunningTotal: pr.trickPointRunningTotal as any,
        }).run();
      }

      // Insert tricks (REQ-F-SC04)
      for (const trick of round.tricks) {
        tx.insert(tricks).values({
          gameId: dbGameId,
          roundNumber: trick.roundNumber,
          trickNumber: trick.trickNumber,
          leadSeat: trick.leadSeat,
          leadCombinationType: trick.leadCombinationType,
          leadCombinationRank: trick.leadCombinationRank,
          leadCombinationLength: trick.leadCombinationLength,
          winnerSeat: trick.winnerSeat,
          pointValue: trick.pointValue,
          trickLength: trick.trickLength,
          uncontested: trick.uncontested,
          winningCombinationType: trick.winningCombinationType,
          winningCombinationRank: trick.winningCombinationRank,
          winningCombinationLength: trick.winningCombinationLength,
          containsDragon: trick.containsDragon,
          containsPhoenix: trick.containsPhoenix,
          activeTichuSeats: trick.activeTichuSeats as any,
        }).run();
      }

      // Insert plays (REQ-F-SC05)
      for (const play of round.plays) {
        tx.insert(plays).values({
          gameId: dbGameId,
          roundNumber: play.roundNumber,
          trickNumber: play.trickNumber,
          sequenceNumber: play.sequenceNumber,
          seat: play.seat,
          actionType: play.actionType,
          actionAt: play.actionAt,
          actionSource: play.actionSource,
          cards: play.cards as any,
          combinationType: play.combinationType,
          combinationRank: play.combinationRank,
          combinationLength: play.combinationLength,
          phoenixUsedAs: play.phoenixUsedAs,
          phoenixEffectiveValue: play.phoenixEffectiveValue,
          isBomb: play.isBomb,
          legalPlayCount: play.legalPlayCount,
          outOfTurn: play.outOfTurn,
          interruptedSeat: play.interruptedSeat,
          endOfTrickBomb: play.endOfTrickBomb,
          playedOnTopOf: play.playedOnTopOf,
          playerFinished: play.playerFinished,
          cardsRemainingAfter: play.cardsRemainingAfter,
          couldHaveGoneOut: play.couldHaveGoneOut,
          playedMinimum: play.playedMinimum,
          partnerCardsRemaining: play.partnerCardsRemaining,
          leftOppCardsRemaining: play.leftOppCardsRemaining,
          rightOppCardsRemaining: play.rightOppCardsRemaining,
          couldHavePlayed: play.couldHavePlayed,
          hadBombAvailable: play.hadBombAvailable,
          wishActive: play.wishActive,
          wishRank: play.wishRank,
          playForcedByWish: play.playForcedByWish,
          partnerTichuActive: play.partnerTichuActive,
          opponentTichuActive: play.opponentTichuActive as any,
          turnStartedAt: play.turnStartedAt,
          durationMs: play.durationMs,
        }).run();
      }

      // Insert wish event (REQ-F-SC06) — 0 or 1 per round
      if (round.wishEvent) {
        const w = round.wishEvent;
        tx.insert(wishEvents).values({
          gameId: dbGameId,
          roundNumber: w.roundNumber,
          wishRank: w.wishRank,
          trickNumber: w.trickNumber,
          cardsOfRankRemaining: w.cardsOfRankRemaining,
          cardsOfRankInWisherHand: w.cardsOfRankInWisherHand,
          wishFulfilledTrick: w.wishFulfilledTrick,
          wishFulfilledBy: w.wishFulfilledBy,
        }).run();
      }

      // Insert dragon gift events (REQ-F-SC07)
      for (const dg of round.dragonGiftEvents) {
        tx.insert(dragonGiftEvents).values({
          gameId: dbGameId,
          roundNumber: dg.roundNumber,
          trickNumber: dg.trickNumber,
          gifterSeat: dg.gifterSeat,
          recipientSeat: dg.recipientSeat,
          trickPointValue: dg.trickPointValue,
          recipientCardsLeft: dg.recipientCardsLeft,
          otherOpponentCardsLeft: dg.otherOpponentCardsLeft,
          gifterFinishedOnPlay: dg.gifterFinishedOnPlay,
          recipientHasTichu: dg.recipientHasTichu,
          otherOpponentHasTichu: dg.otherOpponentHasTichu,
          giftWasForced: dg.giftWasForced,
        }).run();
      }

      // Insert dog play events (REQ-F-SC08)
      for (const dp of round.dogPlayEvents) {
        tx.insert(dogPlayEvents).values({
          gameId: dbGameId,
          roundNumber: dp.roundNumber,
          trickNumber: dp.trickNumber,
          playerSeat: dp.playerSeat,
          controlPassedTo: dp.controlPassedTo,
          partnerAlreadyOut: dp.partnerAlreadyOut,
          partnerHasTichu: dp.partnerHasTichu,
          hadPriorLeadOpportunity: dp.hadPriorLeadOpportunity,
          dogWasLastCard: dp.dogWasLastCard,
        }).run();
      }

      // Insert bomb inventory (REQ-F-SC09) — track IDs for bomb events FK
      const bombIdMap = new Map<number, number>(); // index → db ID
      for (let i = 0; i < round.bombInventory.length; i++) {
        const bi = round.bombInventory[i];
        const result = tx.insert(bombInventory).values({
          gameId: dbGameId,
          roundNumber: bi.roundNumber,
          playerSeat: bi.playerSeat,
          bombType: bi.bombType,
          cards: bi.cards as any,
          rank: bi.rank,
          size: bi.size,
          acquiredPhase: bi.acquiredPhase,
          bombPlaysFromRun: bi.bombPlaysFromRun,
          overlapsWith: bi.overlapsWith as any,
          fate: bi.fate,
          fateTrickNumber: bi.fateTrickNumber,
          fateTarget: bi.fateTarget,
          outOfTurn: bi.outOfTurn,
          endOfTrickBomb: bi.endOfTrickBomb,
          playsSeenWhileHeld: bi.playsSeenWhileHeld,
          capturedDragon: bi.capturedDragon,
          wasOverbomb: bi.wasOverbomb,
          followedByDog: bi.followedByDog,
        }).returning({ id: bombInventory.id }).get();
        bombIdMap.set(i, result.id);
      }

      // Insert bomb events (REQ-F-SC10)
      for (const be of round.bombEvents) {
        const inventoryId = bombIdMap.get(be.bombInventoryIndex) ?? 0;
        tx.insert(bombEvents).values({
          gameId: dbGameId,
          roundNumber: be.roundNumber,
          bombInventoryId: inventoryId,
          eventType: be.eventType,
          trickNumber: be.trickNumber,
          followedByDog: be.followedByDog,
          cardLost: be.cardLost,
          couldHavePlayedBomb: be.couldHavePlayedBomb,
          runLengthChange: be.runLengthChange,
        }).run();
      }
    }
  });
}

// ─── REQ-F-ST02: Recovery File Serialization ────────────────────────────

/**
 * REQ-F-ST02: Serialize accumulated event data to a JSON recovery file.
 * Called at each round end. One file per game, overwritten each round.
 */
export function writeRecoveryFile(gameId: number, accumulator: GameEventAccumulator): void {
  try {
    ensureRecoveryDir();
    const filePath = getRecoveryPath(gameId);
    const json = JSON.stringify(accumulator);
    fs.writeFileSync(filePath, json, 'utf-8');
  } catch (err) {
    console.error(`[RECOVERY] Failed to write recovery file for game ${gameId}:`, err);
  }
}

// ─── REQ-F-ST04: Recovery File Cleanup ──────────────────────────────────

/**
 * REQ-F-ST04: Delete recovery file on successful batch write.
 */
export function deleteRecoveryFile(gameId: number): void {
  try {
    const filePath = getRecoveryPath(gameId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error(`[RECOVERY] Failed to delete recovery file for game ${gameId}:`, err);
  }
}

// ─── REQ-F-ST05: Server Restart Recovery ────────────────────────────────

/**
 * REQ-F-ST05: On server startup, check for recovery files and persist any found data.
 * Corrupt files are logged and discarded, not crash the server.
 */
export function recoverFromCrash(database: Database): void {
  try {
    ensureRecoveryDir();
    const files = fs.readdirSync(RECOVERY_DIR).filter(f => f.startsWith('game-') && f.endsWith('.json'));

    for (const file of files) {
      const filePath = path.join(RECOVERY_DIR, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const accumulator: GameEventAccumulator = JSON.parse(content);

        if (!accumulator.gameId || !Array.isArray(accumulator.rounds)) {
          console.warn(`[RECOVERY] Invalid recovery file ${file} — discarding`);
          fs.unlinkSync(filePath);
          continue;
        }

        if (accumulator.rounds.length === 0) {
          // No data to recover
          fs.unlinkSync(filePath);
          continue;
        }

        console.log(`[RECOVERY] Recovering event data for game ${accumulator.gameId} (${accumulator.rounds.length} rounds)`);
        writeEventData(database, accumulator.gameId, accumulator);
        // REQ-F-MC03: Update cache after recovery
        try { updateCacheAfterGame(database, accumulator.gameId); } catch { /* cache update failure is non-fatal */ }
        fs.unlinkSync(filePath);
        console.log(`[RECOVERY] Successfully recovered game ${accumulator.gameId}`);
      } catch (err) {
        console.warn(`[RECOVERY] Corrupt recovery file ${file} — discarding:`, err);
        try { fs.unlinkSync(filePath); } catch { /* ignore cleanup failure */ }
      }
    }
  } catch (err) {
    console.warn('[RECOVERY] Failed to scan recovery directory:', err);
  }
}

// ─── REQ-F-ST06: Game Abandonment Handling ──────────────────────────────

/**
 * REQ-F-ST06: Write whatever accumulated data exists when a game is abandoned.
 * Extends existing savePassStatsOnAbandon pattern.
 */
export function writeEventDataOnAbandon(database: Database, dbGameId: number, accumulator: GameEventAccumulator): void {
  if (accumulator.rounds.length === 0) return;

  try {
    writeEventData(database, dbGameId, accumulator);
    deleteRecoveryFile(accumulator.gameId);
  } catch (err) {
    console.error(`[ABANDON] Failed to persist event data for abandoned game ${dbGameId}:`, err);
  }
}
