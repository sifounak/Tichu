// REQ-F-INFO02: Card tracking (top 10 + bomb detection)
// REQ-F-CALL01: Grand Tichu evaluation (refined + Dragon+Phoenix = almost always)
// REQ-F-CALL02: Regular Tichu evaluation (score-aware)
// REQ-F-PASS04: Anti-bomb passing conventions
// REQ-F-PLAY05: Endgame one-two prevention
// REQ-F-PLAY06: Always optimal (no randomness)
// REQ-F-PLAY07: Full hand planning at round start
// REQ-F-DEF01: Opponent Tichu defense
// REQ-F-INFO01: Uses only human-available information

import type { GameCard, Seat, Rank, Combination, RoundState } from '@tichu/shared';
import {
  CombinationType,
  SEATS_IN_ORDER,
  getTeam,
  getPartner,
  isDragon,
  isPhoenix,
  isDog,
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
  rankCombinationsForLead,
  rankCombinationsForFollow,
} from './bot-strategy-utils.js';
import { CardTracker } from './card-tracker.js';

// ─── Hand Plan ───────────────────────────────────────────────────────────────

/** REQ-F-PLAY07: Hand plan categorizes cards into strategic groups */
export interface HandPlan {
  /** Cards to lead with early (weak combos, Dog) */
  losersToLead: Combination[];
  /** Cards that can be discarded on partner's winning tricks */
  discards: GameCard[];
  /** High-value cards that win when played */
  winners: Combination[];
  /** How Phoenix should be used: 'singleton-killer' or 'wild' */
  phoenixRole: 'singleton-killer' | 'wild';
  /** Whether we have enough strength to consider Tichu */
  handIsStrong: boolean;
  /** Track if plan has been invalidated (e.g., bomb played on planned winner) */
  valid: boolean;
}

/**
 * ExpertBot — near-expert bot with hand planning, card tracking, and optimal play.
 *
 * Implements BotStrategy independently via composition.
 * Key differences from HardBot:
 * - Full hand planning at round start (REQ-F-PLAY07)
 * - Card tracking of top 10 cards (REQ-F-INFO02)
 * - Score-aware Tichu calls (REQ-F-CALL02)
 * - Anti-bomb passing (REQ-F-PASS04)
 * - One-two prevention (REQ-F-PLAY05)
 * - Always optimal — no randomness (REQ-F-PLAY06)
 */
export class ExpertBot implements BotStrategy {
  readonly difficulty = 'expert' as const;

  /** REQ-F-INFO02: Tracks top 10 cards and absent ranks */
  private cardTracker = new CardTracker();

  /** REQ-F-PLAY07: Current hand plan */
  private handPlan: HandPlan | null = null;

  /** Whether hand plan has been created this round */
  private planCreated = false;

  /** Cached round state for Dragon gift decisions */
  private lastRoundState: RoundState | null = null;

  /** Track current round number to detect new rounds */
  private currentRound = -1;

  /** REQ-F-CALL02: Score differential (our team - their team), null if unknown */
  private scoreDiff: number | null = null;

  // ─── Grand Tichu ──────────────────────────────────────────────────────────

  /**
   * REQ-F-CALL01: Refined Grand Tichu evaluation.
   * Dragon+Phoenix = almost always call (unless other cards are terrible).
   * Uses stricter evaluation than HardBot.
   */
  chooseGrandTichu(hand8: GameCard[]): boolean {
    const hasDragon = hand8.some((gc) => isDragon(gc.card));
    const hasPhoenix = hand8.some((gc) => isPhoenix(gc.card));

    // Dragon + Phoenix = almost always call
    if (hasDragon && hasPhoenix) return true;

    const topCount = countTopCards(hand8, { includeMahjongDog: true });

    // 0-1 top cards = never
    if (topCount <= 1) return false;

    // Expert is slightly more aggressive: 3+ top cards with Dragon or Phoenix
    if (topCount >= 3 && (hasDragon || hasPhoenix)) return true;

    // 4+ top cards = call
    return topCount >= 4;
  }

  // ─── Regular Tichu ────────────────────────────────────────────────────────

  /**
   * REQ-F-CALL02: Refined Regular Tichu evaluation.
   * Uses stricter base evaluation than HardBot.
   * Score-awareness is applied via setScores() when available.
   */
  chooseRegularTichu(hand14: GameCard[]): boolean {
    const strength = evaluateHandStrength(hand14);
    const leadGetters = countLeadGetters(hand14);

    let threshold = 12;
    let leadGetterThreshold = 4;

    // REQ-F-CALL02: Score-aware adjustments
    if (this.scoreDiff !== null) {
      if (this.scoreDiff >= 200) {
        // Comfortably ahead — suppress risky calls
        threshold = 15;
        leadGetterThreshold = 5;
      } else if (this.scoreDiff <= -200) {
        // Behind — be more aggressive
        threshold = 10;
        leadGetterThreshold = 3;
      }
    }

    return strength >= threshold && leadGetters >= leadGetterThreshold;
  }

  /**
   * REQ-F-CALL02: Set the current score differential (our team - their team).
   * Called by BotRunner or externally before Tichu decisions.
   */
  setScoreDiff(diff: number): void {
    this.scoreDiff = diff;
  }

  // ─── Card Passing ─────────────────────────────────────────────────────────

  /**
   * REQ-F-PASS04: Anti-bomb passing + standard strategic passing.
   * Never pass two same-rank cards to one opponent.
   */
  chooseCardsToPass(hand: GameCard[], seat: Seat): Record<Seat, GameCard> {
    const basePass = selectPassCards(hand, seat);

    // REQ-F-PASS04: Check for anti-bomb violation
    const partner = getPartner(seat);
    const opponents = SEATS_IN_ORDER.filter((s) => s !== seat && s !== partner);

    if (opponents.length === 2) {
      const opp1Card = basePass[opponents[0]];
      const opp2Card = basePass[opponents[1]];

      // Check if we're passing same rank to both opponents
      if (
        opp1Card && opp2Card &&
        opp1Card.card.kind === 'standard' && opp2Card.card.kind === 'standard' &&
        opp1Card.card.rank === opp2Card.card.rank
      ) {
        // Swap one opponent card with partner card to break the pair
        // Give the lower card to partner, keep higher for opponent
        const partnerCard = basePass[partner];
        if (partnerCard) {
          basePass[opponents[1]] = partnerCard;
          basePass[partner] = opp2Card;
        }
      }
    }

    return basePass;
  }

  // ─── Play Selection ───────────────────────────────────────────────────────

  /**
   * REQ-F-PLAY05, REQ-F-PLAY06, REQ-F-PLAY07, REQ-F-DEF01:
   * Optimal play with hand planning, card tracking, and endgame adaptation.
   */
  choosePlay(context: BotPlayContext): BotPlayDecision {
    const { hand, currentTrick, validPlays, roundState, seat } = context;

    // Cache round state for Dragon gift decisions
    this.lastRoundState = roundState;

    // Detect new round and reset tracking
    if (roundState.roundNumber !== this.currentRound) {
      this.currentRound = roundState.roundNumber;
      this.cardTracker.reset();
      this.handPlan = null;
      this.planCreated = false;
    }

    // REQ-F-INFO02: Update card tracker
    this.cardTracker.update(roundState, seat, hand);

    // REQ-F-PLAY07: Create hand plan on first play of round
    if (!this.planCreated && validPlays.length > 0) {
      this.handPlan = this.createHandPlan(hand, validPlays);
      this.planCreated = true;
    }

    // No valid plays → must pass
    if (validPlays.length === 0) {
      return { action: 'pass' };
    }

    // REQ-F-PLAY03, REQ-F-DEF01: Check if we should bomb
    const bombs = validPlays.filter((c) => c.isBomb);
    const nonBombs = validPlays.filter((c) => !c.isBomb);

    if (bombs.length > 0 && currentTrick && !isPartnerWinning(currentTrick, seat)) {
      if (shouldPlayBomb(roundState, seat, bombs)) {
        return this.makeBombDecision(bombs);
      }
    }

    // REQ-F-PLAY05: Endgame one-two prevention
    if (this.shouldPreventOneTwo(roundState, seat)) {
      return this.chooseOneTwoPreventionPlay(context, nonBombs.length > 0 ? nonBombs : validPlays);
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
   * REQ-F-WISH01: Strategic Mahjong wish.
   */
  chooseMahjongWish(hand: GameCard[]): Rank | null {
    return selectMahjongWish(hand);
  }

  // ─── Hand Planning (REQ-F-PLAY07) ─────────────────────────────────────────

  /**
   * Create a hand plan by categorizing cards into losers, discards, and winners.
   * Decides Phoenix role (singleton-killer vs. wild) and sticks with it.
   */
  private createHandPlan(hand: GameCard[], validPlays: Combination[]): HandPlan {
    const losersToLead: Combination[] = [];
    const winners: Combination[] = [];
    const discards: GameCard[] = [];

    // Separate valid lead plays into winners and losers
    const leadPlays = rankCombinationsForLead(validPlays);

    for (const combo of leadPlays) {
      if (combo.isBomb) {
        winners.push(combo);
        continue;
      }

      // Single Dragon or Ace = winner
      if (combo.cards.length === 1) {
        const card = combo.cards[0];
        if (isDragon(card.card)) {
          winners.push(combo);
          continue;
        }
        if (card.card.kind === 'standard' && card.card.rank === 14) {
          winners.push(combo);
          continue;
        }
      }

      // Dog = special — goes to losersToLead (play early)
      if (combo.cards.length === 1 && isDog(combo.cards[0].card)) {
        losersToLead.push(combo);
        continue;
      }

      // Low combos (rank <= 8) are losers to lead with
      if (combo.rank <= 8) {
        losersToLead.push(combo);
      } else {
        // High combos could be winners or losers depending on context
        // For now, rank >= 12 are winners, 9-11 are losers
        if (combo.rank >= 12) {
          winners.push(combo);
        } else {
          losersToLead.push(combo);
        }
      }
    }

    // Identify discard candidates (low cards not in useful combos)
    const comboCardIds = new Set<number>();
    for (const combo of [...losersToLead, ...winners]) {
      for (const gc of combo.cards) {
        comboCardIds.add(gc.id);
      }
    }
    for (const gc of hand) {
      if (!comboCardIds.has(gc.id) && gc.card.kind === 'standard' && gc.card.rank <= 6) {
        discards.push(gc);
      }
    }

    // Decide Phoenix role
    const hasPhoenix = hand.some((gc) => isPhoenix(gc.card));
    let phoenixRole: 'singleton-killer' | 'wild' = 'singleton-killer';
    if (hasPhoenix) {
      // Count how many singletons we have (Phoenix is better as singleton-killer
      // when we have few other high singletons to win with)
      const highSingletons = hand.filter(
        (gc) => gc.card.kind === 'standard' && gc.card.rank >= 12,
      ).length;
      // If we have many high singletons already, Phoenix as wild for combos
      if (highSingletons >= 3) {
        phoenixRole = 'wild';
      }
    }

    const strength = evaluateHandStrength(hand);

    return {
      losersToLead,
      discards,
      winners,
      phoenixRole,
      handIsStrong: strength >= 12,
      valid: true,
    };
  }

  /**
   * Invalidate hand plan (e.g., when a bomb disrupts our planned winners).
   */
  private invalidatePlan(): void {
    if (this.handPlan) {
      this.handPlan.valid = false;
    }
  }

  // ─── One-Two Prevention (REQ-F-PLAY05) ────────────────────────────────────

  /**
   * Check if we should switch to one-two prevention mode.
   * Activates when an opponent's teammate has already gone out first.
   */
  private shouldPreventOneTwo(roundState: RoundState, seat: Seat): boolean {
    const myTeam = getTeam(seat);
    const finishOrder = roundState.finishOrder;

    if (finishOrder.length === 0) return false;

    // Check if first player out is an opponent
    const firstOut = finishOrder[0];
    if (getTeam(firstOut) === myTeam) return false;

    // Check if the other opponent is still active (could go out second)
    const otherOpponent = SEATS_IN_ORDER.find(
      (s) => getTeam(s) !== myTeam && s !== firstOut,
    );
    if (!otherOpponent) return false;

    // Is the other opponent still in the game?
    return roundState.players[otherOpponent].finishOrder === null;
  }

  /**
   * REQ-F-PLAY05: Aggressively prevent one-two.
   * Play highest cards to win tricks and prevent remaining opponent from going out.
   */
  private chooseOneTwoPreventionPlay(
    context: BotPlayContext,
    plays: Combination[],
  ): BotPlayDecision {
    const { currentTrick, hand, canPass, seat } = context;

    // Invalidate hand plan — we're in emergency mode
    this.invalidatePlan();

    // Can go out? Always do it.
    for (const combo of plays) {
      if (canGoOut(hand, combo)) {
        return this.combinationToDecision(combo);
      }
    }

    if (!currentTrick) {
      // Leading: play highest combination to control the game
      const ranked = rankCombinationsForLead(plays);
      // Reverse: play highest, not lowest
      return this.combinationToDecision(ranked[ranked.length - 1] ?? ranked[0]);
    }

    // Following: play highest to win the trick (don't let opponent win)
    if (isPartnerWinning(currentTrick, seat)) {
      // Partner winning — pass unless we can go out
      if (canPass) return { action: 'pass' };
    }

    // Play highest card to win
    const ranked = rankCombinationsForFollow(plays);
    return this.combinationToDecision(ranked[ranked.length - 1] ?? ranked[0]);
  }

  // ─── Lead Play ────────────────────────────────────────────────────────────

  /**
   * Choose a lead play using hand plan when available. No randomness (REQ-F-PLAY06).
   */
  private chooseLeadPlay(validPlays: Combination[], hand: GameCard[]): BotPlayDecision {
    // REQ-F-PLAY07: Use hand plan to guide lead selection
    if (this.handPlan?.valid && this.handPlan.losersToLead.length > 0) {
      // Find a planned loser that's still a valid play
      for (const planned of this.handPlan.losersToLead) {
        const match = validPlays.find((vp) =>
          vp.cards.length === planned.cards.length &&
          vp.cards.every((c) => planned.cards.some((p) => p.id === c.id)),
        );
        if (match) {
          return this.combinationToDecision(match);
        }
      }
    }

    // REQ-F-PLAY06: No randomness — always optimal
    const play = selectLeadPlay(validPlays, hand);
    if (!play) {
      return { action: 'pass' };
    }
    return this.combinationToDecision(play);
  }

  // ─── Follow Play ──────────────────────────────────────────────────────────

  /**
   * Choose a follow play with partner awareness. No randomness (REQ-F-PLAY06).
   */
  private chooseFollowPlay(context: BotPlayContext, plays: Combination[]): BotPlayDecision {
    const { currentTrick, seat, roundState, hand, canPass } = context;
    const partnerWinning = isPartnerWinning(currentTrick, seat);
    const opponentCallers = getOpponentTichuCallers(roundState, seat);

    // REQ-F-PLAY04: If partner is winning, pass (unless can go out)
    if (partnerWinning && canPass) {
      for (const combo of plays) {
        if (canGoOut(hand, combo)) {
          return this.combinationToDecision(combo);
        }
      }
      return { action: 'pass' };
    }

    // REQ-F-PLAY06: No randomness — always play optimally
    const result = selectFollowPlay(
      { ...context, validPlays: plays },
      {
        partnerWinning,
        opponentTichuCalled: opponentCallers.length > 0,
        // No randomFactor — Expert always optimal
      },
    );

    if (result.action === 'pass') {
      return { action: 'pass' };
    }
    return this.combinationToDecision(result.combo);
  }

  // ─── Bomb Decision ────────────────────────────────────────────────────────

  /**
   * Choose the weakest bomb that still wins (save stronger bombs).
   */
  private makeBombDecision(bombs: Combination[]): BotPlayDecision {
    const sorted = [...bombs].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === CombinationType.FourBomb ? -1 : 1;
      }
      return a.rank - b.rank;
    });
    return this.combinationToDecision(sorted[0]);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

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

  // ─── Testing Accessors ────────────────────────────────────────────────────

  /** Expose card tracker for testing */
  getCardTracker(): CardTracker {
    return this.cardTracker;
  }

  /** Expose hand plan for testing */
  getHandPlan(): HandPlan | null {
    return this.handPlan;
  }
}
