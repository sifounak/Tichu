// Verifies: REQ-NF-A02 — Server authoritative, projected state — broadcasting

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Broadcaster } from '../../src/ws/broadcaster.js';
import { ConnectionManager } from '../../src/ws/connection-manager.js';
import type { ServerMessage } from '@tichu/shared';
import type { WebSocket } from 'ws';
import type { GameMachineContext } from '../../src/game/game-state-machine.js';
import { createInitialContext } from '../../src/game/game-state-machine.js';

function createMockWs(readyState = 1): WebSocket {
  const ws = {
    readyState,
    OPEN: 1,
    send: vi.fn(),
    ping: vi.fn(),
    terminate: vi.fn(),
    close: vi.fn(),
    on: vi.fn(),
  } as unknown as WebSocket;
  return ws;
}

describe('Broadcaster', () => {
  let connections: ConnectionManager;
  let broadcaster: Broadcaster;

  beforeEach(() => {
    connections = new ConnectionManager();
    broadcaster = new Broadcaster(connections);
  });

  describe('send', () => {
    it('sends JSON message to open WebSocket', () => {
      const ws = createMockWs();
      const msg: ServerMessage = { type: 'ROOM_LEFT' };

      expect(broadcaster.send(ws, msg)).toBe(true);
      expect(ws.send).toHaveBeenCalledWith(JSON.stringify(msg));
    });

    it('returns false for closed WebSocket', () => {
      const ws = createMockWs(3); // CLOSED
      const msg: ServerMessage = { type: 'ROOM_LEFT' };

      expect(broadcaster.send(ws, msg)).toBe(false);
      expect(ws.send).not.toHaveBeenCalled();
    });
  });

  describe('sendToPlayer', () => {
    it('sends message to the client at the specified seat', () => {
      const ws = createMockWs();
      connections.addClient(ws, 'user-1', 'Alice');
      connections.assignToRoom(ws, 'ROOM-A', 'north');

      const msg: ServerMessage = { type: 'TURN_CHANGE', seat: 'north' };
      expect(broadcaster.sendToPlayer('ROOM-A', 'north', msg)).toBe(true);
      expect(ws.send).toHaveBeenCalledWith(JSON.stringify(msg));
    });

    it('returns false when no client at that seat', () => {
      const msg: ServerMessage = { type: 'TURN_CHANGE', seat: 'east' };
      expect(broadcaster.sendToPlayer('ROOM-A', 'east', msg)).toBe(false);
    });
  });

  describe('broadcastToRoom', () => {
    it('sends message to all clients in a room', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      const ws3 = createMockWs();

      connections.addClient(ws1, 'user-1', 'Alice');
      connections.addClient(ws2, 'user-2', 'Bob');
      connections.addClient(ws3, 'user-3', 'Charlie');

      connections.assignToRoom(ws1, 'ROOM-A', 'north');
      connections.assignToRoom(ws2, 'ROOM-A', 'east');
      connections.assignToRoom(ws3, 'ROOM-B', 'south');

      const msg: ServerMessage = { type: 'ROOM_LEFT' };
      const sent = broadcaster.broadcastToRoom('ROOM-A', msg);

      expect(sent).toBe(2);
      expect(ws1.send).toHaveBeenCalledWith(JSON.stringify(msg));
      expect(ws2.send).toHaveBeenCalledWith(JSON.stringify(msg));
      expect(ws3.send).not.toHaveBeenCalled();
    });

    it('returns 0 for an empty room', () => {
      const msg: ServerMessage = { type: 'ROOM_LEFT' };
      expect(broadcaster.broadcastToRoom('EMPTY', msg)).toBe(0);
    });
  });

  describe('broadcastGameState', () => {
    it('sends projected state to each player in a room', () => {
      const wsN = createMockWs();
      const wsE = createMockWs();

      connections.addClient(wsN, 'user-1', 'Alice');
      connections.addClient(wsE, 'user-2', 'Bob');
      connections.assignToRoom(wsN, 'ROOM-A', 'north');
      connections.assignToRoom(wsE, 'ROOM-A', 'east');

      const context = createInitialContext('game-1');
      const sent = broadcaster.broadcastGameState('ROOM-A', context, 'lobby');

      expect(sent).toBe(2);

      // Each player should receive a GAME_STATE message with their own seat
      const northMsg = JSON.parse((wsN.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
      expect(northMsg.type).toBe('GAME_STATE');
      expect(northMsg.state.mySeat).toBe('north');

      const eastMsg = JSON.parse((wsE.send as ReturnType<typeof vi.fn>).mock.calls[0][0]);
      expect(eastMsg.type).toBe('GAME_STATE');
      expect(eastMsg.state.mySeat).toBe('east');
    });

    it('skips clients without seat assignment (spectators)', () => {
      const wsPlayer = createMockWs();
      const wsSpectator = createMockWs();

      connections.addClient(wsPlayer, 'user-1', 'Alice');
      connections.addClient(wsSpectator, 'user-2', 'Bob');
      connections.assignToRoom(wsPlayer, 'ROOM-A', 'north');
      connections.assignToRoom(wsSpectator, 'ROOM-A', null as never);
      // Manually set spectator's room without seat
      const info = connections.getClientInfo(wsSpectator);
      if (info) {
        info.roomCode = 'ROOM-A';
        info.seat = null;
      }

      const context = createInitialContext('game-1');
      const sent = broadcaster.broadcastGameState('ROOM-A', context, 'lobby');

      expect(sent).toBe(1); // Only player with seat
      expect(wsPlayer.send).toHaveBeenCalled();
      expect(wsSpectator.send).not.toHaveBeenCalled();
    });
  });

  describe('broadcastToSpectators', () => {
    it('sends message only to clients without a seat', () => {
      const wsPlayer = createMockWs();
      const wsSpectator = createMockWs();

      connections.addClient(wsPlayer, 'user-1', 'Alice');
      connections.addClient(wsSpectator, 'user-2', 'Bob');
      connections.assignToRoom(wsPlayer, 'ROOM-A', 'north');
      // Spectator: in room but no seat
      const info = connections.getClientInfo(wsSpectator);
      if (info) {
        info.roomCode = 'ROOM-A';
        info.seat = null;
      }

      const msg: ServerMessage = { type: 'PLAYER_PASSED', seat: 'north' };
      const sent = broadcaster.broadcastToSpectators('ROOM-A', msg);

      expect(sent).toBe(1);
      expect(wsSpectator.send).toHaveBeenCalledWith(JSON.stringify(msg));
      expect(wsPlayer.send).not.toHaveBeenCalled();
    });
  });

  describe('sendError', () => {
    it('sends an ERROR message', () => {
      const ws = createMockWs();
      broadcaster.sendError(ws, 'BAD_REQUEST', 'Something went wrong');

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'ERROR', code: 'BAD_REQUEST', message: 'Something went wrong' }),
      );
    });
  });
});
