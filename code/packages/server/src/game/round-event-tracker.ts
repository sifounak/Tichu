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
  isMahjong,
  getTeam,
  getPartner,
  SEATS_IN_ORDER,
  detectAllBombs,
  CombinationType,
} from '@tichu/shared';
import type { Seat as SeatType } from '@tichu/shared';
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
  /** REQ-F-CS07: Track seats that have been detected as stuck with Dog (once per round) */
  private dogStuckDetected = new Set<SeatType>();

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
    this.dogStuckDetected.clear();
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
      this.detectPhoenixPlay(prev, round);
      this.detectDragonTrickWin(prev, round);
      this.detectDragonGift(prev, round);
      this.detectDogPlay(prev, round);
      this.detectDogStuck(round);
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
      this.capturePassData(prev, curr);
      this.captureFullHands(curr);
      this.detectConflictingBombs(curr);
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

  /** REQ-F-EC03/GC02/GC05/CS19/CS20: Read pass data after card exchange */
  private capturePassData(_prevRound: RoundState, round: RoundState): void {
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
        if (isDog(card)) {
          summary.dogReceivedInPass = true;
          // REQ-F-CS19: Dog received from partner vs opponent
          if (fromSeat === partner) {
            summary.dogReceivedFromPartner = true;
          } else {
            summary.dogReceivedFromOpponent = true;
          }
        }
        if (card.kind === 'standard' && card.rank === 14) summary.aceReceivedInPass = true;
        // REQ-F-CS19: Mahjong received in pass
        if (isMahjong(card)) summary.mahjongReceivedInPass = true;
      }

      // What this seat GAVE in the pass
      for (const toSeat of SEATS_IN_ORDER) {
        if (toSeat === seat) continue;
        const passedCard = round.players[seat].passedCards.to[toSeat];
        if (!passedCard) continue;

        const card = passedCard.card;
        // Existing dog tracking
        if (isDog(card)) {
          if (toSeat === partner) {
            summary.dogGivenToPartner = true;
          } else {
            summary.dogGivenToOpponent = true;
          }
        }
        // REQ-F-CS19: Extended gave tracking
        if (isDragon(card)) summary.dragonGivenInPass = true;
        if (isPhoenix(card)) summary.phoenixGivenInPass = true;
        if (card.kind === 'standard' && card.rank === 14) summary.aceGivenInPass = true;
        if (isMahjong(card)) summary.mahjongGivenInPass = true;

        // REQ-F-CS20: Check if given card completed a 4-of-a-kind bomb for the recipient
        if (card.kind === 'standard') {
          const rank = card.rank;
          const recipientHand = round.players[toSeat].hand;
          const rankCount = recipientHand.filter(gc =>
            gc.card.kind === 'standard' && gc.card.rank === rank,
          ).length;
          if (rankCount === 4) {
            if (toSeat === partner) {
              summary.bombGivenToPartnerInPass = true;
            } else {
              summary.bombGivenToOpponentInPass = true;
            }
          }
        }
      }

      // REQ-F-CS20: Check if any received card completed a 4-of-a-kind bomb for this player
      for (const fromSeat of SEATS_IN_ORDER) {
        if (fromSeat === seat) continue;
        const passedCard = round.players[fromSeat].passedCards.to[seat];
        if (!passedCard || passedCard.card.kind !== 'standard') continue;

        const rank = passedCard.card.rank;
        const myHand = round.players[seat].hand;
        const rankCount = myHand.filter(gc =>
          gc.card.kind === 'standard' && gc.card.rank === rank,
        ).length;
        if (rankCount === 4) {
          if (fromSeat === partner) {
            summary.bombReceivedFromPartnerInPass = true;
          } else {
            summary.bombReceivedFromOpponentInPass = true;
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

      // REQ-F-CS10: Per-size bomb tracking (4 through 14)
      const cardCount = play.combination.cards.length;
      const sizeKey = `bombSize${cardCount}` as keyof RoundEventSummary;
      if (sizeKey in summary && typeof summary[sizeKey] === 'number') {
        (summary as unknown as Record<string, number>)[sizeKey]++;
      }

      // REQ-F-CS16: Over-bombed direction split — previous play was also a bomb by different team
      if (i > 0) {
        const prevPlay = currTrick.plays[i - 1];
        if (prevPlay.combination.isBomb && getTeam(prevPlay.seat) !== getTeam(play.seat)) {
          // Victim: their bomb was topped
          const victimSummary = this.summaries.get(prevPlay.seat)!;
          victimSummary.youWereOverBombed++;
          // Attacker: you played the higher bomb
          summary.youOverBombed++;
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

  /** REQ-F-GC06/CS06: Detect Dog played — control outcomes and Tichu partner */
  private detectDogPlay(prev: RoundState, curr: RoundState): void {
    // lastDogPlay transitions from null to a value
    if (!prev.lastDogPlay && curr.lastDogPlay) {
      const { fromSeat, toSeat } = curr.lastDogPlay;
      const summary = this.summaries.get(fromSeat)!;
      const partner = getPartner(fromSeat);

      // REQ-F-CS06: Dog control classification
      if (toSeat === partner) {
        summary.dogControlToPartner++;
      } else if (toSeat === fromSeat) {
        summary.dogControlToSelf++;
      } else {
        summary.dogControlToOpponent++;
      }

      // Existing: check if the recipient (partner) has a Tichu call
      if (toSeat === partner) {
        const partnerCall = curr.players[partner].tipiCall;
        if (partnerCall === 'tichu' || partnerCall === 'grandTichu') {
          summary.dogPlayedForTichuPartner++;
        }
      }
    }
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

  /** REQ-F-CS03: Detect Phoenix play types by combination type */
  private detectPhoenixPlay(prev: RoundState, curr: RoundState): void {
    const prevTrick = prev.currentTrick;
    const currTrick = curr.currentTrick;
    if (!currTrick) return;

    const prevPlayCount = prevTrick?.plays.length ?? 0;
    const currPlayCount = currTrick.plays.length;

    for (let i = prevPlayCount; i < currPlayCount; i++) {
      const play = currTrick.plays[i];
      const hasPhoenix = play.combination.cards.some(gc => isPhoenix(gc.card));
      if (!hasPhoenix) continue;

      const summary = this.summaries.get(play.seat)!;
      switch (play.combination.type) {
        case CombinationType.Single:
          summary.phoenixUsedAsSingle++;
          break;
        case CombinationType.Pair:
          summary.phoenixUsedForPair++;
          break;
        case CombinationType.Triple:
          summary.phoenixUsedInTriple++;
          break;
        case CombinationType.FullHouse:
          summary.phoenixUsedInFullHouse++;
          break;
        case CombinationType.PairSequence:
          summary.phoenixUsedInConsecutivePairs++;
          break;
        case CombinationType.Straight:
          summary.phoenixUsedInStraight++;
          summary.longestStraightWithPhoenix = Math.max(
            summary.longestStraightWithPhoenix,
            play.combination.cards.length,
          );
          break;
        // Phoenix cannot appear in FourBomb or StraightFlushBomb by game rules
      }
    }
  }

  /** REQ-F-CS07: Detect stuck with Dog as last card */
  private detectDogStuck(round: RoundState): void {
    for (const seat of SEATS_IN_ORDER) {
      if (this.dogStuckDetected.has(seat)) continue;
      const hand = round.players[seat].hand;
      if (hand.length === 1 && isDog(hand[0].card)) {
        this.dogStuckDetected.add(seat);
        const summary = this.summaries.get(seat)!;
        summary.dogStuckAsLastCard++;
      }
    }
  }

  /** REQ-F-CS13: Detect conflicting bombs in dealt hand (14 cards after exchange) */
  private detectConflictingBombs(round: RoundState): void {
    for (const seat of SEATS_IN_ORDER) {
      const summary = this.summaries.get(seat)!;
      const hand = round.players[seat].hand;

      // Find all 4-of-a-kind bomb ranks
      const rankCounts = new Map<number, number>();
      for (const gc of hand) {
        if (gc.card.kind === 'standard') {
          const r = gc.card.rank;
          rankCounts.set(r, (rankCounts.get(r) ?? 0) + 1);
        }
      }
      const fourOfAKindRanks: number[] = [];
      for (const [rank, count] of rankCounts) {
        if (count >= 4) fourOfAKindRanks.push(rank);
      }
      if (fourOfAKindRanks.length === 0) continue;

      // Find straight flushes by suit (5+ consecutive same-suit cards)
      const bySuit = new Map<string, number[]>();
      for (const gc of hand) {
        if (gc.card.kind === 'standard') {
          const suit = gc.card.suit;
          const ranks = bySuit.get(suit) ?? [];
          ranks.push(gc.card.rank);
          bySuit.set(suit, ranks);
        }
      }

      // For each suit, find consecutive runs of 5+
      const straightFlushRuns: Array<{ ranks: Set<number> }> = [];
      for (const [, ranks] of bySuit) {
        const sorted = [...new Set(ranks)].sort((a, b) => a - b);
        let runStart = 0;
        for (let j = 1; j <= sorted.length; j++) {
          if (j === sorted.length || sorted[j] !== sorted[j - 1] + 1) {
            const runLen = j - runStart;
            if (runLen >= 5) {
              const runRanks = new Set(sorted.slice(runStart, j));
              straightFlushRuns.push({ ranks: runRanks });
            }
            runStart = j;
          }
        }
      }
      if (straightFlushRuns.length === 0) continue;

      // Check conflicts: 4-of-a-kind shares a card with a straight flush,
      // and removing the 4-of-a-kind rank breaks the flush below 5 cards
      for (const fourRank of fourOfAKindRanks) {
        for (const run of straightFlushRuns) {
          if (!run.ranks.has(fourRank)) continue;
          // If we remove this rank, does the remaining run still have a 5+ consecutive sub-run?
          const remaining = [...run.ranks].filter(r => r !== fourRank).sort((a, b) => a - b);
          let maxConsecutive = 0;
          let currentRun = 1;
          for (let j = 1; j < remaining.length; j++) {
            if (remaining[j] === remaining[j - 1] + 1) {
              currentRun++;
            } else {
              maxConsecutive = Math.max(maxConsecutive, currentRun);
              currentRun = 1;
            }
          }
          maxConsecutive = Math.max(maxConsecutive, currentRun);

          if (remaining.length < 5 || maxConsecutive < 5) {
            // Conflict: removing the rank breaks the straight flush
            summary.conflictingBombs++;
          }
        }
      }
    }
  }
}
