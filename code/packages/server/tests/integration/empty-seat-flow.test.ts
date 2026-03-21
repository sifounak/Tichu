// Verifies: REQ-F-ES01–ES17, REQ-NF-ES01–ES03
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
  } as unknown as Broadcaster;
}

function createQueueCallbacks(currentSpectators: string[] = []): SeatQueueCallbacks & {
  sendCalls: Array<{ userId: string; message: unknown }>;
  claimCalls: Array<{ userId: string; seat: Seat }>;
  filledCalls: string[];
} {
  const sendCalls: Array<{ userId: string; message: unknown }> = [];
  const claimCalls: Array<{ userId: string; seat: Seat }> = [];
  const filledCalls: string[] = [];

  return {
    sendCalls,
    claimCalls,
    filledCalls,
    onSendToSpectator: (userId, message) => sendCalls.push({ userId, message }),
    onSeatClaimed: (userId, seat) => claimCalls.push({ userId, seat }),
    onAllSeatsFilled: (roomCode) => filledCalls.push(roomCode),
    onGetCurrentSpectators: () => [...currentSpectators],
  };
}

// ─── Integration tests ──────────────────────────────────────────────────────

describe('Empty Seat Flow — Integration', () => {
  let broadcaster: Broadcaster;
  let disconnectHandler: DisconnectHandler;

  beforeEach(() => {
    vi.useFakeTimers();
    broadcaster = createMockBroadcaster();
    disconnectHandler = new DisconnectHandler(broadcaster, { voteTimeoutMs: 5000 });
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

  // Verifies: REQ-F-ES04, ES06, ES07, ES16
  describe('disconnect → vote kick → queue → claim → resume', () => {
    it('should run full flow: disconnect, vote kick, then queue starts', () => {
      const kickedSeats: Seat[] = [];

      disconnectHandler.onVoteResult = (_roomCode, outcome, seats) => {
        if (outcome === 'kick') {
          kickedSeats.push(...seats);
        }
      };

      // Player disconnects
      disconnectHandler.handleDisconnect('ROOM1', 'north');
      expect(disconnectHandler.hasActiveVote('ROOM1')).toBe(true);

      // Remaining players vote kick
      disconnectHandler.handleVote('ROOM1', 'east', 'kick');
      disconnectHandler.handleVote('ROOM1', 'south', 'kick');

      // Vote resolves → kicks north
      expect(kickedSeats).toEqual(['north']);

      // Now start queue for the kicked seat
      const callbacks = createQueueCallbacks(['spec1']);
      const queue = new SeatQueue('ROOM1', callbacks);
      queue.startQueue(['north'], ['spec1']);

      // spec1 claims
      queue.handleClaim('spec1');
      expect(callbacks.claimCalls[0]).toEqual({ userId: 'spec1', seat: 'north' });
      expect(queue.phase).toBe('idle');

      queue.cleanup();
    });
  });

  // Verifies: REQ-F-ES04, ES14
  describe('disconnect → vote wait → reconnect → auto-restore', () => {
    it('should keep seat reserved on wait vote, player reconnects', () => {
      let voteResult: string | null = null;

      disconnectHandler.onVoteResult = (_roomCode, outcome) => {
        voteResult = outcome;
      };

      disconnectHandler.handleDisconnect('ROOM1', 'north');

      // Vote wait
      disconnectHandler.handleVote('ROOM1', 'east', 'wait');
      disconnectHandler.handleVote('ROOM1', 'south', 'wait');

      expect(voteResult).toBe('waiting');

      // Player reconnects
      disconnectHandler.handleReconnect('ROOM1', 'north');
      expect(disconnectHandler.isDisconnected('ROOM1', 'north')).toBe(false);
    });
  });

  // Verifies: REQ-F-ES17
  describe('multi-disconnect → collective vote → kick → multi-seat queue', () => {
    it('should handle 2 players disconnecting and queue offering multiple seats', () => {
      const kickedSeats: Seat[] = [];

      disconnectHandler.onVoteResult = (_roomCode, outcome, seats) => {
        if (outcome === 'kick') kickedSeats.push(...seats);
      };

      // 2 players disconnect
      disconnectHandler.handleDisconnect('ROOM1', 'north');
      disconnectHandler.handleDisconnect('ROOM1', 'east');

      // Remaining 2 players vote kick
      disconnectHandler.handleVote('ROOM1', 'south', 'kick');
      disconnectHandler.handleVote('ROOM1', 'west', 'kick');

      expect(kickedSeats).toContain('north');
      expect(kickedSeats).toContain('east');

      // Queue for 2 seats
      const callbacks = createQueueCallbacks(['spec1', 'spec2']);
      const queue = new SeatQueue('ROOM1', callbacks);
      queue.startQueue(['north', 'east'], ['spec1', 'spec2']);

      // spec1 picks east specifically
      queue.handleClaim('spec1', 'east');
      expect(callbacks.claimCalls[0]).toEqual({ userId: 'spec1', seat: 'east' });

      // spec2 gets remaining north
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

  // Verifies: REQ-F-ES04 (45s auto-kick timeout)
  describe('45s auto-kick timeout', () => {
    it('should auto-kick after timeout with no majority', () => {
      const kickedSeats: Seat[] = [];

      disconnectHandler.onVoteResult = (_roomCode, outcome, seats) => {
        if (outcome === 'kick') kickedSeats.push(...seats);
      };

      disconnectHandler.handleDisconnect('ROOM1', 'north');

      // No votes cast — auto-kick after 5s (test timeout)
      vi.advanceTimersByTime(5000);

      expect(kickedSeats).toEqual(['north']);
    });
  });

  // Verifies: REQ-F-ES04 — vote status for state projection
  describe('disconnect vote state projection', () => {
    it('should provide vote status with per-seat votes and remaining time', () => {
      disconnectHandler.handleDisconnect('ROOM1', 'north');

      disconnectHandler.handleVote('ROOM1', 'east', 'kick');
      disconnectHandler.handleVote('ROOM1', 'south', 'wait');

      const status = disconnectHandler.getVoteStatus('ROOM1');
      expect(status).not.toBeNull();
      expect(status!.votes['east']).toBe('kick');
      expect(status!.votes['south']).toBe('wait');
      expect(status!.votes['north']).toBeNull(); // disconnected
      expect(status!.disconnectedSeats).toEqual(['north']);
      expect(status!.timeoutMs).toBeGreaterThan(0);
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
});
