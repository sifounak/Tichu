// REQ-F-SP07: FIFO seat queue system for spectators
// REQ-F-SP08: 30-second timeout with three choices per offer
// REQ-F-SP08a: Queue stops when all seats filled
// REQ-F-SP08b: Non-deciding spectators see queue status
// REQ-F-SP08c: "Up for grabs" fallback when all decline

import type { Seat } from '@tichu/shared';

export type QueuePhase = 'idle' | 'offering' | 'up-for-grabs';

export interface SeatQueueCallbacks {
  /** Send a message to a specific spectator by userId */
  onSendToSpectator: (userId: string, message: SeatOfferedMessage | SeatsAvailableMessage) => void;
  /** Broadcast queue status to all non-deciding spectators */
  onBroadcastQueueStatus: (roomCode: string, status: QueueStatusMessage) => void;
  /** A spectator claimed a seat — promote them */
  onSeatClaimed: (userId: string, seat: Seat) => void;
  /** All available seats have been filled — queue is done */
  onAllSeatsFilled: (roomCode: string) => void;
}

export interface SeatOfferedMessage {
  type: 'SEAT_OFFERED';
  seat: Seat;
  timeoutMs: number;
}

export interface QueueStatusMessage {
  type: 'QUEUE_STATUS';
  decidingSpectator: string;
  position: number;
  timeoutMs: number;
}

export interface SeatsAvailableMessage {
  type: 'SEATS_AVAILABLE';
  seats: Seat[];
}

const OFFER_TIMEOUT_MS = 30_000;

/**
 * REQ-F-SP07: Manages a FIFO seat queue for a single room.
 *
 * When seats open, spectators are offered them one at a time (FIFO order)
 * with a 30-second timeout. Each spectator can:
 * - Claim the seat (CLAIM_SEAT)
 * - Decline / Continue Spectating (DECLINE_SEAT) — moved to end of round
 * - Leave the room (handled externally via handleLeave)
 *
 * If all spectators decline, transitions to "up for grabs" phase where
 * any spectator can claim first-come-first-served.
 */
export class SeatQueue {
  private readonly roomCode: string;
  private readonly callbacks: SeatQueueCallbacks;

  private _phase: QueuePhase = 'idle';
  private availableSeats: Seat[] = [];
  private spectatorOrder: string[] = []; // snapshot of queue at start
  private currentIndex = 0;
  private currentOfferedUserId: string | null = null;
  private offerTimer: ReturnType<typeof setTimeout> | null = null;
  private declinedUserIds = new Set<string>();
  private lateJoiners: string[] = []; // spectators who joined during queue processing

  constructor(roomCode: string, callbacks: SeatQueueCallbacks) {
    this.roomCode = roomCode;
    this.callbacks = callbacks;
  }

  /** Current queue phase */
  get phase(): QueuePhase {
    return this._phase;
  }

  /** Whether the queue is actively processing (offering or up-for-grabs) */
  isActive(): boolean {
    return this._phase !== 'idle';
  }

  /**
   * REQ-F-SP07: Start queue processing when seats become available.
   * Takes a snapshot of spectators in FIFO order.
   */
  startQueue(availableSeats: Seat[], spectatorUserIds: string[]): void {
    if (availableSeats.length === 0 || spectatorUserIds.length === 0) return;

    this.availableSeats = [...availableSeats];
    this.spectatorOrder = [...spectatorUserIds];
    this.currentIndex = 0;
    this.declinedUserIds.clear();
    this.lateJoiners = [];
    this._phase = 'offering';

    this.offerNext();
  }

  /**
   * REQ-F-SP08: Spectator claims the offered seat.
   * Returns true if the claim was valid.
   */
  handleClaim(userId: string): boolean {
    if (this._phase === 'offering') {
      if (userId !== this.currentOfferedUserId) return false;

      this.clearTimer();
      const seat = this.availableSeats.shift()!;
      this.callbacks.onSeatClaimed(userId, seat);

      // Remove claimer from queue lists
      this.removeFromQueues(userId);

      // REQ-F-SP08a: If all seats filled, stop queue
      if (this.availableSeats.length === 0) {
        this.finishQueue();
        return true;
      }

      // More seats available — offer to next spectator
      this.offerNext();
      return true;
    }

    if (this._phase === 'up-for-grabs') {
      return this.handleUpForGrabsClaim(userId);
    }

    return false;
  }

  /**
   * REQ-F-SP08: Spectator declines the offered seat (continue spectating).
   * Spectator is moved out of the active round; will only be re-offered
   * after all others (including late joiners) have decided.
   */
  handleDecline(userId: string): boolean {
    if (this._phase !== 'offering') return false;
    if (userId !== this.currentOfferedUserId) return false;

    this.clearTimer();
    this.declinedUserIds.add(userId);
    this.advanceToNext();
    return true;
  }

  /**
   * Spectator leaves room while queue is active.
   * Remove them from all queue structures.
   */
  handleLeave(userId: string): void {
    const wasDeciding = this._phase === 'offering' && userId === this.currentOfferedUserId;

    this.removeFromQueues(userId);

    if (wasDeciding) {
      this.clearTimer();
      this.currentOfferedUserId = null;
      // Don't advance index — removeFromQueues already shifted the array
      // so currentIndex now points to the next person
      this.offerNext();
    }
  }

  /**
   * REQ-F-SP10: Add a late-joining spectator to the queue during active processing.
   */
  addToQueue(userId: string): void {
    if (!this.isActive()) return;
    this.lateJoiners.push(userId);
  }

  /** Clean up timers and reset state */
  cleanup(): void {
    this.clearTimer();
    this._phase = 'idle';
    this.availableSeats = [];
    this.spectatorOrder = [];
    this.currentIndex = 0;
    this.currentOfferedUserId = null;
    this.declinedUserIds.clear();
    this.lateJoiners = [];
  }

  // ─── Private helpers ──────────────────────────────────────────────────

  /** Offer the next seat to the next spectator in line */
  private offerNext(): void {
    // Find next eligible spectator (not declined, still in queue)
    while (this.currentIndex < this.spectatorOrder.length) {
      const userId = this.spectatorOrder[this.currentIndex];
      if (!this.declinedUserIds.has(userId)) {
        this.offerToSpectator(userId);
        return;
      }
      this.currentIndex++;
    }

    // Check late joiners
    if (this.lateJoiners.length > 0) {
      // Move late joiners into main queue and continue
      this.spectatorOrder.push(...this.lateJoiners);
      this.lateJoiners = [];
      // currentIndex now points into the newly appended section
      if (this.currentIndex < this.spectatorOrder.length) {
        this.offerNext();
        return;
      }
    }

    // Everyone in the original queue + late joiners has been asked
    // Check if anyone declined — if so, transition to up-for-grabs
    if (this.declinedUserIds.size > 0) {
      this.transitionToUpForGrabs();
    } else {
      // No one left to ask (all left the room) — finish queue
      this.finishQueue();
    }
  }

  /** Advance past the current spectator and offer to the next */
  private advanceToNext(): void {
    this.currentIndex++;
    this.offerNext();
  }

  /** Send SEAT_OFFERED to a specific spectator and start the 30s timer */
  private offerToSpectator(userId: string): void {
    this.currentOfferedUserId = userId;
    const seat = this.availableSeats[0];

    // REQ-F-SP08: Send seat offer with 30s timeout
    this.callbacks.onSendToSpectator(userId, {
      type: 'SEAT_OFFERED',
      seat,
      timeoutMs: OFFER_TIMEOUT_MS,
    });

    // REQ-F-SP08b: Broadcast queue status to other spectators
    const spectatorName = userId; // Will be resolved to display name by callback
    this.broadcastQueueStatus(spectatorName);

    // Start 30s timeout
    this.startTimeout(userId);
  }

  /** REQ-F-SP08b: Broadcast queue position to all non-deciding spectators */
  private broadcastQueueStatus(decidingSpectator: string): void {
    this.callbacks.onBroadcastQueueStatus(this.roomCode, {
      type: 'QUEUE_STATUS',
      decidingSpectator,
      position: this.currentIndex + 1,
      timeoutMs: OFFER_TIMEOUT_MS,
    });
  }

  /** Start the 30-second offer timeout */
  private startTimeout(userId: string): void {
    this.clearTimer();
    this.offerTimer = setTimeout(() => {
      // Timeout = same as decline
      if (this.currentOfferedUserId === userId) {
        this.declinedUserIds.add(userId);
        this.advanceToNext();
      }
    }, OFFER_TIMEOUT_MS);
  }

  /** Clear the active timeout timer */
  private clearTimer(): void {
    if (this.offerTimer) {
      clearTimeout(this.offerTimer);
      this.offerTimer = null;
    }
  }

  /**
   * REQ-F-SP08c: All spectators declined — transition to "up for grabs" phase.
   * Any spectator can claim first-come-first-served.
   */
  private transitionToUpForGrabs(): void {
    this._phase = 'up-for-grabs';
    this.currentOfferedUserId = null;

    const seatsMessage: SeatsAvailableMessage = {
      type: 'SEATS_AVAILABLE',
      seats: [...this.availableSeats],
    };

    // Send to all remaining spectators (those who declined)
    for (const userId of this.declinedUserIds) {
      this.callbacks.onSendToSpectator(userId, seatsMessage);
    }
    // Also send to late joiners who haven't been processed
    for (const userId of this.lateJoiners) {
      this.callbacks.onSendToSpectator(userId, seatsMessage);
    }
  }

  /**
   * REQ-F-SP08c: Handle claim during "up for grabs" phase.
   * First spectator to respond gets the seat.
   */
  private handleUpForGrabsClaim(userId: string): boolean {
    if (this._phase !== 'up-for-grabs') return false;
    if (this.availableSeats.length === 0) return false;

    const seat = this.availableSeats.shift()!;
    this.callbacks.onSeatClaimed(userId, seat);
    this.removeFromQueues(userId);

    // REQ-F-SP08a: If all seats filled, stop queue
    if (this.availableSeats.length === 0) {
      this.finishQueue();
      return true;
    }

    // More seats available — broadcast updated seats to remaining spectators
    const seatsMessage: SeatsAvailableMessage = {
      type: 'SEATS_AVAILABLE',
      seats: [...this.availableSeats],
    };
    for (const declinedId of this.declinedUserIds) {
      this.callbacks.onSendToSpectator(declinedId, seatsMessage);
    }
    for (const lateId of this.lateJoiners) {
      this.callbacks.onSendToSpectator(lateId, seatsMessage);
    }

    return true;
  }

  /** Remove a userId from all queue lists */
  private removeFromQueues(userId: string): void {
    this.spectatorOrder = this.spectatorOrder.filter(id => id !== userId);
    this.lateJoiners = this.lateJoiners.filter(id => id !== userId);
    this.declinedUserIds.delete(userId);
    // Adjust currentIndex if needed (removal before current position)
    if (this.currentIndex > this.spectatorOrder.length) {
      this.currentIndex = this.spectatorOrder.length;
    }
  }

  /** REQ-F-SP08a: Finish queue processing and notify */
  private finishQueue(): void {
    this.clearTimer();
    this._phase = 'idle';
    this.currentOfferedUserId = null;
    this.callbacks.onAllSeatsFilled(this.roomCode);
  }
}
