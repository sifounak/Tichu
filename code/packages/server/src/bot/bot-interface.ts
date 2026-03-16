// REQ-F-BOT01: Bot strategy interface
// REQ-F-MP01: Any combination 0-4 humans + bots

import type {
  GameCard,
  Seat,
  Rank,
  Combination,
  TrickState,
  RoundState,
} from '@tichu/shared';

/** Context provided to the bot when choosing a play */
export interface BotPlayContext {
  /** The bot's current hand */
  hand: GameCard[];
  /** The current trick (null if leading) */
  currentTrick: TrickState | null;
  /** Active Mahjong wish (null if none) */
  wish: Rank | null;
  /** All valid plays the bot can make */
  validPlays: Combination[];
  /** Whether the bot can pass */
  canPass: boolean;
  /** Full round state for advanced bots */
  roundState: RoundState;
  /** The bot's seat */
  seat: Seat;
}

/** Decision returned by the bot for play phase */
export type BotPlayDecision =
  | { action: 'play'; cards: GameCard[]; phoenixAs?: Rank }
  | { action: 'pass' };

/**
 * REQ-F-BOT01: Strategy interface that all bots must implement.
 *
 * Each method corresponds to a game phase where the bot must make a decision.
 * Methods receive only the information the bot is allowed to see
 * (its own hand, public trick state, etc.).
 */
export interface BotStrategy {
  /** Bot difficulty level */
  // REQ-F-TIER01: Three bot difficulty tiers
  readonly difficulty: 'regular' | 'hard' | 'expert';

  /** Decide whether to call Grand Tichu (first 8 cards seen) */
  chooseGrandTichu(hand8: GameCard[]): boolean;

  /** Decide whether to call Regular Tichu (all 14 cards seen) */
  chooseRegularTichu(hand14: GameCard[]): boolean;

  /**
   * Choose 3 cards to pass: one to each other player.
   * Returns a record mapping each non-self seat to the card to pass.
   */
  chooseCardsToPass(hand: GameCard[], seat: Seat): Record<Seat, GameCard>;

  /** Choose a play or pass during the playing phase */
  choosePlay(context: BotPlayContext): BotPlayDecision;

  /** Choose which opponent receives the Dragon-won trick */
  chooseDragonGiftRecipient(opponents: Seat[], trickPoints: number): Seat;

  /** Choose a Mahjong wish rank, or null for no wish */
  chooseMahjongWish(hand: GameCard[]): Rank | null;
}
