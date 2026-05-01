// Verifies: REQ-F-SJ12, REQ-F-SJ13 (supersedes REQ-F-ES04/ES14/ES17 vote scheme).

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

describe('DisconnectHandler — passive grace period (REQ-F-SJ12, SJ13)', () => {
  let handler: DisconnectHandler;
  let broadcaster: Broadcaster;

  beforeEach(() => {
    vi.useFakeTimers();
    broadcaster = createMockBroadcaster();
    // Short grace window for faster tests.
    handler = new DisconnectHandler(broadcaster, { graceTimeoutMs: 60_000 });
  });

  afterEach(() => {
    handler.dispose();
    vi.useRealTimers();
  });

  // Verifies: REQ-F-SJ12 — seat is held, not vacated, on disconnect.
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

    it('does NOT broadcast DISCONNECT_VOTE_REQUIRED or DISCONNECT_VOTE_UPDATE (vote scheme removed)', () => {
      handler.handleDisconnect('ROOM1', 'north');
      const calls = (broadcaster.broadcastToRoom as any).mock.calls;
      const voteMessages = calls.filter(
        ([, msg]: [string, { type: string }]) =>
          msg.type === 'DISCONNECT_VOTE_REQUIRED' || msg.type === 'DISCONNECT_VOTE_UPDATE',
      );
      expect(voteMessages).toHaveLength(0);
    });

    it('tracks multiple disconnects in the same room', () => {
      handler.handleDisconnect('ROOM1', 'north');
      handler.handleDisconnect('ROOM1', 'east');
      const seats = handler.getDisconnectedSeats('ROOM1');
      expect(seats).toContain('north');
      expect(seats).toContain('east');
    });

    // Verifies: REQ-F-NF-SJ04 implied — hasActiveVote always false so kick/restart
    // votes are not artificially blocked during grace windows.
    it('hasActiveVote always returns false (no vote scheme)', () => {
      expect(handler.hasActiveVote('ROOM1')).toBe(false);
      handler.handleDisconnect('ROOM1', 'north');
      expect(handler.hasActiveVote('ROOM1')).toBe(false);
    });
  });

  // Verifies: REQ-F-SJ12 — reconnect within grace restores seat without validation.
  describe('handleReconnect (within grace)', () => {
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

    // Verifies: REQ-F-SJ12 — reconnect within grace cancels the timer; the
    // onVoteResult callback must NOT fire.
    it('cancels the grace timer so the seat is never released', () => {
      const onResult = vi.fn();
      handler.onVoteResult = onResult;
      handler.handleDisconnect('ROOM1', 'north');

      handler.handleReconnect('ROOM1', 'north');

      // Advance past the grace window — should not fire.
      vi.advanceTimersByTime(70_000);
      expect(onResult).not.toHaveBeenCalled();
    });

    it('keeps the grace active if other seats are still disconnected', () => {
      const onResult = vi.fn();
      handler.onVoteResult = onResult;
      handler.handleDisconnect('ROOM1', 'north');
      handler.handleDisconnect('ROOM1', 'east');

      handler.handleReconnect('ROOM1', 'north');
      // Advancing past grace should release east only.
      vi.advanceTimersByTime(60_000);
      expect(onResult).toHaveBeenCalledWith('ROOM1', 'kick', ['east']);
    });
  });

  // Verifies: REQ-F-SJ12, SJ13 — grace expiry releases held seats.
  describe('grace expiry', () => {
    it('fires onVoteResult with "kick" after the grace window', () => {
      const onResult = vi.fn();
      handler.onVoteResult = onResult;
      handler.handleDisconnect('ROOM1', 'north');

      vi.advanceTimersByTime(60_000);
      expect(onResult).toHaveBeenCalledWith('ROOM1', 'kick', ['north']);
    });

    it('does not fire before the grace window elapses', () => {
      const onResult = vi.fn();
      handler.onVoteResult = onResult;
      handler.handleDisconnect('ROOM1', 'north');

      vi.advanceTimersByTime(59_999);
      expect(onResult).not.toHaveBeenCalled();
    });

    it('releases all seats that joined the same grace window', () => {
      const onResult = vi.fn();
      handler.onVoteResult = onResult;
      handler.handleDisconnect('ROOM1', 'north');
      handler.handleDisconnect('ROOM1', 'east');

      vi.advanceTimersByTime(60_000);
      expect(onResult).toHaveBeenCalledWith(
        'ROOM1',
        'kick',
        expect.arrayContaining(['north', 'east']),
      );
    });

    it('clears session state once fired', () => {
      const onResult = vi.fn();
      handler.onVoteResult = onResult;
      handler.handleDisconnect('ROOM1', 'north');

      vi.advanceTimersByTime(60_000);
      expect(handler.isDisconnected('ROOM1', 'north')).toBe(true); // tracking set is independent
      expect(handler.hasActiveVote('ROOM1')).toBe(false);
      expect(handler.getVoteStatus('ROOM1')).toBeNull();
    });
  });

  // Verifies: REQ-F-SJ12 — handleVote is a no-op; the client protocol still
  // accepts DISCONNECT_VOTE messages until the client UI is removed in M5.
  describe('handleVote (back-compat no-op)', () => {
    it('returns "pending" regardless of input', () => {
      handler.handleDisconnect('ROOM1', 'north');
      const result: VoteOutcome = handler.handleVote('ROOM1', 'east', 'kick');
      expect(result).toBe('pending');
    });

    it('does not trigger the kick callback', () => {
      const onResult = vi.fn();
      handler.onVoteResult = onResult;
      handler.handleDisconnect('ROOM1', 'north');

      handler.handleVote('ROOM1', 'east', 'kick');
      handler.handleVote('ROOM1', 'south', 'kick');
      handler.handleVote('ROOM1', 'west', 'kick');
      expect(onResult).not.toHaveBeenCalled();
    });
  });

  // Verifies: REQ-F-SJ12 — projection sees disconnected seats + remaining grace.
  describe('getVoteStatus (for state projection)', () => {
    it('returns null when no seat is under grace', () => {
      expect(handler.getVoteStatus('ROOM1')).toBeNull();
    });

    it('returns disconnected seats and remaining grace time', () => {
      handler.handleDisconnect('ROOM1', 'north');
      vi.advanceTimersByTime(15_000);

      const status = handler.getVoteStatus('ROOM1');
      expect(status).not.toBeNull();
      expect(status!.disconnectedSeats).toEqual(['north']);
      // Remaining ≈ 45s of the 60s window.
      expect(status!.timeoutMs).toBeLessThanOrEqual(45_000);
      expect(status!.timeoutMs).toBeGreaterThan(44_000);
    });

    it('returns an empty votes map (vote scheme removed)', () => {
      handler.handleDisconnect('ROOM1', 'north');
      const status = handler.getVoteStatus('ROOM1');
      expect(status!.votes).toEqual({
        north: null,
        east: null,
        south: null,
        west: null,
      });
    });
  });

  describe('cleanupRoom', () => {
    it('removes all grace state for a room', () => {
      handler.handleDisconnect('ROOM1', 'north');
      handler.cleanupRoom('ROOM1');
      expect(handler.isDisconnected('ROOM1', 'north')).toBe(false);
      expect(handler.getDisconnectedSeats('ROOM1')).toEqual([]);
      expect(handler.getVoteStatus('ROOM1')).toBeNull();
    });

    it('prevents the timer from firing post-cleanup', () => {
      const onResult = vi.fn();
      handler.onVoteResult = onResult;
      handler.handleDisconnect('ROOM1', 'north');
      handler.cleanupRoom('ROOM1');

      vi.advanceTimersByTime(60_000);
      expect(onResult).not.toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('cancels all timers across rooms', () => {
      handler.handleDisconnect('ROOM1', 'north');
      handler.handleDisconnect('ROOM2', 'east');
      handler.dispose();

      const onResult = vi.fn();
      handler.onVoteResult = onResult;
      vi.advanceTimersByTime(60_000);
      expect(onResult).not.toHaveBeenCalled();
    });
  });

  // Verifies: R3 regression — "reconnect within grace does not touch
  // seat-claim eligibility." The handler knows nothing about eligibility,
  // so this is a negative structural check: reconnect flow is internal.
  describe('R3: reconnect bypass (regression)', () => {
    it('never broadcasts anything that would trigger seat-claim flow on reconnect', () => {
      handler.handleDisconnect('ROOM1', 'north');
      (broadcaster.broadcastToRoom as any).mockClear();

      handler.handleReconnect('ROOM1', 'north');

      const calls = (broadcaster.broadcastToRoom as any).mock.calls;
      // The only broadcast on reconnect is PLAYER_RECONNECTED.
      expect(calls).toHaveLength(1);
      expect(calls[0][1]).toEqual({ type: 'PLAYER_RECONNECTED', seat: 'north' });
    });
  });

  describe('variable grace timeout', () => {
    it('per-disconnect timeout overrides constructor default', () => {
      const onResult = vi.fn();
      handler.onVoteResult = onResult;

      // Constructor default is 60_000, pass 5_000 per-call
      handler.handleDisconnect('ROOM1', 'north', { graceTimeoutMs: 5_000 });

      // Should NOT fire after 4s
      vi.advanceTimersByTime(4_000);
      expect(onResult).not.toHaveBeenCalled();

      // Should fire after 5s
      vi.advanceTimersByTime(1_000);
      expect(onResult).toHaveBeenCalledWith('ROOM1', 'kick', ['north']);
    });

    it('constructor default used when no per-call timeout provided', () => {
      const onResult = vi.fn();
      handler.onVoteResult = onResult;

      // No options passed, should use constructor default of 60_000
      handler.handleDisconnect('ROOM1', 'north');

      vi.advanceTimersByTime(59_999);
      expect(onResult).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(onResult).toHaveBeenCalledWith('ROOM1', 'kick', ['north']);
    });

    it('second disconnect in same room does not reset the timer', () => {
      const onResult = vi.fn();
      handler.onVoteResult = onResult;

      // First disconnect with 10s timeout
      handler.handleDisconnect('ROOM1', 'north', { graceTimeoutMs: 10_000 });

      // Advance 5s
      vi.advanceTimersByTime(5_000);

      // Second disconnect with 20s timeout (should be ignored, merged into existing)
      handler.handleDisconnect('ROOM1', 'east', { graceTimeoutMs: 20_000 });

      // Original 10s timer should fire at 10s total (5s more)
      vi.advanceTimersByTime(5_000);
      expect(onResult).toHaveBeenCalledWith(
        'ROOM1',
        'kick',
        expect.arrayContaining(['north', 'east'])
      );
    });
  });

  describe('freeze status (solo-human pause)', () => {
    it('isFrozen returns true when frozen flag was passed', () => {
      handler.handleDisconnect('ROOM1', 'north', { frozen: true });
      expect(handler.isFrozen('ROOM1')).toBe(true);
    });

    it('isFrozen returns false for a normal (non-frozen) disconnect', () => {
      handler.handleDisconnect('ROOM1', 'north', { frozen: false });
      expect(handler.isFrozen('ROOM1')).toBe(false);
    });

    it('isFrozen returns false when no session exists', () => {
      expect(handler.isFrozen('ROOM1')).toBe(false);
    });

    it('isFrozen returns false after reconnect clears the session', () => {
      handler.handleDisconnect('ROOM1', 'north', { frozen: true });
      expect(handler.isFrozen('ROOM1')).toBe(true);

      handler.handleReconnect('ROOM1', 'north');
      expect(handler.isFrozen('ROOM1')).toBe(false);
    });

    it('isFrozen returns false after grace expiry', () => {
      handler.handleDisconnect('ROOM1', 'north', { frozen: true, graceTimeoutMs: 5_000 });
      expect(handler.isFrozen('ROOM1')).toBe(true);

      vi.advanceTimersByTime(5_000);
      expect(handler.isFrozen('ROOM1')).toBe(false);
    });

    it('isFrozen returns false after cleanupRoom', () => {
      handler.handleDisconnect('ROOM1', 'north', { frozen: true });
      expect(handler.isFrozen('ROOM1')).toBe(true);

      handler.cleanupRoom('ROOM1');
      expect(handler.isFrozen('ROOM1')).toBe(false);
    });
  });
});
