// REQ-F-INFO02: Expert bot top-10 card tracking + absent rank bomb detection
// REQ-F-INFO01: Uses only human-available information (trick plays, own hand, hand sizes)

import type { GameCard, Seat, Rank, RoundState, TrickState } from '@tichu/shared';
import {
  isDragon,
  isPhoenix,
  getTeam,
  SEATS_IN_ORDER,
} from '@tichu/shared';

/** The "top 10" cards worth tracking: 4 Aces, 4 Kings, Dragon, Phoenix */
export interface TrackedCard {
  description: string;
  played: boolean;
  /** Seat that played it, if known */
  playedBy: Seat | null;
}

/** Ranks where we haven't seen all 4 suits — potential bomb material */
export interface AbsentRankInfo {
  rank: Rank;
  seen: number;      // how many of this rank we've seen played
  inOwnHand: number; // how many we hold
  unaccounted: number; // 4 - seen - inOwnHand
}

/**
 * REQ-F-INFO02: Tracks the top 10 cards (4 Aces, 4 Kings, Dragon, Phoenix)
 * and flags absent ranks as potential bombs.
 *
 * Updated each choosePlay() from trick history and own hand.
 * Only uses human-available information.
 */
export class CardTracker {
  /** Track Dragon and Phoenix */
  private dragonPlayed = false;
  private dragonPlayedBy: Seat | null = null;
  private phoenixPlayed = false;
  private phoenixPlayedBy: Seat | null = null;

  /** Track how many of each standard rank have been played (by rank) */
  private playedByRank = new Map<number, { count: number; bySeat: Seat[] }>();

  /** All card IDs we've already processed (to avoid double-counting) */
  private processedCardIds = new Set<number>();

  /** Cards in our own hand (rank counts) */
  private ownHandRankCounts = new Map<number, number>();
  private ownHandHasDragon = false;
  private ownHandHasPhoenix = false;

  /**
   * Reset tracker for a new round.
   */
  reset(): void {
    this.dragonPlayed = false;
    this.dragonPlayedBy = null;
    this.phoenixPlayed = false;
    this.phoenixPlayedBy = null;
    this.playedByRank.clear();
    this.processedCardIds.clear();
    this.ownHandRankCounts.clear();
    this.ownHandHasDragon = false;
    this.ownHandHasPhoenix = false;
  }

  /**
   * Update tracker from the current round state.
   * Call this each time choosePlay() is invoked.
   */
  update(roundState: RoundState, _ownSeat: Seat, ownHand: GameCard[]): void {
    // Update own hand tracking
    this.updateOwnHand(ownHand);

    // Process all tricks won by all players (completed tricks)
    for (const seat of SEATS_IN_ORDER) {
      for (const trickCards of roundState.players[seat].tricksWon) {
        for (const gc of trickCards) {
          this.processCard(gc, seat);
        }
      }
    }

    // Process the current trick in progress
    if (roundState.currentTrick) {
      this.processTrick(roundState.currentTrick);
    }
  }

  /**
   * Process a single trick's plays.
   */
  private processTrick(trick: TrickState): void {
    for (const play of trick.plays) {
      for (const gc of play.combination.cards) {
        this.processCard(gc, play.seat);
      }
    }
  }

  /**
   * Process a single card as played.
   */
  private processCard(gc: GameCard, playedBy: Seat): void {
    if (this.processedCardIds.has(gc.id)) return;
    this.processedCardIds.add(gc.id);

    if (isDragon(gc.card)) {
      this.dragonPlayed = true;
      this.dragonPlayedBy = playedBy;
    } else if (isPhoenix(gc.card)) {
      this.phoenixPlayed = true;
      this.phoenixPlayedBy = playedBy;
    } else if (gc.card.kind === 'standard') {
      const rank = gc.card.rank;
      const entry = this.playedByRank.get(rank) ?? { count: 0, bySeat: [] };
      entry.count++;
      entry.bySeat.push(playedBy);
      this.playedByRank.set(rank, entry);
    }
  }

  /**
   * Update own hand tracking.
   */
  private updateOwnHand(hand: GameCard[]): void {
    this.ownHandRankCounts.clear();
    this.ownHandHasDragon = false;
    this.ownHandHasPhoenix = false;

    for (const gc of hand) {
      if (isDragon(gc.card)) {
        this.ownHandHasDragon = true;
      } else if (isPhoenix(gc.card)) {
        this.ownHandHasPhoenix = true;
      } else if (gc.card.kind === 'standard') {
        const r = gc.card.rank;
        this.ownHandRankCounts.set(r, (this.ownHandRankCounts.get(r) ?? 0) + 1);
      }
    }
  }

  // ─── Query Methods ─────────────────────────────────────────────────────────

  /**
   * Get status of all top-10 cards.
   */
  getTop10Status(): TrackedCard[] {
    const result: TrackedCard[] = [];

    // Dragon
    result.push({
      description: 'Dragon',
      played: this.dragonPlayed,
      playedBy: this.dragonPlayedBy,
    });

    // Phoenix
    result.push({
      description: 'Phoenix',
      played: this.phoenixPlayed,
      playedBy: this.phoenixPlayedBy,
    });

    // 4 Aces (rank 14)
    const acePlayed = this.playedByRank.get(14);
    for (let i = 0; i < 4; i++) {
      const played = acePlayed ? i < acePlayed.count : false;
      result.push({
        description: `Ace #${i + 1}`,
        played,
        playedBy: played && acePlayed ? acePlayed.bySeat[i] ?? null : null,
      });
    }

    // 4 Kings (rank 13)
    const kingPlayed = this.playedByRank.get(13);
    for (let i = 0; i < 4; i++) {
      const played = kingPlayed ? i < kingPlayed.count : false;
      result.push({
        description: `King #${i + 1}`,
        played,
        playedBy: played && kingPlayed ? kingPlayed.bySeat[i] ?? null : null,
      });
    }

    return result;
  }

  /**
   * Check if Dragon is still in play (not yet played and not in own hand).
   */
  isDragonUnaccounted(): boolean {
    return !this.dragonPlayed && !this.ownHandHasDragon;
  }

  /**
   * Check if Phoenix is still in play (not yet played and not in own hand).
   */
  isPhoenixUnaccounted(): boolean {
    return !this.phoenixPlayed && !this.ownHandHasPhoenix;
  }

  /**
   * Count unaccounted Aces (not played, not in own hand).
   */
  getUnaccountedAces(): number {
    const played = this.playedByRank.get(14)?.count ?? 0;
    const inHand = this.ownHandRankCounts.get(14) ?? 0;
    return Math.max(0, 4 - played - inHand);
  }

  /**
   * Count unaccounted Kings (not played, not in own hand).
   */
  getUnaccountedKings(): number {
    const played = this.playedByRank.get(13)?.count ?? 0;
    const inHand = this.ownHandRankCounts.get(13) ?? 0;
    return Math.max(0, 4 - played - inHand);
  }

  /**
   * REQ-F-INFO02: Flag ranks where not all 4 suits have been accounted for.
   * These ranks are potential bomb material in opponents' hands.
   * Only checks ranks 2-14 (standard ranks).
   */
  getAbsentRanks(): AbsentRankInfo[] {
    const result: AbsentRankInfo[] = [];

    for (let rank = 2; rank <= 14; rank++) {
      const played = this.playedByRank.get(rank)?.count ?? 0;
      const inHand = this.ownHandRankCounts.get(rank) ?? 0;
      const unaccounted = 4 - played - inHand;

      // Only flag ranks where 3+ are unaccounted (could be a bomb)
      if (unaccounted >= 3) {
        result.push({
          rank: rank as Rank,
          seen: played,
          inOwnHand: inHand,
          unaccounted,
        });
      }
    }

    return result;
  }

  /**
   * Check if opponents might have a bomb of a specific rank.
   * True if 4 cards of that rank are unaccounted for (none played, none in hand).
   */
  couldOpponentHaveBomb(rank: number): boolean {
    const played = this.playedByRank.get(rank)?.count ?? 0;
    const inHand = this.ownHandRankCounts.get(rank) ?? 0;
    return (4 - played - inHand) >= 4;
  }

  /**
   * Get the total number of unaccounted top-10 cards.
   * Useful for gauging how dangerous the remaining opponents are.
   */
  getUnaccountedTop10Count(): number {
    let count = 0;
    if (this.isDragonUnaccounted()) count++;
    if (this.isPhoenixUnaccounted()) count++;
    count += this.getUnaccountedAces();
    count += this.getUnaccountedKings();
    return count;
  }

  // ─── Point Tracking ─────────────────────────────────────────────────────

  // REQ-F-TRK01: Rough point tracking per team
  /**
   * Compute approximate card points won by a team.
   * Point values: 5s=5pts, 10s/Ks=10pts, Dragon=25pts, Phoenix=-25pts.
   * Computed from tricksWon in the round state.
   */
  getApproxTeamPoints(roundState: RoundState, team: 'northSouth' | 'eastWest'): number {
    let points = 0;
    for (const seat of SEATS_IN_ORDER) {
      if (getTeam(seat) !== team) continue;
      for (const trickCards of roundState.players[seat].tricksWon) {
        for (const gc of trickCards) {
          points += this.getCardPointValue(gc);
        }
      }
    }
    return points;
  }

  /**
   * Get the point value of a single card.
   * 5s = 5, 10s = 10, Kings = 10, Dragon = 25, Phoenix = -25, others = 0.
   */
  private getCardPointValue(gc: GameCard): number {
    if (isDragon(gc.card)) return 25;
    if (isPhoenix(gc.card)) return -25;
    if (gc.card.kind === 'standard') {
      if (gc.card.rank === 5) return 5;
      if (gc.card.rank === 10 || gc.card.rank === 13) return 10;
    }
    return 0;
  }
}
