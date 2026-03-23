# Conversation: Player Vote Feature — Planning Phase

**Date:** 2026-03-22
**Feature:** Player Vote System (Kick Player / Restart Game)
**Phase:** Planning

## Summary

### Milestones (5)
1. **M1:** Shared types + Server VoteHandler — protocol messages, ClientGameView, standalone VoteHandler class
2. **M2:** Server integration — GameStore, GameManager, GameHandler, Broadcaster, StateProjection wiring
3. **M3:** Client store + message handling + Vote UI — Zustand state, WS message handlers, button + dropdown
4. **M4:** VoteOverlay + PlayerSeat glows + result status — dialog component, CSS glows, center status
5. **M5:** Kick & Restart execution + edge cases — vacate/kick, destroy/recreate game, edge case handling

### Key Design Decisions
- VoteHandler modeled after DisconnectHandler (standalone, not in XState)
- Unanimous threshold for all votes (all eligible humans must approve)
- 30s timeout auto-fail
- Reuse existing KICKED message and seat vacancy system for kick execution
- Destroy + recreate GameManager for restart execution
- New glow CSS classes following existing pattern (2-layer box-shadow)

### Files to Create/Modify
- 3 new files (vote-handler.ts, VoteOverlay.tsx, VoteOverlay.module.css)
- 11 modified files across shared/server/client packages
