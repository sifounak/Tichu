import { describe, it, expect, vi } from 'vitest';
import { GameManager } from '../../src/game/game-manager.js';
import { DisconnectHandler } from '../../src/game/disconnect-handler.js';
import { VoteHandler } from '../../src/game/vote-handler.js';
import type { Broadcaster } from '../../src/ws/broadcaster.js';
import type { Seat } from '@tichu/shared';

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

function makeManager(): GameManager {
  const broadcaster = createMockBroadcaster();
  const disconnectHandler = new DisconnectHandler(broadcaster);
  const voteHandler = new VoteHandler(broadcaster);
  return new GameManager('1', 'ROOM', broadcaster, disconnectHandler, voteHandler);
}

describe('GameManager.wireSeatUserIdResolver', () => {
  it('forwards the resolver to the underlying GameEventCapture', () => {
    const mgr = makeManager();
    const resolver = (_s: Seat): string | null => 'u_x';
    mgr.wireSeatUserIdResolver(resolver);

    // Verify via reflection that the capture module received the resolver
    const capture = (mgr as unknown as { eventCapture: { seatUserIdResolver: unknown } }).eventCapture;
    expect(capture.seatUserIdResolver).toBe(resolver);

    mgr.destroy();
  });
});
