// Verifies: REQ-F-PS04. Public filter vocabulary and participant classification.
import { describe, it, expect } from 'vitest';
import { PARTICIPATION_VIEWS, classifyParticipation, parseParticipation } from '../../src/types/stats.js';

describe('Participation types', () => {
  it.each(PARTICIPATION_VIEWS)('accepts %s as an API filter', view => {
    expect(parseParticipation(view)).toBe(view);
  });
  it('preserves the all-game API default and rejects unknown query values', () => {
    expect(parseParticipation(undefined)).toBe('all');
    for (const value of ['bots', '', null, ['all'], 1]) expect(parseParticipation(value)).toBeUndefined();
  });
  it('keeps human-only games human-only through human replacements', () => {
    expect(classifyParticipation({ humanUserIds: ['a','b','c','d','e'], hadBot: false, inferred: false })).toBe('human-only');
  });
  it('distinguishes solo from mixed using distinct humans, including a bot replacing one of four humans', () => {
    expect(classifyParticipation({ humanUserIds: ['a','a'], hadBot: true, inferred: true })).toBe('solo');
    expect(classifyParticipation({ humanUserIds: ['a','b'], hadBot: true, inferred: false })).toBe('mixed');
    expect(classifyParticipation({ humanUserIds: ['a','b','c','d'], hadBot: true, inferred: false })).toBe('mixed');
  });
});
