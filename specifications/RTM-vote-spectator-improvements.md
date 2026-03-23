# Requirements Traceability Matrix: Vote & Spectator Improvements

| Req ID | Description | Milestone | Source File(s) | Test File(s) | Status |
|--------|-------------|-----------|----------------|-------------|--------|
| REQ-F-VI01 | Bot kick removes from room.players | M1 | room-handler.ts:504-511 | Manual | Passed |
| REQ-F-VI02 | Spectator seating after bot kick | M1 | room-handler.ts:504-511 | Manual | Passed |
| REQ-F-VI16 | Opaque vote dropdown background | M1 | game/page.tsx:888 | Manual | Passed |
| REQ-F-VI17 | Spectators popup right-positioned | M1 | game/page.tsx:838, PreRoomView.tsx:498 | Manual | Passed |
| REQ-F-VI18 | Vote dropdown right-positioned | M1 | game/page.tsx:884 | Manual | Passed |
| REQ-F-VI06 | Spectators see vote overlay (read-only) | M2 | VoteOverlay.tsx:28,97, game/page.tsx:1369 | Manual | Passed |
| REQ-F-VI07 | Spectators see vote result | M2 | game/page.tsx:1369 (voteResult already ungated) | Manual | Passed |
| REQ-F-VI03 | Allow addBot during active game | M3 | room-manager.ts:179 | Manual | Passed |
| REQ-F-VI04 | Mid-game bot integration | M3 | room-handler.ts:295-301 | Manual | Passed |
| REQ-F-VI05 | Host "Add Bot" button on vacated seats | M3 | PlayerSeat.tsx:228, GameTable.tsx:151, game/page.tsx:1085 | Manual | Passed |
| REQ-F-VI08 | Pre-game VoteHandler instance | M4 | room-handler.ts:28,38 | Manual | Passed |
| REQ-F-VI09 | Pre-game kick vote messages | M4 | protocol.ts:86-87, room-handler.ts:63-64 | Manual | Passed |
| REQ-F-VI10 | Pre-game kick vote execution | M4 | room-handler.ts:270-293 | Manual | Passed |
| REQ-F-VI11 | Pre-game "Start a Vote" button | M4 | PreRoomView.tsx:529-591 | Manual | Passed |
| REQ-F-VI12 | Pre-game kick target selection | M4 | PreRoomView.tsx:161-175,213,247 | Manual | Passed |
| REQ-F-VI13 | Pre-game vote overlay | M4 | PreRoomView.tsx:806-835 | Manual | Passed |
| REQ-F-VI14 | Pre-game vote — cannot kick self | M4 | room-handler.ts:335 | Manual | Passed |
| REQ-F-VI15 | Pre-game concurrent vote prevention | M4 | room-handler.ts:340 | Manual | Passed |
| REQ-NF-VI01 | Pre-game vote consistency | M4 | room-handler.ts (reuses VoteHandler) | Manual | Passed |
| REQ-NF-VI02 | No message routing conflicts | M4 | protocol.ts (PRE_GAME_* types) | Manual | Passed |
| REQ-NF-VI03 | Clean pre-game vote cleanup | M4 | room-handler.ts:502 | Manual | Passed |
