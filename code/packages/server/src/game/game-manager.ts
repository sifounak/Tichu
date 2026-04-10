// REQ-F-DR01: Dragon trick given to opponent
// REQ-F-DR02: Dragon auto-select when 1 opponent left
// REQ-F-DR03: Bomb overrides Dragon gift
// REQ-F-MP01: Any combination 0-4 humans + bots
// REQ-F-MP08: Disconnect handling with vote

import type { WebSocket } from 'ws';
import type {
  ClientMessage,
  GameCard,
  GameConfig,
  Rank,
  Seat,
  RoundState,
} from '@tichu/shared';
import {
  getValidPlays,
  canPlayerPass,
  isDog,
  isMahjong,
  isDragon,
  isPhoenix,
  isStandard,
  detectAllBombs,
  getTeam,
  SEATS_IN_ORDER,
} from '@tichu/shared';
import type { Broadcaster } from '../ws/broadcaster.js';
import {
  createGameActor,
  type GameActor,
  type GameMachineContext,
} from './game-state-machine.js';
import { TurnTimer } from './turn-timer.js';
import { MoveHandler } from './move-handler.js';
import { DisconnectHandler } from './disconnect-handler.js';
import { VoteHandler } from './vote-handler.js';
import { projectGameState, projectSpectatorView } from '../ws/state-projection.js';
import { BotRunner } from '../bot/bot-runner.js';
import { Bot } from '../bot/bot.js';
import { RoundEventTracker } from './round-event-tracker.js';
import type { RoundEventSummary } from './round-event-types.js';
// REQ-F-CP01: New event capture system (hybrid pre-play enrichment + post-play observation)
import { GameEventCapture } from './game-event-capture.js';
import { buildPrePlayContext } from './pre-play-context.js';
import { detectCombination } from '@tichu/shared';
import type { ActionSource, GameEventAccumulator } from './event-types.js';

/**
 * Orchestrates a single game: receives client messages, validates moves
 * via the shared engine, transitions the state machine, and broadcasts updates.
 *
 * One GameManager instance per active game. Holds the XState actor,
 * TurnTimer, and MoveHandler.
 */
export class GameManager {
  readonly gameId: string;
  readonly roomCode: string;

  private readonly actor: GameActor;
  private readonly timer: TurnTimer;
  private readonly moveHandler: MoveHandler;
  private readonly broadcaster: Broadcaster;
  private readonly disconnectHandler: DisconnectHandler;
  private readonly voteHandler: VoteHandler;
  private readonly botRunner: BotRunner;
  private destroyed = false;
  private autoPassTimer: ReturnType<typeof setTimeout> | null = null;
  private scoringTimer: ReturnType<typeof setTimeout> | null = null;
  private endOfTrickBombTimer: ReturnType<typeof setTimeout> | null = null;
  private endOfTrickBombWindowEndTime: number | null = null;
  /** Seats that have been vacated (player left mid-game, waiting for replacement) */
  private readonly vacatedSeats = new Set<Seat>();
  /** Seats occupied by players who are choosing which vacated seat to take */
  private readonly choosingSeats = new Set<Seat>();
  /** REQ-F-PW01: Callback invoked when game reaches gameOver state */
  private onGameEnd?: (context: GameMachineContext, roundEvents: Map<number, RoundEventSummary[]>, joinedAfterSpectating: Set<string>) => void;
  /** REQ-F-SO15: Track players who joined as spectators then were promoted mid-game */
  private readonly joinedAfterSpectating = new Set<string>();
  /** REQ-F-EC01: State-diff observer for mid-round card events */
  private readonly eventTracker = new RoundEventTracker();
  /** Accumulated round events: roundNumber → summaries */
  private readonly roundEventHistory = new Map<number, RoundEventSummary[]>();
  /** REQ-F-CP01/ST01: New event capture system — accumulates structured event data in memory */
  private readonly eventCapture: GameEventCapture;
  /** REQ-F-CP02: Track when each player's turn started (for durationMs) */
  private readonly turnStartTimes = new Map<Seat, string>();

  constructor(
    gameId: string,
    roomCode: string,
    broadcaster: Broadcaster,
    disconnectHandler: DisconnectHandler,
    voteHandler: VoteHandler,
    config?: Partial<GameConfig>,
  ) {
    this.gameId = gameId;
    this.roomCode = roomCode;
    this.broadcaster = broadcaster;
    this.disconnectHandler = disconnectHandler;
    this.voteHandler = voteHandler;

    // Create the XState game actor
    this.actor = createGameActor(gameId, config);
    this.moveHandler = new MoveHandler(this.actor);

    // REQ-F-CP01: Initialize event capture system
    this.eventCapture = new GameEventCapture(parseInt(gameId) || 0);

    // REQ-F-MP01: Create bot runner for automated bot decisions
    this.botRunner = new BotRunner(this.actor, undefined, this.moveHandler);

    // Create turn timer with timeout callback
    const turnTimerSeconds = config?.turnTimerSeconds ?? null;
    this.timer = new TurnTimer(turnTimerSeconds, (seat) => {
      this.handleTurnTimeout(seat);
    });

    // Subscribe to actor state changes for automatic broadcasts
    this.actor.subscribe((snapshot) => {
      if (this.destroyed) return;
      this.onStateChange(snapshot);
    });

    // Start the actor
    this.actor.start();
  }

  /** Get current game state context */
  get context(): GameMachineContext {
    return this.actor.getSnapshot().context;
  }

  /** Get current machine state name */
  get stateValue(): string {
    const value = this.actor.getSnapshot().value;
    return typeof value === 'string' ? value : String(value);
  }

  /**
   * Main entry point: handle an incoming client message for a specific seat.
   * Routes to the appropriate MoveHandler method.
   */
  handleMessage(ws: WebSocket, seat: Seat, message: ClientMessage): void {
    if (this.destroyed) {
      this.broadcaster.sendError(ws, 'GAME_DESTROYED', 'This game has ended');
      return;
    }

    let result;
    switch (message.type) {
      case 'START_GAME':
        result = this.moveHandler.handleStartGame();
        break;

      case 'GRAND_TICHU_DECISION':
        result = this.moveHandler.handleGrandTichuDecision(seat, message.call, message.partnerOverride);
        break;

      case 'TICHU_DECLARATION':
        result = this.moveHandler.handleTichuDeclaration(seat, message.partnerOverride);
        break;

      case 'PASS_CARDS':
        result = this.moveHandler.handlePassCards(seat, message.cards as Record<Seat, GameCard>);
        break;

      case 'CANCEL_PASS_CARDS':
        result = this.moveHandler.handleCancelPassCards(seat);
        break;

      case 'PLAY_CARDS':
        // REQ-F-CP02: Compute pre-play context before state machine transition
        this.recordPrePlayForAction(seat, message.cardIds, 'player');
        result = this.moveHandler.handlePlayCards(seat, message.cardIds, message.phoenixAs, message.wish);
        if (!result.ok) this.eventCapture.discardPrePlayContext(seat);
        break;

      case 'PASS_TURN':
        // REQ-F-CP02: Compute pre-play context for pass action
        this.recordPrePlayForAction(seat, null, 'player');
        result = this.moveHandler.handlePassTurn(seat);
        if (!result.ok) this.eventCapture.discardPrePlayContext(seat);
        break;

      case 'DECLARE_WISH':
        result = this.moveHandler.handleDeclareWish(seat, message.rank);
        break;

      case 'GIFT_DRAGON':
        result = this.moveHandler.handleGiftDragon(seat, message.to);
        break;

      case 'DISCONNECT_VOTE':
        // REQ-F-ES04: Vote type narrowed to 'wait' | 'kick' — disconnect-handler rewrite in M2
        this.disconnectHandler.handleVote(this.roomCode, seat, message.vote as any);
        return; // Vote handler manages its own broadcasts

      // REQ-F-PV20: Player-initiated vote messages
      case 'START_KICK_VOTE':
        this.handleStartKickVote(ws, seat, message.targetSeat);
        return;
      case 'START_RESTART_VOTE':
        this.handleStartRestartVote(ws, seat);
        return;
      case 'PLAYER_VOTE':
        this.voteHandler.handleVote(this.roomCode, seat, message.voteId, message.vote);
        return;

      default:
        this.broadcaster.sendError(ws, 'UNHANDLED_TYPE', `Game does not handle: ${message.type}`);
        return;
    }

    if (!result.ok) {
      const snapshot = this.actor.getSnapshot();
      const stateVal = typeof snapshot.value === 'string' ? snapshot.value : String(snapshot.value);
      console.error(`[INVALID_MOVE] seat=${seat} type=${message.type} state=${stateVal} error=${result.error}`);
      // Use structured error code for partner safeguard; generic INVALID_MOVE for others
      const errorCode = result.error === 'PARTNER_ALREADY_CALLED' ? 'PARTNER_ALREADY_CALLED' : 'INVALID_MOVE';
      const errorMessage = result.error === 'PARTNER_ALREADY_CALLED'
        ? `PARTNER_ALREADY_CALLED:${(result as any).partnerCall}`
        : result.error;
      this.broadcaster.sendError(ws, errorCode, errorMessage);
      return;
    }

    // State change triggers broadcast via the subscription
    this.broadcastState();
  }

  /** REQ-F-ES04: Handle a player disconnecting from this game.
   *  Stops timer and starts vote process. Does NOT vacate seat yet — waits for vote result. */
  handleDisconnect(seat: Seat): void {
    this.timer.stop();
    // REQ-F-PV26/PV27: Cancel active player vote if initiator or target disconnects
    const activeVote = this.voteHandler.getActiveVote(this.roomCode);
    if (activeVote) {
      if (activeVote.initiatorSeat === seat || activeVote.targetSeat === seat) {
        this.voteHandler.cancelVote(this.roomCode);
      }
    }
    this.disconnectHandler.handleDisconnect(this.roomCode, seat);
    this.broadcastState();
  }

  /** REQ-F-ES14: Handle a player reconnecting to this game.
   *  If vote was "wait" and player reconnects, auto-restore to original seat. */
  handleReconnect(_ws: WebSocket, seat: Seat): void {
    this.disconnectHandler.handleReconnect(this.roomCode, seat);
    // Send the current full state to the reconnected player
    this.sendStateTo(seat);
    this.broadcastState();
    // Restart timer + bot logic if all players are back
    if (this.disconnectHandler.getDisconnectedSeats(this.roomCode).length === 0) {
      this.onStateChange(null);
    }
  }

  /** REQ-F-ES04: Wire the kick-resolved callback — when kick vote passes, vacate each kicked seat.
   *  Called by game-store or room-handler to register the callback. */
  wireKickCallback(onSeatsVacated: (roomCode: string, seats: Seat[]) => void): void {
    this.disconnectHandler.onVoteResult = (roomCode, outcome, seats) => {
      if (outcome === 'kick') {
        // Vacate each kicked seat
        for (const s of seats) {
          this.vacatedSeats.add(s);
        }
        // Clear disconnected tracking for kicked seats (they're now vacated, not disconnected)
        this.broadcastState();
        onSeatsVacated(roomCode, seats);
      } else if (outcome === 'waiting') {
        // Keep seats reserved — just broadcast updated state (vote UI clears)
        this.broadcastState();
      }
    };
  }

  /** REQ-F-PV22: Wire the player vote result callback.
   *  Called by game-store or room-handler to register the callback. */
  wireVoteCallback(onKickVotePassed: (roomCode: string, targetSeat: Seat) => void, onRestartVotePassed: (roomCode: string) => void): void {
    this.voteHandler.onVoteResult = (roomCode, voteType, passed, targetSeat) => {
      if (voteType === 'kick' && passed && targetSeat) {
        // REQ-F-PV16: Kick vote passed — vacate the target seat
        this.vacatedSeats.add(targetSeat);
        this.broadcastState();
        onKickVotePassed(roomCode, targetSeat);
      } else if (voteType === 'restart' && passed) {
        // REQ-F-PV18: Restart vote passed — handled by GameStore after delay
        onRestartVotePassed(roomCode);
      } else {
        // REQ-F-PV17/PV19: Vote failed — just broadcast to clear vote UI
        this.broadcastState();
      }
    };
  }

  /** REQ-F-PW01: Wire the game-end callback — called when game reaches gameOver state.
   *  Called by room-handler to register persistence logic. */
  wireGameEndCallback(onGameEnd: (context: GameMachineContext, roundEvents: Map<number, RoundEventSummary[]>, joinedAfterSpectating: Set<string>) => void): void {
    this.onGameEnd = onGameEnd;
  }

  /** REQ-F-SO15: Mark a userId as having joined the game after spectating */
  markJoinedAfterSpectating(userId: string): void {
    this.joinedAfterSpectating.add(userId);
  }

  /** REQ-F-CS24: Get current round event summaries (for pass stats on abandon) */
  getCurrentRoundSummaries(): RoundEventSummary[] {
    return this.eventTracker.getAllSummaries();
  }

  /** REQ-F-CS24: Check if game is past card passing phase (pass data captured) */
  isPastCardPassPhase(): boolean {
    const round = this.context.currentRound;
    if (!round) return false;
    return round.phase !== 'grandTichuDecision' && round.phase !== 'cardPassing';
  }

  /** Mark a seat as vacated (player left mid-game). Game pauses until filled. */
  handleSeatVacated(seat: Seat): void {
    this.vacatedSeats.add(seat);
    // If seat was a bot, remove it so it stops making moves
    if (this.botRunner.isBot(seat)) {
      this.botRunner.removeBot(seat);
    }
    this.timer.stop();
    this.broadcastState();
  }

  /** Fill a vacated seat with a new player.
   *  If 2+ seats are vacated, the player must choose — mark them as choosing.
   *  If only 1 seat is vacated (last spot), auto-fill immediately. */
  handleSeatFilled(seat: Seat, isBot = false): void {
    this.vacatedSeats.delete(seat);
    // If this seat was previously a bot and a human is filling it, remove the bot
    if (!isBot && this.botRunner.isBot(seat)) {
      this.botRunner.removeBot(seat);
    }
    if (this.vacatedSeats.size > 0) {
      // 2+ seats were vacated; player just took one but others remain.
      // They need to choose which vacated seat they actually want.
      this.choosingSeats.add(seat);
    }
    this.sendStateTo(seat);
    this.broadcastState();
    // All seats filled — resume the game (re-trigger timer + bot actions)
    if (this.vacatedSeats.size === 0 && this.choosingSeats.size === 0) {
      this.onStateChange(null);
    }
  }

  /** REQ-F-SP06: Send spectator-projected state to a specific WebSocket. */
  sendSpectatorState(ws: WebSocket): void {
    const voteStatus = this.disconnectHandler.getVoteStatus(this.roomCode);
    const activeVote = this.voteHandler.getActiveVote(this.roomCode);
    const view = projectSpectatorView(
      this.context,
      this.stateValue,
      [...this.vacatedSeats],
      voteStatus,
      activeVote,
    );
    this.broadcaster.send(ws, { type: 'GAME_STATE', state: view });
  }

  /** Handle CHOOSE_SEAT — player picks a vacated seat (or keeps their current one) */
  handleChooseSeat(currentSeat: Seat, chosenSeat: Seat): void {
    if (!this.choosingSeats.has(currentSeat)) return;
    this.choosingSeats.delete(currentSeat);

    if (chosenSeat !== currentSeat && this.vacatedSeats.has(chosenSeat)) {
      // Swap: put current seat back as vacated, claim chosen seat
      this.vacatedSeats.add(currentSeat);
      this.vacatedSeats.delete(chosenSeat);
    }
    // If chosenSeat === currentSeat, just confirm — no swap needed

    this.broadcastState();
  }

  /** Get the set of currently vacated seats */
  getVacatedSeats(): ReadonlySet<Seat> {
    return this.vacatedSeats;
  }

  /** Check if a seat is in "choosing" mode */
  isChoosingState(seat: Seat): boolean {
    return this.choosingSeats.has(seat);
  }

  /** Seat a player into the game lobby */
  seatPlayer(seat: Seat): boolean {
    const result = this.moveHandler.handlePlayerJoined(seat);
    if (result.ok) {
      this.broadcastState();
    }
    return result.ok;
  }

  /** REQ-F-MP01: Register a bot at the given seat */
  registerBot(seat: Seat): void {
    this.botRunner.addBot(seat, new Bot());
  }

  /** Get the disconnect handler (for state projection access) */
  getDisconnectHandler(): DisconnectHandler {
    return this.disconnectHandler;
  }

  /** REQ-F-PV22: Get the vote handler (for state projection access) */
  getVoteHandler(): VoteHandler {
    return this.voteHandler;
  }

  /** REQ-F-PV03, REQ-F-PV25, REQ-F-PV28: Start a kick vote with validation */
  private handleStartKickVote(ws: WebSocket, initiatorSeat: Seat, targetSeat: Seat): void {
    // REQ-F-PV28: Cannot kick self
    if (initiatorSeat === targetSeat) {
      this.broadcaster.sendError(ws, 'INVALID_VOTE', 'Cannot kick yourself');
      return;
    }
    // REQ-F-PV25: No concurrent votes
    if (this.voteHandler.hasActiveVote(this.roomCode)) {
      this.broadcaster.sendError(ws, 'VOTE_ACTIVE', 'A vote is already in progress');
      return;
    }
    if (this.disconnectHandler.hasActiveVote(this.roomCode)) {
      this.broadcaster.sendError(ws, 'VOTE_ACTIVE', 'Cannot start vote during disconnect handling');
      return;
    }
    // Only human players can initiate
    if (this.botRunner.isBot(initiatorSeat)) {
      this.broadcaster.sendError(ws, 'INVALID_VOTE', 'Bots cannot start votes');
      return;
    }

    const humanSeats = this.getHumanSeats();
    this.voteHandler.startKickVote(this.roomCode, initiatorSeat, targetSeat, humanSeats);
  }

  /** REQ-F-PV04, REQ-F-PV25: Start a restart vote with validation */
  private handleStartRestartVote(ws: WebSocket, initiatorSeat: Seat): void {
    // REQ-F-PV25: No concurrent votes
    if (this.voteHandler.hasActiveVote(this.roomCode)) {
      this.broadcaster.sendError(ws, 'VOTE_ACTIVE', 'A vote is already in progress');
      return;
    }
    if (this.disconnectHandler.hasActiveVote(this.roomCode)) {
      this.broadcaster.sendError(ws, 'VOTE_ACTIVE', 'Cannot start vote during disconnect handling');
      return;
    }
    // Only human players can initiate
    if (this.botRunner.isBot(initiatorSeat)) {
      this.broadcaster.sendError(ws, 'INVALID_VOTE', 'Bots cannot start votes');
      return;
    }

    const humanSeats = this.getHumanSeats();
    this.voteHandler.startRestartVote(this.roomCode, initiatorSeat, humanSeats);
  }

  /** Get all human (non-bot) seats */
  private getHumanSeats(): Seat[] {
    const allSeats: Seat[] = ['north', 'east', 'south', 'west'];
    return allSeats.filter(s => !this.botRunner.isBot(s) && !this.vacatedSeats.has(s));
  }

  /** Broadcast current game state to all players in the room */
  broadcastState(): void {
    if (this.destroyed) return;
    const voteStatus = this.disconnectHandler.getVoteStatus(this.roomCode);
    const activeVote = this.voteHandler.getActiveVote(this.roomCode);
    // REQ-F-TT05: Include turn timer data in broadcast
    const timerInfo = { startTime: this.timer.getStartTime(), durationMs: this.timer.getDurationMs() };
    this.broadcaster.broadcastGameState(this.roomCode, this.context, this.stateValue, [...this.vacatedSeats], [...this.choosingSeats], voteStatus, activeVote, timerInfo, this.endOfTrickBombWindowEndTime);
  }

  /** Send current game state to a specific player (projected per-seat view) */
  private sendStateTo(seat: Seat): void {
    const voteStatus = this.disconnectHandler.getVoteStatus(this.roomCode);
    const activeVote = this.voteHandler.getActiveVote(this.roomCode);
    // REQ-F-TT05: Include turn timer data in per-seat state
    const timerInfo = { startTime: this.timer.getStartTime(), durationMs: this.timer.getDurationMs() };
    const view = projectGameState(this.context, this.stateValue, seat, [...this.vacatedSeats], [...this.choosingSeats], voteStatus, activeVote, timerInfo, this.endOfTrickBombWindowEndTime);
    this.broadcaster.sendToPlayer(this.roomCode, seat, {
      type: 'GAME_STATE',
      state: view,
    });
  }

  /** Called on every state machine transition */
  private onStateChange(_snapshot: unknown): void {
    const state = this.stateValue;
    const round = this.context.currentRound;

    // REQ-F-EC01: Feed state to event tracker before any other logic
    this.eventTracker.onStateChange(this.context);
    // REQ-F-CP03: Feed state to new event capture system
    this.eventCapture.onStateChange(this.context);

    // Clear any pending auto-pass
    if (this.autoPassTimer) {
      clearTimeout(this.autoPassTimer);
      this.autoPassTimer = null;
    }

    // Clear end-of-trick bomb window timer when leaving that state (e.g., bomb played)
    if (this.endOfTrickBombTimer && state !== 'awaitingEndOfTrickBomb') {
      clearTimeout(this.endOfTrickBombTimer);
      this.endOfTrickBombTimer = null;
      this.endOfTrickBombWindowEndTime = null;
    }

    // Game pauses when any seat is vacated — stop timer and don't trigger bot actions
    if (this.vacatedSeats.size > 0) {
      this.timer.stop();
      this.broadcastState();
      return;
    }

    // Round scoring: save round event summaries, then broadcast
    if (state === 'roundScoring') {
      this.timer.stop();
      // REQ-F-EC04: Archive round events before advancing
      if (round) {
        this.eventTracker.finalizeRound();
        const summaries = this.eventTracker.getAllSummaries();
        this.roundEventHistory.set(round.roundNumber, summaries);
        // REQ-F-CP06: Finalize new event capture round data
        this.eventCapture.finalizePlayerRoundScoring(round);
        this.eventCapture.finalizeRound();
      }
      this.broadcastState();
      if (this.scoringTimer) clearTimeout(this.scoringTimer);
      this.scoringTimer = setTimeout(() => {
        if (this.destroyed) return;
        this.actor.send({ type: 'ADVANCE_FROM_SCORING' });
        this.broadcastState();
      }, 1500); // 1.5s delay: lets clients animate the final card before advancing
      return;
    }

    // REQ-F-PW01: Game over — broadcast final state, then invoke persistence callback
    // REQ-NF-P02: Callback runs AFTER broadcast so clients see game-over first
    if (state === 'gameOver') {
      this.timer.stop();
      this.broadcastState();
      if (this.onGameEnd) {
        try {
          this.onGameEnd(this.context, this.roundEventHistory, this.joinedAfterSpectating);
        } catch {
          // Persistence failure must not crash the game server
        }
      }
      return;
    }

    // End-of-trick bomb window: 3s delay where players can bomb before trick completes
    if (state === 'awaitingEndOfTrickBomb') {
      this.timer.stop();

      // Skip delay when only bots remain — bots decide instantly
      const activePlayers = round
        ? SEATS_IN_ORDER.filter((s) => round.players[s].finishOrder === null)
        : [];
      const onlyBots = activePlayers.length > 0 && activePlayers.every((s) => this.botRunner.isBot(s));

      if (onlyBots) {
        // Let bots decide synchronously (no delay), then immediately timeout
        this.botRunner.onStateChange(() => this.broadcastState());
        // Use microtask to allow any bot bomb to process first
        setTimeout(() => {
          if (this.destroyed) return;
          this.actor.send({ type: 'END_OF_TRICK_BOMB_TIMEOUT' });
          this.broadcastState();
        }, 0);
        return;
      }

      const durationMs = 2500;
      this.endOfTrickBombWindowEndTime = Date.now() + durationMs;
      this.broadcastState();
      if (this.endOfTrickBombTimer) clearTimeout(this.endOfTrickBombTimer);
      this.endOfTrickBombTimer = setTimeout(() => {
        if (this.destroyed) return;
        this.endOfTrickBombWindowEndTime = null;
        this.actor.send({ type: 'END_OF_TRICK_BOMB_TIMEOUT' });
        this.broadcastState();
      }, durationMs);
      this.botRunner.onStateChange(() => this.broadcastState());
      return;
    }

    // Manage turn timer
    if (state === 'playing' && round?.currentTurn) {
      this.timer.start(round.currentTurn);
      // REQ-F-CP02: Track turn start time for pre-play enrichment timing
      this.turnStartTimes.set(round.currentTurn, new Date().toISOString());
      // REQ-F-TT05: Broadcast immediately so clients receive timer data
      // (bot runner only broadcasts after bot actions, not for human turns)
      this.broadcastState();

      // Auto-pass for human players who have no valid plays
      const seat = round.currentTurn;
      if (!this.botRunner.isBot(seat) && round.currentTrick && round.currentTrick.plays.length > 0) {
        const hand = round.players[seat].hand;
        const wish = round.mahjongWish && !round.wishFulfilled ? round.mahjongWish : null;
        const validPlays = getValidPlays(hand, round.currentTrick, wish);
        if (validPlays.length === 0) {
          const trickCardCount = round.currentTrick.plays[0].combination.cards.length;
          // Auto-pass only when player has fewer cards than the trick requires:
          // - Trick has N cards (N < 4): auto-pass if player has < N cards
          // - Trick has N cards (N >= 4): auto-pass if player has <= 3 cards (can't bomb)
          const shouldAutoPass = trickCardCount >= 4
            ? hand.length <= 3
            : hand.length < trickCardCount;
          if (shouldAutoPass) {
            this.autoPassTimer = setTimeout(() => {
              if (this.destroyed) return;
              // REQ-F-CP02/CP17: Record pre-play context for auto-pass
              this.recordPrePlayForAction(seat, null, 'automation');
              this.actor.send({ type: 'PASS_TURN', seat });
              this.broadcastState();
            }, 500);
          }
        }
      }
    } else if (state === 'awaitingDragonGift' && round?.dragonGiftPending) {
      // REQ-F-TT05: Start timer for Dragon gift selection
      this.timer.start(round.dragonGiftPending.from);
      this.broadcastState();
    } else {
      this.timer.stop();
    }

    // REQ-F-MP01: Trigger bot decisions and broadcast after each bot action
    this.botRunner.onStateChange(() => this.broadcastState());
  }

  /**
   * Handle turn timeout — auto-pass if possible, otherwise auto-play.
   * Covers three "must play" scenarios:
   * 1. Leading a trick: play lowest safe card (avoiding breaking bombs)
   * 2. Must satisfy wish: play the wished card as a single
   * 3. Dragon gift pending: give to optimal opponent
   */
  private handleTurnTimeout(seat: Seat): void {
    if (this.destroyed) return;
    const state = this.stateValue;
    const round = this.context.currentRound;

    // Dragon gift timeout — auto-gift to optimal opponent
    if (state === 'awaitingDragonGift' && round?.dragonGiftPending) {
      const recipient = this.pickDragonGiftRecipient(round, round.dragonGiftPending.from);
      this.actor.send({ type: 'DRAGON_GIFT_CHOSEN', seat: round.dragonGiftPending.from, recipient });
      this.broadcastState();
      return;
    }

    if (state !== 'playing' || !round || round.currentTurn !== seat) return;

    const hand = round.players[seat].hand;
    const wish = round.mahjongWish && !round.wishFulfilled ? round.mahjongWish : null;

    // If can pass, let the state machine handle it
    if (canPlayerPass(hand, round.currentTrick, wish)) {
      // REQ-F-CP02: Record pre-play context for timeout pass
      this.recordPrePlayForAction(seat, null, 'timeout');
      this.actor.send({ type: 'TURN_TIMEOUT', seat });
      this.broadcastState();
      return;
    }

    // Must play — pick the best auto-play card(s)
    const autoPlay = this.pickAutoPlay(hand, round, wish);
    if (autoPlay) {
      // REQ-F-CP02: Record pre-play context for timeout auto-play
      this.recordPrePlayForAction(seat, autoPlay.map(gc => gc.id), 'timeout');
      this.actor.send({ type: 'PLAY_CARDS', seat, cards: autoPlay });
      this.broadcastState();
    }
  }

  /**
   * Pick cards to auto-play when a player times out and must play.
   * - Must satisfy wish: play the wished card as a single
   * - Leading trick: play lowest card that doesn't break a bomb
   */
  private pickAutoPlay(hand: GameCard[], round: RoundState, wish: Rank | null): GameCard[] | null {
    // Must satisfy wish — play the wished card as a single
    if (wish !== null) {
      const wishedCard = hand.find(gc => isStandard(gc.card) && (gc.card as { rank: number }).rank === wish);
      if (wishedCard) return [wishedCard];
    }

    // Leading trick — play lowest card that doesn't break a bomb
    const card = this.pickLowestSafeCard(hand);
    if (card) return [card];

    // Fallback: play the first valid single play
    const validPlays = getValidPlays(hand, round.currentTrick, wish);
    if (validPlays.length > 0) {
      // Pick the play with fewest cards (prefer singles)
      const simplest = validPlays.reduce((a, b) => a.cards.length <= b.cards.length ? a : b);
      return simplest.cards;
    }

    return null;
  }

  /**
   * Pick the lowest single card from a hand that doesn't break a bomb.
   * Priority: Dog, Mahjong (no wish), then 2→A avoiding bomb cards,
   * then Phoenix, Dragon, lowest bomb as last resort.
   */
  private pickLowestSafeCard(hand: GameCard[]): GameCard | null {
    // Find all card IDs that participate in any bomb (four-of-a-kind or straight flush)
    const bombs = detectAllBombs(hand);
    const bombCardIds = new Set<number>();
    for (const bomb of bombs) {
      for (const gc of bomb.cards) {
        bombCardIds.add(gc.id);
      }
    }

    // 1. Dog (always lowest priority lead card)
    const dog = hand.find(gc => isDog(gc.card));
    if (dog) return dog;

    // 2. Mahjong (rank 1, no wish declared)
    const mahjong = hand.find(gc => isMahjong(gc.card));
    if (mahjong) return mahjong;

    // 3. Standard cards 2→Ace, skipping cards that participate in any bomb
    const standards = hand
      .filter(gc => isStandard(gc.card))
      .sort((a, b) => (a.card as { rank: number }).rank - (b.card as { rank: number }).rank);

    for (const gc of standards) {
      if (!bombCardIds.has(gc.id)) return gc;
    }

    // 4. All standard cards are in bombs — prefer specials over breaking bombs
    const phoenix = hand.find(gc => isPhoenix(gc.card));
    if (phoenix) return phoenix;

    const dragon = hand.find(gc => isDragon(gc.card));
    if (dragon) return dragon;

    // 5. Last resort: play lowest card from the lowest-ranked bomb
    if (bombs.length > 0) {
      const lowestBomb = bombs.sort((a, b) => a.rank - b.rank)[0];
      return lowestBomb.cards[0];
    }

    return standards[0] ?? hand[0] ?? null;
  }

  /**
   * Pick the optimal opponent to receive the Dragon gift on timeout.
   * Preference: opponent without Tichu/Grand Tichu → fewer cards → left of trick winner.
   */
  private pickDragonGiftRecipient(round: RoundState, trickWinner: Seat): Seat {
    const opponents = SEATS_IN_ORDER.filter(
      s => getTeam(s) !== getTeam(trickWinner) && round.players[s].finishOrder === null,
    );

    if (opponents.length === 0) {
      // All opponents finished — give to the one that finished last
      return SEATS_IN_ORDER
        .filter(s => getTeam(s) !== getTeam(trickWinner))
        .sort((a, b) => (round.players[b].finishOrder ?? 0) - (round.players[a].finishOrder ?? 0))[0];
    }

    if (opponents.length === 1) return opponents[0];

    // Sort by preference: no Tichu call > fewer cards > left of trick winner
    const seatOrder = SEATS_IN_ORDER;
    const winnerIdx = seatOrder.indexOf(trickWinner);

    opponents.sort((a, b) => {
      const aCall = round.players[a].tipiCall;
      const bCall = round.players[b].tipiCall;
      const aHasTichu = aCall === 'tichu' || aCall === 'grandTichu';
      const bHasTichu = bCall === 'tichu' || bCall === 'grandTichu';

      // Prefer opponent without Tichu call (give dragon to the one who didn't call)
      if (aHasTichu !== bHasTichu) return aHasTichu ? 1 : -1;

      // Prefer opponent with fewer cards
      const aCards = round.players[a].hand.length;
      const bCards = round.players[b].hand.length;
      if (aCards !== bCards) return aCards - bCards;

      // Prefer opponent on the left (next clockwise from trick winner)
      const aIdx = (seatOrder.indexOf(a) - winnerIdx + 4) % 4;
      const bIdx = (seatOrder.indexOf(b) - winnerIdx + 4) % 4;
      return aIdx - bIdx;
    });

    return opponents[0];
  }

  /** REQ-F-CP01: Get accumulated event data (for persistence in M4) */
  getEventAccumulator(): GameEventAccumulator {
    return this.eventCapture.getAccumulator();
  }

  /**
   * REQ-F-CP02: Compute and record pre-play context before a play or pass action.
   * Called before moveHandler/actor.send to capture enrichment fields.
   */
  private recordPrePlayForAction(seat: Seat, cardIds: number[] | null, actionSource: ActionSource): void {
    const round = this.context.currentRound;
    if (!round) return;

    const hand = round.players[seat].hand;
    const wish = round.mahjongWish && !round.wishFulfilled ? round.mahjongWish : null;
    const legalPlays = getValidPlays(hand, round.currentTrick, wish);

    // Determine chosen combination (null for pass)
    let chosenCombination = null;
    if (cardIds) {
      const cards = hand.filter(gc => cardIds.includes(gc.id));
      if (cards.length > 0) {
        chosenCombination = detectCombination(cards) ?? null;
      }
    }

    const handSizes = {} as Record<Seat, number>;
    for (const s of SEATS_IN_ORDER) {
      handSizes[s] = round.players[s].hand.length;
    }

    const prePlay = buildPrePlayContext({
      seat,
      actionSource,
      legalPlays,
      chosenCombination,
      handSize: hand.length,
      handSizes,
      turnStartedAt: this.turnStartTimes.get(seat) ?? null,
    });

    this.eventCapture.recordPrePlayContext(seat, prePlay);
  }

  /** Clean up resources */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.autoPassTimer) clearTimeout(this.autoPassTimer);
    if (this.scoringTimer) clearTimeout(this.scoringTimer);
    if (this.endOfTrickBombTimer) clearTimeout(this.endOfTrickBombTimer);
    this.timer.dispose();
    this.botRunner.dispose();
    this.actor.stop();
  }
}
