# Specification: Fix Game Message Routing + Reduce Delays

**Date:** 2026-03-13
**Type:** Bugfix + Enhancement

## Problem Statement

1. **Game messages not routed (CRITICAL):** The `MessageRouter` only has handlers for room messages. All 10 game message types have no handler, returning "No handler for message type" errors. Human players cannot interact with the game at all — only bots work (they bypass WebSocket routing via direct `actor.send()`).

2. **Regular Tichu Pass sends wrong message:** `handleTichuSkip` sends `GRAND_TICHU_DECISION` during the regular Tichu phase, which the server rejects.

3. **Perceived delays:** Lobby polling (5s), bot thinking (200-1500ms), animations, and other timers feel sluggish.

## Requirements

### Functional Requirements

| ID | Description |
|----|-------------|
| REQ-F-GMR01 | Game messages (GRAND_TICHU_DECISION, TICHU_DECLARATION, PASS_CARDS, PLAY_CARDS, PASS_TURN, DECLARE_WISH, GIFT_DRAGON, DISCONNECT_VOTE, CHAT_MESSAGE) must be routed from WebSocket to GameManager |
| REQ-F-GMR02 | Each game message handler must validate: player is authenticated, in a room, has a seat, and game exists |
| REQ-F-GMR03 | CHAT_MESSAGE must be handled directly (broadcast to room) since GameManager doesn't support it |
| REQ-F-RTP01 | Add REGULAR_TICHU_PASS client message type to protocol |
| REQ-F-RTP02 | Server must route REGULAR_TICHU_PASS to MoveHandler.handleRegularTichuPass() |
| REQ-F-RTP03 | Client handleTichuSkip must send REGULAR_TICHU_PASS instead of GRAND_TICHU_DECISION |

### Non-Functional Requirements

| ID | Description |
|----|-------------|
| REQ-NF-DL01 | Lobby polling interval reduced from 5000ms to 2000ms |
| REQ-NF-DL02 | Room auto-join delay reduced from 150ms to 50ms |
| REQ-NF-DL03 | Bot thinking delay reduced from 200-1500ms to 100-800ms |
| REQ-NF-DL04 | Tichu dismiss animation reduced from 2s to 1s |
| REQ-NF-DL05 | Reconnected message display reduced from 3000ms to 1500ms |

## Files to Modify

- **New:** `code/packages/server/src/game/game-handler.ts`
- `code/packages/shared/src/types/protocol.ts`
- `code/packages/server/src/game/game-manager.ts`
- `code/packages/server/src/app.ts`
- `code/packages/client/src/app/game/[gameId]/page.tsx`
- `code/packages/client/src/app/lobby/page.tsx`
- `code/packages/client/src/app/lobby/[roomId]/page.tsx`
- `code/packages/server/src/bot/bot-runner.ts`
- `code/packages/client/src/hooks/useAnimationSettings.ts`
- `code/packages/client/src/components/game/DisconnectOverlay.tsx`
