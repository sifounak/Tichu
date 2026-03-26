// Expert bot strategy based on community Tichu strategy guide principles.
// Key sources: BGA Tips_tichu — Passing Cards, Leading, Following, Bombing,
// Tichu Calling, Grand Tichu, special card usage, defensive play, point tracking.

import type { GameCard, Seat, Rank, Combination, RoundState } from '@tichu/shared';
import {
  CombinationType,
  SEATS_IN_ORDER,
  getTeam,
  getPartner,
  getNextSeat,
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
  computeGrandTichuIndex,
  computeTichuIndex,
  sortByStrength,
  isPartnerWinning,
  canGoOut,
  getOpponentTichuCallers,
  selectDragonRecipient,
  rankCombinationsForLead,
  rankCombinationsForFollow,
  findSingletons,
  getEndgamePhase,
  getHandSizes,
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
  // REQ-F-PASS05: Track card passed to left opponent for Mah Jong wish
  private passedToLeft: GameCard | null = null;
  // REQ-F-MJ01: Track whether Mah Jong was played in a straight (no wish)
  private mahjongPlayedInStraight = false;
  // Track bot's seat for context in methods that don't receive it
  private mySeat: Seat = 'north';

  // ─── Grand Tichu ──────────────────────────────────────────────────────────

  // REQ-F-GT01, REQ-F-GT02: Stanford Grand Tichu index with score-adaptive thresholds
  /**
   * Grand Tichu evaluation using Stanford CS229 Ig index + score context.
   *
   * Ig = N_Ace + 3*N_dragon + 3*N_phoenix + 3*N_bomb
   *
   * Score-adaptive thresholds (shifted upward from Stanford baseline for strong play):
   * - Ahead 200+: Ig >= 6 (Dragon+Phoenix only)
   * - Even/close: Ig >= 4 (Dragon+Ace, Phoenix+Ace, Dragon+Phoenix)
   * - Behind 200-300: Ig >= 3 (Dragon alone, Phoenix alone, 3 Aces)
   * - Behind 400+: Ig >= 2 (2 Aces, 1 Ace+bomb)
   */
  chooseGrandTichu(hand8: GameCard[]): boolean {
    const ig = computeGrandTichuIndex(hand8);
    const deficit = this.scoreDiff !== null ? -this.scoreDiff : 0;

    if (deficit >= 400) return ig >= 2;
    if (deficit >= 200) return ig >= 3;
    if (this.scoreDiff !== null && this.scoreDiff >= 200) return ig >= 6;
    return ig >= 4;
  }

  // ─── Regular Tichu ────────────────────────────────────────────────────────

  // REQ-F-RT01, REQ-F-RT02: Stanford Tichu index with score-adaptive thresholds
  /**
   * Regular Tichu evaluation using Stanford CS229 It index + score context.
   *
   * It = 2*N_Ace - 2*N_dog + 6*N_dragon + 6*N_phoenix + 5*N_bomb + N_straight - N_small
   *
   * Score-adaptive thresholds:
   * - Ahead 200+: It >= 9
   * - Even/close: It >= 7 (Stanford's 50% success probability)
   * - Behind 200+: It >= 5
   */
  chooseRegularTichu(hand14: GameCard[]): boolean {
    const it = computeTichuIndex(hand14);
    const deficit = this.scoreDiff !== null ? -this.scoreDiff : 0;

    if (deficit >= 200) return it >= 5;
    if (this.scoreDiff !== null && this.scoreDiff >= 200) return it >= 9;
    return it >= 7;
  }

  setScoreDiff(diff: number): void {
    this.scoreDiff = diff;
  }

  // ─── Card Passing ─────────────────────────────────────────────────────────

  // REQ-F-PASS01-05: Card passing with strength concentration + parity convention
  /**
   * Card passing based on strategy research:
   * - REQ-F-PASS01: Strength concentration — weak hand passes best to partner,
   *   strong hand passes 3rd-worst
   * - REQ-F-PASS02: Parity convention — odd ranks to left, even ranks to right
   * - REQ-F-PASS03: Anti-bomb — never same rank to both opponents
   * - REQ-F-PASS04: Special card rules — Dragon/Phoenix team-only, Dog to partner if strong
   * - REQ-F-PASS05: Track passedToLeft for Mah Jong wish
   */
  chooseCardsToPass(hand: GameCard[], seat: Seat): Record<Seat, GameCard> {
    this.mySeat = seat;
    const partner = getPartner(seat);
    const leftOpp = getNextSeat(seat); // clockwise = left-hand opponent
    const rightOpp = SEATS_IN_ORDER.find(
      (s) => s !== seat && s !== partner && s !== leftOpp,
    )!;
    const sorted = sortByStrength(hand);

    const hasDragon = hand.some((gc) => isDragon(gc.card));
    const hasPhoenix = hand.some((gc) => isPhoenix(gc.card));
    const it = computeTichuIndex(hand);
    const isStrongHand = it >= 7; // Can potentially call Tichu

    // ─ REQ-F-PASS01: Partner card selection (strength concentration) ─
    let partnerCard: GameCard | null = null;

    if (!isStrongHand) {
      // Weak hand: pass best card to partner (Fuegi: concentrate strength)
      // Dragon > Phoenix > Ace > highest standard
      if (hasDragon) {
        partnerCard = hand.find((gc) => isDragon(gc.card))!;
      } else if (hasPhoenix) {
        partnerCard = hand.find((gc) => isPhoenix(gc.card))!;
      } else {
        // Pass highest card (last in sorted = strongest)
        partnerCard = sorted[sorted.length - 1];
      }
    } else {
      // Strong hand: pass 3rd-worst card to partner
      // But still pass Dog to partner if we have it (signal strength)
      const hasDog = hand.some((gc) => isDog(gc.card));
      if (hasDog) {
        // REQ-F-PASS04: Pass Dog to partner from strong hand
        partnerCard = hand.find((gc) => isDog(gc.card))!;
      } else {
        // 3rd-worst non-special card
        const nonSpecial = sorted.filter(
          (gc) => !isDragon(gc.card) && !isPhoenix(gc.card) && !isDog(gc.card),
        );
        partnerCard = nonSpecial[2] ?? nonSpecial[nonSpecial.length - 1] ?? sorted[2];
      }
    }

    // ─ REQ-F-PASS02: Opponent card selection with parity convention ─
    // Pick 2 weakest non-special cards (excluding partner card)
    const usedIds = new Set([partnerCard.id]);
    const opponentCandidates = sorted.filter(
      (gc) =>
        !usedIds.has(gc.id) &&
        !isDragon(gc.card) && !isPhoenix(gc.card) && !isDog(gc.card),
    );

    // Pick 2 weakest
    let oppCard1 = opponentCandidates[0]
      ?? sorted.find((gc) => !usedIds.has(gc.id))!;
    usedIds.add(oppCard1.id);
    let oppCard2 = opponentCandidates.find((gc) => !usedIds.has(gc.id))
      ?? sorted.find((gc) => !usedIds.has(gc.id))!;

    // REQ-F-PASS03: Anti-bomb check
    if (
      oppCard1.card.kind === 'standard' && oppCard2.card.kind === 'standard' &&
      oppCard1.card.rank === oppCard2.card.rank
    ) {
      const alt = opponentCandidates.find(
        (gc) =>
          !usedIds.has(gc.id) &&
          gc.card.kind === 'standard' &&
          (gc.card as { rank: number }).rank !== (oppCard1.card as { rank: number }).rank,
      );
      if (alt) oppCard2 = alt;
    }

    // Apply parity convention: odd → left, even → right
    let leftCard: GameCard;
    let rightCard: GameCard;

    const rank1 = oppCard1.card.kind === 'standard' ? oppCard1.card.rank : 0;
    const rank2 = oppCard2.card.kind === 'standard' ? oppCard2.card.rank : 0;
    const parity1 = rank1 % 2; // 1=odd, 0=even
    const parity2 = rank2 % 2;

    if (parity1 !== parity2) {
      // Different parity: odd goes left, even goes right
      leftCard = parity1 === 1 ? oppCard1 : oppCard2;
      rightCard = parity1 === 1 ? oppCard2 : oppCard1;
    } else if (parity1 === 0) {
      // Both even: lowest even goes right
      leftCard = rank1 <= rank2 ? oppCard2 : oppCard1;
      rightCard = rank1 <= rank2 ? oppCard1 : oppCard2;
    } else {
      // Both odd: lowest odd goes left
      leftCard = rank1 <= rank2 ? oppCard1 : oppCard2;
      rightCard = rank1 <= rank2 ? oppCard2 : oppCard1;
    }

    // REQ-F-PASS05: Track what was passed to left for Mah Jong wish
    this.passedToLeft = leftCard;

    const result = {} as Record<Seat, GameCard>;
    result[leftOpp] = leftCard;
    result[rightOpp] = rightCard;
    result[partner] = partnerCard;
    result[seat] = sorted[0]; // Placeholder (not actually passed)
    return result;
  }

  /** Get the card passed to the left opponent (for Mah Jong wish context) */
  getPassedToLeft(): GameCard | null {
    return this.passedToLeft;
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
    this.mySeat = seat;
    this.mahjongPlayedInStraight = false; // Reset each play decision

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

    // REQ-F-END01-04: Endgame-specific strategy (checked before 1-2 prevention
    // because endgame handles those scenarios with more nuance)
    const endgamePhase = getEndgamePhase(roundState, seat);
    if (endgamePhase !== 'normal') {
      const endgameDecision = this.chooseEndgamePlay(context, nonBombs.length > 0 ? nonBombs : validPlays, endgamePhase);
      if (endgameDecision) return endgameDecision;
    }

    // 1-2 prevention mode (for 4-player situations where endgame hasn't triggered)
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

  // REQ-F-TRK02: Enhanced Dragon gift using point tracking
  chooseDragonGiftRecipient(opponents: Seat[], _trickPoints: number): Seat {
    if (!this.lastRoundState || opponents.length <= 1) {
      return selectDragonRecipient(opponents, this.lastRoundState);
    }

    // Give Dragon to opponent on the lower-scoring team (maximize damage)
    // Both opponents are on the same team in Tichu, so compare card counts as tiebreaker
    const team0 = getTeam(opponents[0]);
    const points0 = this.cardTracker.getApproxTeamPoints(this.lastRoundState, team0);

    // If we can differentiate by individual pile points, give to the one with fewer points
    // (they benefit more from the Dragon's 25 points going to the wrong pile)
    // Both opponents are same team, so use card count as before
    const cards0 = this.lastRoundState.players[opponents[0]].hand.length;
    const cards1 = this.lastRoundState.players[opponents[1]].hand.length;

    // Prefer opponent with more cards (more likely to go out last = more painful)
    if (cards0 !== cards1) {
      return cards0 > cards1 ? opponents[0] : opponents[1];
    }

    // Tiebreaker: if team points are tracked and low, the Dragon hurts more
    return selectDragonRecipient(opponents, this.lastRoundState);
  }

  // ─── Mahjong Wish ─────────────────────────────────────────────────────────

  // REQ-F-MJ01: Context-adaptive Mah Jong wish
  /**
   * Mah Jong wish selection with 4-priority context:
   * 1. Mah Jong played in a straight → no wish
   * 2. Opponent called Tichu/Grand Tichu → wish for Ace (force out power card)
   * 3. Default → wish for card passed to left opponent (parity convention)
   * 4. Fallback → wish for rank not in hand, preferring 5 or 6
   */
  chooseMahjongWish(hand: GameCard[]): Rank | null {
    // Priority 1: Mah Jong in a straight → no wish
    if (this.mahjongPlayedInStraight) return null;

    const haveRanks = new Set<number>();
    for (const gc of hand) {
      if (gc.card.kind === 'standard') haveRanks.add(gc.card.rank);
    }

    // Priority 2: Opponent called Tichu or Grand Tichu → wish for Ace
    if (this.lastRoundState) {
      const opponentCallers = getOpponentTichuCallers(this.lastRoundState, this.mySeat);
      if (opponentCallers.length > 0 && !haveRanks.has(14)) {
        return 14 as Rank;
      }
    }

    // Priority 3: Wish for card passed to left opponent (parity convention)
    if (this.passedToLeft && this.passedToLeft.card.kind === 'standard') {
      const passedRank = this.passedToLeft.card.rank;
      if (!haveRanks.has(passedRank)) return passedRank as Rank;
    }

    // Priority 4: Fallback — wish for rank not in hand, preferring 5 or 6
    const fallbackCandidates: Rank[] = [5, 6, 7, 8, 9, 10] as Rank[];
    for (const rank of fallbackCandidates) {
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

  // REQ-F-BOMB01: Enhanced offensive bomb timing
  /**
   * Decide whether to bomb now. Enhanced from base strategy:
   * - Bomb when opponent is about to complete a 1-2 finish
   * - Bomb when opponent Tichu caller has 1-5 cards
   * - Bomb when opponent about to go out (1-2 cards)
   * - DON'T bomb if own partner is about to go out (waste of bomb)
   */
  private shouldBombNow(roundState: RoundState, seat: Seat, bombs: Combination[]): boolean {
    if (bombs.length === 0) return false;
    const myTeam = getTeam(seat);
    const partner = getPartner(seat);

    // REQ-F-BOMB01: Don't bomb if partner is about to go out (1-2 cards)
    if (
      roundState.players[partner].finishOrder === null &&
      roundState.players[partner].hand.length <= 2
    ) {
      return false;
    }

    // REQ-F-BOMB01: Bomb to prevent 1-2 finish (one opponent already out, other near exit)
    const finishOrder = roundState.finishOrder;
    if (finishOrder.length >= 1) {
      const firstOut = finishOrder[0];
      if (getTeam(firstOut) !== myTeam) {
        // First out is opponent — check if the other opponent is near exit
        const otherOpp = SEATS_IN_ORDER.find(
          (s) => getTeam(s) !== myTeam && s !== firstOut && roundState.players[s].finishOrder === null,
        );
        if (otherOpp && roundState.players[otherOpp].hand.length <= 3) {
          return true; // Bomb to prevent 1-2 finish
        }
      }
    }

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

  // ─── Phoenix Strategy ────────────────────────────────────────────────────

  // REQ-F-PHX01: Hand-dependent Phoenix evaluation per turn
  /**
   * Evaluate whether a Phoenix play should be preferred, avoided, or is neutral.
   * Returns 'prefer' if this is a good Phoenix use, 'avoid' if Phoenix should be saved,
   * or 'neutral' for no strong opinion.
   *
   * Decision tree:
   * 1. Following on opponent's Ace → prefer (singleton-killer)
   * 2. Phoenix completes a combination eliminating 3+ cards → prefer (wild)
   * 3. Leading with Phoenix as singleton → avoid (+0.5 is weak)
   * 4. Unaccounted opponent Aces exist → avoid singleton use (save to beat Ace)
   * 5. Otherwise → neutral
   */
  private evaluatePhoenixPlay(
    combo: Combination,
    currentTrick: import('@tichu/shared').TrickState | null,
    hand: GameCard[],
  ): 'prefer' | 'avoid' | 'neutral' {
    const hasPhoenix = combo.cards.some((gc) => isPhoenix(gc.card));
    if (!hasPhoenix) return 'neutral';

    // 1. Following on opponent's Ace with Phoenix singleton → prefer (singleton-killer)
    if (currentTrick && combo.cards.length === 1) {
      const lastPlay = currentTrick.plays[currentTrick.plays.length - 1];
      if (lastPlay && lastPlay.combination.cards.length === 1) {
        const lastCard = lastPlay.combination.cards[0];
        if (lastCard.card.kind === 'standard' && lastCard.card.rank === 14) {
          return 'prefer'; // Beat the Ace with Phoenix
        }
      }
    }

    // 2. Phoenix in combination of 3+ cards → prefer (eliminates losers)
    if (combo.cards.length >= 3) return 'prefer';

    // 3. Leading with Phoenix as singleton → avoid
    if (!currentTrick && combo.cards.length === 1) return 'avoid';

    // 4. Unaccounted Aces exist → avoid singleton use (save for Ace-beating)
    if (combo.cards.length === 1 && this.cardTracker.getUnaccountedAces() > 0) {
      return 'avoid';
    }

    return 'neutral';
  }

  // ─── Dog Strategy ────────────────────────────────────────────────────────

  // REQ-F-DOG01: Context-dependent Dog play
  /**
   * Determine whether to save the Dog rather than playing it now.
   *
   * Save conditions (any true → save):
   * 1. Partner called Tichu/Grand Tichu → save to bail partner out later
   * 2. Bot has a bomb or Dragon → guaranteed lead recovery, Dog more valuable later
   * 3. Opponent called Tichu/Grand Tichu → save for strategic use
   * 4. Significantly behind on score → save for critical moment
   *
   * Default: play Dog at first opportunity (Fuegi: risk of never getting another lead)
   */
  private shouldSaveDog(roundState: RoundState, seat: Seat, hand: GameCard[]): boolean {
    const partner = getPartner(seat);
    const myTeam = getTeam(seat);

    // 1. Partner called Tichu → save Dog to bail them out
    const partnerCall = roundState.players[partner].tipiCall;
    if (partnerCall === 'tichu' || partnerCall === 'grandTichu') return true;

    // 2. Bot has bomb or Dragon → can regain lead later, Dog is more valuable saved
    const hasBomb = hand.some((gc) => {
      // Quick check: 4 of same rank
      if (gc.card.kind !== 'standard') return false;
      const rank = gc.card.rank;
      return hand.filter((h) => h.card.kind === 'standard' && h.card.rank === rank).length >= 4;
    });
    const hasDragon = hand.some((gc) => isDragon(gc.card));
    if (hasBomb || hasDragon) return true;

    // 3. Opponent called Tichu → save for strategic use
    for (const s of SEATS_IN_ORDER) {
      if (getTeam(s) === myTeam) continue;
      const call = roundState.players[s].tipiCall;
      if (call === 'tichu' || call === 'grandTichu') return true;
    }

    // 4. Significantly behind → save for critical moment
    if (this.scoreDiff !== null && this.scoreDiff <= -200) return true;

    // Default: play Dog early (Fuegi: risk of never getting another lead)
    return false;
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
   * - REQ-F-BOMB02: Bomb-proof exit planning for last 2-3 cards
   */
  private chooseLeadPlay(
    validPlays: Combination[],
    hand: GameCard[],
    roundState: RoundState,
    seat: Seat,
  ): BotPlayDecision {
    const ranked = rankCombinationsForLead(validPlays);

    // REQ-F-BOMB02: Bomb-proof exit planning when 2-3 cards remain
    const bombProofPlay = this.getBombProofExitPlay(ranked, hand);
    if (bombProofPlay) return this.toDecision(bombProofPlay);

    // REQ-F-DOG01: Context-dependent Dog play (checked BEFORE hand plan)
    const dogPlay = ranked.find((c) => c.cards.length === 1 && isDog(c.cards[0].card));
    if (dogPlay && !this.shouldSaveDog(roundState, seat, hand)) {
      return this.toDecision(dogPlay);
    }

    // REQ-F-FOL01: King safety — lead Kings when all Aces are accounted for
    if (this.cardTracker.getUnaccountedAces() === 0) {
      const kingLead = ranked.find(
        (c) => c.type === CombinationType.Single &&
          c.cards[0].card.kind === 'standard' && c.cards[0].card.rank === 13,
      );
      if (kingLead) return this.toDecision(kingLead);
    }

    // Use hand plan when available (excluding Dog and Phoenix singletons)
    if (this.handPlan?.valid && this.handPlan.losersToLead.length > 0) {
      for (const planned of this.handPlan.losersToLead) {
        // Skip Dog in hand plan — already handled above
        if (planned.cards.length === 1 && isDog(planned.cards[0].card)) continue;
        // REQ-F-PHX01: Skip Phoenix singleton leads (only +0.5, weak)
        if (planned.cards.length === 1 && isPhoenix(planned.cards[0].card)) continue;
        const match = validPlays.find((vp) =>
          vp.cards.length === planned.cards.length &&
          vp.cards.every((c) => planned.cards.some((p) => p.id === c.id)),
        );
        if (match) return this.toDecision(match);
      }
    }

    // Can go out? Always do it.
    for (const combo of ranked) {
      if (canGoOut(hand, combo)) return this.toDecision(combo);
    }

    // Lead with lowest non-winner (save winners)
    // REQ-F-PHX01: Also skip Phoenix singleton leads (only +0.5, weak lead)
    // REQ-F-FOL03: Skip Ace pairs — each Ace should win a separate lead
    for (const combo of ranked) {
      if (combo.cards.length === 1 && isDragon(combo.cards[0].card)) continue;
      if (combo.type === CombinationType.Single &&
        combo.cards[0].card.kind === 'standard' && combo.cards[0].card.rank === 14) continue;
      if (combo.cards.length === 1 && isPhoenix(combo.cards[0].card)) continue;
      // REQ-F-FOL03: Never lead Ace pairs — split them for individual wins
      if (combo.type === CombinationType.Pair && combo.rank === 14) continue;
      return this.toDecision(combo);
    }

    return this.toDecision(ranked[0]);
  }

  // ─── Bomb-Proof Exit Planning ──────────────────────────────────────────────

  // REQ-F-BOMB02: Plan exits to survive opponent bombs
  /**
   * When holding 2 cards (Dragon + low single), avoid leading Dragon as
   * second-to-last card if bomb risk exists. Instead, lead the low card.
   *
   * Logic:
   * - Only applies when exactly 2 cards remain
   * - If one card is Dragon and the other is a low single:
   *   - Check card tracker for bomb probability (any rank with 3+ unaccounted)
   *   - If bomb risk: lead the low single instead of Dragon
   *   - If bombed on low single, still have Dragon to recover the lead
   * - Also applies: never lead Dragon as second-to-last if bomb risk exists
   */
  private getBombProofExitPlay(
    ranked: Combination[],
    hand: GameCard[],
  ): Combination | null {
    if (hand.length !== 2) return null;

    const hasDragon = hand.some((gc) => isDragon(gc.card));
    if (!hasDragon) return null;

    // Check if there's bomb risk (any rank with 3+ unaccounted cards)
    const absentRanks = this.cardTracker.getAbsentRanks();
    if (absentRanks.length === 0) return null;

    // Bomb risk exists — lead the non-Dragon card instead
    const nonDragonPlay = ranked.find(
      (c) => c.cards.length === 1 && !isDragon(c.cards[0].card),
    );
    return nonDragonPlay ?? null;
  }

  // ─── Tichu Defense ─────────────────────────────────────────────────────────

  // REQ-F-DEF01: Risk-based Tichu defense
  /**
   * Evaluate whether to fight or concede opponent's Tichu call.
   *
   * Fight when:
   * - Caller has 5+ cards remaining (still early, they might fail)
   * - Bot has 3+ winners (strong enough to contest)
   * - Multiple unaccounted power cards exist (uncertainty favors fighting)
   *
   * Concede when:
   * - Caller has 1-2 cards (almost certainly going out)
   * - Bot has 0-1 winners (can't realistically stop them)
   * - Few unaccounted power cards (caller likely has remaining power)
   */
  private evaluateTichuDefense(roundState: RoundState, seat: Seat): 'fight' | 'concede' {
    const myTeam = getTeam(seat);
    const partner = getPartner(seat);
    let fightScore = 0;

    // Factor 1: Caller's remaining card count
    for (const s of SEATS_IN_ORDER) {
      if (getTeam(s) === myTeam) continue;
      if (roundState.players[s].finishOrder !== null) continue;
      const call = roundState.players[s].tipiCall;
      if (call === 'tichu' || call === 'grandTichu') {
        const callerCards = roundState.players[s].hand.length;
        if (callerCards <= 2) fightScore -= 3; // Almost out, concede
        else if (callerCards <= 4) fightScore -= 1;
        else fightScore += 1; // Still early, worth fighting
      }
    }

    // Factor 2: Own hand winner count (Aces, Dragon, bombs)
    const myHand = roundState.players[seat].hand;
    let winners = 0;
    for (const gc of myHand) {
      if (isDragon(gc.card)) winners++;
      else if (gc.card.kind === 'standard' && gc.card.rank === 14) winners++;
    }
    // Check for bombs
    const bombs = myHand.filter((gc) => {
      if (gc.card.kind !== 'standard') return false;
      const rank = gc.card.rank;
      return myHand.filter((h) => h.card.kind === 'standard' && h.card.rank === rank).length >= 4;
    });
    if (bombs.length > 0) winners++;

    if (winners >= 3) fightScore += 2;
    else if (winners >= 2) fightScore += 1;
    else if (winners === 0) fightScore -= 2;

    // Factor 3: Unaccounted power cards (uncertainty)
    const unaccountedPower = this.cardTracker.getUnaccountedTop10Count();
    if (unaccountedPower >= 4) fightScore += 1; // Lots of uncertainty
    else if (unaccountedPower <= 1) fightScore -= 1; // Caller likely has the power

    // Factor 4: Partner's behavior (if partner is playing aggressively, fight together)
    const partnerCall = roundState.players[partner].tipiCall;
    if (partnerCall === 'tichu' || partnerCall === 'grandTichu') {
      fightScore += 2; // Partner called Tichu — definitely fight
    }

    return fightScore >= 0 ? 'fight' : 'concede';
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

    // REQ-F-DEF01: Evaluate Tichu defense stance
    const defenseStance = opponentCallers.length > 0
      ? this.evaluateTichuDefense(roundState, seat)
      : null;

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

    // REQ-F-DEF01: When conceding opponent's Tichu, pass more freely
    if (defenseStance === 'concede' && canPass) {
      return { action: 'pass' };
    }

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
        // REQ-F-FOL02: Smart pass — don't spend King on low trick when Aces unaccounted
        if (cheapestWin.rank === 13 && this.cardTracker.getUnaccountedAces() > 0) {
          return { action: 'pass' };
        }
      }
    }

    // REQ-F-PHX01: Win with minimum force, but evaluate Phoenix plays
    if (ranked.length > 0) {
      const cheapest = ranked[0];
      const phoenixEval = this.evaluatePhoenixPlay(cheapest, currentTrick, hand);

      // If cheapest win uses Phoenix and we should avoid it, try next non-Phoenix play
      if (phoenixEval === 'avoid' && ranked.length > 1) {
        const nonPhoenixPlay = ranked.find(
          (c) => !c.cards.some((gc) => isPhoenix(gc.card)),
        );
        if (nonPhoenixPlay) return this.toDecision(nonPhoenixPlay);
        // If all plays use Phoenix, pass if we can
        if (canPass) return { action: 'pass' };
      }

      // If Phoenix play is preferred (e.g., beating Ace), prioritize it
      if (phoenixEval === 'prefer') return this.toDecision(cheapest);

      return this.toDecision(cheapest);
    }

    if (canPass) return { action: 'pass' };
    return this.toDecision(plays[0]);
  }

  // ─── Endgame Strategy ─────────────────────────────────────────────────────

  // REQ-F-END01-04: Endgame-specific play selection
  /**
   * Handle endgame situations based on player count and partner status.
   * Returns null to fall through to normal play logic if no special handling needed.
   */
  private chooseEndgamePlay(
    context: BotPlayContext,
    plays: Combination[],
    phase: '3p-partner-out' | '3p-partner-in' | '2p',
  ): BotPlayDecision | null {
    const { hand, currentTrick, seat, roundState, canPass } = context;

    // Can go out? Always do it.
    for (const combo of plays) {
      if (canGoOut(hand, combo)) return this.toDecision(combo);
    }

    switch (phase) {
      case '3p-partner-out':
        return this.choose3PlayerPartnerOutPlay(plays, hand, currentTrick, seat, canPass);
      case '3p-partner-in':
        return this.choose3PlayerPartnerInPlay(plays, hand, currentTrick, seat, roundState, canPass);
      case '2p':
        return this.choose2PlayerPlay(plays, hand, currentTrick, seat, roundState, canPass);
    }
  }

  // REQ-F-END01: 3-player endgame, partner already out
  /**
   * Partner went out → play aggressively to go out 2nd and prevent opponent 1-2.
   * Lead winners, break up combinations if needed. Win every trick possible.
   */
  private choose3PlayerPartnerOutPlay(
    plays: Combination[],
    hand: GameCard[],
    currentTrick: import('@tichu/shared').TrickState | null,
    seat: Seat,
    canPass: boolean,
  ): BotPlayDecision | null {
    if (!currentTrick) {
      // Leading: play highest combo to control (aggressive)
      const ranked = rankCombinationsForLead(plays);
      // Lead with strongest play to get out fast
      return this.toDecision(ranked[ranked.length - 1] ?? ranked[0]);
    }

    // Following: always play if possible (don't pass, be aggressive)
    if (isPartnerWinning(currentTrick, seat) && canPass) {
      // Partner already out, so partner can't be winning — but just in case, pass
      return { action: 'pass' };
    }

    // Win with strongest play available
    const ranked = rankCombinationsForFollow(plays);
    if (ranked.length > 0) return this.toDecision(ranked[ranked.length - 1]);

    if (canPass) return { action: 'pass' };
    return null;
  }

  // REQ-F-END02: 3-player endgame, partner still in
  /**
   * Partner still playing: compare card counts.
   * Partner has fewer cards → feed leads to partner.
   * Bot has fewer → go out aggressively.
   * Equal → whoever has more winners goes aggressive.
   */
  private choose3PlayerPartnerInPlay(
    plays: Combination[],
    hand: GameCard[],
    currentTrick: import('@tichu/shared').TrickState | null,
    seat: Seat,
    roundState: RoundState,
    canPass: boolean,
  ): BotPlayDecision | null {
    const partner = getPartner(seat);
    const handSizes = getHandSizes(roundState);
    const myCards = handSizes[seat];
    const partnerCards = handSizes[partner];

    if (!currentTrick) {
      if (partnerCards < myCards && partnerCards > 0) {
        // Partner has fewer cards — play Dog if available to feed lead
        const dogPlay = plays.find((c) => c.cards.length === 1 && isDog(c.cards[0].card));
        if (dogPlay) return this.toDecision(dogPlay);
      }
      // Otherwise, lead low (normal strategy — fall through)
      return null;
    }

    // Following: if partner is winning, pass to let them go out
    if (isPartnerWinning(currentTrick, seat) && canPass) {
      return { action: 'pass' };
    }

    // If bot has fewer cards, play aggressively
    if (myCards <= partnerCards) {
      const ranked = rankCombinationsForFollow(plays);
      if (ranked.length > 0) return this.toDecision(ranked[0]); // Win efficiently
    }

    // Fall through to normal follow play
    return null;
  }

  // REQ-F-END03, REQ-F-END04: 2-player endgame
  /**
   * 2 players left:
   * - Opponent has 1 card → play multi-card groups first, then singles high→low
   * - Opponent has many cards → normal lead-low-win-high
   */
  private choose2PlayerPlay(
    plays: Combination[],
    hand: GameCard[],
    currentTrick: import('@tichu/shared').TrickState | null,
    seat: Seat,
    roundState: RoundState,
    canPass: boolean,
  ): BotPlayDecision | null {
    const myTeam = getTeam(seat);

    // Find the remaining opponent
    const opponent = SEATS_IN_ORDER.find(
      (s) => getTeam(s) !== myTeam && roundState.players[s].finishOrder === null,
    );
    if (!opponent) return null;

    const opponentCards = roundState.players[opponent].hand.length;

    if (!currentTrick) {
      // REQ-F-END03: Opponent has 1 card → multi-card groups first, then singles high→low
      if (opponentCards === 1) {
        // Prefer multi-card plays (opponent can only play singles, so multi-card combos are safe)
        const multiCard = plays.filter((c) => c.cards.length > 1 && !c.cards.some((gc) => isDog(gc.card)));
        if (multiCard.length > 0) {
          // Play largest multi-card group to shed cards fastest
          const sorted = [...multiCard].sort((a, b) => b.cards.length - a.cards.length);
          return this.toDecision(sorted[0]);
        }
        // Only singles left: play highest first
        const singles = rankCombinationsForLead(plays);
        if (singles.length > 0) {
          return this.toDecision(singles[singles.length - 1]);
        }
      }

      // REQ-F-END04: Opponent has many cards → normal lead-low strategy
      const lowFirst = rankCombinationsForLead(plays);
      for (const combo of lowFirst) {
        if (combo.cards.length === 1 && isDragon(combo.cards[0].card)) continue;
        if (combo.type === CombinationType.Single &&
          combo.cards[0].card.kind === 'standard' && combo.cards[0].card.rank === 14) continue;
        return this.toDecision(combo);
      }
      return this.toDecision(lowFirst[0]);
    }

    // Following in 2-player: win if possible
    if (canPass && plays.length === 0) return { action: 'pass' };
    // Normal follow play (fall through)
    return null;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private toDecision(combo: Combination): BotPlayDecision {
    // REQ-F-MJ01: Track if Mah Jong is played in a straight (no wish)
    if (combo.cards.some((gc) => isMahjong(gc.card)) && combo.cards.length > 1) {
      this.mahjongPlayedInStraight = true;
    }

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
