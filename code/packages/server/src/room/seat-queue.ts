// REQ-F-ES06: FIFO seat queue with multi-seat picking
// REQ-F-ES07: Queue — Claim Seat (with specific seat choice)
// REQ-F-ES08: Queue — Pass or Timeout (removed from queue, not recycled)
// REQ-F-ES09: Queue — Lobby Join During Processing
// REQ-F-ES10: Up For Grabs Phase (broadcast to ALL spectators)
// REQ-F-ES11: Queue Status for Non-Deciding Spectators (per-spectator ordinal)
// REQ-F-ES16: Queue Completion

import type { Seat } from '@tichu/shared';

export type QueuePhase = 'idle' | 'offering' | 'up-for-grabs';

export interface SeatQueueCallbacks {
  /** Send a message to a specific spectator by userId */
  onSendToSpectator: (userId: string, message: SeatOfferedMessage | SeatsAvailableMessage | QueueStatusMessage) => void;
  /** A spectator claimed a seat — promote them */
  onSeatClaimed: (userId: string, seat: Seat) => void;
  /** REQ-F-ES16: All available seats have been filled — queue is done */
  onAllSeatsFilled: (roomCode: string) => void;
  /** REQ-F-ES10: Get current spectator userIds for up-for-grabs broadcast */
  onGetCurrentSpectators: (roomCode: string) => string[];
}

// REQ-F-ES06: Multi-seat offer (array for multi-vacancy picking)
export interface SeatOfferedMessage {
  type: 'SEAT_OFFERED';
  seats: Seat[];
  timeoutMs: number;
}

// REQ-F-ES11: Per-spectator ordinal queue position
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
 * REQ-F-ES06: Manages a FIFO seat queue for a single room.
 *
 * When seats open, spectators are offered them one at a time (FIFO order)
 * with a 30-second timeout. Each spectator can:
 * - Claim a seat (CLAIM_SEAT with optional seat choice for multi-vacancy)
 * - Pass / Decline (DECLINE_SEAT) — removed from queue entirely, NOT recycled
 * - Timeout (30s) — treated as pass, removed from queue
 *
 * REQ-F-ES10: If all queue spectators pass/timeout, transitions to "up for grabs"
 * where ALL current spectators (not just queue participants) can claim first-come-first-served.
 */
export class SeatQueue {
  private readonly roomCode: string;
  private readonly callbacks: SeatQueueCallbacks;

  private _phase: QueuePhase = 'idle';
  private availableSeats: Seat[] = [];
  private spectatorOrder: string[] = [];
  private currentIndex = 0;
  private currentOfferedUserId: string | null = null;
  private offerTimer: ReturnType<typeof setTimeout> | null = null;

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
   * REQ-F-ES06: Start queue processing when seats become available.
   * Takes a snapshot of spectators in FIFO order.
   */
  startQueue(availableSeats: Seat[], spectatorUserIds: string[]): void {
    if (availableSeats.length === 0 || spectatorUserIds.length === 0) return;

    this.availableSeats = [...availableSeats];
    this.spectatorOrder = [...spectatorUserIds];
    this.currentIndex = 0;
    this._phase = 'offering';

    this.offerNext();
  }

  /**
   * REQ-F-ES07: Spectator claims a seat.
   * @param userId - The spectator claiming
   * @param seat - Optional specific seat choice (for multi-vacancy). If omitted, auto-assign first available.
   */
  handleClaim(userId: string, seat?: Seat): boolean {
    if (this._phase === 'offering') {
      if (userId !== this.currentOfferedUserId) return false;

      this.clearTimer();

      // REQ-F-ES07: Pick specific seat if provided and available, otherwise first available
      let claimedSeat: Seat;
      if (seat && this.availableSeats.includes(seat)) {
        this.availableSeats = this.availableSeats.filter(s => s !== seat);
        claimedSeat = seat;
      } else {
        claimedSeat = this.availableSeats.shift()!;
      }

      this.callbacks.onSeatClaimed(userId, claimedSeat);
      this.removeFromQueue(userId);

      // REQ-F-ES16: If all seats filled, stop queue
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
   * REQ-F-ES08: Spectator passes on the offered seat.
   * They are removed from the queue entirely (not recycled).
   */
  handleDecline(userId: string): boolean {
    if (this._phase !== 'offering') return false;
    if (userId !== this.currentOfferedUserId) return false;

    this.clearTimer();
    // REQ-F-ES08: Remove from queue entirely — not recycled, not eligible for up-for-grabs
    this.removeFromQueue(userId);
    this.currentOfferedUserId = null;
    this.offerNext();
    return true;
  }

  /**
   * Spectator leaves room while queue is active.
   * Remove them from all queue structures.
   */
  handleLeave(userId: string): void {
    const wasDeciding = this._phase === 'offering' && userId === this.currentOfferedUserId;

    this.removeFromQueue(userId);

    if (wasDeciding) {
      this.clearTimer();
      this.currentOfferedUserId = null;
      this.offerNext();
    }
  }

  /**
   * Resend the current queue state to a specific spectator (e.g. after reconnection).
   * Sends SEAT_OFFERED if they're deciding, QUEUE_STATUS if waiting, SEATS_AVAILABLE if up-for-grabs.
   */
  resendStateToSpectator(userId: string): void {
    if (!this.isActive()) return;

    if (this._phase === 'up-for-grabs') {
      this.callbacks.onSendToSpectator(userId, {
        type: 'SEATS_AVAILABLE',
        seats: [...this.availableSeats],
      });
      return;
    }

    if (this._phase === 'offering') {
      if (userId === this.currentOfferedUserId) {
        // They're the deciding spectator — resend offer
        this.callbacks.onSendToSpectator(userId, {
          type: 'SEAT_OFFERED',
          seats: [...this.availableSeats],
          timeoutMs: 30_000, // approximate — timer is already running
        });
      } else {
        // Check if they're in the queue
        const idx = this.spectatorOrder.indexOf(userId);
        if (idx > this.currentIndex) {
          const position = idx - this.currentIndex;
          this.callbacks.onSendToSpectator(userId, {
            type: 'QUEUE_STATUS',
            decidingSpectator: this.currentOfferedUserId ?? '',
            position,
            timeoutMs: 30_000,
          });
        }
      }
    }
  }

  /**
   * REQ-F-ES09: Add a late-joining spectator to the queue during active processing.
   * If in up-for-grabs phase, immediately send SEATS_AVAILABLE.
   */
  addToQueue(userId: string): void {
    if (!this.isActive()) return;

    if (this._phase === 'up-for-grabs') {
      // REQ-F-ES09: Immediately notify late joiner of available seats
      this.callbacks.onSendToSpectator(userId, {
        type: 'SEATS_AVAILABLE',
        seats: [...this.availableSeats],
      });
      return;
    }

    // Add to end of queue for offering phase
    this.spectatorOrder.push(userId);
  }

  /** Clean up timers and reset state */
  cleanup(): void {
    this.clearTimer();
    this._phase = 'idle';
    this.availableSeats = [];
    this.spectatorOrder = [];
    this.currentIndex = 0;
    this.currentOfferedUserId = null;
  }

  // ─── Private helpers ──────────────────────────────────────────────────

  /** Offer the next seat to the next spectator in line */
  private offerNext(): void {
    // Find next spectator in queue
    if (this.currentIndex < this.spectatorOrder.length) {
      const userId = this.spectatorOrder[this.currentIndex];
      this.offerToSpectator(userId);
      return;
    }

    // No more spectators in queue — check if any spectators exist in the room
    const allSpectators = this.callbacks.onGetCurrentSpectators(this.roomCode);
    if (allSpectators.length === 0) {
      // No spectators in room at all — finish queue (no one to offer to)
      this.finishQueue();
      return;
    }

    // REQ-F-ES10: Spectators exist — transition to up-for-grabs
    this.transitionToUpForGrabs();
  }

  /** Send SEAT_OFFERED to a specific spectator and start the 30s timer */
  private offerToSpectator(userId: string): void {
    this.currentOfferedUserId = userId;

    // REQ-F-ES06: Send all available seats so spectator can pick (multi-vacancy)
    this.callbacks.onSendToSpectator(userId, {
      type: 'SEAT_OFFERED',
      seats: [...this.availableSeats],
      timeoutMs: OFFER_TIMEOUT_MS,
    });

    // REQ-F-ES11: Send individual queue status to each non-deciding spectator
    this.broadcastIndividualQueueStatus(userId);

    // Start 30s timeout
    this.startTimeout(userId);
  }

  /** REQ-F-ES11: Send per-spectator ordinal position to each waiting spectator */
  private broadcastIndividualQueueStatus(decidingSpectator: string): void {
    // Compute position for each spectator still in queue after current
    for (let i = this.currentIndex + 1; i < this.spectatorOrder.length; i++) {
      const waitingUserId = this.spectatorOrder[i];
      const position = i - this.currentIndex; // 1st, 2nd, 3rd... in line
      this.callbacks.onSendToSpectator(waitingUserId, {
        type: 'QUEUE_STATUS',
        decidingSpectator,
        position,
        timeoutMs: OFFER_TIMEOUT_MS,
      });
    }
  }

  /** Start the 30-second offer timeout */
  private startTimeout(userId: string): void {
    this.clearTimer();
    this.offerTimer = setTimeout(() => {
      // REQ-F-ES08: Timeout = same as pass — removed from queue entirely
      if (this.currentOfferedUserId === userId) {
        this.removeFromQueue(userId);
        this.currentOfferedUserId = null;
        this.offerNext();
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
   * REQ-F-ES10: All queue spectators passed/timed out — transition to "up for grabs".
   * Broadcast to ALL current spectators in the room (via callback), not just queue participants.
   */
  private transitionToUpForGrabs(): void {
    // Get all current spectators from the room
    const allSpectators = this.callbacks.onGetCurrentSpectators(this.roomCode);

    if (allSpectators.length === 0) {
      // No spectators at all — just wait (queue stays active for future joiners or finishes)
      this._phase = 'up-for-grabs';
      this.currentOfferedUserId = null;
      return;
    }

    this._phase = 'up-for-grabs';
    this.currentOfferedUserId = null;

    const seatsMessage: SeatsAvailableMessage = {
      type: 'SEATS_AVAILABLE',
      seats: [...this.availableSeats],
    };

    // REQ-F-ES10: Send to ALL current spectators
    for (const userId of allSpectators) {
      this.callbacks.onSendToSpectator(userId, seatsMessage);
    }
  }

  /**
   * REQ-F-ES10: Handle claim during "up for grabs" phase.
   * First spectator to respond gets the seat (auto-assign, no seat choice).
   */
  private handleUpForGrabsClaim(userId: string): boolean {
    if (this._phase !== 'up-for-grabs') return false;
    if (this.availableSeats.length === 0) return false;

    // REQ-F-ES10: Auto-assign to first available seat (no seat choice in this phase)
    const seat = this.availableSeats.shift()!;
    this.callbacks.onSeatClaimed(userId, seat);

    // REQ-F-ES16: If all seats filled, stop queue
    if (this.availableSeats.length === 0) {
      this.finishQueue();
      return true;
    }

    // More seats available — broadcast updated seats to all remaining spectators
    const allSpectators = this.callbacks.onGetCurrentSpectators(this.roomCode);
    const seatsMessage: SeatsAvailableMessage = {
      type: 'SEATS_AVAILABLE',
      seats: [...this.availableSeats],
    };
    for (const specId of allSpectators) {
      if (specId !== userId) {
        this.callbacks.onSendToSpectator(specId, seatsMessage);
      }
    }

    return true;
  }

  /** Remove a userId from the queue */
  private removeFromQueue(userId: string): void {
    const idx = this.spectatorOrder.indexOf(userId);
    if (idx !== -1) {
      this.spectatorOrder.splice(idx, 1);
      // Adjust currentIndex if removal was before or at current position
      if (idx < this.currentIndex) {
        this.currentIndex--;
      } else if (idx === this.currentIndex && this.currentOfferedUserId === userId) {
        // Current user removed — don't advance index (next user slides into this slot)
      }
    }
  }

  /** REQ-F-ES16: Finish queue processing and notify */
  private finishQueue(): void {
    this.clearTimer();
    this._phase = 'idle';
    this.currentOfferedUserId = null;
    this.callbacks.onAllSeatsFilled(this.roomCode);
  }
}
