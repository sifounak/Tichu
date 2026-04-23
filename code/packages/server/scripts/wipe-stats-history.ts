// REQ-F-SA14: One-shot operator wipe of game-history / stats tables
//
// Clears the 13 tables that accumulated incorrectly-attributed rows before
// the M1 stats-attribution fix. Preserves users, active_games, and
// active_rooms so current sessions and accounts are unaffected.
//
// Usage:
//   pnpm --filter @tichu/server wipe-stats [--db <path>] [--force]
//
//   --db <path>   Path to the SQLite file. Defaults to the TICHU_DB_PATH
//                 environment variable, else data/tichu.sqlite.
//   --force       Skip the interactive y/N confirmation. Intended for
//                 automated runs and the script's own tests.

import { createInterface } from 'readline';
import type { Database as BetterSqlite3Database } from 'better-sqlite3';
import { createDatabase } from '../src/db/connection.js';

/** Tables wiped by REQ-F-SA14, ordered children-before-parents for FK safety. */
export const WIPE_TABLES = [
  'bomb_events',
  'bomb_inventory',
  'player_rounds',
  'plays',
  'tricks',
  'wish_events',
  'dragon_gift_events',
  'dog_play_events',
  'game_rounds',
  'games',
  'stats_cache',
  'relational_stats_cache',
  'player_global_stats',
] as const;

/** Tables REQ-F-SA14 explicitly preserves. Used only for pre/post reporting. */
export const PRESERVE_TABLES = ['users', 'active_games', 'active_rooms'] as const;

export type WipeTable = typeof WIPE_TABLES[number];
export type PreserveTable = typeof PRESERVE_TABLES[number];

export interface WipeResult {
  before: Record<WipeTable | PreserveTable, number>;
  after: Record<WipeTable | PreserveTable, number>;
}

/**
 * Count rows in each wipe and preserve table. Exported so tests can assert
 * on the report without re-implementing the count logic.
 */
export function countRows(
  client: BetterSqlite3Database,
): Record<WipeTable | PreserveTable, number> {
  const counts = {} as Record<WipeTable | PreserveTable, number>;
  for (const table of [...WIPE_TABLES, ...PRESERVE_TABLES]) {
    const row = client.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
    counts[table] = row.n;
  }
  return counts;
}

/**
 * Perform the wipe in a single transaction with deferred foreign keys so
 * delete order within the transaction is unconstrained. Returns the
 * before/after row counts for reporting.
 */
export function runWipe(client: BetterSqlite3Database): WipeResult {
  const before = countRows(client);
  const wipe = client.transaction(() => {
    client.pragma('defer_foreign_keys = ON');
    for (const table of WIPE_TABLES) {
      client.prepare(`DELETE FROM ${table}`).run();
    }
  });
  wipe();
  const after = countRows(client);
  return { before, after };
}

function parseArgs(argv: string[]): { dbPath: string; force: boolean } {
  let dbPath = process.env.TICHU_DB_PATH ?? 'data/tichu.sqlite';
  let force = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--force') {
      force = true;
    } else if (arg === '--db') {
      const next = argv[i + 1];
      if (!next) throw new Error('--db requires a path argument');
      dbPath = next;
      i++;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { dbPath, force };
}

function promptYN(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

function formatReport(result: WipeResult): string {
  const lines: string[] = [];
  lines.push('Wiped tables:');
  for (const table of WIPE_TABLES) {
    lines.push(`  ${table.padEnd(24)} ${result.before[table]} -> ${result.after[table]}`);
  }
  lines.push('');
  lines.push('Preserved tables:');
  for (const table of PRESERVE_TABLES) {
    lines.push(`  ${table.padEnd(24)} ${result.before[table]} (unchanged)`);
  }
  return lines.join('\n');
}

async function main(): Promise<void> {
  const { dbPath, force } = parseArgs(process.argv.slice(2));
  console.log(`Tichu stats-history wipe (REQ-F-SA14)`);
  console.log(`Database: ${dbPath}`);
  console.log(`Wipes 13 tables: ${WIPE_TABLES.join(', ')}`);
  console.log(`Preserves: ${PRESERVE_TABLES.join(', ')}`);
  console.log('');

  if (!force) {
    const ok = await promptYN('This is irreversible. Continue? (y/N) ');
    if (!ok) {
      console.log('Aborted.');
      process.exit(1);
    }
  }

  const { client, close } = createDatabase(dbPath);
  try {
    const result = runWipe(client);
    console.log(formatReport(result));
  } finally {
    close();
  }
}

// Only run main() when invoked as a script, not when imported by tests.
// import.meta.url is the script URL; process.argv[1] is the entry file.
const invokedAsScript =
  typeof process !== 'undefined'
  && Array.isArray(process.argv)
  && process.argv[1]
  && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop() ?? '');

if (invokedAsScript) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
