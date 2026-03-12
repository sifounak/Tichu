// REQ-F-AU03: Database connection pool for game persistence

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export type Database = ReturnType<typeof createDatabase>;

/**
 * Creates a Drizzle database connection using the postgres.js driver.
 * Returns both the Drizzle instance and the underlying connection for cleanup.
 */
export function createDatabase(connectionString: string) {
  const client = postgres(connectionString, {
    max: 10, // connection pool size
    idle_timeout: 20,
    connect_timeout: 10,
  });

  const db = drizzle(client, { schema });

  return {
    db,
    client,
    /** Close the connection pool */
    async close() {
      await client.end();
    },
  };
}
