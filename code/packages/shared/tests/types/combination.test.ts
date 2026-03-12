// Verifies: REQ-F-CB01 — All combination types defined

import { describe, it, expect } from 'vitest';
import { CombinationType } from '../../src/types/combination.js';

describe('CombinationType enum', () => {
  it('has all 8 combination types', () => {
    expect(Object.values(CombinationType)).toHaveLength(8);
  });

  it('has correct values', () => {
    expect(CombinationType.Single).toBe('single');
    expect(CombinationType.Pair).toBe('pair');
    expect(CombinationType.Triple).toBe('triple');
    expect(CombinationType.FullHouse).toBe('fullHouse');
    expect(CombinationType.Straight).toBe('straight');
    expect(CombinationType.PairSequence).toBe('pairSequence');
    expect(CombinationType.FourBomb).toBe('fourBomb');
    expect(CombinationType.StraightFlushBomb).toBe('straightFlushBomb');
  });
});
