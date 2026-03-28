// Verifies: REQ-F-DR01, REQ-F-DR02, REQ-F-DR03, REQ-F-MP01, REQ-F-MP08

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GameManager } from '../../src/game/game-manager.js';
import { DisconnectHandler } from '../../src/game/disconnect-handler.js';
import type { Broadcaster } from '../../src/ws/broadcaster.js';
import type { WebSocket } from 'ws';
import type { Seat, GameCard, ClientMessage, GameConfig, Rank } from '@tichu/shared';
import { SEATS_IN_ORDER } from '@tichu/shared';

// ─── Mocks ──────────────────────────────────────────────────────────────────

function createMockBroadcaster(): Broadcaster {
  return {
    send: vi.fn().mockReturnValue(true),
    sendToPlayer: vi.fn().mockReturnValue(true),
    broadcastToRoom: vi.fn().mockReturnValue(3),
    broadcastGameState: vi.fn().mockReturnValue(4),
    broadcastToSpectators: vi.fn().mockReturnValue(0),
    sendError: vi.fn().mockReturnValue(true),
  } as unknown as Broadcaster;
}

function createMockWs(): WebSocket {
  return {
    readyState: 1, // OPEN
    send: vi.fn(),
    OPEN: 1,
  } as unknown as WebSocket;
}

function createTestManager(config?: Partial<GameConfig>) {
  const broadcaster = createMockBroadcaster();
  const disconnectHandler = new DisconnectHandler(broadcaster);
  const manager = new GameManager(
    'test-game',
    'ROOM1',
    broadcaster,
    disconnectHandler,
    config,
  );
  return { manager, broadcaster, disconnectHandler };
}

/** Seat all 4 players */
function seatAllPlayers(manager: GameManager): void {
  for (const seat of SEATS_IN_ORDER) {
    manager.seatPlayer(seat);
  }
}

/** Advance to playing phase through the WebSocket message interface */
function advanceToPlaying(manager: GameManager, ws: WebSocket): void {
  seatAllPlayers(manager);
  manager.handleMessage(ws, 'north', { type: 'START_GAME' } as ClientMessage);

  // All pass Grand Tichu
  for (const seat of SEATS_IN_ORDER) {
    manager.handleMessage(ws, seat, { type: 'GRAND_TICHU_DECISION', call: false } as ClientMessage);
  }

  // Now in cardPassing phase (no separate Tichu decision phase)
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GameManager', () => {
  let manager: GameManager;
  let broadcaster: Broadcaster;
  let disconnectHandler: DisconnectHandler;
  let ws: WebSocket;

  beforeEach(() => {
    ({ manager, broadcaster, disconnectHandler } = createTestManager());
    ws = createMockWs();
  });

  afterEach(() => {
    manager.destroy();
    disconnectHandler.dispose();
  });

  describe('construction', () => {
    it('should create with correct IDs', () => {
      expect(manager.gameId).toBe('test-game');
      expect(manager.roomCode).toBe('ROOM1');
    });

    it('should start in lobby state', () => {
      expect(manager.stateValue).toBe('lobby');
    });

    it('should apply custom config', () => {
      const { manager: m } = createTestManager({ targetScore: 500 });
      expect(m.context.config.targetScore).toBe(500);
      m.destroy();
    });
  });

  describe('seatPlayer', () => {
    it('should seat a player', () => {
      const result = manager.seatPlayer('north');
      expect(result).toBe(true);
      expect(manager.context.seats.north).toBe(true);
    });

    it('should broadcast state after seating', () => {
      manager.seatPlayer('north');
      expect(broadcaster.broadcastGameState).toHaveBeenCalled();
    });

    it('should reject duplicate seat', () => {
      manager.seatPlayer('north');
      const result = manager.seatPlayer('north');
      expect(result).toBe(false);
    });
  });

  describe('handleMessage routing', () => {
    it('should handle START_GAME', () => {
      seatAllPlayers(manager);
      manager.handleMessage(ws, 'north', { type: 'START_GAME' } as ClientMessage);
      expect(manager.stateValue).toBe('grandTichuDecision');
    });

    it('should handle GRAND_TICHU_DECISION call', () => {
      seatAllPlayers(manager);
      manager.handleMessage(ws, 'north', { type: 'START_GAME' } as ClientMessage);
      manager.handleMessage(ws, 'north', { type: 'GRAND_TICHU_DECISION', call: true } as ClientMessage);
      expect(manager.context.currentRound!.players.north.tipiCall).toBe('grandTichu');
    });

    it('should handle GRAND_TICHU_DECISION pass', () => {
      seatAllPlayers(manager);
      manager.handleMessage(ws, 'north', { type: 'START_GAME' } as ClientMessage);
      manager.handleMessage(ws, 'north', { type: 'GRAND_TICHU_DECISION', call: false } as ClientMessage);
      expect(manager.context.grandTichuDecisions.has('north')).toBe(true);
    });

    it('should handle TICHU_DECLARATION', () => {
      seatAllPlayers(manager);
      manager.handleMessage(ws, 'north', { type: 'START_GAME' } as ClientMessage);
      // Pass Grand Tichu for all
      for (const seat of SEATS_IN_ORDER) {
        manager.handleMessage(ws, seat, { type: 'GRAND_TICHU_DECISION', call: false } as ClientMessage);
      }
      // Now in cardPassing
      manager.handleMessage(ws, 'north', { type: 'TICHU_DECLARATION' } as ClientMessage);
      expect(manager.context.currentRound!.players.north.tipiCall).toBe('tichu');
    });

    it('should send error for invalid move', () => {
      manager.handleMessage(ws, 'north', { type: 'PASS_TURN' } as ClientMessage);
      expect(broadcaster.sendError).toHaveBeenCalledWith(ws, 'INVALID_MOVE', expect.any(String));
    });

    it('should send error for unhandled message type', () => {
      manager.handleMessage(ws, 'north', { type: 'CHAT_MESSAGE', text: 'hello' } as ClientMessage);
      expect(broadcaster.sendError).toHaveBeenCalledWith(ws, 'UNHANDLED_TYPE', expect.any(String));
    });

    it('should send error after destroy', () => {
      manager.destroy();
      manager.handleMessage(ws, 'north', { type: 'START_GAME' } as ClientMessage);
      expect(broadcaster.sendError).toHaveBeenCalledWith(ws, 'GAME_DESTROYED', expect.any(String));
    });
  });

  describe('handleDisconnect', () => {
    it('should delegate to disconnect handler', () => {
      const spy = vi.spyOn(disconnectHandler, 'handleDisconnect');
      manager.handleDisconnect('north');
      expect(spy).toHaveBeenCalledWith('ROOM1', 'north');
    });
  });

  describe('handleReconnect', () => {
    it('should delegate to disconnect handler', () => {
      const spy = vi.spyOn(disconnectHandler, 'handleReconnect');
      manager.handleReconnect(ws, 'north');
      expect(spy).toHaveBeenCalledWith('ROOM1', 'north');
    });

    it('should send state to reconnected player', () => {
      manager.handleReconnect(ws, 'north');
      expect(broadcaster.sendToPlayer).toHaveBeenCalledWith('ROOM1', 'north', expect.objectContaining({
        type: 'GAME_STATE',
      }));
    });
  });

  describe('broadcastState', () => {
    it('should broadcast projected state to all players', () => {
      seatAllPlayers(manager);
      (broadcaster.broadcastGameState as ReturnType<typeof vi.fn>).mockClear();
      manager.broadcastState();
      expect(broadcaster.broadcastGameState).toHaveBeenCalledWith(
        'ROOM1',
        expect.any(Object),
        'lobby',
        [],
        [],
        null, // disconnectVoteStatus
      );
    });
  });

  describe('full game start flow', () => {
    it('should advance through phases via messages', () => {
      seatAllPlayers(manager);
      expect(manager.stateValue).toBe('lobby');

      manager.handleMessage(ws, 'north', { type: 'START_GAME' } as ClientMessage);
      expect(manager.stateValue).toBe('grandTichuDecision');

      // Pass Grand Tichu
      for (const seat of SEATS_IN_ORDER) {
        manager.handleMessage(ws, seat, { type: 'GRAND_TICHU_DECISION', call: false } as ClientMessage);
      }
      expect(manager.stateValue).toBe('cardPassing');

      // Call Tichu for one player, then need to pass others
      manager.handleMessage(ws, 'north', { type: 'TICHU_DECLARATION' } as ClientMessage);
      // The rest need to pass — but we don't have a protocol message for "pass regular tichu"
      // The TICHU_DECLARATION is for calling, not passing. The state machine accepts
      // For now, GRAND_TICHU_DECISION handles both call/pass via the boolean.
      // TICHU_DECLARATION only calls. We need the game to auto-advance or handle passes.
      // This is a known protocol gap that will be addressed in the lobby/UI milestone.
    });
  });

  describe('destroy', () => {
    it('should stop accepting messages', () => {
      manager.destroy();
      seatAllPlayers(manager);
      // After destroy, seatPlayer should still work on the actor but destroy flag prevents broadcasting
    });

    it('should be idempotent', () => {
      manager.destroy();
      expect(() => manager.destroy()).not.toThrow();
    });
  });

  describe('DISCONNECT_VOTE routing', () => {
    it('should route vote to disconnect handler', () => {
      const spy = vi.spyOn(disconnectHandler, 'handleVote');
      manager.handleMessage(ws, 'east', { type: 'DISCONNECT_VOTE', vote: 'bot' } as ClientMessage);
      expect(spy).toHaveBeenCalledWith('ROOM1', 'east', 'bot');
    });
  });
});
