// Verifies: End-to-end graceful restart cycle
// serialize active games → shutdown → fresh start → restore from DB

import { describe, it, expect, afterEach, vi } from 'vitest';
import { createApp, type App } from '../../src/app.js';
import { SEATS_IN_ORDER } from '@tichu/shared';
import type { ClientMessage } from '@tichu/shared';
import type { WebSocket } from 'ws';
import { unlinkSync } from 'fs';

const TEST_DB = './data/test-restart.sqlite';

function createMockWs(): WebSocket {
  return {
    readyState: 1,
    send: vi.fn(),
    OPEN: 1,
  } as unknown as WebSocket;
}

describe('Graceful restart integration', () => {
  let app: App;

  afterEach(async () => {
    try { await app?.stop(); } catch { /* already stopped */ }
    try { unlinkSync(TEST_DB); } catch { /* may not exist */ }
    try { unlinkSync(TEST_DB + '-wal'); } catch { /* may not exist */ }
    try { unlinkSync(TEST_DB + '-shm'); } catch { /* may not exist */ }
  });

  it('serializes and restores a game in progress', async () => {
    // 1. Create app and start listening
    app = createApp({ port: 0, host: '127.0.0.1', databasePath: TEST_DB });
    await app.start();

    const roomManager = app.roomHandler.roomManager;
    const ws = createMockWs();

    // 2. Create a room with a human host at 'south'
    const hostUserId = 'host-user-1';
    const room = roomManager.createRoom(hostUserId, 'Alice');
    const roomCode = room.roomCode;

    // 3. Fill the other 3 seats with bots
    for (const seat of SEATS_IN_ORDER) {
      if (seat === 'south') continue; // host already seated
      roomManager.addBot(roomCode, seat);
    }

    // 4. Create a game and wire it up
    const manager = app.gameStore.createGame(roomCode, room.config);

    // Seat all players in the game FSM
    for (const seat of SEATS_IN_ORDER) {
      manager.seatPlayer(seat);
    }

    // Register bots in the game manager
    for (const seat of SEATS_IN_ORDER) {
      if (seat === 'south') continue;
      manager.registerBot(seat);
    }

    // Mark room as game-in-progress
    roomManager.startGame(roomCode);

    // Start the game FSM (transitions from lobby → grandTichuDecision)
    manager.handleMessage(ws, 'south', { type: 'START_GAME' } as ClientMessage);

    // 5. Verify the game is running
    const stateBeforeShutdown = manager.stateValue;
    expect(stateBeforeShutdown).toBe('grandTichuDecision');
    expect(app.gameStore.size).toBe(1);
    expect(roomManager.getRoom(roomCode)?.gameInProgress).toBe(true);

    // 6. Graceful shutdown: serialize to DB, then stop
    await app.serializeAndShutdown();

    // 7. Start a fresh app pointed at the same database
    app = createApp({ port: 0, host: '127.0.0.1', databasePath: TEST_DB });
    await app.start();

    // 8. Verify the game was restored
    expect(app.gameStore.size).toBe(1);
    const restoredGame = app.gameStore.getGameByRoom(roomCode);
    expect(restoredGame).toBeDefined();
    expect(restoredGame!.stateValue).toBe(stateBeforeShutdown);
    expect(restoredGame!.gameId).toBe(manager.gameId);

    // 9. Verify the room was restored
    const restoredRoom = app.roomHandler.roomManager.getRoom(roomCode);
    expect(restoredRoom).toBeDefined();
    expect(restoredRoom!.gameInProgress).toBe(true);
    expect(restoredRoom!.players).toHaveLength(4);

    // 10. Verify the host userId mapping was restored
    const restoredHostRoom = app.roomHandler.roomManager.getUserRoom(hostUserId);
    expect(restoredHostRoom).toBe(roomCode);
  });

  it('clears saved state from DB after restore (no double-restore)', async () => {
    // 1. Start app and create a game
    app = createApp({ port: 0, host: '127.0.0.1', databasePath: TEST_DB });
    await app.start();

    const roomManager = app.roomHandler.roomManager;
    const ws = createMockWs();

    const room = roomManager.createRoom('user-2', 'Bob');
    const roomCode = room.roomCode;
    for (const seat of SEATS_IN_ORDER) {
      if (seat === 'south') continue;
      roomManager.addBot(roomCode, seat);
    }

    const manager = app.gameStore.createGame(roomCode, room.config);
    for (const seat of SEATS_IN_ORDER) {
      manager.seatPlayer(seat);
    }
    for (const seat of SEATS_IN_ORDER) {
      if (seat === 'south') continue;
      manager.registerBot(seat);
    }
    roomManager.startGame(roomCode);
    manager.handleMessage(ws, 'south', { type: 'START_GAME' } as ClientMessage);

    // 2. Serialize and shutdown
    await app.serializeAndShutdown();

    // 3. First restart — should restore the game
    app = createApp({ port: 0, host: '127.0.0.1', databasePath: TEST_DB });
    await app.start();
    expect(app.gameStore.size).toBe(1);
    await app.stop();

    // 4. Second restart — DB was cleared, no games restored
    app = createApp({ port: 0, host: '127.0.0.1', databasePath: TEST_DB });
    await app.start();
    expect(app.gameStore.size).toBe(0);
  });

  it('handles restart with no active games gracefully', async () => {
    // 1. Start app with empty database
    app = createApp({ port: 0, host: '127.0.0.1', databasePath: TEST_DB });
    await app.start();

    // No games created — just stop
    await app.stop();

    // 2. Restart — should start fine with no games
    app = createApp({ port: 0, host: '127.0.0.1', databasePath: TEST_DB });
    await app.start();
    expect(app.gameStore.size).toBe(0);
  });
});
