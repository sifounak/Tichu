// REQ-F-CP01: Hybrid capture architecture — pre-play enrichment + post-play observation
// REQ-F-ST01: In-memory accumulation of all event data during gameplay
// REQ-F-CP03: Post-play observation via state diffs
// REQ-F-CP04: Rejected play cleanup

import type { Seat, RoundState, GameCard, TrickState } from '@tichu/shared';
import {
  isDragon,
  isPhoenix,
  isMahjong,
  getTeam,
  getPartner,
  SEATS_IN_ORDER,
  detectAllBombs,
  CombinationType,
  getValidPlays,
} from '@tichu/shared';
import { GamePhase } from '@tichu/shared';
import type { GameMachineContext } from './game-state-machine.js';
import type {
  PrePlayContext,
  PlayerRoundRecord,
  TrickRecord,
  PlayRecord,
  WishEventRecord,
  DragonGiftEventRecord,
  DogPlayEventRecord,
  BombInventoryRecord,
  BombEventRecord,
  RoundEventData,
  GameEventAccumulator,
  PlayActionType,
  BombType,
} from './event-types.js';
import {
  createEmptyRoundData,
  createGameAccumulator,
  createBlankPlayerRound,
} from './event-types.js';

// ─── GameEventCapture ───────────────────────────────────────────────────

/**
 * REQ-F-CP01: Captures game events using a hybrid architecture:
 * - Pre-play enrichment: GameManager computes context before actor.send()
 * - Post-play observation: this class detects events via state diffs
 *
 * Accumulates all data in memory (REQ-F-ST01) for later batch persistence.
 */
export class GameEventCapture {
  private accumulator: GameEventAccumulator;
  private currentRound: RoundEventData | null = null;
  private prevContext: GameMachineContext | null = null;

  // REQ-F-CP02/CP04: Pending pre-play contexts awaiting state-diff matching
  private pendingPrePlay = new Map<Seat, PrePlayContext>();

  // Track trick/sequence numbering within a round
  private trickNumber = 0;
  private sequenceNumber = 0;

  // Track which tricks each player has led (for hadPriorLeadOpportunity in dog events)
  private tricksLedBy = new Set<Seat>();

  // Bomb inventory tracking for erosion/fate
  private bombInventoryBySeat = new Map<Seat, BombInventoryRecord[]>();

  // Player round records indexed by seat for fast access
  private playerRoundMap = new Map<Seat, PlayerRoundRecord>();

  // Track running card points per player (for trickPointRunningTotal)
  private runningPointsBySeat = new Map<Seat, number>();

  // Track plays seen by other players while bombs are held (for playsSeenWhileHeld)
  private totalPlaysThisRound = 0;
  private bombInventoryPlayCountAtCreation = new Map<BombInventoryRecord, number>();

  // REQ-F-CP07: Track whether initial hands have been captured
  private initialHandsCaptured = false;

  constructor(gameId: number) {
    this.accumulator = createGameAccumulator(gameId);
  }

  /** Get the accumulated game data */
  getAccumulator(): GameEventAccumulator {
    return this.accumulator;
  }

  /** Get the current in-progress round data (for recovery file serialization) */
  getCurrentRound(): RoundEventData | null {
    return this.currentRound;
  }

  // ─── Pre-Play Context Management ────────────────────────────────────

  /** REQ-F-CP02: Record pre-play context computed by GameManager */
  recordPrePlayContext(seat: Seat, context: PrePlayContext): void {
    this.pendingPrePlay.set(seat, context);
  }

  /** REQ-F-CP04: Discard pre-play context when play is rejected by state machine */
  discardPrePlayContext(seat: Seat): void {
    this.pendingPrePlay.delete(seat);
  }

  // ─── Round Lifecycle ────────────────────────────────────────────────

  /** REQ-F-CP06: Initialize a new round with scores-at-start */
  initRound(roundNumber: number, scoreNSAtStart: number, scoreEWAtStart: number): void {
    this.currentRound = createEmptyRoundData(roundNumber, scoreNSAtStart, scoreEWAtStart);
    this.trickNumber = 0;
    this.sequenceNumber = 0;
    this.tricksLedBy.clear();
    this.bombInventoryBySeat.clear();
    this.playerRoundMap.clear();
    this.runningPointsBySeat.clear();
    this.pendingPrePlay.clear();
    this.initialHandsCaptured = false;
    this.totalPlaysThisRound = 0;
    this.bombInventoryPlayCountAtCreation.clear();
  }

  /** REQ-F-CP06: Initialize player round records for all seats */
  initPlayerRounds(gameId: number, roundNumber: number, players: Record<Seat, { userId: string | null }>): void {
    if (!this.currentRound) return;
    for (const seat of SEATS_IN_ORDER) {
      const pr = createBlankPlayerRound(gameId, roundNumber, seat, players[seat].userId);
      this.playerRoundMap.set(seat, pr);
      this.currentRound.playerRounds.push(pr);
      this.runningPointsBySeat.set(seat, 0);
    }
  }

  /** Finalize round data and add to accumulator */
  finalizeRound(): void {
    if (!this.currentRound) return;

    // Finalize bomb inventory — any remaining bombs get fate 'heldToEnd'
    for (const bomb of this.currentRound.bombInventory) {
      if (bomb.fate === null) {
        bomb.fate = 'heldToEnd';
        bomb.playsSeenWhileHeld = this.totalPlaysThisRound -
          (this.bombInventoryPlayCountAtCreation.get(bomb) ?? 0);
      }
    }

    this.accumulator.rounds.push(this.currentRound);
    this.currentRound = null;
  }

  // ─── Main State-Diff Observer ───────────────────────────────────────

  /**
   * REQ-F-CP03: Called on every state transition.
   * Compares previous and current context to detect and capture events.
   */
  onStateChange(context: GameMachineContext): void {
    const round = context.currentRound;
    if (!round) {
      this.prevContext = context;
      return;
    }

    // Auto-init round when round number changes
    if (!this.currentRound || round.roundNumber !== this.currentRound.roundNumber) {
      this.initRound(
        round.roundNumber,
        context.scores.northSouth,
        context.scores.eastWest,
      );
      this.initPlayerRounds(
        parseInt(context.gameId) || 0,
        round.roundNumber,
        Object.fromEntries(SEATS_IN_ORDER.map(s => [s, { userId: null }])) as Record<Seat, { userId: string | null }>,
      );
    }

    const prev = this.prevContext;
    const prevRound = prev?.currentRound ?? null;

    if (prevRound) {
      // Phase transitions
      this.detectPhaseTransitions(prevRound, round, context);

      // Tichu/GT calls
      this.detectTichuCalls(prevRound, round);

      // Play/pass detection
      this.detectPlays(prevRound, round);

      // Trick completion
      this.detectTrickCompletion(prevRound, round);

      // Wish events
      this.detectWishDeclared(prevRound, round);
      this.detectWishFulfilled(prevRound, round);

      // Dragon gift
      this.detectDragonGift(prevRound, round);

      // Dog play
      this.detectDogPlay(prevRound, round);

      // Player finished
      this.detectPlayerFinished(prevRound, round);
    } else if (round.phase === GamePhase.GrandTichuDecision) {
      // First observation — capture initial hands
      this.captureInitialHands(round);
    }

    this.prevContext = structuredClone(context);
  }

  // ─── Phase Transition Detection ─────────────────────────────────────

  /** REQ-F-CP07: Detect phase transitions for hand snapshots and pass tracking */
  private detectPhaseTransitions(prev: RoundState, curr: RoundState, _context: GameMachineContext): void {
    // GrandTichuDecision → *: capture initial hands (first 8)
    if (prev.phase === GamePhase.GrandTichuDecision &&
        curr.phase !== GamePhase.GrandTichuDecision) {
      this.captureInitialHands(prev);
    }

    // CardPassing → Playing: exchange happened
    if (prev.phase === GamePhase.CardPassing && curr.phase === GamePhase.Playing) {
      // REQ-F-CP07: Capture pre-pass hands
      this.capturePrePassHands(prev);

      // REQ-F-CP07: Capture pass cards and received cards
      this.capturePassData(prev, curr);

      // REQ-F-CP07: Capture post-pass hands
      this.capturePostPassHands(curr);

      // REQ-F-CP15: Create bomb inventory after pass resolution
      this.createBombInventory(curr, prev);
    }
  }

  // ─── Hand Capture ───────────────────────────────────────────────────

  /** REQ-F-CP07: Capture first 8 cards at GT decision phase */
  private captureInitialHands(round: RoundState): void {
    if (this.initialHandsCaptured) return;
    this.initialHandsCaptured = true;

    for (const seat of SEATS_IN_ORDER) {
      const pr = this.playerRoundMap.get(seat);
      if (!pr) continue;
      const hand = round.players[seat].hand;
      if (hand.length <= 8) {
        pr.first8Cards = hand.map(gc => gc.id);
      }
    }
  }

  /** REQ-F-CP07: Capture full 14-card hand before passing */
  private capturePrePassHands(round: RoundState): void {
    for (const seat of SEATS_IN_ORDER) {
      const pr = this.playerRoundMap.get(seat);
      if (!pr) continue;
      pr.fullHandPrePass = round.players[seat].hand.map(gc => gc.id);
    }
  }

  /** REQ-F-CP07: Capture pass cards (given and received) */
  private capturePassData(_prevRound: RoundState, currRound: RoundState): void {
    for (const seat of SEATS_IN_ORDER) {
      const pr = this.playerRoundMap.get(seat);
      if (!pr) continue;
      const partner = getPartner(seat);

      // Determine left/right opponents based on seat order
      const seatIdx = SEATS_IN_ORDER.indexOf(seat);
      const leftOpp = SEATS_IN_ORDER[(seatIdx + 1) % 4];
      const rightOpp = SEATS_IN_ORDER[(seatIdx + 3) % 4];

      // Cards this player GAVE
      const passedCards = currRound.players[seat].passedCards;
      if (passedCards.to[leftOpp]) pr.passedToLeft = passedCards.to[leftOpp]!.id;
      if (passedCards.to[partner]) pr.passedToPartner = passedCards.to[partner]!.id;
      if (passedCards.to[rightOpp]) pr.passedToRight = passedCards.to[rightOpp]!.id;

      // Cards this player RECEIVED
      for (const fromSeat of SEATS_IN_ORDER) {
        if (fromSeat === seat) continue;
        const fromPassed = currRound.players[fromSeat].passedCards;
        const cardToMe = fromPassed.to[seat];
        if (!cardToMe) continue;

        if (fromSeat === leftOpp) pr.receivedFromLeft = cardToMe.id;
        else if (fromSeat === partner) pr.receivedFromPartner = cardToMe.id;
        else if (fromSeat === rightOpp) pr.receivedFromRight = cardToMe.id;
      }
    }
  }

  /** REQ-F-CP07: Capture hand after pass resolution */
  private capturePostPassHands(round: RoundState): void {
    for (const seat of SEATS_IN_ORDER) {
      const pr = this.playerRoundMap.get(seat);
      if (!pr) continue;
      pr.handAfterPass = round.players[seat].hand.map(gc => gc.id);
    }
  }

  // ─── Play/Pass Detection ────────────────────────────────────────────

  /** REQ-F-CP10: Detect new plays and passes in the current trick */
  private detectPlays(prev: RoundState, curr: RoundState): void {
    const prevTrick = prev.currentTrick;
    const currTrick = curr.currentTrick;
    if (!currTrick || !this.currentRound) return;

    // Detect if a new trick started:
    // - No previous trick existed
    // - Previous trick had plays but current has fewer (trick reset)
    // - Previous trick was empty and now has first play (lead happened)
    // - Different lead seat with plays (new trick after completion)
    const isNewTrick = !prevTrick ||
      (currTrick.plays.length < prevTrick.plays.length) ||
      (prevTrick.plays.length === 0 && currTrick.plays.length > 0) ||
      (currTrick.leadSeat !== prevTrick.leadSeat && currTrick.plays.length > 0 && prevTrick.plays.length > 0);

    if (isNewTrick && currTrick.plays.length > 0) {
      // New trick started
      this.trickNumber++;
      this.sequenceNumber = 0;

      // Create trick record with lead info
      this.createTrickRecord(currTrick, curr);
    }

    // Detect new plays
    const prevPlayCount = (isNewTrick ? 0 : prevTrick?.plays.length) ?? 0;
    for (let i = prevPlayCount; i < currTrick.plays.length; i++) {
      const play = currTrick.plays[i];
      this.sequenceNumber++;
      this.totalPlaysThisRound++;

      // Match with pending pre-play context, or compute retroactively for bots
      let prePlay = this.pendingPrePlay.get(play.seat);
      this.pendingPrePlay.delete(play.seat);
      if (!prePlay) {
        // REQ-F-CP17: Compute pre-play context retroactively (bot or untracked action)
        prePlay = this.computeRetroactivePrePlay(play.seat, play.combination.cards, prev);
      }

      const isOutOfTurn = prev.currentTurn !== null && prev.currentTurn !== play.seat;
      const isBomb = play.combination.isBomb;
      const actionType: PlayActionType = isBomb && isOutOfTurn ? 'bomb' : 'play';

      // Determine playedOnTopOf — who was the trick winner before this play
      let playedOnTopOf: Seat | null = null;
      if (i > 0) {
        // The current winner before this play is the last play's seat that wasn't a pass
        // We can get this from the previous plays
        playedOnTopOf = i === 0 ? null : currTrick.plays[i - 1]?.seat ?? null;
        // Actually, the current winner is tracked by the trick state
        // But we need it BEFORE this play. Use prev trick state for the first new play.
        if (i === prevPlayCount && prevTrick) {
          playedOnTopOf = prevTrick.currentWinner;
        } else if (i > prevPlayCount) {
          playedOnTopOf = currTrick.plays[i - 1]?.seat ?? null;
        }
      }

      // Phoenix effective value
      let phoenixEffectiveValue: number | null = null;
      let phoenixUsedAs: number | null = null;
      const hasPhoenix = play.combination.cards.some(gc => isPhoenix(gc.card));
      if (hasPhoenix) {
        if (play.combination.type === CombinationType.Single) {
          // Phoenix as single: effective value is half-rank above current highest
          // The rank is stored in the combination
          phoenixEffectiveValue = play.combination.rank + 0.5;
        }
        if (play.combination.phoenixUsedAs !== undefined) {
          phoenixUsedAs = play.combination.phoenixUsedAs;
        }
      }

      // Cards remaining after this play
      const cardsRemainingAfter = curr.players[play.seat].hand.length;
      const playerFinished = cardsRemainingAfter === 0;

      // Wish context
      const wishActive = curr.mahjongWish !== null && !curr.wishFulfilled;
      const wishRank = curr.mahjongWish;
      const playForcedByWish = wishActive && play.combination.cards.some(gc =>
        gc.card.kind === 'standard' && gc.card.rank === wishRank,
      );

      // Tichu context
      const partner = getPartner(play.seat);
      const partnerCall = curr.players[partner].tipiCall;
      const partnerTichuActive = partnerCall === 'tichu' || partnerCall === 'grandTichu';

      const seatIdx = SEATS_IN_ORDER.indexOf(play.seat);
      const leftOpp = SEATS_IN_ORDER[(seatIdx + 1) % 4];
      const rightOpp = SEATS_IN_ORDER[(seatIdx + 3) % 4];
      const leftCall = curr.players[leftOpp].tipiCall;
      const rightCall = curr.players[rightOpp].tipiCall;

      // Interrupted seat for OOT bombs
      let interruptedSeat: Seat | null = null;
      let endOfTrickBomb: boolean | null = null;
      if (isOutOfTurn && isBomb) {
        interruptedSeat = prev.currentTurn;
        // endOfTrickBomb: true if we were in awaitingEndOfTrickBomb state
        // We can detect this from the previous state — all active players had passed
        endOfTrickBomb = prevTrick !== null && this.allActivePlayersPassed(prevTrick, prev);
      }

      const playRecord: PlayRecord = {
        gameId: this.accumulator.gameId,
        roundNumber: this.currentRound.roundNumber,
        trickNumber: this.trickNumber,
        sequenceNumber: this.sequenceNumber,
        seat: play.seat,

        actionType,
        actionAt: new Date().toISOString(),
        actionSource: prePlay?.actionSource ?? null,

        cards: play.combination.cards.map(gc => gc.id),
        combinationType: play.combination.type,
        combinationRank: play.combination.rank,
        combinationLength: play.combination.length,
        phoenixUsedAs,
        phoenixEffectiveValue,
        isBomb,
        legalPlayCount: prePlay?.legalPlayCount ?? null,

        outOfTurn: isOutOfTurn,
        interruptedSeat,
        endOfTrickBomb,
        playedOnTopOf,
        playerFinished,
        cardsRemainingAfter,
        couldHaveGoneOut: prePlay?.couldHaveGoneOut ?? null,
        playedMinimum: prePlay?.playedMinimum ?? null,

        partnerCardsRemaining: prePlay?.partnerCardsRemaining ?? null,
        leftOppCardsRemaining: prePlay?.leftOppCardsRemaining ?? null,
        rightOppCardsRemaining: prePlay?.rightOppCardsRemaining ?? null,

        couldHavePlayed: null, // not a pass
        hadBombAvailable: null, // not a pass

        wishActive,
        wishRank: wishActive ? wishRank : null,
        playForcedByWish: playForcedByWish || null,

        partnerTichuActive,
        opponentTichuActive: {
          left: leftCall === 'none' ? null : leftCall,
          right: rightCall === 'none' ? null : rightCall,
        },

        turnStartedAt: prePlay?.turnStartedAt ?? null,
        durationMs: prePlay?.durationMs ?? null,
      };

      this.currentRound.plays.push(playRecord);

      // Update trick record if this is a new lead
      if (i === 0 || isNewTrick) {
        this.updateTrickLeadInfo(play, currTrick);
      }

      // Track bomb erosion
      this.trackBombErosion(play.seat, play.combination.cards, play.combination.isBomb);
    }

    // Detect new passes
    const prevPasses = new Set(prevTrick?.passes ?? []);
    for (const seat of currTrick.passes) {
      if (prevPasses.has(seat)) continue;

      this.sequenceNumber++;
      let prePlay = this.pendingPrePlay.get(seat);
      this.pendingPrePlay.delete(seat);
      if (!prePlay) {
        // REQ-F-CP17: Compute retroactively for bot passes
        prePlay = this.computeRetroactivePrePlay(seat, null, prev);
      }

      // Compute pass-specific fields
      const hand = curr.players[seat].hand;
      const legalPlays = prePlay ? prePlay.legalPlayCount : 0;
      const hadBombAvailable = detectAllBombs(hand).length > 0;

      // Tichu context for passes
      const partner = getPartner(seat);
      const partnerCall = curr.players[partner].tipiCall;
      const partnerTichuActive = partnerCall === 'tichu' || partnerCall === 'grandTichu';

      const seatIdx = SEATS_IN_ORDER.indexOf(seat);
      const leftOpp = SEATS_IN_ORDER[(seatIdx + 1) % 4];
      const rightOpp = SEATS_IN_ORDER[(seatIdx + 3) % 4];
      const leftCall = curr.players[leftOpp].tipiCall;
      const rightCall = curr.players[rightOpp].tipiCall;

      const wishActive = curr.mahjongWish !== null && !curr.wishFulfilled;

      const passRecord: PlayRecord = {
        gameId: this.accumulator.gameId,
        roundNumber: this.currentRound.roundNumber,
        trickNumber: this.trickNumber,
        sequenceNumber: this.sequenceNumber,
        seat,

        actionType: 'pass',
        actionAt: new Date().toISOString(),
        actionSource: prePlay?.actionSource ?? null,

        cards: null,
        combinationType: null,
        combinationRank: null,
        combinationLength: null,
        phoenixUsedAs: null,
        phoenixEffectiveValue: null,
        isBomb: null,
        legalPlayCount: prePlay?.legalPlayCount ?? legalPlays,

        outOfTurn: null,
        interruptedSeat: null,
        endOfTrickBomb: null,
        playedOnTopOf: null,
        playerFinished: null,
        cardsRemainingAfter: null,
        couldHaveGoneOut: prePlay?.couldHaveGoneOut ?? null,
        playedMinimum: null,

        partnerCardsRemaining: prePlay?.partnerCardsRemaining ?? null,
        leftOppCardsRemaining: prePlay?.leftOppCardsRemaining ?? null,
        rightOppCardsRemaining: prePlay?.rightOppCardsRemaining ?? null,

        couldHavePlayed: legalPlays > 0 || (prePlay?.legalPlayCount ?? 0) > 0,
        hadBombAvailable,

        wishActive,
        wishRank: wishActive ? curr.mahjongWish : null,
        playForcedByWish: null,

        partnerTichuActive,
        opponentTichuActive: {
          left: leftCall === 'none' ? null : leftCall,
          right: rightCall === 'none' ? null : rightCall,
        },

        turnStartedAt: prePlay?.turnStartedAt ?? null,
        durationMs: prePlay?.durationMs ?? null,
      };

      this.currentRound.plays.push(passRecord);
    }
  }

  // ─── Trick Completion ───────────────────────────────────────────────

  /** REQ-F-CP09: Create initial trick record when a new trick starts */
  private createTrickRecord(trick: TrickState, round: RoundState): void {
    if (!this.currentRound) return;

    // Collect active Tichu seats
    const activeTichuSeats: Seat[] = [];
    for (const seat of SEATS_IN_ORDER) {
      const call = round.players[seat].tipiCall;
      if (call === 'tichu' || call === 'grandTichu') {
        activeTichuSeats.push(seat);
      }
    }

    const firstPlay = trick.plays[0];
    const record: TrickRecord = {
      gameId: this.accumulator.gameId,
      roundNumber: this.currentRound.roundNumber,
      trickNumber: this.trickNumber,
      leadSeat: trick.leadSeat,
      leadCombinationType: firstPlay?.combination.type ?? null,
      leadCombinationRank: firstPlay?.combination.rank ?? null,
      leadCombinationLength: firstPlay?.combination.length ?? null,
      winnerSeat: null,
      pointValue: 0,
      trickLength: 0,
      uncontested: false,
      winningCombinationType: null,
      winningCombinationRank: null,
      winningCombinationLength: null,
      containsDragon: false,
      containsPhoenix: false,
      activeTichuSeats,
    };

    this.currentRound.tricks.push(record);
    this.tricksLedBy.add(trick.leadSeat);
  }

  /** Update trick lead info if not set (for when trick is created before first play) */
  private updateTrickLeadInfo(play: { seat: Seat; combination: { type: CombinationType; rank: number; length: number; cards: GameCard[] } }, _trick: TrickState): void {
    if (!this.currentRound) return;
    const trickRecord = this.currentRound.tricks.find(
      t => t.trickNumber === this.trickNumber,
    );
    if (!trickRecord || trickRecord.leadCombinationType) return;
    trickRecord.leadSeat = play.seat;
    trickRecord.leadCombinationType = play.combination.type;
    trickRecord.leadCombinationRank = play.combination.rank;
    trickRecord.leadCombinationLength = play.combination.length;
  }

  /** REQ-F-CP09: Detect trick completion via state diff */
  private detectTrickCompletion(prev: RoundState, curr: RoundState): void {
    if (!this.currentRound) return;

    const prevTrick = prev.currentTrick;
    if (!prevTrick || prevTrick.plays.length === 0) return;

    // Trick completed when:
    // 1. currentTrick becomes null (between tricks)
    // 2. currentTrick has fewer plays (new trick started)
    const currTrick = curr.currentTrick;
    const trickCompleted = !currTrick ||
      (currTrick.plays.length < prevTrick.plays.length) ||
      (currTrick.leadSeat !== prevTrick.leadSeat && currTrick.plays.length > 0);

    if (!trickCompleted) return;

    // Find the trick record to finalize
    const trickRecord = this.currentRound.tricks.find(
      t => t.trickNumber === this.trickNumber,
    );
    if (!trickRecord || trickRecord.winnerSeat !== null) return;

    // Compute trick result from the completed trick (prevTrick)
    const winnerSeat = prevTrick.currentWinner;
    trickRecord.winnerSeat = winnerSeat;

    // Count plays (not passes) and compute point value
    let pointValue = 0;
    let playCount = 0;
    let containsDragon = false;
    let containsPhoenix = false;

    for (const play of prevTrick.plays) {
      playCount++;
      for (const gc of play.combination.cards) {
        pointValue += this.getCardPointValue(gc);
        if (isDragon(gc.card)) containsDragon = true;
        if (isPhoenix(gc.card)) containsPhoenix = true;
      }
    }

    trickRecord.pointValue = pointValue;
    trickRecord.trickLength = playCount;
    trickRecord.uncontested = playCount === 1 && prevTrick.passes.length >= this.countActivePlayers(prev) - 1;
    trickRecord.containsDragon = containsDragon;
    trickRecord.containsPhoenix = containsPhoenix;

    // Winning combination = the winner's play
    const winningPlay = prevTrick.plays.find(p => p.seat === winnerSeat);
    if (winningPlay) {
      trickRecord.winningCombinationType = winningPlay.combination.type;
      trickRecord.winningCombinationRank = winningPlay.combination.rank;
      trickRecord.winningCombinationLength = winningPlay.combination.length;
    }

    // Update running point totals for the winner
    const winnerPoints = this.runningPointsBySeat.get(winnerSeat) ?? 0;
    this.runningPointsBySeat.set(winnerSeat, winnerPoints + pointValue);

    // Update all player running totals
    for (const seat of SEATS_IN_ORDER) {
      const pr = this.playerRoundMap.get(seat);
      if (pr) {
        pr.trickPointRunningTotal.push(this.runningPointsBySeat.get(seat) ?? 0);
      }
    }
  }

  // ─── Tichu/GT Call Detection ────────────────────────────────────────

  /** REQ-F-CP08: Detect Tichu/GT calls via state diff */
  private detectTichuCalls(prev: RoundState, curr: RoundState): void {
    for (const seat of SEATS_IN_ORDER) {
      const prevCall = prev.players[seat].tipiCall;
      const currCall = curr.players[seat].tipiCall;

      if (prevCall === currCall) continue;

      const pr = this.playerRoundMap.get(seat);
      if (!pr) continue;

      if (currCall === 'grandTichu') {
        pr.grandTichuCall = true;
      } else if (currCall === 'tichu') {
        pr.tichuCall = true;

        // Determine phase of call
        if (curr.phase === GamePhase.GrandTichuDecision || curr.phase === GamePhase.CardPassing) {
          pr.tichuCallPhase = 'prePassing';
        } else {
          pr.tichuCallPhase = 'midRound';
          pr.tichuCallTrickNumber = this.trickNumber;

          // Capture hand sizes at call time
          const partner = getPartner(seat);
          const seatIdx = SEATS_IN_ORDER.indexOf(seat);
          const leftOpp = SEATS_IN_ORDER[(seatIdx + 1) % 4];
          const rightOpp = SEATS_IN_ORDER[(seatIdx + 3) % 4];
          pr.tichuCallHandSizes = {
            partner: curr.players[partner].hand.length,
            leftOpp: curr.players[leftOpp].hand.length,
            rightOpp: curr.players[rightOpp].hand.length,
          };
        }
      }
    }
  }

  // ─── Special Event Detection ────────────────────────────────────────

  /** REQ-F-CP12: Detect wish declared via state diff */
  private detectWishDeclared(prev: RoundState, curr: RoundState): void {
    if (!this.currentRound) return;
    if (prev.mahjongWish !== null || curr.mahjongWish === null) return;

    // Wish was just declared
    // Count cards of wished rank remaining across all hands
    let cardsOfRankRemaining = 0;
    let cardsOfRankInWisherHand = 0;

    // Find the wisher (the player who played Mahjong in the current trick)
    let wisherSeat: Seat | null = null;
    if (curr.currentTrick) {
      for (const play of curr.currentTrick.plays) {
        if (play.combination.cards.some(gc => isMahjong(gc.card))) {
          wisherSeat = play.seat;
          break;
        }
      }
    }

    for (const seat of SEATS_IN_ORDER) {
      for (const gc of curr.players[seat].hand) {
        if (gc.card.kind === 'standard' && gc.card.rank === curr.mahjongWish) {
          cardsOfRankRemaining++;
          if (seat === wisherSeat) cardsOfRankInWisherHand++;
        }
      }
    }

    const wishEvent: WishEventRecord = {
      gameId: this.accumulator.gameId,
      roundNumber: this.currentRound.roundNumber,
      wishRank: curr.mahjongWish,
      trickNumber: this.trickNumber,
      cardsOfRankRemaining,
      cardsOfRankInWisherHand,
      wishFulfilledTrick: null,
      wishFulfilledBy: null,
    };

    this.currentRound.wishEvent = wishEvent;
  }

  /** REQ-F-CP12: Detect wish fulfillment */
  private detectWishFulfilled(prev: RoundState, curr: RoundState): void {
    if (!this.currentRound?.wishEvent) return;
    if (prev.wishFulfilled || !curr.wishFulfilled) return;

    // Wish was just fulfilled
    this.currentRound.wishEvent.wishFulfilledTrick = this.trickNumber;

    // Find who fulfilled it — the last play that contained the wished rank
    if (curr.currentTrick) {
      for (const play of [...curr.currentTrick.plays].reverse()) {
        const hasWishedRank = play.combination.cards.some(gc =>
          gc.card.kind === 'standard' && gc.card.rank === curr.mahjongWish,
        );
        if (hasWishedRank) {
          this.currentRound.wishEvent.wishFulfilledBy = play.seat;
          break;
        }
      }
    }
  }

  /** REQ-F-CP13: Detect Dragon gift via state diff */
  private detectDragonGift(prev: RoundState, curr: RoundState): void {
    if (!this.currentRound) return;
    if (prev.dragonGiftedTo !== null || curr.dragonGiftedTo === null) return;

    // Dragon gift just happened
    const recipient = curr.dragonGiftedTo;

    // Find the gifter (the one who played Dragon and won the trick)
    let gifterSeat: Seat | null = null;
    let trickPointValue = 0;

    // The Dragon gift pending info was in prev state
    if (prev.dragonGiftPending) {
      gifterSeat = prev.dragonGiftPending.from;
      // Calculate trick point value from the pending trick cards
      for (const gc of prev.dragonGiftPending.trickCards) {
        trickPointValue += this.getCardPointValue(gc);
      }
    }

    if (!gifterSeat) return;

    // Determine the other opponent
    const seatIdx = SEATS_IN_ORDER.indexOf(gifterSeat);
    const leftOpp = SEATS_IN_ORDER[(seatIdx + 1) % 4];
    const rightOpp = SEATS_IN_ORDER[(seatIdx + 3) % 4];
    const otherOpponent = recipient === leftOpp ? rightOpp : leftOpp;

    const recipientCardsLeft = curr.players[recipient].hand.length;
    const otherOpponentCardsLeft = curr.players[otherOpponent].hand.length;

    // Check if gifter finished on this play
    const gifterFinishedOnPlay = curr.players[gifterSeat].finishOrder !== null &&
      (prev.players[gifterSeat].finishOrder === null);

    // Check Tichu calls
    const recipientHasTichu = curr.players[recipient].tipiCall === 'tichu' ||
      curr.players[recipient].tipiCall === 'grandTichu';
    const otherOpponentHasTichu = curr.players[otherOpponent].tipiCall === 'tichu' ||
      curr.players[otherOpponent].tipiCall === 'grandTichu';

    // Gift was forced when only one valid opponent recipient
    const opponentSeats = SEATS_IN_ORDER.filter(s => getTeam(s) !== getTeam(gifterSeat!));
    const eligibleOpponents = opponentSeats.filter(s =>
      curr.players[s].finishOrder === null,
    );
    const giftWasForced = eligibleOpponents.length <= 1;

    const event: DragonGiftEventRecord = {
      gameId: this.accumulator.gameId,
      roundNumber: this.currentRound.roundNumber,
      trickNumber: this.trickNumber,
      gifterSeat,
      recipientSeat: recipient,
      trickPointValue,
      recipientCardsLeft,
      otherOpponentCardsLeft,
      gifterFinishedOnPlay,
      recipientHasTichu,
      otherOpponentHasTichu,
      giftWasForced,
    };

    this.currentRound.dragonGiftEvents.push(event);
  }

  /** REQ-F-CP14: Detect Dog play via state diff */
  private detectDogPlay(prev: RoundState, curr: RoundState): void {
    if (!this.currentRound) return;
    if (prev.lastDogPlay !== null || curr.lastDogPlay === null) return;

    const { fromSeat, toSeat } = curr.lastDogPlay;

    // Check if partner already finished
    const partner = getPartner(fromSeat);
    const partnerAlreadyOut = curr.players[partner].finishOrder !== null;

    // Check if partner has Tichu
    const partnerHasTichu = curr.players[partner].tipiCall === 'tichu' ||
      curr.players[partner].tipiCall === 'grandTichu';

    // Check if player led any prior trick (had prior lead opportunity)
    const hadPriorLeadOpportunity = this.tricksLedBy.has(fromSeat) &&
      this.trickNumber > 1;

    // Check if Dog was last card
    const dogWasLastCard = curr.players[fromSeat].hand.length === 0;

    const event: DogPlayEventRecord = {
      gameId: this.accumulator.gameId,
      roundNumber: this.currentRound.roundNumber,
      trickNumber: this.trickNumber,
      playerSeat: fromSeat,
      controlPassedTo: toSeat,
      partnerAlreadyOut,
      partnerHasTichu,
      hadPriorLeadOpportunity,
      dogWasLastCard,
    };

    this.currentRound.dogPlayEvents.push(event);

    // REQ-F-CP16: Update bomb lifecycle followedByDog
    // If the previous trick winner played a bomb, mark it
    const lastBombPlay = this.findLastBombPlayByPlayer(fromSeat);
    if (lastBombPlay) {
      lastBombPlay.followedByDog = true;
    }
  }

  // ─── Player Finished Detection ──────────────────────────────────────

  /** Detect when a player goes out (finishOrder transitions from null) */
  private detectPlayerFinished(prev: RoundState, curr: RoundState): void {
    for (const seat of SEATS_IN_ORDER) {
      const prevFinish = prev.players[seat].finishOrder;
      const currFinish = curr.players[seat].finishOrder;

      if (prevFinish !== null || currFinish === null) continue;

      const pr = this.playerRoundMap.get(seat);
      if (!pr) continue;

      pr.finishPosition = currFinish;
      pr.finishTrickNumber = this.trickNumber;
    }
  }

  // ─── Bomb Inventory ─────────────────────────────────────────────────

  /** REQ-F-CP15: Create bomb inventory after pass resolution */
  private createBombInventory(currRound: RoundState, _prevRound: RoundState): void {
    if (!this.currentRound) return;

    for (const seat of SEATS_IN_ORDER) {
      const hand = currRound.players[seat].hand;
      const bombs = detectAllBombs(hand);
      const seatBombs: BombInventoryRecord[] = [];

      for (const bomb of bombs) {
        // Determine acquired phase
        const first8 = this.playerRoundMap.get(seat)?.first8Cards ?? [];
        const fullPrePass = this.playerRoundMap.get(seat)?.fullHandPrePass ?? [];
        const bombCardIds = bomb.cards.map(gc => gc.id);

        let acquiredPhase: 'first8' | 'fullDeal' | 'postPass' = 'postPass';
        const allInFirst8 = bombCardIds.every(id => first8.includes(id));
        if (allInFirst8) {
          acquiredPhase = 'first8';
        } else {
          const allInPrePass = bombCardIds.every(id => fullPrePass.includes(id));
          if (allInPrePass) {
            acquiredPhase = 'fullDeal';
          }
        }

        const bombType: BombType = bomb.type === CombinationType.FourBomb
          ? 'fourOfAKind' : 'straightFlush';

        const record: BombInventoryRecord = {
          gameId: this.accumulator.gameId,
          roundNumber: this.currentRound.roundNumber,
          playerSeat: seat,
          bombType,
          cards: bombCardIds,
          rank: bomb.rank,
          size: bomb.cards.length,
          acquiredPhase,
          bombPlaysFromRun: 0,
          overlapsWith: [], // computed below
          fate: null,
          fateTrickNumber: null,
          fateTarget: null,
          outOfTurn: null,
          endOfTrickBomb: null,
          playsSeenWhileHeld: 0,
          capturedDragon: false,
          wasOverbomb: false,
          followedByDog: false,
        };

        seatBombs.push(record);
        this.currentRound.bombInventory.push(record);
        this.bombInventoryPlayCountAtCreation.set(record, this.totalPlaysThisRound);
      }

      // Compute overlaps
      for (let i = 0; i < seatBombs.length; i++) {
        for (let j = i + 1; j < seatBombs.length; j++) {
          const overlap = seatBombs[i].cards.some(id => seatBombs[j].cards.includes(id));
          if (overlap) {
            seatBombs[i].overlapsWith.push(j);
            seatBombs[j].overlapsWith.push(i);
          }
        }
      }

      this.bombInventoryBySeat.set(seat, seatBombs);
    }
  }

  /** REQ-F-CP16: Track bomb erosion when cards are played */
  private trackBombErosion(seat: Seat, cards: GameCard[], isBombPlay: boolean): void {
    const bombs = this.bombInventoryBySeat.get(seat);
    if (!bombs) return;

    const playedCardIds = new Set(cards.map(gc => gc.id));

    for (const bomb of bombs) {
      if (bomb.fate !== null) continue; // already resolved

      if (isBombPlay) {
        // Check if this bomb play matches the inventory bomb
        const matchesAll = bomb.cards.every(id => playedCardIds.has(id));
        if (matchesAll) {
          bomb.fate = 'played';
          bomb.fateTrickNumber = this.trickNumber;
          bomb.playsSeenWhileHeld = this.totalPlaysThisRound -
            (this.bombInventoryPlayCountAtCreation.get(bomb) ?? 0);

          // Check if bomb captured a Dragon (will be set when trick completes)
          // Check wasOverbomb (will be checked from play records)
          continue;
        }
      }

      // Check if played cards erode this bomb
      const erosion = bomb.cards.some(id => playedCardIds.has(id));
      if (erosion) {
        bomb.fate = 'brokenUp';
        bomb.fateTrickNumber = this.trickNumber;
        bomb.playsSeenWhileHeld = this.totalPlaysThisRound -
          (this.bombInventoryPlayCountAtCreation.get(bomb) ?? 0);
      }
    }
  }

  // ─── Scoring & Finalization ─────────────────────────────────────────

  /**
   * REQ-F-CP06: Finalize player round scoring at round end.
   * Called externally when roundScoring state is reached.
   */
  finalizePlayerRoundScoring(round: RoundState): void {
    if (!this.currentRound) return;

    const finishOrder = round.finishOrder;
    const firstOutSeat = finishOrder[0] ?? null;

    for (const seat of SEATS_IN_ORDER) {
      const pr = this.playerRoundMap.get(seat);
      if (!pr) continue;

      const player = round.players[seat];

      // Card points captured (sum of trick point values for tricks won by this player)
      let cardPointsCaptured = 0;
      for (const trick of player.tricksWon) {
        for (const gc of trick) {
          cardPointsCaptured += this.getCardPointValue(gc);
        }
      }
      pr.cardPointsCaptured = cardPointsCaptured;

      // Hand points given to opponents (remaining cards if player didn't go out)
      if (player.finishOrder === null || player.finishOrder === 4) {
        // Last player (or didn't finish): hand points go to opponents
        let handPoints = 0;
        for (const gc of player.hand) {
          handPoints += this.getCardPointValue(gc);
        }
        pr.handPointsGivenToOpponents = handPoints;
      }

      // Captured points given to first out (if first out is on opposing team)
      if (firstOutSeat && getTeam(firstOutSeat) !== getTeam(seat) && player.finishOrder === 4) {
        // Last player's captured points go to first-out player's team
        pr.capturedPointsGivenToFirstOut = cardPointsCaptured;
      }

      // Tichu call success
      if (pr.tichuCall || pr.grandTichuCall) {
        pr.tichuCallSuccess = player.finishOrder === 1;
      }
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  /**
   * REQ-F-CP17: Compute pre-play context retroactively from the previous state.
   * Used for bot actions and any plays that bypassed the pre-play recording path.
   */
  private computeRetroactivePrePlay(seat: Seat, cards: GameCard[] | null, prevRound: RoundState): PrePlayContext {
    const hand = prevRound.players[seat].hand;
    const wish = prevRound.mahjongWish && !prevRound.wishFulfilled ? prevRound.mahjongWish : null;
    const legalPlays = getValidPlays(hand, prevRound.currentTrick, wish);

    // Determine chosen combination
    let chosenCombination: { type: CombinationType; rank: number; length: number; cards: GameCard[] } | null = null;
    if (cards && cards.length > 0) {
      // detectCombination is imported via @tichu/shared but we don't need it here —
      // we already have the combination from the trick state. Just use the data we have.
      // For retroactive computation, legalPlays comparison is sufficient.
      const matchingPlay = legalPlays.find(lp =>
        lp.cards.length === cards.length &&
        lp.cards.every(c => cards.some(pc => pc.id === c.id)),
      );
      chosenCombination = matchingPlay ?? null;
    }

    // Determine if played minimum
    let playedMinimum = false;
    if (chosenCombination && legalPlays.length > 1) {
      const sameType = legalPlays.filter(p => p.type === chosenCombination!.type);
      if (sameType.length <= 1) {
        playedMinimum = true;
      } else {
        const minRank = Math.min(...sameType.map(p => p.rank));
        playedMinimum = chosenCombination.rank === minRank;
      }
    } else if (legalPlays.length <= 1) {
      playedMinimum = true;
    }

    // Could go out
    const couldHaveGoneOut = legalPlays.some(lp => lp.cards.length === hand.length);

    // Hand sizes
    const partner = getPartner(seat);
    const seatIdx = SEATS_IN_ORDER.indexOf(seat);
    const leftOpp = SEATS_IN_ORDER[(seatIdx + 1) % 4];
    const rightOpp = SEATS_IN_ORDER[(seatIdx + 3) % 4];

    return {
      seat,
      legalPlayCount: legalPlays.length,
      playedMinimum,
      couldHaveGoneOut,
      actionSource: 'bot', // retroactive implies bot or automated
      partnerCardsRemaining: prevRound.players[partner].hand.length,
      leftOppCardsRemaining: prevRound.players[leftOpp].hand.length,
      rightOppCardsRemaining: prevRound.players[rightOpp].hand.length,
      turnStartedAt: null,
      durationMs: null,
    };
  }

  /** Get point value of a single card */
  private getCardPointValue(gc: GameCard): number {
    if (isDragon(gc.card)) return 25;
    if (isPhoenix(gc.card)) return -25;
    const card = gc.card;
    if (card.kind === 'standard') {
      if (card.rank === 5) return 5;
      if (card.rank === 10) return 10;
      if (card.rank === 13) return 10; // King
    }
    return 0;
  }

  /** Count active (non-finished) players */
  private countActivePlayers(round: RoundState): number {
    return SEATS_IN_ORDER.filter(s => round.players[s].finishOrder === null).length;
  }

  /** Check if all active players have passed on a trick */
  private allActivePlayersPassed(trick: TrickState, round: RoundState): boolean {
    const activePlayers = SEATS_IN_ORDER.filter(s => round.players[s].finishOrder === null);
    const passSet = new Set(trick.passes);
    // All active players except the trick leader have passed
    return activePlayers.filter(s => s !== trick.currentWinner).every(s => passSet.has(s));
  }

  /** Find the last bomb play event for a player (for followedByDog tracking) */
  private findLastBombPlayByPlayer(seat: Seat): BombEventRecord | null {
    if (!this.currentRound) return null;
    // Look for playBomb events for this seat
    for (let i = this.currentRound.bombEvents.length - 1; i >= 0; i--) {
      const event = this.currentRound.bombEvents[i];
      if (event.eventType === 'playBomb') {
        // Check if the bomb belongs to this seat
        const bomb = this.currentRound.bombInventory[event.bombInventoryIndex];
        if (bomb?.playerSeat === seat) return event;
      }
    }
    return null;
  }
}
