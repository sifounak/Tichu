# Conversation: Lobby Auth Integration — Specification

**Date**: 2026-03-31
**Feature**: Lobby Auth Integration (Username Accounts & User Menu)
**Branch**: feature/lobby-auth-integration

## Summary

### Goal
Integrate the existing auth system into the Tichu lobby so logged-in players see their username + icon in the header with a dropdown (Play Stats, Log Out), replacing the manual name input.

### Key Decisions
1. **Username replaces displayName** — username is the primary unique, immutable player identifier throughout the system
2. **Login accepts username OR email** + password
3. **Username constraints**: 1-30 chars, no leading/trailing spaces, cannot be "bot" (case-insensitive), unique (case-insensitive, trimmed)
4. **Logout redirects to /auth** (not stay in lobby as guest)
5. **No guest "Sign In" link** — guest flow will eventually be removed
6. **Player icon**: first-initial gold circle (design customization deferred)
7. **Username is immutable** — users must delete account to change it

### Scope
- Server: Add `username` column to users table, update register/login routes
- Client: auth store `authReady` flag, UserMenu dropdown component, lobby page auth integration, auth page username field, home page minor polish

### Requirements Defined
- REQ-F-AU10 through AU16: Account & auth (username, login, immutability)
- REQ-F-LU01 through LU07: Lobby UI (user menu, dropdown, auth state)
- REQ-F-ID01 through ID03: Identity integration (WebSocket, rooms, stats)
- REQ-NF-AU01 through AU03: Non-functional (performance, security, DB constraints)

### Confidence: High
All requirements are clear, testable, and non-conflicting. Existing auth infrastructure covers most backend needs.

## Transcript

### User (initial request)
Wants to enable player account creation and login with:
- Username, Password, E-mail
- When logged in: name+icon in top-right as button with invisible background
- Remove "Your Name" edit field when logged in
- Stats recorded for the player
- Dropdown menu: Play Stats → stats page, Log Out → logs out

### Exploration Phase
- Explored server architecture: Fastify + ws, SQLite + Drizzle, existing auth routes (guest/register/login/me), player stats system
- Explored client architecture: Next.js 15, React 19, Zustand stores, auth page exists, lobby page does NOT use auth store
- Explored shared types: WebSocket protocol, player identity flow

### Planning Phase
- Approved plan at `plans/groovy-frolicking-torvalds.md`
- Originally scoped as 3-4 client files

### Spec-Builder Clarifications

**Q: Username vs Display Name?**
A: Use "username" as primary unique field. No separate display name — prevents impersonation.

**Q: Logout behavior?**
A: Redirect to auth/home page.

**Q: Guest "Sign In" link?**
A: Skip — guest play will eventually be removed.

**Q: Player icon style?**
A: Defer design decisions, stick with first-initial gold circle.

**Q: Login field?**
A: Accept either username+password or email+password. Username defined at creation, immutable.

**Q: Username constraints?**
A: Cannot be "bot" (case-insensitive). Cannot be unique only due to leading/trailing spaces. 1-30 chars.

**Q: Username in-game?**
A: Yes, username replaces playerName in all contexts.
