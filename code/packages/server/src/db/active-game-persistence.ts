// Persistence layer for active (in-progress) game and room state.
// Used by the graceful restart mechanism to save/restore running games.

import type { Database } from './connection.js';
import { activeGames, activeRooms } from './schema.js';
import type { GameSnapshot, RoomSnapshot } from '../game/game-serializer.js';

export function saveActiveGames(database: Database, snapshots: GameSnapshot[]): void {
  database.db.transaction((tx) => {
    tx.delete(activeGames).run();
    for (const snapshot of snapshots) {
      tx.insert(activeGames).values({
        gameId: snapshot.gameId,
        roomCode: snapshot.roomCode,
        stateBlob: JSON.stringify(snapshot),
        savedAt: new Date().toISOString(),
      }).run();
    }
  });
}

export function loadActiveGames(database: Database): GameSnapshot[] {
  const rows = database.db.select().from(activeGames).all();
  return rows.map((row) => JSON.parse(row.stateBlob) as GameSnapshot);
}

export function clearActiveGames(database: Database): void {
  database.db.delete(activeGames).run();
}

export function saveActiveRooms(database: Database, snapshots: RoomSnapshot[]): void {
  database.db.transaction((tx) => {
    tx.delete(activeRooms).run();
    for (const snapshot of snapshots) {
      tx.insert(activeRooms).values({
        roomCode: snapshot.roomCode,
        roomBlob: JSON.stringify(snapshot),
        savedAt: new Date().toISOString(),
      }).run();
    }
  });
}

export function loadActiveRooms(database: Database): RoomSnapshot[] {
  const rows = database.db.select().from(activeRooms).all();
  return rows.map((row) => JSON.parse(row.roomBlob) as RoomSnapshot);
}

export function clearActiveRooms(database: Database): void {
  database.db.delete(activeRooms).run();
}
