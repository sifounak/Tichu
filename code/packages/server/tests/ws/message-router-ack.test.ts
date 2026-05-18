// Verifies: REQ-F-RAD03, REQ-F-RAD04, REQ-F-RAD06

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageRouter } from '../../src/ws/message-router.js';
import { ConnectionManager } from '../../src/ws/connection-manager.js';
import { Broadcaster } from '../../src/ws/broadcaster.js';
import { IdempotencyMap } from '../../src/ws/idempotency-map.js';
import type { WebSocket } from 'ws';

function createMockWs(): WebSocket {
  return {
    readyState: 1,
    OPEN: 1,
    send: vi.fn(),
    ping: vi.fn(),
    terminate: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
  } as unknown as WebSocket;
}

describe('MessageRouter — ACK/NACK + Idempotency', () => {
  let connections: ConnectionManager;
  let broadcaster: Broadcaster;
  let idempotencyMap: IdempotencyMap;
  let router: MessageRouter;
  let ws: WebSocket;

  beforeEach(() => {
    connections = new ConnectionManager();
    broadcaster = new Broadcaster(connections);
    idempotencyMap = new IdempotencyMap();
    router = new MessageRouter(connections, broadcaster, idempotencyMap);
    ws = createMockWs();
    connections.addClient(ws, 'user-1', 'Alice');
  });

  // REQ-F-RAD03: ACK on successful handler execution
  it('sends ACK when handler succeeds and messageId is present', async () => {
    const handler = vi.fn();
    router.on('GET_LOBBY', handler);

    await router.handleMessage(ws, JSON.stringify({ type: 'GET_LOBBY', messageId: 'msg-1' }));

    expect(handler).toHaveBeenCalled();
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'ACK', messageId: 'msg-1' }),
    );
  });

  // No ACK when messageId absent (backward compat)
  it('does not send ACK when messageId is absent', async () => {
    const handler = vi.fn();
    router.on('GET_LOBBY', handler);

    await router.handleMessage(ws, JSON.stringify({ type: 'GET_LOBBY' }));

    expect(handler).toHaveBeenCalled();
    const calls = (ws.send as ReturnType<typeof vi.fn>).mock.calls;
    const hasAck = calls.some((c: unknown[]) => (c[0] as string).includes('"ACK"'));
    expect(hasAck).toBe(false);
  });

  // REQ-F-RAD04: NACK on handler error
  it('sends NACK when handler throws and messageId is present', async () => {
    router.on('GET_LOBBY', () => { throw new Error('Something broke'); });

    await router.handleMessage(ws, JSON.stringify({ type: 'GET_LOBBY', messageId: 'msg-2' }));

    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'NACK', messageId: 'msg-2', code: 'HANDLER_ERROR', message: 'Something broke' }),
    );
  });

  // NACK on validation failure with messageId
  it('sends NACK on validation failure when messageId present in raw JSON', async () => {
    await router.handleMessage(ws, JSON.stringify({ type: 'NONEXISTENT', messageId: 'msg-3' }));

    expect(ws.send).toHaveBeenCalledWith(
      expect.stringContaining('"NACK"'),
    );
    expect(ws.send).toHaveBeenCalledWith(
      expect.stringContaining('"msg-3"'),
    );
  });

  // REQ-F-RAD06: Idempotency — duplicate messageId replays ACK
  it('replays ACK for duplicate messageId without re-executing handler', async () => {
    const handler = vi.fn();
    router.on('GET_LOBBY', handler);

    // First call
    await router.handleMessage(ws, JSON.stringify({ type: 'GET_LOBBY', messageId: 'msg-4' }));
    expect(handler).toHaveBeenCalledTimes(1);

    // Second call with same messageId
    (ws.send as ReturnType<typeof vi.fn>).mockClear();
    await router.handleMessage(ws, JSON.stringify({ type: 'GET_LOBBY', messageId: 'msg-4' }));

    // Handler NOT called again
    expect(handler).toHaveBeenCalledTimes(1);
    // ACK replayed
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'ACK', messageId: 'msg-4' }),
    );
  });

  // Idempotency — duplicate NACK replayed
  it('replays NACK for duplicate messageId of a previously failed handler', async () => {
    router.on('GET_LOBBY', () => { throw new Error('Broken'); });

    // First call — fails
    await router.handleMessage(ws, JSON.stringify({ type: 'GET_LOBBY', messageId: 'msg-5' }));

    // Second call — replays NACK
    (ws.send as ReturnType<typeof vi.fn>).mockClear();
    await router.handleMessage(ws, JSON.stringify({ type: 'GET_LOBBY', messageId: 'msg-5' }));

    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'NACK', messageId: 'msg-5', code: 'HANDLER_ERROR', message: 'Broken' }),
    );
  });

  // HEARTBEAT_PONG: never ACK'd
  it('does not ACK HEARTBEAT_PONG even with messageId', async () => {
    const handler = vi.fn();
    router.on('HEARTBEAT_PONG', handler);

    await router.handleMessage(ws, JSON.stringify({ type: 'HEARTBEAT_PONG', messageId: 'hb-1' }));

    expect(handler).toHaveBeenCalled();
    const calls = (ws.send as ReturnType<typeof vi.fn>).mock.calls;
    const hasAck = calls.some((c: unknown[]) => (c[0] as string).includes('"ACK"'));
    expect(hasAck).toBe(false);
  });

  // Not authenticated — NACK with messageId
  it('sends NACK for unauthenticated connection when messageId present', async () => {
    const unauthWs = createMockWs();
    // Don't add to connections — simulates unauthenticated

    await router.handleMessage(unauthWs, JSON.stringify({ type: 'GET_LOBBY', messageId: 'msg-6' }));

    expect(unauthWs.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'NACK', messageId: 'msg-6', code: 'NOT_AUTHENTICATED', message: 'Connection not authenticated' }),
    );
  });

  // No handler — NACK with messageId
  it('sends NACK when no handler registered and messageId present', async () => {
    // GET_LOBBY has no handler registered
    await router.handleMessage(ws, JSON.stringify({ type: 'GET_LOBBY', messageId: 'msg-7' }));

    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'NACK', messageId: 'msg-7', code: 'UNKNOWN_TYPE', message: 'No handler for message type: GET_LOBBY' }),
    );
  });
});
