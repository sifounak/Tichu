// REQ-F-UC01: Production-shaped fixtures, isolated stores and controllable responses.
import { DEFAULT_GAME_CONFIG, GamePhase, type ClientGameView, type RoomPlayer } from '@tichu/shared';
import { useAuthStore } from '@/stores/authStore';
import { useGameStore } from '@/stores/gameStore';
import { useRoomStore } from '@/stores/roomStore';
import { useUiStore } from '@/stores/uiStore';
import { usePreferencesStore } from '@/stores/preferencesStore';

export function resetClientStores() {
  useAuthStore.setState(useAuthStore.getInitialState(), true);
  useGameStore.setState(useGameStore.getInitialState(), true);
  useRoomStore.setState(useRoomStore.getInitialState(), true);
  useUiStore.setState(useUiStore.getInitialState(), true);
  usePreferencesStore.setState(usePreferencesStore.getInitialState(), true);
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

export const account = { userId: 'alice', username: 'Alice', email: 'alice@example.test', isGuest: false };

export function roomPlayers(): RoomPlayer[] {
  return [
    { seat: 'south', name: 'Alice', isBot: false, isConnected: true },
    { seat: 'north', name: 'Partner', isBot: false, isConnected: true },
    { seat: 'east', name: 'Left', isBot: true, isConnected: true },
    { seat: 'west', name: 'Right', isBot: true, isConnected: true },
  ];
}

export function gameView(overrides: Partial<ClientGameView> = {}): ClientGameView {
  return {
    gameId: 'fixture-game', config: { ...DEFAULT_GAME_CONFIG }, phase: GamePhase.Playing,
    scores: { northSouth: 100, eastWest: 50 }, roundHistory: [], mySeat: 'south', myHand: [],
    myTichuCall: 'none', myHasPlayed: false, otherPlayers: [], currentTrick: null, currentTurn: 'south',
    mahjongWish: null, wishFulfilled: false, finishOrder: [], dragonGiftPending: false, dragonGiftedTo: null,
    receivedCards: { north: null, east: null, south: null, west: null }, lastDogPlay: null,
    blindGrandTichuDecided: [], grandTichuDecided: [], ...overrides,
  };
}
