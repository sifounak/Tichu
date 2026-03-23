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
  Seat,
} from '@tichu/shared';
import { getValidPlays } from '@tichu/shared';
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
import { HardBot } from '../bot/hard-bot.js';
import { ExpertBot } from '../bot/expert-bot.js';
import type { BotStrategy } from '../bot/bot-interface.js';

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
  /** Seats that have been vacated (player left mid-game, waiting for replacement) */
  private readonly vacatedSeats = new Set<Seat>();
  /** Seats occupied by players who are choosing which vacated seat to take */
  private readonly choosingSeats = new Set<Seat>();

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

    // REQ-F-MP01: Create bot runner for automated bot decisions
    this.botRunner = new BotRunner(this.actor);

    // Create turn timer with timeout callback
    const turnTimerSeconds = config?.turnTimerSeconds ?? null;
    this.timer = new TurnTimer(turnTimerSeconds, (seat) => {
      this.actor.send({ type: 'TURN_TIMEOUT', seat });
      this.broadcastState();
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
        result = this.moveHandler.handleGrandTichuDecision(seat, message.call);
        break;

      case 'TICHU_DECLARATION':
        result = this.moveHandler.handleTichuDeclaration(seat);
        break;

      // REQ-F-RTP02: Regular Tichu pass (skip without calling)
      case 'REGULAR_TICHU_PASS':
        result = this.moveHandler.handleRegularTichuPass(seat);
        break;

      case 'PASS_CARDS':
        result = this.moveHandler.handlePassCards(seat, message.cards as Record<Seat, GameCard>);
        break;

      case 'CANCEL_PASS_CARDS':
        result = this.moveHandler.handleCancelPassCards(seat);
        break;

      case 'PLAY_CARDS':
        result = this.moveHandler.handlePlayCards(seat, message.cardIds, message.phoenixAs, message.wish);
        break;

      case 'PASS_TURN':
        result = this.moveHandler.handlePassTurn(seat);
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
      this.broadcaster.sendError(ws, 'INVALID_MOVE', result.error);
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

  /** Mark a seat as vacated (player left mid-game). Game pauses until filled. */
  handleSeatVacated(seat: Seat): void {
    this.vacatedSeats.add(seat);
    this.timer.stop();
    this.broadcastState();
  }

  /** Fill a vacated seat with a new player.
   *  If 2+ seats are vacated, the player must choose — mark them as choosing.
   *  If only 1 seat is vacated (last spot), auto-fill immediately. */
  handleSeatFilled(seat: Seat): void {
    this.vacatedSeats.delete(seat);
    // If this seat was previously a bot, remove the bot so the new player is treated as human
    if (this.botRunner.isBot(seat)) {
      this.botRunner.removeBot(seat);
    }
    if (this.vacatedSeats.size > 0) {
      // 2+ seats were vacated; player just took one but others remain.
      // They need to choose which vacated seat they actually want.
      this.choosingSeats.add(seat);
    }
    this.sendStateTo(seat);
    this.broadcastState();
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

  /** REQ-F-MP01, REQ-F-TIER02: Register a bot at the given seat */
  registerBot(seat: Seat, difficulty: 'regular' | 'hard' | 'expert' = 'expert'): void {
    let strategy: BotStrategy;
    switch (difficulty) {
      case 'hard':
        strategy = new HardBot();
        break;
      case 'regular':
      case 'expert':
      default:
        strategy = new ExpertBot();
        break;
    }
    this.botRunner.addBot(seat, strategy);
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
    this.broadcaster.broadcastGameState(this.roomCode, this.context, this.stateValue, [...this.vacatedSeats], [...this.choosingSeats], voteStatus, activeVote);
  }

  /** Send current game state to a specific player (projected per-seat view) */
  private sendStateTo(seat: Seat): void {
    const voteStatus = this.disconnectHandler.getVoteStatus(this.roomCode);
    const activeVote = this.voteHandler.getActiveVote(this.roomCode);
    const view = projectGameState(this.context, this.stateValue, seat, [...this.vacatedSeats], [...this.choosingSeats], voteStatus, activeVote);
    this.broadcaster.sendToPlayer(this.roomCode, seat, {
      type: 'GAME_STATE',
      state: view,
    });
  }

  /** Called on every state machine transition */
  private onStateChange(_snapshot: unknown): void {
    const state = this.stateValue;
    const round = this.context.currentRound;

    // Clear any pending auto-pass
    if (this.autoPassTimer) {
      clearTimeout(this.autoPassTimer);
      this.autoPassTimer = null;
    }

    // Round scoring: broadcast state (client sees final card + scores), then
    // advance to next round or game over after a delay
    if (state === 'roundScoring') {
      this.timer.stop();
      this.broadcastState();
      if (this.scoringTimer) clearTimeout(this.scoringTimer);
      this.scoringTimer = setTimeout(() => {
        if (this.destroyed) return;
        this.actor.send({ type: 'ADVANCE_FROM_SCORING' });
        this.broadcastState();
      }, 1500); // 1.5s delay: lets clients animate the final card before advancing
      return;
    }

    // Manage turn timer
    if (state === 'playing' && round?.currentTurn) {
      this.timer.start(round.currentTurn);

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
              this.actor.send({ type: 'PASS_TURN', seat });
              this.broadcastState();
            }, 500);
          }
        }
      }
    } else {
      this.timer.stop();
    }

    // REQ-F-MP01: Trigger bot decisions and broadcast after each bot action
    this.botRunner.onStateChange(() => this.broadcastState());
  }

  /** Clean up resources */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.autoPassTimer) clearTimeout(this.autoPassTimer);
    if (this.scoringTimer) clearTimeout(this.scoringTimer);
    this.timer.dispose();
    this.botRunner.dispose();
    this.actor.stop();
  }
}
