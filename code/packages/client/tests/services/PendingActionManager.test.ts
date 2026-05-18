// Verifies: REQ-F-RAD02, REQ-F-RAD05, REQ-F-RAD09, REQ-F-RAD10, REQ-F-RAD11, REQ-F-RAD12
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PendingActionManager, type PendingActionManagerCallbacks, type UISnapshot } from '@/services/PendingActionManager';

// Mock crypto.randomUUID
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-1234' });

describe('PendingActionManager', () => {
  let manager: PendingActionManager;
  let callbacks: PendingActionManagerCallbacks;
  let rawSendMock: ReturnType<typeof vi.fn>;
  let onSpinnerNeededMock: ReturnType<typeof vi.fn>;
  let onResolvedMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    rawSendMock = vi.fn().mockReturnValue(true);
    onSpinnerNeededMock = vi.fn();
    onResolvedMock = vi.fn();
    callbacks = {
      rawSend: rawSendMock,
      onSpinnerNeeded: onSpinnerNeededMock,
      onResolved: onResolvedMock,
    };
    manager = new PendingActionManager(callbacks);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('submit', () => {
    it('sends message with messageId and tracks it', () => {
      const message = { type: 'PLAY_CARDS' as const, cardIds: [1, 2, 3] };
      const messageId = manager.submit(message);

      expect(messageId).toBe('test-uuid-1234');
      expect(rawSendMock).toHaveBeenCalledWith({
        type: 'PLAY_CARDS',
        cardIds: [1, 2, 3],
        messageId: 'test-uuid-1234',
      });
      expect(manager.size).toBe(1);
    });

    it('stores snapshot when provided', () => {
      const snapshot: UISnapshot = { selectedCardIds: [1, 2], autoPassEnabled: false };
      const message = { type: 'PLAY_CARDS' as const, cardIds: [1, 2] };
      const messageId = manager.submit(message, snapshot);

      expect(manager.getSnapshot(messageId)).toEqual(snapshot);
    });

    it('passes snapshot to onResolved on ack', () => {
      const snapshot: UISnapshot = { selectedCardIds: [3, 4], autoPassEnabled: true };
      const message = { type: 'PLAY_CARDS' as const, cardIds: [3, 4] };
      const messageId = manager.submit(message, snapshot);

      manager.handleAck(messageId);
      expect(onResolvedMock).toHaveBeenCalledWith('ack', 'test-uuid-1234', snapshot);
    });

    it('passes snapshot to onResolved on nack', () => {
      const snapshot: UISnapshot = { selectedCardIds: [5], autoPassEnabled: false };
      const message = { type: 'PLAY_CARDS' as const, cardIds: [5] };
      const messageId = manager.submit(message, snapshot);

      manager.handleNack(messageId, 'ERR', 'fail');
      expect(onResolvedMock).toHaveBeenCalledWith('nack', 'test-uuid-1234', snapshot, 'ERR', 'fail');
    });
  });

  describe('retry timing — REQ-F-RAD05', () => {
    it('retries at 2s, 4s, 6s intervals', () => {
      const message = { type: 'PASS' as const };
      manager.submit(message);
      rawSendMock.mockClear();

      // First retry at 2s
      vi.advanceTimersByTime(2000);
      expect(rawSendMock).toHaveBeenCalledTimes(1);

      // Second retry at 4s after first
      rawSendMock.mockClear();
      vi.advanceTimersByTime(4000);
      expect(rawSendMock).toHaveBeenCalledTimes(1);

      // Third retry at 6s after second
      rawSendMock.mockClear();
      vi.advanceTimersByTime(6000);
      expect(rawSendMock).toHaveBeenCalledTimes(1);
    });

    it('resolves as nack after all retries exhausted', () => {
      const message = { type: 'PASS' as const };
      manager.submit(message);

      // Advance through all 3 retries: 2s + 4s + 6s = 12s total, then the final retry schedules the next which triggers exhaustion
      vi.advanceTimersByTime(2000); // retry 1 fires
      vi.advanceTimersByTime(4000); // retry 2 fires
      vi.advanceTimersByTime(6000); // retry 3 fires — now retryCount=3, exhausted

      expect(onResolvedMock).toHaveBeenCalledWith('nack', 'test-uuid-1234', undefined, 'TIMEOUT', 'No response after retries');
      expect(manager.size).toBe(0);
    });
  });

  describe('spinner timer', () => {
    it('fires onSpinnerNeeded after 3s', () => {
      const message = { type: 'PASS' as const };
      manager.submit(message);

      vi.advanceTimersByTime(2999);
      expect(onSpinnerNeededMock).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(onSpinnerNeededMock).toHaveBeenCalledWith('test-uuid-1234');
    });

    it('does not fire if ACK received before 3s', () => {
      const message = { type: 'PASS' as const };
      const messageId = manager.submit(message);

      vi.advanceTimersByTime(1000);
      manager.handleAck(messageId);

      vi.advanceTimersByTime(5000);
      expect(onSpinnerNeededMock).not.toHaveBeenCalled();
    });
  });

  describe('handleAck — REQ-F-RAD10', () => {
    it('clears pending action and resolves as ack', () => {
      const message = { type: 'PASS' as const };
      const messageId = manager.submit(message);

      manager.handleAck(messageId);

      expect(manager.size).toBe(0);
      expect(onResolvedMock).toHaveBeenCalledWith('ack', 'test-uuid-1234', undefined);
    });

    it('stops retry timers on ack', () => {
      const message = { type: 'PASS' as const };
      const messageId = manager.submit(message);
      rawSendMock.mockClear();

      manager.handleAck(messageId);

      // No retries should fire
      vi.advanceTimersByTime(20000);
      expect(rawSendMock).not.toHaveBeenCalled();
    });

    it('ignores unknown messageId', () => {
      manager.handleAck('unknown-id');
      expect(onResolvedMock).not.toHaveBeenCalled();
    });
  });

  describe('handleNack — REQ-F-RAD11', () => {
    it('clears pending action and resolves as nack with code/message', () => {
      const message = { type: 'PASS' as const };
      const messageId = manager.submit(message);

      manager.handleNack(messageId, 'HANDLER_ERROR', 'Not your turn');

      expect(manager.size).toBe(0);
      expect(onResolvedMock).toHaveBeenCalledWith('nack', 'test-uuid-1234', undefined, 'HANDLER_ERROR', 'Not your turn');
    });

    it('stops retry timers on nack', () => {
      const message = { type: 'PASS' as const };
      const messageId = manager.submit(message);
      rawSendMock.mockClear();

      manager.handleNack(messageId, 'ERR', 'fail');

      vi.advanceTimersByTime(20000);
      expect(rawSendMock).not.toHaveBeenCalled();
    });
  });

  describe('retryAll — REQ-F-RAD09', () => {
    it('re-sends all pending actions immediately', () => {
      // Submit two messages with different UUIDs
      let callCount = 0;
      vi.stubGlobal('crypto', { randomUUID: () => `uuid-${++callCount}` });

      const msg1 = { type: 'PASS' as const };
      const msg2 = { type: 'SEND_CHAT' as const, text: 'hello' };
      manager.submit(msg1);
      manager.submit(msg2);
      rawSendMock.mockClear();

      manager.retryAll();

      expect(rawSendMock).toHaveBeenCalledTimes(2);
      expect(manager.size).toBe(2);
    });

    it('resets retry count so full retry chain restarts', () => {
      const message = { type: 'PASS' as const };
      manager.submit(message);

      // Advance past first retry
      vi.advanceTimersByTime(2000);
      rawSendMock.mockClear();

      // Simulate reconnect
      manager.retryAll();
      expect(rawSendMock).toHaveBeenCalledTimes(1); // immediate re-send
      rawSendMock.mockClear();

      // New retry chain starts at 2s again
      vi.advanceTimersByTime(2000);
      expect(rawSendMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancelAll', () => {
    it('clears all pending actions and timers', () => {
      let callCount = 0;
      vi.stubGlobal('crypto', { randomUUID: () => `uuid-${++callCount}` });

      manager.submit({ type: 'PASS' as const });
      manager.submit({ type: 'PASS' as const });

      manager.cancelAll();

      expect(manager.size).toBe(0);
      rawSendMock.mockClear();
      vi.advanceTimersByTime(20000);
      expect(rawSendMock).not.toHaveBeenCalled();
      expect(onSpinnerNeededMock).not.toHaveBeenCalled();
    });
  });

  describe('REQ-F-RAD12: chat messages tracked', () => {
    it('tracks SEND_CHAT messages with retry', () => {
      // Reset the UUID stub for this test
      vi.stubGlobal('crypto', { randomUUID: () => 'chat-uuid' });
      const freshManager = new PendingActionManager(callbacks);
      const message = { type: 'SEND_CHAT' as const, text: 'gg' };
      freshManager.submit(message);

      expect(rawSendMock).toHaveBeenCalledWith(expect.objectContaining({
        type: 'SEND_CHAT',
        text: 'gg',
        messageId: 'chat-uuid',
      }));
      expect(freshManager.size).toBe(1);
    });
  });
});
