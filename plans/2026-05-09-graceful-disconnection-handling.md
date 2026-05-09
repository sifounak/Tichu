# Implementation Plan: Graceful Disconnection Handling

## Context

Currently, when a player's WebSocket connection drops, the game pauses for everyone (turn timer stops, bot actions freeze). Mobile players frequently lose connections when switching apps, punishing all players for transient issues. This plan replaces that with graceful handling: the game continues flowing, disconnected players appear as slow players, and a kick dialog (any single player can trigger removal) appears after 2:05 of continuous disconnection.

**Spec:** `specifications/2026-05-09-graceful-disconnection-handling.md`

## Milestone 1: Server Core — Per-Seat Disconnect Tracking, No Pause

**Goal:** Rewrite `DisconnectHandler` to per-seat timing, stop pausing/freezing multi-human games on disconnect, let turn timer run for disconnected players.

**Requirements:** REQ-F-DC01, DC02, DC03, DC04, GF01, GF02, GF03, GF04

**Files:**
- `code/packages/server/src/game/disconnect-handler.ts` — Major rewrite: replace `GraceSession` (per-room, single timer) with per-seat `Map<Seat, { disconnectedAt: number, thresholdTimer }>`. Add `getDisconnectDurationMs(roomCode, seat)`, `getSeatsOverThreshold(roomCode)`. Keep `isFrozen()` for solo-human only. Add `onThresholdCrossed` callback (fires at 125s = 2min + 5s delay).
- `code/packages/server/src/game/game-manager.ts` — `handleDisconnect()`: remove `this.timer.stop()`, remove vote cancellation (move to M3). `onStateChange()`: remove `isFrozen()` early-return for multi-human (keep for solo-human). `handleReconnect()`: remove conditional `onStateChange(null)` call (game never stopped). Add `waitingForReconnect` computation for state projection: if current state is untimed phase and current action seat is disconnected.
- `code/packages/server/src/ws/state-projection.ts` — Add `disconnectedSeats: Seat[]` and `waitingForReconnect: Seat | null` params. Change `gameHalted` to only use `vacatedSeats.length > 0`.
- `code/packages/shared/src/types/game.ts` — Add `waitingForReconnect: Seat | null` to `ClientGameView`. Change `gameHalted` semantics comment.
- `code/packages/server/tests/game/disconnect-handler.test.ts` — Rewrite tests for new per-seat model.

**Testing:**
- Disconnect seat during `playing` → turn timer NOT stopped, auto-action fires on expiry
- Disconnect/reconnect → per-seat timer resets to zero
- Disconnect during bomb window → window runs full 2.5s naturally
- Disconnect during untimed phase at player's action → `waitingForReconnect` set
- Multiple seats disconnect → independent per-seat timers

---

## Milestone 2: Kick Dialog Server Logic

**Goal:** Implement kick dialog mechanism (not a vote — single kick triggers removal) with queue, reconnect cancellation, and threshold timing.

**Requirements:** REQ-F-KM01–KM14, REQ-F-UI03

**Files:**
- `code/packages/server/src/game/kick-dialog-handler.ts` (NEW) — `KickDialogHandler` class with:
  - Queue: `{ seat, crossedAt, dismissedByPlayers }[]`
  - Active dialog: `{ targetSeat, responses: Map<Seat, 'kick'|'decline'> }`
  - `onThresholdCrossed(roomCode, seat)`: add to queue, show next if no active
  - `handleResponse(roomCode, responderSeat, response)`: any 'kick' → fire callback & advance; all decline → mark dismissed & advance
  - `handleReconnect(roomCode, seat)`: remove from queue or dismiss active dialog
  - `dismissForVote(roomCode)`: system-dismiss (can reappear)
  - `reappearAfterVote(roomCode)`: re-show if still applicable
  - Callback `onKick: (roomCode, seat) => void`
- `code/packages/server/src/game/disconnect-handler.ts` — Wire `onThresholdCrossed` callback to `KickDialogHandler`.
- `code/packages/server/src/game/game-manager.ts` — Instantiate `KickDialogHandler`, wire callbacks, handle new message routing. Wire `kickDialogHandler.onKick` to vacate seat (same path as current kick).
- `code/packages/shared/src/types/protocol.ts` — New messages: `KICK_DIALOG_RESPONSE` (C→S), `KICK_DIALOG_SHOW`/`KICK_DIALOG_DISMISSED` (S→C).
- `code/packages/shared/src/types/game.ts` — Add `kickDialog: { targetSeat: Seat } | null` to `ClientGameView`.
- `code/packages/server/src/ws/state-projection.ts` — Add `kickDialog` to projection (null for spectators per REQ-F-UI03).
- `code/packages/server/tests/game/kick-dialog-handler.test.ts` (NEW) — Full unit tests.

**Testing:**
- Seat disconnects → after 125s kick dialog fires
- Any single 'kick' response → seat vacated
- All 'decline' → dismissed, no reappearance (one-time)
- Reconnect while dialog active → dismissed
- Reconnect while in queue → removed silently
- Two seats cross → sequential, ordered by timestamp
- Race condition: reconnect simultaneous with kick → reconnect wins

---

## Milestone 3: Vote Integration

**Goal:** Timer pause/reset during votes, exclude 2+ min disconnected from votes, threshold-during-vote handling, vote/kick-dialog priority.

**Requirements:** REQ-F-VI01–VI09

**Files:**
- `code/packages/server/src/game/turn-timer.ts` — Add `pause()` (save remaining, clear timeout), `resetToFull()` (restart with full duration for current seat).
- `code/packages/server/src/game/vote-handler.ts` — `startKickVote()`/`startRestartVote()`: accept `excludedSeats: Seat[]` to filter from eligible voters. Add `getVoteSnapshot()` for restart-after-kick-dialog.
- `code/packages/server/src/game/game-manager.ts` — Vote flow changes:
  - On vote start: `timer.pause()` (REQ-F-VI08)
  - On vote end: `timer.resetToFull()` (REQ-F-VI09)
  - Pass `disconnectHandler.getSeatsOverThreshold()` as excluded voters (REQ-F-VI01)
  - Track `interruptedVote` snapshot
  - `disconnectHandler.onThresholdCrossed`: if vote active and crossing player was participant → cancel vote, store snapshot, show kick dialog (REQ-F-VI03/04)
  - After kick dialog resolves: restart interrupted vote unless it was to kick that player (REQ-F-VI05/06)
  - On new vote start: call `kickDialogHandler.dismissForVote()` (REQ-F-KM12)
  - On vote end with system-dismissed kick dialog: call `kickDialogHandler.reappearAfterVote()` (REQ-F-KM13)
- `code/packages/server/src/game/game-manager.ts` — `handleDisconnect()`: remove vote cancellation for initiator/target disconnect (REQ-F-VI07: vote continues, 30s timeout handles non-response)

**Testing:**
- Vote with 1 player 2+ min disconnected → excluded from eligible voters
- Player crosses 2 min during vote → vote cancelled → kick dialog → kicked → vote restarts
- Player crosses 2 min during vote → kick dialog → reconnects → kick dismissed → vote restarts
- Turn timer paused on vote start, reset to full on vote end
- New vote starts while kick dialog showing → kick dialog dismissed
- After vote, kick dialog reappears if player still disconnected 2+ min

---

## Milestone 4: Client UI — Waiting Overlay, Kick Dialog, Remove Legacy UI

**Goal:** "Waiting for player to reconnect..." overlay, kick dialog component, remove old disconnect vote UI.

**Requirements:** REQ-F-UI01, UI02, UI03, REQ-NF-UI01

**Files:**
- `code/packages/client/src/components/game/WaitingForReconnectOverlay.tsx` (NEW) — Overlay positioned over disconnected player's info box. Shows "Waiting for [Name] to reconnect..." with 500ms debounce.
- `code/packages/client/src/components/game/KickDialog.tsx` (NEW) — Non-blocking dialog: "[Player] disconnected for 2+ minutes. Kick?" Buttons: "Kick" / "Keep Waiting". Sends `KICK_DIALOG_RESPONSE`. Auto-dismisses on `KICK_DIALOG_DISMISSED`.
- `code/packages/client/src/components/game/GameTable.tsx` — Render `WaitingForReconnectOverlay` and `KickDialog`. Remove old disconnect vote glow logic.
- `code/packages/client/src/components/game/PlayerSeat.tsx` — Remove `voteStatus` prop and disconnect vote CSS classes.
- `code/packages/client/src/components/game/SpectatorOverlay.tsx` — Remove disconnect vote waiting message. Add overlay visibility.
- `code/packages/client/src/stores/uiStore.ts` — Remove `disconnectVoteRequired`, `disconnectVotes`, `disconnectCountdown`. Add `kickDialogTarget`.
- `code/packages/client/src/stores/gameStore.ts` — Add `waitingForReconnect`, `kickDialog`. Remove `disconnectVotes`.
- `code/packages/client/src/app/game/[gameId]/page.tsx` — Handle `KICK_DIALOG_SHOW`/`KICK_DIALOG_DISMISSED`. Remove `DISCONNECT_VOTE_REQUIRED`/`DISCONNECT_VOTE_UPDATE` handlers.

**Testing:**
- Visual: disconnect during untimed phase at their turn → overlay appears within 1s
- Visual: overlay NOT shown during timed phases or when not player's turn
- Visual: kick dialog non-blocking (can still play cards while showing)
- Visual: kick dialog dismissed on reconnect
- Visual: spectators see overlay but not kick dialog
- `gameHalted` only true for vacant seats

---

## Milestone 5: Cleanup, Dead Code Removal, Integration Testing

**Goal:** Remove legacy disconnect vote system, update serialization, comprehensive integration testing.

**Requirements:** REQ-NF-DC01, NF-DC02, NF-GF01 (verification)

**Files:**
- `code/packages/server/src/game/disconnect-handler.ts` — Remove: `GraceSession`, `handleVote()`, `hasActiveVote()`, `getVoteStatus()`, `DisconnectVote`/`VoteOutcome` types.
- `code/packages/server/src/game/game-manager.ts` — Remove: `MULTI_HUMAN_GRACE_MS`/`SOLO_HUMAN_GRACE_MS` constants (M1 replaced with per-seat threshold). Remove `disconnectHandler.hasActiveVote()` check in vote start validation. Update solo-human handling if needed.
- `code/packages/shared/src/types/protocol.ts` — Remove: `DISCONNECT_VOTE` (C→S), `DISCONNECT_VOTE_REQUIRED`, `DISCONNECT_VOTE_UPDATE` (S→C).
- `code/packages/client/src/stores/uiStore.ts` — Remove all remaining legacy disconnect vote state.
- `code/packages/server/tests/game/disconnect-handler.test.ts` — Update/rewrite for new API.
- Integration tests: full end-to-end flows covering all edge cases from spec.

**Testing:**
- Full flow: disconnect → 2:05 → kick → vacancy → spectator offered seat
- Full flow: disconnect → reconnect at 1:59 → no kick dialog
- Full flow: disconnect → 2:05 → all decline → new disconnect session → new dialog
- Full flow: two players disconnect → sequential kick dialogs
- Timer accuracy: threshold fires between 1:58–2:02
- Performance: no latency degradation for connected players
- Typecheck + lint pass with no dead code warnings

---

## Verification

1. `pnpm typecheck` — all packages pass
2. `pnpm test` — all tests pass
3. `pnpm test:coverage` — 80%+ coverage on new code
4. Manual testing with dev server:
   - Open 4 browser tabs (4 players)
   - Disconnect one by closing tab → verify game continues
   - Wait 2:05 → verify kick dialog appears for other 3
   - Click kick → verify seat vacated
   - Test reconnect during dialog → verify dismissal
   - Test untimed phase (GT decision) with disconnect → verify overlay
   - Test vote during disconnect → verify exclusion/interruption flows
