// REQ-F-SJ12, SJ13: Passive grace-period handling on involuntary disconnect.
// REQ-F-ES04/ES14/ES17 (superseded): previously a vote-based keep/kick scheme —
// replaced by a passive 60s hold. Reconnect within the window restores the
// seat without validation; expiry releases the seat and re-enters seat-claim
// logic for returning users (REQ-F-SJ04-SJ06).

import type { Seat } from '@tichu/shared';
import type { Broadcaster } from '../ws/broadcaster.js';

/** Back-compat export: the vote scheme is gone but the type is still imported
 *  elsewhere (and the `DISCONNECT_VOTE` client message is dead-but-accepted). */
export type DisconnectVote = 'wait' | 'kick';

/** Outcome reported to `onVoteResult`. With the vote scheme removed, only
 *  `'kick'` (grace expired) is ever produced — `'waiting'` / `'pending'` are
 *  retained for back-compat with the callback signature. */
export type VoteOutcome = 'waiting' | 'kick' | 'pending';

/** State for a single room's grace-period session. */
interface GraceSession {
  /** REQ-F-SJ12: All disconnected seats currently under grace in this room. */
  disconnectedSeats: Set<Seat>;
  /** Timeout handle for the grace expiry. */
  timeoutHandle: ReturnType<typeof setTimeout>;
  /** Wall-clock start time — used to compute remaining time for projection. */
  startedAt: number;
}

/**
 * REQ-F-SJ12, SJ13: Tracks involuntary disconnects and enforces a passive
 * grace period per room.
 *
 * Flow:
 * 1. `handleDisconnect` — seat goes into a 60s hold; remaining players are
 *    notified via `PLAYER_DISCONNECTED`. The seat is NOT vacated yet.
 * 2. `handleReconnect` within the window — seat restored in place, no
 *    seat-claim validation required (REQ-F-SJ12).
 * 3. On grace expiry — `onVoteResult(roomCode, 'kick', seats)` fires so the
 *    caller vacates the seat(s). Returning users now go through standard
 *    seat-claim flow (REQ-F-SJ04-SJ06, SJ13).
 *
 * Voluntary `LEAVE_ROOM` and host/vote kicks never pass through this handler
 * — they release the seat immediately (REQ-F-SJ13).
 */
export class DisconnectHandler {
  /** Active grace sessions by room code. */
  private readonly sessions = new Map<string, GraceSession>();

  /** Disconnected seats by room (independent of session for quick lookup). */
  private readonly disconnected = new Map<string, Set<Seat>>();

  /** REQ-F-SJ12: Grace period in ms (default 60 seconds). */
  private readonly graceTimeoutMs: number;

  /** Called when the grace period expires — outcome is always `'kick'`. */
  onVoteResult: ((roomCode: string, outcome: VoteOutcome, seats: Seat[]) => void) | null = null;

  constructor(
    private readonly broadcaster: Broadcaster,
    options?: { graceTimeoutMs?: number; voteTimeoutMs?: number },
  ) {
    // Accept `voteTimeoutMs` as a deprecated alias so existing callers don't
    // break during the M2 transition; new code should pass `graceTimeoutMs`.
    this.graceTimeoutMs = options?.graceTimeoutMs ?? options?.voteTimeoutMs ?? 60_000;
  }

  /** REQ-F-SJ12: Record an involuntary disconnect and (re)arm the grace timer. */
  handleDisconnect(roomCode: string, seat: Seat): void {
    if (!this.disconnected.has(roomCode)) {
      this.disconnected.set(roomCode, new Set());
    }
    this.disconnected.get(roomCode)!.add(seat);

    this.broadcaster.broadcastToRoom(roomCode, {
      type: 'PLAYER_DISCONNECTED',
      seat,
    });

    const existing = this.sessions.get(roomCode);
    if (existing) {
      // Additional seat dropped inside the existing window — merge, leave the
      // original timer in place. Per spec the hold is per-event, not per-seat.
      existing.disconnectedSeats.add(seat);
    } else {
      this.startGrace(roomCode, seat);
    }
  }

  /** REQ-F-SJ12: Reconnect within grace restores the seat without validation. */
  handleReconnect(roomCode: string, seat: Seat): void {
    const disconnectedSeats = this.disconnected.get(roomCode);
    if (disconnectedSeats) {
      disconnectedSeats.delete(seat);
      if (disconnectedSeats.size === 0) this.disconnected.delete(roomCode);
    }

    this.broadcaster.broadcastToRoom(roomCode, {
      type: 'PLAYER_RECONNECTED',
      seat,
    });

    const session = this.sessions.get(roomCode);
    if (session) {
      session.disconnectedSeats.delete(seat);
      if (session.disconnectedSeats.size === 0) {
        clearTimeout(session.timeoutHandle);
        this.sessions.delete(roomCode);
      }
    }
  }

  /** Back-compat no-op: the vote scheme has been removed but the client
   *  protocol still carries `DISCONNECT_VOTE` messages until M5 drops them. */
  handleVote(_roomCode: string, _voterSeat: Seat, _vote: DisconnectVote): VoteOutcome {
    return 'pending';
  }

  /** True while `seat` is inside its grace window. */
  isDisconnected(roomCode: string, seat: Seat): boolean {
    return this.disconnected.get(roomCode)?.has(seat) ?? false;
  }

  /** All seats currently under grace in `roomCode`. */
  getDisconnectedSeats(roomCode: string): Seat[] {
    return Array.from(this.disconnected.get(roomCode) ?? []);
  }

  /**
   * Status object consumed by state projection. With the vote scheme gone,
   * `votes` is always empty; `timeoutMs` is the remaining grace period in ms.
   * Returns null when no seat is under grace.
   */
  getVoteStatus(roomCode: string): {
    votes: Record<string, 'wait' | 'kick' | null>;
    disconnectedSeats: Seat[];
    timeoutMs: number;
  } | null {
    const session = this.sessions.get(roomCode);
    if (!session) return null;

    const votes: Record<string, 'wait' | 'kick' | null> = {
      north: null,
      east: null,
      south: null,
      west: null,
    };
    const elapsed = Date.now() - session.startedAt;
    const remaining = Math.max(0, this.graceTimeoutMs - elapsed);

    return {
      votes,
      disconnectedSeats: Array.from(session.disconnectedSeats),
      timeoutMs: remaining,
    };
  }

  /**
   * Always false — the vote scheme is gone. Kept so existing gating in
   * game-manager (`if (disconnectHandler.hasActiveVote) block kick vote`)
   * no longer blocks other votes during a grace hold.
   */
  hasActiveVote(_roomCode: string): boolean {
    return false;
  }

  /** Clean up all state for a room. */
  cleanupRoom(roomCode: string): void {
    const session = this.sessions.get(roomCode);
    if (session) {
      clearTimeout(session.timeoutHandle);
      this.sessions.delete(roomCode);
    }
    this.disconnected.delete(roomCode);
  }

  /** Clean up everything. */
  dispose(): void {
    for (const [, session] of this.sessions) {
      clearTimeout(session.timeoutHandle);
    }
    this.sessions.clear();
    this.disconnected.clear();
  }

  /** REQ-F-SJ12: Start the grace session for a newly disconnected seat. */
  private startGrace(roomCode: string, seat: Seat): void {
    const timeoutHandle = setTimeout(() => {
      this.expireGrace(roomCode);
    }, this.graceTimeoutMs);

    this.sessions.set(roomCode, {
      disconnectedSeats: new Set([seat]),
      timeoutHandle,
      startedAt: Date.now(),
    });
  }

  /** REQ-F-SJ12, SJ13: Grace expired — release all held seats. */
  private expireGrace(roomCode: string): void {
    const session = this.sessions.get(roomCode);
    if (!session) return;

    clearTimeout(session.timeoutHandle);
    const seats = Array.from(session.disconnectedSeats);
    this.sessions.delete(roomCode);

    this.onVoteResult?.(roomCode, 'kick', seats);
  }
}
