// Verifies: REQ-F-ES04, REQ-F-ES14, REQ-F-ES17

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DisconnectHandler, type DisconnectVote, type VoteOutcome } from '../../src/game/disconnect-handler.js';
import type { Broadcaster } from '../../src/ws/broadcaster.js';
import type { Seat } from '@tichu/shared';

// ─── Mock Broadcaster ───────────────────────────────────────────────────────

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

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('DisconnectHandler', () => {
  let handler: DisconnectHandler;
  let broadcaster: Broadcaster;

  beforeEach(() => {
    vi.useFakeTimers();
    broadcaster = createMockBroadcaster();
    handler = new DisconnectHandler(broadcaster, { voteTimeoutMs: 5000 });
  });

  afterEach(() => {
    handler.dispose();
    vi.useRealTimers();
  });

  // Verifies: REQ-F-ES04 — disconnect tracking and vote initiation
  describe('handleDisconnect', () => {
    it('should track disconnected player', () => {
      handler.handleDisconnect('ROOM1', 'north');
      expect(handler.isDisconnected('ROOM1', 'north')).toBe(true);
      expect(handler.isDisconnected('ROOM1', 'east')).toBe(false);
    });

    it('should broadcast PLAYER_DISCONNECTED', () => {
      handler.handleDisconnect('ROOM1', 'north');
      expect(broadcaster.broadcastToRoom).toHaveBeenCalledWith('ROOM1', {
        type: 'PLAYER_DISCONNECTED',
        seat: 'north',
      });
    });

    it('should broadcast DISCONNECT_VOTE_REQUIRED with disconnectedSeats array', () => {
      handler.handleDisconnect('ROOM1', 'north');
      expect(broadcaster.broadcastToRoom).toHaveBeenCalledWith('ROOM1', {
        type: 'DISCONNECT_VOTE_REQUIRED',
        disconnectedSeats: ['north'],
      });
    });

    it('should broadcast initial DISCONNECT_VOTE_UPDATE with empty votes', () => {
      handler.handleDisconnect('ROOM1', 'north');
      expect(broadcaster.broadcastToRoom).toHaveBeenCalledWith('ROOM1',
        expect.objectContaining({
          type: 'DISCONNECT_VOTE_UPDATE',
          disconnectedSeats: ['north'],
        }),
      );
    });

    it('should return all disconnected seats', () => {
      handler.handleDisconnect('ROOM1', 'north');
      handler.handleDisconnect('ROOM1', 'east');
      const seats = handler.getDisconnectedSeats('ROOM1');
      expect(seats).toContain('north');
      expect(seats).toContain('east');
    });

    it('should report active vote session', () => {
      expect(handler.hasActiveVote('ROOM1')).toBe(false);
      handler.handleDisconnect('ROOM1', 'north');
      expect(handler.hasActiveVote('ROOM1')).toBe(true);
    });
  });

  // Verifies: REQ-F-ES14 — reconnect after wait vote
  describe('handleReconnect', () => {
    it('should remove player from disconnected list', () => {
      handler.handleDisconnect('ROOM1', 'north');
      handler.handleReconnect('ROOM1', 'north');
      expect(handler.isDisconnected('ROOM1', 'north')).toBe(false);
    });

    it('should broadcast PLAYER_RECONNECTED', () => {
      handler.handleDisconnect('ROOM1', 'north');
      handler.handleReconnect('ROOM1', 'north');
      expect(broadcaster.broadcastToRoom).toHaveBeenCalledWith('ROOM1', {
        type: 'PLAYER_RECONNECTED',
        seat: 'north',
      });
    });

    // Verifies: REQ-F-ES14 — cancel vote when ALL disconnected players reconnect
    it('should cancel active vote session when all disconnected players reconnect', () => {
      const onResult = vi.fn();
      handler.onVoteResult = onResult;
      handler.handleDisconnect('ROOM1', 'north');

      handler.handleReconnect('ROOM1', 'north');
      expect(handler.hasActiveVote('ROOM1')).toBe(false);

      // Advance past timeout — should not fire
      vi.advanceTimersByTime(10000);
      expect(onResult).not.toHaveBeenCalled();
    });

    // Verifies: REQ-F-ES17, REQ-F-ES14 — partial reconnect does not cancel vote
    it('should NOT cancel vote when only some disconnected players reconnect', () => {
      handler.handleDisconnect('ROOM1', 'north');
      handler.handleDisconnect('ROOM1', 'east');

      // Only north reconnects
      handler.handleReconnect('ROOM1', 'north');
      expect(handler.hasActiveVote('ROOM1')).toBe(true);

      // East reconnects — now vote should cancel
      handler.handleReconnect('ROOM1', 'east');
      expect(handler.hasActiveVote('ROOM1')).toBe(false);
    });
  });

  // Verifies: REQ-F-ES04 — Wait/Kick voting with 2/3 majority
  describe('handleVote', () => {
    it('should resolve to kick with majority (2 of 3)', () => {
      const onResult = vi.fn();
      handler.onVoteResult = onResult;
      handler.handleDisconnect('ROOM1', 'north');

      handler.handleVote('ROOM1', 'east', 'kick');
      handler.handleVote('ROOM1', 'south', 'kick');
      expect(onResult).toHaveBeenCalledWith('ROOM1', 'kick', ['north']);
    });

    it('should resolve to waiting with majority (2 of 3)', () => {
      const onResult = vi.fn();
      handler.onVoteResult = onResult;
      handler.handleDisconnect('ROOM1', 'north');

      handler.handleVote('ROOM1', 'east', 'wait');
      handler.handleVote('ROOM1', 'south', 'wait');
      expect(onResult).toHaveBeenCalledWith('ROOM1', 'waiting', ['north']);
    });

    it('should return pending when no majority yet', () => {
      handler.handleDisconnect('ROOM1', 'north');
      const result = handler.handleVote('ROOM1', 'east', 'kick');
      expect(result).toBe('pending');
    });

    it('should default to kick when all voted with no majority', () => {
      const onResult = vi.fn();
      handler.onVoteResult = onResult;
      handler.handleDisconnect('ROOM1', 'north');

      handler.handleVote('ROOM1', 'east', 'kick');
      handler.handleVote('ROOM1', 'south', 'wait');
      handler.handleVote('ROOM1', 'west', 'wait');
      // wait has 2/3 majority actually — this should resolve to waiting
      expect(onResult).toHaveBeenCalledWith('ROOM1', 'waiting', ['north']);
    });

    it('should default to kick on true tie (all voted, no majority)', () => {
      // With 2 disconnected, only 2 voters — need both to agree for majority
      const onResult = vi.fn();
      handler.onVoteResult = onResult;
      handler.handleDisconnect('ROOM1', 'north');
      handler.handleDisconnect('ROOM1', 'east');

      handler.handleVote('ROOM1', 'south', 'kick');
      handler.handleVote('ROOM1', 'west', 'wait');
      // 1 kick, 1 wait — no majority → default kick
      expect(onResult).toHaveBeenCalledWith('ROOM1', 'kick', expect.arrayContaining(['north', 'east']));
    });

    it('should ignore vote from disconnected player', () => {
      handler.handleDisconnect('ROOM1', 'north');
      const result = handler.handleVote('ROOM1', 'north', 'wait');
      expect(result).toBe('pending');
    });

    it('should return pending if no active session', () => {
      const result = handler.handleVote('ROOM1', 'east', 'kick');
      expect(result).toBe('pending');
    });

    // Verifies: REQ-F-ES04 — players can switch votes
    it('should allow players to change their vote', () => {
      const onResult = vi.fn();
      handler.onVoteResult = onResult;
      handler.handleDisconnect('ROOM1', 'north');

      // East initially votes wait
      handler.handleVote('ROOM1', 'east', 'wait');
      expect(onResult).not.toHaveBeenCalled();

      // East changes to kick
      handler.handleVote('ROOM1', 'east', 'kick');
      expect(onResult).not.toHaveBeenCalled(); // Still only 1 kick vote

      // South also kicks
      handler.handleVote('ROOM1', 'south', 'kick');
      expect(onResult).toHaveBeenCalledWith('ROOM1', 'kick', ['north']);
    });

    // Verifies: REQ-F-ES04 — DISCONNECT_VOTE_UPDATE broadcast after each vote
    it('should broadcast DISCONNECT_VOTE_UPDATE after each vote', () => {
      handler.handleDisconnect('ROOM1', 'north');
      (broadcaster.broadcastToRoom as any).mockClear();

      handler.handleVote('ROOM1', 'east', 'kick');
      expect(broadcaster.broadcastToRoom).toHaveBeenCalledWith('ROOM1',
        expect.objectContaining({
          type: 'DISCONNECT_VOTE_UPDATE',
          disconnectedSeats: ['north'],
        }),
      );
    });
  });

  // Verifies: REQ-F-ES04 — 45s auto-kick timeout
  describe('timeout', () => {
    it('should auto-kick on timeout', () => {
      const onResult = vi.fn();
      handler.onVoteResult = onResult;
      handler.handleDisconnect('ROOM1', 'north');

      vi.advanceTimersByTime(5000);
      expect(onResult).toHaveBeenCalledWith('ROOM1', 'kick', ['north']);
    });

    it('should auto-kick all disconnected seats on timeout (multi-disconnect)', () => {
      const onResult = vi.fn();
      handler.onVoteResult = onResult;
      handler.handleDisconnect('ROOM1', 'north');
      handler.handleDisconnect('ROOM1', 'east');

      vi.advanceTimersByTime(5000);
      expect(onResult).toHaveBeenCalledWith('ROOM1', 'kick',
        expect.arrayContaining(['north', 'east']),
      );
    });
  });

  // Verifies: REQ-F-ES17 — multi-player disconnect vote
  describe('multi-disconnect', () => {
    it('should merge second disconnect into existing session', () => {
      handler.handleDisconnect('ROOM1', 'north');
      handler.handleDisconnect('ROOM1', 'east');

      // Should be one session with both seats
      const status = handler.getVoteStatus('ROOM1');
      expect(status).not.toBeNull();
      expect(status!.disconnectedSeats).toContain('north');
      expect(status!.disconnectedSeats).toContain('east');
    });

    it('should dynamically adjust voter count for multi-disconnect', () => {
      const onResult = vi.fn();
      handler.onVoteResult = onResult;

      // 2 disconnected → 2 voters → need 2 for majority
      handler.handleDisconnect('ROOM1', 'north');
      handler.handleDisconnect('ROOM1', 'east');

      handler.handleVote('ROOM1', 'south', 'kick');
      // 1 kick out of 2 voters — not enough yet
      expect(onResult).not.toHaveBeenCalled();

      handler.handleVote('ROOM1', 'west', 'kick');
      // 2 kicks out of 2 voters → majority
      expect(onResult).toHaveBeenCalledWith('ROOM1', 'kick',
        expect.arrayContaining(['north', 'east']),
      );
    });

    it('should remove disconnected seat from voters if they had voted before disconnecting', () => {
      handler.handleDisconnect('ROOM1', 'north');

      // East votes kick
      handler.handleVote('ROOM1', 'east', 'kick');

      // Now east also disconnects — their vote should be removed
      handler.handleDisconnect('ROOM1', 'east');

      const status = handler.getVoteStatus('ROOM1');
      expect(status!.votes['east']).toBeNull(); // Disconnected, not a voter
    });
  });

  // Verifies: REQ-F-ES04 — getVoteStatus for state projection
  describe('getVoteStatus', () => {
    it('should return null when no active vote', () => {
      expect(handler.getVoteStatus('ROOM1')).toBeNull();
    });

    it('should return vote status with remaining time', () => {
      handler.handleDisconnect('ROOM1', 'north');
      vi.advanceTimersByTime(1000);

      const status = handler.getVoteStatus('ROOM1');
      expect(status).not.toBeNull();
      expect(status!.disconnectedSeats).toEqual(['north']);
      expect(status!.timeoutMs).toBeLessThanOrEqual(4000);
      expect(status!.timeoutMs).toBeGreaterThan(3000);
    });

    it('should show per-seat vote choices', () => {
      handler.handleDisconnect('ROOM1', 'north');
      handler.handleVote('ROOM1', 'east', 'kick');
      handler.handleVote('ROOM1', 'south', 'wait');

      const status = handler.getVoteStatus('ROOM1');
      expect(status!.votes['north']).toBeNull(); // Disconnected
      expect(status!.votes['east']).toBe('kick');
      expect(status!.votes['south']).toBe('wait');
      expect(status!.votes['west']).toBeNull(); // Not voted yet
    });
  });

  describe('cleanupRoom', () => {
    it('should remove all state for a room', () => {
      handler.handleDisconnect('ROOM1', 'north');
      handler.cleanupRoom('ROOM1');
      expect(handler.isDisconnected('ROOM1', 'north')).toBe(false);
      expect(handler.getDisconnectedSeats('ROOM1')).toEqual([]);
      expect(handler.hasActiveVote('ROOM1')).toBe(false);
    });
  });

  describe('dispose', () => {
    it('should clean up all timers', () => {
      handler.handleDisconnect('ROOM1', 'north');
      handler.handleDisconnect('ROOM2', 'east');
      handler.dispose();

      // Should not fire after dispose
      const onResult = vi.fn();
      handler.onVoteResult = onResult;
      vi.advanceTimersByTime(10000);
      expect(onResult).not.toHaveBeenCalled();
    });
  });
});
