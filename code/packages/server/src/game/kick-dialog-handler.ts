// REQ-F-KM01–KM14: Kick dialog for disconnected players (2+ min threshold).
// NOT a vote — any single player choosing 'kick' triggers immediate removal.

import type { Seat } from '@tichu/shared';
import type { Broadcaster } from '../ws/broadcaster.js';

/** Queued entry for a player who has crossed the disconnect threshold. */
interface QueueEntry {
  seat: Seat;
  crossedAt: number;
  /** True if all connected players chose 'decline' (one-time per session). */
  dismissedByPlayers: boolean;
  /** True if dismissed by system (vote priority) — can reappear after vote. */
  dismissedBySystem: boolean;
}

/** Active kick dialog state. */
interface ActiveDialog {
  targetSeat: Seat;
  responses: Map<Seat, 'kick' | 'decline'>;
  /** Eligible responders (connected human seats, excluding target). */
  eligibleSeats: Seat[];
}

/**
 * REQ-F-KM01–KM14: Manages kick dialogs for players who have been
 * disconnected for 2+ minutes.
 *
 * Flow:
 * 1. DisconnectHandler fires onThresholdCrossed → queued here.
 * 2. If no active dialog, show next in queue to all connected players.
 * 3. Any single 'kick' response → fire onKick callback (immediate removal).
 * 4. All 'decline' → dismiss dialog (one-time per disconnect session).
 * 5. Reconnect → remove from queue or dismiss active dialog.
 */
export class KickDialogHandler {
  /** Per-room queue of seats awaiting kick dialog. Ordered by crossedAt. */
  private readonly queues = new Map<string, QueueEntry[]>();

  /** Per-room active dialog. */
  private readonly activeDialogs = new Map<string, ActiveDialog>();

  /** Fired when a player is kicked via the dialog. */
  onKick: ((roomCode: string, seat: Seat) => void) | null = null;

  /** Fired when kick dialog is dismissed (for any reason). */
  onDialogDismissed: ((roomCode: string, reason: 'kicked' | 'declined' | 'reconnected' | 'vote_priority') => void) | null = null;

  constructor(private readonly broadcaster: Broadcaster) {}

  /**
   * REQ-F-KM01, KM08: A seat has crossed the 2-min + 5s threshold.
   * Add to queue and show dialog if no active dialog.
   */
  onThresholdCrossed(roomCode: string, seat: Seat, connectedHumanSeats: Seat[]): void {
    if (!this.queues.has(roomCode)) {
      this.queues.set(roomCode, []);
    }

    const queue = this.queues.get(roomCode)!;

    // Don't add duplicates
    if (queue.some(e => e.seat === seat)) return;
    if (this.activeDialogs.get(roomCode)?.targetSeat === seat) return;

    queue.push({
      seat,
      crossedAt: Date.now(),
      dismissedByPlayers: false,
      dismissedBySystem: false,
    });

    // Sort by crossedAt (REQ-F-KM08)
    queue.sort((a, b) => a.crossedAt - b.crossedAt);

    // Show next if no active dialog
    if (!this.activeDialogs.has(roomCode)) {
      this.showNext(roomCode, connectedHumanSeats);
    }
  }

  /**
   * REQ-F-KM02/KM03: Handle a player's response to the kick dialog.
   */
  handleResponse(roomCode: string, responderSeat: Seat, response: 'kick' | 'decline', connectedHumanSeats: Seat[]): void {
    const dialog = this.activeDialogs.get(roomCode);
    if (!dialog) return;

    // Only eligible seats can respond
    if (!dialog.eligibleSeats.includes(responderSeat)) return;

    // Don't allow double-responses
    if (dialog.responses.has(responderSeat)) return;

    if (response === 'kick') {
      // REQ-F-KM02: Any single kick triggers immediate removal
      const targetSeat = dialog.targetSeat;
      this.activeDialogs.delete(roomCode);

      // Broadcast dismissal
      this.broadcaster.broadcastToRoom(roomCode, {
        type: 'KICK_DIALOG_DISMISSED',
        targetSeat,
        reason: 'kicked',
      });

      // Remove from queue if present
      this.removeFromQueue(roomCode, targetSeat);

      // Fire kick callback
      this.onKick?.(roomCode, targetSeat);
      this.onDialogDismissed?.(roomCode, 'kicked');

      // Show next dialog if queue has more
      this.showNext(roomCode, connectedHumanSeats);
    } else {
      // Record decline
      dialog.responses.set(responderSeat, 'decline');

      // REQ-F-KM03: If all eligible have declined, dismiss
      if (dialog.responses.size >= dialog.eligibleSeats.length) {
        const targetSeat = dialog.targetSeat;
        this.activeDialogs.delete(roomCode);

        // Mark as player-dismissed (REQ-F-KM10: one-time, no reappearance)
        const queue = this.queues.get(roomCode);
        const entry = queue?.find(e => e.seat === targetSeat);
        if (entry) {
          entry.dismissedByPlayers = true;
        }

        this.broadcaster.broadcastToRoom(roomCode, {
          type: 'KICK_DIALOG_DISMISSED',
          targetSeat,
          reason: 'declined',
        });

        this.onDialogDismissed?.(roomCode, 'declined');

        // Show next dialog if queue has more
        this.showNext(roomCode, connectedHumanSeats);
      }
    }
  }

  /**
   * REQ-F-KM05, KM09: A disconnected player has reconnected.
   * Remove from queue or dismiss active dialog.
   */
  handleReconnect(roomCode: string, seat: Seat, connectedHumanSeats: Seat[]): void {
    // Remove from queue (REQ-F-KM09)
    this.removeFromQueue(roomCode, seat);

    // Dismiss active dialog if it's for this seat (REQ-F-KM05)
    const dialog = this.activeDialogs.get(roomCode);
    if (dialog && dialog.targetSeat === seat) {
      this.activeDialogs.delete(roomCode);

      this.broadcaster.broadcastToRoom(roomCode, {
        type: 'KICK_DIALOG_DISMISSED',
        targetSeat: seat,
        reason: 'reconnected',
      });

      this.onDialogDismissed?.(roomCode, 'reconnected');

      // Show next dialog if queue has more
      this.showNext(roomCode, connectedHumanSeats);
    }
  }

  /**
   * REQ-F-KM12: Dismiss active dialog because a vote is taking priority.
   * The dialog can reappear after the vote resolves (system-initiated dismissal).
   */
  dismissForVote(roomCode: string): void {
    const dialog = this.activeDialogs.get(roomCode);
    if (!dialog) return;

    const targetSeat = dialog.targetSeat;
    this.activeDialogs.delete(roomCode);

    // Mark as system-dismissed (can reappear, per REQ-F-KM13)
    if (!this.queues.has(roomCode)) {
      this.queues.set(roomCode, []);
    }
    const queue = this.queues.get(roomCode)!;
    let entry = queue.find(e => e.seat === targetSeat);
    if (!entry) {
      // Re-add to front of queue
      entry = { seat: targetSeat, crossedAt: 0, dismissedByPlayers: false, dismissedBySystem: true };
      queue.unshift(entry);
    } else {
      entry.dismissedBySystem = true;
    }

    this.broadcaster.broadcastToRoom(roomCode, {
      type: 'KICK_DIALOG_DISMISSED',
      targetSeat,
      reason: 'vote_priority',
    });

    this.onDialogDismissed?.(roomCode, 'vote_priority');
  }

  /**
   * REQ-F-KM13: After a vote resolves, re-show the kick dialog if the player
   * is still disconnected 2+ min and was system-dismissed (not player-dismissed).
   */
  reappearAfterVote(roomCode: string, connectedHumanSeats: Seat[], isStillDisconnectedOverThreshold: (seat: Seat) => boolean): void {
    const queue = this.queues.get(roomCode);
    if (!queue) return;

    // Filter queue: remove entries that no longer qualify
    for (let i = queue.length - 1; i >= 0; i--) {
      const entry = queue[i];
      if (entry.dismissedByPlayers) continue; // Never reappear
      if (!isStillDisconnectedOverThreshold(entry.seat)) {
        queue.splice(i, 1); // No longer qualifies
        continue;
      }
      // Reset system dismiss flag
      entry.dismissedBySystem = false;
    }

    // Show next if no active dialog
    if (!this.activeDialogs.has(roomCode)) {
      this.showNext(roomCode, connectedHumanSeats);
    }
  }

  /** Get the active kick dialog for a room (for state projection). */
  getActiveDialog(roomCode: string): { targetSeat: Seat } | null {
    const dialog = this.activeDialogs.get(roomCode);
    return dialog ? { targetSeat: dialog.targetSeat } : null;
  }

  /** Check if there is an active kick dialog. */
  hasActiveDialog(roomCode: string): boolean {
    return this.activeDialogs.has(roomCode);
  }

  /** Clean up all state for a room. */
  cleanupRoom(roomCode: string): void {
    this.queues.delete(roomCode);
    this.activeDialogs.delete(roomCode);
  }

  /** Clean up everything. */
  dispose(): void {
    this.queues.clear();
    this.activeDialogs.clear();
  }

  /** Show the next queued dialog, if any. */
  private showNext(roomCode: string, connectedHumanSeats: Seat[]): void {
    const queue = this.queues.get(roomCode);
    if (!queue || queue.length === 0) return;

    // Find next eligible entry (not player-dismissed, not system-dismissed)
    const entryIndex = queue.findIndex(e => !e.dismissedByPlayers && !e.dismissedBySystem);
    if (entryIndex === -1) return;

    const entry = queue[entryIndex];
    queue.splice(entryIndex, 1);

    // Eligible responders: connected humans excluding the target
    const eligibleSeats = connectedHumanSeats.filter(s => s !== entry.seat);
    if (eligibleSeats.length === 0) {
      // No one to ask — skip (shouldn't happen in practice)
      return;
    }

    this.activeDialogs.set(roomCode, {
      targetSeat: entry.seat,
      responses: new Map(),
      eligibleSeats,
    });

    // REQ-F-KM01: Broadcast kick dialog to room
    this.broadcaster.broadcastToRoom(roomCode, {
      type: 'KICK_DIALOG_SHOW',
      targetSeat: entry.seat,
    });
  }

  /** Remove a seat from the queue. */
  private removeFromQueue(roomCode: string, seat: Seat): void {
    const queue = this.queues.get(roomCode);
    if (!queue) return;
    const index = queue.findIndex(e => e.seat === seat);
    if (index !== -1) queue.splice(index, 1);
    if (queue.length === 0) this.queues.delete(roomCode);
  }
}
