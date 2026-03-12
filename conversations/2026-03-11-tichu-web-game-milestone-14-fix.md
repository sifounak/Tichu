# Milestone 14 Quality Remediation — Conversation Transcript

**Date:** 2026-03-11
**Branch:** `feature/tichu-web-game`

## Summary

Reviewed Milestone 14 (Auth + Persistence) which was implemented under context window exhaustion. Identified and fixed:

### Issues Found
- **12 of 49 M14 tests** exercised zero production code (type-check theater)
- **3 high-severity server bugs**: no transaction in saveGameResult, race conditions in upsertPlayerStats, stale displayName return
- **3 high-severity client bugs**: guest flow never called initGuest, profile page ignored URL params, guest userId not persisted
- **Medium-severity issues**: NaN from parseInt, swallowed errors, orphaned storage, no FK constraints, no runtime shape validation

### Fixes Applied (3 Milestones)

**Milestone 1 — Server Fixes (6 files):**
1. `game-persistence.ts` — Transaction wrapping, atomic ON CONFLICT upsert
2. `guest.ts` — Return passed-in displayName instead of stale cached value
3. `auth-routes.ts` — NaN guards on all parseInt calls
4. `account.ts` — Runtime shape validation in verifyToken
5. `schema.ts` — FK references on games→users, gameRounds→games, playerStats→users
6. `queries.ts` — Removed unused imports

**Milestone 2 — Client Fixes (4 files):**
1. `authStore.ts` — initGuest writes to sessionStorage; loadFromStorage cleans up orphaned user_id
2. `auth/page.tsx` — Skip button calls initGuest with generated ID/name
3. `profile/page.tsx` — Reads ?userId from URL search params; added error state
4. `leaderboard/page.tsx` — Error state; NaN guard on success rates

**Milestone 3 — Test Rewrites (6 files):**
1. `game-persistence.test.ts` — 10 tests (was 6) calling actual functions
2. `queries.test.ts` — 7 tests (was 5) calling actual functions
3. `connection.test.ts` — 2 tests (was 1) with mocked postgres/drizzle
4. `guest.test.ts` — 6 tests (was 4) with fixed assertions
5. `auth-routes.test.ts` — 24 tests (was 20) with happy-path register/login
6. `account.test.ts` — 12 tests (was 5) with registerAccount/loginAccount tests

### Test Results
- Shared: 374 (unchanged)
- Server: 346 (was 326, +20 net)
- Client: 161 (unchanged)
- **Total: 881** (was 861)

### Key Decisions
- Used sessionStorage (not localStorage) for guest userId to keep it ephemeral
- Used PostgreSQL `INSERT ... ON CONFLICT DO UPDATE` with `EXCLUDED` for atomic stat increments
- Profile page supports both own-profile (from storage) and other-player (from URL param)
- Kept all existing passing tests, only replaced/augmented the broken ones
