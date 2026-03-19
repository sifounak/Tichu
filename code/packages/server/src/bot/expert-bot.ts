// Expert bot strategy based on community Tichu strategy guide principles.
// Key sources: BGA Tips_tichu — Passing Cards, Leading, Following, Bombing,
// Tichu Calling, Grand Tichu, special card usage, defensive play, point tracking.

import type { GameCard, Seat, Rank, Combination, RoundState } from '@tichu/shared';
import {
  CombinationType,
  SEATS_IN_ORDER,
  getTeam,
  getPartner,
  isDragon,
  isPhoenix,
  isDog,
  isMahjong,
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
  sortByStrength,
  getCardStrength,
  selectLeadPlay,
  isPartnerWinning,
  canGoOut,
  getOpponentTichuCallers,
  selectDragonRecipient,
  rankCombinationsForLead,
  rankCombinationsForFollow,
  findSingletons,
  findBombs,
} from './bot-strategy-utils.js';
import { CardTracker } from './card-tracker.js';

// ─── Hand Plan ───────────────────────────────────────────────────────────────

/** Hand plan categorizes cards into strategic groups */
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
 * ExpertBot — strategy-guide-informed bot implementing community best practices.
 *
 * Key principles from BGA Tips:
 * - Straights > pairs (converts losers to wins)
 * - Save bombs for late-game Tichu defense
 * - Keep Ace/Dragon/Phoenix within team; pass weak singles to opponents
 * - Anti-bomb passing: never pass same rank to both opponents
 * - Score-aware Grand Tichu and Regular Tichu calls
 * - Track played cards (top 10) for accurate hand reading
 * - End with low singles or Dog — plan exit sequence
 * - Prevent 1-2 finishes aggressively
 * - "Just because you can beat a play doesn't mean you should"
 */
export class ExpertBot implements BotStrategy {
  readonly difficulty = 'expert' as const;

  private cardTracker = new CardTracker();
  private handPlan: HandPlan | null = null;
  private planCreated = false;
  private lastRoundState: RoundState | null = null;
  private currentRound = -1;
  private scoreDiff: number | null = null;

  // ─── Grand Tichu ──────────────────────────────────────────────────────────

  /**
   * Grand Tichu evaluation based on strategy guide:
   * - Tied/close scores: call with AAA, Dragon+Ace, or Phoenix+Ace in first 8
   * - Behind 200-300: call with paired Aces, solo Phoenix, or solo Dragon
   * - Behind 400+: call with just solo Ace in first 8
   * - Be aggressive when behind, conservative when ahead
   */
  chooseGrandTichu(hand8: GameCard[]): boolean {
    const hasDragon = hand8.some((gc) => isDragon(gc.card));
    const hasPhoenix = hand8.some((gc) => isPhoenix(gc.card));
    const aceCount = hand8.filter(
      (gc) => gc.card.kind === 'standard' && gc.card.rank === 14,
    ).length;
    const topCount = countTopCards(hand8, { includeMahjongDog: true });

    // Dragon + Phoenix = almost always call (strategy guide)
    if (hasDragon && hasPhoenix) return true;

    // Score-aware thresholds
    const deficit = this.scoreDiff !== null ? -this.scoreDiff : 0;

    if (deficit >= 400) {
      // Desperate — call with just solo Ace
      return aceCount >= 1 || hasDragon || hasPhoenix;
    }

    if (deficit >= 200) {
      // Behind — call with paired Aces, solo Dragon, or solo Phoenix
      return aceCount >= 2 || (hasDragon && aceCount >= 1) || (hasPhoenix && aceCount >= 1);
    }

    // Normal/ahead: conservative
    // AAA = call, Dragon+Ace = call, Phoenix+Ace = call
    if (aceCount >= 3) return true;
    if ((hasDragon || hasPhoenix) && aceCount >= 1 && topCount >= 3) return true;
    if (topCount >= 4) return true;

    // Comfortably ahead — suppress risky calls
    if (this.scoreDiff !== null && this.scoreDiff >= 200) return false;

    return false;
  }

  // ─── Regular Tichu ────────────────────────────────────────────────────────

  /**
   * Regular Tichu evaluation:
   * - Check "exit turn" — can we play all cards in ~7 turns?
   * - Score-aware: aggressive when behind, conservative when ahead
   * - Strategy guide: check hand strength + lead getters
   */
  chooseRegularTichu(hand14: GameCard[]): boolean {
    const strength = evaluateHandStrength(hand14);
    const leadGetters = countLeadGetters(hand14);

    let threshold = 12;
    let leadGetterThreshold = 4;

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

  setScoreDiff(diff: number): void {
    this.scoreDiff = diff;
  }

  // ─── Card Passing ─────────────────────────────────────────────────────────

  /**
   * Card passing based on strategy guide:
   * - Pass weakest cards to opponents (low singletons)
   * - Pass highest useful card to partner (Ace/Dragon/Phoenix if multiple)
   * - "Straights > pairs: 23456 converts 5 losers into a null"
   * - Anti-bomb: never pass same rank to both opponents
   * - Keep Dragon/Phoenix on team; give to partner if can't call Tichu
   * - Convention: pass Ace/Dragon/Phoenix to partner if holding more than one
   */
  chooseCardsToPass(hand: GameCard[], seat: Seat): Record<Seat, GameCard> {
    const partner = getPartner(seat);
    const opponents = SEATS_IN_ORDER.filter((s) => s !== seat && s !== partner);
    const sorted = sortByStrength(hand);

    const hasDragon = hand.some((gc) => isDragon(gc.card));
    const hasPhoenix = hand.some((gc) => isPhoenix(gc.card));
    const aceCount = hand.filter(
      (gc) => gc.card.kind === 'standard' && gc.card.rank === 14,
    ).length;
    const powerCardCount = (hasDragon ? 1 : 0) + (hasPhoenix ? 1 : 0) + aceCount;

    // Determine if we can call Tichu (affects whether we keep power cards)
    const strength = evaluateHandStrength(hand);
    const canCallTichu = strength >= 12 && countLeadGetters(hand) >= 4;

    // ─ Partner card selection ─
    // Convention: pass Ace/Dragon/Phoenix to partner if holding more than one
    // If can't call Tichu, give Dragon/Phoenix to partner
    let partnerCard: GameCard | null = null;

    if (!canCallTichu && powerCardCount >= 1) {
      // Give best power card to partner (Dragon > Phoenix > Ace)
      if (hasDragon) {
        partnerCard = hand.find((gc) => isDragon(gc.card))!;
      } else if (hasPhoenix) {
        partnerCard = hand.find((gc) => isPhoenix(gc.card))!;
      } else if (aceCount > 0) {
        partnerCard = hand.find(
          (gc) => gc.card.kind === 'standard' && gc.card.rank === 14,
        )!;
      }
    } else if (canCallTichu && powerCardCount >= 2) {
      // Can call Tichu — give one power card to partner, keep the rest
      // Give in order: extra Ace > Phoenix (if Dragon held) > Dragon (if Phoenix held)
      if (aceCount >= 2) {
        partnerCard = hand.find(
          (gc) => gc.card.kind === 'standard' && gc.card.rank === 14,
        )!;
      } else if (hasDragon && hasPhoenix) {
        // Keep both for Tichu call — give an Ace if available, else highest standard
        partnerCard = hand.find(
          (gc) => gc.card.kind === 'standard' && gc.card.rank === 14,
        ) ?? null;
      }
    }

    // Fallback: give partner the highest non-special card we can spare
    if (!partnerCard) {
      const spareForPartner = [...sorted]
        .reverse()
        .find(
          (gc) =>
            !isDragon(gc.card) && !isDog(gc.card) &&
            !(canCallTichu && isPhoenix(gc.card)) &&
            !(canCallTichu && gc.card.kind === 'standard' && gc.card.rank === 14),
        );
      partnerCard = spareForPartner ?? sorted[sorted.length - 1];
    }

    // ─ Opponent card selection ─
    // Pass weakest non-special cards (low singletons preferred)
    const usedIds = new Set([partnerCard.id]);
    const weakCards = sorted.filter(
      (gc) =>
        !usedIds.has(gc.id) &&
        !isDragon(gc.card) && !isPhoenix(gc.card) && !isDog(gc.card),
    );

    const opp1Card = weakCards[0] ?? sorted.find((gc) => !usedIds.has(gc.id))!;
    usedIds.add(opp1Card.id);

    let opp2Card = weakCards.find((gc) => !usedIds.has(gc.id))
      ?? sorted.find((gc) => !usedIds.has(gc.id))!;

    // Anti-bomb check: never pass same rank to both opponents
    if (
      opp1Card.card.kind === 'standard' && opp2Card.card.kind === 'standard' &&
      opp1Card.card.rank === opp2Card.card.rank
    ) {
      const alt = weakCards.find(
        (gc) =>
          !usedIds.has(gc.id) &&
          gc.card.kind === 'standard' &&
          (gc.card as { rank: number }).rank !== (opp1Card.card as { rank: number }).rank,
      );
      if (alt) opp2Card = alt;
    }

    const result = {} as Record<Seat, GameCard>;
    result[opponents[0]] = opp1Card;
    result[opponents[1]] = opp2Card;
    result[partner] = partnerCard;
    result[seat] = sorted[0]; // Placeholder
    return result;
  }

  // ─── Play Selection ───────────────────────────────────────────────────────

  /**
   * Play selection following strategy guide principles:
   * - "Remember cards already played, especially Aces, Dragon, Phoenix"
   * - "Just because you can beat a play doesn't mean you should"
   * - Save bombs for late when opponents call Tichu (1-5 cards remaining)
   * - End with low singles or Dog
   * - Prevent 1-2 finishes aggressively
   */
  choosePlay(context: BotPlayContext): BotPlayDecision {
    const { hand, currentTrick, validPlays, roundState, seat } = context;

    this.lastRoundState = roundState;

    // Detect new round
    if (roundState.roundNumber !== this.currentRound) {
      this.currentRound = roundState.roundNumber;
      this.cardTracker.reset();
      this.handPlan = null;
      this.planCreated = false;
    }

    // Update card tracker
    this.cardTracker.update(roundState, seat, hand);

    // Create hand plan on first play
    if (!this.planCreated && validPlays.length > 0) {
      this.handPlan = this.createHandPlan(hand, validPlays);
      this.planCreated = true;
    }

    if (validPlays.length === 0) {
      return { action: 'pass' };
    }

    // Separate bombs from non-bombs
    const bombs = validPlays.filter((c) => c.isBomb);
    const nonBombs = validPlays.filter((c) => !c.isBomb);

    // Strategy guide: play bombs late, when Tichu callers have 1-5 cards
    if (bombs.length > 0 && currentTrick && !isPartnerWinning(currentTrick, seat)) {
      if (this.shouldBombNow(roundState, seat, bombs)) {
        return this.playWeakestBomb(bombs);
      }
    }

    // 1-2 prevention mode
    if (this.shouldPreventOneTwo(roundState, seat)) {
      return this.chooseOneTwoPreventionPlay(context, nonBombs.length > 0 ? nonBombs : validPlays);
    }

    // Leading
    if (!currentTrick) {
      return this.chooseLeadPlay(validPlays, hand, roundState, seat);
    }

    // Following
    return this.chooseFollowPlay(context, nonBombs.length > 0 ? nonBombs : validPlays);
  }

  // ─── Dragon Gift ──────────────────────────────────────────────────────────

  chooseDragonGiftRecipient(opponents: Seat[], _trickPoints: number): Seat {
    return selectDragonRecipient(opponents, this.lastRoundState);
  }

  // ─── Mahjong Wish ─────────────────────────────────────────────────────────

  /**
   * Mahjong wish based on strategy guide:
   * - Wish for a card not in your hand to disrupt opponents
   * - With a Queen full house, wish for King to reduce being beaten
   * - If opponent behind you called Grand Tichu, wish for Ace
   */
  chooseMahjongWish(hand: GameCard[]): Rank | null {
    const haveRanks = new Set<number>();
    for (const gc of hand) {
      if (gc.card.kind === 'standard') haveRanks.add(gc.card.rank);
    }

    // If opponent called Grand Tichu, wish for Ace to force it out
    if (this.lastRoundState) {
      const myTeam = getTeam(
        SEATS_IN_ORDER.find((s) => this.lastRoundState!.players[s].hand.length > 0) ?? 'north',
      );
      for (const s of SEATS_IN_ORDER) {
        if (getTeam(s) !== myTeam && this.lastRoundState.players[s].tipiCall === 'grandTichu') {
          if (!haveRanks.has(14)) return 14 as Rank; // Wish for Ace
        }
      }
    }

    // Wish for mid-high rank we don't have (disrupts straights and combos)
    const wishCandidates: Rank[] = [10, 9, 8, 7, 11] as Rank[];
    for (const rank of wishCandidates) {
      if (!haveRanks.has(rank)) return rank;
    }

    return null;
  }

  // ─── Hand Planning ────────────────────────────────────────────────────────

  private createHandPlan(hand: GameCard[], validPlays: Combination[]): HandPlan {
    const losersToLead: Combination[] = [];
    const winners: Combination[] = [];
    const discards: GameCard[] = [];

    const leadPlays = rankCombinationsForLead(validPlays);

    for (const combo of leadPlays) {
      if (combo.isBomb) {
        winners.push(combo);
        continue;
      }

      // Single Dragon or Ace = winner
      if (combo.cards.length === 1) {
        const card = combo.cards[0];
        if (isDragon(card.card)) { winners.push(combo); continue; }
        if (card.card.kind === 'standard' && card.card.rank === 14) { winners.push(combo); continue; }
      }

      // Dog = lead early (guaranteed lead transfer to partner)
      if (combo.cards.length === 1 && isDog(combo.cards[0].card)) {
        losersToLead.push(combo);
        continue;
      }

      // Strategy guide: "Straights > pairs, 23456 converts 5 losers into a null"
      // Straights with low cards are good leads (high chance of winning)
      if (combo.type === CombinationType.Straight && combo.rank <= 10) {
        losersToLead.push(combo);
        continue;
      }

      // Low combos (rank <= 8) are losers to lead
      if (combo.rank <= 8) {
        losersToLead.push(combo);
      } else if (combo.rank >= 12) {
        winners.push(combo);
      } else {
        losersToLead.push(combo);
      }
    }

    // Identify discard candidates
    const comboCardIds = new Set<number>();
    for (const c of [...losersToLead, ...winners]) {
      for (const gc of c.cards) comboCardIds.add(gc.id);
    }
    for (const gc of hand) {
      if (!comboCardIds.has(gc.id) && gc.card.kind === 'standard' && gc.card.rank <= 6) {
        discards.push(gc);
      }
    }

    // Phoenix role: singleton-killer if we lack high singletons, wild otherwise
    const hasPhoenix = hand.some((gc) => isPhoenix(gc.card));
    let phoenixRole: 'singleton-killer' | 'wild' = 'singleton-killer';
    if (hasPhoenix) {
      const highSingletons = findSingletons(hand).filter(
        (gc) => gc.card.kind === 'standard' && gc.card.rank >= 12,
      ).length;
      if (highSingletons >= 3) phoenixRole = 'wild';
    }

    const strength = evaluateHandStrength(hand);
    return { losersToLead, discards, winners, phoenixRole, handIsStrong: strength >= 12, valid: true };
  }

  // ─── Bomb Timing ──────────────────────────────────────────────────────────

  /**
   * Strategy guide: "Play bombs late when opponents call Tichu, especially
   * targeting the Tichu caller. Play when Tichu callers have 1-5 cards remaining."
   */
  private shouldBombNow(roundState: RoundState, seat: Seat, bombs: Combination[]): boolean {
    if (bombs.length === 0) return false;
    const myTeam = getTeam(seat);

    // Opponent about to go out (1-2 cards) — bomb to prevent
    for (const s of SEATS_IN_ORDER) {
      if (getTeam(s) === myTeam) continue;
      if (roundState.players[s].finishOrder !== null) continue;
      if (roundState.players[s].hand.length <= 2) return true;
    }

    // Opponent called Tichu and has 1-5 cards — they've likely exhausted premium cards
    for (const s of SEATS_IN_ORDER) {
      if (getTeam(s) === myTeam) continue;
      if (roundState.players[s].finishOrder !== null) continue;
      const call = roundState.players[s].tipiCall;
      if ((call === 'tichu' || call === 'grandTichu') && roundState.players[s].hand.length <= 5) {
        return true;
      }
    }

    return false;
  }

  private playWeakestBomb(bombs: Combination[]): BotPlayDecision {
    // Play weakest bomb that still wins (save stronger bombs)
    const sorted = [...bombs].sort((a, b) => {
      if (a.type !== b.type) return a.type === CombinationType.FourBomb ? -1 : 1;
      return a.rank - b.rank;
    });
    return this.toDecision(sorted[0]);
  }

  // ─── 1-2 Prevention ───────────────────────────────────────────────────────

  private shouldPreventOneTwo(roundState: RoundState, seat: Seat): boolean {
    const myTeam = getTeam(seat);
    const finishOrder = roundState.finishOrder;
    if (finishOrder.length === 0) return false;

    const firstOut = finishOrder[0];
    if (getTeam(firstOut) === myTeam) return false;

    const otherOpponent = SEATS_IN_ORDER.find(
      (s) => getTeam(s) !== myTeam && s !== firstOut,
    );
    if (!otherOpponent) return false;
    return roundState.players[otherOpponent].finishOrder === null;
  }

  /**
   * Strategy guide: "Determine your objective each hand. Against strong opponent
   * hands, concentrate on preventing 1-2 finishes rather than stopping Tichu calls."
   */
  private chooseOneTwoPreventionPlay(
    context: BotPlayContext,
    plays: Combination[],
  ): BotPlayDecision {
    const { currentTrick, hand, canPass, seat } = context;

    if (this.handPlan) this.handPlan.valid = false;

    // Can go out? Always do it.
    for (const combo of plays) {
      if (canGoOut(hand, combo)) return this.toDecision(combo);
    }

    if (!currentTrick) {
      // Leading: play highest to control
      const ranked = rankCombinationsForLead(plays);
      return this.toDecision(ranked[ranked.length - 1] ?? ranked[0]);
    }

    // Partner winning — pass (strategy guide: don't overplay partner)
    if (isPartnerWinning(currentTrick, seat) && canPass) {
      return { action: 'pass' };
    }

    // Play highest to win the trick
    const ranked = rankCombinationsForFollow(plays);
    return this.toDecision(ranked[ranked.length - 1] ?? ranked[0]);
  }

  // ─── Lead Play ────────────────────────────────────────────────────────────

  /**
   * Strategy guide principles for leading:
   * - Lead low combinations / losers first
   * - Dog early (guaranteed lead transfer to partner)
   * - "End with low singles or Dogs rather than low singles alone"
   * - Save Aces/Dragon for later (use as lead getters when needed)
   * - Prefer straights over pairs as leads (converts more losers)
   */
  private chooseLeadPlay(
    validPlays: Combination[],
    hand: GameCard[],
    roundState: RoundState,
    seat: Seat,
  ): BotPlayDecision {
    // Use hand plan when available
    if (this.handPlan?.valid && this.handPlan.losersToLead.length > 0) {
      for (const planned of this.handPlan.losersToLead) {
        const match = validPlays.find((vp) =>
          vp.cards.length === planned.cards.length &&
          vp.cards.every((c) => planned.cards.some((p) => p.id === c.id)),
        );
        if (match) return this.toDecision(match);
      }
    }

    // Strategy guide: prefer straights over pairs (more efficient)
    const ranked = rankCombinationsForLead(validPlays);

    // Prefer Dog early for lead transfer
    const dogPlay = ranked.find((c) => c.cards.length === 1 && isDog(c.cards[0].card));
    // Strategy guide: "Don't play Dog too early during Tichu calls"
    // Only play Dog if we have other leads or partner likely stronger
    const opponentCallers = getOpponentTichuCallers(roundState, seat);
    if (dogPlay && opponentCallers.length === 0) return this.toDecision(dogPlay);

    // Can go out? Always do it.
    for (const combo of ranked) {
      if (canGoOut(hand, combo)) return this.toDecision(combo);
    }

    // Lead with lowest non-winner (save winners)
    for (const combo of ranked) {
      if (combo.cards.length === 1 && isDragon(combo.cards[0].card)) continue;
      if (combo.type === CombinationType.Single &&
        combo.cards[0].card.kind === 'standard' && combo.cards[0].card.rank === 14) continue;
      return this.toDecision(combo);
    }

    return this.toDecision(ranked[0]);
  }

  // ─── Follow Play ──────────────────────────────────────────────────────────

  /**
   * Strategy guide: "Remember that just because you can beat an opponent's play,
   * doesn't mean you should. It's often better to save your high cards for later."
   *
   * - If partner winning, pass (unless can go out)
   * - If opponent calling Tichu, play more aggressively
   * - Win with minimum force
   * - Don't waste Aces/Dragon on low tricks if you don't need to
   */
  private chooseFollowPlay(context: BotPlayContext, plays: Combination[]): BotPlayDecision {
    const { currentTrick, seat, roundState, hand, canPass } = context;
    const partnerWinning = isPartnerWinning(currentTrick, seat);
    const opponentCallers = getOpponentTichuCallers(roundState, seat);

    // Partner winning — pass (don't overplay partner)
    if (partnerWinning && canPass) {
      for (const combo of plays) {
        if (canGoOut(hand, combo)) return this.toDecision(combo);
      }
      return { action: 'pass' };
    }

    // Can go out? Always play.
    for (const combo of plays) {
      if (canGoOut(hand, combo)) return this.toDecision(combo);
    }

    const ranked = rankCombinationsForFollow(plays);

    // Strategy guide: "save high cards for later" — if opponent didn't call Tichu
    // and the trick is low value, consider passing to save winners
    if (canPass && opponentCallers.length === 0 && currentTrick) {
      const trickRank = currentTrick.plays[currentTrick.plays.length - 1]?.combination.rank ?? 0;
      // If we'd need to play an Ace or Dragon on a low trick, pass instead
      if (trickRank <= 8 && ranked.length > 0) {
        const cheapestWin = ranked[0];
        if (cheapestWin.rank >= 14 || (cheapestWin.cards.length === 1 && isDragon(cheapestWin.cards[0].card))) {
          return { action: 'pass' };
        }
      }
    }

    // Win with minimum force
    if (ranked.length > 0) {
      return this.toDecision(ranked[0]);
    }

    if (canPass) return { action: 'pass' };
    return this.toDecision(plays[0]);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private toDecision(combo: Combination): BotPlayDecision {
    const phoenixCard = combo.cards.find((gc) => isPhoenix(gc.card));
    let phoenixAs: Rank | undefined;
    if (phoenixCard && combo.phoenixUsedAs !== undefined) {
      phoenixAs = combo.phoenixUsedAs as Rank;
    }
    return { action: 'play', cards: combo.cards, phoenixAs };
  }

  // ─── Testing Accessors ────────────────────────────────────────────────────

  getCardTracker(): CardTracker {
    return this.cardTracker;
  }

  getHandPlan(): HandPlan | null {
    return this.handPlan;
  }
}
