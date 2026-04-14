import { describe, it, expect } from 'vitest';
import { RoomManager } from '../../src/room/room-manager.js';
import type { RoomSnapshot } from '../../src/game/game-serializer.js';

describe('RoomManager serialization', () => {
  it('serializes rooms with active games', () => {
    const manager = new RoomManager();
    const room = manager.createRoom('user-1', 'Alice');
    const roomCode = room.roomCode;
    manager.joinRoom('user-2', roomCode, 'Bob');
    manager.addBot(roomCode, 'east');
    manager.addBot(roomCode, 'west');
    manager.startGame(roomCode);

    const snapshots = manager.serializeActiveRooms();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].roomCode).toBe(roomCode);
    expect(snapshots[0].gameInProgress).toBe(true);
    expect(snapshots[0].players).toHaveLength(4);
    expect(snapshots[0].seatToUserId).toHaveProperty('south');
    expect(snapshots[0].seatToUserId).toHaveProperty('north');
    manager.dispose();
  });

  it('does not serialize rooms without active games', () => {
    const manager = new RoomManager();
    manager.createRoom('user-1', 'Alice');
    const snapshots = manager.serializeActiveRooms();
    expect(snapshots).toHaveLength(0);
    manager.dispose();
  });

  it('restores rooms from snapshots', () => {
    const snapshot: RoomSnapshot = {
      roomCode: 'TEST01',
      roomName: "Test Room",
      hostSeat: 'south',
      players: [
        { seat: 'south', name: 'Alice', isBot: false },
        { seat: 'north', name: 'Bot', isBot: true },
        { seat: 'east', name: 'Bot', isBot: true },
        { seat: 'west', name: 'Bob', isBot: false },
      ],
      config: { targetScore: 1000, turnTimerSeconds: null, spectatorsAllowed: true, isPrivate: false, maxSpectators: 10 } as any,
      gameInProgress: true,
      seatToUserId: { south: 'user-1', west: 'user-2' },
    };

    const manager = new RoomManager();
    manager.restoreRooms([snapshot]);

    expect(manager.getRoom('TEST01')).toBeDefined();
    expect(manager.getRoom('TEST01')!.gameInProgress).toBe(true);
    expect(manager.getUserRoom('user-1')).toBe('TEST01');
    expect(manager.getUserSeat('user-1')).toBe('south');
    expect(manager.getUserRoom('user-2')).toBe('TEST01');
    expect(manager.getUserSeat('user-2')).toBe('west');

    // All humans should be disconnected
    const room = manager.getRoom('TEST01')!;
    const alice = room.players.find(p => p.seat === 'south');
    expect(alice!.isConnected).toBe(false);
    manager.dispose();
  });
});
