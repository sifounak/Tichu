import { describe, it, expect, vi } from 'vitest';
import type { WebSocket } from 'ws';
import { GameHandler } from '../../src/game/game-handler.js';
import { MessageRouter } from '../../src/ws/message-router.js';
import { ConnectionManager } from '../../src/ws/connection-manager.js';
import { Broadcaster } from '../../src/ws/broadcaster.js';
import { RoomManager } from '../../src/room/room-manager.js';
import type { GameStore } from '../../src/game/game-store.js';

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

describe('GameHandler chat', () => {
  it('stores and broadcasts player chat with the original sender name', async () => {
    const connections = new ConnectionManager();
    const broadcaster = new Broadcaster(connections);
    const router = new MessageRouter(connections, broadcaster);
    const roomManager = new RoomManager();
    const gameStore = { getGameByRoom: vi.fn() } as unknown as GameStore;
    const ws = createMockWs();

    connections.addClient(ws, 'user-1', 'Alice');
    connections.assignToRoom(ws, 'ROOM1', 'east');
    new GameHandler(router, connections, broadcaster, gameStore, roomManager);

    await router.handleMessage(ws, JSON.stringify({ type: 'CHAT_MESSAGE', text: 'hello' }));

    expect(roomManager.getChatHistory('ROOM1')).toEqual([
      expect.objectContaining({ from: 'east', playerName: 'Alice', text: 'hello' }),
    ]);
    expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('"playerName":"Alice"'));
  });
});
