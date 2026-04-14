// REQ-F-BOT01: Bot strategy interface
// REQ-F-BOT02: Bot runner implementation
// REQ-F-BOT05: Artificial thinking delay
// REQ-F-MP01: Any combination 0-4 humans + bots
// REQ-F-GT06: Bot Grand Tichu decision at exactly 1000 ms
// REQ-F-GT07: No duplicate Grand Tichu timers per bot per round

import type { Seat, RoundState } from '@tichu/shared';
import { SEATS_IN_ORDER, getTeam, getValidPlays, canPlayerPass, isMahjong, detectAllBombs, canBeat, getCardPoints } from '@tichu/shared';
import type { BotStrategy, BotPlayContext } from './bot-interface.js';
import { Bot } from './bot.js';
import type { GameActor, GameMachineContext, GameEvent } from '../game/game-state-machine.js';
import type { MoveHandler } from '../game/move-handler.js';
import type { BotSnapshot } from '../game/game-serializer.js';

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
  minDelayMs: 1000,
  maxDelayMs: 1000,
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

  /** Tracks bots that already have a Grand Tichu timer scheduled (REQ-F-GT07) */
  private readonly grandTichuTimers = new Set<Seat>();

  /** Whether the runner has been disposed */
  private disposed = false;

  /** Callback invoked after each bot action so the game can broadcast state */
  private afterActionCallback: (() => void) | null = null;

  constructor(
    private readonly actor: GameActor,
    private readonly config: BotRunnerConfig = DEFAULT_CONFIG,
    private readonly moveHandler?: MoveHandler,
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
      case 'cardPassing':
        this.handleCardPassingPhase(context);
        break;
      case 'playing':
        this.handlePlayingPhase(context);
        break;
      case 'awaitingDragonGift':
        this.handleDragonGift(context);
        break;
      case 'awaitingEndOfTrickBomb':
        this.handleEndOfTrickBombWindow(context);
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
    this.grandTichuTimers.clear();
    this.bots.clear();
  }

  // ─── Serialization ──────────────────────────────────────────────────────────

  /**
   * Serialize all bot states keyed by seat.
   * Only bots that are instances of Bot (not arbitrary BotStrategy) are included.
   */
  serialize(): Record<string, BotSnapshot> {
    const result: Record<string, BotSnapshot> = {};
    for (const [seat, strategy] of this.bots) {
      if (strategy instanceof Bot) {
        result[seat] = strategy.serialize();
      }
    }
    return result;
  }

  /**
   * Restore a BotRunner from serialized bot states.
   * Creates a new BotRunner and repopulates it with restored Bot instances.
   */
  static restore(
    botStates: Record<string, BotSnapshot>,
    actor: GameActor,
    moveHandler?: MoveHandler,
  ): BotRunner {
    const runner = new BotRunner(actor, undefined, moveHandler);
    for (const [seat, snapshot] of Object.entries(botStates)) {
      const bot = Bot.restore(snapshot);
      runner.addBot(seat as Seat, bot);
    }
    return runner;
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

  /** Schedule a bot play with an explicit delay (no base delay added) */
  private schedulePlayAction(action: () => void, delayMs: number): void {
    if (this.disposed) return;

    const { minDelayMs, maxDelayMs } = this.config;
    if (minDelayMs === 0 && maxDelayMs === 0) {
      // Instant mode (testing)
      const timer = setTimeout(() => {
        this.pendingTimers.delete(timer);
        if (!this.disposed) action();
      }, 0);
      this.pendingTimers.add(timer);
      return;
    }

    const timer = setTimeout(() => {
      this.pendingTimers.delete(timer);
      if (!this.disposed) action();
    }, delayMs);
    this.pendingTimers.add(timer);
  }

  /** Schedule a bot action with artificial base delay (for passes, tichu calls, etc.) */
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

  /**
   * REQ-F-GT06: Schedule a Grand Tichu action at exactly 1000 ms (or immediately
   * in INSTANT_CONFIG). REQ-F-GT07: Skips scheduling if a timer is already pending
   * for this seat.
   */
  private scheduleGrandTichuAction(seat: Seat, action: () => void): void {
    if (this.disposed) return;
    if (this.grandTichuTimers.has(seat)) return; // REQ-F-GT07: deduplicate

    this.grandTichuTimers.add(seat);

    const { minDelayMs, maxDelayMs } = this.config;
    const delayMs = (minDelayMs === 0 && maxDelayMs === 0) ? 0 : 1000; // REQ-F-GT06

    const timer = setTimeout(() => {
      this.pendingTimers.delete(timer);
      this.grandTichuTimers.delete(seat);
      if (!this.disposed) action();
    }, delayMs);
    this.pendingTimers.add(timer);
  }

  /** Send an event to the game actor, then broadcast updated state */
  private send(event: GameEvent): void {
    if (this.disposed) return;
    this.actor.send(event);
    this.afterActionCallback?.();
  }

  // REQ-F-CTX01: Provide game context to advanced bots before each decision
  private provideContext(bot: BotStrategy, round: RoundState, context: GameMachineContext): void {
    bot.setContext?.(round, context.scores, context.config.targetScore);
  }

  // ─── Phase Handlers ──────────────────────────────────────────────────────

  private handleGrandTichuPhase(context: GameMachineContext): void {
    for (const [seat, bot] of this.bots) {
      if (context.grandTichuDecisions.has(seat)) continue;

      const round = context.currentRound;
      if (!round) continue;
      this.provideContext(bot, round, context);
      const hand8 = round.players[seat].hand;

      this.scheduleGrandTichuAction(seat, () => {
        const call = bot.chooseGrandTichu(hand8);
        if (this.moveHandler) {
          const result = this.moveHandler.handleGrandTichuDecision(seat, call);
          if (!result.ok && result.error === 'PARTNER_ALREADY_CALLED') {
            // Partner already called — bot must pass instead
            this.send({ type: 'GRAND_TICHU_PASS', seat });
            return;
          }
          if (result.ok) {
            // MoveHandler already sent the event to the actor
            this.afterActionCallback?.();
            return;
          }
          // Other error (e.g., already decided) — don't double-send
          return;
        }
        // Fallback: no moveHandler — send directly
        this.send(call
          ? { type: 'GRAND_TICHU_CALL', seat }
          : { type: 'GRAND_TICHU_PASS', seat },
        );
      });
    }
  }

  private handleCardPassingPhase(context: GameMachineContext): void {
    for (const [seat, bot] of this.bots) {
      const round = context.currentRound;
      if (!round) continue;
      this.provideContext(bot, round, context);
      const hand = round.players[seat].hand;

      // Regular Tichu is NOT called here — deferred to first play for strategic
      // advantage (opponents can't plan around an early Tichu announcement).

      if (context.cardPassDecisions.has(seat)) continue;

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

    this.provideContext(bot, round, context);
    const player = round.players[seat];

    // Call regular Tichu right before first play — delays the announcement
    // so opponents can't plan around it until the last moment.
    if (!player.hasPlayed && player.tipiCall === 'none') {
      const callTichu = bot.chooseRegularTichu(player.hand);
      if (callTichu) {
        if (this.moveHandler) {
          const result = this.moveHandler.handleTichuDeclaration(seat);
          if (result.ok) {
            this.scheduleAction(() => {
              this.afterActionCallback?.();
            });
          }
        } else {
          this.scheduleAction(() => {
            this.send({ type: 'REGULAR_TICHU_CALL', seat });
          });
        }
      }
    }

    const activeWish = round.mahjongWish && !round.wishFulfilled ? round.mahjongWish : null;
    const validPlays = getValidPlays(player.hand, round.currentTrick, activeWish);
    const canPass = canPlayerPass(player.hand, round.currentTrick, activeWish);

    const playContext: BotPlayContext = {
      hand: player.hand,
      currentTrick: round.currentTrick,
      wish: round.mahjongWish,
      validPlays,
      canPass,
      roundState: round,
      seat,
    };

    // Decide what to do synchronously so we can pick the right delay
    const decision = bot.choosePlay(playContext);

    if (decision.action === 'pass') {
      // No bomb delay for passes
      this.scheduleAction(() => {
        this.send({ type: 'PASS_TURN', seat });
      });
      return;
    }

    // REQ-F-WR01: Include wish inline with PLAY_CARDS to avoid race condition
    const mahjongPlayed = decision.cards.some((gc) => isMahjong(gc.card));
    const wish = mahjongPlayed
      ? (bot.chooseMahjongWish(
          player.hand.filter((gc) => !decision.cards.some((pc) => pc.id === gc.id)),
        ) ?? undefined)
      : undefined;

    const isLead = this.isNewTrickLead();
    const fast = this.onlyBotsRemain();

    // Pause longer after a trick ends so the sweep animation is visible
    const trickSweepPause = isLead && fast ? 800 : 0;

    // Bomb window delay is the sole pacing mechanism for bot plays (no base delay).
    // 1000ms when humans present, 0 when only bots remain or leading.
    const bombWindowDelay = (isLead || fast) ? 0 : 1000;
    const playDelay = Math.max(trickSweepPause, bombWindowDelay);

    this.schedulePlayAction(() => {
      this.send({ type: 'PLAY_CARDS', seat, cards: decision.cards, wish });
    }, playDelay);
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

  /** End-of-trick bomb window: bots decide whether to bomb to steal the trick */
  private handleEndOfTrickBombWindow(context: GameMachineContext): void {
    const round = context.currentRound;
    if (!round?.currentTrick) return;

    const trick = round.currentTrick;
    const trickWinner = trick.currentWinner;
    const winnerTeam = getTeam(trickWinner);

    // Calculate trick point value
    let trickPoints = 0;
    for (const play of trick.plays) {
      for (const gc of play.combination.cards) {
        trickPoints += getCardPoints(gc.card);
      }
    }

    // Each bot checks if it should bomb
    for (const [seat, _bot] of this.bots) {
      if (round.players[seat].finishOrder !== null) continue; // Skip finished
      const botTeam = getTeam(seat);
      if (botTeam === winnerTeam) continue; // Don't bomb own team's trick

      // Only bomb if trick has significant points (10+)
      if (trickPoints < 10) continue;

      // Find a bomb that beats the current top play
      const hand = round.players[seat].hand;
      const bombs = detectAllBombs(hand);
      if (bombs.length === 0) continue;

      const topCombo = trick.plays[trick.plays.length - 1].combination;
      const validBomb = bombs.find((b) => canBeat(b, topCombo));
      if (!validBomb) continue;

      // Instant when only bots remain, otherwise random delay for human observation
      const delay = this.onlyBotsRemain() ? 0 : 500 + Math.random() * 1500;
      this.scheduleAction(() => {
        this.send({ type: 'PLAY_CARDS', seat, cards: validBomb.cards });
      }, delay);
      return; // Only one bot bombs per window
    }
  }

}
