// Verifies: REQ-F-SJ07 — uiStore slice for server-sent SEAT_CLAIM_REJECTED payloads
import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from '@/stores/uiStore';

describe('uiStore seatClaimRejection slice (REQ-F-SJ07)', () => {
  beforeEach(() => {
    useUiStore.setState({ seatClaimRejection: null });
  });

  it('starts null', () => {
    expect(useUiStore.getState().seatClaimRejection).toBeNull();
  });

  it('setSeatClaimRejection stores the server payload verbatim', () => {
    const payload = {
      reason: 'example reason',
      originalSeat: 'north' as const,
      requestedSeat: 'east' as const,
      currentOccupant: { displayName: 'Alice' },
      offerClaimOriginal: true,
    };
    useUiStore.getState().setSeatClaimRejection(payload);
    expect(useUiStore.getState().seatClaimRejection).toEqual(payload);
  });

  it('clearSeatClaimRejection resets to null', () => {
    useUiStore.getState().setSeatClaimRejection({
      reason: 'r',
      originalSeat: 'south',
      requestedSeat: 'west',
      currentOccupant: null,
      offerClaimOriginal: false,
    });
    useUiStore.getState().clearSeatClaimRejection();
    expect(useUiStore.getState().seatClaimRejection).toBeNull();
  });

  it('a subsequent setSeatClaimRejection call replaces the prior payload', () => {
    useUiStore.getState().setSeatClaimRejection({
      reason: 'first',
      originalSeat: 'north',
      requestedSeat: 'east',
      currentOccupant: null,
      offerClaimOriginal: true,
    });
    useUiStore.getState().setSeatClaimRejection({
      reason: 'second',
      originalSeat: 'west',
      requestedSeat: 'south',
      currentOccupant: { displayName: 'Bob' },
      offerClaimOriginal: false,
    });
    const current = useUiStore.getState().seatClaimRejection;
    expect(current?.reason).toBe('second');
    expect(current?.originalSeat).toBe('west');
    expect(current?.offerClaimOriginal).toBe(false);
  });
});
