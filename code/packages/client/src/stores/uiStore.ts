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

  /* --- Chat (REQ-F-MP07) --- */
  chatOpen: boolean;
  chatMessages: ChatMessage[];
  chatUnread: number;
  toggleChat: () => void;
  addChatMessage: (msg: ChatMessage) => void;

  /* --- Disconnect (REQ-F-MP08) --- */
  disconnectedSeat: Seat | null;
  disconnectVoteRequired: boolean;
  disconnectCountdown: number;
  reconnectedSeat: Seat | null;
  setDisconnected: (seat: Seat | null) => void;
  setDisconnectVoteRequired: (required: boolean) => void;
  setDisconnectCountdown: (seconds: number) => void;
  setReconnected: (seat: Seat | null) => void;

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

  /* --- Chat --- */
  chatOpen: false,
  chatMessages: [],
  chatUnread: 0,
  toggleChat: () =>
    set((s) => ({ chatOpen: !s.chatOpen, chatUnread: s.chatOpen ? s.chatUnread : 0 })),
  addChatMessage: (msg) =>
    set((s) => ({
      chatMessages: [...s.chatMessages, msg],
      chatUnread: s.chatOpen ? s.chatUnread : s.chatUnread + 1,
    })),

  /* --- Disconnect --- */
  disconnectedSeat: null,
  disconnectVoteRequired: false,
  disconnectCountdown: 0,
  reconnectedSeat: null,
  setDisconnected: (seat) =>
    set({ disconnectedSeat: seat, disconnectVoteRequired: false, disconnectCountdown: 0 }),
  setDisconnectVoteRequired: (required) => set({ disconnectVoteRequired: required }),
  setDisconnectCountdown: (seconds) => set({ disconnectCountdown: seconds }),
  setReconnected: (seat) =>
    set({ reconnectedSeat: seat, disconnectedSeat: null, disconnectVoteRequired: false }),

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

  /* --- Error Toast --- */
  errorToast: null,
  showErrorToast: (message) => set({ errorToast: message }),
  clearErrorToast: () => set({ errorToast: null }),
}));
