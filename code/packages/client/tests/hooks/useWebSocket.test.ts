// Verifies: REQ-NF-A03 — WebSocket hook with Zod validation and reconnection
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ServerMessage } from '@tichu/shared';
import { useWebSocket, type ConnectionStatus } from '@/hooks/useWebSocket';

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  readyState = 0; // CONNECTING
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = 3; // CLOSED
    // Don't auto-fire onclose here — tests control it
  }

  // Test helpers
  simulateOpen() {
    this.readyState = 1; // OPEN
    this.onopen?.();
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateClose() {
    this.readyState = 3;
    this.onclose?.();
  }

  static get OPEN() { return 1; }
  static get CLOSED() { return 3; }
}

describe('useWebSocket', () => {
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

  it('connects on mount and calls onStatusChange', () => {
    const onMessage = vi.fn();
    const onStatusChange = vi.fn();
    renderHook(() =>
      useWebSocket({
        url: 'ws://localhost:3001/ws',
        onMessage,
        onStatusChange,
      }),
    );

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(onStatusChange).toHaveBeenCalledWith('connecting');

    act(() => getLatestWs().simulateOpen());
    expect(onStatusChange).toHaveBeenCalledWith('connected');
  });

  it('parses and validates incoming messages with Zod', () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://localhost:3001/ws', onMessage }),
    );

    act(() => getLatestWs().simulateOpen());

    // Valid message
    act(() => getLatestWs().simulateMessage({ type: 'TURN_CHANGE', seat: 'east' }));
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'TURN_CHANGE', seat: 'east' }),
    );
  });

  it('rejects invalid messages', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onMessage = vi.fn();
    renderHook(() =>
      useWebSocket({ url: 'ws://localhost:3001/ws', onMessage }),
    );

    act(() => getLatestWs().simulateOpen());
    act(() => getLatestWs().simulateMessage({ type: 'INVALID_TYPE', foo: 'bar' }));

    expect(onMessage).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalled();
    consoleWarn.mockRestore();
  });

  it('rejects non-JSON messages', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onMessage = vi.fn();
    renderHook(() =>
      useWebSocket({ url: 'ws://localhost:3001/ws', onMessage }),
    );

    act(() => getLatestWs().simulateOpen());
    act(() => getLatestWs().onmessage?.({ data: 'not-json' }));

    expect(onMessage).not.toHaveBeenCalled();
    consoleWarn.mockRestore();
  });

  it('sends typed messages', () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://localhost:3001/ws', onMessage }),
    );

    act(() => getLatestWs().simulateOpen());
    act(() => result.current.send({ type: 'PASS_TURN' }));

    expect(getLatestWs().sentMessages).toHaveLength(1);
    expect(JSON.parse(getLatestWs().sentMessages[0])).toEqual({ type: 'PASS_TURN' });
  });

  it('does not send when disconnected', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onMessage = vi.fn();
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://localhost:3001/ws', onMessage }),
    );

    // Don't open the connection
    act(() => result.current.send({ type: 'PASS_TURN' }));
    expect(getLatestWs().sentMessages).toHaveLength(0);
    consoleWarn.mockRestore();
  });

  it('disconnects on unmount', () => {
    const onMessage = vi.fn();
    const { unmount } = renderHook(() =>
      useWebSocket({ url: 'ws://localhost:3001/ws', onMessage }),
    );

    act(() => getLatestWs().simulateOpen());
    const ws = getLatestWs();
    unmount();
    expect(ws.readyState).toBe(3); // CLOSED
  });

  it('reconnects with exponential backoff', () => {
    const onMessage = vi.fn();
    const onStatusChange = vi.fn();

    renderHook(() =>
      useWebSocket({
        url: 'ws://localhost:3001/ws',
        onMessage,
        onStatusChange,
        maxRetries: 3,
      }),
    );

    act(() => getLatestWs().simulateOpen());
    expect(MockWebSocket.instances).toHaveLength(1);

    // Simulate connection drop
    act(() => getLatestWs().simulateClose());
    expect(onStatusChange).toHaveBeenCalledWith('reconnecting');

    // Advance timers to trigger reconnection
    act(() => vi.advanceTimersByTime(20000));
    expect(MockWebSocket.instances.length).toBeGreaterThan(1);
  });

  it('stops reconnecting after maxRetries', () => {
    const onMessage = vi.fn();
    const onStatusChange = vi.fn();

    renderHook(() =>
      useWebSocket({
        url: 'ws://localhost:3001/ws',
        onMessage,
        onStatusChange,
        maxRetries: 2,
      }),
    );

    // Simulate repeated connection failures
    for (let i = 0; i < 3; i++) {
      act(() => getLatestWs().simulateClose());
      act(() => vi.advanceTimersByTime(60000));
    }

    // After maxRetries, status should be disconnected
    const calls = onStatusChange.mock.calls.map((c: [ConnectionStatus]) => c[0]);
    expect(calls[calls.length - 1]).toBe('disconnected');
  });

  it('does not reconnect when autoReconnect is false', () => {
    const onMessage = vi.fn();
    renderHook(() =>
      useWebSocket({
        url: 'ws://localhost:3001/ws',
        onMessage,
        autoReconnect: false,
      }),
    );

    act(() => getLatestWs().simulateOpen());
    const initialCount = MockWebSocket.instances.length;

    act(() => getLatestWs().simulateClose());
    act(() => vi.advanceTimersByTime(60000));

    expect(MockWebSocket.instances.length).toBe(initialCount);
  });

  it('returns correct status', () => {
    const onMessage = vi.fn();
    const { result } = renderHook(() =>
      useWebSocket({ url: 'ws://localhost:3001/ws', onMessage }),
    );

    // Initial status
    expect(['connecting', 'disconnected']).toContain(result.current.status);

    act(() => getLatestWs().simulateOpen());
    expect(result.current.status).toBe('connected');
  });
});
