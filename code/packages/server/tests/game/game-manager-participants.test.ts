import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GameManager } from '../../src/game/game-manager.js';
import type { Broadcaster } from '../../src/ws/broadcaster.js';
import { DisconnectHandler } from '../../src/game/disconnect-handler.js';
import { VoteHandler } from '../../src/game/vote-handler.js';

function createMockBroadcaster(): Broadcaster {
  return {
    send: vi.fn().mockReturnValue(true),
    sendToPlayer: vi.fn().mockReturnValue(true),
    broadcastToRoom: vi.fn().mockReturnValue(3),
    broadcastGameState: vi.fn().mockReturnValue(4),
    broadcastToSpectators: vi.fn().mockReturnValue(0),
    sendError: vi.fn().mockReturnValue(true),
    sendSeatClaimRejected: vi.fn().mockReturnValue(true),
  } as unknown as Broadcaster;
}

describe('GameManager — human participant history', () => {
  let game: GameManager;
  let broadcaster: Broadcaster;
  let disconnectHandler: DisconnectHandler;
  let voteHandler: VoteHandler;

  beforeEach(() => {
    broadcaster = createMockBroadcaster();
    disconnectHandler = new DisconnectHandler(broadcaster);
    voteHandler = new VoteHandler(broadcaster);
    game = new GameManager('1', 'ROOM1', broadcaster, disconnectHandler, voteHandler);
  });

  afterEach(() => {
    game.destroy();
    disconnectHandler.dispose();
  });

  it('isMultiHuman returns false initially', () => {
    expect(game.isMultiHuman()).toBe(false);
  });

  it('isMultiHuman returns false with one human participant', () => {
    game.addHumanParticipant('user-1');
    expect(game.isMultiHuman()).toBe(false);
  });

  it('isMultiHuman returns true with two distinct human participants', () => {
    game.addHumanParticipant('user-1');
    game.addHumanParticipant('user-2');
    expect(game.isMultiHuman()).toBe(true);
  });

  it('adding the same user twice does not double-count', () => {
    game.addHumanParticipant('user-1');
    game.addHumanParticipant('user-1');
    expect(game.isMultiHuman()).toBe(false);
  });

  it('isMultiHuman remains true even after more humans are added', () => {
    game.addHumanParticipant('user-1');
    game.addHumanParticipant('user-2');
    game.addHumanParticipant('user-3');
    expect(game.isMultiHuman()).toBe(true);
  });
});
