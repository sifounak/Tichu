import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, type Database } from '../../src/db/connection.js';
import {
  saveActiveGames,
  loadActiveGames,
  clearActiveGames,
  saveActiveRooms,
  loadActiveRooms,
  clearActiveRooms,
} from '../../src/db/active-game-persistence.js';
import type { GameSnapshot, RoomSnapshot } from '../../src/game/game-serializer.js';
import { unlinkSync } from 'fs';

const TEST_DB_PATH = './data/test-active-games.sqlite';

describe('active-game-persistence', () => {
  let database: Database;

  beforeEach(() => {
    database = createDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    database.close();
    try { unlinkSync(TEST_DB_PATH); } catch {}
    try { unlinkSync(TEST_DB_PATH + '-wal'); } catch {}
    try { unlinkSync(TEST_DB_PATH + '-shm'); } catch {}
  });

  it('saves and loads game snapshots', () => {
    const snapshot: GameSnapshot = {
      gameId: 'game-1',
      roomCode: 'ROOM1',
      machineSnapshot: { value: 'playing', context: {} },
      vacatedSeats: [],
      choosingSeats: [],
      joinedAfterSpectating: [],
      humanParticipants: [],
      endOfTrickBombWindowEndTime: null,
      timerState: null,
      botSeats: ['north'],
      botStates: {},
      config: { targetScore: 1000, turnTimerSeconds: null, spectatorsAllowed: true, isPrivate: false, maxSpectators: 10 } as any,
    };

    saveActiveGames(database, [snapshot]);
    const loaded = loadActiveGames(database);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].gameId).toBe('game-1');
    expect(loaded[0].roomCode).toBe('ROOM1');
  });

  it('clears all active games', () => {
    const snapshot = { gameId: 'game-1', roomCode: 'R1' } as any;
    saveActiveGames(database, [snapshot as GameSnapshot]);
    clearActiveGames(database);
    expect(loadActiveGames(database)).toHaveLength(0);
  });

  it('saves and loads room snapshots', () => {
    const room: RoomSnapshot = {
      roomCode: 'ROOM1',
      roomName: 'Test Room',
      hostSeat: 'south',
      players: [{ seat: 'south', name: 'Alice', isBot: false }],
      config: {} as any,
      gameInProgress: true,
      seatToUserId: { south: 'user-1' },
    };

    saveActiveRooms(database, [room]);
    const loaded = loadActiveRooms(database);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].roomCode).toBe('ROOM1');
    expect(loaded[0].seatToUserId.south).toBe('user-1');
  });
});
