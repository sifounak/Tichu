# Disconnect & Room Lifecycle Redesign

**Date:** 2026-05-01
**Status:** Approved

## Overview

Redesign the disconnect and room destruction logic to differentiate behavior based on game composition (solo-human vs multi-human). The current system applies a flat 60-second grace period to all disconnects. The new system varies timeouts, freeze behavior, and destruction rules based on whether the game has ever had multiple human participants.

## Definitions

- **Solo-human game**: A game where only 1 distinct human has ever occupied a seat while the game was active (after cards dealt / first round starts). Humans who sat in a seat during the lobby phase but left before the game started do not count.
- **Multi-human game**: A game where 2 or more distinct humans have occupied a seat while the game was active. This classification is permanent once reached — even if all but one human leave, the game remains multi-human.
- **Involuntary disconnect**: WebSocket close/error (network drop, browser crash, etc.). NOT a voluntary `LEAVE_ROOM` action.
- **Voluntary leave**: The player explicitly sends a `LEAVE_ROOM` message (e.g., clicks "Leave Game").

## 1. Game Participant History

A `Set<string>` of human user IDs is maintained per game, tracking every human who has occupied a seat while the game is active.

**When entries are added:**
- When a human is seated at game start (the moment the game becomes active)
- When a human claims a seat mid-game (via seat queue, reconnection, etc.)

**When entries are removed:** Never. Once a human is in the set, they remain for the game's lifetime.

**Query:** `isMultiHuman()` returns `true` when `set.size >= 2`.

**Location:** Lives on the game manager / game state, since it is a game-level concept.

## 2. Involuntary Disconnect Behavior

When a human disconnects involuntarily:

| Game Type | Grace Period | During Grace | On Reconnect | On Expiry |
|-----------|-------------|--------------|--------------|-----------|
| Multi-human | 3 minutes | Game continues (bots play, other humans play) | Seat restored, no validation needed | Release seat(s). If no humans are currently seated or in grace, destroy room. |
| Solo-human | 3 days | Game fully frozen (no bot turns, no timers advance) | Game resumes exactly where left off | Destroy room. |

### Solo-human freeze semantics

While a solo-human game is in its 3-day pause:
- Bot turn-taking logic is gated — bots do not act
- No game timers advance
- The game state is preserved exactly as-is in memory
- If the server restarts, the paused game is lost (in-memory only, accepted limitation)

## 3. Voluntary Leave Behavior

When a human voluntarily leaves (`LEAVE_ROOM`):

| Game Type | Behavior |
|-----------|----------|
| Multi-human | Release seat immediately (current behavior). If no humans are currently seated or in grace, destroy room. |
| Solo-human | Destroy room immediately. |

## 4. Statistics / Game Recording

- Only completed games are recorded. No partial game stats.
- Games destroyed due to disconnect expiry or voluntary leave are not recorded.
- This applies uniformly regardless of game type or how the game ended prematurely.

## 5. Impact on Existing Code

### `disconnect-handler.ts`
- Currently takes a single `graceTimeoutMs` in the constructor.
- Needs to accept or determine the timeout per-disconnect event based on game type.
- `handleDisconnect` needs the game type (or the timeout value) to choose between 3 minutes and 3 days.

### `game-manager.ts`
- Adds the participant history `Set<string>`.
- `addHumanParticipant(userId: string)` — called when a human claims a seat during an active game.
- `isMultiHuman(): boolean` — queries participant history size.

### `room-handler.ts` (voluntary leave path)
- `handleLeaveRoom` checks `isMultiHuman()`:
  - Solo-human + voluntary leave: destroy room immediately.
  - Multi-human: current behavior (release seat, destroy if no humans remain).

### `room-handler.ts` (disconnect/expiry path)
- `onVoteResult` callback (grace expiry): release seats. For multi-human, destroy room if no humans are currently seated or in grace. For solo-human, destroy room unconditionally.

### Bot turn-taking
- Wherever bot actions are triggered, add a gate check: if the game is in a solo-human pause state, skip processing.

## 6. Constants

| Constant | Value | Context |
|----------|-------|---------|
| `MULTI_HUMAN_GRACE_MS` | 180,000 (3 minutes) | Involuntary disconnect in multi-human game |
| `SOLO_HUMAN_GRACE_MS` | 259,200,000 (3 days) | Involuntary disconnect in solo-human game |
