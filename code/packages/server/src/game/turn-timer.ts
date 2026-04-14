// REQ-F-MP09: Optional turn timer with auto-pass on timeout

import type { Seat } from '@tichu/shared';
import type { TimerSnapshot } from './game-serializer.js';

/** Callback fired when a player's turn times out */
export type TurnTimeoutCallback = (seat: Seat) => void;

/**
 * REQ-F-MP09: Turn timer for enforcing time limits on player actions.
 *
 * Starts a countdown when a player's turn begins. If the player doesn't act
 * within the configured duration, fires a timeout callback (typically an auto-pass).
 *
 * If turnTimerSeconds is null, the timer is disabled (no time limit).
 */
export class TurnTimer {
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private currentSeat: Seat | null = null;
  private readonly durationMs: number | null;
  private readonly onTimeout: TurnTimeoutCallback;
  private startTime: number | null = null;

  constructor(turnTimerSeconds: number | null, onTimeout: TurnTimeoutCallback) {
    this.durationMs = turnTimerSeconds !== null ? turnTimerSeconds * 1000 : null;
    this.onTimeout = onTimeout;
  }

  /** Start (or restart) the timer for a player's turn */
  start(seat: Seat): void {
    this.stop();

    if (this.durationMs === null) return; // Timer disabled

    this.currentSeat = seat;
    this.startTime = Date.now();
    this.timerId = setTimeout(() => {
      const timedOutSeat = this.currentSeat;
      this.timerId = null;
      this.currentSeat = null;
      this.startTime = null;
      if (timedOutSeat) {
        this.onTimeout(timedOutSeat);
      }
    }, this.durationMs);
  }

  /** Stop the current timer */
  stop(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.currentSeat = null;
    this.startTime = null;
  }

  /** Get the seat whose timer is currently running */
  getCurrentSeat(): Seat | null {
    return this.currentSeat;
  }

  /** Get remaining time in milliseconds, or null if no timer is running */
  getRemainingMs(): number | null {
    if (this.durationMs === null || this.startTime === null) return null;
    const elapsed = Date.now() - this.startTime;
    return Math.max(0, this.durationMs - elapsed);
  }

  /** Check if the timer is currently active */
  isActive(): boolean {
    return this.timerId !== null;
  }

  /** Check if the timer feature is enabled (has a non-null duration) */
  isEnabled(): boolean {
    return this.durationMs !== null;
  }

  /** REQ-F-TT05: Get the timestamp when the current timer started */
  getStartTime(): number | null {
    return this.startTime;
  }

  /** REQ-F-TT05: Get the total timer duration in milliseconds */
  getDurationMs(): number | null {
    return this.durationMs;
  }

  /** Dispose of the timer (call on cleanup) */
  dispose(): void {
    this.stop();
  }

  /**
   * Serialize the current timer state to a snapshot.
   * Returns null when the timer is disabled or not currently active.
   */
  serialize(): TimerSnapshot | null {
    if (this.durationMs === null || this.currentSeat === null || this.startTime === null) {
      return null;
    }
    return {
      currentSeat: this.currentSeat,
      startTime: this.startTime,
      durationMs: this.durationMs,
    };
  }

  /**
   * Restore a TurnTimer from a snapshot.
   * The timer is created with the correct duration but is NOT started —
   * the caller starts it explicitly after the first human reconnects.
   */
  static restore(snapshot: TimerSnapshot, onTimeout: TurnTimeoutCallback): TurnTimer {
    const durationSeconds = snapshot.durationMs / 1000;
    return new TurnTimer(durationSeconds, onTimeout);
  }
}
