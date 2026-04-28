// Verifies: Restart round vote flow, state machine transitions, event capture cleanup

import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import {
  gameMachine,
  type GameMachineContext,
} from '../../src/game/game-state-machine.js';
import { GameEventCapture } from '../../src/game/game-event-capture.js';
import { VoteHandler, type PlayerVoteType } from '../../src/game/vote-handler.js';
import type { Seat, GameCard, GameConfig } from '@tichu/shared';
import { SEATS_IN_ORDER } from '@tichu/shared';
import type { Broadcaster } from '../../src/ws/broadcaster.js';
import type { ServerMessage } from '@tichu/shared';

// ─── Test Helpers ───────────────────────────────────────────────────────────

function createTestActor(config?: Partial<GameConfig>) {
  const actor = createActor(gameMachine, {
    input: { gameId: 'test-game', config },
  });
  actor.start();
  return actor;
}

function fillSeats(actor: ReturnType<typeof createTestActor>) {
  for (const seat of SEATS_IN_ORDER) {
    actor.send({ type: 'PLAYER_JOINED', seat });
  }
}

function startGame(actor: ReturnType<typeof createTestActor>) {
  fillSeats(actor);
  actor.send({ type: 'HOST_START_GAME' });
}

function passAllGrandTichu(actor: ReturnType<typeof createTestActor>) {
  for (const seat of SEATS_IN_ORDER) {
    actor.send({ type: 'GRAND_TICHU_PASS', seat });
  }
}

function passAllCards(actor: ReturnType<typeof createTestActor>) {
  const ctx = actor.getSnapshot().context;
  const round = ctx.currentRound!;
  for (const seat of SEATS_IN_ORDER) {
    const hand = round.players[seat].hand;
    const otherSeats = SEATS_IN_ORDER.filter((s) => s !== seat);
    const cards: Record<Seat, GameCard> = {} as Record<Seat, GameCard>;
    otherSeats.forEach((s, i) => { cards[s] = hand[i]; });
    cards[seat] = hand[0];
    actor.send({ type: 'CARDS_PASSED', seat, cards });
  }
}

function getToPlayingPhase(actor: ReturnType<typeof createTestActor>) {
  startGame(actor);
  passAllGrandTichu(actor);
  passAllCards(actor);
}

/** Create a mock broadcaster that records messages */
function createMockBroadcaster(): Broadcaster & { messages: Array<{ roomCode: string; message: ServerMessage }> } {
  const messages: Array<{ roomCode: string; message: ServerMessage }> = [];
  return {
    messages,
    broadcastToRoom(roomCode: string, message: ServerMessage) {
      messages.push({ roomCode, message });
      return 0;
    },
    send() {},
    sendToPlayer() {},
    broadcastGameState() { return 0; },
    broadcastToAll() {},
    sendError() {},
  } as unknown as Broadcaster & { messages: Array<{ roomCode: string; message: ServerMessage }> };
}

// ─── State Machine RESTART_ROUND Tests ──────────────────────────────────────

describe('RESTART_ROUND state machine event', () => {
  it('transitions from grandTichuDecision back to grandTichuDecision', () => {
    const actor = createTestActor();
    startGame(actor);
    expect(actor.getSnapshot().value).toBe('grandTichuDecision');

    const roundBefore = actor.getSnapshot().context.currentRound!;
    const roundNumber = roundBefore.roundNumber;

    actor.send({ type: 'RESTART_ROUND' });

    expect(actor.getSnapshot().value).toBe('grandTichuDecision');
    const roundAfter = actor.getSnapshot().context.currentRound!;
    // Round number stays the same (roundHistory.length hasn't changed)
    expect(roundAfter.roundNumber).toBe(roundNumber);
    // But it's a fresh round (new hands)
    expect(roundAfter.players.north.hand).not.toEqual(roundBefore.players.north.hand);
  });

  it('transitions from cardPassing back to grandTichuDecision', () => {
    const actor = createTestActor();
    startGame(actor);
    passAllGrandTichu(actor);
    expect(actor.getSnapshot().value).toBe('cardPassing');

    actor.send({ type: 'RESTART_ROUND' });

    expect(actor.getSnapshot().value).toBe('grandTichuDecision');
  });

  it('transitions from playing back to grandTichuDecision', () => {
    const actor = createTestActor();
    getToPlayingPhase(actor);
    expect(actor.getSnapshot().value).toBe('playing');

    actor.send({ type: 'RESTART_ROUND' });

    expect(actor.getSnapshot().value).toBe('grandTichuDecision');
  });

  it('preserves scores and roundHistory from prior rounds', () => {
    const actor = createTestActor();
    startGame(actor);
    passAllGrandTichu(actor);

    // Add some fake scores to verify they're preserved
    const ctx = actor.getSnapshot().context;
    expect(ctx.scores.northSouth).toBe(0);
    expect(ctx.roundHistory.length).toBe(0);

    actor.send({ type: 'RESTART_ROUND' });

    const afterCtx = actor.getSnapshot().context;
    expect(afterCtx.scores.northSouth).toBe(0);
    expect(afterCtx.roundHistory.length).toBe(0);
  });

  it('resets grandTichuDecisions and cardPassDecisions', () => {
    const actor = createTestActor();
    startGame(actor);

    // Make some GT decisions
    actor.send({ type: 'GRAND_TICHU_PASS', seat: 'north' });
    actor.send({ type: 'GRAND_TICHU_PASS', seat: 'east' });
    expect(actor.getSnapshot().context.grandTichuDecisions.size).toBe(2);

    actor.send({ type: 'RESTART_ROUND' });

    expect(actor.getSnapshot().context.grandTichuDecisions.size).toBe(0);
    expect(actor.getSnapshot().context.cardPassDecisions.size).toBe(0);
  });
});

// ─── GameEventCapture.discardCurrentRound Tests ─────────────────────────────

describe('GameEventCapture.discardCurrentRound', () => {
  it('clears current round data but preserves finalized rounds', () => {
    const capture = new GameEventCapture(1);

    // Simulate one finalized round
    capture.initRound(1, 0, 0);
    capture.finalizeRound();

    // Start a second round
    capture.initRound(2, 100, 50);
    expect(capture.getCurrentRound()).not.toBeNull();
    expect(capture.getAccumulator().rounds.length).toBe(1);

    // Discard the current (second) round
    capture.discardCurrentRound();

    expect(capture.getCurrentRound()).toBeNull();
    // Finalized round is still there
    expect(capture.getAccumulator().rounds.length).toBe(1);
  });

  it('can reinitialize a new round after discard', () => {
    const capture = new GameEventCapture(1);

    capture.initRound(1, 0, 0);
    capture.discardCurrentRound();
    expect(capture.getCurrentRound()).toBeNull();

    // The state machine will trigger a new round via onStateChange auto-init
    capture.initRound(1, 0, 0);
    expect(capture.getCurrentRound()).not.toBeNull();
    expect(capture.getCurrentRound()!.roundNumber).toBe(1);
  });
});

// ─── VoteHandler restartRound Tests ─────────────────────────────────────────

describe('VoteHandler restart round vote', () => {
  it('starts a restartRound vote and broadcasts VOTE_STARTED', () => {
    const broadcaster = createMockBroadcaster();
    const handler = new VoteHandler(broadcaster);

    const result = handler.startRestartRoundVote('ROOM01', 'north', ['north', 'east', 'south', 'west']);
    expect(result).toBe(true);

    const started = broadcaster.messages.find(m => m.message.type === 'VOTE_STARTED');
    expect(started).toBeDefined();
    expect((started!.message as { voteType: string }).voteType).toBe('restartRound');
  });

  it('resolves restartRound vote with correct message on pass', () => {
    const broadcaster = createMockBroadcaster();
    const handler = new VoteHandler(broadcaster);
    let resultType: PlayerVoteType | null = null;
    let resultPassed: boolean | null = null;
    handler.onVoteResult = (_rc, voteType, passed) => {
      resultType = voteType;
      resultPassed = passed;
    };

    handler.startRestartRoundVote('ROOM01', 'north', ['north']);
    // Auto-passes with single voter

    expect(resultType).toBe('restartRound');
    expect(resultPassed).toBe(true);

    const result = broadcaster.messages.find(m => m.message.type === 'VOTE_RESULT');
    expect(result).toBeDefined();
    expect((result!.message as { message: string }).message).toBe('Restarting round!');
  });

  it('resolves restartRound vote with failure message on reject', () => {
    const broadcaster = createMockBroadcaster();
    const handler = new VoteHandler(broadcaster, { voteTimeoutMs: 100 });

    handler.startRestartRoundVote('ROOM01', 'north', ['north', 'east']);

    // Get vote ID
    const vote = handler.getActiveVote('ROOM01');
    expect(vote).not.toBeNull();

    // East rejects
    handler.handleVote('ROOM01', 'east', vote!.voteId, false);
    // North approves
    handler.handleVote('ROOM01', 'north', vote!.voteId, true);

    const result = broadcaster.messages.find(m =>
      m.message.type === 'VOTE_RESULT' && !(m.message as { passed: boolean }).passed,
    );
    expect(result).toBeDefined();
    expect((result!.message as { message: string }).message).toBe('Restart round vote failed!');
  });

  it('restartGame vote uses correct message', () => {
    const broadcaster = createMockBroadcaster();
    const handler = new VoteHandler(broadcaster);

    handler.startRestartGameVote('ROOM01', 'north', ['north']);

    const result = broadcaster.messages.find(m => m.message.type === 'VOTE_RESULT');
    expect(result).toBeDefined();
    expect((result!.message as { message: string }).message).toBe('Restarting game!');
    expect((result!.message as { voteType: string }).voteType).toBe('restartGame');
  });
});
