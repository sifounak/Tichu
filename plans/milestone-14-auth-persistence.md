# Milestone 14: Auth + Persistence

**Package(s):** server, client
**Requirements:** Guest sessions, optional accounts, game history, leaderboards

## Goal

Implement authentication (guest + optional accounts), database persistence for completed games, and leaderboard display.

## Tasks

### 14.1 Database setup (`packages/server/src/db/`)
- Drizzle ORM schema: users, rooms, games, game_rounds tables
- Migration scripts
- Connection pool configuration

### 14.2 Guest auth (`packages/server/src/auth/guest.ts`)
- Generate session token on first visit
- Store in cookie/localStorage
- Associate with display name
- No registration required to play

### 14.3 Account auth (`packages/server/src/auth/account.ts`)
- Optional registration: email + password (or link guest to account)
- JWT token issuance
- Password hashing (bcrypt)
- Login/logout endpoints

### 14.4 Game persistence
- On game completion: write game record + round scores to DB
- On round completion: write round events to game_rounds
- Player stats: games played, wins, Tichu/Grand Tichu success rates

### 14.5 Leaderboard (`packages/server/src/db/queries.ts`)
- Top players by win rate (minimum games threshold)
- Recent games list
- Player profile stats

### 14.6 Client auth pages
- Login/register pages (optional — can skip and play as guest)
- Profile page: stats, game history
- Leaderboard page

## Tests

- Guest session: create, persist across reconnect
- Account: register, login, logout, duplicate email prevention
- Game persistence: completed game appears in history
- Leaderboard: correct ranking, minimum games filter
- Auth middleware: protected routes, guest access to game

## Verification

1. All tests pass
2. Coverage ≥ 80%
3. E2E: play as guest → register → view stats → leaderboard
