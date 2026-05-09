// REQ-F-KM01–KM14: Unit tests for KickDialogHandler

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Seat } from '@tichu/shared';
import { KickDialogHandler } from '../../src/game/kick-dialog-handler.js';
import type { Broadcaster } from '../../src/ws/broadcaster.js';

describe('KickDialogHandler', () => {
  let handler: KickDialogHandler;
  let broadcaster: Broadcaster;

  beforeEach(() => {
    broadcaster = {
      broadcastToRoom: vi.fn(),
      send: vi.fn(),
      sendToPlayer: vi.fn(),
    } as unknown as Broadcaster;
    handler = new KickDialogHandler(broadcaster);
  });

  const room = 'ROOM1';
  const connectedSeats: Seat[] = ['north', 'east', 'south', 'west'];
  const connectedWithoutNorth: Seat[] = ['east', 'south', 'west'];

  describe('onThresholdCrossed', () => {
    // REQ-F-KM01: Disconnect threshold triggers kick dialog
    it('should show kick dialog when threshold crossed', () => {
      handler.onThresholdCrossed(room, 'north', connectedWithoutNorth);

      expect(broadcaster.broadcastToRoom).toHaveBeenCalledWith(room, {
        type: 'KICK_DIALOG_SHOW',
        targetSeat: 'north',
      });
      expect(handler.hasActiveDialog(room)).toBe(true);
      expect(handler.getActiveDialog(room)).toEqual({ targetSeat: 'north' });
    });

    it('should not add duplicate entries to queue', () => {
      handler.onThresholdCrossed(room, 'north', connectedWithoutNorth);
      handler.onThresholdCrossed(room, 'north', connectedWithoutNorth);

      // Only one dialog shown
      expect(broadcaster.broadcastToRoom).toHaveBeenCalledTimes(1);
    });

    // REQ-F-KM08: Queue ordered by crossedAt timestamp
    it('should queue multiple disconnected seats ordered by time', () => {
      handler.onThresholdCrossed(room, 'north', ['east', 'south', 'west']);
      handler.onThresholdCrossed(room, 'east', ['south', 'west']);

      // First dialog should be for north (crossed first)
      expect(handler.getActiveDialog(room)).toEqual({ targetSeat: 'north' });
    });

    it('should not show dialog if no eligible seats', () => {
      // Target is north, connected seats is empty
      handler.onThresholdCrossed(room, 'north', []);

      expect(broadcaster.broadcastToRoom).not.toHaveBeenCalled();
      expect(handler.hasActiveDialog(room)).toBe(false);
    });
  });

  describe('handleResponse — kick', () => {
    // REQ-F-KM02: Any single kick triggers immediate removal
    it('should fire onKick when any player chooses kick', () => {
      const onKick = vi.fn();
      handler.onKick = onKick;

      handler.onThresholdCrossed(room, 'north', connectedWithoutNorth);
      handler.handleResponse(room, 'east', 'kick', connectedWithoutNorth);

      expect(onKick).toHaveBeenCalledWith(room, 'north');
      expect(handler.hasActiveDialog(room)).toBe(false);
    });

    it('should broadcast KICK_DIALOG_DISMISSED with reason kicked', () => {
      handler.onThresholdCrossed(room, 'north', connectedWithoutNorth);
      handler.handleResponse(room, 'east', 'kick', connectedWithoutNorth);

      expect(broadcaster.broadcastToRoom).toHaveBeenCalledWith(room, {
        type: 'KICK_DIALOG_DISMISSED',
        targetSeat: 'north',
        reason: 'kicked',
      });
    });

    it('should fire onDialogDismissed callback', () => {
      const onDismissed = vi.fn();
      handler.onDialogDismissed = onDismissed;

      handler.onThresholdCrossed(room, 'north', connectedWithoutNorth);
      handler.handleResponse(room, 'east', 'kick', connectedWithoutNorth);

      expect(onDismissed).toHaveBeenCalledWith(room, 'kicked');
    });

    it('should show next queued dialog after kick', () => {
      handler.onThresholdCrossed(room, 'north', ['east', 'south', 'west']);
      handler.onThresholdCrossed(room, 'east', ['south', 'west']);

      // Kick north
      handler.handleResponse(room, 'south', 'kick', ['south', 'west']);

      // Next dialog should be for east
      expect(handler.getActiveDialog(room)).toEqual({ targetSeat: 'east' });
    });

    it('should ignore responses from non-eligible seats', () => {
      const onKick = vi.fn();
      handler.onKick = onKick;

      handler.onThresholdCrossed(room, 'north', connectedWithoutNorth);
      // North is the target, not eligible to respond
      handler.handleResponse(room, 'north', 'kick', connectedWithoutNorth);

      expect(onKick).not.toHaveBeenCalled();
    });

    it('should ignore duplicate responses from same seat', () => {
      handler.onThresholdCrossed(room, 'north', connectedWithoutNorth);
      handler.handleResponse(room, 'east', 'decline', connectedWithoutNorth);
      // East tries to respond again
      handler.handleResponse(room, 'east', 'kick', connectedWithoutNorth);

      // Should not have kicked — east already declined
      expect(handler.hasActiveDialog(room)).toBe(true);
    });
  });

  describe('handleResponse — decline', () => {
    // REQ-F-KM03: All decline dismisses dialog
    it('should dismiss dialog when all eligible players decline', () => {
      const onDismissed = vi.fn();
      handler.onDialogDismissed = onDismissed;

      handler.onThresholdCrossed(room, 'north', connectedWithoutNorth);
      handler.handleResponse(room, 'east', 'decline', connectedWithoutNorth);
      handler.handleResponse(room, 'south', 'decline', connectedWithoutNorth);
      handler.handleResponse(room, 'west', 'decline', connectedWithoutNorth);

      expect(handler.hasActiveDialog(room)).toBe(false);
      expect(onDismissed).toHaveBeenCalledWith(room, 'declined');
    });

    it('should broadcast KICK_DIALOG_DISMISSED with reason declined', () => {
      handler.onThresholdCrossed(room, 'north', connectedWithoutNorth);
      handler.handleResponse(room, 'east', 'decline', connectedWithoutNorth);
      handler.handleResponse(room, 'south', 'decline', connectedWithoutNorth);
      handler.handleResponse(room, 'west', 'decline', connectedWithoutNorth);

      expect(broadcaster.broadcastToRoom).toHaveBeenCalledWith(room, {
        type: 'KICK_DIALOG_DISMISSED',
        targetSeat: 'north',
        reason: 'declined',
      });
    });

    // REQ-F-KM10: Player-dismissed dialog does not reappear
    it('should mark as player-dismissed (no reappearance after vote)', () => {
      handler.onThresholdCrossed(room, 'north', connectedWithoutNorth);
      handler.handleResponse(room, 'east', 'decline', connectedWithoutNorth);
      handler.handleResponse(room, 'south', 'decline', connectedWithoutNorth);
      handler.handleResponse(room, 'west', 'decline', connectedWithoutNorth);

      // Try to reappear after vote — should NOT show again
      handler.reappearAfterVote(room, connectedWithoutNorth, () => true);
      expect(handler.hasActiveDialog(room)).toBe(false);
    });

    it('should not dismiss until all eligible have declined', () => {
      handler.onThresholdCrossed(room, 'north', connectedWithoutNorth);
      handler.handleResponse(room, 'east', 'decline', connectedWithoutNorth);
      handler.handleResponse(room, 'south', 'decline', connectedWithoutNorth);
      // west hasn't responded yet

      expect(handler.hasActiveDialog(room)).toBe(true);
    });
  });

  describe('handleReconnect', () => {
    // REQ-F-KM05: Reconnect dismisses active dialog
    it('should dismiss active dialog when target reconnects', () => {
      const onDismissed = vi.fn();
      handler.onDialogDismissed = onDismissed;

      handler.onThresholdCrossed(room, 'north', connectedWithoutNorth);
      handler.handleReconnect(room, 'north', connectedSeats);

      expect(handler.hasActiveDialog(room)).toBe(false);
      expect(onDismissed).toHaveBeenCalledWith(room, 'reconnected');
    });

    it('should broadcast KICK_DIALOG_DISMISSED with reason reconnected', () => {
      handler.onThresholdCrossed(room, 'north', connectedWithoutNorth);
      handler.handleReconnect(room, 'north', connectedSeats);

      expect(broadcaster.broadcastToRoom).toHaveBeenCalledWith(room, {
        type: 'KICK_DIALOG_DISMISSED',
        targetSeat: 'north',
        reason: 'reconnected',
      });
    });

    // REQ-F-KM09: Reconnect removes from queue
    it('should remove from queue when queued player reconnects', () => {
      handler.onThresholdCrossed(room, 'north', ['east', 'south', 'west']);
      handler.onThresholdCrossed(room, 'east', ['south', 'west']);

      // East reconnects before their dialog shows
      handler.handleReconnect(room, 'east', connectedSeats);

      // Kick north to advance — no east dialog should follow
      handler.handleResponse(room, 'south', 'kick', ['south', 'west']);
      expect(handler.hasActiveDialog(room)).toBe(false);
    });

    it('should show next dialog after reconnect dismisses current', () => {
      handler.onThresholdCrossed(room, 'north', ['east', 'south', 'west']);
      handler.onThresholdCrossed(room, 'east', ['south', 'west']);

      // North reconnects
      handler.handleReconnect(room, 'north', connectedSeats);

      // East's dialog should now show
      expect(handler.getActiveDialog(room)).toEqual({ targetSeat: 'east' });
    });

    it('should be no-op if seat is not in queue or active dialog', () => {
      handler.onThresholdCrossed(room, 'north', connectedWithoutNorth);
      handler.handleReconnect(room, 'west', connectedSeats);

      // North's dialog still active
      expect(handler.getActiveDialog(room)).toEqual({ targetSeat: 'north' });
    });
  });

  describe('dismissForVote', () => {
    // REQ-F-KM12: Vote takes priority over kick dialog
    it('should dismiss active dialog for vote', () => {
      const onDismissed = vi.fn();
      handler.onDialogDismissed = onDismissed;

      handler.onThresholdCrossed(room, 'north', connectedWithoutNorth);
      handler.dismissForVote(room);

      expect(handler.hasActiveDialog(room)).toBe(false);
      expect(onDismissed).toHaveBeenCalledWith(room, 'vote_priority');
    });

    it('should broadcast KICK_DIALOG_DISMISSED with reason vote_priority', () => {
      handler.onThresholdCrossed(room, 'north', connectedWithoutNorth);
      handler.dismissForVote(room);

      expect(broadcaster.broadcastToRoom).toHaveBeenCalledWith(room, {
        type: 'KICK_DIALOG_DISMISSED',
        targetSeat: 'north',
        reason: 'vote_priority',
      });
    });

    it('should be no-op if no active dialog', () => {
      handler.dismissForVote(room);
      expect(broadcaster.broadcastToRoom).not.toHaveBeenCalled();
    });
  });

  describe('reappearAfterVote', () => {
    // REQ-F-KM13: System-dismissed dialog can reappear after vote
    it('should re-show dialog after vote if still disconnected over threshold', () => {
      handler.onThresholdCrossed(room, 'north', connectedWithoutNorth);
      handler.dismissForVote(room);

      // After vote resolves, player still disconnected
      handler.reappearAfterVote(room, connectedWithoutNorth, (seat) => seat === 'north');

      expect(handler.getActiveDialog(room)).toEqual({ targetSeat: 'north' });
    });

    it('should not re-show if player is no longer over threshold', () => {
      handler.onThresholdCrossed(room, 'north', connectedWithoutNorth);
      handler.dismissForVote(room);

      // Player reconnected (no longer over threshold)
      handler.reappearAfterVote(room, connectedWithoutNorth, () => false);

      expect(handler.hasActiveDialog(room)).toBe(false);
    });

    // REQ-F-KM10: Player-dismissed never reappears
    it('should not re-show player-dismissed entries', () => {
      handler.onThresholdCrossed(room, 'north', connectedWithoutNorth);
      // All decline
      handler.handleResponse(room, 'east', 'decline', connectedWithoutNorth);
      handler.handleResponse(room, 'south', 'decline', connectedWithoutNorth);
      handler.handleResponse(room, 'west', 'decline', connectedWithoutNorth);

      // Try to reappear
      handler.reappearAfterVote(room, connectedWithoutNorth, () => true);

      expect(handler.hasActiveDialog(room)).toBe(false);
    });
  });

  describe('getActiveDialog / hasActiveDialog', () => {
    it('should return null when no active dialog', () => {
      expect(handler.getActiveDialog(room)).toBeNull();
      expect(handler.hasActiveDialog(room)).toBe(false);
    });

    it('should return target seat when dialog is active', () => {
      handler.onThresholdCrossed(room, 'south', ['north', 'east', 'west']);
      expect(handler.getActiveDialog(room)).toEqual({ targetSeat: 'south' });
      expect(handler.hasActiveDialog(room)).toBe(true);
    });
  });

  describe('cleanupRoom', () => {
    it('should clear all state for a room', () => {
      handler.onThresholdCrossed(room, 'north', connectedWithoutNorth);
      handler.cleanupRoom(room);

      expect(handler.hasActiveDialog(room)).toBe(false);
      expect(handler.getActiveDialog(room)).toBeNull();
    });
  });

  describe('dispose', () => {
    it('should clear all state for all rooms', () => {
      handler.onThresholdCrossed('ROOM1', 'north', connectedWithoutNorth);
      handler.onThresholdCrossed('ROOM2', 'east', ['north', 'south', 'west']);
      handler.dispose();

      expect(handler.hasActiveDialog('ROOM1')).toBe(false);
      expect(handler.hasActiveDialog('ROOM2')).toBe(false);
    });
  });

  describe('no active dialog handling', () => {
    it('should ignore response when no dialog is active', () => {
      const onKick = vi.fn();
      handler.onKick = onKick;

      handler.handleResponse(room, 'east', 'kick', connectedWithoutNorth);
      expect(onKick).not.toHaveBeenCalled();
    });
  });
});
