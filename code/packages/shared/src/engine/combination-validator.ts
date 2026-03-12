// REQ-F-CB02: Combination comparison and ranking
// REQ-F-CB03: Dragon only as single
// REQ-F-CB04: Dog only as lead

import type { Combination } from '../types/combination.js';
import { CombinationType } from '../types/combination.js';

/**
 * REQ-F-CB02: Determine if a play can beat the current top of the trick.
 *
 * Rules:
 * - If currentTop is null, any combination can be played (leading)
 * - Same type + same length + higher rank beats
 * - Bombs beat everything; higher bombs beat lower bombs
 * - Straight flush > four-of-a-kind (both are bombs)
 * - Among straight flush bombs: longer wins; if same length, higher rank wins
 * - Dog cannot beat anything (it's a lead-only special action)
 */
export function canBeat(play: Combination, currentTop: Combination | null): boolean {
  // Leading: any combination is valid
  if (currentTop === null) return true;

  // Dog cannot beat anything
  if (play.type === CombinationType.Single && play.rank === 0) return false;

  // Bomb beats non-bomb
  if (play.isBomb && !currentTop.isBomb) return true;

  // Non-bomb cannot beat bomb
  if (!play.isBomb && currentTop.isBomb) return false;

  // Both are bombs: compare bomb rankings
  if (play.isBomb && currentTop.isBomb) {
    return compareBombs(play, currentTop);
  }

  // Neither is a bomb: must be same type and same length
  if (play.type !== currentTop.type) return false;
  if (play.length !== currentTop.length) return false;

  // Higher rank wins
  return play.rank > currentTop.rank;
}

/**
 * Compare two bombs. Returns true if `play` beats `currentTop`.
 *
 * Bomb ranking:
 * 1. Straight flush > four-of-a-kind
 * 2. Among straight flushes: longer wins, then higher rank
 * 3. Among four-of-a-kind: higher rank wins
 */
function compareBombs(play: Combination, currentTop: Combination): boolean {
  // Straight flush beats four-of-a-kind
  if (
    play.type === CombinationType.StraightFlushBomb &&
    currentTop.type === CombinationType.FourBomb
  ) {
    return true;
  }
  if (
    play.type === CombinationType.FourBomb &&
    currentTop.type === CombinationType.StraightFlushBomb
  ) {
    return false;
  }

  // Same bomb type
  if (
    play.type === CombinationType.StraightFlushBomb &&
    currentTop.type === CombinationType.StraightFlushBomb
  ) {
    // Longer straight flush wins
    if (play.length !== currentTop.length) {
      return play.length > currentTop.length;
    }
    // Same length: higher rank wins
    return play.rank > currentTop.rank;
  }

  // Both four-of-a-kind: higher rank wins
  return play.rank > currentTop.rank;
}

/**
 * REQ-F-CB02: Get the overall power rank of a combination for ordering.
 * Used for general comparison (not for canBeat — use canBeat for trick logic).
 *
 * Non-bombs get a base score from their type/rank.
 * Bombs get much higher scores.
 */
export function getRankOrder(combination: Combination): number {
  if (!combination.isBomb) {
    return combination.rank;
  }

  // Bombs: base 1000 for four-bomb, 2000 for straight flush
  if (combination.type === CombinationType.FourBomb) {
    return 1000 + combination.rank;
  }
  // Straight flush bomb: 2000 + length * 100 + rank
  return 2000 + combination.length * 100 + combination.rank;
}

/**
 * Check if a combination is a bomb.
 */
export function isBomb(combination: Combination): boolean {
  return combination.isBomb;
}
