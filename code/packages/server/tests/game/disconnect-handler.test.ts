// Verifies: REQ-F-MP08

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

    it('should broadcast DISCONNECT_VOTE_REQUIRED', () => {
      handler.handleDisconnect('ROOM1', 'north');
      expect(broadcaster.broadcastToRoom).toHaveBeenCalledWith('ROOM1', {
        type: 'DISCONNECT_VOTE_REQUIRED',
        disconnectedSeat: 'north',
      });
    });

    it('should return all disconnected seats', () => {
      handler.handleDisconnect('ROOM1', 'north');
      handler.handleDisconnect('ROOM1', 'east');
      const seats = handler.getDisconnectedSeats('ROOM1');
      expect(seats).toContain('north');
      expect(seats).toContain('east');
    });
  });

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

    it('should cancel active vote session', () => {
      const onResult = vi.fn();
      handler.onVoteResult = onResult;
      handler.handleDisconnect('ROOM1', 'north');

      // Reconnect before vote completes
      handler.handleReconnect('ROOM1', 'north');

      // Advance past timeout — should not fire
      vi.advanceTimersByTime(10000);
      expect(onResult).not.toHaveBeenCalled();
    });
  });

  describe('handleVote', () => {
    it('should resolve to replace_with_bot with majority', () => {
      const onResult = vi.fn();
      handler.onVoteResult = onResult;
      handler.handleDisconnect('ROOM1', 'north');

      handler.handleVote('ROOM1', 'east', 'bot');
      handler.handleVote('ROOM1', 'south', 'bot');
      // 2 out of 3 voted bot → majority
      expect(onResult).toHaveBeenCalledWith('ROOM1', 'replace_with_bot', 'north');
    });

    it('should resolve to game_abandoned with majority', () => {
      const onResult = vi.fn();
      handler.onVoteResult = onResult;
      handler.handleDisconnect('ROOM1', 'north');

      handler.handleVote('ROOM1', 'east', 'abandon');
      handler.handleVote('ROOM1', 'south', 'abandon');
      expect(onResult).toHaveBeenCalledWith('ROOM1', 'game_abandoned', 'north');
    });

    it('should resolve to waiting with majority', () => {
      const onResult = vi.fn();
      handler.onVoteResult = onResult;
      handler.handleDisconnect('ROOM1', 'north');

      handler.handleVote('ROOM1', 'east', 'wait');
      handler.handleVote('ROOM1', 'south', 'wait');
      expect(onResult).toHaveBeenCalledWith('ROOM1', 'waiting', 'north');
    });

    it('should return pending when no majority yet', () => {
      handler.handleDisconnect('ROOM1', 'north');
      const result = handler.handleVote('ROOM1', 'east', 'bot');
      expect(result).toBe('pending');
    });

    it('should default to bot when all voted with no majority', () => {
      const onResult = vi.fn();
      handler.onVoteResult = onResult;
      handler.handleDisconnect('ROOM1', 'north');

      handler.handleVote('ROOM1', 'east', 'bot');
      handler.handleVote('ROOM1', 'south', 'wait');
      handler.handleVote('ROOM1', 'west', 'abandon');
      // No majority (1 each) + all voted → default to bot
      expect(onResult).toHaveBeenCalledWith('ROOM1', 'replace_with_bot', 'north');
    });

    it('should ignore vote from disconnected player', () => {
      handler.handleDisconnect('ROOM1', 'north');
      const result = handler.handleVote('ROOM1', 'north', 'wait');
      expect(result).toBe('pending');
    });

    it('should return pending if no active session', () => {
      const result = handler.handleVote('ROOM1', 'east', 'bot');
      expect(result).toBe('pending');
    });
  });

  describe('timeout', () => {
    it('should default to replace_with_bot on timeout', () => {
      const onResult = vi.fn();
      handler.onVoteResult = onResult;
      handler.handleDisconnect('ROOM1', 'north');

      vi.advanceTimersByTime(5000);
      expect(onResult).toHaveBeenCalledWith('ROOM1', 'replace_with_bot', 'north');
    });
  });

  describe('cleanupRoom', () => {
    it('should remove all state for a room', () => {
      handler.handleDisconnect('ROOM1', 'north');
      handler.cleanupRoom('ROOM1');
      expect(handler.isDisconnected('ROOM1', 'north')).toBe(false);
      expect(handler.getDisconnectedSeats('ROOM1')).toEqual([]);
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
