// REQ-F-HV01: Progressive card filtering
// REQ-F-HV02: Dragon/Dog disables all others
// REQ-F-HV03: Dog disabled when trick active
// REQ-F-HV04: Phoenix disabled if would form bomb
// REQ-F-HV05: Prefix matching for partial selections

import type { GameCard, Rank, CardId } from '../types/card.js';
import { isPhoenix, isDragon, isDog, isMahjong, isStandard } from '../types/card.js';
import type { Combination } from '../types/combination.js';
import type { TrickState } from '../types/game.js';
import { CombinationType } from '../types/combination.js';
import { detectCombination } from './combination-detector.js';
import { canBeat } from './combination-validator.js';

/**
 * REQ-F-HV01: Determine which cards in the hand remain selectable
 * given the current selection, trick state, and active wish.
 *
 * Returns a Set of CardIds that the player may still click/select.
 */
export function getSelectableCards(
  hand: GameCard[],
  selected: GameCard[],
  currentTrick: TrickState | null,
  wish: number | null,
): Set<CardId> {
  const selectable = new Set<CardId>();
  const selectedIds = new Set(selected.map((gc) => gc.id));
  const remaining = hand.filter((gc) => !selectedIds.has(gc.id));

  // --- Phase 1: Nothing selected ---
  if (selected.length === 0) {
    return getInitialSelectableCards(hand, currentTrick, wish);
  }

  // --- REQ-F-HV02: Dragon or Dog selected → all others disabled ---
  if (selected.length === 1 && (isDragon(selected[0].card) || isDog(selected[0].card))) {
    return selectable; // empty — no more cards can be added
  }

  // --- Phase 2: Cards already selected ---
  const currentTop = getTrickTopCombination(currentTrick);

  for (const candidate of remaining) {
    const candidates = [...selected, candidate];

    // REQ-F-HV04: Phoenix disabled if adding it would form a bomb
    if (isPhoenix(candidate.card) && wouldFormBomb(candidates)) {
      continue;
    }

    // REQ-F-HV02: Dragon/Dog cannot be added to multi-card selections
    if (isDragon(candidate.card) || isDog(candidate.card)) {
      continue;
    }

    // Check if candidates form a valid playable combination
    if (canFormValidCombination(candidates, currentTop)) {
      selectable.add(candidate.id);
      continue;
    }

    // Check if candidates could be a valid prefix of a final play
    if (canFormValidPrefix(candidates, currentTop)) {
      selectable.add(candidate.id);
      continue;
    }
  }

  return selectable;
}

/**
 * Phase 1: When nothing is selected, determine which cards can start a selection.
 */
function getInitialSelectableCards(
  hand: GameCard[],
  currentTrick: TrickState | null,
  wish: number | null,
): Set<CardId> {
  const selectable = new Set<CardId>();
  const currentTop = getTrickTopCombination(currentTrick);

  // If wish is active, check if player can fulfill it
  const mustFulfillWish = wish !== null && canFulfillWish(hand, wish, currentTop);

  for (const gc of hand) {
    // REQ-F-HV03: Dog disabled when trick is active (can only lead)
    if (isDog(gc.card) && currentTrick !== null && currentTrick.plays.length > 0) {
      continue;
    }

    // If wish is active and fulfillable, only allow cards that can participate
    // in wish-fulfilling plays
    if (mustFulfillWish) {
      if (canParticipateInWishPlay(gc, hand, wish!, currentTop)) {
        selectable.add(gc.id);
      }
      continue;
    }

    selectable.add(gc.id);
  }

  return selectable;
}

/**
 * REQ-F-HV05: Check if a set of cards is a valid prefix of some combination
 * that could eventually beat the current trick (or lead).
 *
 * A prefix is valid if the selected cards could be a SUBSET of some valid
 * final play. Additional cards from the hand may still be added.
 */
export function canFormValidPrefix(
  candidates: GameCard[],
  currentTop: Combination | null,
): boolean {
  if (candidates.length === 0) return false;

  const hasPhoenix = candidates.some((gc) => isPhoenix(gc.card));
  const hasDragon = candidates.some((gc) => isDragon(gc.card));
  const hasDog = candidates.some((gc) => isDog(gc.card));

  // Dragon and Dog are solo-only; they can't be in multi-card prefixes
  if (hasDragon || hasDog) return false;

  const hasMahjong = candidates.some((gc) => isMahjong(gc.card));

  // Get ranks of non-Phoenix cards
  const ranks: number[] = [];
  for (const gc of candidates) {
    if (isStandard(gc.card)) ranks.push(gc.card.rank);
    else if (isMahjong(gc.card)) ranks.push(1);
  }

  const distinctRanks = [...new Set(ranks)].sort((a, b) => a - b);
  const numNonPhoenix = ranks.length;

  // Count occurrences of each rank
  const rankCounts = new Map<number, number>();
  for (const r of ranks) {
    rankCounts.set(r, (rankCounts.get(r) ?? 0) + 1);
  }

  // --- Prefix: all same rank → could be pair, triple, full house ---
  if (distinctRanks.length === 1 && numNonPhoenix >= 1) {
    if (isCompatibleWithTrick(currentTop, 'sameRank')) return true;
  }

  // --- Prefix: ranks fit within a straight window (span ≤ 13, no dup ranks) ---
  if (distinctRanks.length >= 2 && couldBePartOfStraight(distinctRanks)) {
    if (isCompatibleWithTrick(currentTop, 'straight')) return true;
  }

  // --- Prefix: consecutive ranks → could also be pair sequence ---
  // For pair sequence prefix: consecutive distinct ranks, each count ≤ 2
  if (distinctRanks.length >= 2 && areStrictlyConsecutive(distinctRanks)) {
    const maxCount = Math.max(...rankCounts.values());
    if (maxCount <= 2) {
      if (isCompatibleWithTrick(currentTop, 'pairSequence')) return true;
    }
  }

  // --- Prefix: 2 distinct ranks, compatible counts → could be full house ---
  if (distinctRanks.length === 2) {
    const counts = [...rankCounts.values()].sort((a, b) => a - b);
    // Max 3 of one rank, max 2 of the other
    if (counts[0] <= 2 && counts[1] <= 3) {
      if (isCompatibleWithTrick(currentTop, 'fullHouse')) return true;
    }
  }

  // --- Prefix: all same suit + consecutive → could be straight flush bomb ---
  if (allSameSuitConsecutive(candidates)) {
    return true; // Bombs always valid
  }

  // --- Prefix: all same rank, count >= 3 (no Phoenix) → could be four-bomb ---
  if (
    !hasPhoenix &&
    distinctRanks.length === 1 &&
    numNonPhoenix >= 3 &&
    !hasMahjong
  ) {
    return true; // Could become four-of-a-kind bomb
  }

  return false;
}

/**
 * Check if a set of cards forms a valid combination that can beat the current trick.
 */
export function canFormValidCombination(
  candidates: GameCard[],
  currentTop: Combination | null,
): boolean {
  const combo = detectCombination(candidates);
  if (combo === null) return false;

  // Dog can only lead
  if (
    combo.type === CombinationType.Single &&
    combo.rank === 0 &&
    currentTop !== null
  ) {
    return false;
  }

  return canBeat(combo, currentTop);
}

// --- Helpers ---

/** Extract the top combination from the current trick */
function getTrickTopCombination(trick: TrickState | null): Combination | null {
  if (!trick || trick.plays.length === 0) return null;
  return trick.plays[trick.plays.length - 1].combination;
}

/** Check if distinct sorted ranks are strictly consecutive (no gaps) */
function areStrictlyConsecutive(sortedDistinct: number[]): boolean {
  for (let i = 1; i < sortedDistinct.length; i++) {
    if (sortedDistinct[i] - sortedDistinct[i - 1] !== 1) return false;
  }
  return true;
}

/**
 * Check if distinct ranks could all fit within a single straight (5-14 consecutive).
 * The span between min and max must be ≤ 13 (max straight is 1-14),
 * and no rank can be outside [1, 14].
 */
function couldBePartOfStraight(sortedDistinct: number[]): boolean {
  const min = sortedDistinct[0];
  const max = sortedDistinct[sortedDistinct.length - 1];
  if (min < 1 || max > 14) return false;
  // The span must allow a straight of at least 5 cards containing all these ranks
  return max - min <= 13;
}

/** Check if all cards are same suit and consecutive ranks (straight flush bomb prefix) */
function allSameSuitConsecutive(candidates: GameCard[]): boolean {
  if (candidates.length < 2) return false;
  const standards = candidates.filter((gc) => isStandard(gc.card));
  if (standards.length !== candidates.length) return false;

  const suits = standards.map((gc) => (gc.card as { suit: string }).suit);
  if (new Set(suits).size !== 1) return false;

  const ranks = standards
    .map((gc) => (gc.card as { rank: Rank }).rank)
    .sort((a, b) => a - b);
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] - ranks[i - 1] !== 1) return false;
  }
  return true;
}

/**
 * Check if the prefix type is compatible with the current trick constraint.
 * If there's no trick (leading), anything is compatible.
 * If there's a trick, the prefix must be able to form the same type (or a bomb).
 */
function isCompatibleWithTrick(
  currentTop: Combination | null,
  prefixType: 'sameRank' | 'straight' | 'pairSequence' | 'fullHouse',
): boolean {
  if (currentTop === null) return true; // Leading — anything goes

  // Bombs are always compatible (they beat anything)
  // A same-rank prefix of 3+ could become a four-bomb
  // A same-suit consecutive prefix could become a straight flush bomb
  // These are handled by the caller checking bomb prefixes separately

  switch (currentTop.type) {
    case CombinationType.Single:
      return prefixType === 'sameRank'; // building toward single (1 card), or pair/triple
    case CombinationType.Pair:
      return prefixType === 'sameRank' || prefixType === 'pairSequence';
    case CombinationType.Triple:
      return prefixType === 'sameRank';
    case CombinationType.FullHouse:
      return prefixType === 'fullHouse' || prefixType === 'sameRank';
    case CombinationType.Straight:
      return prefixType === 'straight';
    case CombinationType.PairSequence:
      return prefixType === 'pairSequence';
    case CombinationType.FourBomb:
    case CombinationType.StraightFlushBomb:
      // Must beat with a higher bomb
      return true; // Any bomb prefix is potentially valid
  }
}

/**
 * Check if adding Phoenix would form a bomb (REQ-F-HV04).
 * Since detectCombination prevents Phoenix from forming bombs (returns null),
 * we check the structural pattern: Phoenix + 3 same rank = would-be four-bomb,
 * Phoenix + 4+ same-suit consecutive = would-be straight flush bomb.
 */
function wouldFormBomb(candidates: GameCard[]): boolean {
  // First check if detectCombination returns a bomb (shouldn't happen with Phoenix, but safe)
  const combo = detectCombination(candidates);
  if (combo !== null && combo.isBomb) return true;

  const nonPhoenix = candidates.filter((gc) => !isPhoenix(gc.card));
  const standards = nonPhoenix.filter((gc) => isStandard(gc.card));

  // Would-be four-of-a-kind bomb: 3 cards of same rank + Phoenix
  if (standards.length === 3) {
    const ranks = standards.map((gc) => (gc.card as { rank: Rank }).rank);
    if (new Set(ranks).size === 1) return true;
  }

  // Would-be straight flush bomb: 4+ same-suit consecutive + Phoenix fills gap/extends
  if (standards.length >= 4) {
    const suits = standards.map((gc) => (gc.card as { suit: string }).suit);
    if (new Set(suits).size === 1) {
      const ranks = standards
        .map((gc) => (gc.card as { rank: Rank }).rank)
        .sort((a, b) => a - b);
      const span = ranks[ranks.length - 1] - ranks[0] + 1;
      // All consecutive, or one gap fillable by Phoenix
      if (span === standards.length || span === standards.length + 1) return true;
    }
  }

  return false;
}

/**
 * Check if the player can fulfill the active wish with any valid play.
 */
function canFulfillWish(
  hand: GameCard[],
  wish: number,
  currentTop: Combination | null,
): boolean {
  // Check if the player has the wished rank
  const hasWishedRank = hand.some(
    (gc) => isStandard(gc.card) && gc.card.rank === wish,
  );
  if (!hasWishedRank) return false;

  // Check if there's at least one valid play containing the wished rank
  return hasValidPlayWithRank(hand, wish, currentTop);
}

/**
 * Check if any valid play from the hand includes a card of the given rank.
 */
function hasValidPlayWithRank(
  hand: GameCard[],
  rank: number,
  currentTop: Combination | null,
): boolean {
  const wishedCards = hand.filter(
    (gc) => isStandard(gc.card) && gc.card.rank === rank,
  );

  for (const wishedCard of wishedCards) {
    // Single
    const singleCombo = detectCombination([wishedCard]);
    if (singleCombo && canBeat(singleCombo, currentTop)) return true;

    // Try pairs, triples, etc. with this card
    const sameRank = hand.filter(
      (gc) => gc.id !== wishedCard.id && isStandard(gc.card) && gc.card.rank === rank,
    );
    const phoenix = hand.find((gc) => isPhoenix(gc.card));

    // Pair
    for (const other of sameRank) {
      const combo = detectCombination([wishedCard, other]);
      if (combo && canBeat(combo, currentTop)) return true;
    }
    if (phoenix) {
      const combo = detectCombination([wishedCard, phoenix]);
      if (combo && canBeat(combo, currentTop)) return true;
    }

    // For straights: check if the wished rank can be part of any 5+ card straight
    if (canFormStraightWithRank(hand, rank, currentTop)) return true;
  }

  return false;
}

/**
 * Check if a card can participate in a wish-fulfilling play.
 */
function canParticipateInWishPlay(
  gc: GameCard,
  hand: GameCard[],
  wish: number,
  currentTop: Combination | null,
): boolean {
  // The wished card itself always participates
  if (isStandard(gc.card) && gc.card.rank === wish) return true;

  // Phoenix can participate (as part of a combination with the wished rank)
  if (isPhoenix(gc.card)) {
    // Check if Phoenix + wished card(s) forms a valid play
    const wishedCards = hand.filter(
      (gc2) => isStandard(gc2.card) && gc2.card.rank === wish,
    );
    for (const wc of wishedCards) {
      const combo = detectCombination([wc, gc]);
      if (combo && canBeat(combo, currentTop)) return true;
    }
  }

  // Cards of the same rank (for pairs, triples with wished cards)
  if (isStandard(gc.card) && gc.card.rank === wish) return true;

  // Cards that could be in a straight with the wished rank
  // This is a broader check — any card near the wished rank
  if (isStandard(gc.card) || isMahjong(gc.card)) {
    const cardRank = isMahjong(gc.card) ? 1 : (gc.card as { rank: Rank }).rank;
    // A straight needs 5+ consecutive cards, so the card must be within 4 of the wish
    if (Math.abs(cardRank - wish) <= 4) {
      // More detailed: check if there's actually a straight possible
      return true; // Conservatively allow nearby cards
    }
  }

  // Bombs are always allowed (they don't need to fulfill the wish)
  // A card that could be part of a bomb should remain selectable
  const standards = hand.filter((gc2) => isStandard(gc2.card));
  if (isStandard(gc.card)) {
    const sameRank = standards.filter(
      (gc2) => (gc2.card as { rank: Rank }).rank === (gc.card as { rank: Rank }).rank,
    );
    if (sameRank.length === 4) return true; // Could be four-bomb
  }

  return false;
}

/**
 * Check if the hand can form any straight containing the given rank.
 */
function canFormStraightWithRank(
  hand: GameCard[],
  rank: number,
  currentTop: Combination | null,
): boolean {
  // Get all available ranks
  const availableRanks = new Set<number>();
  const hasPhoenix = hand.some((gc) => isPhoenix(gc.card));

  for (const gc of hand) {
    if (isStandard(gc.card)) availableRanks.add(gc.card.rank);
    if (isMahjong(gc.card)) availableRanks.add(1);
  }

  // Try all possible straights of length 5+ containing the target rank
  const minStart = Math.max(1, rank - 13); // Straights max length 14
  const maxStart = rank; // Target rank must be >= start

  for (let start = minStart; start <= maxStart; start++) {
    for (let len = 5; len <= 14; len++) {
      const end = start + len - 1;
      if (end > 14) break;
      if (rank < start || rank > end) continue;

      // Check if we have enough cards for this straight
      let gaps = 0;
      let possible = true;
      for (let r = start; r <= end; r++) {
        if (!availableRanks.has(r)) {
          gaps++;
          if (gaps > (hasPhoenix ? 1 : 0)) {
            possible = false;
            break;
          }
        }
      }

      if (possible) {
        // Build the straight and check if it beats
        const straightCards = buildStraight(hand, start, end, hasPhoenix);
        if (straightCards) {
          const combo = detectCombination(straightCards);
          if (combo && canBeat(combo, currentTop)) return true;
        }
      }
    }
  }
  return false;
}

/** Attempt to build a straight from start to end using hand cards */
function buildStraight(
  hand: GameCard[],
  start: number,
  end: number,
  hasPhoenix: boolean,
): GameCard[] | null {
  const cards: GameCard[] = [];
  let phoenixUsed = false;
  const phoenix = hand.find((gc) => isPhoenix(gc.card));

  for (let r = start; r <= end; r++) {
    const card = hand.find((gc) => {
      if (isStandard(gc.card) && gc.card.rank === r) return true;
      if (isMahjong(gc.card) && r === 1) return true;
      return false;
    });

    if (card) {
      cards.push(card);
    } else if (hasPhoenix && !phoenixUsed && phoenix) {
      cards.push(phoenix);
      phoenixUsed = true;
    } else {
      return null;
    }
  }

  return cards;
}
