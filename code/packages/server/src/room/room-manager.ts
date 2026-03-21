// REQ-F-MP02: Room codes for matchmaking
// REQ-F-MP04: Room configuration options
// REQ-F-MP05: Fixed seat partnerships

import type {
  GameConfig,
  Seat,
} from '@tichu/shared';
import type { Room, RoomSpectator, LobbyEntry } from '@tichu/shared';

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
  // REQ-F-SP02: Spectator userId → roomCode mapping
  private readonly spectatorToRoom = new Map<string, string>();

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

    // REQ-F-SP03: Initialize room with empty spectators array
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
      spectators: [],
      config: {
        targetScore: 1000,
        turnTimerSeconds: null,
        botDifficulty: 'expert',
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

  /** Join an existing room. Returns assigned seat.
   *  Allows joining mid-game if there's an empty seat (player left). */
  joinRoom(userId: string, roomCode: string, playerName: string): { room: Room; seat: Seat } {
    if (this.userToRoom.has(userId)) {
      throw new Error('Already in a room. Leave first.');
    }

    const room = this.rooms.get(roomCode);
    if (!room) throw new Error('Room not found.');

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
   *  If a game was in progress, keep it alive so a new player can fill the seat. */
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

    // REQ-F-SP21: Ready states reset when a player leaves
    this.resetReady(roomCode);

    // Game stays alive (gameInProgress remains true) so a new player can join the empty seat.
    // Bots stay so the lobby shows the correct player count (e.g. 3/4).

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
    const diffLabel = botDiff === 'hard' ? 'Normal' : botDiff === 'expert' ? 'Expert' : 'Normal';
    room.players.push({
      seat,
      name: `Bot (${diffLabel})`,
      isBot: true,
      isConnected: true,
    });

    return room;
  }

  /** REQ-F-SP31: Remove a bot from a seat. Allowed mid-game for host. */
  removeBot(roomCode: string, seat: Seat): { room: Room; wasGameInProgress: boolean } {
    const room = this.rooms.get(roomCode);
    if (!room) throw new Error('Room not found.');

    const player = room.players.find(p => p.seat === seat);
    if (!player) throw new Error('No player at that seat.');
    if (!player.isBot) throw new Error('That seat is not a bot.');

    const wasGameInProgress = room.gameInProgress;
    room.players = room.players.filter(p => p.seat !== seat);
    return { room, wasGameInProgress };
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

  /** Reassign a user from one seat to another (used for mid-game seat choice) */
  reassignSeat(userId: string, fromSeat: Seat, toSeat: Seat, roomCode: string): void {
    this.seatToUser.delete(`${roomCode}:${fromSeat}`);
    this.userToSeat.set(userId, toSeat);
    this.seatToUser.set(`${roomCode}:${toSeat}`, userId);
  }

  /** List public rooms for the lobby. */
  getPublicRooms(): LobbyEntry[] {
    const entries: LobbyEntry[] = [];
    for (const room of this.rooms.values()) {
      if (room.config.isPrivate) continue;

      const hostPlayer = room.players.find(p => p.seat === room.hostSeat);
      // REQ-F-SP11: Compute real spectatorCount from room.spectators
      // REQ-F-SP01: Include spectatorsAllowed so lobby can show "Join as Spectator" button
      entries.push({
        roomCode: room.roomCode,
        roomName: room.roomName,
        hostName: hostPlayer?.name ?? 'Unknown',
        playerCount: room.players.length,
        spectatorCount: room.spectators.length,
        config: {
          targetScore: room.config.targetScore,
          botDifficulty: room.config.botDifficulty,
          spectatorsAllowed: room.config.spectatorsAllowed,
        },
        gameInProgress: room.gameInProgress,
        // REQ-F-ES05: Mark rooms with empty seats mid-game for "Join (In Progress)" button
        hasEmptySeats: room.gameInProgress && room.players.length < 4,
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

  // ─── Spectator management (REQ-F-SP02, SP03, SP13) ─────────────────

  /** REQ-F-SP02: Join a room as spectator. Enforces spectatorsAllowed + maxSpectators. */
  joinAsSpectator(userId: string, roomCode: string, playerName: string): { room: Room } {
    if (this.userToRoom.has(userId) || this.spectatorToRoom.has(userId)) {
      throw new Error('Already in a room. Leave first.');
    }

    const room = this.rooms.get(roomCode);
    if (!room) throw new Error('Room not found.');
    if (!room.config.spectatorsAllowed) throw new Error('Spectators not allowed in this room.');
    if (room.spectators.length >= room.config.maxSpectators) throw new Error('Spectator limit reached.');

    const spectator: RoomSpectator = {
      userId,
      name: playerName,
      joinedAt: Date.now(),
      isConnected: true,
    };
    room.spectators.push(spectator);
    this.spectatorToRoom.set(userId, roomCode);

    return { room };
  }

  /** Remove a spectator from their room. */
  leaveAsSpectator(userId: string): { room: Room | null; roomCode: string } {
    const roomCode = this.spectatorToRoom.get(userId);
    if (!roomCode) throw new Error('Not a spectator in any room.');

    const room = this.rooms.get(roomCode);
    this.spectatorToRoom.delete(userId);

    if (!room) return { room: null, roomCode };

    room.spectators = room.spectators.filter(s => s.userId !== userId);
    return { room, roomCode };
  }

  /** Check if a user is a spectator in any room. */
  isSpectator(userId: string): boolean {
    return this.spectatorToRoom.has(userId);
  }

  /** Get the room code a spectator is in. */
  getSpectatorRoom(userId: string): string | undefined {
    return this.spectatorToRoom.get(userId);
  }

  /** REQ-F-SP13: Mark spectator disconnected. */
  markSpectatorDisconnected(userId: string): { roomCode: string } | undefined {
    const roomCode = this.spectatorToRoom.get(userId);
    if (!roomCode) return undefined;

    const room = this.rooms.get(roomCode);
    if (!room) return undefined;

    const spectator = room.spectators.find(s => s.userId === userId);
    if (spectator) spectator.isConnected = false;

    return { roomCode };
  }

  /** REQ-F-SP13: Mark spectator reconnected — reset to end of queue. */
  markSpectatorReconnected(userId: string): { roomCode: string } | undefined {
    const roomCode = this.spectatorToRoom.get(userId);
    if (!roomCode) return undefined;

    const room = this.rooms.get(roomCode);
    if (!room) return undefined;

    const idx = room.spectators.findIndex(s => s.userId === userId);
    if (idx >= 0) {
      const [spectator] = room.spectators.splice(idx, 1);
      spectator.isConnected = true;
      spectator.joinedAt = Date.now();
      room.spectators.push(spectator); // move to end of queue
    }

    return { roomCode };
  }

  /** REQ-F-SP09: Promote a spectator to a seated player. */
  promoteSpectatorToPlayer(userId: string, seat: Seat): { room: Room } {
    const roomCode = this.spectatorToRoom.get(userId);
    if (!roomCode) throw new Error('Not a spectator.');

    const room = this.rooms.get(roomCode);
    if (!room) throw new Error('Room not found.');

    const spectator = room.spectators.find(s => s.userId === userId);
    if (!spectator) throw new Error('Spectator not found in room.');

    // Remove from spectators
    room.spectators = room.spectators.filter(s => s.userId !== userId);
    this.spectatorToRoom.delete(userId);

    // Add as seated player
    room.players.push({
      seat,
      name: spectator.name,
      isBot: false,
      isConnected: true,
    });
    this.assignUser(userId, roomCode, seat);

    return { room };
  }

  /** Get spectator user IDs for a room, in queue order. */
  getSpectatorUserIds(roomCode: string): string[] {
    const room = this.rooms.get(roomCode);
    if (!room) return [];
    return room.spectators.filter(s => s.isConnected).map(s => s.userId);
  }

  /** Get a spectator's name by userId. */
  getSpectatorName(userId: string): string | undefined {
    const roomCode = this.spectatorToRoom.get(userId);
    if (!roomCode) return undefined;
    const room = this.rooms.get(roomCode);
    if (!room) return undefined;
    return room.spectators.find(s => s.userId === userId)?.name;
  }

  // ─── Ready-to-start system (REQ-F-SP18–SP21) ────────────────────────

  private readonly readySeats = new Map<string, Set<Seat>>();

  /** REQ-F-SP18: Mark a seat as ready to start. */
  setReady(roomCode: string, seat: Seat): void {
    let ready = this.readySeats.get(roomCode);
    if (!ready) {
      ready = new Set();
      this.readySeats.set(roomCode, ready);
    }
    ready.add(seat);
  }

  /** REQ-F-SP18: Cancel ready for a seat. */
  cancelReady(roomCode: string, seat: Seat): void {
    const ready = this.readySeats.get(roomCode);
    if (ready) ready.delete(seat);
  }

  /** Get seats that are ready to start. */
  getReadySeats(roomCode: string): Seat[] {
    const ready = this.readySeats.get(roomCode);
    return ready ? [...ready] : [];
  }

  /** REQ-F-SP20: Check if all 4 seats are ready. */
  areAllReady(roomCode: string): boolean {
    const room = this.rooms.get(roomCode);
    if (!room || room.players.length !== 4) return false;
    const ready = this.readySeats.get(roomCode);
    if (!ready) return false;
    return room.players.every(p => ready.has(p.seat));
  }

  /** REQ-F-SP21: Reset all ready states for a room. */
  resetReady(roomCode: string): void {
    this.readySeats.delete(roomCode);
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
    this.spectatorToRoom.clear();
    this.readySeats.clear();
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
    const room = this.rooms.get(roomCode);
    // REQ-F-SP15: Clean up spectator mappings
    if (room) {
      for (const spectator of room.spectators) {
        this.spectatorToRoom.delete(spectator.userId);
      }
    }
    this.readySeats.delete(roomCode);
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
