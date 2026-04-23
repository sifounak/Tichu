// Verifies: REQ-F-ES01–ES03, ES06-ES13, ES16, ES17, REQ-F-SJ08-SJ13
// (REQ-F-ES04/ES14 vote scheme superseded by passive grace period)
// Integration tests for the full empty seat filling pipeline

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DisconnectHandler } from '../../src/game/disconnect-handler.js';
import { SeatQueue, type SeatQueueCallbacks } from '../../src/room/seat-queue.js';
import type { Broadcaster } from '../../src/ws/broadcaster.js';
import type { Seat } from '@tichu/shared';

// ─── Shared mocks ──────────────────────────────────────────────────────────

function createMockBroadcaster(): Broadcaster {
  return {
    send: vi.fn().mockReturnValue(true),
    sendToPlayer: vi.fn().mockReturnValue(true),
    broadcastToRoom: vi.fn().mockReturnValue(3),
    broadcastGameState: vi.fn().mockReturnValue(4),
    broadcastToSpectators: vi.fn().mockReturnValue(0),
    sendError: vi.fn().mockReturnValue(true),
    sendSeatClaimRejected: vi.fn().mockReturnValue(true),
  } as unknown as Broadcaster;
}

function createQueueCallbacks(
  currentSpectators: string[] = [],
  opts: {
    ineligibleUsers?: Set<string>;
    ineligibleSeatsByUser?: Map<string, Set<Seat>>;
  } = {},
): SeatQueueCallbacks & {
  sendCalls: Array<{ userId: string; message: unknown }>;
  claimCalls: Array<{ userId: string; seat: Seat }>;
  filledCalls: string[];
  silentSkips: Array<{ roomCode: string; userId: string; availableSeats: Seat[] }>;
  rejectedClaims: string[];
} {
  const sendCalls: Array<{ userId: string; message: unknown }> = [];
  const claimCalls: Array<{ userId: string; seat: Seat }> = [];
  const filledCalls: string[] = [];
  const silentSkips: Array<{ roomCode: string; userId: string; availableSeats: Seat[] }> = [];
  const rejectedClaims: string[] = [];

  return {
    sendCalls,
    claimCalls,
    filledCalls,
    silentSkips,
    rejectedClaims,
    onSendToSpectator: (userId, message) => sendCalls.push({ userId, message }),
    onSeatClaimed: (userId, seat) => claimCalls.push({ userId, seat }),
    onAllSeatsFilled: (roomCode) => filledCalls.push(roomCode),
    onGetCurrentSpectators: () => [...currentSpectators],
    onCheckEligibility: (userId, seat) => {
      if (opts.ineligibleUsers?.has(userId)) return false;
      const seats = opts.ineligibleSeatsByUser?.get(userId);
      if (seats?.has(seat)) return false;
      return true;
    },
    onIneligibleFreeForAllClaim: (userId) => rejectedClaims.push(userId),
    onSilentSkip: (roomCode, userId, availableSeats) =>
      silentSkips.push({ roomCode, userId, availableSeats }),
  };
}

// ─── Integration tests ──────────────────────────────────────────────────────

describe('Empty Seat Flow — Integration', () => {
  let broadcaster: Broadcaster;
  let disconnectHandler: DisconnectHandler;

  beforeEach(() => {
    vi.useFakeTimers();
    broadcaster = createMockBroadcaster();
    disconnectHandler = new DisconnectHandler(broadcaster, { graceTimeoutMs: 5000 });
  });

  afterEach(() => {
    disconnectHandler.dispose();
    vi.useRealTimers();
  });

  // Verifies: REQ-F-ES03, ES06, ES07, ES16
  describe('explicit leave → queue → claim → resume', () => {
    it('should run full flow: leave triggers queue, spectator claims, queue completes', () => {
      const callbacks = createQueueCallbacks(['spec1', 'spec2']);
      const queue = new SeatQueue('ROOM1', callbacks);

      // Player leaves → seat vacated → queue starts
      queue.startQueue(['north'], ['spec1', 'spec2']);
      expect(queue.phase).toBe('offering');

      // spec1 gets offer
      const offer = callbacks.sendCalls.find(
        c => c.userId === 'spec1' && (c.message as any).type === 'SEAT_OFFERED',
      );
      expect(offer).toBeDefined();
      expect((offer!.message as any).seats).toEqual(['north']);

      // spec1 claims
      queue.handleClaim('spec1');
      expect(callbacks.claimCalls[0]).toEqual({ userId: 'spec1', seat: 'north' });
      expect(queue.phase).toBe('idle');
      expect(callbacks.filledCalls).toEqual(['ROOM1']);

      queue.cleanup();
    });
  });

  // Verifies: REQ-F-SJ12, SJ13 — grace expires → seat released → queue starts.
  describe('disconnect → grace expires → queue → claim → resume', () => {
    it('should run full flow: disconnect, grace times out, kicked seat enters queue', () => {
      const kickedSeats: Seat[] = [];

      disconnectHandler.onVoteResult = (_roomCode, outcome, seats) => {
        if (outcome === 'kick') {
          kickedSeats.push(...seats);
        }
      };

      // Player disconnects → passive grace starts.
      disconnectHandler.handleDisconnect('ROOM1', 'north');
      // Grace expires after the configured window (5s in this test).
      vi.advanceTimersByTime(5000);

      expect(kickedSeats).toEqual(['north']);

      // Now start queue for the released seat.
      const callbacks = createQueueCallbacks(['spec1']);
      const queue = new SeatQueue('ROOM1', callbacks);
      queue.startQueue(['north'], ['spec1']);

      queue.handleClaim('spec1');
      expect(callbacks.claimCalls[0]).toEqual({ userId: 'spec1', seat: 'north' });
      expect(queue.phase).toBe('idle');

      queue.cleanup();
    });
  });

  // Verifies: REQ-F-SJ12 — reconnect within grace restores the seat.
  describe('disconnect → reconnect within grace → auto-restore', () => {
    it('should restore the seat when the player returns before grace expiry', () => {
      const kickedSeats: Seat[] = [];
      disconnectHandler.onVoteResult = (_roomCode, outcome, seats) => {
        if (outcome === 'kick') kickedSeats.push(...seats);
      };

      disconnectHandler.handleDisconnect('ROOM1', 'north');
      // Half the grace window elapses, then the player returns.
      vi.advanceTimersByTime(2500);
      disconnectHandler.handleReconnect('ROOM1', 'north');

      expect(disconnectHandler.isDisconnected('ROOM1', 'north')).toBe(false);

      // Advance well past the original grace window — should never fire.
      vi.advanceTimersByTime(10_000);
      expect(kickedSeats).toEqual([]);
    });
  });

  // Verifies: REQ-F-SJ12 — multiple disconnects share a single grace window.
  describe('multi-disconnect → grace expires → multi-seat queue', () => {
    it('should release all disconnected seats when grace expires, and queue them', () => {
      const kickedSeats: Seat[] = [];
      disconnectHandler.onVoteResult = (_roomCode, outcome, seats) => {
        if (outcome === 'kick') kickedSeats.push(...seats);
      };

      disconnectHandler.handleDisconnect('ROOM1', 'north');
      disconnectHandler.handleDisconnect('ROOM1', 'east');

      // Single grace timer covers both seats — expire it.
      vi.advanceTimersByTime(5000);

      expect(kickedSeats).toContain('north');
      expect(kickedSeats).toContain('east');

      const callbacks = createQueueCallbacks(['spec1', 'spec2']);
      const queue = new SeatQueue('ROOM1', callbacks);
      queue.startQueue(['north', 'east'], ['spec1', 'spec2']);

      queue.handleClaim('spec1', 'east');
      expect(callbacks.claimCalls[0]).toEqual({ userId: 'spec1', seat: 'east' });

      queue.handleClaim('spec2');
      expect(callbacks.claimCalls[1]).toEqual({ userId: 'spec2', seat: 'north' });
      expect(queue.phase).toBe('idle');

      queue.cleanup();
    });
  });

  // Verifies: REQ-F-ES08, ES10
  describe('all spectators decline → up-for-grabs → first-come wins', () => {
    it('should transition to up-for-grabs when all decline, first claim wins', () => {
      const callbacks = createQueueCallbacks(['spec1', 'spec2']);
      const queue = new SeatQueue('ROOM1', callbacks);

      queue.startQueue(['north'], ['spec1', 'spec2']);

      // Both decline
      queue.handleDecline('spec1');
      queue.handleDecline('spec2');

      expect(queue.phase).toBe('up-for-grabs');

      // spec2 claims first
      queue.handleClaim('spec2');
      expect(callbacks.claimCalls[0]).toEqual({ userId: 'spec2', seat: 'north' });
      expect(queue.phase).toBe('idle');

      queue.cleanup();
    });
  });

  // Verifies: REQ-F-ES09
  describe('lobby join during active queue → added to end', () => {
    it('should add late joiner and offer after existing queue members', () => {
      const callbacks = createQueueCallbacks(['spec1']);
      const queue = new SeatQueue('ROOM1', callbacks);

      queue.startQueue(['north', 'east'], ['spec1']);

      // Late joiner
      queue.addToQueue('spec2');

      // spec1 claims north
      queue.handleClaim('spec1');

      // spec2 should get offer for east
      const spec2Offer = callbacks.sendCalls.find(
        c => c.userId === 'spec2' && (c.message as any).type === 'SEAT_OFFERED',
      );
      expect(spec2Offer).toBeDefined();
      expect((spec2Offer!.message as any).seats).toEqual(['east']);

      queue.cleanup();
    });
  });

  // Verifies: REQ-F-SJ12 — grace expiry releases the held seat.
  describe('grace expiry', () => {
    it('releases the seat after the configured grace window', () => {
      const kickedSeats: Seat[] = [];

      disconnectHandler.onVoteResult = (_roomCode, outcome, seats) => {
        if (outcome === 'kick') kickedSeats.push(...seats);
      };

      disconnectHandler.handleDisconnect('ROOM1', 'north');

      vi.advanceTimersByTime(5000);

      expect(kickedSeats).toEqual(['north']);
    });
  });

  // Verifies: REQ-F-SJ12 — state projection sees disconnected seats and
  // remaining grace time (votes map is empty — the vote scheme was removed).
  describe('disconnect grace state projection', () => {
    it('provides disconnected seats and remaining grace time; votes map is empty', () => {
      disconnectHandler.handleDisconnect('ROOM1', 'north');

      const status = disconnectHandler.getVoteStatus('ROOM1');
      expect(status).not.toBeNull();
      expect(status!.disconnectedSeats).toEqual(['north']);
      expect(status!.timeoutMs).toBeGreaterThan(0);
      expect(status!.votes).toEqual({
        north: null,
        east: null,
        south: null,
        west: null,
      });
    });
  });

  // Verifies: REQ-F-ES13 — pre-room queue (same behavior)
  describe('pre-room queue', () => {
    it('should work identically for pre-room leaves', () => {
      const callbacks = createQueueCallbacks(['spec1']);
      const queue = new SeatQueue('ROOM1', callbacks);

      // Pre-room: player leaves, spectator gets offer
      queue.startQueue(['south'], ['spec1']);

      expect(queue.phase).toBe('offering');
      queue.handleClaim('spec1');
      expect(callbacks.claimCalls[0]).toEqual({ userId: 'spec1', seat: 'south' });
      expect(queue.phase).toBe('idle');

      queue.cleanup();
    });
  });

  // Verifies: REQ-F-SJ08 — end-to-end queue of 4 spectators, 2 ineligible
  describe('ordered queue — silent-skip of ineligible spectators (SJ08)', () => {
    it('skips 2 of 4 ineligible spectators, emits 2 offers, logs each skip', () => {
      const ineligibleUsers = new Set<string>(['spec2', 'spec4']);
      const callbacks = createQueueCallbacks(
        ['spec1', 'spec2', 'spec3', 'spec4'],
        { ineligibleUsers },
      );
      const queue = new SeatQueue('ROOM1', callbacks);

      queue.startQueue(['north'], ['spec1', 'spec2', 'spec3', 'spec4']);

      // Only spec1 gets an offer initially
      let offers = callbacks.sendCalls.filter(
        (c) => (c.message as { type: string }).type === 'SEAT_OFFERED',
      );
      expect(offers).toHaveLength(1);
      expect(offers[0].userId).toBe('spec1');

      // spec1 declines → spec2 silently skipped → spec3 offered
      callbacks.sendCalls.length = 0;
      queue.handleDecline('spec1');

      offers = callbacks.sendCalls.filter(
        (c) => (c.message as { type: string }).type === 'SEAT_OFFERED',
      );
      expect(offers).toHaveLength(1);
      expect(offers[0].userId).toBe('spec3');

      // spec3 declines → spec4 silently skipped → up-for-grabs
      queue.handleDecline('spec3');
      expect(queue.phase).toBe('up-for-grabs');

      // Exactly 2 silent skips logged, one per ineligible spectator
      expect(callbacks.silentSkips.map((s) => s.userId)).toEqual(['spec2', 'spec4']);

      // Neither spec2 nor spec4 ever received SEAT_OFFERED
      const allOffers = callbacks.sendCalls.filter(
        (c) => (c.message as { type: string }).type === 'SEAT_OFFERED',
      );
      expect(allOffers.find((c) => c.userId === 'spec2')).toBeUndefined();
      expect(allOffers.find((c) => c.userId === 'spec4')).toBeUndefined();

      queue.cleanup();
    });

    // Verifies: REQ-F-SJ09 — order preserved across skip/decline/accept
    it('preserves spectator list order after skip/decline/accept combos', () => {
      const spectatorOrder = ['A', 'B', 'C', 'D', 'E'];
      // B ineligible → skipped; A declines; C accepts; D, E unprocessed
      const ineligibleUsers = new Set<string>(['B']);
      const callbacks = createQueueCallbacks(spectatorOrder, { ineligibleUsers });
      const queue = new SeatQueue('ROOM1', callbacks);

      queue.startQueue(['north'], spectatorOrder);

      queue.handleDecline('A');
      queue.handleClaim('C');

      // Verify: only C claimed, B skipped, D and E remained unprocessed
      expect(callbacks.claimCalls).toEqual([{ userId: 'C', seat: 'north' }]);
      expect(callbacks.silentSkips.map((s) => s.userId)).toEqual(['B']);

      // Post-processing spectator list minus acceptor preserves original order
      const remainingSpectators = spectatorOrder.filter((id) => id !== 'C');
      expect(remainingSpectators).toEqual(['A', 'B', 'D', 'E']);

      queue.cleanup();
    });
  });

  // Verifies: REQ-F-SJ10, SJ11 — free-for-all gated by eligibility
  describe('free-for-all — eligibility gating (SJ10, SJ11)', () => {
    it('emits onIneligibleFreeForAllClaim when ineligible user claims in up-for-grabs', () => {
      // specA is eligible (drives up-for-grabs); specB arrives later and is ineligible
      const ineligibleUsers = new Set<string>(['specB']);
      const callbacks = createQueueCallbacks(['specA', 'specB'], { ineligibleUsers });
      const queue = new SeatQueue('ROOM1', callbacks);

      queue.startQueue(['north'], ['specA']);
      queue.handleDecline('specA');
      expect(queue.phase).toBe('up-for-grabs');

      // specB attempts claim → rejected with SJ11 callback
      const result = queue.handleClaim('specB');

      expect(result).toBe(true);
      expect(callbacks.rejectedClaims).toEqual(['specB']);
      expect(callbacks.claimCalls).toHaveLength(0);
      // Queue stays in up-for-grabs — seat still claimable by eligible user
      expect(queue.phase).toBe('up-for-grabs');

      queue.cleanup();
    });

    // Verifies: REQ-F-SJ10 — eligible user can still claim after ineligible attempt
    it('allows subsequent eligible claim after a rejected ineligible attempt', () => {
      const ineligibleUsers = new Set<string>(['specB']);
      const callbacks = createQueueCallbacks(['specA', 'specB', 'specC'], { ineligibleUsers });
      const queue = new SeatQueue('ROOM1', callbacks);

      queue.startQueue(['north'], ['specA']);
      queue.handleDecline('specA');
      expect(queue.phase).toBe('up-for-grabs');

      queue.handleClaim('specB'); // rejected
      queue.handleClaim('specC'); // succeeds

      expect(callbacks.rejectedClaims).toEqual(['specB']);
      expect(callbacks.claimCalls).toEqual([{ userId: 'specC', seat: 'north' }]);
      expect(queue.phase).toBe('idle');

      queue.cleanup();
    });
  });
});
