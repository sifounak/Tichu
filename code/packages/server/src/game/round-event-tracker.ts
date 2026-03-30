// REQ-F-EC01: RoundEventTracker — state-diff observer for mid-round card events
// REQ-F-EC02: Detects events by comparing prev/current GameMachineContext
// REQ-NF-P03: Does NOT modify XState machine — pure observation

import type {
  Seat,
  RoundState,
} from '@tichu/shared';
import {
  isDragon,
  isPhoenix,
  isDog,
  getTeam,
  getPartner,
  SEATS_IN_ORDER,
  detectAllBombs,
  CombinationType,
} from '@tichu/shared';
import type { GameMachineContext } from './game-state-machine.js';
import { createBlankSummary, type RoundEventSummary } from './round-event-types.js';
import { GamePhase } from '@tichu/shared';

/**
 * Observes GameMachineContext transitions and accumulates per-player card events.
 * Called from GameManager.onStateChange() on every state transition.
 */
export class RoundEventTracker {
  private summaries = new Map<Seat, RoundEventSummary>();
  private prevRound: RoundState | null = null;
  private currentRoundNumber = 0;
  /** Track which bombs we've already counted (by trick play index) */
  private processedBombCount = new Map<Seat, number>();

  /** Get accumulated summaries for all seats */
  getSummaries(): Map<Seat, RoundEventSummary> {
    return new Map(this.summaries);
  }

  /** Get all summaries as an array (for the current round) */
  getAllSummaries(): RoundEventSummary[] {
    return Array.from(this.summaries.values());
  }

  /** Reset for a new round */
  reset(roundNumber: number): void {
    this.summaries.clear();
    this.prevRound = null;
    this.currentRoundNumber = roundNumber;
    this.processedBombCount.clear();
    for (const seat of SEATS_IN_ORDER) {
      this.summaries.set(seat, createBlankSummary(seat, roundNumber));
    }
  }

  /**
   * REQ-F-EC02: Called on every state transition.
   * Compares prev/current round state to detect events.
   */
  onStateChange(context: GameMachineContext): void {
    const round = context.currentRound;
    if (!round) return;

    // Auto-reset when round number changes
    if (round.roundNumber !== this.currentRoundNumber) {
      this.reset(round.roundNumber);
    }

    const prev = this.prevRound;

    // Detect phase transitions
    if (prev) {
      this.detectPhaseTransitions(prev, round);
      this.detectBombPlays(prev, round);
      this.detectDragonTrickWin(prev, round);
      this.detectDragonGift(prev, round);
      this.detectDogPlay(prev, round);
      this.detectTheTichu(prev, round);
    } else if (round.phase === GamePhase.GrandTichuDecision) {
      // First observation — capture initial hands (first 8 cards)
      this.captureInitialHands(round);
    }

    // Save current state for next comparison
    this.prevRound = structuredClone(round);
  }

  // ─── Detection Methods ────────────────────────────────────────────────

  /** REQ-F-EC03: Detect phase transitions for hand snapshots and pass tracking */
  private detectPhaseTransitions(prev: RoundState, curr: RoundState): void {
    // Grand Tichu → Card Passing: capture initial hands if not done
    if (prev.phase === GamePhase.GrandTichuDecision &&
        curr.phase !== GamePhase.GrandTichuDecision) {
      this.captureInitialHands(prev);
    }

    // Card Passing → Playing: card exchange happened, capture pass data + full hands
    if (prev.phase === GamePhase.CardPassing && curr.phase === GamePhase.Playing) {
      this.capturePassData(curr);
      this.captureFullHands(curr);
    }
  }

  /** REQ-F-EC03: Snapshot first 8 cards and check for bombs */
  private captureInitialHands(round: RoundState): void {
    for (const seat of SEATS_IN_ORDER) {
      const summary = this.summaries.get(seat)!;
      const hand = round.players[seat].hand;
      // First 8 cards — check for bomb combinations
      if (hand.length <= 8) {
        const bombs = detectAllBombs(hand);
        if (bombs.length > 0) {
          summary.bombsInFirst8 = bombs.length;
        }
      }
    }
  }

  /** REQ-F-EC03/GC02/GC05: Read pass data after card exchange */
  private capturePassData(round: RoundState): void {
    for (const seat of SEATS_IN_ORDER) {
      const summary = this.summaries.get(seat)!;
      const partner = getPartner(seat);

      // What this seat RECEIVED in the pass
      for (const fromSeat of SEATS_IN_ORDER) {
        if (fromSeat === seat) continue;
        const passedCard = round.players[fromSeat].passedCards.to[seat];
        if (!passedCard) continue;

        const card = passedCard.card;
        if (isDragon(card)) summary.dragonReceivedInPass = true;
        if (isPhoenix(card)) summary.phoenixReceivedInPass = true;
        if (isDog(card)) summary.dogReceivedInPass = true;
        if (card.kind === 'standard' && card.rank === 14) summary.aceReceivedInPass = true;
      }

      // What this seat GAVE in the pass (for dog tracking)
      for (const toSeat of SEATS_IN_ORDER) {
        if (toSeat === seat) continue;
        const passedCard = round.players[seat].passedCards.to[toSeat];
        if (!passedCard) continue;

        if (isDog(passedCard.card)) {
          if (toSeat === partner) {
            summary.dogGivenToPartner = true;
          } else {
            summary.dogGivenToOpponent = true;
          }
        }
      }
    }
  }

  /** REQ-F-GC01: Capture which special cards players have after exchange */
  private captureFullHands(round: RoundState): void {
    for (const seat of SEATS_IN_ORDER) {
      const summary = this.summaries.get(seat)!;
      const hand = round.players[seat].hand;
      for (const gc of hand) {
        if (isDragon(gc.card)) summary.hadDragon = true;
        if (isPhoenix(gc.card)) summary.hadPhoenix = true;
      }
    }
  }

  /** REQ-F-GC07/GC08/GC09: Detect bomb plays and classify by size */
  private detectBombPlays(prev: RoundState, curr: RoundState): void {
    const prevTrick = prev.currentTrick;
    const currTrick = curr.currentTrick;
    if (!currTrick) return;

    // Check if new plays were added to the current trick
    const prevPlayCount = prevTrick?.plays.length ?? 0;
    const currPlayCount = currTrick.plays.length;

    for (let i = prevPlayCount; i < currPlayCount; i++) {
      const play = currTrick.plays[i];
      if (!play.combination.isBomb) continue;

      const summary = this.summaries.get(play.seat)!;
      summary.bombsPlayed++;

      // Classify by size
      const cardCount = play.combination.cards.length;
      if (cardCount === 4 && play.combination.type === CombinationType.FourBomb) {
        summary.fourCardBombs++;
      } else if (cardCount === 5) {
        summary.fiveCardBombs++;
      } else if (cardCount >= 6) {
        summary.sixPlusCardBombs++;
      } else if (play.combination.type === CombinationType.StraightFlushBomb) {
        // Straight flush bombs are 5+ cards
        if (cardCount === 5) summary.fiveCardBombs++;
        else summary.sixPlusCardBombs++;
      }

      // REQ-F-GC08: Over-bombed — previous play was also a bomb by different team
      if (i > 0) {
        const prevPlay = currTrick.plays[i - 1];
        if (prevPlay.combination.isBomb && getTeam(prevPlay.seat) !== getTeam(play.seat)) {
          const prevSummary = this.summaries.get(prevPlay.seat)!;
          prevSummary.overBombed++;
        }
      }

      // REQ-F-GC09: Bomb forced by wish
      if (curr.mahjongWish && !curr.wishFulfilled) {
        const hasWishedRank = play.combination.cards.some(gc =>
          gc.card.kind === 'standard' && gc.card.rank === curr.mahjongWish,
        );
        if (hasWishedRank) {
          summary.bombForcedByWish++;
        }
      }
    }
  }

  /** REQ-F-GC03: Detect Dragon trick wins */
  private detectDragonTrickWin(prev: RoundState, curr: RoundState): void {
    // Trick completed = prev had currentTrick with plays, curr either has
    // null trick or a new trick (plays.length < prev plays.length)
    const prevTrick = prev.currentTrick;
    if (!prevTrick || prevTrick.plays.length === 0) return;

    const currTrick = curr.currentTrick;
    const trickCompleted = !currTrick || currTrick.plays.length === 0 ||
      (currTrick.plays.length < prevTrick.plays.length);

    if (!trickCompleted) return;

    // Check if the winning play was a Dragon
    const winnerSeat = prevTrick.currentWinner;
    const winningPlay = prevTrick.plays.find(p => p.seat === winnerSeat);
    if (winningPlay && winningPlay.combination.cards.length === 1 &&
        isDragon(winningPlay.combination.cards[0].card)) {
      const summary = this.summaries.get(winnerSeat)!;
      summary.dragonTrickWins++;
    }
  }

  /** REQ-F-GC04: Detect Dragon gifted to opponent after opponent won the trick */
  private detectDragonGift(prev: RoundState, curr: RoundState): void {
    // dragonGiftedTo transitions from null to a seat
    if (!prev.dragonGiftedTo && curr.dragonGiftedTo) {
      // The Dragon player is the one who won the trick with Dragon
      // curr.dragonGiftedTo is the recipient
      const recipient = curr.dragonGiftedTo;
      // Find who played the Dragon — they would have had dragonGiftPending
      // The Dragon player's team is different from recipient if gifted to opponent
      if (prev.dragonGiftPending) {
        const dragonPlayer = prev.dragonGiftPending.from;
        if (getTeam(dragonPlayer) !== getTeam(recipient)) {
          // The RECIPIENT received dragon trick cards from an opponent
          const recipientSummary = this.summaries.get(recipient)!;
          recipientSummary.dragonGivenAfterOpponentWin++;
        }
      }
    }
  }

  /** REQ-F-GC06: Detect Dog played for Tichu partner */
  private detectDogPlay(prev: RoundState, curr: RoundState): void {
    // lastDogPlay transitions from null to a value
    if (!prev.lastDogPlay && curr.lastDogPlay) {
      const { fromSeat, toSeat } = curr.lastDogPlay;
      const partner = getPartner(fromSeat);

      // Check if the recipient (partner) has a Tichu call
      if (toSeat === partner) {
        const partnerCall = curr.players[partner].tipiCall;
        if (partnerCall === 'tichu' || partnerCall === 'grandTichu') {
          const summary = this.summaries.get(fromSeat)!;
          summary.dogPlayedForTichuPartner++;
        }
      }
    }

    // Track opportunities: player has Dog AND partner has called Tichu
    // This is checked once per round when hands are known (after card exchange)
  }

  /** REQ-F-GC10: Detect "The Tichu" straight (13-card 1-through-Ace) */
  private detectTheTichu(prev: RoundState, curr: RoundState): void {
    const prevTrick = prev.currentTrick;
    const currTrick = curr.currentTrick;
    if (!currTrick) return;

    const prevPlayCount = prevTrick?.plays.length ?? 0;
    const currPlayCount = currTrick.plays.length;

    for (let i = prevPlayCount; i < currPlayCount; i++) {
      const play = currTrick.plays[i];
      const combo = play.combination;

      // "The Tichu" = 13-card straight from 1(Mahjong) through Ace
      if (combo.type === CombinationType.Straight && combo.cards.length === 13) {
        const summary = this.summaries.get(play.seat)!;
        // Check if Phoenix was used
        const hasPhoenix = combo.cards.some(gc => isPhoenix(gc.card));
        if (hasPhoenix) {
          summary.theTichuDirty++;
        } else {
          summary.theTichuClean++;
        }
      }
    }
  }

  /**
   * Called after card exchange to track dog opportunities.
   * A player has an "opportunity" if they hold the Dog and their partner has called Tichu.
   */
  trackDogOpportunities(round: RoundState): void {
    for (const seat of SEATS_IN_ORDER) {
      const partner = getPartner(seat);
      const partnerCall = round.players[partner].tipiCall;
      if (partnerCall !== 'tichu' && partnerCall !== 'grandTichu') continue;

      const hasDog = round.players[seat].hand.some(gc => isDog(gc.card));
      if (hasDog) {
        const summary = this.summaries.get(seat)!;
        summary.dogOpportunitiesForTichuPartner++;
      }
    }
  }
}
