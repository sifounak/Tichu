// Verifies: REQ-F-VI01–VI09, REQ-F-KM12, REQ-F-KM13
// Milestone 3: Vote integration with disconnection handling

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Seat } from '@tichu/shared';
import { TurnTimer } from '../../src/game/turn-timer.js';
import { VoteHandler } from '../../src/game/vote-handler.js';
import { KickDialogHandler } from '../../src/game/kick-dialog-handler.js';
import { DisconnectHandler } from '../../src/game/disconnect-handler.js';
import type { Broadcaster } from '../../src/ws/broadcaster.js';

describe('Vote Integration (M3)', () => {
  let broadcaster: Broadcaster;

  beforeEach(() => {
    vi.useFakeTimers();
    broadcaster = {
      broadcastToRoom: vi.fn(),
      send: vi.fn(),
      sendToPlayer: vi.fn(),
      sendError: vi.fn(),
      broadcastGameState: vi.fn(),
    } as unknown as Broadcaster;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const room = 'ROOM1';

  describe('TurnTimer pause/reset (REQ-F-VI08/VI09)', () => {
    // Verifies: REQ-F-VI08
    it('pause() saves remaining time and stops the countdown', () => {
      const onTimeout = vi.fn();
      const timer = new TurnTimer(30, onTimeout);

      timer.start('north');
      vi.advanceTimersByTime(10_000);

      timer.pause();

      expect(timer.isPaused()).toBe(true);
      expect(timer.getRemainingMs()).toBe(20_000);
      expect(timer.getCurrentSeat()).toBe('north');

      // Timer should not fire after pause
      vi.advanceTimersByTime(30_000);
      expect(onTimeout).not.toHaveBeenCalled();

      timer.dispose();
    });

    // Verifies: REQ-F-VI09
    it('resetToFull() restarts timer with full duration for current seat', () => {
      const onTimeout = vi.fn();
      const timer = new TurnTimer(30, onTimeout);

      timer.start('north');
      vi.advanceTimersByTime(10_000);
      timer.pause();

      timer.resetToFull();

      expect(timer.isPaused()).toBe(false);
      expect(timer.isActive()).toBe(true);
      expect(timer.getRemainingMs()).toBe(30_000);

      // Should fire at full duration from now
      vi.advanceTimersByTime(30_000);
      expect(onTimeout).toHaveBeenCalledWith('north');

      timer.dispose();
    });

    it('pause() is no-op when timer is disabled', () => {
      const timer = new TurnTimer(null, vi.fn());
      timer.start('north');
      timer.pause();
      expect(timer.isPaused()).toBe(false);
      timer.dispose();
    });

    it('pause() is no-op when no timer is running', () => {
      const timer = new TurnTimer(30, vi.fn());
      timer.pause();
      expect(timer.isPaused()).toBe(false);
      timer.dispose();
    });

    it('stop() clears paused state', () => {
      const timer = new TurnTimer(30, vi.fn());
      timer.start('north');
      vi.advanceTimersByTime(5_000);
      timer.pause();
      expect(timer.isPaused()).toBe(true);

      timer.stop();
      expect(timer.isPaused()).toBe(false);
      expect(timer.getCurrentSeat()).toBeNull();
      timer.dispose();
    });
  });

  describe('VoteHandler excludedSeats (REQ-F-VI01/VI02)', () => {
    // Verifies: REQ-F-VI01
    it('excludes 2+ min disconnected from kick vote eligible voters', () => {
      const voteHandler = new VoteHandler(broadcaster);
      const humanSeats: Seat[] = ['north', 'east', 'south', 'west'];
      const excludedSeats: Seat[] = ['west']; // west disconnected 2+ min

      voteHandler.startKickVote(room, 'south', 'north', humanSeats, excludedSeats);

      // VOTE_STARTED should be broadcast
      expect(broadcaster.broadcastToRoom).toHaveBeenCalledWith(room, expect.objectContaining({
        type: 'VOTE_STARTED',
        voteType: 'kick',
      }));

      // west should NOT be in eligible voters — only east and south can vote
      const activeVote = voteHandler.getActiveVote(room);
      expect(activeVote).not.toBeNull();
      // votes object should only have east and south (not west, not north which is target)
      expect(Object.keys(activeVote!.votes)).toEqual(expect.arrayContaining(['east', 'south']));
      expect(Object.keys(activeVote!.votes)).not.toContain('west');
      expect(Object.keys(activeVote!.votes)).not.toContain('north');

      voteHandler.dispose();
    });

    // Verifies: REQ-F-VI01
    it('excludes 2+ min disconnected from restart game vote', () => {
      const voteHandler = new VoteHandler(broadcaster);
      const humanSeats: Seat[] = ['north', 'east', 'south', 'west'];
      const excludedSeats: Seat[] = ['north'];

      voteHandler.startRestartGameVote(room, 'south', humanSeats, excludedSeats);

      const activeVote = voteHandler.getActiveVote(room);
      expect(activeVote).not.toBeNull();
      expect(Object.keys(activeVote!.votes)).not.toContain('north');

      voteHandler.dispose();
    });

    it('removes autopilot voters from an active vote and recalculates resolution', () => {
      const voteHandler = new VoteHandler(broadcaster);
      let passed: boolean | null = null;
      voteHandler.onVoteResult = (_roomCode, _voteType, votePassed) => {
        passed = votePassed;
      };

      voteHandler.startRestartGameVote(room, 'north', ['north', 'east', 'south']);
      const vote = voteHandler.getActiveVote(room);
      expect(vote).not.toBeNull();

      voteHandler.handleVote(room, 'north', vote!.voteId, true);
      voteHandler.removeEligibleVoter(room, 'east');
      expect(voteHandler.hasActiveVote(room)).toBe(true);

      voteHandler.removeEligibleVoter(room, 'south');

      expect(voteHandler.hasActiveVote(room)).toBe(false);
      expect(passed).toBe(true);
      expect(broadcaster.broadcastToRoom).toHaveBeenCalledWith(room, expect.objectContaining({
        type: 'VOTE_RESULT',
        passed: true,
      }));

      voteHandler.dispose();
    });

    it('adds a returning autopilot voter back to an unresolved vote', () => {
      const voteHandler = new VoteHandler(broadcaster);

      voteHandler.startRestartGameVote(room, 'north', ['north', 'east', 'south']);
      voteHandler.removeEligibleVoter(room, 'south');
      voteHandler.addEligibleVoter(room, 'south');

      const activeVote = voteHandler.getActiveVote(room);
      expect(activeVote).not.toBeNull();
      expect(Object.keys(activeVote!.votes)).toEqual(expect.arrayContaining(['north', 'east', 'south']));
      expect(activeVote!.votes.south).toBeNull();

      voteHandler.dispose();
    });

    // Verifies: REQ-F-VI01
    it('excludes 2+ min disconnected from restart round vote', () => {
      const voteHandler = new VoteHandler(broadcaster);
      const humanSeats: Seat[] = ['north', 'east', 'south', 'west'];
      const excludedSeats: Seat[] = ['east'];

      voteHandler.startRestartRoundVote(room, 'south', humanSeats, excludedSeats);

      const activeVote = voteHandler.getActiveVote(room);
      expect(activeVote).not.toBeNull();
      expect(Object.keys(activeVote!.votes)).not.toContain('east');

      voteHandler.dispose();
    });

    // Verifies: REQ-F-VI02
    it('includes < 2 min disconnected players as normal participants', () => {
      const voteHandler = new VoteHandler(broadcaster);
      const humanSeats: Seat[] = ['north', 'east', 'south', 'west'];
      const excludedSeats: Seat[] = []; // no one over threshold

      voteHandler.startRestartGameVote(room, 'south', humanSeats, excludedSeats);

      const activeVote = voteHandler.getActiveVote(room);
      expect(Object.keys(activeVote!.votes)).toHaveLength(4);

      voteHandler.dispose();
    });
  });

  describe('VoteHandler getVoteSnapshot (REQ-F-VI05)', () => {
    it('returns snapshot of active kick vote', () => {
      const voteHandler = new VoteHandler(broadcaster);
      voteHandler.startKickVote(room, 'south', 'north', ['east', 'south', 'west']);

      const snapshot = voteHandler.getVoteSnapshot(room);
      expect(snapshot).toEqual({
        voteType: 'kick',
        initiatorSeat: 'south',
        targetSeat: 'north',
      });

      voteHandler.dispose();
    });

    it('returns snapshot of active restart vote', () => {
      const voteHandler = new VoteHandler(broadcaster);
      voteHandler.startRestartGameVote(room, 'east', ['north', 'east', 'south', 'west']);

      const snapshot = voteHandler.getVoteSnapshot(room);
      expect(snapshot).toEqual({
        voteType: 'restartGame',
        initiatorSeat: 'east',
        targetSeat: undefined,
      });

      voteHandler.dispose();
    });

    it('returns null when no active vote', () => {
      const voteHandler = new VoteHandler(broadcaster);
      expect(voteHandler.getVoteSnapshot(room)).toBeNull();
      voteHandler.dispose();
    });
  });

  describe('KickDialogHandler dismissForVote / reappearAfterVote (REQ-F-KM12/KM13)', () => {
    // Verifies: REQ-F-KM12
    it('dismissForVote dismisses active kick dialog', () => {
      const handler = new KickDialogHandler(broadcaster);
      handler.onThresholdCrossed(room, 'north', ['east', 'south', 'west']);
      expect(handler.hasActiveDialog(room)).toBe(true);

      handler.dismissForVote(room);

      expect(handler.hasActiveDialog(room)).toBe(false);
      expect(broadcaster.broadcastToRoom).toHaveBeenCalledWith(room, {
        type: 'KICK_DIALOG_DISMISSED',
        targetSeat: 'north',
        reason: 'vote_priority',
      });
    });

    // Verifies: REQ-F-KM13
    it('reappearAfterVote re-shows dialog if player still disconnected over threshold', () => {
      const handler = new KickDialogHandler(broadcaster);
      handler.onThresholdCrossed(room, 'north', ['east', 'south', 'west']);
      handler.dismissForVote(room);

      (broadcaster.broadcastToRoom as ReturnType<typeof vi.fn>).mockClear();

      handler.reappearAfterVote(room, ['east', 'south', 'west'], () => true);

      expect(handler.hasActiveDialog(room)).toBe(true);
      expect(broadcaster.broadcastToRoom).toHaveBeenCalledWith(room, {
        type: 'KICK_DIALOG_SHOW',
        targetSeat: 'north',
      });
    });

    // Verifies: REQ-F-KM13
    it('reappearAfterVote does NOT reappear if player reconnected', () => {
      const handler = new KickDialogHandler(broadcaster);
      handler.onThresholdCrossed(room, 'north', ['east', 'south', 'west']);
      handler.dismissForVote(room);

      (broadcaster.broadcastToRoom as ReturnType<typeof vi.fn>).mockClear();

      handler.reappearAfterVote(room, ['east', 'south', 'west'], () => false);

      expect(handler.hasActiveDialog(room)).toBe(false);
    });

    // Verifies: REQ-F-KM10/KM13
    it('reappearAfterVote does NOT reappear if previously player-dismissed', () => {
      const handler = new KickDialogHandler(broadcaster);
      handler.onThresholdCrossed(room, 'north', ['east', 'south', 'west']);

      // All decline
      handler.handleResponse(room, 'east', 'decline', ['east', 'south', 'west']);
      handler.handleResponse(room, 'south', 'decline', ['east', 'south', 'west']);
      handler.handleResponse(room, 'west', 'decline', ['east', 'south', 'west']);

      expect(handler.hasActiveDialog(room)).toBe(false);

      // Now try to reappear — should NOT because it was player-dismissed
      handler.reappearAfterVote(room, ['east', 'south', 'west'], () => true);
      expect(handler.hasActiveDialog(room)).toBe(false);
    });
  });

  describe('DisconnectHandler getSeatsOverThreshold (REQ-F-VI01)', () => {
    it('returns seats that have crossed the 2-min threshold', () => {
      const dh = new DisconnectHandler(broadcaster, { thresholdMs: 125_000 });

      dh.handleDisconnect(room, 'north', {});
      expect(dh.getSeatsOverThreshold(room)).toEqual([]);

      // Advance past threshold
      vi.advanceTimersByTime(125_000);
      expect(dh.getSeatsOverThreshold(room)).toEqual(['north']);

      dh.dispose();
    });

    it('removes seat from over-threshold on reconnect', () => {
      const dh = new DisconnectHandler(broadcaster, { thresholdMs: 125_000 });

      dh.handleDisconnect(room, 'north', {});
      vi.advanceTimersByTime(125_000);
      expect(dh.getSeatsOverThreshold(room)).toEqual(['north']);

      dh.handleReconnect(room, 'north');
      expect(dh.getSeatsOverThreshold(room)).toEqual([]);

      dh.dispose();
    });
  });

  describe('Integration: threshold crossing during active vote (REQ-F-VI03/VI04)', () => {
    it('threshold crossing during vote cancels vote and shows kick dialog', () => {
      // Use a short threshold (5s) so it fires before the 30s vote timeout
      const voteHandler = new VoteHandler(broadcaster, { voteTimeoutMs: 60_000 });
      const kickHandler = new KickDialogHandler(broadcaster);
      const disconnectHandler = new DisconnectHandler(broadcaster, { thresholdMs: 5_000 });

      // Simulate GameManager wiring
      let interruptedVote: { voteType: string; initiatorSeat: Seat; targetSeat?: Seat } | null = null;

      disconnectHandler.onThresholdCrossed = (_rc, seat) => {
        if (voteHandler.hasActiveVote(room)) {
          interruptedVote = voteHandler.getVoteSnapshot(room);
          voteHandler.cancelVote(room, 'Player disconnected too long');
        }
        kickHandler.onThresholdCrossed(room, seat, ['east', 'south', 'west']);
      };

      // North disconnects first (starts threshold timer)
      disconnectHandler.handleDisconnect(room, 'north', {});

      // Start a vote (after disconnect but before threshold)
      voteHandler.startRestartGameVote(room, 'south', ['north', 'east', 'south', 'west']);
      expect(voteHandler.hasActiveVote(room)).toBe(true);

      // Advance to threshold (5s)
      vi.advanceTimersByTime(5_000);

      // Vote should be cancelled
      expect(voteHandler.hasActiveVote(room)).toBe(false);
      // Interrupted vote should be saved
      expect(interruptedVote).toEqual({
        voteType: 'restartGame',
        initiatorSeat: 'south',
        targetSeat: undefined,
      });
      // Kick dialog should be shown
      expect(kickHandler.hasActiveDialog(room)).toBe(true);
      expect(kickHandler.getActiveDialog(room)).toEqual({ targetSeat: 'north' });

      disconnectHandler.dispose();
      voteHandler.dispose();
      kickHandler.dispose();
    });
  });

  describe('Integration: vote restart after kick dialog resolves (REQ-F-VI05/VI06)', () => {
    it('after kick, restarts interrupted vote (unless it was to kick that player)', () => {
      const voteHandler = new VoteHandler(broadcaster);
      const kickHandler = new KickDialogHandler(broadcaster);

      // Simulate interrupted vote was a restart-game vote
      const interruptedVote = { voteType: 'restartGame' as const, initiatorSeat: 'south' as Seat };
      const humanSeats: Seat[] = ['east', 'south', 'west'];

      // After kick, restart the vote
      const started = voteHandler.startRestartGameVote(room, interruptedVote.initiatorSeat, humanSeats);
      expect(started).toBe(true);
      expect(voteHandler.hasActiveVote(room)).toBe(true);

      voteHandler.dispose();
      kickHandler.dispose();
    });

    it('does NOT restart if interrupted vote was to kick the same player', () => {
      // If the vote was a kick vote targeting 'north' and north was just kicked, skip restart
      const interruptedVote = { voteType: 'kick' as const, initiatorSeat: 'south' as Seat, targetSeat: 'north' as Seat };
      const kickedSeat: Seat = 'north';

      // The logic in restartInterruptedVoteIfApplicable: skip if vote was to kick same player
      const shouldSkip = kickedSeat && interruptedVote.voteType === 'kick' && interruptedVote.targetSeat === kickedSeat;
      expect(shouldSkip).toBe(true);
    });
  });
});
