// REQ-NF-A02: Authoritative game state from server (projected per-player view)
'use client';

import { create } from 'zustand';
import type {
  ClientGameView,
  GamePhase,
  GameConfig,
  GameCard,
  Seat,
  TichuCall,
  TrickState,
  Rank,
  Team,
  RoundScore,
  ServerMessage,
} from '@tichu/shared';

export interface GameStore {
  /* --- State --- */
  gameId: string | null;
  config: GameConfig | null;
  phase: GamePhase | null;
  scores: Record<Team, number> | null;
  roundHistory: RoundScore[];
  mySeat: Seat | null;
  myHand: GameCard[];
  myTichuCall: TichuCall;
  otherPlayers: ClientGameView['otherPlayers'];
  currentTrick: TrickState | null;
  currentTurn: Seat | null;
  mahjongWish: Rank | null;
  wishFulfilled: boolean;
  finishOrder: Seat[];
  dragonGiftPending: boolean;
  receivedCards: Record<Seat, GameCard | null>;
  /** REQ-F-DR01: Opponent options for Dragon gift */
  dragonGiftOptions: Seat[];
  /** Whether the player has played any cards this round (for Tichu call eligibility) */
  hasPlayedCards: boolean;
  /** Latest round score (for round-end display) */
  latestRoundScore: RoundScore | null;
  /** Game over info */
  gameOverInfo: { winner: string; finalScores: Record<Team, number> } | null;
  // REQ-F-GT02: Seats that have made their Grand Tichu decision (call or pass)
  grandTichuDecided: Seat[];
  /** Seats that have confirmed their card pass */
  cardPassConfirmed: Seat[];

  /* --- Actions --- */
  /** Apply a full GAME_STATE sync from the server */
  applyGameState: (view: ClientGameView) => void;
  /** Apply an incremental server message */
  applyServerMessage: (msg: ServerMessage) => void;
  /** Reset store to initial state */
  reset: () => void;
}

const initialState = {
  gameId: null,
  config: null,
  phase: null,
  scores: null,
  roundHistory: [],
  mySeat: null,
  myHand: [],
  myTichuCall: 'none' as TichuCall,
  otherPlayers: [] as ClientGameView['otherPlayers'],
  currentTrick: null,
  currentTurn: null,
  mahjongWish: null,
  wishFulfilled: false,
  finishOrder: [] as Seat[],
  dragonGiftPending: false,
  receivedCards: { north: null, east: null, south: null, west: null } as Record<Seat, GameCard | null>,
  dragonGiftOptions: [] as Seat[],
  hasPlayedCards: false,
  latestRoundScore: null as RoundScore | null,
  gameOverInfo: null as { winner: string; finalScores: Record<Team, number> } | null,
  grandTichuDecided: [] as Seat[],
  cardPassConfirmed: [] as Seat[],
};

export const useGameStore = create<GameStore>()((set) => ({
  ...initialState,

  applyGameState: (view: ClientGameView) =>
    set({
      gameId: view.gameId,
      config: view.config,
      phase: view.phase,
      scores: view.scores,
      roundHistory: view.roundHistory,
      mySeat: view.mySeat,
      myHand: view.myHand,
      myTichuCall: view.myTichuCall,
      otherPlayers: view.otherPlayers,
      currentTrick: view.currentTrick,
      currentTurn: view.currentTurn,
      mahjongWish: view.mahjongWish,
      wishFulfilled: view.wishFulfilled,
      finishOrder: view.finishOrder,
      dragonGiftPending: view.dragonGiftPending,
      receivedCards: view.receivedCards,
      dragonGiftOptions: [],
      hasPlayedCards: view.myHasPlayed,
      latestRoundScore: null,
      gameOverInfo: view.winner !== null ? { winner: view.winner, finalScores: view.scores } : null,
      grandTichuDecided: view.grandTichuDecided,
      cardPassConfirmed: view.cardPassConfirmed,
    }),

  applyServerMessage: (msg: ServerMessage) =>
    set((state): Partial<GameStore> => {
      switch (msg.type) {
        case 'GAME_STATE':
          return {};

        case 'DEAL_FIRST_8':
          return { myHand: msg.cards as unknown as GameCard[] };

        case 'DEAL_REMAINING_6':
          return { myHand: [...state.myHand, ...(msg.cards as unknown as GameCard[])] };

        case 'CARDS_PASSED':
          return { myHand: [...state.myHand, ...(msg.received as unknown as GameCard[])] };

        case 'TURN_CHANGE':
          return { currentTurn: msg.seat as Seat };

        case 'PLAYER_PASSED':
          return {
            currentTrick: state.currentTrick
              ? { ...state.currentTrick, passes: [...state.currentTrick.passes, msg.seat as Seat] }
              : null,
          };

        case 'TRICK_WON':
          return { currentTrick: null };

        case 'WISH_DECLARED':
          return { mahjongWish: msg.rank as Rank | null, wishFulfilled: false };

        case 'WISH_FULFILLED':
          return { wishFulfilled: true };

        case 'CARDS_PLAYED':
          if (msg.seat === state.mySeat) {
            return { hasPlayedCards: true };
          }
          return {};

        case 'DRAGON_GIFT_REQUIRED':
          return {
            dragonGiftPending: true,
            dragonGiftOptions: (msg as { options: Seat[] }).options ?? [],
          };

        case 'DRAGON_GIFTED':
          return { dragonGiftPending: false, dragonGiftOptions: [] };

        case 'PLAYER_FINISHED':
          return {
            finishOrder: [...state.finishOrder, msg.seat as Seat],
            otherPlayers: state.otherPlayers.map((p) =>
              p.seat === msg.seat ? { ...p, finishOrder: msg.order } : p,
            ),
          };

        case 'TICHU_CALLED':
          if (msg.seat === state.mySeat) {
            return { myTichuCall: msg.level as TichuCall };
          }
          return {
            otherPlayers: state.otherPlayers.map((p) =>
              p.seat === msg.seat ? { ...p, tichuCall: msg.level as TichuCall } : p,
            ),
          };

        case 'ROUND_SCORED':
          return {
            scores: msg.cumulativeScores as Record<Team, number>,
            latestRoundScore: {
              roundNumber: msg.roundNumber as number,
              cardPoints: msg.cardPoints as Record<Team, number>,
              tichuBonuses: msg.tichuBonuses as Record<Team, number>,
              oneTwoBonus: (msg.oneTwoBonus as Team | null) ?? null,
              total: msg.total as Record<Team, number>,
            } as RoundScore,
            hasPlayedCards: false,
          };

        case 'GAME_OVER':
          return {
            gameOverInfo: {
              winner: (msg as { winner: string }).winner,
              finalScores: (msg as { finalScores: Record<Team, number> }).finalScores,
            },
          };

        default:
          return {};
      }
    }),

  reset: () => set(initialState),
}));
