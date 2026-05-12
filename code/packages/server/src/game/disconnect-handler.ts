// REQ-F-DC01–DC04: Per-seat disconnect tracking with independent timers.
// Replaces the old per-room grace-period model. Game no longer pauses on
// disconnect — only solo-human games freeze.

import type { Seat } from '@tichu/shared';
import type { Broadcaster } from '../ws/broadcaster.js';


/** Per-seat disconnect tracking state. */
interface SeatDisconnectState {
  /** Epoch ms when this seat disconnected. */
  disconnectedAt: number;
  /** Timer handle for 2-min + 5s threshold callback. */
  thresholdTimer: ReturnType<typeof setTimeout>;
  /** Whether this seat has already crossed the 2-min threshold. */
  crossedThreshold: boolean;
}

/** State for solo-human freeze (game pauses when the only human disconnects). */
interface FrozenSession {
  seat: Seat;
  timeoutHandle: ReturnType<typeof setTimeout>;
  startedAt: number;
  timeoutMs: number;
}

/** Threshold delay: 2 minutes + 5 seconds = 125,000ms (REQ-F-KM01). */
const THRESHOLD_DELAY_MS = 125_000;

/**
 * REQ-F-DC01–DC04, GF01: Per-seat disconnect tracking.
 *
 * Flow:
 * 1. `handleDisconnect` — marks seat as disconnected, starts per-seat timer.
 *    Game does NOT pause (multi-human) or freezes (solo-human).
 * 2. `handleReconnect` — fully resets timer, clears all state for that seat.
 * 3. At 2:05 (threshold) — fires `onThresholdCrossed` callback for kick dialog.
 * 4. Solo-human: fires `onGraceExpired` after grace expiry (existing vacancy flow).
 */
export class DisconnectHandler {
  /** Per-seat disconnect state, keyed by room then seat. */
  private readonly seatStates = new Map<string, Map<Seat, SeatDisconnectState>>();

  /** Solo-human frozen session (game pauses). Only one per room. */
  private readonly frozenSessions = new Map<string, FrozenSession>();

  /** Called when a seat crosses the 2-min + 5s threshold. */
  onThresholdCrossed: ((roomCode: string, seat: Seat) => void) | null = null;

  /** Called when solo-human grace expires — seat is vacated. */
  onGraceExpired: ((roomCode: string, seats: Seat[]) => void) | null = null;

  constructor(
    private readonly broadcaster: Broadcaster,
    private readonly options?: { thresholdMs?: number },
  ) {}

  /** REQ-F-DC01: Record an involuntary disconnect. Starts per-seat timer. */
  handleDisconnect(roomCode: string, seat: Seat, options?: { frozen?: boolean; graceTimeoutMs?: number }): void {
    if (!this.seatStates.has(roomCode)) {
      this.seatStates.set(roomCode, new Map());
    }

    const roomSeats = this.seatStates.get(roomCode)!;

    // Clean up any existing state for this seat (shouldn't happen but be safe)
    const existing = roomSeats.get(seat);
    if (existing) {
      clearTimeout(existing.thresholdTimer);
    }

    const thresholdMs = this.options?.thresholdMs ?? THRESHOLD_DELAY_MS;

    const frozen = options?.frozen ?? false;

    // REQ-F-DC02: Timer starts from zero each time
    const thresholdTimer = frozen
      ? setTimeout(() => {}, 0) // No threshold timer for frozen sessions — placeholder
      : setTimeout(() => {
          this.handleThresholdCrossed(roomCode, seat);
        }, thresholdMs);

    // For frozen sessions, clear the placeholder timer immediately and don't track it
    if (frozen) {
      clearTimeout(thresholdTimer);
      // REQ-F-SGP02: 36-hour grace period for frozen solo-human games (was 3 days)
      this.startFrozenSession(roomCode, seat, options?.graceTimeoutMs ?? 129_600_000);
    }

    roomSeats.set(seat, {
      disconnectedAt: Date.now(),
      thresholdTimer: frozen ? (null as unknown as ReturnType<typeof setTimeout>) : thresholdTimer,
      crossedThreshold: false,
    });

    this.broadcaster.broadcastToRoom(roomCode, {
      type: 'PLAYER_DISCONNECTED',
      seat,
    });
  }

  /** REQ-F-DC03: Reconnect fully resets timer and clears all state for this seat. */
  handleReconnect(roomCode: string, seat: Seat): void {
    const roomSeats = this.seatStates.get(roomCode);
    if (roomSeats) {
      const state = roomSeats.get(seat);
      if (state) {
        clearTimeout(state.thresholdTimer);
        roomSeats.delete(seat);
      }
      if (roomSeats.size === 0) this.seatStates.delete(roomCode);
    }

    // Clear frozen session if this seat was the frozen one
    const frozen = this.frozenSessions.get(roomCode);
    if (frozen && frozen.seat === seat) {
      clearTimeout(frozen.timeoutHandle);
      this.frozenSessions.delete(roomCode);
    }

    this.broadcaster.broadcastToRoom(roomCode, {
      type: 'PLAYER_RECONNECTED',
      seat,
    });
  }

  /** True while seat is tracked as disconnected. */
  isDisconnected(roomCode: string, seat: Seat): boolean {
    return this.seatStates.get(roomCode)?.has(seat) ?? false;
  }

  /** All seats currently disconnected in this room. */
  getDisconnectedSeats(roomCode: string): Seat[] {
    const roomSeats = this.seatStates.get(roomCode);
    return roomSeats ? Array.from(roomSeats.keys()) : [];
  }

  /** REQ-F-DC04: Get elapsed disconnect time for a specific seat (ms). Returns 0 if not disconnected. */
  getDisconnectDurationMs(roomCode: string, seat: Seat): number {
    const state = this.seatStates.get(roomCode)?.get(seat);
    if (!state) return 0;
    return Date.now() - state.disconnectedAt;
  }

  /** REQ-F-VI01: Get all seats that have crossed the 2-min threshold. */
  getSeatsOverThreshold(roomCode: string): Seat[] {
    const roomSeats = this.seatStates.get(roomCode);
    if (!roomSeats) return [];
    const result: Seat[] = [];
    for (const [seat, state] of roomSeats) {
      if (state.crossedThreshold) {
        result.push(seat);
      }
    }
    return result;
  }

  /** True if the room is in a frozen (solo-human pause) state. */
  isFrozen(roomCode: string): boolean {
    return this.frozenSessions.has(roomCode);
  }

  /** Returns the epoch ms when the room was frozen, or null if not frozen. */
  getFrozenSince(roomCode: string): number | null {
    const session = this.frozenSessions.get(roomCode);
    return session ? session.startedAt : null;
  }

  /** Clean up all state for a room. */
  cleanupRoom(roomCode: string): void {
    const roomSeats = this.seatStates.get(roomCode);
    if (roomSeats) {
      for (const state of roomSeats.values()) {
        clearTimeout(state.thresholdTimer);
      }
      this.seatStates.delete(roomCode);
    }
    const frozen = this.frozenSessions.get(roomCode);
    if (frozen) {
      clearTimeout(frozen.timeoutHandle);
      this.frozenSessions.delete(roomCode);
    }
  }

  /** Clean up everything. */
  dispose(): void {
    for (const roomSeats of this.seatStates.values()) {
      for (const state of roomSeats.values()) {
        clearTimeout(state.thresholdTimer);
      }
    }
    this.seatStates.clear();
    for (const frozen of this.frozenSessions.values()) {
      clearTimeout(frozen.timeoutHandle);
    }
    this.frozenSessions.clear();
  }

  /** Handle a seat crossing the 2-min + 5s threshold. */
  private handleThresholdCrossed(roomCode: string, seat: Seat): void {
    const roomSeats = this.seatStates.get(roomCode);
    const state = roomSeats?.get(seat);
    if (!state) return;

    state.crossedThreshold = true;
    this.onThresholdCrossed?.(roomCode, seat);
  }

  /** Start a frozen (solo-human) grace session. */
  private startFrozenSession(roomCode: string, seat: Seat, timeoutMs: number): void {
    const timeoutHandle = setTimeout(() => {
      this.frozenSessions.delete(roomCode);
      // Also clean up the seat state
      const roomSeats = this.seatStates.get(roomCode);
      if (roomSeats) {
        const state = roomSeats.get(seat);
        if (state) clearTimeout(state.thresholdTimer);
        roomSeats.delete(seat);
        if (roomSeats.size === 0) this.seatStates.delete(roomCode);
      }
      this.onGraceExpired?.(roomCode, [seat]);
    }, timeoutMs);

    this.frozenSessions.set(roomCode, {
      seat,
      timeoutHandle,
      startedAt: Date.now(),
      timeoutMs,
    });
  }
}
