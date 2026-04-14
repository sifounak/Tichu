// Expert bot strategy based on community Tichu strategy guide principles.
// Key sources: BGA Tips_tichu — Passing Cards, Leading, Following, Bombing,
// Tichu Calling, Grand Tichu, special card usage, defensive play, point tracking.

import type { GameCard, Seat, Rank, Combination, RoundState, Team } from '@tichu/shared';
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
  evaluateHandStrength,
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
  hasStrength,
  hasStrongMultiCardHand,
  getRightOpponent,
  findBombs,
  getThirdWorstNonBreaking,
  isCardInMultiCardCombo,
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
 * Bot — strategy-guide-informed bot implementing community best practices.
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
export class Bot implements BotStrategy {

  private cardTracker = new CardTracker();
  private handPlan: HandPlan | null = null;
  private planCreated = false;
  private lastRoundState: RoundState | null = null;
  private currentRound = -1;
  private scoreDiff: number | null = null;
  // REQ-F-PASS08: Track card passed to right opponent for Mahjong wish
  private passedToRight: GameCard | null = null;
  // REQ-F-MJ01: Track whether Mah Jong was played in a straight (no wish)
  private mahjongPlayedInStraight = false;
  // Track bot's seat for context in methods that don't receive it
  private mySeat: Seat = 'north';

  // REQ-F-CTX01: Game context from bot-runner
  private gameScores: Record<Team, number> | null = null;
  private targetScore = 1000;

  // REQ-F-STR02: Partner strength signal detection
  private partnerPassedCard: GameCard | null = null;
  private partnerStrengthDetected = false;
  private partnerStrengthChecked = false;

  // REQ-F-USD01: Track per-opponent uncontested single trick wins
  private uncontestedSingleCounts: Record<Seat, number> = { north: 0, east: 0, south: 0, west: 0 };
  private uncontestedSingleLastRank: Record<Seat, number> = { north: 0, east: 0, south: 0, west: 0 };
  private lastTricksWonCounts: Record<Seat, number> = { north: 0, east: 0, south: 0, west: 0 };
  private lastSeenTrickType: CombinationType | null = null;

  // REQ-F-PTS01-03: Partner Tichu support — lead escalation
  private ptsConsecutiveLeads = 0;
  // Track who led the last trick (for detecting if partner took over)
  private lastLeadSeat: Seat | null = null;

  // ─── Grand Tichu ──────────────────────────────────────────────────────────

  // REQ-F-GT01, REQ-F-GT02, REQ-F-GT03: Grand Tichu with concrete criteria
  /**
   * Grand Tichu evaluation using power card count + hand quality.
   *
   * Call Grand Tichu when:
   * 1. 3+ power cards AND a bomb in hand
   * 2. 3+ power cards AND a strong (rank > 10) multi-card hand
   * 3. 2+ power cards AND a strong multi-card hand AND opponents near winning
   */
  chooseGrandTichu(hand8: GameCard[]): boolean {
    // Count power cards: Ace, Dragon, Phoenix
    let powerCards = 0;
    for (const gc of hand8) {
      if (isDragon(gc.card) || isPhoenix(gc.card)) powerCards++;
      else if (gc.card.kind === 'standard' && gc.card.rank === 14) powerCards++;
    }

    const hasBomb = findBombs(hand8).length > 0;
    const hasStrongMulti = hasStrongMultiCardHand(hand8);

    // REQ-F-GT01: 3+ power cards AND bomb
    if (powerCards >= 3 && hasBomb) return true;

    // REQ-F-GT02: 3+ power cards AND strong multi-card hand
    if (powerCards >= 3 && hasStrongMulti) return true;

    // REQ-F-GT03: 2+ power + strong multi + opponents near winning
    if (powerCards >= 2 && hasStrongMulti) {
      const opponentsNearWinning = this.areOpponentsNearWinning();
      if (opponentsNearWinning) return true;
    }

    return false;
  }

  /** Check if opponents are within 1 game of winning (score >= targetScore - 100) */
  private areOpponentsNearWinning(): boolean {
    if (!this.gameScores) return false;
    const myTeam = getTeam(this.mySeat);
    const oppTeam = myTeam === 'northSouth' ? 'eastWest' : 'northSouth';
    return this.gameScores[oppTeam] >= this.targetScore - 100;
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

  // REQ-F-CTX01: Receive game context from bot-runner before each decision phase
  setContext(roundState: RoundState, scores: Record<Team, number>, targetScore: number): void {
    this.lastRoundState = roundState;
    this.gameScores = scores;
    this.targetScore = targetScore;
    // Compute score diff: positive = our team ahead
    const myTeam = getTeam(this.mySeat);
    const oppTeam = myTeam === 'northSouth' ? 'eastWest' : 'northSouth';
    this.scoreDiff = scores[myTeam] - scores[oppTeam];
  }

  // REQ-F-STR02: Detect partner strength from the card they passed to us
  private detectPartnerStrength(roundState: RoundState, seat: Seat): void {
    if (this.partnerStrengthChecked) return;
    this.partnerStrengthChecked = true;

    const partner = getPartner(seat);
    const passedCards = roundState.players[partner]?.passedCards;
    const passedCard = passedCards?.to?.[seat] ?? null;
    if (!passedCard) return;

    this.partnerPassedCard = passedCard;
    // Partner signaled strength if they passed a low card (rank < 10) or the Dog
    if (isDog(passedCard.card)) {
      this.partnerStrengthDetected = true;
    } else if (passedCard.card.kind === 'standard' && passedCard.card.rank < 10) {
      this.partnerStrengthDetected = true;
    } else {
      this.partnerStrengthDetected = false;
    }
  }

  // ─── Card Passing ─────────────────────────────────────────────────────────

  // REQ-F-PASS01-08: Card passing with strength concentration + parity convention
  /**
   * Card passing based on updated strategy:
   * - REQ-F-PASS01: Strength concentration using hasStrength (2+ power cards)
   * - REQ-F-PASS02: Strong hand passes 3rd-worst non-breaking card to partner
   * - REQ-F-PASS03: Parity convention — odd ranks to left, even ranks to right
   * - REQ-F-PASS04: Anti-bomb — split low pair if no 2 singles below 8
   * - REQ-F-PASS05: Never pass Dragon/Phoenix/Mahjong to opponents
   * - REQ-F-PASS06: Dog routing — opponent GT/T → Dog to opponent
   * - REQ-F-PASS07: Dog routing — strong hand → Dog to partner/right, weak → left
   * - REQ-F-PASS08: Track passedToRight for Mahjong wish
   */
  chooseCardsToPass(hand: GameCard[], seat: Seat): Record<Seat, GameCard> {
    this.mySeat = seat;
    const partner = getPartner(seat);
    const leftOpp = getNextSeat(seat); // clockwise = left-hand opponent
    const rightOpp = getRightOpponent(seat);
    const sorted = sortByStrength(hand);

    const hasDragon = hand.some((gc) => isDragon(gc.card));
    const hasPhoenixCard = hand.some((gc) => isPhoenix(gc.card));
    const hasDog = hand.some((gc) => isDog(gc.card));
    // REQ-F-PASS01: Use M1 strength definition (2+ power cards)
    const isStrongHand = hasStrength(hand);

    // ─ REQ-F-PASS06/07: Dog routing ─
    // Never give Dog to partner if they called Grand Tichu
    const partnerCalledGT = this.lastRoundState
      && this.lastRoundState.players[partner].tipiCall === 'grandTichu';
    let dogRecipient: Seat | null = null;
    if (hasDog) {
      // Check if any opponent called GT/T (available from lastRoundState set by setContext)
      const opponentWithCall = this.getOpponentWithTichuCall(seat);
      if (opponentWithCall) {
        // REQ-F-PASS06: Dog to opponent who called GT/T
        dogRecipient = opponentWithCall;
      } else if (isStrongHand) {
        // REQ-F-PASS07: Strong hand — Dog to partner if may need help regaining control,
        // otherwise Dog to right opponent
        const leadGetters = hand.filter((gc) =>
          isDragon(gc.card) ||
          (gc.card.kind === 'standard' && gc.card.rank === 14),
        ).length + findBombs(hand).length;
        if (leadGetters < 3 && !partnerCalledGT) {
          dogRecipient = partner; // May need help regaining control
        } else {
          dogRecipient = rightOpp; // Self-sufficient or partner called GT → Dog to right
        }
      } else {
        // Weak hand — Dog to left opponent
        dogRecipient = leftOpp;
      }
    }

    // ─ REQ-F-PASS01/02: Partner card selection (strength concentration) ─
    let partnerCard: GameCard | null = null;

    // Check if partner called Grand Tichu — always give strongest non-bomb-breaking card
    const partnerGT = this.lastRoundState
      && this.lastRoundState.players[partner].tipiCall === 'grandTichu';

    if (partnerGT) {
      // Partner called Grand Tichu: give strongest card that doesn't break a bomb
      // Priority: Phoenix > Dragon > Ace > King > Mah Jong > Q-2 (never Dog)
      const bombCardIds = new Set(findBombs(hand).flatMap(b => b.cards.map(c => c.id)));
      const candidates: GameCard[] = [];
      // Phoenix first (highest priority)
      const phoenix = hand.find(gc => isPhoenix(gc.card));
      if (phoenix && !bombCardIds.has(phoenix.id)) candidates.push(phoenix);
      // Dragon (can't be part of a bomb)
      const dragon = hand.find(gc => isDragon(gc.card));
      if (dragon) candidates.push(dragon);
      // Standard cards sorted by rank descending (Ace=14, King=13, then Q-2)
      const standardDesc = hand
        .filter(gc => gc.card.kind === 'standard')
        .sort((a, b) => (b.card as { rank: number }).rank - (a.card as { rank: number }).rank);
      // Add Ace and King first (priority above Mah Jong)
      for (const gc of standardDesc) {
        if ((gc.card as { rank: number }).rank >= 13 && !bombCardIds.has(gc.id)) candidates.push(gc);
      }
      // Mah Jong (priority between King and Queen)
      const mahjong = hand.find(gc => isMahjong(gc.card));
      if (mahjong && !bombCardIds.has(mahjong.id)) candidates.push(mahjong);
      // Remaining standard cards Q(12) down to 2
      for (const gc of standardDesc) {
        if ((gc.card as { rank: number }).rank < 13 && !bombCardIds.has(gc.id)) candidates.push(gc);
      }

      // Pick the first candidate (highest priority non-bomb-breaking card)
      partnerCard = candidates[0] ?? sorted[sorted.length - 1];
    } else if (!isStrongHand) {
      // Weak hand: pass best card to partner (Fuegi: concentrate strength)
      // Dragon > Phoenix > Ace > highest standard
      if (hasDragon) {
        partnerCard = hand.find((gc) => isDragon(gc.card))!;
      } else if (hasPhoenixCard) {
        partnerCard = hand.find((gc) => isPhoenix(gc.card))!;
      } else {
        // Pass highest card (last in sorted = strongest)
        partnerCard = sorted[sorted.length - 1];
      }
    } else {
      // REQ-F-PASS02: Strong hand: 3rd-worst card that doesn't break a combo
      if (dogRecipient === partner) {
        partnerCard = hand.find((gc) => isDog(gc.card))!;
      } else {
        const nonBreaking = getThirdWorstNonBreaking(hand.filter(
          (gc) => !isDragon(gc.card) && !isPhoenix(gc.card) && !isDog(gc.card) && !isMahjong(gc.card),
        ));
        if (nonBreaking) {
          partnerCard = nonBreaking;
        } else {
          // Fallback: 3rd-weakest non-special
          const nonSpecial = sorted.filter(
            (gc) => !isDragon(gc.card) && !isPhoenix(gc.card) && !isDog(gc.card) && !isMahjong(gc.card),
          );
          partnerCard = nonSpecial[2] ?? nonSpecial[nonSpecial.length - 1] ?? sorted[2];
        }
      }
    }

    // ─ REQ-F-PASS04: Anti-bomb — opponent card selection ─
    const usedIds = new Set([partnerCard.id]);
    if (dogRecipient && dogRecipient !== partner) {
      // Dog going to an opponent — mark it as used
      const dogCard = hand.find((gc) => isDog(gc.card))!;
      usedIds.add(dogCard.id);
    }

    // REQ-F-PASS05: Filter out Dragon, Phoenix, Mahjong, Dog for opponent candidates
    const opponentCandidates = sorted.filter(
      (gc) =>
        !usedIds.has(gc.id) &&
        !isDragon(gc.card) && !isPhoenix(gc.card) && !isDog(gc.card) && !isMahjong(gc.card),
    );

    // REQ-F-PASS04: Anti-bomb — if we don't have 2 single cards below 8,
    // split a low pair (rank 2-4) and give one to each opponent
    const singlesBelow8 = opponentCandidates.filter(
      (gc) => gc.card.kind === 'standard' && gc.card.rank < 8 && !isCardInMultiCardCombo(gc, hand),
    );

    let oppCard1: GameCard;
    let oppCard2: GameCard;

    if (singlesBelow8.length < 2) {
      // Try to split a low pair (rank 2-4)
      const lowPairCard = this.findLowPairToSplit(hand, usedIds);
      if (lowPairCard) {
        // Found a low pair — give one card from it to each opponent
        oppCard1 = lowPairCard[0];
        oppCard2 = lowPairCard[1];
      } else {
        // No low pair to split — fall back to 2 weakest
        oppCard1 = opponentCandidates[0] ?? sorted.find((gc) => !usedIds.has(gc.id))!;
        usedIds.add(oppCard1.id);
        oppCard2 = opponentCandidates.find((gc) => !usedIds.has(gc.id))
          ?? sorted.find((gc) => !usedIds.has(gc.id))!;
      }
    } else {
      // Have 2+ singles below 8 — use them
      oppCard1 = singlesBelow8[0];
      usedIds.add(oppCard1.id);
      oppCard2 = singlesBelow8[1] ?? opponentCandidates.find((gc) => !usedIds.has(gc.id))
        ?? sorted.find((gc) => !usedIds.has(gc.id))!;
    }

    // REQ-F-PASS03: Apply parity convention: odd → left, even → right
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

    // Override for Dog routing to specific opponent
    if (dogRecipient === leftOpp) {
      leftCard = hand.find((gc) => isDog(gc.card))!;
    } else if (dogRecipient === rightOpp) {
      rightCard = hand.find((gc) => isDog(gc.card))!;
    }

    // REQ-F-PASS08: Track what was passed to right for Mahjong wish
    this.passedToRight = rightCard;

    const result = {} as Record<Seat, GameCard>;
    result[leftOpp] = leftCard;
    result[rightOpp] = rightCard;
    result[partner] = partnerCard;
    result[seat] = sorted[0]; // Placeholder (not actually passed)
    return result;
  }

  /** Find an opponent who called Grand Tichu or Tichu (from cached round state) */
  private getOpponentWithTichuCall(seat: Seat): Seat | null {
    const rs = this.lastRoundState;
    if (!rs) return null;
    const myTeam = getTeam(seat);
    for (const s of SEATS_IN_ORDER) {
      if (getTeam(s) === myTeam) continue;
      const call = rs.players[s].tipiCall;
      if (call === 'tichu' || call === 'grandTichu') return s;
    }
    return null;
  }

  /** REQ-F-PASS04: Find a low pair (rank 2-4) to split between opponents */
  private findLowPairToSplit(hand: GameCard[], usedIds: Set<number>): [GameCard, GameCard] | null {
    const rankCounts = new Map<number, GameCard[]>();
    for (const gc of hand) {
      if (usedIds.has(gc.id)) continue;
      if (gc.card.kind !== 'standard') continue;
      const r = gc.card.rank;
      if (r > 4) continue; // Only ranks 2-4
      if (!rankCounts.has(r)) rankCounts.set(r, []);
      rankCounts.get(r)!.push(gc);
    }
    // Find first pair
    for (const [, cards] of rankCounts) {
      if (cards.length >= 2) return [cards[0], cards[1]];
    }
    return null;
  }

  /** Get the card passed to the right opponent (for Mahjong wish context) */
  getPassedToRight(): GameCard | null {
    return this.passedToRight;
  }

  /** Whether partner signaled strength via card pass */
  getPartnerStrengthDetected(): boolean {
    return this.partnerStrengthDetected;
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
      this.partnerStrengthChecked = false;
      this.partnerPassedCard = null;
      this.partnerStrengthDetected = false;
      // REQ-F-USD01: Reset uncontested singles tracking
      this.uncontestedSingleCounts = { north: 0, east: 0, south: 0, west: 0 };
      this.uncontestedSingleLastRank = { north: 0, east: 0, south: 0, west: 0 };
      this.lastTricksWonCounts = { north: 0, east: 0, south: 0, west: 0 };
      this.lastSeenTrickType = null;
      // REQ-F-PTS03: Reset partner Tichu lead escalation
      this.ptsConsecutiveLeads = 0;
      this.lastLeadSeat = null;
    }

    // REQ-F-STR02: Detect partner strength on first play of round
    this.detectPartnerStrength(roundState, seat);

    // Update card tracker
    this.cardTracker.update(roundState, seat, hand);

    // REQ-F-USD01: Track uncontested single wins
    this.updateUncontestedSingleTracking(roundState, seat);

    // REQ-F-PTS03: Track who led the current trick for escalation reset
    if (currentTrick && currentTrick.plays.length > 0) {
      this.lastLeadSeat = currentTrick.leadSeat;
    }

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

    // Both opponents are on the same team in Tichu, so compare card counts
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

  // REQ-F-MJ01-04: Context-adaptive Mahjong wish with partner strength awareness
  /**
   * Mahjong wish selection with 4-priority system:
   * 1. Mahjong in straight: no wish if Ace/partner strength; wish Ace if right opp GT/T + no strength
   * 2. Right opponent called Grand Tichu → wish for Ace
   * 3. Right opponent called Tichu AND no partner strength → wish for Ace
   * 4. Fallback → wish for card passed to right opponent
   */
  chooseMahjongWish(hand: GameCard[]): Rank | null {
    const haveRanks = new Set<number>();
    for (const gc of hand) {
      if (gc.card.kind === 'standard') haveRanks.add(gc.card.rank);
    }
    const hasAce = haveRanks.has(14);
    const rightOpp = getRightOpponent(this.mySeat);

    // Get right opponent's call status
    let rightOppCall: string = 'none';
    if (this.lastRoundState) {
      rightOppCall = this.lastRoundState.players[rightOpp].tipiCall;
    }
    const rightOppCalledTichuOrGT = rightOppCall === 'tichu' || rightOppCall === 'grandTichu';
    const rightOppCalledGT = rightOppCall === 'grandTichu';

    // REQ-F-MJ01: Mahjong played in a straight
    if (this.mahjongPlayedInStraight) {
      if (hasAce || this.partnerStrengthDetected) {
        // No wish — we have strength
        return null;
      }
      // Wish for Ace if right opponent called GT/T AND no partner strength AND no Ace
      if (rightOppCalledTichuOrGT && !this.partnerStrengthDetected && !hasAce) {
        return 14 as Rank;
      }
      return null;
    }

    // REQ-F-MJ02: Right opponent called Grand Tichu → wish for Ace
    if (rightOppCalledGT && !hasAce) {
      return 14 as Rank;
    }

    // REQ-F-MJ03: Right opponent called Tichu AND no partner strength → wish for Ace
    if (rightOppCall === 'tichu' && !this.partnerStrengthDetected && !hasAce) {
      return 14 as Rank;
    }

    // REQ-F-MJ04: Fallback — wish for card passed to right opponent
    if (this.passedToRight && this.passedToRight.card.kind === 'standard') {
      const passedRank = this.passedToRight.card.rank;
      if (!haveRanks.has(passedRank)) return passedRank as Rank;
    }

    // Final fallback — wish for rank not in hand, preferring 5 or 6
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
   * Never play when:
   * - REQ-F-PHX01: On single < Ace unless all Aces accounted for
   * - REQ-F-PHX02: In low multi-card (rank < 7) unless going out
   *
   * Acceptable when:
   * - REQ-F-PHX03: Over single Ace (prefer last unaccounted)
   * - REQ-F-PHX04: Over King if all Aces played
   * - REQ-F-PHX05: In straight (rank >= 10 or length >= 5)
   * - REQ-F-PHX06: In consecutive pairs
   * - REQ-F-PHX07: In triple (rank >= 8)
   * - REQ-F-PHX08: In pair (rank > 10)
   * - REQ-F-PHX09: As singleton lead if rest are Ace/King(if Aces played)/Dragon
   */
  private evaluatePhoenixPlay(
    combo: Combination,
    currentTrick: import('@tichu/shared').TrickState | null,
    hand: GameCard[],
  ): 'never' | 'acceptable' | 'neutral' {
    const hasPhoenix = combo.cards.some((gc) => isPhoenix(gc.card));
    if (!hasPhoenix) return 'neutral';

    const allAcesPlayed = this.cardTracker.allAcesPlayed();

    // ─── NEVER rules ───

    // REQ-F-PHX01: Phoenix as singleton — only allowed on Aces, Kings (if all Aces
    // accounted for), or as 2nd-to-last card when the remaining card is a sure winner.
    if (combo.cards.length === 1) {
      // 2nd-to-last card exception: Phoenix + guaranteed winner (Dragon, Ace, etc.)
      if (hand.length === 2) {
        const otherCard = hand.find((gc) => !isPhoenix(gc.card));
        if (otherCard && (isDragon(otherCard.card) ||
            (otherCard.card.kind === 'standard' && otherCard.card.rank === 14) ||
            (allAcesPlayed && otherCard.card.kind === 'standard' && otherCard.card.rank === 13))) {
          return 'acceptable';
        }
      }

      // REQ-F-PHX01: Block singleton Phoenix on anything except Aces,
      // or Kings when all Aces have been physically played
      if (currentTrick) {
        const lastPlay = currentTrick.plays[currentTrick.plays.length - 1];
        if (lastPlay && lastPlay.combination.cards.length === 1) {
          const lastCard = lastPlay.combination.cards[0];
          if (lastCard.card.kind === 'standard') {
            if (lastCard.card.rank === 14) {
              // Playing over an Ace — fall through to ACCEPTABLE section (REQ-F-PHX03)
            } else if (lastCard.card.rank === 13 && allAcesPlayed) {
              // Playing over a King with all Aces out — fall through to ACCEPTABLE (REQ-F-PHX04)
            } else {
              return 'never';
            }
          }
        }
      }
    }

    // REQ-F-PHX02: Phoenix in low multi-card hand (rank < 7), unless going out
    if (combo.cards.length > 1 && combo.rank < 7) {
      if (hand.length !== combo.cards.length) { // Not going out
        return 'never';
      }
    }

    // ─── ACCEPTABLE scenarios ───

    // REQ-F-PHX03: Over single Ace
    if (currentTrick && combo.cards.length === 1) {
      const lastPlay = currentTrick.plays[currentTrick.plays.length - 1];
      if (lastPlay && lastPlay.combination.cards.length === 1) {
        const lastCard = lastPlay.combination.cards[0];
        if (lastCard.card.kind === 'standard' && lastCard.card.rank === 14) {
          return 'acceptable';
        }
      }
    }

    // REQ-F-PHX04: Over King if all Aces already played
    if (currentTrick && combo.cards.length === 1 && allAcesPlayed) {
      const lastPlay = currentTrick.plays[currentTrick.plays.length - 1];
      if (lastPlay && lastPlay.combination.cards.length === 1) {
        const lastCard = lastPlay.combination.cards[0];
        if (lastCard.card.kind === 'standard' && lastCard.card.rank === 13) {
          return 'acceptable';
        }
      }
    }

    // REQ-F-PHX05: In straight with high rank (>= 10) or length >= 5
    if (combo.type === CombinationType.Straight) {
      if (combo.rank >= 10 || combo.cards.length >= 5) return 'acceptable';
    }

    // REQ-F-PHX06: In consecutive pairs (PairSequence)
    if (combo.type === CombinationType.PairSequence) return 'acceptable';

    // REQ-F-PHX07: In triple with rank >= 8
    if (combo.type === CombinationType.Triple && combo.rank >= 8) return 'acceptable';

    // REQ-F-PHX08: In pair with rank > 10
    if (combo.type === CombinationType.Pair && combo.rank > 10) return 'acceptable';

    // REQ-F-PHX09: As singleton lead if all remaining are Ace/King(if Aces played)/Dragon
    if (!currentTrick && combo.cards.length === 1) {
      const otherCards = hand.filter((gc) => !isPhoenix(gc.card));
      const allWinners = otherCards.every((gc) => {
        if (isDragon(gc.card)) return true;
        if (gc.card.kind === 'standard' && gc.card.rank === 14) return true;
        if (allAcesPlayed && gc.card.kind === 'standard' && gc.card.rank === 13) return true;
        return false;
      });
      if (otherCards.length > 0 && allWinners) return 'acceptable';
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

    // Can go out? Always do it (unless PTS05 suppresses).
    const suppress12GoOut = this.shouldSuppressGoOut(context.roundState, seat, hand);
    for (const combo of plays) {
      if (canGoOut(hand, combo) && !suppress12GoOut) return this.toDecision(combo);
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

  // ─── Partner Tichu Support — Leading ─────────────────────────────────────

  // REQ-F-PTS01-03: Helper to check if partner called GT/T
  private hasPartnerTichuCall(roundState: RoundState, seat: Seat): boolean {
    const partner = getPartner(seat);
    const call = roundState.players[partner].tipiCall;
    return call === 'tichu' || call === 'grandTichu';
  }

  // REQ-F-PTS01-03: Partner Tichu lead strategy with escalation
  /**
   * When partner called GT/T:
   * - PTS01: Play Dog to transfer control
   * - PTS02: If no Dog, lead lowest single
   * - PTS03: If bot keeps leading (partner didn't take over), escalate:
   *   1st re-lead → lowest pair, 2nd → lowest triple, 3rd → lowest straight
   */
  private choosePTSLeadPlay(
    validPlays: Combination[],
    _hand: GameCard[],
    _roundState: RoundState,
    _seat: Seat,
  ): BotPlayDecision | null {
    const ranked = rankCombinationsForLead(validPlays);

    // REQ-F-PTS01: Play Dog to give partner control
    const dogPlay = ranked.find((c) => c.cards.length === 1 && isDog(c.cards[0].card));
    if (dogPlay) {
      this.ptsConsecutiveLeads++;
      return this.toDecision(dogPlay);
    }

    // REQ-F-PTS03: Escalate combo type on consecutive leads
    if (this.ptsConsecutiveLeads >= 1) {
      // Escalation order: pair → triple → straight → any multi-card
      const escalationTypes = [
        CombinationType.Pair,
        CombinationType.Triple,
        CombinationType.Straight,
        CombinationType.PairSequence,
        CombinationType.FullHouse,
      ];

      // Start from the appropriate escalation level
      const startIdx = Math.min(this.ptsConsecutiveLeads - 1, escalationTypes.length - 1);

      for (let i = startIdx; i < escalationTypes.length; i++) {
        const targetType = escalationTypes[i];
        // Find lowest combo of target type (ranked is already low-to-high)
        const match = ranked.find(
          (c) => c.type === targetType && !c.isBomb &&
            !c.cards.some((gc) => isDragon(gc.card)),
        );
        if (match) {
          this.ptsConsecutiveLeads++;
          return this.toDecision(match);
        }
      }

      // No combo of escalated type — fall through to lowest single
    }

    // REQ-F-PTS02: No Dog → lead lowest single
    const lowestSingle = ranked.find(
      (c) => c.type === CombinationType.Single &&
        !isDragon(c.cards[0].card) &&
        !c.cards.some((gc) => isPhoenix(gc.card)),
    );
    if (lowestSingle) {
      this.ptsConsecutiveLeads++;
      return this.toDecision(lowestSingle);
    }

    // Fallback: lead lowest available (excluding Dragon)
    const fallback = ranked.find(
      (c) => !c.cards.some((gc) => isDragon(gc.card)),
    );
    if (fallback) {
      this.ptsConsecutiveLeads++;
      return this.toDecision(fallback);
    }

    return null;
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

    // REQ-F-PTS01-03: Partner Tichu lead support (BEFORE Dog/shouldSaveDog)
    // PTS overrides shouldSaveDog — when partner called GT/T, play Dog immediately
    if (this.hasPartnerTichuCall(roundState, seat)) {
      // Reset escalation if partner led last trick (partner took over briefly)
      if (this.lastLeadSeat !== null && this.lastLeadSeat !== seat) {
        this.ptsConsecutiveLeads = 0;
      }
      const ptsLead = this.choosePTSLeadPlay(validPlays, hand, roundState, seat);
      if (ptsLead) {
        this.lastLeadSeat = seat;
        return ptsLead;
      }
    }

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
        // REQ-F-PHX10: Skip Phoenix combos early in round
        if (hand.length >= 10 && planned.cards.some((gc) => isPhoenix(gc.card))) continue;
        const match = validPlays.find((vp) =>
          vp.cards.length === planned.cards.length &&
          vp.cards.every((c) => planned.cards.some((p) => p.id === c.id)),
        );
        if (match) return this.toDecision(match);
      }
    }

    // Can go out? Always do it (unless PTS05 suppresses).
    const suppressGoOutLead = this.shouldSuppressGoOut(roundState, seat, hand);
    for (const combo of ranked) {
      if (canGoOut(hand, combo) && !suppressGoOutLead) return this.toDecision(combo);
    }

    // REQ-F-DEF03: Determine if Aces should be played for control
    const opponentNearExit = SEATS_IN_ORDER.some((s) =>
      getTeam(s) !== getTeam(seat) &&
      roundState.players[s].finishOrder === null &&
      roundState.players[s].hand.length <= 3,
    );
    const needsDogPlay = hand.some((gc) => isDog(gc.card)) && !this.shouldSaveDog(roundState, seat, hand);

    // REQ-F-DEF04: Prefer multi-card combos over breaking pairs to play as singles
    // REQ-F-DEF05: Low-to-high rank order (already sorted by rankCombinationsForLead)
    // REQ-F-DEF01: Keep Aces as singletons, skip Ace pairs
    // REQ-F-DEF06: Prefer combos where we have a high follow-up of same type
    for (const combo of ranked) {
      // Skip Dragon singleton (save it)
      if (combo.cards.length === 1 && isDragon(combo.cards[0].card)) continue;
      // REQ-F-DEF02/DEF03: Skip Ace singletons unless needed for control or disruption
      if (combo.type === CombinationType.Single &&
        combo.cards[0].card.kind === 'standard' && combo.cards[0].card.rank === 14 &&
        !opponentNearExit && !needsDogPlay) continue;
      // Skip Phoenix singleton (weak lead)
      if (combo.cards.length === 1 && isPhoenix(combo.cards[0].card)) continue;
      // REQ-F-PHX10: Avoid leading combos with Phoenix early — keep opponents guessing
      if (hand.length >= 10 && combo.cards.some((gc) => isPhoenix(gc.card))) continue;
      // REQ-F-DEF01/FOL03: Avoid leading Ace pairs — split for individual wins
      if (combo.type === CombinationType.Pair && combo.rank === 14) {
        const remaining = hand.filter((gc) => !combo.cards.some((c) => c.id === gc.id));
        const allWinners = remaining.every((gc) =>
          isDragon(gc.card) || (gc.card.kind === 'standard' && gc.card.rank >= 14),
        );
        if (!allWinners) continue;
      }
      // REQ-F-DEF04: Skip singles that are part of a multi-card combo in hand
      if (combo.type === CombinationType.Single && combo.cards[0].card.kind === 'standard') {
        if (isCardInMultiCardCombo(combo.cards[0], hand)) {
          // Check if there's a multi-card combo of this rank available
          const multiCardOfSameRank = ranked.find(
            (c) => c.cards.length > 1 && !c.isBomb &&
              c.cards.some((gc) => gc.card.kind === 'standard' && gc.card.rank === combo.rank),
          );
          if (multiCardOfSameRank) continue; // Skip the single, prefer the multi-card
        }
      }
      // REQ-F-DEF06: For low multi-card combos, prefer those where we have a high follow-up
      if (combo.cards.length > 1 && combo.rank <= 8 && !combo.isBomb) {
        const hasHighFollowUp = ranked.some(
          (c) => c.type === combo.type && c.cards.length === combo.cards.length &&
            c.rank >= 12 && c !== combo,
        );
        if (!hasHighFollowUp) {
          // No high follow-up of same type — try to find a combo type with follow-up first
          const betterLead = ranked.find(
            (c) => c.cards.length > 1 && c.rank <= 8 && !c.isBomb && c !== combo &&
              ranked.some(
                (h) => h.type === c.type && h.cards.length === c.cards.length && h.rank >= 12 && h !== c,
              ),
          );
          if (betterLead) return this.toDecision(betterLead);
        }
      }
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

    // REQ-F-BOMB02: Exception — if a play would make us go out, skip bomb-proof avoidance
    for (const combo of ranked) {
      if (canGoOut(hand, combo)) return null; // Let normal go-out logic handle it
    }

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

  // ─── Uncontested Singles Defense ─────────────────────────────────────────

  // REQ-F-USD01: Track per-opponent uncontested single trick wins
  /**
   * Detect newly completed tricks by comparing tricksWon counts.
   * An uncontested single has exactly 1 card in the tricksWon entry.
   * Reset counters when trick type changes (non-single trick played).
   */
  private updateUncontestedSingleTracking(roundState: RoundState, seat: Seat): void {
    const myTeam = getTeam(seat);

    // Track current trick type for counter reset
    const currentTrickType = roundState.currentTrick?.plays[0]?.combination.type ?? null;
    if (currentTrickType !== null && currentTrickType !== CombinationType.Single) {
      if (this.lastSeenTrickType === null || this.lastSeenTrickType === CombinationType.Single) {
        // Trick type changed from single to non-single — reset counters
        for (const s of SEATS_IN_ORDER) {
          this.uncontestedSingleCounts[s] = 0;
          this.uncontestedSingleLastRank[s] = 0;
        }
      }
    }
    this.lastSeenTrickType = currentTrickType;

    // Detect newly completed tricks by comparing tricksWon counts
    for (const s of SEATS_IN_ORDER) {
      if (getTeam(s) === myTeam) continue; // Only track opponents
      const currentCount = roundState.players[s].tricksWon.length;
      const previousCount = this.lastTricksWonCounts[s];

      if (currentCount > previousCount) {
        // New trick(s) won — check each new entry
        for (let i = previousCount; i < currentCount; i++) {
          const trickCards = roundState.players[s].tricksWon[i];
          if (trickCards.length === 1) {
            // Exactly 1 card = uncontested single
            const wonCard = trickCards[0];
            const rank = wonCard.card.kind === 'standard' ? wonCard.card.rank : 0;
            this.uncontestedSingleCounts[s]++;
            this.uncontestedSingleLastRank[s] = rank;
          } else {
            // Contested or non-single trick — reset this opponent's counter
            this.uncontestedSingleCounts[s] = 0;
            this.uncontestedSingleLastRank[s] = 0;
          }
        }
      }

      this.lastTricksWonCounts[s] = currentCount;
    }
  }

  // REQ-F-USD02, USD03: Break weakest combo to contest uncontested singles
  /**
   * Check if any opponent meets the uncontested singles threshold.
   * If so, find the weakest multi-card hand whose freed card can beat
   * the current trick rank. Break priority: pairs > triples > longer.
   */
  private getUSDComboBreak(
    hand: GameCard[],
    validPlays: Combination[],
    roundState: RoundState,
    seat: Seat,
    currentTrickRank: number,
  ): Combination | null {
    const myTeam = getTeam(seat);
    const partner = getPartner(seat);
    const partnerCall = roundState.players[partner].tipiCall;
    const partnerHasCall = partnerCall === 'tichu' || partnerCall === 'grandTichu';

    // REQ-F-USD02: threshold 2, rank < 11 (Jack)
    // REQ-F-USD03: threshold 1, rank < 12 (Queen) when partner GT/T
    const threshold = partnerHasCall ? 1 : 2;
    const rankLimit = partnerHasCall ? 12 : 11;

    // Check if any opponent meets threshold
    let qualifyingOpponent = false;
    for (const s of SEATS_IN_ORDER) {
      if (getTeam(s) === myTeam) continue;
      if (
        this.uncontestedSingleCounts[s] >= threshold &&
        this.uncontestedSingleLastRank[s] < rankLimit
      ) {
        qualifyingOpponent = true;
        break;
      }
    }

    if (!qualifyingOpponent) return null;

    // Find singles in validPlays that come from breaking a multi-card combo
    // and can beat the current trick rank
    const breakableSingles: Array<{ combo: Combination; comboSize: number }> = [];

    for (const play of validPlays) {
      if (play.type !== CombinationType.Single) continue;
      if (play.cards[0].card.kind !== 'standard') continue;
      if (play.rank <= currentTrickRank) continue; // Must beat the trick

      // Check if this card is part of a multi-card combo in hand
      const gc = play.cards[0];
      if (!isCardInMultiCardCombo(gc, hand)) continue;

      // Determine the size of the combo being broken
      const rank = gc.card.kind === 'standard' ? gc.card.rank : 0;
      const sameRankCount = hand.filter(
        (h) => h.card.kind === 'standard' && h.card.rank === rank,
      ).length;

      breakableSingles.push({ combo: play, comboSize: sameRankCount });
    }

    if (breakableSingles.length === 0) return null;

    // Break priority: pairs (2) before triples (3) before larger (4+)
    // Among same size, prefer lowest rank
    breakableSingles.sort((a, b) => {
      if (a.comboSize !== b.comboSize) return a.comboSize - b.comboSize;
      return a.combo.rank - b.combo.rank;
    });

    return breakableSingles[0].combo;
  }

  // ─── Partner Tichu Support — Go-Out Suppression ─────────────────────────

  // REQ-F-PTS05, PTS06: Determine if go-out should be suppressed
  /**
   * Suppress going out first when partner called GT/T, unless:
   * - Partner is already out (no need to protect)
   * - PTS06 nullification exception applies
   */
  private shouldSuppressGoOut(roundState: RoundState, seat: Seat, hand: GameCard[]): boolean {
    if (!this.hasPartnerTichuCall(roundState, seat)) return false;

    const partner = getPartner(seat);
    // If partner is already out, no need to suppress
    if (roundState.players[partner].finishOrder !== null) return false;

    // REQ-F-PTS06: Nullification exception
    const myTeam = getTeam(seat);
    const partnerCall = roundState.players[partner].tipiCall;
    const partnerCards = roundState.players[partner].hand.length;

    // Check if any opponent also called Tichu
    let opponentCallerSeat: Seat | null = null;
    let opponentCards = 0;
    for (const s of SEATS_IN_ORDER) {
      if (getTeam(s) === myTeam) continue;
      if (roundState.players[s].finishOrder !== null) continue;
      const call = roundState.players[s].tipiCall;
      if (call === 'tichu' || call === 'grandTichu') {
        opponentCallerSeat = s;
        opponentCards = roundState.players[s].hand.length;
        break;
      }
    }

    if (
      opponentCallerSeat &&
      (partnerCall === 'tichu' || partnerCall === 'grandTichu') &&
      partnerCards >= 8 &&
      opponentCards <= 3
    ) {
      // Check if bot has very high chance of going out
      if (this.isVeryHighGoOutChance(hand, opponentCards)) {
        return false; // Allow go-out to nullify both Tichus
      }
    }

    return true; // Suppress go-out to protect partner's Tichu
  }

  // REQ-F-PTS06: Assess if bot has very high chance of going out first
  /**
   * (a) 3 or fewer cards AND all are winners (Ace, Dragon, bomb cards)
   * (b) Winners + multi-card combo rank >= 10 or length > opponent cards, with backup
   */
  private isVeryHighGoOutChance(hand: GameCard[], opponentCardCount: number): boolean {
    if (hand.length === 0) return false;

    // Count winners: Aces, Dragon
    let winnerCount = 0;
    for (const gc of hand) {
      if (isDragon(gc.card)) winnerCount++;
      else if (gc.card.kind === 'standard' && gc.card.rank === 14) winnerCount++;
    }

    // Check for bombs
    const hasBomb = findBombs(hand).length > 0;
    if (hasBomb) winnerCount++;

    // (a) 3 or fewer cards, all winners
    if (hand.length <= 3 && winnerCount >= hand.length) return true;

    // (b) Winners + strong multi-card combo + backup
    if (winnerCount >= 1) {
      // Check for multi-card combos with rank >= 10 or length > opponent cards
      const handRanks = new Map<number, number>();
      for (const gc of hand) {
        if (gc.card.kind === 'standard') {
          handRanks.set(gc.card.rank, (handRanks.get(gc.card.rank) ?? 0) + 1);
        }
      }

      for (const [rank, count] of handRanks) {
        if (count >= 2) {
          // Multi-card combo found
          if (rank >= 10 || count > opponentCardCount) {
            // Has strong multi-card + winners as backup
            return true;
          }
        }
      }
    }

    return false;
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
    const partnerHasCall = this.hasPartnerTichuCall(roundState, seat);
    const suppressGoOut = this.shouldSuppressGoOut(roundState, seat, hand);

    // REQ-F-DEF01: Evaluate Tichu defense stance
    const defenseStance = opponentCallers.length > 0
      ? this.evaluateTichuDefense(roundState, seat)
      : null;

    // Partner winning — handle overplay and pass logic
    if (partnerWinning && canPass) {
      // REQ-F-PTS05: Suppress go-out when partner called GT/T
      for (const combo of plays) {
        if (canGoOut(hand, combo) && !suppressGoOut) return this.toDecision(combo);
      }

      // REQ-F-PTS07: Low-trick overplay when partner has NOT called GT/T
      if (!partnerHasCall && currentTrick) {
        const partnerPlay = currentTrick.plays.find((p) => p.seat === currentTrick.currentWinner);
        if (partnerPlay) {
          const partnerRank = partnerPlay.combination.rank;
          if (partnerRank < 10) {
            const ranked = rankCombinationsForFollow(plays);
            if (ranked.length > 0) {
              const cheapest = ranked[0];
              if (cheapest.rank - partnerRank <= 4) {
                return this.toDecision(cheapest);
              }
            }
          }
        }
      }

      return { action: 'pass' };
    }

    // REQ-F-PTS04: Aggressive follow when partner GT/T and opponent winning
    if (partnerHasCall && !partnerWinning && currentTrick) {
      const ranked = rankCombinationsForFollow(plays);
      // REQ-F-PTS05: Check go-out suppression
      for (const combo of ranked) {
        if (canGoOut(hand, combo) && !suppressGoOut) return this.toDecision(combo);
      }
      // Play to win with minimum force (don't pass even on low tricks)
      // But be cautious: if winning would leave us with cards that could
      // all go out on the next play, and go-out is suppressed, pass instead
      // to avoid getting stuck (PTS05 would block the go-out lead)
      if (ranked.length > 0) {
        if (suppressGoOut && canPass) {
          const remainingCards = hand.filter(
            (gc) => !ranked[0].cards.some((c) => c.id === gc.id),
          );
          // Would go out next if: 1 card left, or all same rank (pair/triple)
          const wouldGoOutNext = remainingCards.length === 1 ||
            (remainingCards.length >= 2 && remainingCards.every((gc) =>
              gc.card.kind === 'standard' && remainingCards[0].card.kind === 'standard' &&
              gc.card.rank === (remainingCards[0].card as { rank: number }).rank,
            ));
          if (wouldGoOutNext) {
            return { action: 'pass' };
          }
        }
        return this.toDecision(ranked[0]);
      }
    }

    // Can go out? Always play (unless suppressed by PTS05).
    for (const combo of plays) {
      if (canGoOut(hand, combo) && !suppressGoOut) return this.toDecision(combo);
    }

    const ranked = rankCombinationsForFollow(plays);

    // REQ-F-DEF01: When conceding opponent's Tichu, pass more freely
    if (defenseStance === 'concede' && canPass) {
      return { action: 'pass' };
    }

    // REQ-F-USD02, USD03: Break combos to contest uncontested singles
    if (currentTrick && currentTrick.plays.length > 0) {
      const lastPlay = currentTrick.plays[currentTrick.plays.length - 1];
      if (lastPlay.combination.type === CombinationType.Single && !isPartnerWinning(currentTrick, seat)) {
        const usdBreak = this.getUSDComboBreak(hand, plays, roundState, seat, lastPlay.combination.rank);
        if (usdBreak) return this.toDecision(usdBreak);
      }
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
        // REQ-F-FOL01: King safety — treat Kings as top-tier when Aces unaccounted,
        // but play them confidently when all Aces are accounted for
        if (cheapestWin.rank === 13 && !this.cardTracker.allAcesAccountedFor()) {
          return { action: 'pass' };
        }
      }
    }

    // REQ-F-PHX01-09: Win with minimum force, evaluate Phoenix plays
    if (ranked.length > 0) {
      const cheapest = ranked[0];
      const phoenixEval = this.evaluatePhoenixPlay(cheapest, currentTrick, hand);

      // If cheapest win uses Phoenix and it's 'never', try next non-Phoenix play
      if (phoenixEval === 'never') {
        const nonPhoenixPlay = ranked.find(
          (c) => !c.cards.some((gc) => isPhoenix(gc.card)),
        );
        if (nonPhoenixPlay) return this.toDecision(nonPhoenixPlay);
        // If all plays use Phoenix, pass if we can
        if (canPass) return { action: 'pass' };
      }

      // REQ-F-PHX10: Avoid Phoenix early — keep opponents guessing by saving Phoenix
      // when there are non-Phoenix alternatives and we still have many cards.
      const cheapestUsesPhoenix = cheapest.cards.some((gc) => isPhoenix(gc.card));
      if (cheapestUsesPhoenix && hand.length >= 10 && phoenixEval !== 'acceptable') {
        const nonPhoenixPlay = ranked.find(
          (c) => !c.cards.some((gc) => isPhoenix(gc.card)),
        );
        if (nonPhoenixPlay) return this.toDecision(nonPhoenixPlay);
        // No alternative — pass rather than reveal Phoenix early (if possible)
        if (canPass) return { action: 'pass' };
      }

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
    _hand: GameCard[],
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
    _hand: GameCard[],
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
    _hand: GameCard[],
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

  getGameScores(): Record<Team, number> | null {
    return this.gameScores;
  }

  getTargetScore(): number {
    return this.targetScore;
  }

  getPartnerPassedCard(): GameCard | null {
    return this.partnerPassedCard;
  }

  getScoreDiff(): number | null {
    return this.scoreDiff;
  }

  // REQ-F-USD01: Accessor for uncontested single counts (testing)
  getUncontestedSingleCounts(): Record<Seat, number> {
    return { ...this.uncontestedSingleCounts };
  }

  // REQ-F-PTS03: Accessor for PTS consecutive leads (testing)
  getPtsConsecutiveLeads(): number {
    return this.ptsConsecutiveLeads;
  }
}
