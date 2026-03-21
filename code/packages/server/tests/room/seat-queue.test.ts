// Verifies: REQ-F-SP07, SP08, SP08a, SP08b, SP08c, SP09, SP10

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SeatQueue, type SeatQueueCallbacks } from '../../src/room/seat-queue.js';
import type { Seat } from '@tichu/shared';

function createMockCallbacks(): SeatQueueCallbacks & {
  sendCalls: Array<{ userId: string; message: unknown }>;
  statusCalls: Array<{ roomCode: string; status: unknown }>;
  claimCalls: Array<{ userId: string; seat: Seat }>;
  filledCalls: string[];
} {
  const sendCalls: Array<{ userId: string; message: unknown }> = [];
  const statusCalls: Array<{ roomCode: string; status: unknown }> = [];
  const claimCalls: Array<{ userId: string; seat: Seat }> = [];
  const filledCalls: string[] = [];

  return {
    sendCalls,
    statusCalls,
    claimCalls,
    filledCalls,
    onSendToSpectator: (userId, message) => {
      sendCalls.push({ userId, message });
    },
    onBroadcastQueueStatus: (roomCode, status) => {
      statusCalls.push({ roomCode, status });
    },
    onSeatClaimed: (userId, seat) => {
      claimCalls.push({ userId, seat });
    },
    onAllSeatsFilled: (roomCode) => {
      filledCalls.push(roomCode);
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

  describe('startQueue', () => {
    // Verifies: REQ-F-SP07
    it('should offer seat to first spectator in FIFO order', () => {
      queue.startQueue(['north'], ['user1', 'user2', 'user3']);

      expect(queue.phase).toBe('offering');
      expect(queue.isActive()).toBe(true);

      // First spectator should receive SEAT_OFFERED
      expect(callbacks.sendCalls).toHaveLength(1);
      expect(callbacks.sendCalls[0]).toEqual({
        userId: 'user1',
        message: { type: 'SEAT_OFFERED', seat: 'north', timeoutMs: 30000 },
      });
    });

    // Verifies: REQ-F-SP08b
    it('should broadcast queue status to non-deciding spectators', () => {
      queue.startQueue(['north'], ['user1', 'user2']);

      expect(callbacks.statusCalls).toHaveLength(1);
      expect(callbacks.statusCalls[0].status).toEqual({
        type: 'QUEUE_STATUS',
        decidingSpectator: 'user1',
        position: 1,
        timeoutMs: 30000,
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

  describe('handleClaim', () => {
    // Verifies: REQ-F-SP08, SP09
    it('should assign seat to claiming spectator', () => {
      queue.startQueue(['north'], ['user1', 'user2']);
      callbacks.sendCalls.length = 0;

      const result = queue.handleClaim('user1');

      expect(result).toBe(true);
      expect(callbacks.claimCalls).toHaveLength(1);
      expect(callbacks.claimCalls[0]).toEqual({ userId: 'user1', seat: 'north' });
    });

    // Verifies: REQ-F-SP08a
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

      // Next spectator should get an offer for the next seat
      expect(callbacks.sendCalls).toHaveLength(1);
      expect(callbacks.sendCalls[0]).toEqual({
        userId: 'user2',
        message: { type: 'SEAT_OFFERED', seat: 'east', timeoutMs: 30000 },
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

  describe('handleDecline', () => {
    // Verifies: REQ-F-SP08
    it('should advance to next spectator on decline', () => {
      queue.startQueue(['north'], ['user1', 'user2']);
      callbacks.sendCalls.length = 0;

      const result = queue.handleDecline('user1');

      expect(result).toBe(true);
      // user2 should now receive the offer
      expect(callbacks.sendCalls).toHaveLength(1);
      expect(callbacks.sendCalls[0].userId).toBe('user2');
    });

    it('should reject decline from wrong user', () => {
      queue.startQueue(['north'], ['user1', 'user2']);

      const result = queue.handleDecline('user2');

      expect(result).toBe(false);
    });

    // Verifies: REQ-F-SP08c
    it('should transition to up-for-grabs when all decline', () => {
      queue.startQueue(['north'], ['user1', 'user2']);

      queue.handleDecline('user1');
      queue.handleDecline('user2');

      expect(queue.phase).toBe('up-for-grabs');

      // Both users should have received SEATS_AVAILABLE
      const seatsMessages = callbacks.sendCalls.filter(
        c => (c.message as { type: string }).type === 'SEATS_AVAILABLE'
      );
      expect(seatsMessages).toHaveLength(2);
    });
  });

  describe('timeout', () => {
    // Verifies: REQ-F-SP08
    it('should treat timeout as decline and advance', () => {
      queue.startQueue(['north'], ['user1', 'user2']);
      callbacks.sendCalls.length = 0;

      vi.advanceTimersByTime(30000);

      // user2 should now have the offer
      expect(callbacks.sendCalls.some(c => c.userId === 'user2')).toBe(true);
    });

    it('should transition to up-for-grabs when all timeout', () => {
      queue.startQueue(['north'], ['user1', 'user2']);

      vi.advanceTimersByTime(30000); // user1 times out
      vi.advanceTimersByTime(30000); // user2 times out

      expect(queue.phase).toBe('up-for-grabs');
    });
  });

  describe('up-for-grabs phase', () => {
    // Verifies: REQ-F-SP08c
    it('should allow any spectator to claim during up-for-grabs', () => {
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

    it('should broadcast updated seats after claim with remaining seats', () => {
      queue.startQueue(['north', 'east'], ['user1', 'user2']);

      queue.handleDecline('user1');
      queue.handleDecline('user2');
      callbacks.sendCalls.length = 0;

      queue.handleClaim('user1');

      // user2 should get updated SEATS_AVAILABLE with remaining seat
      const seatsMessages = callbacks.sendCalls.filter(
        c => (c.message as { type: string }).type === 'SEATS_AVAILABLE'
      );
      expect(seatsMessages).toHaveLength(1);
      expect((seatsMessages[0].message as { seats: Seat[] }).seats).toEqual(['east']);
    });
  });

  describe('handleLeave', () => {
    it('should remove spectator from queue and advance if they were deciding', () => {
      queue.startQueue(['north'], ['user1', 'user2']);
      callbacks.sendCalls.length = 0;

      queue.handleLeave('user1');

      // user2 should now have the offer
      expect(callbacks.sendCalls.some(c => c.userId === 'user2')).toBe(true);
    });

    it('should finish queue if all spectators leave', () => {
      queue.startQueue(['north'], ['user1']);

      queue.handleLeave('user1');

      expect(queue.phase).toBe('idle');
      expect(callbacks.filledCalls).toEqual(['ROOM1']);
    });
  });

  describe('addToQueue (late joiners)', () => {
    // Verifies: REQ-F-SP10
    it('should include late joiners in the offering round', () => {
      queue.startQueue(['north'], ['user1']);

      // Late joiner arrives
      queue.addToQueue('user2');

      // user1 declines
      queue.handleDecline('user1');

      // user2 (late joiner) should now get the offer
      const user2Offers = callbacks.sendCalls.filter(
        c => c.userId === 'user2' && (c.message as { type: string }).type === 'SEAT_OFFERED'
      );
      expect(user2Offers).toHaveLength(1);
    });

    it('should include late joiners in up-for-grabs if all decline', () => {
      queue.startQueue(['north'], ['user1']);

      queue.addToQueue('user2');
      queue.handleDecline('user1');
      queue.handleDecline('user2');

      expect(queue.phase).toBe('up-for-grabs');

      // Both should have received SEATS_AVAILABLE
      const seatsMessages = callbacks.sendCalls.filter(
        c => (c.message as { type: string }).type === 'SEATS_AVAILABLE'
      );
      expect(seatsMessages.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('multiple seats', () => {
    it('should offer seats sequentially as they are claimed', () => {
      queue.startQueue(['north', 'east', 'west'], ['user1', 'user2', 'user3']);

      // user1 claims north
      queue.handleClaim('user1');
      expect(callbacks.claimCalls[0]).toEqual({ userId: 'user1', seat: 'north' });

      // user2 claims east
      queue.handleClaim('user2');
      expect(callbacks.claimCalls[1]).toEqual({ userId: 'user2', seat: 'east' });

      // user3 claims west
      queue.handleClaim('user3');
      expect(callbacks.claimCalls[2]).toEqual({ userId: 'user3', seat: 'west' });

      expect(queue.phase).toBe('idle');
      expect(callbacks.filledCalls).toEqual(['ROOM1']);
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
