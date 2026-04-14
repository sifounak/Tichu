import { describe, it, expect } from 'vitest';
import {
  createGameActor,
  createGameActorFromSnapshot,
} from '../../src/game/game-state-machine.js';
import { SEATS_IN_ORDER } from '@tichu/shared';

describe('createGameActorFromSnapshot', () => {
  it('restores actor to the same state', () => {
    const actor = createGameActor('test-game');
    actor.start();
    for (const seat of SEATS_IN_ORDER) {
      actor.send({ type: 'PLAYER_JOINED', seat });
    }
    actor.send({ type: 'HOST_START_GAME' });

    const snapshot = actor.getPersistedSnapshot();
    const contextBefore = actor.getSnapshot().context;
    const stateBefore = actor.getSnapshot().value;

    const restored = createGameActorFromSnapshot(snapshot);
    restored.start();

    expect(restored.getSnapshot().value).toEqual(stateBefore);
    expect(restored.getSnapshot().context.gameId).toBe('test-game');
    expect(restored.getSnapshot().context.scores).toEqual(contextBefore.scores);

    actor.stop();
    restored.stop();
  });

  it('restored actor can continue receiving events', () => {
    const actor = createGameActor('test-game');
    actor.start();
    for (const seat of SEATS_IN_ORDER) {
      actor.send({ type: 'PLAYER_JOINED', seat });
    }
    actor.send({ type: 'HOST_START_GAME' });

    const snapshot = actor.getPersistedSnapshot();
    actor.stop();

    const restored = createGameActorFromSnapshot(snapshot);
    restored.start();

    // Should be in grandTichuDecision — send decisions
    for (const seat of SEATS_IN_ORDER) {
      restored.send({ type: 'GRAND_TICHU_PASS', seat });
    }

    // Should have advanced to cardPassing
    expect(restored.getSnapshot().value).toBe('cardPassing');
    restored.stop();
  });
});
