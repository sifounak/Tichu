// Verifies: REQ-NF-A02 — game store applies server state correctly
import { describe, it, expect, beforeEach } from 'vitest';
import { GamePhase } from '@tichu/shared';
import type { ClientGameView, ServerMessage, Seat, Team } from '@tichu/shared';
import { useGameStore } from '@/stores/gameStore';

function makeView(overrides: Partial<ClientGameView> = {}): ClientGameView {
  return {
    gameId: 'test-game-1',
    config: {
      targetScore: 1000,
      turnTimerSeconds: null,
      botDifficulty: 'regular',
      animationSpeed: 'normal',
      spectatorsAllowed: true,
      isPrivate: false,
    },
    phase: GamePhase.Playing,
    scores: { northSouth: 0, eastWest: 0 } as Record<Team, number>,
    roundHistory: [],
    mySeat: 'south' as Seat,
    myHand: [],
    myTichuCall: 'none',
    otherPlayers: [
      { seat: 'north' as Seat, cardCount: 14, tichuCall: 'none', hasPlayed: false, finishOrder: null },
      { seat: 'east' as Seat, cardCount: 14, tichuCall: 'none', hasPlayed: false, finishOrder: null },
      { seat: 'west' as Seat, cardCount: 14, tichuCall: 'none', hasPlayed: false, finishOrder: null },
    ],
    currentTrick: null,
    currentTurn: 'south' as Seat,
    mahjongWish: null,
    wishFulfilled: false,
    finishOrder: [],
    dragonGiftPending: false,
    ...overrides,
  };
}

describe('gameStore', () => {
  beforeEach(() => {
    useGameStore.getState().reset();
  });

  describe('applyGameState', () => {
    it('sets all fields from ClientGameView', () => {
      const view = makeView({ gameId: 'game-42', phase: GamePhase.CardPassing });
      useGameStore.getState().applyGameState(view);

      const state = useGameStore.getState();
      expect(state.gameId).toBe('game-42');
      expect(state.phase).toBe(GamePhase.CardPassing);
      expect(state.mySeat).toBe('south');
      expect(state.otherPlayers).toHaveLength(3);
    });
  });

  describe('applyServerMessage', () => {
    it('handles TURN_CHANGE', () => {
      const msg = { type: 'TURN_CHANGE', seat: 'east' } as ServerMessage;
      useGameStore.getState().applyServerMessage(msg);
      expect(useGameStore.getState().currentTurn).toBe('east');
    });

    it('handles WISH_DECLARED', () => {
      const msg = { type: 'WISH_DECLARED', rank: 10 } as ServerMessage;
      useGameStore.getState().applyServerMessage(msg);
      expect(useGameStore.getState().mahjongWish).toBe(10);
      expect(useGameStore.getState().wishFulfilled).toBe(false);
    });

    it('handles WISH_FULFILLED', () => {
      useGameStore.getState().applyServerMessage({ type: 'WISH_DECLARED', rank: 5 } as ServerMessage);
      useGameStore.getState().applyServerMessage({ type: 'WISH_FULFILLED' } as ServerMessage);
      expect(useGameStore.getState().wishFulfilled).toBe(true);
    });

    it('handles DRAGON_GIFT_REQUIRED and DRAGON_GIFTED', () => {
      useGameStore.getState().applyServerMessage({ type: 'DRAGON_GIFT_REQUIRED', options: ['east', 'west'] } as ServerMessage);
      expect(useGameStore.getState().dragonGiftPending).toBe(true);

      useGameStore.getState().applyServerMessage({ type: 'DRAGON_GIFTED', from: 'south', to: 'east' } as ServerMessage);
      expect(useGameStore.getState().dragonGiftPending).toBe(false);
    });

    it('handles TRICK_WON (clears trick)', () => {
      useGameStore.getState().applyGameState(makeView({
        currentTrick: { plays: [], passes: [], leadSeat: 'south' as Seat, currentWinner: 'south' as Seat },
      }));
      useGameStore.getState().applyServerMessage({ type: 'TRICK_WON', seat: 'south' } as ServerMessage);
      expect(useGameStore.getState().currentTrick).toBeNull();
    });

    it('handles PLAYER_FINISHED', () => {
      useGameStore.getState().applyGameState(makeView());
      useGameStore.getState().applyServerMessage({
        type: 'PLAYER_FINISHED', seat: 'north', order: 1,
      } as ServerMessage);

      const state = useGameStore.getState();
      expect(state.finishOrder).toContain('north');
      const north = state.otherPlayers.find((p) => p.seat === 'north');
      expect(north?.finishOrder).toBe(1);
    });

    it('handles TICHU_CALLED for self', () => {
      useGameStore.getState().applyGameState(makeView());
      useGameStore.getState().applyServerMessage({
        type: 'TICHU_CALLED', seat: 'south', level: 'tichu',
      } as ServerMessage);
      expect(useGameStore.getState().myTichuCall).toBe('tichu');
    });

    it('handles TICHU_CALLED for other player', () => {
      useGameStore.getState().applyGameState(makeView());
      useGameStore.getState().applyServerMessage({
        type: 'TICHU_CALLED', seat: 'east', level: 'grandTichu',
      } as ServerMessage);
      const east = useGameStore.getState().otherPlayers.find((p) => p.seat === 'east');
      expect(east?.tichuCall).toBe('grandTichu');
    });

    it('handles ROUND_SCORED', () => {
      useGameStore.getState().applyServerMessage({
        type: 'ROUND_SCORED',
        roundNumber: 1,
        cardPoints: { northSouth: 75, eastWest: 25 },
        tichuBonuses: { northSouth: 0, eastWest: 0 },
        oneTwoBonus: null,
        total: { northSouth: 75, eastWest: 25 },
        cumulativeScores: { northSouth: 75, eastWest: 25 },
      } as ServerMessage);
      expect(useGameStore.getState().scores).toEqual({ northSouth: 75, eastWest: 25 });
    });

    it('handles unknown message type gracefully', () => {
      // Should not throw
      useGameStore.getState().applyServerMessage({ type: 'CHAT_RECEIVED', from: 'east', text: 'hi' } as ServerMessage);
    });
  });

  describe('reset', () => {
    it('resets all state to initial values', () => {
      useGameStore.getState().applyGameState(makeView({ gameId: 'game-99' }));
      expect(useGameStore.getState().gameId).toBe('game-99');
      useGameStore.getState().reset();
      expect(useGameStore.getState().gameId).toBeNull();
      expect(useGameStore.getState().myHand).toEqual([]);
    });
  });
});
