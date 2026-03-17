// Verifies: REQ-NF-A02 — Server authoritative, projected state

import { describe, it, expect } from 'vitest';
import { projectGameState } from '../../src/ws/state-projection.js';
import { createInitialContext } from '../../src/game/game-state-machine.js';
import type { GameMachineContext } from '../../src/game/game-state-machine.js';
import type { Seat, GameCard, PlayerState, RoundState, TrickState, Combination } from '@tichu/shared';
import { GamePhase, SEATS_IN_ORDER } from '@tichu/shared';

/** Create a minimal PlayerState for testing */
function createTestPlayer(seat: Seat, hand: GameCard[] = []): PlayerState {
  return {
    seat,
    hand,
    tricksWon: [],
    tipiCall: 'none',
    hasPlayed: false,
    finishOrder: null,
    passedCards: {
      to: { north: null, east: null, south: null, west: null },
      received: false,
    },
  };
}

/** Create a RoundState with customizable hands */
function createTestRound(hands: Record<Seat, GameCard[]> = {
  north: [], east: [], south: [], west: [],
}): RoundState {
  return {
    roundNumber: 1,
    phase: GamePhase.Playing,
    players: {
      north: createTestPlayer('north', hands.north),
      east: createTestPlayer('east', hands.east),
      south: createTestPlayer('south', hands.south),
      west: createTestPlayer('west', hands.west),
    },
    currentTrick: null,
    currentTurn: 'north',
    mahjongWish: null,
    wishFulfilled: false,
    finishOrder: [],
    dragonGiftPending: null,
    dragonGiftedTo: null,
    lastDogPlay: null,
    bombsPerTeam: { northSouth: 0, eastWest: 0 },
  };
}

describe('projectGameState', () => {
  describe('lobby state (no round)', () => {
    it('returns base view for lobby with no round data', () => {
      const context = createInitialContext('game-1');
      const view = projectGameState(context, 'lobby', 'north');

      expect(view.gameId).toBe('game-1');
      expect(view.phase).toBe(GamePhase.WaitingForPlayers);
      expect(view.mySeat).toBe('north');
      expect(view.myHand).toEqual([]);
      expect(view.myTichuCall).toBe('none');
      expect(view.otherPlayers).toHaveLength(3);
      expect(view.otherPlayers.map(p => p.seat).sort()).toEqual(['east', 'south', 'west']);
      expect(view.currentTrick).toBeNull();
      expect(view.currentTurn).toBeNull();
    });
  });

  describe('hand visibility', () => {
    it('shows requesting player full hand', () => {
      const northHand: GameCard[] = [
        { id: 0, card: { kind: 'standard', suit: 'jade', rank: 5 } },
        { id: 1, card: { kind: 'standard', suit: 'jade', rank: 7 } },
        { id: 2, card: { kind: 'phoenix' } },
      ];
      const eastHand: GameCard[] = [
        { id: 10, card: { kind: 'standard', suit: 'star', rank: 9 } },
        { id: 11, card: { kind: 'dragon' } },
      ];

      const context = createInitialContext('game-1');
      context.currentRound = createTestRound({
        north: northHand,
        east: eastHand,
        south: [],
        west: [{ id: 20, card: { kind: 'dog' } }],
      });

      const view = projectGameState(context, 'playing', 'north');

      // North sees their full hand
      expect(view.myHand).toHaveLength(3);
      expect(view.myHand[0].id).toBe(0);
      expect(view.myHand[2].card.kind).toBe('phoenix');

      // Other players show only card count, not cards
      const eastView = view.otherPlayers.find(p => p.seat === 'east')!;
      expect(eastView.cardCount).toBe(2);

      const westView = view.otherPlayers.find(p => p.seat === 'west')!;
      expect(westView.cardCount).toBe(1);

      const southView = view.otherPlayers.find(p => p.seat === 'south')!;
      expect(southView.cardCount).toBe(0);
    });

    it('different seat sees different hand', () => {
      const context = createInitialContext('game-1');
      context.currentRound = createTestRound({
        north: [{ id: 0, card: { kind: 'standard', suit: 'jade', rank: 5 } }],
        east: [{ id: 10, card: { kind: 'standard', suit: 'star', rank: 9 } }],
        south: [],
        west: [],
      });

      const eastView = projectGameState(context, 'playing', 'east');
      expect(eastView.myHand).toHaveLength(1);
      expect(eastView.myHand[0].id).toBe(10);

      const northInfo = eastView.otherPlayers.find(p => p.seat === 'north')!;
      expect(northInfo.cardCount).toBe(1);
    });
  });

  describe('phase mapping', () => {
    it('maps grandTichuDecision to GrandTichuDecision phase', () => {
      const context = createInitialContext('game-1');
      context.currentRound = createTestRound();
      const view = projectGameState(context, 'grandTichuDecision', 'north');
      expect(view.phase).toBe(GamePhase.GrandTichuDecision);
    });

    it('maps regularTichuDecision to TichuDecision phase', () => {
      const context = createInitialContext('game-1');
      context.currentRound = createTestRound();
      const view = projectGameState(context, 'regularTichuDecision', 'north');
      expect(view.phase).toBe(GamePhase.TichuDecision);
    });

    it('maps cardPassing to CardPassing phase', () => {
      const context = createInitialContext('game-1');
      context.currentRound = createTestRound();
      const view = projectGameState(context, 'cardPassing', 'north');
      expect(view.phase).toBe(GamePhase.CardPassing);
    });

    it('maps awaitingDragonGift to Playing phase (client perspective)', () => {
      const context = createInitialContext('game-1');
      context.currentRound = createTestRound();
      const view = projectGameState(context, 'awaitingDragonGift', 'north');
      expect(view.phase).toBe(GamePhase.Playing);
    });

    it('maps roundScoring to RoundScoring phase', () => {
      const context = createInitialContext('game-1');
      context.currentRound = createTestRound();
      const view = projectGameState(context, 'roundScoring', 'north');
      expect(view.phase).toBe(GamePhase.RoundScoring);
    });

    it('maps gameOver to GameOver phase', () => {
      const context = createInitialContext('game-1');
      const view = projectGameState(context, 'gameOver', 'north');
      expect(view.phase).toBe(GamePhase.GameOver);
    });

    it('maps unknown state to WaitingForPlayers', () => {
      const context = createInitialContext('game-1');
      const view = projectGameState(context, 'unknownState', 'north');
      expect(view.phase).toBe(GamePhase.WaitingForPlayers);
    });
  });

  describe('trick state', () => {
    it('includes current trick plays when present', () => {
      const context = createInitialContext('game-1');
      context.currentRound = createTestRound();
      const trick: TrickState = {
        plays: [{
          seat: 'north',
          combination: {
            type: 'single' as never,
            cards: [{ id: 0, card: { kind: 'standard', suit: 'jade', rank: 5 } }],
            rank: 5,
            length: 1,
          } as Combination,
        }],
        passes: ['east'],
        leadSeat: 'north',
        currentWinner: 'north',
      };
      context.currentRound.currentTrick = trick;

      const view = projectGameState(context, 'playing', 'south');
      expect(view.currentTrick).not.toBeNull();
      expect(view.currentTrick!.plays).toHaveLength(1);
      expect(view.currentTrick!.plays[0].seat).toBe('north');
      expect(view.currentTrick!.passes).toEqual(['east']);
      expect(view.currentTrick!.leadSeat).toBe('north');
    });
  });

  describe('game indicators', () => {
    it('includes scores and round history', () => {
      const context = createInitialContext('game-1');
      context.scores = { northSouth: 150, eastWest: 80 };
      context.roundHistory = [{
        roundNumber: 1,
        cardPoints: { northSouth: 75, eastWest: 25 },
        tichuBonuses: { northSouth: 100, eastWest: 0 },
        oneTwoBonus: null,
        total: { northSouth: 175, eastWest: 25 },
      }];

      const view = projectGameState(context, 'lobby', 'north');
      expect(view.scores).toEqual({ northSouth: 150, eastWest: 80 });
      expect(view.roundHistory).toHaveLength(1);
    });

    it('shows Tichu call for other players', () => {
      const context = createInitialContext('game-1');
      context.currentRound = createTestRound();
      context.currentRound.players.east.tipiCall = 'tichu';
      context.currentRound.players.south.tipiCall = 'grandTichu';

      const view = projectGameState(context, 'playing', 'north');
      const eastPlayer = view.otherPlayers.find(p => p.seat === 'east')!;
      expect(eastPlayer.tichuCall).toBe('tichu');
      const southPlayer = view.otherPlayers.find(p => p.seat === 'south')!;
      expect(southPlayer.tichuCall).toBe('grandTichu');
    });

    it('shows finish order and dragon gift pending', () => {
      const context = createInitialContext('game-1');
      context.currentRound = createTestRound();
      context.currentRound.finishOrder = ['east'];
      context.currentRound.players.east.finishOrder = 1;
      context.currentRound.dragonGiftPending = {
        trickCards: [{ id: 0, card: { kind: 'dragon' } }],
        from: 'north',
      };

      const view = projectGameState(context, 'awaitingDragonGift', 'north');
      expect(view.finishOrder).toEqual(['east']);
      expect(view.dragonGiftPending).toBe(true);

      const eastPlayer = view.otherPlayers.find(p => p.seat === 'east')!;
      expect(eastPlayer.finishOrder).toBe(1);
    });

    it('shows mahjong wish state', () => {
      const context = createInitialContext('game-1');
      context.currentRound = createTestRound();
      context.currentRound.mahjongWish = 8;
      context.currentRound.wishFulfilled = false;

      const view = projectGameState(context, 'playing', 'north');
      expect(view.mahjongWish).toBe(8);
      expect(view.wishFulfilled).toBe(false);
    });
  });
});
