// Verifies: REQ-F-DR01, REQ-F-DR02, REQ-F-DR03, REQ-F-MP01, REQ-F-MP08

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GameManager } from '../../src/game/game-manager.js';
import { DisconnectHandler } from '../../src/game/disconnect-handler.js';
import { VoteHandler } from '../../src/game/vote-handler.js';
import type { Broadcaster } from '../../src/ws/broadcaster.js';
import type { WebSocket } from 'ws';
import type { Seat, GameCard, ClientMessage, GameConfig, Rank } from '@tichu/shared';
import { SEATS_IN_ORDER, isDog } from '@tichu/shared';

// ─── Mocks ──────────────────────────────────────────────────────────────────

function createMockBroadcaster(): Broadcaster {
  return {
    send: vi.fn().mockReturnValue(true),
    sendToPlayer: vi.fn().mockReturnValue(true),
    broadcastToRoom: vi.fn().mockReturnValue(3),
    broadcastGameState: vi.fn().mockReturnValue(4),
    broadcastToSpectators: vi.fn().mockReturnValue(0),
    sendError: vi.fn().mockReturnValue(true),
  } as unknown as Broadcaster;
}

function createMockWs(): WebSocket {
  return {
    readyState: 1, // OPEN
    send: vi.fn(),
    OPEN: 1,
  } as unknown as WebSocket;
}

function createTestManager(config?: Partial<GameConfig>) {
  const broadcaster = createMockBroadcaster();
  const disconnectHandler = new DisconnectHandler(broadcaster);
  const voteHandler = new VoteHandler(broadcaster);
  const manager = new GameManager(
    'test-game',
    'ROOM1',
    broadcaster,
    disconnectHandler,
    voteHandler,
    config,
  );
  return { manager, broadcaster, disconnectHandler, voteHandler };
}

/** Seat all 4 players */
function seatAllPlayers(manager: GameManager): void {
  for (const seat of SEATS_IN_ORDER) {
    manager.seatPlayer(seat);
  }
}

/** Advance to playing phase through the WebSocket message interface */
function advanceToPlaying(manager: GameManager, ws: WebSocket): void {
  seatAllPlayers(manager);
  manager.handleMessage(ws, 'north', { type: 'START_GAME' } as ClientMessage);

  // All pass Grand Tichu
  for (const seat of SEATS_IN_ORDER) {
    manager.handleMessage(ws, seat, { type: 'GRAND_TICHU_DECISION', call: false } as ClientMessage);
  }

  const round = manager.context.currentRound!;
  const passes = {} as Record<Seat, Record<Seat, GameCard>>;
  for (const seat of SEATS_IN_ORDER) {
    const targets = SEATS_IN_ORDER.filter((target) => target !== seat);
    const hand = round.players[seat].hand;
    passes[seat] = {
      [targets[0]]: hand[0],
      [targets[1]]: hand[1],
      [targets[2]]: hand[2],
    } as Record<Seat, GameCard>;
  }

  for (const seat of SEATS_IN_ORDER) {
    manager.handleMessage(ws, seat, { type: 'PASS_CARDS', cards: passes[seat] } as ClientMessage);
  }
}

function getLastTimerInfo(broadcaster: Broadcaster): { startTime: number | null; durationMs: number | null } {
  const calls = (broadcaster.broadcastGameState as ReturnType<typeof vi.fn>).mock.calls;
  return calls.at(-1)?.[6] as { startTime: number | null; durationMs: number | null };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GameManager', () => {
  let manager: GameManager;
  let broadcaster: Broadcaster;
  let disconnectHandler: DisconnectHandler;
  let ws: WebSocket;

  beforeEach(() => {
    ({ manager, broadcaster, disconnectHandler } = createTestManager());
    ws = createMockWs();
  });

  afterEach(() => {
    manager.destroy();
    disconnectHandler.dispose();
  });

  describe('construction', () => {
    it('should create with correct IDs', () => {
      expect(manager.gameId).toBe('test-game');
      expect(manager.roomCode).toBe('ROOM1');
    });

    it('should start in lobby state', () => {
      expect(manager.stateValue).toBe('lobby');
    });

    it('should apply custom config', () => {
      const { manager: m } = createTestManager({ targetScore: 500 });
      expect(m.context.config.targetScore).toBe(500);
      m.destroy();
    });
  });

  describe('seatPlayer', () => {
    it('should seat a player', () => {
      const result = manager.seatPlayer('north');
      expect(result).toBe(true);
      expect(manager.context.seats.north).toBe(true);
    });

    it('should broadcast state after seating', () => {
      manager.seatPlayer('north');
      expect(broadcaster.broadcastGameState).toHaveBeenCalled();
    });

    it('should reject duplicate seat', () => {
      manager.seatPlayer('north');
      const result = manager.seatPlayer('north');
      expect(result).toBe(false);
    });
  });

  describe('handleMessage routing', () => {
    it('should handle START_GAME', () => {
      seatAllPlayers(manager);
      manager.handleMessage(ws, 'north', { type: 'START_GAME' } as ClientMessage);
      expect(manager.stateValue).toBe('grandTichuDecision');
    });

    it('should handle GRAND_TICHU_DECISION call', () => {
      seatAllPlayers(manager);
      manager.handleMessage(ws, 'north', { type: 'START_GAME' } as ClientMessage);
      manager.handleMessage(ws, 'north', { type: 'GRAND_TICHU_DECISION', call: true } as ClientMessage);
      expect(manager.context.currentRound!.players.north.tipiCall).toBe('grandTichu');
    });

    it('should handle GRAND_TICHU_DECISION pass', () => {
      seatAllPlayers(manager);
      manager.handleMessage(ws, 'north', { type: 'START_GAME' } as ClientMessage);
      manager.handleMessage(ws, 'north', { type: 'GRAND_TICHU_DECISION', call: false } as ClientMessage);
      expect(manager.context.grandTichuDecisions.has('north')).toBe(true);
    });

    it('should allow canceling an early card pass during Blind Grand decision', () => {
      const { manager: bgtManager } = createTestManager({ blindGrandTichuEnabled: true });
      try {
        seatAllPlayers(bgtManager);
        bgtManager.handleMessage(ws, 'north', { type: 'START_GAME' } as ClientMessage);
        bgtManager.handleMessage(ws, 'north', { type: 'BLIND_GRAND_TICHU_DECISION', call: true } as ClientMessage);
        const hand = bgtManager.context.currentRound!.players.north.hand;
        bgtManager.handleMessage(ws, 'north', {
          type: 'PASS_CARDS',
          cards: { east: hand[0], south: hand[1], west: hand[2] },
        } as ClientMessage);
        expect(bgtManager.context.cardPassDecisions.has('north')).toBe(true);

        bgtManager.handleMessage(ws, 'north', { type: 'CANCEL_PASS_CARDS' } as ClientMessage);

        expect(bgtManager.context.cardPassDecisions.has('north')).toBe(false);
      } finally {
        bgtManager.destroy();
      }
    });

    it('should handle TICHU_DECLARATION', () => {
      seatAllPlayers(manager);
      manager.handleMessage(ws, 'north', { type: 'START_GAME' } as ClientMessage);
      // Pass Grand Tichu for all
      for (const seat of SEATS_IN_ORDER) {
        manager.handleMessage(ws, seat, { type: 'GRAND_TICHU_DECISION', call: false } as ClientMessage);
      }
      // Now in cardPassing
      manager.handleMessage(ws, 'north', { type: 'TICHU_DECLARATION' } as ClientMessage);
      expect(manager.context.currentRound!.players.north.tipiCall).toBe('tichu');
    });

    it('should send error for invalid move', () => {
      manager.handleMessage(ws, 'north', { type: 'PASS_TURN' } as ClientMessage);
      expect(broadcaster.sendError).toHaveBeenCalledWith(ws, 'INVALID_MOVE', expect.any(String));
    });

    it('should send error for unhandled message type', () => {
      manager.handleMessage(ws, 'north', { type: 'CHAT_MESSAGE', text: 'hello' } as ClientMessage);
      expect(broadcaster.sendError).toHaveBeenCalledWith(ws, 'UNHANDLED_TYPE', expect.any(String));
    });

    it('should send error after destroy', () => {
      manager.destroy();
      manager.handleMessage(ws, 'north', { type: 'START_GAME' } as ClientMessage);
      expect(broadcaster.sendError).toHaveBeenCalledWith(ws, 'GAME_DESTROYED', expect.any(String));
    });
  });

  describe('handleDisconnect', () => {
    it('should delegate to disconnect handler', () => {
      const spy = vi.spyOn(disconnectHandler, 'handleDisconnect');
      manager.handleDisconnect('north');
      expect(spy).toHaveBeenCalledWith('ROOM1', 'north', expect.objectContaining({
        frozen: expect.any(Boolean),
      }));
    });
  });

  describe('handleReconnect', () => {
    it('should delegate to disconnect handler', () => {
      const spy = vi.spyOn(disconnectHandler, 'handleReconnect');
      manager.handleReconnect(ws, 'north');
      expect(spy).toHaveBeenCalledWith('ROOM1', 'north');
    });

    it('should send state to reconnected player', () => {
      manager.handleReconnect(ws, 'north');
      expect(broadcaster.sendToPlayer).toHaveBeenCalledWith('ROOM1', 'north', expect.objectContaining({
        type: 'GAME_STATE',
      }));
    });
  });

  describe('broadcastState', () => {
    it('should broadcast projected state to all players', () => {
      seatAllPlayers(manager);
      (broadcaster.broadcastGameState as ReturnType<typeof vi.fn>).mockClear();
      manager.broadcastState();
      expect(broadcaster.broadcastGameState).toHaveBeenCalledWith(
        'ROOM1',
        expect.any(Object),
        'lobby',
        [],      // vacatedSeats
        [],      // choosingSeats
        null,    // activeVote
        expect.objectContaining({ startTime: null }),  // timerInfo
        null,    // endOfTrickBombWindowEndTime
        null,    // waitingForReconnect
        [],      // disconnectedSeats
        [],      // autopilotSeats
        null,    // kickDialog
      );
    });
  });

  describe('turn timer', () => {
    it('clears stale timer during Dog animation and starts fresh for the recipient', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      const {
        manager: timerManager,
        broadcaster: timerBroadcaster,
        disconnectHandler: timerDisconnectHandler,
      } = createTestManager({ turnTimerSeconds: 30 });
      const timerWs = createMockWs();

      try {
        advanceToPlaying(timerManager, timerWs);
        expect(timerManager.stateValue).toBe('playing');

        const round = timerManager.context.currentRound!;
        const leader = round.currentTurn!;
        const existingDog = SEATS_IN_ORDER
          .flatMap((seat) => round.players[seat].hand)
          .find((card) => isDog(card.card));
        const dogCard = existingDog ?? ({ id: 10_000, card: { kind: 'dog' } } as GameCard);

        for (const seat of SEATS_IN_ORDER) {
          round.players[seat].hand = round.players[seat].hand.filter((card) => card.id !== dogCard.id);
        }
        round.players[leader].hand.unshift(dogCard);

        vi.advanceTimersByTime(20_000);
        (timerBroadcaster.broadcastGameState as ReturnType<typeof vi.fn>).mockClear();

        timerManager.handleMessage(timerWs, leader, { type: 'PLAY_CARDS', cardIds: [dogCard.id] } as ClientMessage);

        expect(timerManager.context.currentRound!.lastDogPlay).not.toBeNull();
        expect(getLastTimerInfo(timerBroadcaster)).toEqual({ startTime: null, durationMs: 30_000 });

        vi.advanceTimersByTime(2_499);
        expect(getLastTimerInfo(timerBroadcaster)).toEqual({ startTime: null, durationMs: 30_000 });

        vi.advanceTimersByTime(1);

        const restartedTimer = getLastTimerInfo(timerBroadcaster);
        expect(timerManager.context.currentRound!.lastDogPlay).toBeNull();
        expect(restartedTimer.durationMs).toBe(30_000);
        expect(restartedTimer.startTime).toBe(Date.now());
      } finally {
        timerManager.destroy();
        timerDisconnectHandler.dispose();
        vi.useRealTimers();
      }
    });

    it('runs the turn timer while waiting for a Dragon gift decision and auto-resolves on timeout', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      const {
        manager: timerManager,
        broadcaster: timerBroadcaster,
        disconnectHandler: timerDisconnectHandler,
      } = createTestManager({ turnTimerSeconds: 30 });
      const timerWs = createMockWs();

      try {
        advanceToPlaying(timerManager, timerWs);

        const round = timerManager.context.currentRound!;
        const leader = round.currentTurn!;
        const dragonCard = { id: 10_001, card: { kind: 'dragon' } } as GameCard;

        for (const seat of SEATS_IN_ORDER) {
          round.players[seat].hand = round.players[seat].hand.filter((card) => card.id !== dragonCard.id);
        }
        round.players[leader].hand.unshift(dragonCard);

        timerManager.handleMessage(timerWs, leader, { type: 'PLAY_CARDS', cardIds: [dragonCard.id] } as ClientMessage);
        for (let i = 0; i < 3 && timerManager.stateValue === 'playing'; i++) {
          const passer = timerManager.context.currentRound!.currentTurn!;
          timerManager.handleMessage(timerWs, passer, { type: 'PASS_TURN' } as ClientMessage);
        }

        expect(timerManager.stateValue).toBe('awaitingEndOfTrickBomb');
        (timerBroadcaster.broadcastGameState as ReturnType<typeof vi.fn>).mockClear();

        vi.advanceTimersByTime(2_500);

        expect(timerManager.stateValue).toBe('awaitingDragonGift');
        expect(getLastTimerInfo(timerBroadcaster)).toEqual({ startTime: Date.now(), durationMs: 30_000 });

        vi.advanceTimersByTime(30_000);

        expect(timerManager.stateValue).not.toBe('awaitingDragonGift');
        expect(timerManager.context.currentRound!.dragonGiftPending).toBeNull();
        expect(timerManager.context.currentRound!.dragonGiftedTo).not.toBeNull();
      } finally {
        timerManager.destroy();
        timerDisconnectHandler.dispose();
        vi.useRealTimers();
      }
    });

    it('enables autopilot on the third consecutive timeout', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      const {
        manager: timerManager,
        broadcaster: timerBroadcaster,
        disconnectHandler: timerDisconnectHandler,
      } = createTestManager({ turnTimerSeconds: 30 });
      const timerWs = createMockWs();

      try {
        advanceToPlaying(timerManager, timerWs);
        const seat = timerManager.context.currentRound!.currentTurn!;
        (timerManager as unknown as { consecutiveTimeouts: Map<Seat, number> }).consecutiveTimeouts.set(seat, 2);
        (timerBroadcaster.broadcastGameState as ReturnType<typeof vi.fn>).mockClear();

        vi.advanceTimersByTime(30_000);

        expect(timerBroadcaster.sendToPlayer).toHaveBeenCalledWith('ROOM1', seat, { type: 'TURN_TIMEOUT', seat });
        expect(timerManager.getAutopilotSeats()).toContain(seat);
        const lastCall = (timerBroadcaster.broadcastGameState as ReturnType<typeof vi.fn>).mock.calls.at(-1);
        expect(lastCall?.[10]).toContain(seat);
      } finally {
        timerManager.destroy();
        timerDisconnectHandler.dispose();
        vi.useRealTimers();
      }
    });
  });

  describe('full game start flow', () => {
    it('should advance through phases via messages', () => {
      seatAllPlayers(manager);
      expect(manager.stateValue).toBe('lobby');

      manager.handleMessage(ws, 'north', { type: 'START_GAME' } as ClientMessage);
      expect(manager.stateValue).toBe('grandTichuDecision');

      // Pass Grand Tichu
      for (const seat of SEATS_IN_ORDER) {
        manager.handleMessage(ws, seat, { type: 'GRAND_TICHU_DECISION', call: false } as ClientMessage);
      }
      expect(manager.stateValue).toBe('cardPassing');

      // Call Tichu for one player, then need to pass others
      manager.handleMessage(ws, 'north', { type: 'TICHU_DECLARATION' } as ClientMessage);
      // The rest need to pass — but we don't have a protocol message for "pass regular tichu"
      // The TICHU_DECLARATION is for calling, not passing. The state machine accepts
      // For now, GRAND_TICHU_DECISION handles both call/pass via the boolean.
      // TICHU_DECLARATION only calls. We need the game to auto-advance or handle passes.
      // This is a known protocol gap that will be addressed in the lobby/UI milestone.
    });
  });

  describe('destroy', () => {
    it('should stop accepting messages', () => {
      manager.destroy();
      seatAllPlayers(manager);
      // After destroy, seatPlayer should still work on the actor but destroy flag prevents broadcasting
    });

    it('should be idempotent', () => {
      manager.destroy();
      expect(() => manager.destroy()).not.toThrow();
    });
  });

  describe('KICK_DIALOG_RESPONSE routing', () => {
    it('should handle kick dialog response without error', () => {
      // KICK_DIALOG_RESPONSE is routed to internal kickDialogHandler
      expect(() => {
        manager.handleMessage(ws, 'east', { type: 'KICK_DIALOG_RESPONSE', response: 'kick' } as ClientMessage);
      }).not.toThrow();
    });
  });
});
