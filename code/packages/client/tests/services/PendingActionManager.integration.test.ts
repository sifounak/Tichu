// Verifies: REQ-F-RAD09, REQ-F-RAD10, REQ-F-RAD11, REQ-NF-RAD04
// Integration tests: end-to-end scenarios for reliable action delivery

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from '@/hooks/useWebSocket';

// Mock WebSocket (same as useWebSocket.test.ts)
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
  send(data: string) { this.sentMessages.push(data); }
  close() { this.readyState = 3; }
  simulateOpen() { this.readyState = 1; this.onopen?.(); }
  simulateMessage(data: unknown) { this.onmessage?.({ data: JSON.stringify(data) }); }
  simulateClose() { this.readyState = 3; this.onclose?.(); }
  static get OPEN() { return 1; }
  static get CLOSED() { return 3; }
}

describe('Reliable Action Delivery — Integration', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function getLatestWs(): MockWebSocket {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }

  it('send → ACK received → pending cleared, no spinner', () => {
    const onMessage = vi.fn();
    const onSpinnerNeeded = vi.fn();
    const onResolved = vi.fn();

    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://test/ws', onMessage, onSpinnerNeeded, onResolved }),
    );

    act(() => getLatestWs().simulateOpen());
    act(() => result.current.send({ type: 'PASS_TURN' }));

    // Extract messageId from sent message
    const sent = JSON.parse(getLatestWs().sentMessages[0]);
    expect(sent.messageId).toBeDefined();

    // Server responds with ACK before 3s
    act(() => getLatestWs().simulateMessage({ type: 'ACK', messageId: sent.messageId }));

    expect(onResolved).toHaveBeenCalledWith('ack', sent.messageId, undefined, undefined, undefined);
    expect(onSpinnerNeeded).not.toHaveBeenCalled();

    // No retries fire after ACK
    act(() => vi.advanceTimersByTime(10000));
    expect(getLatestWs().sentMessages).toHaveLength(1); // only original send
  });

  it('send → no response → retries at 2s, 4s, 6s → spinner at 3s → timeout failure', () => {
    const onMessage = vi.fn();
    const onSpinnerNeeded = vi.fn();
    const onResolved = vi.fn();

    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://test/ws', onMessage, onSpinnerNeeded, onResolved }),
    );

    act(() => getLatestWs().simulateOpen());
    act(() => result.current.send({ type: 'PLAY_CARDS', cardIds: [1, 2] }));
    expect(getLatestWs().sentMessages).toHaveLength(1);

    // At 2s: first retry
    act(() => vi.advanceTimersByTime(2000));
    expect(getLatestWs().sentMessages).toHaveLength(2);

    // At 3s: spinner fires
    act(() => vi.advanceTimersByTime(1000));
    expect(onSpinnerNeeded).toHaveBeenCalledTimes(1);

    // At 2+4=6s: second retry
    act(() => vi.advanceTimersByTime(3000));
    expect(getLatestWs().sentMessages).toHaveLength(3);

    // At 2+4+6=12s: third retry fires, then exhaustion
    act(() => vi.advanceTimersByTime(6000));
    expect(getLatestWs().sentMessages).toHaveLength(4);

    // After third retry schedules next, exhaustion triggers
    expect(onResolved).toHaveBeenCalledWith('nack', expect.any(String), undefined, 'TIMEOUT', 'No response after retries');
  });

  it('send → connection drops → reconnect → retryAll → server deduplicates via idempotency → ACK', () => {
    const onMessage = vi.fn();
    const onResolved = vi.fn();

    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://test/ws', onMessage, onResolved, maxRetries: 3 }),
    );

    act(() => getLatestWs().simulateOpen());
    act(() => result.current.send({ type: 'SEND_CHAT', text: 'hello' }));

    const firstWs = getLatestWs();
    const sent = JSON.parse(firstWs.sentMessages[0]);

    // Connection drops
    act(() => firstWs.simulateClose());

    // Reconnect after backoff
    act(() => vi.advanceTimersByTime(2000));
    const secondWs = getLatestWs();
    expect(secondWs).not.toBe(firstWs);

    // New connection opens — triggers retryAll
    act(() => secondWs.simulateOpen());

    // The message should be re-sent with the SAME messageId
    expect(secondWs.sentMessages.length).toBeGreaterThanOrEqual(1);
    const retried = JSON.parse(secondWs.sentMessages[0]);
    expect(retried.messageId).toBe(sent.messageId);
    expect(retried.type).toBe('SEND_CHAT');

    // Server sees duplicate, replays ACK
    act(() => secondWs.simulateMessage({ type: 'ACK', messageId: sent.messageId }));
    expect(onResolved).toHaveBeenCalledWith('ack', sent.messageId, undefined, undefined, undefined);
  });

  it('NACK received → onResolved called with snapshot for state restoration', () => {
    const onMessage = vi.fn();
    const onResolved = vi.fn();
    const snapshot = { selectedCardIds: [10, 20], autoPassEnabled: true };

    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://test/ws', onMessage, onResolved }),
    );

    act(() => getLatestWs().simulateOpen());
    act(() => result.current.send({ type: 'PLAY_CARDS', cardIds: [10, 20] }, snapshot));

    const sent = JSON.parse(getLatestWs().sentMessages[0]);

    // Server rejects
    act(() => getLatestWs().simulateMessage({
      type: 'NACK', messageId: sent.messageId, code: 'NOT_YOUR_TURN', message: 'Wait your turn',
    }));

    expect(onResolved).toHaveBeenCalledWith('nack', sent.messageId, snapshot, 'NOT_YOUR_TURN', 'Wait your turn');
  });

  it('ACK/NACK messages do not bubble to consumer onMessage', () => {
    const onMessage = vi.fn();

    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://test/ws', onMessage }),
    );

    act(() => getLatestWs().simulateOpen());
    act(() => result.current.send({ type: 'PASS_TURN' }));
    const sent = JSON.parse(getLatestWs().sentMessages[0]);

    // ACK should not reach onMessage
    act(() => getLatestWs().simulateMessage({ type: 'ACK', messageId: sent.messageId }));
    expect(onMessage).not.toHaveBeenCalled();

    // Send another, get NACK
    act(() => result.current.send({ type: 'PASS_TURN' }));
    const sent2 = JSON.parse(getLatestWs().sentMessages[1]);
    act(() => getLatestWs().simulateMessage({
      type: 'NACK', messageId: sent2.messageId, code: 'ERR', message: 'fail',
    }));
    expect(onMessage).not.toHaveBeenCalled();
  });

  it('HEARTBEAT_PONG bypasses PendingActionManager — no messageId, no tracking', () => {
    const onMessage = vi.fn();
    const onResolved = vi.fn();

    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://test/ws', onMessage, onResolved }),
    );

    act(() => getLatestWs().simulateOpen());
    act(() => result.current.send({ type: 'HEARTBEAT_PONG' }));

    const sent = JSON.parse(getLatestWs().sentMessages[0]);
    expect(sent.messageId).toBeUndefined();
    expect(sent.type).toBe('HEARTBEAT_PONG');

    // No retries should fire
    act(() => vi.advanceTimersByTime(20000));
    expect(getLatestWs().sentMessages).toHaveLength(1);
    expect(onResolved).not.toHaveBeenCalled();
  });

  it('disconnect cancels all pending actions — no retries or callbacks fire', () => {
    const onMessage = vi.fn();
    const onSpinnerNeeded = vi.fn();
    const onResolved = vi.fn();

    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://test/ws', onMessage, onSpinnerNeeded, onResolved }),
    );

    act(() => getLatestWs().simulateOpen());
    act(() => result.current.send({ type: 'PASS_TURN' }));
    act(() => result.current.send({ type: 'SEND_CHAT', text: 'bye' }));

    // Intentional disconnect
    act(() => result.current.disconnect());

    // Nothing fires after disconnect
    act(() => vi.advanceTimersByTime(20000));
    expect(onSpinnerNeeded).not.toHaveBeenCalled();
    expect(onResolved).not.toHaveBeenCalled();
  });
});
