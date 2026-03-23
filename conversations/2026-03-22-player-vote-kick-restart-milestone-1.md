# Conversation: Player Vote Feature — Milestone 1

**Date:** 2026-03-22
**Milestone:** M1 — Shared types + Server VoteHandler

## Summary

### What Was Implemented
1. **protocol.ts** — Added 6 new message schemas:
   - Client→Server: START_KICK_VOTE, START_RESTART_VOTE, PLAYER_VOTE
   - Server→Client: VOTE_STARTED, VOTE_UPDATE, VOTE_RESULT
2. **game.ts** — Added `activeVote` field to ClientGameView interface
3. **vote-handler.ts** — New standalone VoteHandler class:
   - Session management (one vote per room)
   - startKickVote() / startRestartVote() with eligible voter calculation
   - handleVote() with real-time VOTE_UPDATE broadcasts
   - resolveVote() with unanimous threshold evaluation
   - cancelVote() for initiator disconnect
   - getActiveVote() for state projection
   - 30s timeout auto-fail
   - Single-human auto-pass

### Key Decisions
- VoteHandler follows DisconnectHandler pattern exactly (standalone, Map-based sessions, callback)
- Kick vote success message left empty — GameManager will set it with player name
- Timeout placeholder overwritten after session creation (avoids double assignment)

### Test Results
- TypeScript compilation: all 3 packages pass (shared, server, client)
