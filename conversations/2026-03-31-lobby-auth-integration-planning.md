# Conversation: Lobby Auth Integration — Planning

**Date**: 2026-03-31
**Feature**: Lobby Auth Integration
**Branch**: feature/lobby-auth-integration

## Summary

### Planning Decisions
- **4 milestones**: Server username support → Client auth store/page → Lobby integration → Home page polish
- Username stored as-is for display, uniqueness enforced case-insensitively at DB level
- Login detection: `@` in identifier → email lookup; otherwise → username lookup
- `authReady` flag in auth store prevents flash of guest UI during JWT verification
- WebSocket reconnect on auth load is harmless — accepted rather than modifying the hook

### Key Architecture Choices
- Username column is nullable (guests don't have one)
- No API endpoint for username change (immutable by spec REQ-F-AU15)
- UserMenu is a self-contained component with click-outside dismiss
- Logout redirects to /auth page (not staying in lobby as guest)

### Files Identified
Server: schema.ts, connection.ts, account.ts, auth-routes.ts, guest.ts
Client: authStore.ts, auth/page.tsx, UserMenu.tsx (new), lobby/page.tsx, page.tsx
