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
import { projectGameState } from '../ws/state-projection.js';
import { BotRunner } from '../bot/bot-runner.js';
import { EasyBot } from '../bot/easy-bot.js';
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
  private readonly botRunner: BotRunner;
  private destroyed = false;
  private autoPassTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    gameId: string,
    roomCode: string,
    broadcaster: Broadcaster,
    disconnectHandler: DisconnectHandler,
    config?: Partial<GameConfig>,
  ) {
    this.gameId = gameId;
    this.roomCode = roomCode;
    this.broadcaster = broadcaster;
    this.disconnectHandler = disconnectHandler;

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
        this.disconnectHandler.handleVote(this.roomCode, seat, message.vote);
        return; // Vote handler manages its own broadcasts

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

  /** Handle a player disconnecting from this game */
  handleDisconnect(seat: Seat): void {
    this.disconnectHandler.handleDisconnect(this.roomCode, seat);
  }

  /** Handle a player reconnecting to this game */
  handleReconnect(_ws: WebSocket, seat: Seat): void {
    this.disconnectHandler.handleReconnect(this.roomCode, seat);
    // Send the current full state to the reconnected player
    this.sendStateTo(seat);
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
  registerBot(seat: Seat, difficulty: 'easy' | 'medium' | 'hard' = 'easy'): void {
    let strategy: BotStrategy;
    switch (difficulty) {
      case 'easy':
      default:
        strategy = new EasyBot();
        break;
      // Medium/hard bots can be added here when implemented
    }
    this.botRunner.addBot(seat, strategy);
  }

  /** Broadcast current game state to all players in the room */
  broadcastState(): void {
    if (this.destroyed) return;
    this.broadcaster.broadcastGameState(this.roomCode, this.context, this.stateValue);
  }

  /** Send current game state to a specific player (projected per-seat view) */
  private sendStateTo(seat: Seat): void {
    const view = projectGameState(this.context, this.stateValue, seat);
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

    // Manage turn timer
    if (state === 'playing' && round?.currentTurn) {
      this.timer.start(round.currentTurn);

      // Auto-pass for human players who have no valid plays
      const seat = round.currentTurn;
      if (!this.botRunner.isBot(seat) && round.currentTrick) {
        const hand = round.players[seat].hand;
        const wish = round.mahjongWish && !round.wishFulfilled ? round.mahjongWish : null;
        const validPlays = getValidPlays(hand, round.currentTrick, wish);
        if (validPlays.length === 0) {
          this.autoPassTimer = setTimeout(() => {
            if (this.destroyed) return;
            this.actor.send({ type: 'PASS_TURN', seat });
            this.broadcastState();
          }, 500);
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
    this.timer.dispose();
    this.botRunner.dispose();
    this.actor.stop();
  }
}
