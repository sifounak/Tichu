// REQ-F-CALL01: Grand Tichu hand evaluation (heuristic thresholds)
// REQ-F-CALL02: Regular Tichu hand evaluation (lead getter counting)
// REQ-F-PASS01: Strategic passing (low to opponents, best to partner)
// REQ-F-PASS02: Dog passing strategy
// REQ-F-PASS03: Pass adjustment based on hand strength
// REQ-F-PLAY01: Lead low, win high
// REQ-F-PLAY02: Special card handling (Dragon, Phoenix, Dog, Mahjong)
// REQ-F-PLAY03: Bomb timing (save for critical moments)
// REQ-F-PLAY04: Partner support (don't overplay partner)
// REQ-F-PLAY06: 10-15% randomness via injectable random source
// REQ-F-DRAG01: Dragon gift to opponent with most cards
// REQ-F-WISH01: Strategic Mahjong wish
// REQ-F-DEF01: Opponent Tichu defense (save bombs for caller)
// REQ-F-INFO01: Uses only human-available information

import type { GameCard, Seat, Rank, Combination, RoundState } from '@tichu/shared';
import {
  CombinationType,
  isDragon,
  isPhoenix,
} from '@tichu/shared';
import type {
  BotStrategy,
  BotPlayContext,
  BotPlayDecision,
} from './bot-interface.js';
import {
  countTopCards,
  countLeadGetters,
  evaluateHandStrength,
  selectPassCards,
  selectLeadPlay,
  selectFollowPlay,
  isPartnerWinning,
  canGoOut,
  shouldPlayBomb,
  getOpponentTichuCallers,
  selectMahjongWish,
  selectDragonRecipient,
} from './bot-strategy-utils.js';

/** REQ-F-PLAY06: Default randomness factor for HardBot (10-15% suboptimal plays) */
const HARD_BOT_RANDOM_FACTOR = 0.12;

/**
 * HardBot — strong intermediate bot with heuristic strategy.
 *
 * Uses per-trick evaluation (no hand planning), strategic card passing,
 * Tichu call thresholds, and 10-15% randomness for unpredictability.
 */
export class HardBot implements BotStrategy {
  readonly difficulty = 'hard' as const;

  /** Injectable random source for deterministic testing */
  private readonly random: () => number;

  /** Cached round state from last choosePlay call for Dragon gift decisions */
  private lastRoundState: RoundState | null = null;

  constructor(randomSource?: () => number) {
    this.random = randomSource ?? Math.random;
  }

  // ─── Grand Tichu ──────────────────────────────────────────────────────────

  /**
   * REQ-F-CALL01: Call Grand Tichu if 4+ top-8 cards in first 8 cards.
   * Top-8 cards: Dragon, Phoenix, 4 Aces, Mahjong, Dog.
   * Dragon+Phoenix together = always call.
   * 0-1 top cards = never call.
   */
  chooseGrandTichu(hand8: GameCard[]): boolean {
    const hasDragon = hand8.some((gc) => isDragon(gc.card));
    const hasPhoenix = hand8.some((gc) => isPhoenix(gc.card));

    // Dragon + Phoenix = always call
    if (hasDragon && hasPhoenix) return true;

    const topCount = countTopCards(hand8, { includeMahjongDog: true });

    // 0-1 top cards = never
    if (topCount <= 1) return false;

    // 4+ top cards = call
    return topCount >= 4;
  }

  // ─── Regular Tichu ────────────────────────────────────────────────────────

  /**
   * REQ-F-CALL02: Call Regular Tichu when hand strength exceeds threshold.
   * Uses evaluateHandStrength() — call when winners clearly exceed losers.
   */
  chooseRegularTichu(hand14: GameCard[]): boolean {
    const strength = evaluateHandStrength(hand14);
    const leadGetters = countLeadGetters(hand14);

    // Need strong hand (high score) AND enough leads to control the game
    // Threshold: strength >= 12 and at least 4 lead getters
    return strength >= 12 && leadGetters >= 4;
  }

  // ─── Card Passing ─────────────────────────────────────────────────────────

  /**
   * REQ-F-PASS01, REQ-F-PASS02, REQ-F-PASS03: Strategic card passing.
   * - Low unmatched singletons to opponents
   * - Best spare card to partner
   * - Never pass Dragon/Phoenix to opponents
   * - Dog kept unless hand very weak
   */
  chooseCardsToPass(hand: GameCard[], seat: Seat): Record<Seat, GameCard> {
    return selectPassCards(hand, seat);
  }

  // ─── Play Selection ───────────────────────────────────────────────────────

  /**
   * REQ-F-PLAY01 through REQ-F-PLAY04, REQ-F-PLAY06, REQ-F-DEF01:
   * Per-trick heuristic evaluation with 10-15% randomness.
   */
  choosePlay(context: BotPlayContext): BotPlayDecision {
    const { hand, currentTrick, validPlays, roundState, seat } = context;

    // Cache round state for Dragon gift decisions
    this.lastRoundState = roundState;

    // No valid plays → must pass
    if (validPlays.length === 0) {
      return { action: 'pass' };
    }

    // REQ-F-PLAY03, REQ-F-DEF01: Check if we should bomb
    const bombs = validPlays.filter((c) => c.isBomb);
    const nonBombs = validPlays.filter((c) => !c.isBomb);

    // If opponent is about to go out or called Tichu, consider bombing
    if (bombs.length > 0 && currentTrick && !isPartnerWinning(currentTrick, seat)) {
      if (shouldPlayBomb(roundState, seat, bombs)) {
        return this.makeBombDecision(bombs, hand);
      }
    }

    // Leading (no current trick)
    if (!currentTrick) {
      return this.chooseLeadPlay(validPlays, hand);
    }

    // Following (trick active)
    return this.chooseFollowPlay(context, nonBombs.length > 0 ? nonBombs : validPlays);
  }

  // ─── Dragon Gift ──────────────────────────────────────────────────────────

  /**
   * REQ-F-DRAG01: Give Dragon trick to opponent with most cards.
   */
  chooseDragonGiftRecipient(opponents: Seat[], _trickPoints: number): Seat {
    return selectDragonRecipient(opponents, this.lastRoundState);
  }

  // ─── Mahjong Wish ─────────────────────────────────────────────────────────

  /**
   * REQ-F-WISH01: Wish for mid-rank (7-10) not in hand when playing singleton.
   * Returns null when Mahjong is part of a straight (handled by the caller—
   * this method is only invoked for singleton Mahjong plays).
   */
  chooseMahjongWish(hand: GameCard[]): Rank | null {
    return selectMahjongWish(hand);
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /**
   * Choose a lead play. Uses selectLeadPlay with random factor.
   */
  private chooseLeadPlay(validPlays: Combination[], hand: GameCard[]): BotPlayDecision {
    const play = selectLeadPlay(validPlays, hand, {
      randomFactor: HARD_BOT_RANDOM_FACTOR,
      randomSource: this.random,
    });

    if (!play) {
      return { action: 'pass' };
    }
    return this.combinationToDecision(play);
  }

  /**
   * Choose a follow play. Uses selectFollowPlay with partner awareness.
   */
  private chooseFollowPlay(context: BotPlayContext, plays: Combination[]): BotPlayDecision {
    const { currentTrick, seat, roundState, hand, canPass } = context;
    const partnerWinning = isPartnerWinning(currentTrick, seat);
    const opponentCallers = getOpponentTichuCallers(roundState, seat);

    // REQ-F-PLAY04: If partner is winning, pass (unless can go out)
    if (partnerWinning && canPass) {
      // Check if we can go out with any play
      for (const combo of plays) {
        if (canGoOut(hand, combo)) {
          return this.combinationToDecision(combo);
        }
      }
      return { action: 'pass' };
    }

    // Use selectFollowPlay for standard follow logic
    const result = selectFollowPlay(
      { ...context, validPlays: plays },
      {
        partnerWinning,
        opponentTichuCalled: opponentCallers.length > 0,
        randomFactor: HARD_BOT_RANDOM_FACTOR,
        randomSource: this.random,
      },
    );

    if (result.action === 'pass') {
      return { action: 'pass' };
    }
    return this.combinationToDecision(result.combo);
  }

  /**
   * Choose the best bomb to play.
   */
  private makeBombDecision(bombs: Combination[], _hand: GameCard[]): BotPlayDecision {
    // Play the weakest bomb that still wins (save stronger bombs)
    const sorted = [...bombs].sort((a, b) => {
      // Four-of-a-kind before straight flush (save stronger)
      if (a.type !== b.type) {
        return a.type === CombinationType.FourBomb ? -1 : 1;
      }
      return a.rank - b.rank;
    });
    return this.combinationToDecision(sorted[0]);
  }

  /**
   * Convert a Combination to a BotPlayDecision.
   */
  private combinationToDecision(combo: Combination): BotPlayDecision {
    const phoenixCard = combo.cards.find((gc) => isPhoenix(gc.card));
    let phoenixAs: Rank | undefined;
    if (phoenixCard && combo.phoenixUsedAs !== undefined) {
      phoenixAs = combo.phoenixUsedAs as Rank;
    }
    return {
      action: 'play',
      cards: combo.cards,
      phoenixAs,
    };
  }
}
