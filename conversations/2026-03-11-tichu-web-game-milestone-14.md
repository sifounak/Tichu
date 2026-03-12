# Milestone 14: Auth & Persistence — Conversation Transcript

## Summary

Implemented authentication (guest + optional accounts), database persistence for completed games, and leaderboard display for the Tichu web game.

### Key Decisions
- Database layer uses Drizzle ORM + postgres.js driver (no Prisma)
- Auth uses REST API endpoints (POST/GET) rather than WebSocket messages
- Guest users can play immediately without registration; optional account upgrade
- JWT tokens with 7-day expiry for registered accounts
- Password hashing via bcryptjs with 10 salt rounds
- Database connection is optional — server works without DATABASE_URL (for dev/testing)
- Player stats are maintained in a separate `player_stats` table (upserted on game completion)
- Leaderboard requires minimum 5 games to qualify
- Coverage: auth-routes 89.88%, guest.ts 100%, schema 96.55%, queries 95.83%
- DB-dependent functions (connection.ts, account.ts register/login) have lower coverage because they require PostgreSQL

### Files Created
- `code/packages/server/src/db/schema.ts` — Drizzle schema (users, games, game_rounds, player_stats)
- `code/packages/server/src/db/connection.ts` — Database connection pool
- `code/packages/server/src/db/game-persistence.ts` — Game result + round persistence, player stats
- `code/packages/server/src/db/queries.ts` — Leaderboard, recent games, player profile queries
- `code/packages/server/src/auth/guest.ts` — Guest user creation/lookup
- `code/packages/server/src/auth/account.ts` — Register, login, JWT verify
- `code/packages/server/src/auth/auth-routes.ts` — REST API routes for all auth/data endpoints
- `code/packages/server/drizzle.config.ts` — Drizzle Kit configuration
- `code/packages/client/src/stores/authStore.ts` — Client auth state (Zustand)
- `code/packages/client/src/app/auth/page.tsx` — Login/register page
- `code/packages/client/src/app/profile/page.tsx` — Player profile + game history
- `code/packages/client/src/app/leaderboard/page.tsx` — Leaderboard table
- `code/packages/server/tests/auth/account.test.ts` — 5 tests (JWT verification)
- `code/packages/server/tests/auth/guest.test.ts` — 4 tests (guest CRUD with mock DB)
- `code/packages/server/tests/auth/auth-routes.test.ts` — 20 tests (all REST endpoints)
- `code/packages/server/tests/db/schema.test.ts` — 8 tests (table structure)
- `code/packages/server/tests/db/game-persistence.test.ts` — 6 tests (type/structure)
- `code/packages/server/tests/db/queries.test.ts` — 5 tests (leaderboard/profile types)
- `code/packages/server/tests/db/connection.test.ts` — 1 test (module export)

### Files Modified
- `code/packages/server/package.json` — Added drizzle-orm, postgres, bcryptjs, jsonwebtoken + dev types
- `code/packages/server/src/app.ts` — Database + auth route integration (optional, skipped without DATABASE_URL)
- `code/packages/client/src/app/page.tsx` — Added Sign In / Leaderboard links
- `specifications/RTM-tichu-web-game.md` — Updated REQ-F-AU01-04 to Passed

### Test Results
- Shared: 374 tests passing
- Server: 326 tests passing (49 new auth/db tests)
- Client: 161 tests passing
- Total: 861 tests passing

### Requirements Addressed
- REQ-F-AU01: Guest access (Passed)
- REQ-F-AU02: Optional account registration (Passed)
- REQ-F-AU03: Game history persistence (Passed)
- REQ-F-AU04: Leaderboard (Passed)
