# ADR-007: SQLite + Drizzle ORM

**Date:** 2026-03
**Status:** Accepted

## Context

The application needs persistent storage for users, games, rounds, and player statistics
(approximately 100 stat fields per player). The storage solution must be simple to set up
for development and adequate for single-server production deployment.

## Decision

Use SQLite via better-sqlite3 for the database and Drizzle ORM for type-safe query
building and schema management.

## Rationale

- SQLite is zero-configuration and stores the entire database in a single file, requiring
  no Docker container or separate database process for development
- Drizzle compiles queries to raw SQL at build time with zero runtime overhead, unlike
  ORMs that construct queries at runtime (e.g., Prisma's query engine)
- Schema is defined in TypeScript alongside the application code, providing compile-time
  type safety from schema definition through query results
- Migrations are managed by drizzle-kit with automatic SQL generation from schema diffs
- SQLite's write-ahead logging (WAL mode) provides adequate concurrency for a
  single-server deployment serving concurrent game rooms
- better-sqlite3 uses synchronous calls, which is simpler to reason about in the
  server's game logic than async database drivers

## Consequences

- Single-server deployment only; migrating to PostgreSQL would be needed if horizontal
  scaling or multi-server deployment becomes a requirement
- Drizzle's PostgreSQL dialect is API-compatible, so migration would primarily involve
  changing the driver and adjusting SQLite-specific pragmas
- No external database infrastructure is needed for development, testing, or deployment
