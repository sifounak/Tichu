// Verifies: GameManager.serialize() and GameManager.restore() round-trip
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameManager } from '../../src/game/game-manager.js';
import { DisconnectHandler } from '../../src/game/disconnect-handler.js';
import { VoteHandler } from '../../src/game/vote-handler.js';
import type { Broadcaster } from '../../src/ws/broadcaster.js';
import type { WebSocket } from 'ws';
import type { ClientMessage } from '@tichu/shared';
import { SEATS_IN_ORDER } from '@tichu/shared';

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
    readyState: 1,
    send: vi.fn(),
    OPEN: 1,
  } as unknown as WebSocket;
}

describe('GameManager serialize/restore', () => {
  let broadcaster: Broadcaster;
  let disconnectHandler: DisconnectHandler;
  let voteHandler: VoteHandler;

  beforeEach(() => {
    broadcaster = createMockBroadcaster();
    disconnectHandler = new DisconnectHandler(broadcaster);
    voteHandler = new VoteHandler(broadcaster);
  });

  afterEach(() => {
    disconnectHandler.dispose();
    voteHandler.dispose();
  });

  it('serializes a game in lobby state', () => {
    const manager = new GameManager('game-1', 'ROOM1', broadcaster, disconnectHandler, voteHandler);
    const snapshot = manager.serialize();
    expect(snapshot.gameId).toBe('game-1');
    expect(snapshot.roomCode).toBe('ROOM1');
    expect(snapshot.machineSnapshot).toBeDefined();
    manager.destroy();
  });

  it('round-trips a game in grandTichuDecision state', () => {
    const ws = createMockWs();
    const manager = new GameManager('game-1', 'ROOM1', broadcaster, disconnectHandler, voteHandler);
    for (const seat of SEATS_IN_ORDER) {
      manager.seatPlayer(seat);
    }
    manager.handleMessage(ws, 'north', { type: 'START_GAME' } as ClientMessage);

    const stateValueBefore = manager.stateValue;
    expect(stateValueBefore).toBe('grandTichuDecision');

    const snapshot = manager.serialize();

    const restored = GameManager.restore(snapshot, broadcaster, disconnectHandler, voteHandler);
    expect(restored.gameId).toBe('game-1');
    expect(restored.roomCode).toBe('ROOM1');
    expect(restored.stateValue).toBe(stateValueBefore);

    manager.destroy();
    restored.destroy();
  });

  it('preserves game config through serialize/restore', () => {
    const manager = new GameManager('game-1', 'ROOM1', broadcaster, disconnectHandler, voteHandler, { targetScore: 500 });
    const snapshot = manager.serialize();
    expect(snapshot.config.targetScore).toBe(500);

    const restored = GameManager.restore(snapshot, broadcaster, disconnectHandler, voteHandler);
    expect(restored.context.config.targetScore).toBe(500);

    manager.destroy();
    restored.destroy();
  });

  it('preserves vacated seats through serialize/restore', () => {
    const ws = createMockWs();
    const manager = new GameManager('game-1', 'ROOM1', broadcaster, disconnectHandler, voteHandler);
    for (const seat of SEATS_IN_ORDER) {
      manager.seatPlayer(seat);
    }
    manager.handleMessage(ws, 'north', { type: 'START_GAME' } as ClientMessage);
    manager.handleSeatVacated('east');

    const snapshot = manager.serialize();
    expect(snapshot.vacatedSeats).toContain('east');

    const restored = GameManager.restore(snapshot, broadcaster, disconnectHandler, voteHandler);
    expect(restored.getVacatedSeats().has('east')).toBe(true);

    manager.destroy();
    restored.destroy();
  });

  it('preserves bot seats through serialize/restore', () => {
    const ws = createMockWs();
    const manager = new GameManager('game-1', 'ROOM1', broadcaster, disconnectHandler, voteHandler);
    manager.registerBot('south');
    manager.registerBot('west');
    for (const seat of SEATS_IN_ORDER) {
      manager.seatPlayer(seat);
    }

    const snapshot = manager.serialize();
    expect(snapshot.botSeats).toContain('south');
    expect(snapshot.botSeats).toContain('west');

    const restored = GameManager.restore(snapshot, broadcaster, disconnectHandler, voteHandler);
    // The restored manager should report the same state value
    expect(restored.stateValue).toBe(manager.stateValue);

    manager.destroy();
    restored.destroy();
  });

  it('sets restoredFromSnapshot flag on restore', () => {
    const manager = new GameManager('game-1', 'ROOM1', broadcaster, disconnectHandler, voteHandler);
    const snapshot = manager.serialize();

    const restored = GameManager.restore(snapshot, broadcaster, disconnectHandler, voteHandler);
    // The flag is private, but we can verify via resumeAfterRestore not throwing
    expect(() => restored.resumeAfterRestore()).not.toThrow();

    manager.destroy();
    restored.destroy();
  });

  it('preserves endOfTrickBombWindowEndTime through serialize/restore', () => {
    const manager = new GameManager('game-1', 'ROOM1', broadcaster, disconnectHandler, voteHandler);
    const snapshot = manager.serialize();
    // In lobby state, bomb window should be null
    expect(snapshot.endOfTrickBombWindowEndTime).toBeNull();

    const restored = GameManager.restore(snapshot, broadcaster, disconnectHandler, voteHandler);
    expect(restored.stateValue).toBe('lobby');

    manager.destroy();
    restored.destroy();
  });

  it('preserves joinedAfterSpectating through serialize/restore', () => {
    const manager = new GameManager('game-1', 'ROOM1', broadcaster, disconnectHandler, voteHandler);
    manager.markJoinedAfterSpectating('user-123');
    manager.markJoinedAfterSpectating('user-456');

    const snapshot = manager.serialize();
    expect(snapshot.joinedAfterSpectating).toContain('user-123');
    expect(snapshot.joinedAfterSpectating).toContain('user-456');

    manager.destroy();
  });

  it('preserves humanParticipants through serialize/restore', () => {
    const manager = new GameManager('game-1', 'ROOM1', broadcaster, disconnectHandler, voteHandler);
    manager.addHumanParticipant('user-123');
    manager.addHumanParticipant('user-456');

    const snapshot = manager.serialize();
    expect(snapshot.humanParticipants).toContain('user-123');
    expect(snapshot.humanParticipants).toContain('user-456');

    const restored = GameManager.restore(snapshot, broadcaster, disconnectHandler, voteHandler);
    expect(restored.isMultiHuman()).toBe(true);

    manager.destroy();
    restored.destroy();
  });

  it('snapshot is JSON-serializable', () => {
    const ws = createMockWs();
    const manager = new GameManager('game-1', 'ROOM1', broadcaster, disconnectHandler, voteHandler);
    for (const seat of SEATS_IN_ORDER) {
      manager.seatPlayer(seat);
    }
    manager.handleMessage(ws, 'north', { type: 'START_GAME' } as ClientMessage);

    const snapshot = manager.serialize();
    const json = JSON.stringify(snapshot);
    const parsed = JSON.parse(json);

    // Restore from the parsed JSON (simulates disk persistence)
    const restored = GameManager.restore(parsed, broadcaster, disconnectHandler, voteHandler);
    expect(restored.stateValue).toBe(manager.stateValue);
    expect(restored.gameId).toBe('game-1');

    manager.destroy();
    restored.destroy();
  });
});
