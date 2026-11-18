// Verifies: REQ-F-PS05/PS06. Room callbacks persist before round end and rebind after restore.
import { describe, it, expect } from 'vitest';
import { createApp } from '../../src/app.js';
import { GameManager } from '../../src/game/game-manager.js';
import { SEATS_IN_ORDER } from '@tichu/shared';
import { updateCacheAfterGame } from '../../src/db/stats-cache.js';
import { getPlayerProfile } from '../../src/db/queries.js';

describe('Room participation persistence', () => {
  it('persists initial humans, a brief replacement, and restored participant identities immediately', async () => {
    const app = createApp({ databasePath: ':memory:', port: 0 });
    const database = app.database!;
    try {
      database.client.exec("INSERT INTO users (id,display_name) VALUES ('a','A'),('b','B'),('c','C'),('d','D'),('e','E')");
      const roomManager = app.roomHandler.roomManager;
      const room = roomManager.createRoom('a', 'A');
      const others = ['b','c','d'].map(id => ({ id, seat: roomManager.joinRoom(id, room.roomCode, id).seat }));
      const game = app.gameStore.createGame(room.roomCode, room.config);
      app.roomHandler.wireGameCallbacks(game, room.roomCode);
      for (const seat of SEATS_IN_ORDER) game.seatPlayer(seat);
      roomManager.startGame(room.roomCode);
      for (const id of ['a','b','c','d']) game.addHumanParticipant(id);
      const progress = database.client.prepare('SELECT id,participation,participation_inferred FROM games').get() as {
        id: number; participation: string; participation_inferred: number;
      };
      expect(progress).toMatchObject({ participation: 'human-only', participation_inferred: 0 });
      database.client.prepare("INSERT INTO player_rounds (game_id,round_number,seat,user_id) VALUES (?,1,'south','a')").run(progress.id);
      updateCacheAfterGame(database, progress.id);
      expect(getPlayerProfile(database, 'a', 'human-only')?.totalRoundsPlayed).toBe(1);
      const replaced = others[0];
      roomManager.leaveRoom(replaced.id);
      game.handleSeatVacated(replaced.seat);
      roomManager.addBot(room.roomCode, replaced.seat);
      game.registerBot(replaced.seat);
      expect(getPlayerProfile(database, 'a', 'human-only')?.totalRoundsPlayed).toBe(0);
      roomManager.removeBot(room.roomCode, replaced.seat);
      game.handleSeatVacated(replaced.seat);
      roomManager.joinRoom('e', room.roomCode, 'E');
      game.addHumanParticipant('e');
      expect(database.client.prepare('SELECT participation,had_bot FROM games WHERE id=?').get(progress.id))
        .toEqual({ participation: 'mixed', had_bot: 1 });
      const snapshot = game.serialize();
      game.destroy();
      const restored = GameManager.restore(snapshot, app.broadcaster, app.gameStore.disconnectHandler, app.gameStore.voteHandler);
      app.roomHandler.wireGameCallbacks(restored, room.roomCode);
      expect(restored.getEventAccumulator().gameId).toBe(progress.id);
      expect(restored.getParticipationRecord()).toMatchObject({ hadBot: true, inferred: false });
      restored.destroy();
    } finally { await app.stop(); }
  });
});
