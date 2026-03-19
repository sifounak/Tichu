// REQ-F-MP02: Room codes for matchmaking
// REQ-F-MP04: Room configuration options
// REQ-F-MP05: Fixed seat partnerships

import type {
  GameConfig,
  Seat,
} from '@tichu/shared';
import type { Room, LobbyEntry } from '@tichu/shared';

const SEATS: readonly Seat[] = ['north', 'east', 'south', 'west'];
const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1 to avoid confusion

export interface RoomManagerOptions {
  staleTimeoutMs?: number;
}

/**
 * Manages game rooms: creation, joining, leaving, configuration, bot seats.
 */
export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly userToRoom = new Map<string, string>();
  private readonly userToSeat = new Map<string, Seat>();
  private readonly seatToUser = new Map<string, string>(); // key: `${roomCode}:${seat}`

  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private readonly staleTimeoutMs: number;

  constructor(options?: RoomManagerOptions) {
    this.staleTimeoutMs = options?.staleTimeoutMs ?? 30 * 60 * 1000;
  }

  startCleanup(): void {
    if (this.cleanupInterval) return;
    this.cleanupInterval = setInterval(() => this.cleanupStaleRooms(), 60_000);
  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /** Create a new room. Host is seated at south (bottom of table). */
  createRoom(userId: string, playerName: string, roomName?: string): Room {
    if (this.userToRoom.has(userId)) {
      throw new Error('Already in a room. Leave first.');
    }

    const roomCode = this.generateUniqueCode();
    const hostSeat: Seat = 'south';

    const room: Room = {
      roomCode,
      roomName: roomName?.trim() || `${playerName}'s Room`,
      hostSeat,
      players: [{
        seat: hostSeat,
        name: playerName,
        isBot: false,
        isConnected: true,
      }],
      config: {
        targetScore: 1000,
        turnTimerSeconds: null,
        botDifficulty: 'regular',
        animationSpeed: 'normal',
        spectatorsAllowed: true,
        isPrivate: false,
        maxSpectators: 10,
      },
      gameInProgress: false,
      createdAt: Date.now(),
    };

    this.rooms.set(roomCode, room);
    this.assignUser(userId, roomCode, hostSeat);

    return room;
  }

  /** Join an existing room. Returns assigned seat. */
  joinRoom(userId: string, roomCode: string, playerName: string): { room: Room; seat: Seat } {
    if (this.userToRoom.has(userId)) {
      throw new Error('Already in a room. Leave first.');
    }

    const room = this.rooms.get(roomCode);
    if (!room) throw new Error('Room not found.');
    if (room.gameInProgress) throw new Error('Game already in progress.');

    const occupiedSeats = new Set(room.players.map(p => p.seat));
    const freeSeat = SEATS.find(s => !occupiedSeats.has(s));
    if (!freeSeat) throw new Error('Room is full.');

    room.players.push({
      seat: freeSeat,
      name: playerName,
      isBot: false,
      isConnected: true,
    });

    this.assignUser(userId, roomCode, freeSeat);
    return { room, seat: freeSeat };
  }

  /** Remove a player from their room. Destroys room if empty.
   *  If a game was in progress, ends it so the room reopens (bots stay). */
  leaveRoom(userId: string): { room: Room | null; roomCode: string; seat: Seat; gameWasInProgress: boolean } {
    const roomCode = this.userToRoom.get(userId);
    const seat = this.userToSeat.get(userId);
    if (!roomCode || !seat) throw new Error('Not in a room.');

    const room = this.rooms.get(roomCode);
    if (!room) {
      this.removeUser(userId);
      throw new Error('Room not found.');
    }

    const gameWasInProgress = room.gameInProgress;

    this.removeUser(userId);
    room.players = room.players.filter(p => p.seat !== seat);

    // If a game was in progress, end it so the room reopens for new players.
    // Bots stay so the lobby shows the correct player count (e.g. 3/4).
    if (gameWasInProgress) {
      room.gameInProgress = false;
    }

    // If no human players left, destroy the room
    const humanPlayers = room.players.filter(p => !p.isBot);
    if (humanPlayers.length === 0) {
      this.destroyRoom(roomCode);
      return { room: null, roomCode, seat, gameWasInProgress };
    }

    // Reassign host if needed
    if (seat === room.hostSeat) {
      room.hostSeat = humanPlayers[0].seat;
    }

    return { room, roomCode, seat, gameWasInProgress };
  }

  /** Kick a player from the room. Only the host can kick. */
  kickPlayer(hostUserId: string, seat: Seat): { kickedUserId: string; roomCode: string } {
    const roomCode = this.userToRoom.get(hostUserId);
    if (!roomCode) throw new Error('Not in a room.');

    const room = this.rooms.get(roomCode);
    if (!room) throw new Error('Room not found.');

    if (!this.isHost(hostUserId)) throw new Error('Only the host can kick players.');
    if (room.gameInProgress) throw new Error('Cannot kick during a game.');

    // Find the userId at the target seat
    const kickedUserId = this.seatToUser.get(`${roomCode}:${seat}`);
    if (!kickedUserId) throw new Error('No player at that seat.');

    // Cannot kick yourself
    if (kickedUserId === hostUserId) throw new Error('Cannot kick yourself.');

    // Remove the kicked player
    this.removeUser(kickedUserId);
    room.players = room.players.filter(p => p.seat !== seat);

    return { kickedUserId, roomCode };
  }

  /** Add a bot to a seat. */
  addBot(roomCode: string, seat: Seat, difficulty?: 'regular' | 'hard' | 'expert'): Room {
    const room = this.rooms.get(roomCode);
    if (!room) throw new Error('Room not found.');
    if (room.gameInProgress) throw new Error('Game already in progress.');

    const occupiedSeats = new Set(room.players.map(p => p.seat));
    if (occupiedSeats.has(seat)) throw new Error(`Seat ${seat} is already occupied.`);

    const botDiff = difficulty ?? room.config.botDifficulty;
    room.players.push({
      seat,
      name: `Bot (${botDiff})`,
      isBot: true,
      isConnected: true,
    });

    return room;
  }

  /** Remove a bot from a seat. */
  removeBot(roomCode: string, seat: Seat): Room {
    const room = this.rooms.get(roomCode);
    if (!room) throw new Error('Room not found.');
    if (room.gameInProgress) throw new Error('Game already in progress.');

    const player = room.players.find(p => p.seat === seat);
    if (!player) throw new Error('No player at that seat.');
    if (!player.isBot) throw new Error('That seat is not a bot.');

    room.players = room.players.filter(p => p.seat !== seat);
    return room;
  }

  /** Update room configuration. */
  configureRoom(roomCode: string, updates: Partial<GameConfig>): Room {
    const room = this.rooms.get(roomCode);
    if (!room) throw new Error('Room not found.');
    if (room.gameInProgress) throw new Error('Game already in progress.');

    Object.assign(room.config, updates);
    return room;
  }

  /** Mark room as game started. Requires exactly 4 players. */
  startGame(roomCode: string): Room {
    const room = this.rooms.get(roomCode);
    if (!room) throw new Error('Room not found.');
    if (room.gameInProgress) throw new Error('Game already in progress.');
    if (room.players.length !== 4) throw new Error('Need exactly 4 players to start.');

    room.gameInProgress = true;
    return room;
  }

  /** Mark room game as ended. */
  endGame(roomCode: string): Room | undefined {
    const room = this.rooms.get(roomCode);
    if (!room) return undefined;
    room.gameInProgress = false;
    return room;
  }

  /** Get a room by code. */
  getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode);
  }

  /** Get user's current room code. */
  getUserRoom(userId: string): string | undefined {
    return this.userToRoom.get(userId);
  }

  /** Get user's current seat. */
  getUserSeat(userId: string): Seat | undefined {
    return this.userToSeat.get(userId);
  }

  /** Get userId at a specific seat in a room. */
  getUserIdAtSeat(roomCode: string, seat: Seat): string | undefined {
    return this.seatToUser.get(`${roomCode}:${seat}`);
  }

  /** Check if user is the host of their room. */
  isHost(userId: string): boolean {
    const roomCode = this.userToRoom.get(userId);
    if (!roomCode) return false;
    const room = this.rooms.get(roomCode);
    if (!room) return false;
    const seat = this.userToSeat.get(userId);
    return seat === room.hostSeat;
  }

  /** List public rooms for the lobby. */
  getPublicRooms(): LobbyEntry[] {
    const entries: LobbyEntry[] = [];
    for (const room of this.rooms.values()) {
      if (room.config.isPrivate) continue;

      const hostPlayer = room.players.find(p => p.seat === room.hostSeat);
      entries.push({
        roomCode: room.roomCode,
        roomName: room.roomName,
        hostName: hostPlayer?.name ?? 'Unknown',
        playerCount: room.players.length,
        spectatorCount: 0,
        config: {
          targetScore: room.config.targetScore,
          botDifficulty: room.config.botDifficulty,
        },
        gameInProgress: room.gameInProgress,
      });
    }
    return entries;
  }

  /** Mark a user as disconnected. */
  markDisconnected(userId: string): { roomCode: string; seat: Seat } | undefined {
    const roomCode = this.userToRoom.get(userId);
    const seat = this.userToSeat.get(userId);
    if (!roomCode || !seat) return undefined;

    const room = this.rooms.get(roomCode);
    if (!room) return undefined;

    const player = room.players.find(p => p.seat === seat);
    if (player) player.isConnected = false;

    return { roomCode, seat };
  }

  /** Mark a user as reconnected. */
  markReconnected(userId: string): { roomCode: string; seat: Seat } | undefined {
    const roomCode = this.userToRoom.get(userId);
    const seat = this.userToSeat.get(userId);
    if (!roomCode || !seat) return undefined;

    const room = this.rooms.get(roomCode);
    if (!room) return undefined;

    const player = room.players.find(p => p.seat === seat);
    if (player) player.isConnected = true;

    return { roomCode, seat };
  }

  // REQ-F-006: Swap a player to a different seat
  // REQ-F-007: Block swap during game
  swapSeat(userId: string, targetSeat: Seat): { room: Room; affectedUserIds: string[] } {
    const roomCode = this.userToRoom.get(userId);
    const currentSeat = this.userToSeat.get(userId);
    if (!roomCode || !currentSeat) throw new Error('Not in a room.');

    const room = this.rooms.get(roomCode);
    if (!room) throw new Error('Room not found.');
    if (room.gameInProgress) throw new Error('Cannot swap seats during a game.');
    if (currentSeat === targetSeat) throw new Error('Already in that seat.');

    const targetPlayer = room.players.find(p => p.seat === targetSeat);
    const currentPlayer = room.players.find(p => p.seat === currentSeat)!;
    const affectedUserIds: string[] = [userId];

    if (!targetPlayer) {
      // Empty seat: move player there
      currentPlayer.seat = targetSeat;
      this.seatToUser.delete(`${roomCode}:${currentSeat}`);
      this.userToSeat.set(userId, targetSeat);
      this.seatToUser.set(`${roomCode}:${targetSeat}`, userId);
      // Move host if needed
      if (room.hostSeat === currentSeat) room.hostSeat = targetSeat;
    } else if (targetPlayer.isBot) {
      // Bot seat: remove bot, move player there
      room.players = room.players.filter(p => p.seat !== targetSeat);
      currentPlayer.seat = targetSeat;
      this.seatToUser.delete(`${roomCode}:${currentSeat}`);
      this.userToSeat.set(userId, targetSeat);
      this.seatToUser.set(`${roomCode}:${targetSeat}`, userId);
      if (room.hostSeat === currentSeat) room.hostSeat = targetSeat;
    } else {
      // Human seat: swap both players
      const targetUserId = this.seatToUser.get(`${roomCode}:${targetSeat}`);
      if (!targetUserId) throw new Error('Target seat user not found.');

      currentPlayer.seat = targetSeat;
      targetPlayer.seat = currentSeat;

      this.userToSeat.set(userId, targetSeat);
      this.userToSeat.set(targetUserId, currentSeat);
      this.seatToUser.set(`${roomCode}:${currentSeat}`, targetUserId);
      this.seatToUser.set(`${roomCode}:${targetSeat}`, userId);

      // Swap host if either player was host
      if (room.hostSeat === currentSeat) room.hostSeat = targetSeat;
      else if (room.hostSeat === targetSeat) room.hostSeat = currentSeat;

      affectedUserIds.push(targetUserId);
    }

    return { room, affectedUserIds };
  }

  get size(): number {
    return this.rooms.size;
  }

  dispose(): void {
    this.stopCleanup();
    this.rooms.clear();
    this.userToRoom.clear();
    this.userToSeat.clear();
    this.seatToUser.clear();
  }

  // ─── Private helpers ──────────────────────────────────────────────────

  private assignUser(userId: string, roomCode: string, seat: Seat): void {
    this.userToRoom.set(userId, roomCode);
    this.userToSeat.set(userId, seat);
    this.seatToUser.set(`${roomCode}:${seat}`, userId);
  }

  private removeUser(userId: string): void {
    const roomCode = this.userToRoom.get(userId);
    const seat = this.userToSeat.get(userId);
    this.userToRoom.delete(userId);
    this.userToSeat.delete(userId);
    if (roomCode && seat) {
      this.seatToUser.delete(`${roomCode}:${seat}`);
    }
  }

  private destroyRoom(roomCode: string): void {
    this.rooms.delete(roomCode);
    // Clean up all user→room mappings for this room
    for (const [userId, rc] of this.userToRoom) {
      if (rc === roomCode) {
        this.removeUser(userId);
      }
    }
  }

  private generateUniqueCode(): string {
    let attempts = 0;
    while (attempts < 100) {
      let code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += ROOM_CODE_CHARS.charAt(Math.floor(Math.random() * ROOM_CODE_CHARS.length));
      }
      if (!this.rooms.has(code)) return code;
      attempts++;
    }
    throw new Error('Failed to generate unique room code');
  }

  private cleanupStaleRooms(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      const hasHumans = room.players.some(p => !p.isBot && p.isConnected);
      if (!hasHumans && now - room.createdAt > this.staleTimeoutMs) {
        this.destroyRoom(code);
      }
    }
  }
}
