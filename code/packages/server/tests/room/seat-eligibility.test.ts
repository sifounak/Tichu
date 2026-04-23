// Verifies: REQ-F-SJ01, SJ03, SJ04, SJ05, SJ06 (a, b, c), SJ02 contract.

import { describe, it, expect } from 'vitest';
import type { Seat } from '@tichu/shared';
import {
  validateClaim,
  isClaimValidationActive,
  type SeatOccupant,
} from '../../src/room/seat-eligibility.js';

function occupants(overrides: Partial<Record<Seat, SeatOccupant>> = {}): Record<Seat, SeatOccupant> {
  const base: Record<Seat, SeatOccupant> = {
    north: { empty: true, isBot: false },
    east: { empty: true, isBot: false },
    south: { empty: true, isBot: false },
    west: { empty: true, isBot: false },
  };
  return { ...base, ...overrides };
}

describe('validateClaim (REQ-F-SJ01–SJ06)', () => {
  // REQ-F-SJ01 / SJ03
  it('allows any claim when user has no prior seat (pre-deal / fresh join)', () => {
    const result = validateClaim(null, 'north', occupants());
    expect(result).toEqual({ kind: 'allowed' });
  });

  // REQ-F-SJ04: reclaim empty original seat → allowed
  it('allows reclaim of original seat when empty', () => {
    const result = validateClaim('north', 'north', occupants({
      north: { empty: true, isBot: false },
    }));
    expect(result).toEqual({ kind: 'allowed' });
  });

  // REQ-F-SJ04: reclaim bot-held original seat → allowed (bot displaced)
  it('allows reclaim of original seat when held by a bot', () => {
    const result = validateClaim('east', 'east', occupants({
      east: { empty: false, isBot: true, displayName: 'Bot-1' },
    }));
    expect(result).toEqual({ kind: 'allowed' });
  });

  // REQ-F-SJ05: original seat held by human → rejected, names occupant
  it('rejects reclaim when original seat is held by another human', () => {
    const result = validateClaim('south', 'south', occupants({
      south: { empty: false, isBot: false, displayName: 'Alice' },
    }));
    expect(result.kind).toBe('rejected');
    if (result.kind === 'rejected') {
      expect(result.originalSeat).toBe('south');
      expect(result.requestedSeat).toBe('south');
      expect(result.currentOccupantDisplayName).toBe('Alice');
      expect(result.offerClaimOriginal).toBe(false);
      expect(result.reason).toContain('Alice');
      expect(result.reason).toContain('south');
    }
  });

  // REQ-F-SJ05: falls back to generic label when no display name provided
  it('falls back to "another player" when human occupant has no display name', () => {
    const result = validateClaim('west', 'west', occupants({
      west: { empty: false, isBot: false },
    }));
    expect(result.kind).toBe('rejected');
    if (result.kind === 'rejected') {
      expect(result.reason).toContain('another player');
      expect(result.currentOccupantDisplayName).toBeNull();
    }
  });

  // REQ-F-SJ06a: cross-seat claim, original seat empty → rejected with claim-original offer
  it('rejects cross-seat claim and offers reclaim when original seat is empty (SJ06a)', () => {
    const result = validateClaim('north', 'east', occupants({
      north: { empty: true, isBot: false },
      east: { empty: true, isBot: false },
    }));
    expect(result.kind).toBe('rejected');
    if (result.kind === 'rejected') {
      expect(result.originalSeat).toBe('north');
      expect(result.requestedSeat).toBe('east');
      expect(result.offerClaimOriginal).toBe(true);
      expect(result.currentOccupantDisplayName).toBeNull();
      expect(result.reason).toContain('already seen');
      expect(result.reason).toContain('north');
      expect(result.reason).toContain('reclaim');
    }
  });

  // REQ-F-SJ06b: cross-seat claim, original seat held by human → rejected, names human, no offer
  it('rejects cross-seat claim and names human occupant when original seat is held (SJ06b)', () => {
    const result = validateClaim('north', 'south', occupants({
      north: { empty: false, isBot: false, displayName: 'Bob' },
      south: { empty: true, isBot: false },
    }));
    expect(result.kind).toBe('rejected');
    if (result.kind === 'rejected') {
      expect(result.originalSeat).toBe('north');
      expect(result.requestedSeat).toBe('south');
      expect(result.offerClaimOriginal).toBe(false);
      expect(result.currentOccupantDisplayName).toBe('Bob');
      expect(result.reason).toContain('Bob');
      expect(result.reason).toContain('already seen');
    }
  });

  // REQ-F-SJ06c: cross-seat claim, original seat held by bot → rejected with claim-original offer
  it('rejects cross-seat claim and offers reclaim when original seat is bot-held (SJ06c)', () => {
    const result = validateClaim('west', 'east', occupants({
      west: { empty: false, isBot: true, displayName: 'Bot-2' },
      east: { empty: true, isBot: false },
    }));
    expect(result.kind).toBe('rejected');
    if (result.kind === 'rejected') {
      expect(result.originalSeat).toBe('west');
      expect(result.requestedSeat).toBe('east');
      expect(result.offerClaimOriginal).toBe(true);
      expect(result.currentOccupantDisplayName).toBeNull();
    }
  });

  // Exhaustive sanity check: original seat is used in message whether empty or bot-held
  it.each([
    ['empty', { empty: true, isBot: false } as SeatOccupant],
    ['bot', { empty: false, isBot: true, displayName: 'Bot' } as SeatOccupant],
  ])('cross-seat rejection offers reclaim when original is %s', (_label, originalOccupant) => {
    const result = validateClaim('north', 'south', occupants({
      north: originalOccupant,
    }));
    expect(result.kind).toBe('rejected');
    if (result.kind === 'rejected') {
      expect(result.offerClaimOriginal).toBe(true);
    }
  });
});

describe('isClaimValidationActive (REQ-F-SJ01)', () => {
  it('returns false when no game is in progress', () => {
    expect(isClaimValidationActive({
      gameInProgress: false,
      currentRoundNumber: null,
      finishedRoundCount: 0,
    })).toBe(false);
  });

  it('returns false when game is in progress but no round dealt', () => {
    expect(isClaimValidationActive({
      gameInProgress: true,
      currentRoundNumber: null,
      finishedRoundCount: 0,
    })).toBe(false);
  });

  it('returns true once the first round is dealt', () => {
    expect(isClaimValidationActive({
      gameInProgress: true,
      currentRoundNumber: 1,
      finishedRoundCount: 0,
    })).toBe(true);
  });

  it('returns true after some rounds have finished', () => {
    expect(isClaimValidationActive({
      gameInProgress: true,
      currentRoundNumber: 3,
      finishedRoundCount: 2,
    })).toBe(true);
  });

  it('returns true when between rounds (currentRoundNumber null but finished > 0)', () => {
    expect(isClaimValidationActive({
      gameInProgress: true,
      currentRoundNumber: null,
      finishedRoundCount: 1,
    })).toBe(true);
  });
});
