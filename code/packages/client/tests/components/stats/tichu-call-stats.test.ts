import { describe, expect, it } from 'vitest';
import { getTichuCallStats } from '../../../src/components/stats/tichu-call-stats';
import type { PlayerProfile } from '../../../src/components/stats/stats-types';

describe('tichu call stats', () => {
  it('orders call types by ascending wager value', () => {
    const profile = {
      tichuCalls: 3,
      tichuSuccesses: 2,
      grandTichuCalls: 5,
      grandTichuSuccesses: 4,
      blindGrandTichuCalls: 7,
      blindGrandTichuSuccesses: 6,
    } as PlayerProfile;

    expect(getTichuCallStats(profile)).toEqual([
      { label: 'Tichu', successes: 2, calls: 3 },
      { label: 'Grand Tichu', successes: 4, calls: 5 },
      { label: 'Blind Grand', successes: 6, calls: 7 },
    ]);
  });
});
