// Verifies: REQ-F-PS05/PS06. Reopen migration preserves raw data and changes cache keys.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase, backfillPlayerRoundsUserId } from '../../src/db/connection.js';

describe('Participation migration', () => {
  it('migrates old cache primary/unique keys without deleting all-game rows or raw records', () => {
    const directory = mkdtempSync(join(tmpdir(), 'tichu-participation-'));
    const file = join(directory, 'test.sqlite');
    let database = createDatabase(file);
    try {
      database.client.exec(`INSERT INTO users (id,display_name) VALUES ('a','A');
        INSERT INTO stats_cache (user_id,games_played) VALUES ('a',5);`);
      const definition = (database.client.prepare("SELECT sql FROM sqlite_master WHERE name='stats_cache'").get() as { sql: string }).sql;
      // Simulate the previous user-only primary key while retaining additive columns.
      const oldDefinition = definition.replace(/user_id TEXT NOT NULL/i, 'user_id TEXT PRIMARY KEY')
        .replace(/, PRIMARY KEY\(user_id, participation\)/i, '').replace(/CREATE TABLE "?stats_cache"?/i, 'CREATE TABLE stats_cache_old');
      database.client.exec(oldDefinition);
      database.client.exec(`INSERT INTO stats_cache_old SELECT * FROM stats_cache;
        DROP TABLE stats_cache; ALTER TABLE stats_cache_old RENAME TO stats_cache;`);
      database.close();
      database = createDatabase(file);
      expect(database.client.prepare("SELECT games_played FROM stats_cache WHERE user_id='a' AND participation='all'").get())
        .toEqual({ games_played: 5 });
      expect(() => database.client.exec("INSERT INTO stats_cache (user_id,participation) VALUES ('a','human-only')")).not.toThrow();
      expect(database.client.prepare("SELECT display_name FROM users WHERE id='a'").get()).toEqual({ display_name: 'A' });
    } finally {
      database.close();
      for (const suffix of ['', '-wal', '-shm']) { try { unlinkSync(file + suffix); } catch { /* Already removed by SQLite. */ } }
      rmdirSync(directory);
    }
  });

  it('never backfills recorded bot rounds from a later human final occupant', () => {
    const database = createDatabase(':memory:');
    try {
      database.client.exec(`INSERT INTO users (id,display_name) VALUES ('a','A');
        INSERT INTO games (room_code,winner_team,final_score_ns,final_score_ew,round_count,north_user_id,
          north_name,east_name,south_name,west_name,participation_inferred)
        VALUES ('TEST','NS',1000,500,1,'a','N','E','S','W',0);
        INSERT INTO player_rounds (game_id,round_number,seat,user_id) VALUES (1,1,'north',NULL);`);
      backfillPlayerRoundsUserId(database.client);
      expect(database.client.prepare('SELECT user_id FROM player_rounds').get()).toEqual({ user_id: null });
    } finally { database.close(); }
  });
});
