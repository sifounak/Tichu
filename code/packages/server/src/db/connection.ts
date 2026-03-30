// REQ-F-AU03: Database connection for game persistence
// REQ-DP-03: SQLite file-based database via better-sqlite3

import { drizzle } from 'drizzle-orm/better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';
import type { Database as BetterSqlite3Database } from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import * as schema from './schema.js';

export interface Database {
  db: ReturnType<typeof drizzle>;
  client: BetterSqlite3Database;
  close(): void;
}

/**
 * Creates a Drizzle database connection using the better-sqlite3 driver.
 * Automatically creates parent directories for the database file.
 * Returns the Drizzle instance, underlying client, and a close function.
 */
export function createDatabase(dbPath: string): Database {
  // Ensure the directory exists
  mkdirSync(dirname(dbPath), { recursive: true });

  const client = new BetterSqlite3(dbPath);

  // Enable WAL mode for better concurrent read performance
  client.pragma('journal_mode = WAL');

  const db = drizzle(client, { schema });

  return {
    db,
    client,
    /** Close the database connection */
    close() {
      client.close();
    },
  };
}
