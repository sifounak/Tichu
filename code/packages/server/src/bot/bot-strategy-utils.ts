// REQ-NF-MAINT01: Shared strategy utilities for all bot tiers
// REQ-F-INFO01: All functions use only human-available information

import type {
  GameCard,
  Seat,
  Rank,
  Combination,
  TrickState,
  RoundState,
} from '@tichu/shared';
import {
  CombinationType,
  SEATS_IN_ORDER,
  getTeam,
  getPartner,
  isDragon,
  isPhoenix,
  isDog,
  isMahjong,
  detectCombination,
} from '@tichu/shared';
import type { BotPlayContext } from './bot-interface.js';

// ─── Hand Evaluation ────────────────────────────────────────────────────────

/** Cards considered "top" for hand strength evaluation */
const TOP_CARD_KINDS = new Set(['dragon', 'phoenix']);
const TOP_RANKS: Set<number> = new Set([14, 13]); // Aces and Kings

/**
 * Count how many "top" cards are in a hand.
 * Top cards: Dragon, Phoenix, 4 Aces (rank 14), 4 Kings (rank 13).
 * For Grand Tichu evaluation, also count Mahjong and Dog as useful.
 */
export function countTopCards(
  hand: GameCard[],
  options?: { includeMahjongDog?: boolean },
): number {
  let count = 0;
  for (const gc of hand) {
    if (TOP_CARD_KINDS.has(gc.card.kind)) {
      count++;
    } else if (gc.card.kind === 'standard' && TOP_RANKS.has(gc.card.rank)) {
      count++;
    } else if (options?.includeMahjongDog && (isMahjong(gc.card) || isDog(gc.card))) {
      count++;
    }
  }
  return count;
}

/**
 * Count "lead getters" — cards or combos that can win a trick when led.
 * Includes: Aces, Dragon, bombs in hand, Dog (guaranteed lead transfer).
 */
export function countLeadGetters(hand: GameCard[]): number {
  let count = 0;
  for (const gc of hand) {
    if (isDragon(gc.card)) count++;
    else if (gc.card.kind === 'standard' && gc.card.rank === 14) count++;
    else if (isDog(gc.card)) count++; // Guaranteed unbombable lead transfer
  }
  // Count bombs
  const bombs = findBombs(hand);
  count += bombs.length;
  return count;
}

/**
 * Evaluate hand strength as a score.
 * Higher = stronger hand. Considers top cards, lead getters, and combo quality.
 * Returns a value roughly in [0, 20] range.
 */
export function evaluateHandStrength(hand: GameCard[]): number {
  let score = 0;

  // Top card bonuses
  for (const gc of hand) {
    if (isDragon(gc.card)) score += 3;
    else if (isPhoenix(gc.card)) score += 2.5;
    else if (gc.card.kind === 'standard') {
      if (gc.card.rank === 14) score += 2; // Ace
      else if (gc.card.rank === 13) score += 1.5; // King
      else if (gc.card.rank === 12) score += 0.5; // Queen
    } else if (isDog(gc.card)) score += 1;
    else if (isMahjong(gc.card)) score += 0.5;
  }

  // Bomb bonus
  const bombs = findBombs(hand);
  score += bombs.length * 3;

  // Penalty for low singletons (weak cards)
  const singletons = findSingletons(hand);
  for (const gc of singletons) {
    if (gc.card.kind === 'standard' && gc.card.rank <= 6) {
      score -= 0.5;
    }
  }

  return score;
}

/**
 * Find all four-of-a-kind and straight-flush bombs in the hand.
 */
export function findBombs(hand: GameCard[]): Combination[] {
  const bombs: Combination[] = [];

  // Group standard cards by rank
  const byRank = new Map<number, GameCard[]>();
  for (const gc of hand) {
    if (gc.card.kind === 'standard') {
      const r = gc.card.rank;
      if (!byRank.has(r)) byRank.set(r, []);
      byRank.get(r)!.push(gc);
    }
  }

  // Four-of-a-kind bombs
  for (const [, cards] of byRank) {
    if (cards.length === 4) {
      const combo = detectCombination(cards);
      if (combo?.isBomb) bombs.push(combo);
    }
  }

  // Straight-flush bombs: check consecutive same-suit groups of 5+
  // (simplified: let detectCombination handle the detection)
  // We'd need to enumerate subsets, which is expensive. For now, just find four-of-a-kinds.
  // Full straight-flush bomb detection can be added if needed.

  return bombs;
}

/**
 * Find cards that appear as singletons (no pair partner in hand).
 */
export function findSingletons(hand: GameCard[]): GameCard[] {
  const rankCounts = new Map<number, GameCard[]>();
  for (const gc of hand) {
    if (gc.card.kind === 'standard') {
      const r = gc.card.rank;
      if (!rankCounts.has(r)) rankCounts.set(r, []);
      rankCounts.get(r)!.push(gc);
    }
  }

  const singletons: GameCard[] = [];
  for (const [, cards] of rankCounts) {
    if (cards.length === 1) {
      singletons.push(cards[0]);
    }
  }

  // Special cards that are always singletons
  for (const gc of hand) {
    if (isDragon(gc.card) || isPhoenix(gc.card) || isMahjong(gc.card) || isDog(gc.card)) {
      singletons.push(gc);
    }
  }

  return singletons;
}

// ─── Card Sorting & Ranking ─────────────────────────────────────────────────

/**
 * Get a numeric strength for a card (for sorting/comparison).
 * Higher = stronger. Dragon=25, Phoenix=15, standard=rank, Mahjong=1, Dog=0.
 */
export function getCardStrength(gc: GameCard): number {
  switch (gc.card.kind) {
    case 'dragon': return 25;
    case 'phoenix': return 15; // Versatile, treat as very strong
    case 'standard': return gc.card.rank;
    case 'mahjong': return 1;
    case 'dog': return 0;
  }
}

/**
 * Sort cards by strength (ascending — weakest first).
 */
export function sortByStrength(cards: GameCard[]): GameCard[] {
  return [...cards].sort((a, b) => getCardStrength(a) - getCardStrength(b));
}

/**
 * Rank valid plays by strategic value for leading (weakest first = best to lead).
 * Special cards have specific ordering: Dog first (lead transfer), then low combos.
 */
export function rankCombinationsForLead(combos: Combination[]): Combination[] {
  return [...combos].sort((a, b) => {
    // Dog always leads first (guaranteed lead transfer to partner)
    const aIsDog = a.cards.length === 1 && isDog(a.cards[0].card);
    const bIsDog = b.cards.length === 1 && isDog(b.cards[0].card);
    if (aIsDog && !bIsDog) return -1;
    if (!aIsDog && bIsDog) return 1;

    // Non-bombs before bombs (save bombs)
    if (a.isBomb !== b.isBomb) return a.isBomb ? 1 : -1;

    // Lower rank first (lead low)
    if (a.rank !== b.rank) return a.rank - b.rank;

    // Prefer larger combos (gets rid of more cards)
    return b.cards.length - a.cards.length;
  });
}

/**
 * Rank valid plays for following/winning (lowest winning play = most efficient).
 */
export function rankCombinationsForFollow(combos: Combination[]): Combination[] {
  return [...combos].sort((a, b) => {
    // Non-bombs before bombs (save bombs for critical moments)
    if (a.isBomb !== b.isBomb) return a.isBomb ? 1 : -1;

    // Lower rank first (win with minimum force)
    return a.rank - b.rank;
  });
}

// ─── Strategic Passing ──────────────────────────────────────────────────────

export interface PassStrategy {
  /** Pass Dog to opponent if they called Grand Tichu */
  passDogToOpponentGrandTichu: boolean;
  /** Pass best spare card to partner when hand is weak */
  passBestToPartnerWhenWeak: boolean;
  /** Never pass Dragon or Phoenix to opponents */
  keepSpecialsOnTeam: boolean;
}

export const DEFAULT_PASS_STRATEGY: PassStrategy = {
  passDogToOpponentGrandTichu: false,
  passBestToPartnerWhenWeak: true,
  keepSpecialsOnTeam: true,
};

/**
 * Identify weak cards suitable for passing to opponents.
 * Returns low unmatched singletons (rank 2-6 with no pair partner).
 */
export function identifyWeakCards(hand: GameCard[]): GameCard[] {
  const singletons = findSingletons(hand);
  return singletons
    .filter((gc) => gc.card.kind === 'standard' && gc.card.rank <= 8)
    .sort((a, b) => getCardStrength(a) - getCardStrength(b));
}

/**
 * Select 3 cards to pass strategically.
 * Returns a map: seat → card to pass.
 */
export function selectPassCards(
  hand: GameCard[],
  seat: Seat,
  _strategy: PassStrategy = DEFAULT_PASS_STRATEGY,
): Record<Seat, GameCard> {
  const partner = getPartner(seat);
  const opponents = SEATS_IN_ORDER.filter((s) => s !== seat && s !== partner);

  // Sort hand by strength
  const sorted = sortByStrength(hand);

  // Cards to pass to opponents: weakest non-special cards
  const opponentCards: GameCard[] = [];
  const partnerCards: GameCard[] = [];

  // Identify what to keep (Dragon, Phoenix always kept on team)
  const available = sorted.filter(
    (gc) => !isDragon(gc.card) && !isDog(gc.card),
  );

  // Pick two weakest for opponents
  for (const gc of available) {
    if (opponentCards.length < 2) {
      // Don't pass Phoenix to opponents
      if (isPhoenix(gc.card)) continue;
      opponentCards.push(gc);
    }
  }

  // Pick best spare card for partner (strongest non-kept)
  const usedIds = new Set(opponentCards.map((gc) => gc.id));
  const remainingForPartner = sorted
    .filter((gc) => !usedIds.has(gc.id))
    .reverse(); // Strongest first

  for (const gc of remainingForPartner) {
    if (partnerCards.length < 1) {
      partnerCards.push(gc);
    }
  }

  // Build result
  const result = {} as Record<Seat, GameCard>;
  result[opponents[0]] = opponentCards[0] ?? sorted[0];
  result[opponents[1]] = opponentCards[1] ?? sorted[1];
  result[partner] = partnerCards[0] ?? sorted[sorted.length - 1];
  result[seat] = sorted[0]; // Placeholder (not actually passed)

  return result;
}

// ─── Play Selection ─────────────────────────────────────────────────────────

/**
 * Check if partner is currently winning the trick.
 */
export function isPartnerWinning(trick: TrickState | null, seat: Seat): boolean {
  if (!trick || trick.plays.length === 0) return false;
  const partner = getPartner(seat);
  return trick.currentWinner === partner;
}

/**
 * Check if the bot can go out with this play (hand empties).
 */
export function canGoOut(hand: GameCard[], play: Combination): boolean {
  return hand.length === play.cards.length;
}

/**
 * Check if a hand has nothing but "winners" (all plays would win when led).
 * Simplified: all remaining cards are Aces, Dragon, or part of bombs.
 */
export function isAllWinners(hand: GameCard[]): boolean {
  if (hand.length === 0) return true;
  for (const gc of hand) {
    if (gc.card.kind === 'standard' && gc.card.rank < 14) return false;
    if (isMahjong(gc.card)) return false;
    if (isDog(gc.card)) return false;
  }
  return true;
}

/**
 * Select a play when leading (no trick active).
 * Strategy: play lowest combination. Exceptions: Dog early, never lead winner
 * unless all winners or going out.
 */
export function selectLeadPlay(
  validPlays: Combination[],
  hand: GameCard[],
  options?: { randomFactor?: number; randomSource?: () => number },
): Combination | null {
  if (validPlays.length === 0) return null;

  // Random factor: occasionally make suboptimal play
  if (options?.randomFactor && options?.randomSource) {
    if (options.randomSource() < options.randomFactor) {
      return validPlays[Math.floor(options.randomSource() * validPlays.length)];
    }
  }

  const ranked = rankCombinationsForLead(validPlays);

  // If all winners or going out, play anything
  if (isAllWinners(hand)) {
    return ranked[0];
  }

  // Prefer Dog if available (lead transfer to partner)
  const dogPlay = ranked.find(
    (c) => c.cards.length === 1 && isDog(c.cards[0].card),
  );
  if (dogPlay) return dogPlay;

  // Play lowest non-winner combination
  // Avoid leading Aces/Dragon unless can go out
  for (const combo of ranked) {
    if (canGoOut(hand, combo)) return combo;
    // Skip Dragon single — save it
    if (combo.cards.length === 1 && isDragon(combo.cards[0].card)) continue;
    // Skip Ace singles unless it's the only option
    if (
      combo.type === CombinationType.Single &&
      combo.cards.length === 1 &&
      combo.cards[0].card.kind === 'standard' &&
      combo.cards[0].card.rank === 14
    ) {
      continue;
    }
    return combo;
  }

  // Fallback: play whatever is ranked first
  return ranked[0];
}

/**
 * Select a play when following (trick is active).
 * Strategy: win with minimum force. Pass if partner winning.
 */
export function selectFollowPlay(
  context: BotPlayContext,
  options?: {
    partnerWinning?: boolean;
    opponentTichuCalled?: boolean;
    randomFactor?: number;
    randomSource?: () => number;
  },
): { action: 'play'; combo: Combination } | { action: 'pass' } {
  const { validPlays, canPass, hand } = context;

  // Random factor
  if (options?.randomFactor && options?.randomSource) {
    if (options.randomSource() < options.randomFactor) {
      if (validPlays.length > 0) {
        const idx = Math.floor(options.randomSource() * validPlays.length);
        return { action: 'play', combo: validPlays[idx] };
      }
      if (canPass) return { action: 'pass' };
    }
  }

  if (validPlays.length === 0) {
    return { action: 'pass' };
  }

  // Can go out? Always play.
  for (const combo of validPlays) {
    if (canGoOut(hand, combo)) {
      return { action: 'play', combo };
    }
  }

  // Partner winning? Pass (unless we can't).
  if (options?.partnerWinning && canPass) {
    return { action: 'pass' };
  }

  // Play the lowest winning combination
  const ranked = rankCombinationsForFollow(validPlays);
  return { action: 'play', combo: ranked[0] };
}

/**
 * Determine if a bomb should be played right now.
 * Returns true when: opponent about to go out (1-2 cards), opponent called Tichu.
 */
export function shouldPlayBomb(
  roundState: RoundState,
  seat: Seat,
  bombs: Combination[],
): boolean {
  if (bombs.length === 0) return false;

  const myTeam = getTeam(seat);

  // Check if any opponent has very few cards (about to go out)
  for (const s of SEATS_IN_ORDER) {
    if (getTeam(s) === myTeam) continue;
    if (roundState.players[s].finishOrder !== null) continue;
    if (roundState.players[s].hand.length <= 2) return true;
  }

  // Check if any opponent called Tichu and is close to going out
  for (const s of SEATS_IN_ORDER) {
    if (getTeam(s) === myTeam) continue;
    if (roundState.players[s].finishOrder !== null) continue;
    const call = roundState.players[s].tipiCall;
    if ((call === 'tichu' || call === 'grandTichu') && roundState.players[s].hand.length <= 4) {
      return true;
    }
  }

  return false;
}

// ─── State Analysis ─────────────────────────────────────────────────────────

/**
 * Get opponents who have called Tichu or Grand Tichu.
 */
export function getOpponentTichuCallers(
  roundState: RoundState,
  seat: Seat,
): Seat[] {
  const myTeam = getTeam(seat);
  return SEATS_IN_ORDER.filter((s) => {
    if (getTeam(s) === myTeam) return false;
    const call = roundState.players[s].tipiCall;
    return call === 'tichu' || call === 'grandTichu';
  });
}

/**
 * Get hand sizes for all players (human-available information).
 */
export function getHandSizes(roundState: RoundState): Record<Seat, number> {
  return {
    north: roundState.players.north.hand.length,
    east: roundState.players.east.hand.length,
    south: roundState.players.south.hand.length,
    west: roundState.players.west.hand.length,
  };
}

/**
 * Check if the game is in endgame (2 or fewer active players).
 */
export function isEndgame(roundState: RoundState): boolean {
  const active = SEATS_IN_ORDER.filter(
    (s) => roundState.players[s].finishOrder === null,
  );
  return active.length <= 2;
}

/**
 * Select the best Mahjong wish rank.
 * Wishes for a mid-rank (7-10) that the bot doesn't have.
 * Returns null if no good wish candidate.
 */
export function selectMahjongWish(hand: GameCard[]): Rank | null {
  // Ranks we have in hand
  const haveRanks = new Set<number>();
  for (const gc of hand) {
    if (gc.card.kind === 'standard') {
      haveRanks.add(gc.card.rank);
    }
  }

  // Wish for a mid-range rank we don't have (disrupts opponent straights)
  const wishCandidates: Rank[] = [8, 9, 7, 10, 6] as Rank[];
  for (const rank of wishCandidates) {
    if (!haveRanks.has(rank)) {
      return rank;
    }
  }

  return null;
}

/**
 * Select Dragon gift recipient — give to opponent with most cards remaining.
 */
export function selectDragonRecipient(
  opponents: Seat[],
  roundState: RoundState | null,
): Seat {
  if (!roundState || opponents.length <= 1) {
    return opponents[0];
  }

  // Give to the opponent with the most cards (most likely to go out last)
  let maxCards = -1;
  let recipient = opponents[0];
  for (const opp of opponents) {
    const cards = roundState.players[opp].hand.length;
    if (cards > maxCards) {
      maxCards = cards;
      recipient = opp;
    }
  }
  return recipient;
}
