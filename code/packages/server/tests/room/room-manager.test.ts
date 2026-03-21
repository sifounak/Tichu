// Verifies: REQ-F-MP02, REQ-F-MP03, REQ-F-MP04, REQ-F-MP05

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RoomManager } from '../../src/room/room-manager.js';

describe('RoomManager', () => {
  let manager: RoomManager;

  beforeEach(() => {
    manager = new RoomManager({ staleTimeoutMs: 1000 });
  });

  afterEach(() => {
    manager.dispose();
  });

  // ─── Room creation ─────────────────────────────────────────────────

  describe('createRoom', () => {
    it('should create a room with a 6-char code', () => {
      const room = manager.createRoom('user1', 'Alice');
      expect(room.roomCode).toHaveLength(6);
      expect(room.hostSeat).toBe('south');
      expect(room.players).toHaveLength(1);
      expect(room.players[0]).toMatchObject({
        seat: 'south',
        name: 'Alice',
        isBot: false,
        isConnected: true,
      });
      expect(room.gameInProgress).toBe(false);
    });

    it('should generate unique room codes', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const room = manager.createRoom(`user${i}`, `Player${i}`);
        codes.add(room.roomCode);
      }
      expect(codes.size).toBe(20);
    });

    it('should reject creating room if already in one', () => {
      manager.createRoom('user1', 'Alice');
      expect(() => manager.createRoom('user1', 'Alice')).toThrow('Already in a room');
    });

    it('should set default config values', () => {
      const room = manager.createRoom('user1', 'Alice');
      expect(room.config.targetScore).toBe(1000);
      expect(room.config.turnTimerSeconds).toBeNull();
      expect(room.config.botDifficulty).toBe('expert');
      expect(room.config.isPrivate).toBe(false);
    });
  });

  // ─── Room joining ──────────────────────────────────────────────────

  describe('joinRoom', () => {
    it('should assign next free seat', () => {
      const room = manager.createRoom('user1', 'Alice');
      const { seat } = manager.joinRoom('user2', room.roomCode, 'Bob');
      expect(seat).toBe('north');
      expect(room.players).toHaveLength(2);
    });

    it('should fill all 4 seats', () => {
      const room = manager.createRoom('u1', 'P1');
      manager.joinRoom('u2', room.roomCode, 'P2');
      manager.joinRoom('u3', room.roomCode, 'P3');
      manager.joinRoom('u4', room.roomCode, 'P4');
      expect(room.players).toHaveLength(4);
    });

    it('should reject joining full room', () => {
      const room = manager.createRoom('u1', 'P1');
      manager.joinRoom('u2', room.roomCode, 'P2');
      manager.joinRoom('u3', room.roomCode, 'P3');
      manager.joinRoom('u4', room.roomCode, 'P4');
      expect(() => manager.joinRoom('u5', room.roomCode, 'P5')).toThrow('Room is full');
    });

    it('should reject joining non-existent room', () => {
      expect(() => manager.joinRoom('user1', 'XXXXXX', 'Alice')).toThrow('Room not found');
    });

    it('should reject joining if already in a room', () => {
      const room = manager.createRoom('u1', 'P1');
      expect(() => manager.joinRoom('u1', room.roomCode, 'P1')).toThrow('Already in a room');
    });

    it('should reject joining room with game in progress', () => {
      const room = manager.createRoom('u1', 'P1');
      manager.joinRoom('u2', room.roomCode, 'P2');
      manager.addBot(room.roomCode, 'east');
      manager.addBot(room.roomCode, 'west');
      manager.startGame(room.roomCode);
      expect(() => manager.joinRoom('u5', room.roomCode, 'P5')).toThrow('Room is full.');
    });
  });

  // ─── Room leaving ──────────────────────────────────────────────────

  describe('leaveRoom', () => {
    it('should remove player from room', () => {
      const room = manager.createRoom('u1', 'P1');
      manager.joinRoom('u2', room.roomCode, 'P2');
      const result = manager.leaveRoom('u2');
      expect(result.room).toBeDefined();
      expect(result.room!.players).toHaveLength(1);
    });

    it('should destroy room if last human leaves', () => {
      const room = manager.createRoom('u1', 'P1');
      const result = manager.leaveRoom('u1');
      expect(result.room).toBeNull();
      expect(manager.getRoom(room.roomCode)).toBeUndefined();
    });

    it('should reassign host when host leaves', () => {
      const room = manager.createRoom('u1', 'P1');
      manager.joinRoom('u2', room.roomCode, 'P2');
      const result = manager.leaveRoom('u1');
      expect(result.room!.hostSeat).toBe('north');
    });

    it('should reject leaving if not in a room', () => {
      expect(() => manager.leaveRoom('unknown')).toThrow('Not in a room');
    });
  });

  // ─── Bot management ────────────────────────────────────────────────

  describe('addBot / removeBot', () => {
    it('should add bot to a specific seat', () => {
      const room = manager.createRoom('u1', 'P1');
      manager.addBot(room.roomCode, 'north');
      expect(room.players).toHaveLength(2);
      expect(room.players[1]).toMatchObject({
        seat: 'north',
        isBot: true,
        isConnected: true,
      });
    });

    it('should reject adding bot to occupied seat', () => {
      const room = manager.createRoom('u1', 'P1');
      expect(() => manager.addBot(room.roomCode, 'south')).toThrow('already occupied');
    });

    it('should remove bot from seat', () => {
      const room = manager.createRoom('u1', 'P1');
      manager.addBot(room.roomCode, 'north');
      manager.removeBot(room.roomCode, 'north');
      expect(room.players).toHaveLength(1);
    });

    it('should reject removing non-bot', () => {
      const room = manager.createRoom('u1', 'P1');
      expect(() => manager.removeBot(room.roomCode, 'south')).toThrow('not a bot');
    });

    it('should use custom bot difficulty', () => {
      const room = manager.createRoom('u1', 'P1');
      manager.addBot(room.roomCode, 'north', 'hard');
      expect(room.players[1].name).toContain('Normal');
    });
  });

  // ─── Room configuration ────────────────────────────────────────────

  describe('configureRoom', () => {
    it('should update room config', () => {
      const room = manager.createRoom('u1', 'P1');
      manager.configureRoom(room.roomCode, { targetScore: 500 });
      expect(room.config.targetScore).toBe(500);
    });

    it('should partially update config', () => {
      const room = manager.createRoom('u1', 'P1');
      manager.configureRoom(room.roomCode, { isPrivate: true });
      expect(room.config.isPrivate).toBe(true);
      expect(room.config.targetScore).toBe(1000); // unchanged
    });

    it('should reject config change during game', () => {
      const room = manager.createRoom('u1', 'P1');
      manager.addBot(room.roomCode, 'north');
      manager.addBot(room.roomCode, 'east');
      manager.addBot(room.roomCode, 'west');
      manager.startGame(room.roomCode);
      expect(() => manager.configureRoom(room.roomCode, { targetScore: 500 })).toThrow('Game already in progress');
    });
  });

  // ─── Game start ────────────────────────────────────────────────────

  describe('startGame', () => {
    it('should mark game in progress when 4 players', () => {
      const room = manager.createRoom('u1', 'P1');
      manager.joinRoom('u2', room.roomCode, 'P2');
      manager.addBot(room.roomCode, 'east');
      manager.addBot(room.roomCode, 'west');
      manager.startGame(room.roomCode);
      expect(room.gameInProgress).toBe(true);
    });

    it('should reject start with fewer than 4 players', () => {
      const room = manager.createRoom('u1', 'P1');
      expect(() => manager.startGame(room.roomCode)).toThrow('Need exactly 4 players');
    });

    it('should reject double start', () => {
      const room = manager.createRoom('u1', 'P1');
      manager.addBot(room.roomCode, 'north');
      manager.addBot(room.roomCode, 'east');
      manager.addBot(room.roomCode, 'west');
      manager.startGame(room.roomCode);
      expect(() => manager.startGame(room.roomCode)).toThrow('Game already in progress');
    });
  });

  // ─── Public lobby ──────────────────────────────────────────────────

  describe('getPublicRooms', () => {
    it('should return public rooms', () => {
      manager.createRoom('u1', 'Alice');
      const rooms = manager.getPublicRooms();
      expect(rooms).toHaveLength(1);
      expect(rooms[0].hostName).toBe('Alice');
      expect(rooms[0].playerCount).toBe(1);
    });

    it('should exclude private rooms', () => {
      const room = manager.createRoom('u1', 'Alice');
      manager.configureRoom(room.roomCode, { isPrivate: true });
      const rooms = manager.getPublicRooms();
      expect(rooms).toHaveLength(0);
    });

    it('should update in real-time as rooms change', () => {
      const room = manager.createRoom('u1', 'Alice');
      expect(manager.getPublicRooms()).toHaveLength(1);

      manager.joinRoom('u2', room.roomCode, 'Bob');
      const rooms = manager.getPublicRooms();
      expect(rooms[0].playerCount).toBe(2);
    });
  });

  // ─── User tracking ─────────────────────────────────────────────────

  describe('user tracking', () => {
    it('should track user room and seat', () => {
      const room = manager.createRoom('u1', 'Alice');
      expect(manager.getUserRoom('u1')).toBe(room.roomCode);
      expect(manager.getUserSeat('u1')).toBe('south');
    });

    it('should track userId at seat', () => {
      const room = manager.createRoom('u1', 'Alice');
      expect(manager.getUserIdAtSeat(room.roomCode, 'south')).toBe('u1');
    });

    it('should identify host', () => {
      const room = manager.createRoom('u1', 'Alice');
      manager.joinRoom('u2', room.roomCode, 'Bob');
      expect(manager.isHost('u1')).toBe(true);
      expect(manager.isHost('u2')).toBe(false);
    });

    it('should clean up user mappings on leave', () => {
      manager.createRoom('u1', 'Alice');
      manager.leaveRoom('u1');
      expect(manager.getUserRoom('u1')).toBeUndefined();
      expect(manager.getUserSeat('u1')).toBeUndefined();
    });
  });

  // ─── Disconnect/reconnect ─────────────────────────────────────────

  describe('markDisconnected / markReconnected', () => {
    it('should mark player as disconnected', () => {
      const room = manager.createRoom('u1', 'Alice');
      const result = manager.markDisconnected('u1');
      expect(result).toMatchObject({ roomCode: room.roomCode, seat: 'south' });
      expect(room.players[0].isConnected).toBe(false);
    });

    it('should mark player as reconnected', () => {
      const room = manager.createRoom('u1', 'Alice');
      manager.markDisconnected('u1');
      manager.markReconnected('u1');
      expect(room.players[0].isConnected).toBe(true);
    });

    it('should return undefined for unknown user', () => {
      expect(manager.markDisconnected('unknown')).toBeUndefined();
    });
  });

  // ─── Stale room cleanup ───────────────────────────────────────────

  describe('stale room cleanup', () => {
    it('should clean up rooms with no connected humans after timeout', () => {
      vi.useFakeTimers();
      const room = manager.createRoom('u1', 'Alice');
      manager.markDisconnected('u1');
      room.createdAt = Date.now() - 2000; // older than staleTimeoutMs

      manager.startCleanup();
      vi.advanceTimersByTime(61_000); // trigger cleanup

      expect(manager.getRoom(room.roomCode)).toBeUndefined();
      expect(manager.size).toBe(0);

      manager.stopCleanup();
      vi.useRealTimers();
    });
  });

  // ─── endGame ───────────────────────────────────────────────────────

  describe('endGame', () => {
    it('should mark game as not in progress', () => {
      const room = manager.createRoom('u1', 'P1');
      manager.addBot(room.roomCode, 'north');
      manager.addBot(room.roomCode, 'east');
      manager.addBot(room.roomCode, 'west');
      manager.startGame(room.roomCode);
      manager.endGame(room.roomCode);
      expect(room.gameInProgress).toBe(false);
    });
  });

  // ─── Fixed seat partnerships (REQ-F-MP05) ─────────────────────────

  describe('fixed seat partnerships', () => {
    it('should assign seats in N/E/S/W order', () => {
      const room = manager.createRoom('u1', 'P1');
      const { seat: s2 } = manager.joinRoom('u2', room.roomCode, 'P2');
      const { seat: s3 } = manager.joinRoom('u3', room.roomCode, 'P3');
      const { seat: s4 } = manager.joinRoom('u4', room.roomCode, 'P4');
      expect([room.hostSeat, s2, s3, s4]).toEqual(['south', 'north', 'east', 'west']);
    });
  });

  // ─── Seat swap (REQ-F-006, REQ-F-007) ──────────────────────────

  // Verifies: REQ-F-006, REQ-F-007
  describe('swapSeat', () => {
    it('should move player to an empty seat', () => {
      const room = manager.createRoom('u1', 'Alice');
      const { affectedUserIds } = manager.swapSeat('u1', 'north');
      expect(affectedUserIds).toEqual(['u1']);
      expect(manager.getUserSeat('u1')).toBe('north');
      expect(room.players[0].seat).toBe('north');
      expect(manager.getUserIdAtSeat(room.roomCode, 'north')).toBe('u1');
      expect(manager.getUserIdAtSeat(room.roomCode, 'south')).toBeUndefined();
    });

    it('should move host designation when host swaps to empty seat', () => {
      const room = manager.createRoom('u1', 'Alice');
      manager.joinRoom('u2', room.roomCode, 'Bob');
      expect(room.hostSeat).toBe('south');
      manager.swapSeat('u1', 'east');
      expect(room.hostSeat).toBe('east');
    });

    it('should replace a bot when swapping to bot seat', () => {
      const room = manager.createRoom('u1', 'Alice');
      manager.addBot(room.roomCode, 'east');
      expect(room.players).toHaveLength(2);
      const { affectedUserIds } = manager.swapSeat('u1', 'east');
      expect(affectedUserIds).toEqual(['u1']);
      expect(manager.getUserSeat('u1')).toBe('east');
      // Bot should be removed, only 1 player remains
      expect(room.players).toHaveLength(1);
      expect(room.players[0]).toMatchObject({ seat: 'east', name: 'Alice', isBot: false });
    });

    it('should swap two human players', () => {
      const room = manager.createRoom('u1', 'Alice');
      manager.joinRoom('u2', room.roomCode, 'Bob');
      expect(manager.getUserSeat('u1')).toBe('south');
      expect(manager.getUserSeat('u2')).toBe('north');

      const { affectedUserIds } = manager.swapSeat('u1', 'north');
      expect(affectedUserIds).toContain('u1');
      expect(affectedUserIds).toContain('u2');
      expect(manager.getUserSeat('u1')).toBe('north');
      expect(manager.getUserSeat('u2')).toBe('south');
      expect(manager.getUserIdAtSeat(room.roomCode, 'north')).toBe('u1');
      expect(manager.getUserIdAtSeat(room.roomCode, 'south')).toBe('u2');
    });

    it('should swap host designation when host swaps with another human', () => {
      const room = manager.createRoom('u1', 'Alice');
      manager.joinRoom('u2', room.roomCode, 'Bob');
      expect(room.hostSeat).toBe('south');
      manager.swapSeat('u1', 'north');
      expect(room.hostSeat).toBe('north'); // host follows u1
    });

    it('should reject swap during game in progress', () => {
      const room = manager.createRoom('u1', 'Alice');
      manager.addBot(room.roomCode, 'north');
      manager.addBot(room.roomCode, 'east');
      manager.addBot(room.roomCode, 'west');
      manager.startGame(room.roomCode);
      expect(() => manager.swapSeat('u1', 'east')).toThrow('Cannot swap seats during a game');
    });

    it('should reject swap to same seat', () => {
      manager.createRoom('u1', 'Alice');
      expect(() => manager.swapSeat('u1', 'south')).toThrow('Already in that seat');
    });

    it('should reject swap if not in a room', () => {
      expect(() => manager.swapSeat('unknown', 'south')).toThrow('Not in a room');
    });
  });
});
