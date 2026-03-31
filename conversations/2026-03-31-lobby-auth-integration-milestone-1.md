# Conversation: Lobby Auth Integration — Milestone 1

**Date**: 2026-03-31
**Milestone**: 1 — Server Username Field & Auth Logic
**Branch**: feature/lobby-auth-integration

## Summary

### What was implemented
- Added `username` column (nullable, unique) to users table in schema and migration
- Updated `registerAccount` to accept username, validate constraints (1-30 chars, no leading/trailing spaces, not "bot"), check case-insensitive uniqueness
- Updated `loginAccount` to accept identifier (username or email) — detects by `@` presence
- Updated auth routes: register accepts username, login accepts identifier
- Updated `getUserById` to return username field
- Exported `validateUsername` for testability

### Test results
- account.test.ts: 23/23 passed (including 8 new username validation tests)
- auth-routes.test.ts: 22/25 passed (3 pre-existing failures in profile/leaderboard mocks)
- guest.test.ts: 6/6 passed

### Key decisions
- Username stored as-is (preserving case), uniqueness checked via `LOWER()` in SQL
- Login detection: `@` in identifier → email, else → username
- Login error message changed from "Invalid email or password" to "Invalid credentials" (doesn't reveal which field was wrong)
- `displayName` kept in DB for backward compat but set to username for new registrations
