// Verifies: REQ-F-ES06, ES07, ES08, ES09, ES10, ES11, ES16

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SeatQueue, type SeatQueueCallbacks } from '../../src/room/seat-queue.js';
import type { Seat } from '@tichu/shared';

function createMockCallbacks(): SeatQueueCallbacks & {
  sendCalls: Array<{ userId: string; message: unknown }>;
  claimCalls: Array<{ userId: string; seat: Seat }>;
  filledCalls: string[];
  currentSpectators: string[];
} {
  const sendCalls: Array<{ userId: string; message: unknown }> = [];
  const claimCalls: Array<{ userId: string; seat: Seat }> = [];
  const filledCalls: string[] = [];
  const currentSpectators: string[] = [];

  return {
    sendCalls,
    claimCalls,
    filledCalls,
    currentSpectators,
    onSendToSpectator: (userId, message) => {
      sendCalls.push({ userId, message });
    },
    onSeatClaimed: (userId, seat) => {
      claimCalls.push({ userId, seat });
    },
    onAllSeatsFilled: (roomCode) => {
      filledCalls.push(roomCode);
    },
    onGetCurrentSpectators: () => {
      return [...currentSpectators];
    },
  };
}

describe('SeatQueue', () => {
  let queue: SeatQueue;
  let callbacks: ReturnType<typeof createMockCallbacks>;

  beforeEach(() => {
    vi.useFakeTimers();
    callbacks = createMockCallbacks();
    queue = new SeatQueue('ROOM1', callbacks);
  });

  afterEach(() => {
    queue.cleanup();
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should start idle', () => {
      expect(queue.phase).toBe('idle');
      expect(queue.isActive()).toBe(false);
    });
  });

  // Verifies: REQ-F-ES06
  describe('startQueue', () => {
    it('should offer seat to first spectator in FIFO order', () => {
      queue.startQueue(['north'], ['user1', 'user2', 'user3']);

      expect(queue.phase).toBe('offering');
      expect(queue.isActive()).toBe(true);

      const offers = callbacks.sendCalls.filter(
        c => (c.message as { type: string }).type === 'SEAT_OFFERED'
      );
      expect(offers).toHaveLength(1);
      expect(offers[0]).toEqual({
        userId: 'user1',
        message: { type: 'SEAT_OFFERED', seats: ['north'], timeoutMs: 30000 },
      });
    });

    // Verifies: REQ-F-ES06 — multi-seat offer
    it('should offer all available seats in multi-vacancy', () => {
      queue.startQueue(['north', 'east'], ['user1']);

      const offers = callbacks.sendCalls.filter(
        c => (c.message as { type: string }).type === 'SEAT_OFFERED'
      );
      expect(offers).toHaveLength(1);
      expect((offers[0].message as { seats: Seat[] }).seats).toEqual(['north', 'east']);
    });

    // Verifies: REQ-F-ES11 — individual queue status
    it('should send individual queue status to each waiting spectator', () => {
      queue.startQueue(['north'], ['user1', 'user2', 'user3']);

      const statusMessages = callbacks.sendCalls.filter(
        c => (c.message as { type: string }).type === 'QUEUE_STATUS'
      );
      // user2 gets position 1, user3 gets position 2
      expect(statusMessages).toHaveLength(2);
      expect(statusMessages[0]).toEqual({
        userId: 'user2',
        message: { type: 'QUEUE_STATUS', decidingSpectator: 'user1', position: 1, timeoutMs: 30000 },
      });
      expect(statusMessages[1]).toEqual({
        userId: 'user3',
        message: { type: 'QUEUE_STATUS', decidingSpectator: 'user1', position: 2, timeoutMs: 30000 },
      });
    });

    it('should do nothing with empty seats', () => {
      queue.startQueue([], ['user1']);
      expect(queue.phase).toBe('idle');
    });

    it('should do nothing with no spectators', () => {
      queue.startQueue(['north'], []);
      expect(queue.phase).toBe('idle');
    });
  });

  // Verifies: REQ-F-ES07
  describe('handleClaim', () => {
    it('should assign first available seat when no seat specified', () => {
      queue.startQueue(['north'], ['user1', 'user2']);

      const result = queue.handleClaim('user1');

      expect(result).toBe(true);
      expect(callbacks.claimCalls).toHaveLength(1);
      expect(callbacks.claimCalls[0]).toEqual({ userId: 'user1', seat: 'north' });
    });

    // Verifies: REQ-F-ES07 — specific seat choice in multi-vacancy
    it('should assign specific seat when provided (multi-vacancy)', () => {
      queue.startQueue(['north', 'east', 'south'], ['user1']);

      const result = queue.handleClaim('user1', 'east');

      expect(result).toBe(true);
      expect(callbacks.claimCalls[0]).toEqual({ userId: 'user1', seat: 'east' });
    });

    it('should fall back to first available if requested seat not available', () => {
      queue.startQueue(['north', 'east'], ['user1']);

      const result = queue.handleClaim('user1', 'west'); // west not available

      expect(result).toBe(true);
      expect(callbacks.claimCalls[0]).toEqual({ userId: 'user1', seat: 'north' });
    });

    // Verifies: REQ-F-ES16
    it('should finish queue when last seat is filled', () => {
      queue.startQueue(['north'], ['user1', 'user2']);

      queue.handleClaim('user1');

      expect(queue.phase).toBe('idle');
      expect(callbacks.filledCalls).toEqual(['ROOM1']);
    });

    it('should offer next seat to next spectator when more seats available', () => {
      queue.startQueue(['north', 'east'], ['user1', 'user2']);
      callbacks.sendCalls.length = 0;

      queue.handleClaim('user1');

      const offers = callbacks.sendCalls.filter(
        c => (c.message as { type: string }).type === 'SEAT_OFFERED'
      );
      expect(offers).toHaveLength(1);
      expect(offers[0]).toEqual({
        userId: 'user2',
        message: { type: 'SEAT_OFFERED', seats: ['east'], timeoutMs: 30000 },
      });
    });

    it('should reject claim from wrong user', () => {
      queue.startQueue(['north'], ['user1', 'user2']);

      const result = queue.handleClaim('user2');

      expect(result).toBe(false);
      expect(callbacks.claimCalls).toHaveLength(0);
    });

    it('should reject claim when idle', () => {
      const result = queue.handleClaim('user1');
      expect(result).toBe(false);
    });
  });

  // Verifies: REQ-F-ES08
  describe('handleDecline (pass)', () => {
    it('should advance to next spectator on decline', () => {
      queue.startQueue(['north'], ['user1', 'user2']);
      callbacks.sendCalls.length = 0;

      const result = queue.handleDecline('user1');

      expect(result).toBe(true);
      const offers = callbacks.sendCalls.filter(
        c => (c.message as { type: string }).type === 'SEAT_OFFERED'
      );
      expect(offers).toHaveLength(1);
      expect(offers[0].userId).toBe('user2');
    });

    it('should reject decline from wrong user', () => {
      queue.startQueue(['north'], ['user1', 'user2']);

      const result = queue.handleDecline('user2');

      expect(result).toBe(false);
    });

    // Verifies: REQ-F-ES08 — removed from queue, not recycled
    it('should remove declined user from queue entirely', () => {
      callbacks.currentSpectators.push('user1', 'user2');
      queue.startQueue(['north'], ['user1', 'user2']);

      queue.handleDecline('user1');
      queue.handleDecline('user2');

      // Should transition to up-for-grabs since all queue spectators passed
      expect(queue.phase).toBe('up-for-grabs');
    });

    // Verifies: REQ-F-ES10
    it('should transition to up-for-grabs when all queue spectators pass', () => {
      callbacks.currentSpectators.push('user1', 'user2');
      queue.startQueue(['north'], ['user1', 'user2']);

      queue.handleDecline('user1');
      queue.handleDecline('user2');

      expect(queue.phase).toBe('up-for-grabs');

      // Up-for-grabs should be sent to ALL current spectators (via callback)
      const seatsMessages = callbacks.sendCalls.filter(
        c => (c.message as { type: string }).type === 'SEATS_AVAILABLE'
      );
      expect(seatsMessages).toHaveLength(2);
    });
  });

  // Verifies: REQ-F-ES08 — timeout treated as pass
  describe('timeout', () => {
    it('should treat timeout as pass and advance', () => {
      queue.startQueue(['north'], ['user1', 'user2']);
      callbacks.sendCalls.length = 0;

      vi.advanceTimersByTime(30000);

      const offers = callbacks.sendCalls.filter(
        c => (c.message as { type: string }).type === 'SEAT_OFFERED'
      );
      expect(offers.some(c => c.userId === 'user2')).toBe(true);
    });

    it('should transition to up-for-grabs when all timeout', () => {
      callbacks.currentSpectators.push('user1', 'user2');
      queue.startQueue(['north'], ['user1', 'user2']);

      vi.advanceTimersByTime(30000); // user1 times out
      vi.advanceTimersByTime(30000); // user2 times out

      expect(queue.phase).toBe('up-for-grabs');
    });

    // Verifies: REQ-F-ES08 — timed-out user NOT eligible for up-for-grabs
    it('should remove timed-out user from queue (not recycled)', () => {
      callbacks.currentSpectators.push('user1');
      queue.startQueue(['north'], ['user1']);

      vi.advanceTimersByTime(30000);

      expect(queue.phase).toBe('up-for-grabs');
      // user1 was the only one and timed out — up-for-grabs still happens for room spectators
    });
  });

  // Verifies: REQ-F-ES10
  describe('up-for-grabs phase', () => {
    it('should allow any spectator to claim during up-for-grabs', () => {
      callbacks.currentSpectators.push('user1', 'user2');
      queue.startQueue(['north'], ['user1', 'user2']);

      queue.handleDecline('user1');
      queue.handleDecline('user2');

      expect(queue.phase).toBe('up-for-grabs');

      const result = queue.handleClaim('user2');

      expect(result).toBe(true);
      expect(callbacks.claimCalls).toHaveLength(1);
      expect(callbacks.claimCalls[0]).toEqual({ userId: 'user2', seat: 'north' });
      expect(queue.phase).toBe('idle');
    });

    // Verifies: REQ-F-ES10 — auto-assign seat (no seat choice)
    it('should auto-assign first available seat (no choice in up-for-grabs)', () => {
      callbacks.currentSpectators.push('user1', 'user2');
      queue.startQueue(['north', 'east'], ['user1', 'user2']);

      queue.handleDecline('user1');
      queue.handleDecline('user2');

      callbacks.sendCalls.length = 0;

      queue.handleClaim('user1');
      expect(callbacks.claimCalls).toHaveLength(1);
      expect(callbacks.claimCalls[0].seat).toBe('north'); // first available

      // Remaining spectators get updated SEATS_AVAILABLE
      const seatsMessages = callbacks.sendCalls.filter(
        c => (c.message as { type: string }).type === 'SEATS_AVAILABLE'
      );
      expect(seatsMessages.length).toBeGreaterThanOrEqual(1);
    });

    // Verifies: REQ-F-ES10 — broadcast to ALL spectators via callback
    it('should broadcast SEATS_AVAILABLE to all current spectators (not just declined)', () => {
      // user3 is a current spectator who was not in the original queue
      callbacks.currentSpectators.push('user1', 'user2', 'user3');
      queue.startQueue(['north'], ['user1', 'user2']);

      queue.handleDecline('user1');
      queue.handleDecline('user2');

      const seatsMessages = callbacks.sendCalls.filter(
        c => (c.message as { type: string }).type === 'SEATS_AVAILABLE'
      );
      // Should be sent to user1, user2, user3 (all current spectators)
      expect(seatsMessages).toHaveLength(3);
      const recipients = seatsMessages.map(c => c.userId);
      expect(recipients).toContain('user1');
      expect(recipients).toContain('user2');
      expect(recipients).toContain('user3');
    });
  });

  describe('handleLeave', () => {
    it('should remove spectator from queue and advance if they were deciding', () => {
      queue.startQueue(['north'], ['user1', 'user2']);
      callbacks.sendCalls.length = 0;

      queue.handleLeave('user1');

      const offers = callbacks.sendCalls.filter(
        c => (c.message as { type: string }).type === 'SEAT_OFFERED'
      );
      expect(offers.some(c => c.userId === 'user2')).toBe(true);
    });

    it('should finish queue if all spectators leave', () => {
      queue.startQueue(['north'], ['user1']);

      queue.handleLeave('user1');

      expect(queue.phase).toBe('idle');
      expect(callbacks.filledCalls).toEqual(['ROOM1']);
    });
  });

  // Verifies: REQ-F-ES09
  describe('addToQueue (late joiners)', () => {
    it('should include late joiners in the offering round', () => {
      queue.startQueue(['north'], ['user1']);

      queue.addToQueue('user2');
      queue.handleDecline('user1');

      const offers = callbacks.sendCalls.filter(
        c => c.userId === 'user2' && (c.message as { type: string }).type === 'SEAT_OFFERED'
      );
      expect(offers).toHaveLength(1);
    });

    // Verifies: REQ-F-ES09 — late joiner during up-for-grabs gets SEATS_AVAILABLE immediately
    it('should send SEATS_AVAILABLE immediately to late joiner during up-for-grabs', () => {
      callbacks.currentSpectators.push('user1');
      queue.startQueue(['north'], ['user1']);
      queue.handleDecline('user1');
      expect(queue.phase).toBe('up-for-grabs');

      callbacks.sendCalls.length = 0;
      queue.addToQueue('user2');

      const seatsMessages = callbacks.sendCalls.filter(
        c => c.userId === 'user2' && (c.message as { type: string }).type === 'SEATS_AVAILABLE'
      );
      expect(seatsMessages).toHaveLength(1);
      expect((seatsMessages[0].message as { seats: Seat[] }).seats).toEqual(['north']);
    });

    it('should add late joiner to end of offering queue', () => {
      queue.startQueue(['north', 'east'], ['user1']);

      queue.addToQueue('user2');

      // user1 claims first seat
      queue.handleClaim('user1');

      // user2 should now get offer for remaining seat
      const user2Offers = callbacks.sendCalls.filter(
        c => c.userId === 'user2' && (c.message as { type: string }).type === 'SEAT_OFFERED'
      );
      expect(user2Offers).toHaveLength(1);
    });
  });

  describe('multiple seats', () => {
    it('should offer seats sequentially as they are claimed', () => {
      queue.startQueue(['north', 'east', 'west'], ['user1', 'user2', 'user3']);

      queue.handleClaim('user1');
      expect(callbacks.claimCalls[0]).toEqual({ userId: 'user1', seat: 'north' });

      queue.handleClaim('user2');
      expect(callbacks.claimCalls[1]).toEqual({ userId: 'user2', seat: 'east' });

      queue.handleClaim('user3');
      expect(callbacks.claimCalls[2]).toEqual({ userId: 'user3', seat: 'west' });

      expect(queue.phase).toBe('idle');
      expect(callbacks.filledCalls).toEqual(['ROOM1']);
    });

    // Verifies: REQ-F-ES11 — position updates as queue processes
    it('should update positions as queue advances', () => {
      queue.startQueue(['north'], ['user1', 'user2', 'user3']);
      callbacks.sendCalls.length = 0;

      // user1 declines — user2 becomes deciding, user3 moves up
      queue.handleDecline('user1');

      const statusMessages = callbacks.sendCalls.filter(
        c => (c.message as { type: string }).type === 'QUEUE_STATUS'
      );
      // user3 should get position 1 (next in line after user2)
      const user3Status = statusMessages.find(c => c.userId === 'user3');
      expect(user3Status).toBeDefined();
      expect((user3Status!.message as { position: number }).position).toBe(1);
    });
  });

  describe('cleanup', () => {
    it('should reset all state', () => {
      queue.startQueue(['north'], ['user1', 'user2']);

      queue.cleanup();

      expect(queue.phase).toBe('idle');
      expect(queue.isActive()).toBe(false);
    });
  });
});
