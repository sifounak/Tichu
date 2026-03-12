// REQ-F-MP02: Room state management for lobby and room UI
'use client';

import { create } from 'zustand';
import type { Seat, GameConfig } from '@tichu/shared';
import type { LobbyEntry, RoomPlayer } from '@tichu/shared';

export interface RoomStore {
  /* --- Room state --- */
  roomCode: string | null;
  mySeat: Seat | null;
  players: RoomPlayer[];
  hostSeat: Seat | null;
  config: GameConfig | null;
  gameInProgress: boolean;

  /* --- Lobby state --- */
  lobbyRooms: LobbyEntry[];

  /* --- Actions --- */
  setRoom: (roomCode: string, seat: Seat) => void;
  updateRoom: (players: RoomPlayer[], hostSeat: Seat, config: GameConfig, gameInProgress: boolean) => void;
  setLobbyRooms: (rooms: LobbyEntry[]) => void;
  leaveRoom: () => void;
  reset: () => void;
}

const INITIAL_STATE = {
  roomCode: null,
  mySeat: null,
  players: [],
  hostSeat: null,
  config: null,
  gameInProgress: false,
  lobbyRooms: [],
};

export const useRoomStore = create<RoomStore>()((set) => ({
  ...INITIAL_STATE,

  setRoom: (roomCode, seat) => set({ roomCode, mySeat: seat }),

  updateRoom: (players, hostSeat, config, gameInProgress) =>
    set({ players, hostSeat, config, gameInProgress }),

  setLobbyRooms: (rooms) => set({ lobbyRooms: rooms }),

  leaveRoom: () => set({
    roomCode: null,
    mySeat: null,
    players: [],
    hostSeat: null,
    config: null,
    gameInProgress: false,
  }),

  reset: () => set(INITIAL_STATE),
}));
