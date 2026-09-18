# Require Login to Access Lobby and Play

**Date:** 2026-04-26
**Status:** Draft

## Goal

Make the game's home page the login/register form and require authentication to access all other routes. Guest access UI is removed but code is preserved for potential future use.

## Requirements

### R1: Root Page Becomes Login/Register

- The root URL (`/`) renders the login/register form (currently at `/login`)
- Login | Register tab toggle with the same fields as today:
  - Login: identifier (username or email) + password
  - Register: username + email + password
- On successful login/register, redirect to `/lobby`
- If the user is already logged in (`user` non-null after `loadFromStorage()`), auto-redirect to `/lobby`
- The current splash content ("Tichu — A beautiful card game for four players", "Play Now" button) is removed

### R2: Guest Button Hidden

- The "Skip — play as guest" button is removed from the rendered UI
- Guest code remains in the codebase (authStore `initGuest()`, server guest route, etc.) untouched
- Implementation: do not render the guest button JSX (e.g., `false &&` guard or comment out)

### R3: /login Route Deleted

- Delete the `/login` route directory (`app/login/`) entirely
- Update all references to `/login` throughout the client codebase to `/`

### R4: AuthGuard Component

- New component: `AuthGuard`
- Location: `packages/client/src/components/AuthGuard.tsx` (or similar)
- Behavior:
  - Reads `user` and `authReady` from the Zustand auth store
  - While `authReady` is false: shows a loading state (consistent with existing loading patterns)
  - If `authReady` is true and `user` is null: redirect to `/` using Next.js router
  - If `authReady` is true and `user` is non-null: render children

### R5: Protected Routes

All routes except `/` are wrapped in `AuthGuard`:

| Route | Notes |
|---|---|
| `/lobby` | Main lobby |
| `/game/[gameId]` | Active game |
| `/spectate/[gameId]` | Spectator redirect |
| `/profile` | Player profile |
| `/leaderboard` | Was public, now requires login |
| `/stats` | Stats overview |
| `/stats/cards` | Card performance |
| `/stats/history` | Game history |
| `/stats/players` | Player relationships |
| `/stats/tichu` | Tichu call stats |

Each page wraps its content in `<AuthGuard>` explicitly (not via layout-level wrapper).

### R6: Navigation and Redirect Updates

- Logout action redirects to `/` (currently redirects to `/login`)
- All hardcoded `/login` paths in navigation, links, and redirects updated to `/`
- Existing graceful fallbacks in stats pages (redirect to `/lobby` if no userId) remain as-is

## Out of Scope

- Server-side route protection / Next.js middleware
- Changes to WebSocket authentication (server still requires userId + playerName params)
- Changes to server-side guest endpoints or auth routes
- JWT or session management changes
- Any changes to the registration/login server logic

## Approach

**Client-side route guard (AuthGuard component)** — fits the existing Zustand-based auth architecture. The `authReady` flag already prevents UI flash. No server-side changes needed. Guest code stays intact and functional at the server level; only the client UI entry point is removed.
