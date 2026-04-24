// [Stats] Admin script — rebuild stats_cache and relational_stats_cache from
// raw event tables. Use after the back-fill migration (M2) to recompute
// stats for existing games.
//
// Usage:
//   pnpm --filter @tichu/server rebuild-stats [--db <path>] [--force]
//
//   --db <path>   Path to the SQLite file. Defaults to TICHU_DB_PATH env var,
//                 else data/tichu.sqlite.
//   --force       Skip the y/N confirmation prompt.

import { createInterface } from 'readline';
import { createDatabase, type Database } from '../src/db/connection.js';
import { rebuildStatsCache } from '../src/db/stats-cache.js';

export interface RebuildResult {
  usersUpdated: number;
  statsCacheRows: number;
  relationalStatsCacheRows: number;
}

export function runRebuild(database: Database): RebuildResult {
  rebuildStatsCache(database);

  const { client } = database;
  const statsRows = (client.prepare(`SELECT COUNT(*) AS n FROM stats_cache`).get() as { n: number }).n;
  const relRows = (client.prepare(`SELECT COUNT(*) AS n FROM relational_stats_cache`).get() as { n: number }).n;
  return {
    usersUpdated: statsRows,
    statsCacheRows: statsRows,
    relationalStatsCacheRows: relRows,
  };
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

async function main(): Promise<void> {
  const { dbPath, force } = parseArgs(process.argv.slice(2));
  console.log(`Tichu stats-cache rebuild`);
  console.log(`Database: ${dbPath}`);
  console.log('');

  if (!force) {
    const ok = await promptYN('This will drop and rebuild stats_cache + relational_stats_cache. Continue? (y/N) ');
    if (!ok) {
      console.log('Aborted.');
      process.exit(1);
    }
  }

  const database = createDatabase(dbPath);
  try {
    const result = runRebuild(database);
    console.log(`Rebuilt cache for ${result.usersUpdated} users.`);
    console.log(`  stats_cache rows:             ${result.statsCacheRows}`);
    console.log(`  relational_stats_cache rows:  ${result.relationalStatsCacheRows}`);
  } finally {
    database.close();
  }
}

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
