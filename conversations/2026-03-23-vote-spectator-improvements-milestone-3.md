# Conversation: Vote & Spectator Improvements — Milestone 3

**Date:** 2026-03-23
**Phase:** Implementation — M3
**Branch:** feature/player-vote-kick-restart

## Summary

### Changes Made
1. **Server: Remove gameInProgress guard** (room-manager.ts:179): `addBot()` now works mid-game. Occupied-seat check at line 184 is sufficient.
2. **Server: Mid-game bot integration** (room-handler.ts:295-301): After `addBot()` succeeds during active game, calls `game.registerBot()` + `game.handleSeatFilled()` to integrate bot into game and resume play.
3. **Client: PlayerSeat "Add Bot" button** (PlayerSeat.tsx:228-243): Added `onAddBot` prop. When provided and seat is vacated, renders gold "Add Bot" button below "Waiting for player to join".
4. **Client: GameTable passthrough** (GameTable.tsx:37,47,151): Added `onAddBot` prop, passes to PlayerSeat for vacated seats.
5. **Client: Game page** (page.tsx:1085): Passes `onAddBot` to GameTable when player is host (mySeatFromRoom === hostSeat).

### Requirements Addressed
- REQ-F-VI03: Allow addBot during active game
- REQ-F-VI04: Mid-game bot integration
- REQ-F-VI05: Host "Add Bot" button on vacated seats
