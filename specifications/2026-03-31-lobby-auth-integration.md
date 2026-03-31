# Specification: Lobby Auth Integration — Username Accounts & User Menu

**Date**: 2026-03-31
**Type**: Feature
**Status**: Draft
**Confidence**: High

## 1. Goal

Integrate the existing authentication system into the Tichu lobby so that registered players see their username and player icon in the lobby header (replacing the manual name input), with a dropdown menu for accessing stats and logging out. Introduce `username` as the primary unique, immutable player identifier that replaces `displayName` throughout the system.

### Why

- Players need persistent identity tied to stats tracking
- The manual "Your Name" input in the lobby is ad-hoc and allows impersonation
- Username uniqueness prevents confusion between players

## 2. Scope

### In Scope

- Add `username` column to users table (unique, immutable for registered users)
- Update registration to require username + email + password
- Update login to accept (username OR email) + password
- Lobby header: show user icon + username with dropdown menu when logged in
- Lobby: hide "Your Name" input when logged in
- Dropdown menu: "Play Stats" and "Log Out"
- Logout redirects to auth/home page
- Username used as playerName in all game contexts (rooms, game table, stats)
- Add `authReady` flag to auth store to prevent UI flash on page load

### Out of Scope

- Guest "Sign In" link in lobby (guest flow will be removed later)
- Avatar/icon customization (deferred — use first-initial circle for now)
- Username change functionality (username is immutable; delete account to change)
- Password reset / account recovery flow
- Removing guest play

## 3. Requirements

### Functional Requirements

#### Account & Auth

| ID | Requirement | Acceptance Criteria |
|----|------------|-------------------|
| REQ-F-AU10 | Registration requires username, email, and password | Registration fails if any field is missing; all three stored in DB |
| REQ-F-AU11 | Username must be unique (case-insensitive, trimmed) | Registration fails with clear error if username already taken; leading/trailing spaces stripped before comparison |
| REQ-F-AU12 | Username cannot be "bot" (case-insensitive) | Registration rejects "bot", "Bot", "BOT", etc. with clear error |
| REQ-F-AU13 | Username constraints: 1-30 characters, no leading/trailing spaces | Registration validates length and trims input |
| REQ-F-AU14 | Login accepts (username OR email) + password | User can log in with either field; server detects which was provided |
| REQ-F-AU15 | Username is immutable after account creation | No API endpoint or UI to change username |
| REQ-F-AU16 | Username replaces displayName as the player identity | All references to displayName in auth flows use username instead |

#### Lobby UI

| ID | Requirement | Acceptance Criteria |
|----|------------|-------------------|
| REQ-F-LU01 | When logged in, "Your Name" input is hidden | Input element not rendered when auth store has a registered user |
| REQ-F-LU02 | When logged in, top-right shows user icon + username as a button with transparent background | Button visible with gold initial circle + username text; no visible background |
| REQ-F-LU03 | Clicking user button opens a dropdown menu | Dropdown appears below button with 2 items |
| REQ-F-LU04 | Dropdown item "Play Stats" navigates to /stats | Clicking navigates to the stats page for the logged-in user |
| REQ-F-LU05 | Dropdown item "Log Out" logs out and redirects to auth page | Auth state cleared, token removed, user redirected to /auth |
| REQ-F-LU06 | Dropdown closes when clicking outside | Click-outside listener dismisses the dropdown |
| REQ-F-LU07 | Auth state loads on lobby mount without UI flash | `authReady` flag prevents rendering guest UI while JWT is being verified |

#### Identity Integration

| ID | Requirement | Acceptance Criteria |
|----|------------|-------------------|
| REQ-F-ID01 | WebSocket connects with authenticated user's userId and username | WS URL uses auth store userId and username when logged in |
| REQ-F-ID02 | CREATE_ROOM and JOIN_ROOM use username as playerName | Room player list shows username, not a manually entered name |
| REQ-F-ID03 | Game stats recorded against authenticated userId | Completed games associate the registered user's userId in game records |

### Non-Functional Requirements

| ID | Requirement | Acceptance Criteria |
|----|------------|-------------------|
| REQ-NF-AU01 | Auth token verification completes within 500ms on page load | No perceptible delay before user menu appears |
| REQ-NF-AU02 | Password hashed with bcrypt (existing, 10 rounds) | No plaintext passwords stored |
| REQ-NF-AU03 | Username uniqueness enforced at DB level | UNIQUE constraint on username column |

## 4. Assumptions

1. The existing auth backend (JWT, bcrypt, auth routes, users table) is functional and tested
2. Guests continue to use the current ad-hoc flow (sessionStorage guest ID + manual name input)
3. SQLite supports adding a nullable unique column via ALTER TABLE (it does)
4. The existing player stats system correctly ties stats to userId (it does)

## 5. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Existing users have no username | Low | Medium | Username column is nullable; only required for new registrations. Existing guest records unaffected |
| Username collisions with existing displayNames | Low | Low | Username is a new field; no migration of old displayName values needed |
| WebSocket reconnection flicker on auth load | Medium | Low | Accept harmless reconnect; authReady flag prevents UI flash |

## 6. Success Metrics

1. A new user can register with username/email/password and see their username in the lobby header
2. Login works with both username+password and email+password
3. The "Your Name" input is not visible when logged in
4. Dropdown menu correctly navigates to stats and logs out (redirecting to /auth)
5. Game stats are recorded against the registered user's persistent userId
6. Username uniqueness is enforced (case-insensitive, trimmed)
7. Page refresh restores logged-in state from JWT without UI flash

## 7. Files to Modify

### Server
- `code/packages/server/src/db/schema.ts` — Add `username` column to users table
- `code/packages/server/src/db/connection.ts` — Add column migration
- `code/packages/server/src/auth/account.ts` — Update register/login to handle username
- `code/packages/server/src/auth/guest.ts` — No username for guests (nullable)
- `code/packages/server/src/auth/auth-routes.ts` — Update register/login route handlers

### Client
- `code/packages/client/src/stores/authStore.ts` — Add `authReady`, replace displayName with username
- `code/packages/client/src/components/lobby/UserMenu.tsx` — New dropdown component
- `code/packages/client/src/app/lobby/page.tsx` — Integrate auth store, conditional UI
- `code/packages/client/src/app/auth/page.tsx` — Update registration form (username field)
- `code/packages/client/src/app/page.tsx` — Minor: auth-aware home page
