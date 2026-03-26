// Client-only UI state: card selection, animation settings, connection status, chat, disconnect
'use client';

import { create } from 'zustand';
import type { CardId, Rank, Seat, TichuCall, TrickState } from '@tichu/shared';
import type { ConnectionStatus } from '@/hooks/useWebSocket';
import type { ChatMessage } from '@/components/game/ChatPanel';

export interface UiStore {
  /* --- Card Selection --- */
  selectedCardIds: Set<CardId>;
  selectCard: (id: CardId) => void;
  deselectCard: (id: CardId) => void;
  toggleCard: (id: CardId) => void;
  clearSelection: () => void;

  /* --- Phoenix Value Picker --- */
  phoenixPickerOptions: Rank[] | null;
  showPhoenixPicker: (options: Rank[]) => void;
  hidePhoenixPicker: () => void;

  /* --- Wish Picker --- */
  wishPickerVisible: boolean;
  pendingWishPlay: { cardIds: number[]; phoenixAs?: Rank } | null;
  showWishPicker: (play: { cardIds: number[]; phoenixAs?: Rank }) => void;
  hideWishPicker: () => void;

  /* --- Connection --- */
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;

  /* --- Settings --- */
  animationSpeed: 'slow' | 'normal' | 'fast' | 'off';
  setAnimationSpeed: (speed: 'slow' | 'normal' | 'fast' | 'off') => void;

  /* --- Auto-Pass (REQ-F-AP01–AP12) --- */
  autoPassEnabled: boolean;
  setAutoPassEnabled: (enabled: boolean) => void;

  /* --- Chat (REQ-F-MP07) --- */
  chatOpen: boolean;
  chatMessages: ChatMessage[];
  chatUnread: number;
  toggleChat: () => void;
  addChatMessage: (msg: ChatMessage) => void;

  /* --- Disconnect (REQ-F-ES04) --- */
  disconnectedSeats: Seat[];
  disconnectVoteRequired: boolean;
  disconnectVotes: Record<string, 'wait' | 'kick' | null>;
  disconnectCountdown: number;
  reconnectedSeat: Seat | null;
  setDisconnectedSeats: (seats: Seat[]) => void;
  addDisconnectedSeat: (seat: Seat) => void;
  setDisconnectVoteRequired: (required: boolean) => void;
  setDisconnectVotes: (votes: Record<string, 'wait' | 'kick' | null>) => void;
  setDisconnectCountdown: (seconds: number) => void;
  setReconnected: (seat: Seat | null) => void;
  clearDisconnectState: () => void;

  /* --- Tichu Banner (REQ-NF-U02) --- */
  tichuEvent: { seat: Seat; level: TichuCall } | null;
  setTichuEvent: (event: { seat: Seat; level: TichuCall } | null) => void;

  /* --- Bomb Window (REQ-F-BW01) --- */
  bombWindowActive: boolean;
  bombWindowEndTime: number | null;
  queuedPlay: { cardIds: number[]; phoenixAs?: Rank; wish?: Rank | null } | null;
  startBombWindow: (durationMs: number) => void;
  clearBombWindow: () => void;
  setQueuedPlay: (play: { cardIds: number[]; phoenixAs?: Rank; wish?: Rank | null }) => void;
  clearQueuedPlay: () => void;

  /* --- Dog Animation (REQ-F-DA01) --- */
  dogAnimation: { fromSeat: Seat; toSeat: Seat } | null;
  startDogAnimation: (fromSeat: Seat, toSeat: Seat) => void;
  clearDogAnimation: () => void;

  /* --- Dragon Gift Animation (REQ-F-DRA02) --- */
  dragonGiftAnimation: { recipient: Seat; trick: TrickState } | null;
  startDragonGiftAnimation: (recipient: Seat, trick: TrickState) => void;
  clearDragonGiftAnimation: () => void;

  /* --- Spectator Queue (REQ-F-ES06, ES11, ES10) --- */
  seatOffer: { seats: Seat[]; timeoutMs: number } | null;
  queueStatus: { decidingSpectator: string; position: number; timeoutMs: number } | null;
  availableSeats: Seat[];
  setSeatOffer: (offer: { seats: Seat[]; timeoutMs: number } | null) => void;
  clearSeatOffer: () => void;
  setQueueStatus: (status: { decidingSpectator: string; position: number; timeoutMs: number } | null) => void;
  setAvailableSeats: (seats: Seat[]) => void;

  /* --- Player Vote (REQ-F-PV01–PV28) --- */
  activeVote: {
    voteId: string;
    voteType: 'kick' | 'restart';
    initiatorSeat: Seat;
    targetSeat?: Seat;
    votes: Record<string, boolean | null>;
    timeoutMs: number;
  } | null;
  voteResult: {
    voteType: 'kick' | 'restart';
    passed: boolean;
    message: string;
  } | null;
  kickTargetMode: boolean;
  voteCountdown: number;
  setActiveVote: (vote: UiStore['activeVote']) => void;
  setVoteResult: (result: UiStore['voteResult']) => void;
  setKickTargetMode: (active: boolean) => void;
  setVoteCountdown: (seconds: number) => void;
  clearPlayerVoteState: () => void;

  /* --- Error Toast --- */
  errorToast: string | null;
  showErrorToast: (message: string) => void;
  clearErrorToast: () => void;
}

export const useUiStore = create<UiStore>()((set) => ({
  /* --- Card Selection --- */
  selectedCardIds: new Set(),

  selectCard: (id) =>
    set((s) => {
      const next = new Set(s.selectedCardIds);
      next.add(id);
      return { selectedCardIds: next };
    }),

  deselectCard: (id) =>
    set((s) => {
      const next = new Set(s.selectedCardIds);
      next.delete(id);
      return { selectedCardIds: next };
    }),

  toggleCard: (id) =>
    set((s) => {
      const next = new Set(s.selectedCardIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedCardIds: next };
    }),

  clearSelection: () => set({ selectedCardIds: new Set() }),

  /* --- Phoenix Value Picker --- */
  phoenixPickerOptions: null,
  showPhoenixPicker: (options) => set({ phoenixPickerOptions: options }),
  hidePhoenixPicker: () => set({ phoenixPickerOptions: null }),

  /* --- Wish Picker --- */
  wishPickerVisible: false,
  pendingWishPlay: null,
  showWishPicker: (play) => set({ wishPickerVisible: true, pendingWishPlay: play }),
  hideWishPicker: () => set({ wishPickerVisible: false, pendingWishPlay: null }),

  /* --- Connection --- */
  connectionStatus: 'disconnected',
  setConnectionStatus: (status) => set({ connectionStatus: status }),

  /* --- Settings --- */
  animationSpeed: 'normal',
  setAnimationSpeed: (speed) => set({ animationSpeed: speed }),

  /* --- Auto-Pass --- */
  // REQ-F-AP03: Default state is off
  autoPassEnabled: false,
  setAutoPassEnabled: (enabled) => set({ autoPassEnabled: enabled }),

  /* --- Chat --- */
  chatOpen: true,
  chatMessages: [],
  chatUnread: 0,
  toggleChat: () =>
    set((s) => ({ chatOpen: !s.chatOpen, chatUnread: s.chatOpen ? s.chatUnread : 0 })),
  addChatMessage: (msg) =>
    set((s) => ({
      chatMessages: [...s.chatMessages, msg],
      chatUnread: s.chatOpen ? s.chatUnread : s.chatUnread + 1,
    })),

  /* --- Disconnect (REQ-F-ES04) --- */
  disconnectedSeats: [],
  disconnectVoteRequired: false,
  disconnectVotes: {},
  disconnectCountdown: 0,
  reconnectedSeat: null,
  setDisconnectedSeats: (seats) =>
    set({ disconnectedSeats: seats, disconnectVoteRequired: false, disconnectCountdown: 0, disconnectVotes: {} }),
  addDisconnectedSeat: (seat) =>
    set((s) => ({
      disconnectedSeats: s.disconnectedSeats.includes(seat) ? s.disconnectedSeats : [...s.disconnectedSeats, seat],
    })),
  setDisconnectVoteRequired: (required) => set({ disconnectVoteRequired: required }),
  setDisconnectVotes: (votes) => set({ disconnectVotes: votes }),
  setDisconnectCountdown: (seconds) => set({ disconnectCountdown: seconds }),
  setReconnected: (seat) =>
    set((s) => ({
      reconnectedSeat: seat,
      disconnectedSeats: s.disconnectedSeats.filter(s2 => s2 !== seat),
      disconnectVoteRequired: false,
      disconnectVotes: {},
    })),
  clearDisconnectState: () =>
    set({ disconnectedSeats: [], disconnectVoteRequired: false, disconnectVotes: {}, disconnectCountdown: 0, reconnectedSeat: null }),

  /* --- Tichu Banner --- */
  tichuEvent: null,
  setTichuEvent: (event) => set({ tichuEvent: event }),

  /* --- Bomb Window --- */
  bombWindowActive: false,
  bombWindowEndTime: null,
  queuedPlay: null,
  startBombWindow: (durationMs) =>
    set({ bombWindowActive: true, bombWindowEndTime: Date.now() + durationMs }),
  clearBombWindow: () => set({ bombWindowActive: false, bombWindowEndTime: null }),
  setQueuedPlay: (play) => set({ queuedPlay: play }),
  clearQueuedPlay: () => set({ queuedPlay: null }),

  /* --- Dog Animation --- */
  dogAnimation: null,
  startDogAnimation: (fromSeat, toSeat) => set({ dogAnimation: { fromSeat, toSeat } }),
  clearDogAnimation: () => set({ dogAnimation: null }),

  /* --- Dragon Gift Animation --- */
  dragonGiftAnimation: null,
  startDragonGiftAnimation: (recipient, trick) =>
    set({ dragonGiftAnimation: { recipient, trick } }),
  clearDragonGiftAnimation: () => set({ dragonGiftAnimation: null }),

  /* --- Spectator Queue --- */
  seatOffer: null,
  queueStatus: null,
  availableSeats: [],
  setSeatOffer: (offer) => set({ seatOffer: offer, queueStatus: null }),
  clearSeatOffer: () => set({ seatOffer: null }),
  setQueueStatus: (status) => set({ queueStatus: status, seatOffer: null }),
  setAvailableSeats: (seats) => set({ availableSeats: seats, seatOffer: null, queueStatus: null }),

  /* --- Player Vote --- */
  activeVote: null,
  voteResult: null,
  kickTargetMode: false,
  voteCountdown: 0,
  setActiveVote: (vote) => set({ activeVote: vote }),
  setVoteResult: (result) => set({ voteResult: result }),
  setKickTargetMode: (active) => set({ kickTargetMode: active }),
  setVoteCountdown: (seconds) => set({ voteCountdown: seconds }),
  clearPlayerVoteState: () =>
    set({ activeVote: null, voteResult: null, kickTargetMode: false, voteCountdown: 0 }),

  /* --- Error Toast --- */
  errorToast: null,
  showErrorToast: (message) => set({ errorToast: message }),
  clearErrorToast: () => set({ errorToast: null }),
}));
