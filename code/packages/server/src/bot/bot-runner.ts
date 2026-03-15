// REQ-F-BOT01: Bot strategy interface
// REQ-F-BOT02: EasyBot implementation
// REQ-F-BOT05: Artificial thinking delay
// REQ-F-MP01: Any combination 0-4 humans + bots

import type { Seat } from '@tichu/shared';
import { SEATS_IN_ORDER, getTeam, getValidPlays, canPlayerPass, isMahjong } from '@tichu/shared';
import type { BotStrategy, BotPlayContext } from './bot-interface.js';
import type { GameActor, GameMachineContext, GameEvent } from '../game/game-state-machine.js';

/** Configuration for bot timing */
export interface BotRunnerConfig {
  /** Minimum delay in ms before bot acts */
  minDelayMs: number;
  /** Maximum delay in ms before bot acts */
  maxDelayMs: number;
}

/** Default timing config — artificial thinking delay for readability */
// REQ-NF-DL03: Bot delay so human players can follow gameplay
const DEFAULT_CONFIG: BotRunnerConfig = {
  minDelayMs: 800,
  maxDelayMs: 1500,
};

/** Fast config for testing */
export const INSTANT_CONFIG: BotRunnerConfig = {
  minDelayMs: 0,
  maxDelayMs: 0,
};

/**
 * REQ-F-BOT05: Manages bot instances for a game.
 *
 * Called by GameManager when it's a bot's turn or when a bot needs to make
 * a decision. Adds artificial delay to simulate "thinking" before executing
 * the bot's strategy.
 */
export class BotRunner {
  /** Bot strategy instances keyed by seat */
  private readonly bots = new Map<Seat, BotStrategy>();

  /** Pending delay timers (for cleanup) */
  private readonly pendingTimers = new Set<ReturnType<typeof setTimeout>>();

  /** Whether the runner has been disposed */
  private disposed = false;

  /** Callback invoked after each bot action so the game can broadcast state */
  private afterActionCallback: (() => void) | null = null;

  constructor(
    private readonly actor: GameActor,
    private readonly config: BotRunnerConfig = DEFAULT_CONFIG,
  ) {}

  /** Register a bot strategy for a specific seat */
  addBot(seat: Seat, strategy: BotStrategy): void {
    this.bots.set(seat, strategy);
  }

  /** Remove a bot from a seat (e.g., when a human reconnects) */
  removeBot(seat: Seat): void {
    this.bots.delete(seat);
  }

  /** Check if a seat is occupied by a bot */
  isBot(seat: Seat): boolean {
    return this.bots.has(seat);
  }

  /** Get all bot seats */
  getBotSeats(): Seat[] {
    return Array.from(this.bots.keys());
  }

  /**
   * Trigger bot actions based on current game state.
   * Should be called after every state transition.
   * @param onAfterAction — called after each bot action so the game can broadcast updated state
   */
  onStateChange(onAfterAction?: () => void): void {
    if (this.disposed || this.bots.size === 0) return;

    this.afterActionCallback = onAfterAction ?? null;

    const snapshot = this.actor.getSnapshot();
    const context = snapshot.context;
    const state = typeof snapshot.value === 'string' ? snapshot.value : String(snapshot.value);

    switch (state) {
      case 'grandTichuDecision':
        this.handleGrandTichuPhase(context);
        break;
      case 'regularTichuDecision':
        this.handleRegularTichuPhase(context);
        break;
      case 'cardPassing':
        this.handleCardPassingPhase(context);
        break;
      case 'playing':
        this.handlePlayingPhase(context);
        break;
      case 'awaitingDragonGift':
        this.handleDragonGift(context);
        break;
    }
  }

  /** Clean up all pending timers */
  dispose(): void {
    this.disposed = true;
    for (const timer of this.pendingTimers) {
      clearTimeout(timer);
    }
    this.pendingTimers.clear();
    this.bots.clear();
  }

  /** Check if all active (non-finished) players are bots */
  private onlyBotsRemain(): boolean {
    const snapshot = this.actor.getSnapshot();
    const round = snapshot.context.currentRound;
    if (!round) return false;
    const activePlayers = SEATS_IN_ORDER.filter((s) => round.players[s].finishOrder === null);
    return activePlayers.length > 0 && activePlayers.every((s) => this.bots.has(s));
  }

  /** Check if a new trick is about to start (previous trick just ended) */
  private isNewTrickLead(): boolean {
    const snapshot = this.actor.getSnapshot();
    const round = snapshot.context.currentRound;
    return !!round && round.currentTrick === null && round.currentTurn !== null;
  }

  /** Schedule a bot action with artificial delay */
  private scheduleAction(action: () => void, extraDelayMs = 0): void {
    if (this.disposed) return;

    const { minDelayMs, maxDelayMs } = this.config;
    if (minDelayMs === 0 && maxDelayMs === 0) {
      // Instant mode (testing) — use microtask to avoid reentrant actor.send
      const timer = setTimeout(() => {
        this.pendingTimers.delete(timer);
        if (!this.disposed) action();
      }, 0);
      this.pendingTimers.add(timer);
      return;
    }

    // Speed up significantly when only bots are left playing
    const fast = this.onlyBotsRemain();
    const min = fast ? 50 : minDelayMs;
    const max = fast ? 150 : maxDelayMs;

    const delay = min + Math.random() * (max - min) + extraDelayMs;
    const timer = setTimeout(() => {
      this.pendingTimers.delete(timer);
      if (!this.disposed) action();
    }, delay);
    this.pendingTimers.add(timer);
  }

  /** Send an event to the game actor, then broadcast updated state */
  private send(event: GameEvent): void {
    if (this.disposed) return;
    this.actor.send(event);
    this.afterActionCallback?.();
  }

  // ─── Phase Handlers ──────────────────────────────────────────────────────

  private handleGrandTichuPhase(context: GameMachineContext): void {
    for (const [seat, bot] of this.bots) {
      if (context.grandTichuDecisions.has(seat)) continue;

      const round = context.currentRound;
      if (!round) continue;
      const hand8 = round.players[seat].hand;

      this.scheduleAction(() => {
        const call = bot.chooseGrandTichu(hand8);
        this.send(call
          ? { type: 'GRAND_TICHU_CALL', seat }
          : { type: 'GRAND_TICHU_PASS', seat },
        );
      });
    }
  }

  private handleRegularTichuPhase(context: GameMachineContext): void {
    for (const [seat, bot] of this.bots) {
      if (context.regularTichuDecisions.has(seat)) continue;

      const round = context.currentRound;
      if (!round) continue;
      const hand14 = round.players[seat].hand;

      this.scheduleAction(() => {
        const call = bot.chooseRegularTichu(hand14);
        this.send(call
          ? { type: 'REGULAR_TICHU_CALL', seat }
          : { type: 'REGULAR_TICHU_PASS', seat },
        );
      });
    }
  }

  private handleCardPassingPhase(context: GameMachineContext): void {
    for (const [seat, bot] of this.bots) {
      if (context.cardPassDecisions.has(seat)) continue;

      const round = context.currentRound;
      if (!round) continue;
      const hand = round.players[seat].hand;

      this.scheduleAction(() => {
        const cards = bot.chooseCardsToPass(hand, seat);
        this.send({ type: 'CARDS_PASSED', seat, cards });
      });
    }
  }

  private handlePlayingPhase(context: GameMachineContext): void {
    const round = context.currentRound;
    if (!round || !round.currentTurn) return;

    const seat = round.currentTurn;
    const bot = this.bots.get(seat);
    if (!bot) return;

    const player = round.players[seat];
    const validPlays = getValidPlays(player.hand, round.currentTrick, round.mahjongWish);
    const canPass = canPlayerPass(player.hand, round.currentTrick, round.mahjongWish);

    const playContext: BotPlayContext = {
      hand: player.hand,
      currentTrick: round.currentTrick,
      wish: round.mahjongWish,
      validPlays,
      canPass,
      roundState: round,
      seat,
    };

    // Pause longer after a trick ends so the sweep animation is visible
    const trickSweepPause = this.isNewTrickLead() && this.onlyBotsRemain() ? 800 : 0;

    this.scheduleAction(() => {
      const decision = bot.choosePlay(playContext);

      if (decision.action === 'pass') {
        this.send({ type: 'PASS_TURN', seat });
        return;
      }

      // REQ-F-WR01: Include wish inline with PLAY_CARDS to avoid race condition
      const mahjongPlayed = decision.cards.some((gc) => isMahjong(gc.card));
      const wish = mahjongPlayed
        ? (bot.chooseMahjongWish(
            player.hand.filter((gc) => !decision.cards.some((pc) => pc.id === gc.id)),
          ) ?? undefined)
        : undefined;

      this.send({ type: 'PLAY_CARDS', seat, cards: decision.cards, wish });
    }, trickSweepPause);
  }

  private handleDragonGift(context: GameMachineContext): void {
    const round = context.currentRound;
    if (!round?.dragonGiftPending) return;

    const seat = round.dragonGiftPending.from;
    const bot = this.bots.get(seat);
    if (!bot) return;

    // Find opponents who haven't finished
    const seatTeam = getTeam(seat);
    const opponents = (['north', 'east', 'south', 'west'] as Seat[]).filter(
      (s) => getTeam(s) !== seatTeam && round.players[s].finishOrder === null,
    );

    if (opponents.length === 0) return;

    // Calculate trick points
    const trickCards = round.dragonGiftPending.trickCards;
    let trickPoints = 0;
    for (const gc of trickCards) {
      if (gc.card.kind === 'dragon') trickPoints += 25;
      else if (gc.card.kind === 'phoenix') trickPoints -= 25;
      else if (gc.card.kind === 'standard') {
        if (gc.card.rank === 10 || gc.card.rank === 13) trickPoints += 10;
        else if (gc.card.rank === 5) trickPoints += 5;
      }
    }

    this.scheduleAction(() => {
      const recipient = bot.chooseDragonGiftRecipient(opponents, trickPoints);
      this.send({ type: 'DRAGON_GIFT_CHOSEN', seat, recipient });
    });
  }

}
