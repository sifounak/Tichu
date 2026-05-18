// REQ-F-RAD02: Client tracks pending actions (messageId, payload, sentAt, retryCount)
// REQ-F-RAD05: Client retries at 2s, 4s, 6s (3 max)
// REQ-F-RAD09: On reconnection, pending actions auto-retry

import type { ClientMessage } from '@tichu/shared';

/** Pre-action UI state captured before optimistic clear */
export interface UISnapshot {
  selectedCardIds: number[];
  autoPassEnabled: boolean;
}

export interface PendingAction {
  messageId: string;
  payload: ClientMessage & { messageId: string };
  sentAt: number;
  retryCount: number;
  retryTimer: ReturnType<typeof setTimeout> | null;
  spinnerTimer: ReturnType<typeof setTimeout> | null;
  snapshot?: UISnapshot;
}

export type ResolutionResult = 'ack' | 'nack';

export interface PendingActionManagerCallbacks {
  /** Send raw payload over WebSocket. Returns true if sent successfully. */
  rawSend: (payload: ClientMessage & { messageId: string }) => boolean;
  /** Called when spinner should be shown (3s without response) */
  onSpinnerNeeded: (messageId: string) => void;
  /** Called when a pending action is resolved */
  onResolved: (result: ResolutionResult, messageId: string, snapshot?: UISnapshot, code?: string, message?: string) => void;
}

const RETRY_DELAYS_MS = [2000, 4000, 6000];
const SPINNER_DELAY_MS = 3000;
const MAX_RETRIES = 3;

export class PendingActionManager {
  private pending = new Map<string, PendingAction>();
  private callbacks: PendingActionManagerCallbacks;

  constructor(callbacks: PendingActionManagerCallbacks) {
    this.callbacks = callbacks;
  }

  /** Submit a message for tracked delivery with retry */
  submit(message: ClientMessage, snapshot?: UISnapshot): string {
    const messageId = crypto.randomUUID();
    const payload = { ...message, messageId } as ClientMessage & { messageId: string };

    const action: PendingAction = {
      messageId,
      payload,
      sentAt: Date.now(),
      retryCount: 0,
      retryTimer: null,
      spinnerTimer: null,
      snapshot,
    };

    this.pending.set(messageId, action);
    this.callbacks.rawSend(payload);
    this.scheduleRetry(action);
    this.scheduleSpinner(action);

    return messageId;
  }

  /** Handle ACK from server — action delivered successfully */
  handleAck(messageId: string): void {
    const action = this.pending.get(messageId);
    if (!action) return;
    this.clearTimers(action);
    this.pending.delete(messageId);
    this.callbacks.onResolved('ack', messageId, action.snapshot);
  }

  /** Handle NACK from server — action rejected */
  handleNack(messageId: string, code?: string, message?: string): void {
    const action = this.pending.get(messageId);
    if (!action) return;
    this.clearTimers(action);
    this.pending.delete(messageId);
    this.callbacks.onResolved('nack', messageId, action.snapshot, code, message);
  }

  /** REQ-F-RAD09: Re-send all pending actions on reconnection */
  retryAll(): void {
    for (const action of this.pending.values()) {
      this.clearTimers(action);
      action.sentAt = Date.now();
      action.retryCount = 0;
      this.callbacks.rawSend(action.payload);
      this.scheduleRetry(action);
      this.scheduleSpinner(action);
    }
  }

  /** Cancel all pending actions (intentional disconnect) */
  cancelAll(): void {
    for (const action of this.pending.values()) {
      this.clearTimers(action);
    }
    this.pending.clear();
  }

  /** Get the current number of pending actions */
  get size(): number {
    return this.pending.size;
  }

  /** Get a pending action's snapshot (used for state restoration) */
  getSnapshot(messageId: string): UISnapshot | undefined {
    return this.pending.get(messageId)?.snapshot;
  }

  private scheduleRetry(action: PendingAction): void {
    if (action.retryCount >= MAX_RETRIES) {
      // All retries exhausted — treat as failure
      this.clearTimers(action);
      this.pending.delete(action.messageId);
      this.callbacks.onResolved('nack', action.messageId, action.snapshot, 'TIMEOUT', 'No response after retries');
      return;
    }

    const delay = RETRY_DELAYS_MS[action.retryCount];
    action.retryTimer = setTimeout(() => {
      action.retryCount += 1;
      action.sentAt = Date.now();
      this.callbacks.rawSend(action.payload);
      this.scheduleRetry(action);
    }, delay);
  }

  private scheduleSpinner(action: PendingAction): void {
    // Only schedule if not already showing
    if (action.spinnerTimer) return;
    action.spinnerTimer = setTimeout(() => {
      // Only fire if still pending
      if (this.pending.has(action.messageId)) {
        this.callbacks.onSpinnerNeeded(action.messageId);
      }
    }, SPINNER_DELAY_MS);
  }

  private clearTimers(action: PendingAction): void {
    if (action.retryTimer) {
      clearTimeout(action.retryTimer);
      action.retryTimer = null;
    }
    if (action.spinnerTimer) {
      clearTimeout(action.spinnerTimer);
      action.spinnerTimer = null;
    }
  }
}
