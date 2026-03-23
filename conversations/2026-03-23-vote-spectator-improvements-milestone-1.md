# Conversation: Vote & Spectator Improvements — Milestone 1

**Date:** 2026-03-23
**Phase:** Implementation — M1
**Branch:** feature/player-vote-kick-restart

## Summary

### Changes Made
1. **Bot kick bug fix** (room-handler.ts:504-511): Added else branch in kick vote callback to handle bots. When `getUserIdAtSeat` returns undefined (bot has no userId), checks if target is a bot and calls `removeBot()` to properly remove from `room.players`.
2. **Opaque dropdown** (game page:888): Changed `var(--color-bg-panel)` to `rgb(0,0,0)`
3. **Spectators popup position** (game page:838-840, PreRoomView:498-501): Changed from `top: 100%, left: 0` to `top: 0, left: 100%, marginLeft`
4. **Vote dropdown position** (game page:884-887): Changed from `top: 100%, left: 0` to `top: 0, left: 100%, marginLeft`

### Testing
- TypeScript compilation: server + client both pass cleanly
- Manual testing: bot kick lobby display, popup positioning (to be verified visually)

### Requirements Addressed
- REQ-F-VI01: Bot kick removes from room.players
- REQ-F-VI02: Spectator seating after bot kick (resolved by VI01)
- REQ-F-VI16: Opaque vote dropdown background
- REQ-F-VI17: Spectators popup right-positioned
- REQ-F-VI18: Vote dropdown right-positioned
