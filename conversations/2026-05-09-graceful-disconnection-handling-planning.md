# Graceful Disconnection Handling — Planning Conversation

## Summary

Designed a 5-milestone implementation plan for replacing the current "pause on disconnect" system with graceful handling.

## Key Architectural Decisions

1. **KickDialogHandler is separate from VoteHandler** — different semantics (any single kick vs unanimous)
2. **Per-seat Map replaces per-room GraceSession** — independent timing per player
3. **TurnTimer gets pause()/resetToFull()** — for vote integration
4. **`waitingForReconnect` computed server-side** — server knows phase + disconnect state
5. **`gameHalted` only from vacated seats** — disconnects no longer halt
6. **Solo-human freeze preserved** — 1-human games have no one to kick the player

## Milestone Breakdown

- M1: Server core (per-seat tracking, no pause, turn timer keeps running)
- M2: Kick dialog handler (queue, single-kick triggers, reconnect cancellation)
- M3: Vote integration (timer pause/reset, exclusion, threshold-during-vote)
- M4: Client UI (waiting overlay, kick dialog component, remove legacy)
- M5: Cleanup (dead code removal, integration testing)

## Files Explored

- `disconnect-handler.ts` — GraceSession model, per-room timer, isFrozen
- `game-manager.ts` — handleDisconnect/Reconnect, onStateChange, turn timer, vote wiring
- `vote-handler.ts` — unanimous votes, 30s timeout, eligible voters
- `state-projection.ts` — projectGameState/SpectatorView, gameHalted derivation
- `turn-timer.ts` — start/stop, no pause/resume currently
- `app.ts` — WebSocket lifecycle, reconnection detection
- Client stores and components for disconnect/vote UI
