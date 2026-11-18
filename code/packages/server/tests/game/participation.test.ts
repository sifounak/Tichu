// Verifies: REQ-F-PS04/PS05. Actual bot registration vs human-owned autopilot; restart.
import { describe, it, expect, vi } from 'vitest';
import { GameManager } from '../../src/game/game-manager.js';
import { DisconnectHandler } from '../../src/game/disconnect-handler.js';
import { VoteHandler } from '../../src/game/vote-handler.js';
import type { Broadcaster } from '../../src/ws/broadcaster.js';

function setup() {
  const broadcaster = { send: vi.fn(), sendToPlayer: vi.fn(), broadcastToRoom: vi.fn(),
    broadcastGameState: vi.fn(), broadcastToSpectators: vi.fn(), sendError: vi.fn() } as unknown as Broadcaster;
  const disconnect = new DisconnectHandler(broadcaster);
  const vote = new VoteHandler(broadcaster);
  return { manager: new GameManager('1', 'ROOM', broadcaster, disconnect, vote), broadcaster, disconnect, vote };
}

describe('Game participation recording', () => {
  it('records human identities and a sticky bot flag, surviving removal and restoration', () => {
    const { manager, broadcaster, disconnect, vote } = setup();
    const callback = vi.fn();
    manager.wireParticipationChangedCallback(callback);
    manager.addHumanParticipant('a');
    manager.addHumanParticipant('a');
    expect(callback).toHaveBeenCalledTimes(1);
    manager.registerBot('east');
    manager.handleSeatVacated('east');
    manager.addHumanParticipant('b');
    const snapshot = manager.serialize();
    manager.destroy();
    const restored = GameManager.restore(snapshot, broadcaster, disconnect, vote);
    try {
      expect(restored.getParticipationRecord()).toEqual({ humanUserIds: ['a','b'], hadBot: true, inferred: false });
      expect(restored.getEventAccumulator().participation?.hadBot).toBe(true);
    } finally { restored.destroy(); }
  });

  it('does not classify human-owned autopilot as a bot participant', () => {
    const { manager } = setup();
    try {
      manager.seatPlayer('north');
      manager.addHumanParticipant('a');
      manager.setAutopilot('north', true);
      expect(manager.getParticipationRecord().hadBot).toBe(false);
    } finally { manager.destroy(); }
  });

  it('marks snapshots without full participation history as inferred', () => {
    const { manager, broadcaster, disconnect, vote } = setup();
    manager.addHumanParticipant('a');
    manager.registerBot('east');
    const snapshot = manager.serialize();
    delete snapshot.participation;
    manager.destroy();
    const restored = GameManager.restore(snapshot, broadcaster, disconnect, vote);
    try { expect(restored.getParticipationRecord()).toMatchObject({ hadBot: true, inferred: true }); }
    finally { restored.destroy(); }
  });
});
