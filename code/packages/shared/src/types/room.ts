// REQ-F-MP02: Room codes and matchmaking types

import type { GameConfig, Seat } from './game.js';

/** A player occupying a seat in a room */
export interface RoomPlayer {
  seat: Seat;
  name: string;
  isBot: boolean;
  isConnected: boolean;
}

// REQ-F-SP03: Spectator tracked in FIFO order for seat priority
/** A spectator watching a room */
export interface RoomSpectator {
  userId: string;
  name: string;
  joinedAt: number;
  isConnected: boolean;
}

/** REQ-F-MP04: Room configuration extends game configuration */
export interface RoomConfig extends GameConfig {
  maxSpectators: number;
}

/** A game room */
export interface Room {
  roomCode: string;
  roomName: string;
  hostSeat: Seat;
  players: RoomPlayer[];
  // REQ-F-SP03: Spectators in FIFO order for seat priority queue
  spectators: RoomSpectator[];
  config: RoomConfig;
  gameInProgress: boolean;
  createdAt: number;
}

/** REQ-F-MP03: Public lobby entry (minimal room info for browsing) */
export interface LobbyEntry {
  roomCode: string;
  roomName: string;
  hostName: string;
  playerCount: number;
  spectatorCount: number;
  // REQ-F-SP01: Include spectatorsAllowed so lobby can show "Join as Spectator" button
  config: Pick<RoomConfig, 'targetScore' | 'botDifficulty' | 'spectatorsAllowed'>;
  gameInProgress: boolean;
  // REQ-F-ES05: True when game is in progress and has fewer than 4 players
  hasEmptySeats: boolean;
}
