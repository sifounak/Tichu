# Implementation Plan: Player Vote System (Kick Player / Restart Game)

**Date:** 2026-03-22
**Specification:** `specifications/2026-03-22-player-vote-kick-restart.md`
**Branch:** `feature/player-vote-kick-restart`

## Milestone Overview

| # | Milestone | Requirements | Files |
|---|---|---|---|
| M1 | Shared types + Server VoteHandler | PV20-22 | protocol.ts, game.ts, vote-handler.ts |
| M2 | Server integration | PV22-23, PV25 | game-store.ts, game-manager.ts, game-handler.ts, broadcaster.ts, state-projection.ts |
| M3 | Client store + message handling + Vote UI | PV01-04, PV08 | uiStore.ts, page.tsx |
| M4 | VoteOverlay + PlayerSeat glows + result status | PV05-07, PV09-12 | VoteOverlay.tsx/css, PlayerSeat.tsx/css, page.tsx |
| M5 | Kick & Restart execution + edge cases | PV13-19, PV24-28, NF-PV01-04 | game-manager.ts, game-store.ts, vote-handler.ts, page.tsx |

---

## Milestone 1: Shared Types + Server VoteHandler

**Goal:** Define protocol messages, update ClientGameView, and implement standalone VoteHandler class.

### Tasks
1. Add 3 client message schemas to `protocol.ts`: START_KICK_VOTE, START_RESTART_VOTE, PLAYER_VOTE
2. Add 3 server message schemas to `protocol.ts`: VOTE_STARTED, VOTE_UPDATE, VOTE_RESULT
3. Add `activeVote` field to `ClientGameView` in `game.ts`
4. Create `vote-handler.ts` with VoteHandler class:
   - VoteSession interface and session management
   - `startKickVote()` and `startRestartVote()` methods
   - `handleVote()` with per-vote broadcast
   - `resolveVote()` with threshold evaluation
   - `cancelVote()`, `cleanupRoom()`, `hasActiveVote()`, `getActiveVote()`
   - Timeout handling (30s auto-fail)
   - `onVoteResult` callback

### Files
- **Modify:** `code/packages/shared/src/types/protocol.ts`
- **Modify:** `code/packages/shared/src/types/game.ts`
- **Create:** `code/packages/server/src/game/vote-handler.ts`

### Requirements: REQ-F-PV20, REQ-F-PV21, REQ-F-PV22, REQ-F-PV23, REQ-F-PV15, REQ-NF-PV04

---

## Milestone 2: Server Integration

**Goal:** Wire VoteHandler into GameManager, GameStore, GameHandler, Broadcaster, and StateProjection.

### Tasks
1. Add shared VoteHandler instance to `GameStore` (like disconnectHandler)
2. Pass VoteHandler to `GameManager` constructor
3. Add vote message routing in `GameManager.handleMessage()` switch
4. Wire `onVoteResult` callback stub in GameManager (full execution logic in M5)
5. Add 3 message types to `GAME_MESSAGE_TYPES` in `GameHandler`
6. Add `activeVote` parameter to `broadcastGameState()` in `Broadcaster`
7. Include `activeVote` in `projectGameState()` in `StateProjection`
8. Pass `voteHandler.getActiveVote()` through `broadcastState()` in GameManager

### Files
- **Modify:** `code/packages/server/src/game/game-store.ts`
- **Modify:** `code/packages/server/src/game/game-manager.ts`
- **Modify:** `code/packages/server/src/game/game-handler.ts`
- **Modify:** `code/packages/server/src/ws/broadcaster.ts`
- **Modify:** `code/packages/server/src/ws/state-projection.ts`

### Requirements: REQ-F-PV22, REQ-F-PV23, REQ-F-PV25, REQ-NF-PV01

---

## Milestone 3: Client Store + Message Handling + Vote UI

**Goal:** Add vote state to Zustand store, handle server messages, and implement "Start a Vote" button with dropdown.

### Tasks
1. Add vote state section to `uiStore.ts` (activeVote, voteResult, kickTargetMode, voteCountdown)
2. Handle VOTE_STARTED, VOTE_UPDATE, VOTE_RESULT in page.tsx onMessage
3. Add "Start a Vote" button above "Leave Room" button
4. Implement dropdown with "Kick Player" and "Restart Game" options
5. Implement kick target mode (red glow on seats, click to select, Escape to cancel)
6. Add visibility conditions (mySeat, not spectator, no active vote)

### Files
- **Modify:** `code/packages/client/src/stores/uiStore.ts`
- **Modify:** `code/packages/client/src/app/game/[gameId]/page.tsx`

### Requirements: REQ-F-PV01, REQ-F-PV02, REQ-F-PV03, REQ-F-PV04, REQ-F-PV08

---

## Milestone 4: VoteOverlay + PlayerSeat Glows + Result Status

**Goal:** Implement vote dialog overlay, player seat visual updates during voting, and centered result messages.

### Tasks
1. Create `VoteOverlay.tsx` + `.module.css` — vote dialog with buttons and countdown
2. Add new props to PlayerSeat: kickVoteTarget, playerVoteStatus, playerVoteLabel, hideNormalLabels
3. Add CSS classes: .kickVoteTarget, .voteApprove, .voteReject + vote label styles
4. Wire hideNormalLabels to suppress turn/leader/pass labels during vote
5. Wire vote glow/label props from page.tsx to PlayerSeat via GameTable
6. Add centered vote result overlay in page.tsx (auto-dismiss after 2s)

### Files
- **Create:** `code/packages/client/src/components/game/VoteOverlay.tsx`
- **Create:** `code/packages/client/src/components/game/VoteOverlay.module.css`
- **Modify:** `code/packages/client/src/components/game/PlayerSeat.tsx`
- **Modify:** `code/packages/client/src/components/game/PlayerSeat.module.css`
- **Modify:** `code/packages/client/src/app/game/[gameId]/page.tsx`

### Requirements: REQ-F-PV05, REQ-F-PV06, REQ-F-PV07, REQ-F-PV09, REQ-F-PV10, REQ-F-PV11, REQ-F-PV12, REQ-NF-PV02, REQ-NF-PV03

---

## Milestone 5: Kick & Restart Execution + Edge Cases

**Goal:** Complete vote result execution flows and handle all edge cases.

### Tasks
1. Implement kick execution in GameManager onVoteResult callback:
   - Add target to vacatedSeats
   - Send KICKED message to target's WebSocket
   - Broadcast updated state
2. Implement restart execution in GameManager/GameStore:
   - Add `restartGame()` method to GameStore
   - Destroy current game, create new one with same config
   - Re-seat all players and bots
   - Start game (XState → grandTichuDecision)
   - 2s server-side delay before restart
3. Edge cases:
   - Single human auto-pass (REQ-F-PV24)
   - Concurrent vote prevention with disconnect votes (REQ-F-PV25)
   - Initiator disconnect → cancel vote (REQ-F-PV26)
   - Target disconnect → cancel vote, defer to disconnect handler (REQ-F-PV27)
   - Cannot kick self validation (REQ-F-PV28)
4. Wire disconnect events to cancel active player votes

### Files
- **Modify:** `code/packages/server/src/game/game-manager.ts`
- **Modify:** `code/packages/server/src/game/game-store.ts`
- **Modify:** `code/packages/server/src/game/vote-handler.ts`
- **Modify:** `code/packages/client/src/app/game/[gameId]/page.tsx`

### Requirements: REQ-F-PV13, REQ-F-PV14, REQ-F-PV15, REQ-F-PV16, REQ-F-PV17, REQ-F-PV18, REQ-F-PV19, REQ-F-PV24, REQ-F-PV25, REQ-F-PV26, REQ-F-PV27, REQ-F-PV28, REQ-NF-PV01

---

## Testing Strategy

- **TypeScript compilation** (`npm run build`) after each milestone to verify type safety
- **Manual testing** via dev server after M3+ for UI verification
- **Edge case testing** in M5: single human, timeout, disconnect scenarios
- **Visual verification**: glow/label correctness, state hiding/restoration

## Verification

1. Start 4-player game (2 humans + 2 bots)
2. Initiate kick vote → verify glows, dialog, vote, kick execution
3. Initiate restart vote → verify dialog, vote, scores reset, Grand Tichu phase
4. Test failed votes → verify "Vote Failed!" message, play resumes
5. Test timeout → verify auto-fail after 30s
6. Test with 1 human + 3 bots → verify auto-pass
