// REQ-F-MP02: Room codes and matchmaking types

import type { GameConfig, Seat } from './game.js';

/** A player occupying a seat in a room */
export interface RoomPlayer {
  seat: Seat;
  name: string;
  isBot: boolean;
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
  config: Pick<RoomConfig, 'targetScore' | 'botDifficulty'>;
  gameInProgress: boolean;
}
