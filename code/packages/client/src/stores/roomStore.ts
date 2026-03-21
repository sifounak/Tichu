// REQ-F-MP02: Room state management for lobby and room UI
'use client';

import { create } from 'zustand';
import type { Seat, GameConfig } from '@tichu/shared';
import type { LobbyEntry, RoomPlayer } from '@tichu/shared';

export interface RoomStore {
  /* --- Room state --- */
  roomCode: string | null;
  roomName: string | null;
  mySeat: Seat | null;
  players: RoomPlayer[];
  hostSeat: Seat | null;
  config: GameConfig | null;
  gameInProgress: boolean;
  // REQ-F-SP16: Spectator count, names, and ready state from ROOM_UPDATE
  spectatorCount: number;
  spectatorNames: string[];
  readyPlayers: Seat[];

  /* --- Lobby state --- */
  lobbyRooms: LobbyEntry[];

  /* --- Actions --- */
  // REQ-F-SP04: seat is nullable for spectators
  setRoom: (roomCode: string, seat: Seat | null) => void;
  updateRoom: (roomName: string, players: RoomPlayer[], hostSeat: Seat, config: GameConfig, gameInProgress: boolean, spectatorCount?: number, spectatorNames?: string[], readyPlayers?: Seat[]) => void;
  setLobbyRooms: (rooms: LobbyEntry[]) => void;
  leaveRoom: () => void;
  reset: () => void;
}

const INITIAL_STATE = {
  roomCode: null,
  roomName: null,
  mySeat: null,
  players: [],
  hostSeat: null,
  config: null,
  gameInProgress: false,
  spectatorCount: 0,
  spectatorNames: [] as string[],
  readyPlayers: [] as Seat[],
  lobbyRooms: [],
};

export const useRoomStore = create<RoomStore>()((set) => ({
  ...INITIAL_STATE,

  setRoom: (roomCode, seat) => set({ roomCode, mySeat: seat }),

  updateRoom: (roomName, players, hostSeat, config, gameInProgress, spectatorCount = 0, spectatorNames = [], readyPlayers = []) =>
    set({ roomName, players, hostSeat, config, gameInProgress, spectatorCount, spectatorNames, readyPlayers }),

  setLobbyRooms: (rooms) => set({ lobbyRooms: rooms }),

  leaveRoom: () => set({
    roomCode: null,
    roomName: null,
    mySeat: null,
    players: [],
    hostSeat: null,
    config: null,
    gameInProgress: false,
    spectatorCount: 0,
    spectatorNames: [],
    readyPlayers: [],
  }),

  reset: () => set(INITIAL_STATE),
}));
