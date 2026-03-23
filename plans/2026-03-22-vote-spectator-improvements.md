# Implementation Plan: Vote & Spectator Improvements

**Date:** 2026-03-22
**Spec:** `specifications/2026-03-22-vote-spectator-improvements.md`
**Branch:** `feature/player-vote-kick-restart`

## Milestones

### M1: Bot Kick Bug Fix + UI Polish
**Requirements:** REQ-F-VI01, REQ-F-VI02, REQ-F-VI16, REQ-F-VI17, REQ-F-VI18

**Files:**
- `code/packages/server/src/room/room-handler.ts` — Add bot-handling else branch in kick vote callback (lines 493-507)
- `code/packages/client/src/app/game/[gameId]/page.tsx` — Opaque dropdown bg (line 888), spectator popup position (lines 837-839), vote dropdown position (lines 884-887)
- `code/packages/client/src/components/game/PreRoomView.tsx` — Spectator popup position (lines 498-500)

**Tasks:**
1. In kick vote callback, add `else` branch: check if target is bot via `room.players.find(p => p.seat === targetSeat)?.isBot`, call `removeBot()`
2. Change dropdown background from `var(--color-bg-panel)` to `rgb(0,0,0)`
3. Change spectators tooltip: `top: 0, left: '100%', marginLeft` (game page + PreRoomView)
4. Change vote dropdown: `top: 0, left: '100%', marginLeft` (game page)

**Testing:** Manual — kick bot via vote, verify lobby shows 3/4 + "Join (In Progress)"; verify popup positions

---

### M2: Spectator Vote Notifications
**Requirements:** REQ-F-VI06, REQ-F-VI07

**Files:**
- `code/packages/client/src/components/game/VoteOverlay.tsx` — Add `readOnly` prop, show spectator message
- `code/packages/client/src/app/game/[gameId]/page.tsx` — Remove `!isSpectator` gate, pass `readOnly={isSpectator}`

**Tasks:**
1. Add `readOnly?: boolean` to VoteOverlayProps
2. When readOnly: hide vote buttons, show "Vote in progress — spectators cannot vote"
3. Remove `!isSpectator` condition on VoteOverlay render (line 1368)
4. Pass `readOnly={isSpectator}`, handle nullable mySeat with fallback `'south'`

**Testing:** Manual — start vote with spectator in room, verify spectator sees read-only overlay + result

---

### M3: Host Add Bot Mid-Game
**Requirements:** REQ-F-VI03, REQ-F-VI04, REQ-F-VI05

**Files:**
- `code/packages/server/src/room/room-manager.ts` — Remove `gameInProgress` guard from `addBot()` (line 182)
- `code/packages/server/src/room/room-handler.ts` — Add mid-game bot integration in `handleAddBot()` (lines 290-310)
- `code/packages/client/src/components/game/PlayerSeat.tsx` — Add `onAddBot` prop + button on vacated seats
- `code/packages/client/src/components/game/GameTable.tsx` — Pass `onAddBot` prop through to PlayerSeat
- `code/packages/client/src/app/game/[gameId]/page.tsx` — Compute isHost, pass `onAddBot` to GameTable

**Tasks:**
1. Remove `if (room.gameInProgress) throw` from `addBot()`
2. In `handleAddBot()`, after addBot succeeds with game in progress: `game.registerBot(seat, difficulty)` + `game.handleSeatFilled(seat)`
3. Add `onAddBot?: () => void` prop to PlayerSeat, render "Add Bot" button in vacated overlay
4. Add `onAddBot?: (seat: Seat) => void` prop to GameTable, pass to PlayerSeat for vacated seats
5. In game page, compute isHost and pass `onAddBot` callback that sends `ADD_BOT` message

**Testing:** Manual — kick player/bot, verify host sees "Add Bot" on vacated seat, click adds bot and game resumes

---

### M4: Pre-Game Kick Voting
**Requirements:** REQ-F-VI08, REQ-F-VI09, REQ-F-VI10, REQ-F-VI11, REQ-F-VI12, REQ-F-VI13, REQ-F-VI14, REQ-F-VI15, REQ-NF-VI01, REQ-NF-VI02, REQ-NF-VI03

**Files:**
- `code/packages/shared/src/types/protocol.ts` — Add PRE_GAME_KICK_VOTE, PRE_GAME_VOTE message types
- `code/packages/server/src/room/room-handler.ts` — Add preGameVoteHandler, register handlers, wire callback
- `code/packages/client/src/components/game/PreRoomView.tsx` — Add Start a Vote button/dropdown, kick target mode, VoteOverlay integration, message handling

**Tasks:**
1. Add `PRE_GAME_KICK_VOTE` and `PRE_GAME_VOTE` to shared protocol types
2. Create `preGameVoteHandler` in RoomHandler constructor
3. Register `PRE_GAME_KICK_VOTE` handler: validate seat, check no active vote, get human seats, start kick vote
4. Register `PRE_GAME_VOTE` handler: forward to preGameVoteHandler
5. Wire `onVoteResult` callback: on kick pass, remove player from room, send KICKED, broadcast update, reset ready
6. Clean up pre-game vote when game starts (REQ-NF-VI03)
7. In PreRoomView: add vote state, Start a Vote button with Kick Player dropdown, kick target mode
8. In PreRoomView: handle VOTE_STARTED/VOTE_UPDATE/VOTE_RESULT messages
9. In PreRoomView: render VoteOverlay during active vote

**Testing:** Manual — in pre-game with 3+ players, initiate kick vote, verify overlay, vote, verify kick execution
