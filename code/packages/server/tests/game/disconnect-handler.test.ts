// Verifies: REQ-F-DC01, DC02, DC03, DC04, GF01, GF03, GF04

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DisconnectHandler, type VoteOutcome } from '../../src/game/disconnect-handler.js';
import type { Broadcaster } from '../../src/ws/broadcaster.js';

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

describe('DisconnectHandler — per-seat tracking (REQ-F-DC01–DC04)', () => {
  let handler: DisconnectHandler;
  let broadcaster: Broadcaster;

  beforeEach(() => {
    vi.useFakeTimers();
    broadcaster = createMockBroadcaster();
    // Short threshold for faster tests (5s instead of 125s)
    handler = new DisconnectHandler(broadcaster, { thresholdMs: 5_000 });
  });

  afterEach(() => {
    handler.dispose();
    vi.useRealTimers();
  });

  // Verifies: REQ-F-DC01 — seat tracked on disconnect, seat preserved.
  describe('handleDisconnect', () => {
    it('tracks the disconnected seat', () => {
      handler.handleDisconnect('ROOM1', 'north');
      expect(handler.isDisconnected('ROOM1', 'north')).toBe(true);
      expect(handler.isDisconnected('ROOM1', 'east')).toBe(false);
    });

    it('broadcasts PLAYER_DISCONNECTED', () => {
      handler.handleDisconnect('ROOM1', 'north');
      expect(broadcaster.broadcastToRoom).toHaveBeenCalledWith('ROOM1', {
        type: 'PLAYER_DISCONNECTED',
        seat: 'north',
      });
    });

    it('tracks multiple disconnects independently per seat', () => {
      handler.handleDisconnect('ROOM1', 'north');
      handler.handleDisconnect('ROOM1', 'east');
      const seats = handler.getDisconnectedSeats('ROOM1');
      expect(seats).toContain('north');
      expect(seats).toContain('east');
    });

    it('hasActiveVote always returns false (no vote scheme)', () => {
      expect(handler.hasActiveVote('ROOM1')).toBe(false);
      handler.handleDisconnect('ROOM1', 'north');
      expect(handler.hasActiveVote('ROOM1')).toBe(false);
    });
  });

  // Verifies: REQ-F-DC03 — reconnect fully resets timer.
  describe('handleReconnect', () => {
    it('removes the seat from disconnected list', () => {
      handler.handleDisconnect('ROOM1', 'north');
      handler.handleReconnect('ROOM1', 'north');
      expect(handler.isDisconnected('ROOM1', 'north')).toBe(false);
    });

    it('broadcasts PLAYER_RECONNECTED', () => {
      handler.handleDisconnect('ROOM1', 'north');
      handler.handleReconnect('ROOM1', 'north');
      expect(broadcaster.broadcastToRoom).toHaveBeenCalledWith('ROOM1', {
        type: 'PLAYER_RECONNECTED',
        seat: 'north',
      });
    });

    // Verifies: REQ-F-DC03 — reconnect cancels threshold timer.
    it('cancels the threshold timer so callback never fires', () => {
      const onThreshold = vi.fn();
      handler.onThresholdCrossed = onThreshold;
      handler.handleDisconnect('ROOM1', 'north');

      handler.handleReconnect('ROOM1', 'north');

      // Advance past threshold — should not fire.
      vi.advanceTimersByTime(10_000);
      expect(onThreshold).not.toHaveBeenCalled();
    });

    it('does not affect other disconnected seats', () => {
      const onThreshold = vi.fn();
      handler.onThresholdCrossed = onThreshold;
      handler.handleDisconnect('ROOM1', 'north');
      handler.handleDisconnect('ROOM1', 'east');

      handler.handleReconnect('ROOM1', 'north');

      // East should still fire
      vi.advanceTimersByTime(5_000);
      expect(onThreshold).toHaveBeenCalledWith('ROOM1', 'east');
      expect(onThreshold).not.toHaveBeenCalledWith('ROOM1', 'north');
    });

    // Verifies: REQ-F-DC02 — timer resets from zero on new disconnect.
    it('timer resets from zero if player disconnects again after reconnect', () => {
      const onThreshold = vi.fn();
      handler.onThresholdCrossed = onThreshold;
      handler.handleDisconnect('ROOM1', 'north');

      // Advance 3s
      vi.advanceTimersByTime(3_000);
      handler.handleReconnect('ROOM1', 'north');

      // Reconnect and disconnect again
      handler.handleDisconnect('ROOM1', 'north');

      // Advance 4s — should not fire yet (only 4s into new session, need 5s)
      vi.advanceTimersByTime(4_000);
      expect(onThreshold).not.toHaveBeenCalled();

      // Advance 1 more second — now fires
      vi.advanceTimersByTime(1_000);
      expect(onThreshold).toHaveBeenCalledWith('ROOM1', 'north');
    });
  });

  // Verifies: REQ-F-DC04, KM01 — threshold crossing fires callback.
  describe('threshold crossing', () => {
    it('fires onThresholdCrossed after threshold time', () => {
      const onThreshold = vi.fn();
      handler.onThresholdCrossed = onThreshold;
      handler.handleDisconnect('ROOM1', 'north');

      vi.advanceTimersByTime(5_000);
      expect(onThreshold).toHaveBeenCalledWith('ROOM1', 'north');
    });

    it('does not fire before threshold time', () => {
      const onThreshold = vi.fn();
      handler.onThresholdCrossed = onThreshold;
      handler.handleDisconnect('ROOM1', 'north');

      vi.advanceTimersByTime(4_999);
      expect(onThreshold).not.toHaveBeenCalled();
    });

    it('fires independently per seat', () => {
      const onThreshold = vi.fn();
      handler.onThresholdCrossed = onThreshold;
      handler.handleDisconnect('ROOM1', 'north');

      vi.advanceTimersByTime(2_000);
      handler.handleDisconnect('ROOM1', 'east');

      // North fires at 5s
      vi.advanceTimersByTime(3_000);
      expect(onThreshold).toHaveBeenCalledTimes(1);
      expect(onThreshold).toHaveBeenCalledWith('ROOM1', 'north');

      // East fires at 7s (2s + 5s)
      vi.advanceTimersByTime(2_000);
      expect(onThreshold).toHaveBeenCalledTimes(2);
      expect(onThreshold).toHaveBeenCalledWith('ROOM1', 'east');
    });

    it('marks seat as having crossed threshold', () => {
      handler.handleDisconnect('ROOM1', 'north');
      expect(handler.getSeatsOverThreshold('ROOM1')).toEqual([]);

      vi.advanceTimersByTime(5_000);
      expect(handler.getSeatsOverThreshold('ROOM1')).toEqual(['north']);
    });
  });

  // Verifies: REQ-F-DC04 — getDisconnectDurationMs tracks elapsed time.
  describe('getDisconnectDurationMs', () => {
    it('returns elapsed time since disconnect', () => {
      handler.handleDisconnect('ROOM1', 'north');
      vi.advanceTimersByTime(3_000);
      expect(handler.getDisconnectDurationMs('ROOM1', 'north')).toBe(3_000);
    });

    it('returns 0 for a non-disconnected seat', () => {
      expect(handler.getDisconnectDurationMs('ROOM1', 'north')).toBe(0);
    });

    it('returns 0 after reconnect', () => {
      handler.handleDisconnect('ROOM1', 'north');
      vi.advanceTimersByTime(3_000);
      handler.handleReconnect('ROOM1', 'north');
      expect(handler.getDisconnectDurationMs('ROOM1', 'north')).toBe(0);
    });
  });

  // Verifies: back-compat — handleVote is a no-op.
  describe('handleVote (back-compat no-op)', () => {
    it('returns "pending" regardless of input', () => {
      handler.handleDisconnect('ROOM1', 'north');
      const result: VoteOutcome = handler.handleVote('ROOM1', 'east', 'kick');
      expect(result).toBe('pending');
    });
  });

  // Verifies: getVoteStatus always returns null (legacy UI support).
  describe('getVoteStatus (legacy)', () => {
    it('returns null regardless of disconnect state', () => {
      expect(handler.getVoteStatus('ROOM1')).toBeNull();
      handler.handleDisconnect('ROOM1', 'north');
      expect(handler.getVoteStatus('ROOM1')).toBeNull();
    });
  });

  describe('cleanupRoom', () => {
    it('removes all state for a room', () => {
      handler.handleDisconnect('ROOM1', 'north');
      handler.cleanupRoom('ROOM1');
      expect(handler.isDisconnected('ROOM1', 'north')).toBe(false);
      expect(handler.getDisconnectedSeats('ROOM1')).toEqual([]);
    });

    it('prevents threshold from firing post-cleanup', () => {
      const onThreshold = vi.fn();
      handler.onThresholdCrossed = onThreshold;
      handler.handleDisconnect('ROOM1', 'north');
      handler.cleanupRoom('ROOM1');

      vi.advanceTimersByTime(10_000);
      expect(onThreshold).not.toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('cancels all timers across rooms', () => {
      handler.handleDisconnect('ROOM1', 'north');
      handler.handleDisconnect('ROOM2', 'east');
      handler.dispose();

      const onThreshold = vi.fn();
      handler.onThresholdCrossed = onThreshold;
      vi.advanceTimersByTime(10_000);
      expect(onThreshold).not.toHaveBeenCalled();
    });
  });

  describe('freeze status (solo-human pause)', () => {
    it('isFrozen returns true when frozen flag was passed', () => {
      handler.handleDisconnect('ROOM1', 'north', { frozen: true, graceTimeoutMs: 60_000 });
      expect(handler.isFrozen('ROOM1')).toBe(true);
    });

    it('isFrozen returns false for a normal (non-frozen) disconnect', () => {
      handler.handleDisconnect('ROOM1', 'north');
      expect(handler.isFrozen('ROOM1')).toBe(false);
    });

    it('isFrozen returns false when no session exists', () => {
      expect(handler.isFrozen('ROOM1')).toBe(false);
    });

    it('isFrozen returns false after reconnect clears the session', () => {
      handler.handleDisconnect('ROOM1', 'north', { frozen: true, graceTimeoutMs: 60_000 });
      expect(handler.isFrozen('ROOM1')).toBe(true);

      handler.handleReconnect('ROOM1', 'north');
      expect(handler.isFrozen('ROOM1')).toBe(false);
    });

    it('fires onVoteResult with "kick" after frozen grace expires', () => {
      const onResult = vi.fn();
      handler.onVoteResult = onResult;
      handler.handleDisconnect('ROOM1', 'north', { frozen: true, graceTimeoutMs: 5_000 });

      vi.advanceTimersByTime(5_000);
      expect(onResult).toHaveBeenCalledWith('ROOM1', 'kick', ['north']);
    });

    it('isFrozen returns false after grace expiry', () => {
      handler.handleDisconnect('ROOM1', 'north', { frozen: true, graceTimeoutMs: 5_000 });
      vi.advanceTimersByTime(5_000);
      expect(handler.isFrozen('ROOM1')).toBe(false);
    });

    it('isFrozen returns false after cleanupRoom', () => {
      handler.handleDisconnect('ROOM1', 'north', { frozen: true, graceTimeoutMs: 60_000 });
      handler.cleanupRoom('ROOM1');
      expect(handler.isFrozen('ROOM1')).toBe(false);
    });

    it('does not fire threshold callback for frozen sessions', () => {
      const onThreshold = vi.fn();
      handler.onThresholdCrossed = onThreshold;
      handler.handleDisconnect('ROOM1', 'north', { frozen: true, graceTimeoutMs: 60_000 });

      vi.advanceTimersByTime(130_000);
      expect(onThreshold).not.toHaveBeenCalled();
    });
  });

  describe('R3: reconnect bypass (regression)', () => {
    it('never broadcasts anything that would trigger seat-claim flow on reconnect', () => {
      handler.handleDisconnect('ROOM1', 'north');
      (broadcaster.broadcastToRoom as any).mockClear();

      handler.handleReconnect('ROOM1', 'north');

      const calls = (broadcaster.broadcastToRoom as any).mock.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0][1]).toEqual({ type: 'PLAYER_RECONNECTED', seat: 'north' });
    });
  });
});
