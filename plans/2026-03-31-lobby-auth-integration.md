# Implementation Plan: Lobby Auth Integration

**Date**: 2026-03-31
**Spec**: specifications/2026-03-31-lobby-auth-integration.md
**Branch**: feature/lobby-auth-integration

## Milestones

### Milestone 1: Server — Username Field & Auth Logic (REQ-F-AU10–AU16, REQ-NF-AU03)

Add `username` column to users table and update registration/login logic.

**Files to modify:**
- `code/packages/server/src/db/schema.ts` — Add `username` column to users table
- `code/packages/server/src/db/connection.ts` — Add `username` column migration in syncSchema
- `code/packages/server/src/auth/account.ts` — Update registerAccount (accept username, validate uniqueness/constraints), update loginAccount (accept username OR email)
- `code/packages/server/src/auth/auth-routes.ts` — Update register/login route handlers to pass username
- `code/packages/server/src/auth/guest.ts` — Update getUserById to return username

**Changes:**
1. Add `username` (text, nullable) to users schema with unique index
2. In `syncSchema`: ALTER TABLE ADD COLUMN username + CREATE UNIQUE INDEX
3. `registerAccount`: accept `username` param, validate (1-30 chars, trimmed, not "bot", unique case-insensitive), store lowercase-trimmed for uniqueness check
4. `loginAccount`: detect if identifier is email (contains @) or username, query accordingly
5. Auth routes: update request body parsing for register (add username) and login (rename email to identifier)
6. `getUserById`: include username in returned object
7. `/api/auth/me`: return username in user object

**Testing:**
- Unit tests for username validation (constraints, "bot" rejection, uniqueness)
- Unit tests for login with username vs email
- Integration test: register → login with username → verify /me returns username

### Milestone 2: Client — Auth Store & Auth Page (REQ-F-AU10, REQ-F-AU14, REQ-F-AU16, REQ-F-LU07)

Update client auth infrastructure to use username.

**Files to modify:**
- `code/packages/client/src/stores/authStore.ts` — Replace displayName with username, add authReady flag
- `code/packages/client/src/app/auth/page.tsx` — Add username field to registration, update login to accept username or email

**Changes:**
1. AuthUser interface: replace `displayName` with `username`
2. Add `authReady: boolean` (starts false, set true in all loadFromStorage paths)
3. Update `register()`: send username instead of displayName
4. Update `login()`: use `identifier` field (username or email)
5. Update `loadFromStorage()`: set authReady=true in success, error, and no-token paths
6. Auth page: add "Username" field to registration form, update login form label to "Username or Email"

### Milestone 3: Client — UserMenu Component & Lobby Integration (REQ-F-LU01–LU06, REQ-F-ID01–ID03)

Create the UserMenu dropdown and integrate auth into the lobby page.

**Files to modify:**
- `code/packages/client/src/components/lobby/UserMenu.tsx` — New dropdown component
- `code/packages/client/src/app/lobby/page.tsx` — Full auth integration

**Changes:**
1. **UserMenu.tsx** (new):
   - Props: `user: { username: string }`, `onLogout: () => void`
   - Gold circle with first initial + username text, transparent background button
   - Click-to-toggle dropdown with "Play Stats" and "Log Out"
   - Close on outside click via ref + document listener

2. **lobby/page.tsx**:
   - Import useAuthStore and UserMenu
   - Call loadFromStorage() on mount; derive isLoggedIn, effectiveUserId, effectivePlayerName
   - Update WebSocket URL to use effective identity
   - Header: show UserMenu when logged in, Stats+SignIn when guest
   - Hide "Your Name" input when logged in
   - Update all handlers (handleCreate, handleJoinByCode, handleJoinRoom, handleJoinAsSpectator) to use effectivePlayerName
   - Logout handler: call logout(), redirect to /auth

### Milestone 4: Client — Home Page Polish & Final Integration (REQ-F-ID03)

Minor polish on home page and end-to-end verification.

**Files to modify:**
- `code/packages/client/src/app/page.tsx` — Auth-aware home page

**Changes:**
1. Load auth state on mount
2. If logged in: change "Sign In / Register" to "Go to Lobby" or similar
3. Verify full flow: register → lobby → create room → play → stats recorded

## Testing Strategy

- **Server tests** (Milestone 1): Vitest unit tests for account.ts validation logic, auth-routes integration tests
- **Client tests** (Milestones 2-3): Vitest + React Testing Library for auth store, UserMenu component, lobby page conditional rendering
- **E2E verification** (Milestone 4): Manual verification of complete flow

## Architecture Notes

- Username stored as-is (preserving case for display) but uniqueness checked case-insensitively via `COLLATE NOCASE` index or `LOWER()` comparison
- Login detection: if identifier contains `@`, treat as email; otherwise treat as username
- WebSocket reconnection on auth load is harmless (lobby just re-fetches room list)
- `authReady` flag prevents flash of guest UI during JWT verification
