# Conversation: Vote & Spectator Improvements — Specification

**Date:** 2026-03-22
**Phase:** Specification
**Branch:** feature/player-vote-kick-restart

## Summary

Defined specification for 8 changes to the voting and spectator systems:

### Key Decisions
1. **Bot kick bug root cause**: Bots have no userId in `seatToUser` map, so `getUserIdAtSeat()` returns undefined in the kick vote callback. The bot is never removed from `room.players`.
2. **Pre-game voting**: User chose real vote system (unanimous approval) over host-only kick shortcut. Requires room-level VoteHandler instance in RoomHandler.
3. **Message routing**: New `PRE_GAME_KICK_VOTE` and `PRE_GAME_VOTE` message types to avoid conflicts with in-game `START_KICK_VOTE` and `PLAYER_VOTE` routed through GameHandler.
4. **Spectator vote view**: Read-only VoteOverlay with `readOnly` prop — shows vote info but no voting buttons.
5. **Mid-game add bot**: Remove `gameInProgress` guard from `addBot()`, then call `registerBot()` + `handleSeatFilled()` to integrate bot into active game.
6. **UI positioning**: Both Spectators popup and Start a Vote dropdown repositioned from below-button to right-of-button (left: 100%, top: 0).

### Requirements
- 18 functional requirements (REQ-F-VI01 through REQ-F-VI18)
- 3 non-functional requirements (REQ-NF-VI01 through REQ-NF-VI03)
- Confidence: High

### Specification File
`specifications/2026-03-22-vote-spectator-improvements.md`
