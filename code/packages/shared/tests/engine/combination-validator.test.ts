// Verifies: REQ-F-CB02, REQ-F-CB03, REQ-F-CB04

import { describe, it, expect } from 'vitest';
import { canBeat, getRankOrder, isBomb } from '../../src/engine/combination-validator.js';
import { CombinationType } from '../../src/types/combination.js';
import type { Combination } from '../../src/types/combination.js';

// --- Helpers ---

function makeSingle(rank: number): Combination {
  return { type: CombinationType.Single, cards: [], rank, length: 1, isBomb: false };
}

function makePair(rank: number): Combination {
  return { type: CombinationType.Pair, cards: [], rank, length: 1, isBomb: false };
}

function makeTriple(rank: number): Combination {
  return { type: CombinationType.Triple, cards: [], rank, length: 1, isBomb: false };
}

function makeFullHouse(rank: number): Combination {
  return { type: CombinationType.FullHouse, cards: [], rank, length: 1, isBomb: false };
}

function makeStraight(rank: number, length: number): Combination {
  return { type: CombinationType.Straight, cards: [], rank, length, isBomb: false };
}

function makePairSeq(rank: number, numPairs: number): Combination {
  return { type: CombinationType.PairSequence, cards: [], rank, length: numPairs, isBomb: false };
}

function makeFourBomb(rank: number): Combination {
  return { type: CombinationType.FourBomb, cards: [], rank, length: 4, isBomb: true };
}

function makeSFBomb(rank: number, length: number): Combination {
  return { type: CombinationType.StraightFlushBomb, cards: [], rank, length, isBomb: true };
}

// --- Tests ---

describe('canBeat', () => {
  describe('leading (currentTop is null)', () => {
    it('any combination can lead', () => {
      expect(canBeat(makeSingle(5), null)).toBe(true);
      expect(canBeat(makePair(10), null)).toBe(true);
      expect(canBeat(makeFourBomb(8), null)).toBe(true);
    });
  });

  describe('same type, higher rank wins', () => {
    it('higher single beats lower single', () => {
      expect(canBeat(makeSingle(10), makeSingle(8))).toBe(true);
      expect(canBeat(makeSingle(8), makeSingle(10))).toBe(false);
    });

    it('equal rank does not beat', () => {
      expect(canBeat(makeSingle(8), makeSingle(8))).toBe(false);
    });

    it('higher pair beats lower pair', () => {
      expect(canBeat(makePair(12), makePair(10))).toBe(true);
      expect(canBeat(makePair(10), makePair(12))).toBe(false);
    });

    it('higher triple beats lower triple', () => {
      expect(canBeat(makeTriple(9), makeTriple(7))).toBe(true);
    });

    it('higher full house beats lower full house', () => {
      expect(canBeat(makeFullHouse(11), makeFullHouse(9))).toBe(true);
    });

    it('higher straight beats lower straight of same length', () => {
      expect(canBeat(makeStraight(10, 5), makeStraight(8, 5))).toBe(true);
    });

    it('straights of different lengths cannot beat each other', () => {
      expect(canBeat(makeStraight(14, 6), makeStraight(8, 5))).toBe(false);
    });

    it('higher pair sequence beats lower of same length', () => {
      expect(canBeat(makePairSeq(10, 3), makePairSeq(8, 3))).toBe(true);
    });

    it('pair sequences of different lengths cannot beat each other', () => {
      expect(canBeat(makePairSeq(14, 3), makePairSeq(8, 2))).toBe(false);
    });
  });

  describe('different types do not beat each other (non-bomb)', () => {
    it('pair does not beat single', () => {
      expect(canBeat(makePair(14), makeSingle(2))).toBe(false);
    });

    it('triple does not beat pair', () => {
      expect(canBeat(makeTriple(14), makePair(2))).toBe(false);
    });

    it('straight does not beat triple', () => {
      expect(canBeat(makeStraight(14, 5), makeTriple(2))).toBe(false);
    });
  });

  describe('bombs', () => {
    it('four-bomb beats any non-bomb', () => {
      expect(canBeat(makeFourBomb(2), makeSingle(14))).toBe(true);
      expect(canBeat(makeFourBomb(2), makePair(14))).toBe(true);
      expect(canBeat(makeFourBomb(2), makeStraight(14, 5))).toBe(true);
    });

    it('straight-flush bomb beats any non-bomb', () => {
      expect(canBeat(makeSFBomb(7, 5), makeStraight(14, 5))).toBe(true);
    });

    it('non-bomb cannot beat bomb', () => {
      expect(canBeat(makeSingle(14), makeFourBomb(2))).toBe(false);
      expect(canBeat(makeStraight(14, 5), makeFourBomb(2))).toBe(false);
    });

    it('higher four-bomb beats lower four-bomb', () => {
      expect(canBeat(makeFourBomb(10), makeFourBomb(8))).toBe(true);
      expect(canBeat(makeFourBomb(8), makeFourBomb(10))).toBe(false);
    });

    it('straight-flush bomb beats four-bomb', () => {
      expect(canBeat(makeSFBomb(7, 5), makeFourBomb(14))).toBe(true);
    });

    it('four-bomb does not beat straight-flush bomb', () => {
      expect(canBeat(makeFourBomb(14), makeSFBomb(3, 5))).toBe(false);
    });

    it('longer straight-flush bomb beats shorter', () => {
      expect(canBeat(makeSFBomb(8, 6), makeSFBomb(10, 5))).toBe(true);
    });

    it('same-length straight-flush: higher rank wins', () => {
      expect(canBeat(makeSFBomb(10, 5), makeSFBomb(8, 5))).toBe(true);
      expect(canBeat(makeSFBomb(8, 5), makeSFBomb(10, 5))).toBe(false);
    });
  });

  // REQ-F-CB04: Dog cannot beat anything
  describe('Dog', () => {
    it('Dog single (rank 0) cannot beat anything', () => {
      expect(canBeat(makeSingle(0), makeSingle(2))).toBe(false);
      expect(canBeat(makeSingle(0), makeSingle(1))).toBe(false);
    });

    it('Dog can lead (currentTop is null)', () => {
      expect(canBeat(makeSingle(0), null)).toBe(true);
    });
  });
});

describe('getRankOrder', () => {
  it('returns rank for non-bombs', () => {
    expect(getRankOrder(makeSingle(8))).toBe(8);
    expect(getRankOrder(makePair(10))).toBe(10);
  });

  it('returns high value for four-bombs', () => {
    expect(getRankOrder(makeFourBomb(8))).toBe(1008);
  });

  it('returns higher value for straight-flush bombs', () => {
    const sfOrder = getRankOrder(makeSFBomb(10, 5));
    const fourOrder = getRankOrder(makeFourBomb(14));
    expect(sfOrder).toBeGreaterThan(fourOrder);
  });

  it('longer straight-flush has higher order', () => {
    expect(getRankOrder(makeSFBomb(8, 6))).toBeGreaterThan(getRankOrder(makeSFBomb(10, 5)));
  });
});

describe('isBomb', () => {
  it('returns true for bombs', () => {
    expect(isBomb(makeFourBomb(8))).toBe(true);
    expect(isBomb(makeSFBomb(10, 5))).toBe(true);
  });

  it('returns false for non-bombs', () => {
    expect(isBomb(makeSingle(14))).toBe(false);
    expect(isBomb(makeStraight(14, 5))).toBe(false);
  });
});
