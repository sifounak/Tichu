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
    manager.addChatMessage(roomCode, { from: 'south', text: 'hello' });
    manager.addChatMessage(roomCode, { from: null, text: 'Spectator says hi', spectatorName: 'Watcher' });
    manager.startGame(roomCode);

    const snapshots = manager.serializeActiveRooms();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].roomCode).toBe(roomCode);
    expect(snapshots[0].gameInProgress).toBe(true);
    expect(snapshots[0].players).toHaveLength(4);
    expect(snapshots[0].seatToUserId).toHaveProperty('south');
    expect(snapshots[0].seatToUserId).toHaveProperty('north');
    expect(snapshots[0].chatHistory).toEqual([
      expect.objectContaining({ from: 'south', text: 'hello' }),
      expect.objectContaining({ from: null, text: 'Spectator says hi', spectatorName: 'Watcher' }),
    ]);
    manager.dispose();
  });

  it('serializes rooms before the game has started', () => {
    const manager = new RoomManager();
    const room = manager.createRoom('user-1', 'Alice');
    manager.joinRoom('user-2', room.roomCode, 'Bob');
    manager.addBot(room.roomCode, 'east');
    manager.setReady(room.roomCode, 'east');
    manager.toggleVoting('user-1');
    const snapshots = manager.serializeActiveRooms();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].roomCode).toBe(room.roomCode);
    expect(snapshots[0].gameInProgress).toBe(false);
    expect(snapshots[0].players).toHaveLength(3);
    expect(snapshots[0].seatToUserId).toHaveProperty('south', 'user-1');
    expect(snapshots[0].seatToUserId).toHaveProperty('north', 'user-2');
    expect(snapshots[0].readySeats).toEqual(['east']);
    expect(snapshots[0].votingEnabled).toBe(false);
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
      gameInProgress: false,
      votingEnabled: false,
      seatToUserId: { south: 'user-1', west: 'user-2' },
      readySeats: ['north', 'east'],
      chatHistory: [
        { from: 'south', text: 'before restart', timestamp: 123 },
        { from: null, text: 'system note', timestamp: 124 },
      ],
    };

    const manager = new RoomManager();
    manager.restoreRooms([snapshot]);

    expect(manager.getRoom('TEST01')).toBeDefined();
    expect(manager.getRoom('TEST01')!.gameInProgress).toBe(false);
    expect(manager.getRoom('TEST01')!.votingEnabled).toBe(false);
    expect(manager.getUserRoom('user-1')).toBe('TEST01');
    expect(manager.getUserSeat('user-1')).toBe('south');
    expect(manager.getUserRoom('user-2')).toBe('TEST01');
    expect(manager.getUserSeat('user-2')).toBe('west');

    // All humans should be disconnected
    const room = manager.getRoom('TEST01')!;
    const alice = room.players.find(p => p.seat === 'south');
    expect(alice!.isConnected).toBe(false);
    expect(manager.getReadySeats('TEST01')).toEqual(['north', 'east']);
    expect(manager.getChatHistory('TEST01')).toEqual(snapshot.chatHistory);
    manager.dispose();
  });
});
