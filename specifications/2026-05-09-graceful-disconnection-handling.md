# Graceful Disconnection Handling

## Goal

Replace the current "pause game immediately on disconnect / auto-play on behalf of disconnected player" behavior with graceful disconnection handling that makes the game flow feel uninterrupted for connected players. A disconnected player should appear as if they're simply playing slowly, with minimal visual indicators, and only stall the game during untimed phases when it's their action.

**Why:** Mobile players frequently lose connections briefly (e.g., switching apps), and the current behavior punishes all players immediately for what is often a transient issue.

## Scope

### In Scope

- Server-side disconnect timer and 2-minute threshold logic
- Game flow changes (remove auto-pass/auto-play for disconnected players during untimed phases; timed phases use existing turn timer)
- Kick dialog (2+ min threshold, single-player-triggers-kick)
- "Waiting for player to reconnect..." overlay on disconnected player's turn (untimed phases)
- Vote integration (exclusion, interruption, restart)

### Out of Scope

- Changing the reconnection mechanism itself (WebSocket reconnect flow stays the same)
- Adding ping/heartbeat detection (rely on existing close event)
- Bot AI improvements
- Network quality indicators or connectivity warnings for the disconnecting player themselves

## Requirements

### Disconnection Detection & Timer (DC)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| REQ-F-DC01 | When a player's WebSocket connection drops, the server SHALL mark the player as disconnected but preserve their seat and room membership. | Player seat preserved; player marked disconnected in server state |
| REQ-F-DC02 | The disconnect timer SHALL start from zero each time a player disconnects (no accumulation across reconnect cycles). | Timer resets fully on each new disconnect event |
| REQ-F-DC03 | When a player reconnects, the disconnect timer SHALL be fully reset and cleared. | No residual timer state after reconnection |
| REQ-F-DC04 | The server SHALL track the elapsed disconnection time per player to determine when the 2-minute threshold is crossed. | Server can report per-player disconnect duration at any time |

### Game Flow During Disconnection (GF)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| REQ-F-GF01 | When a player disconnects, the game SHALL NOT pause, freeze, or auto-play on their behalf. The game continues normally for all other players. | No game state change on disconnect; other players can act freely |
| REQ-F-GF02 | During timed phases (active play), a disconnected player's turn SHALL behave identically to a connected player — the turn timer runs and expiry triggers normal auto-action (auto-pass, auto-play). | Turn timer runs; auto-action fires on expiry regardless of connection state |
| REQ-F-GF03 | During the bomb window, a disconnected player SHALL be treated as choosing not to play a bomb. The bomb window timer runs normally and expires naturally (no instant skip). | Bomb window runs full duration; no observable timing difference |
| REQ-F-GF04 | During untimed phases (Grand Tichu call, Tichu call, card passing, Dragon gift decision), a disconnected player SHALL be treated as simply not having acted yet. The game waits indefinitely until they reconnect or are kicked. | Game does not advance past the disconnected player's untimed action; no auto-action |

### UI Indicators (UI)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| REQ-F-UI01 | When the game is waiting at a disconnected player's turn during an untimed phase, a "Waiting for player to reconnect..." overlay SHALL be displayed over that player's info box, visible to all connected players. | Overlay visible to all connected players within 1 second of reaching disconnected player's action |
| REQ-F-UI02 | No visual disconnection indicator SHALL be shown when it is NOT the disconnected player's turn (or during timed phases where auto-action will fire). | No UI difference for disconnected players outside their untimed turn |
| REQ-F-UI03 | Spectators SHALL see the "Waiting for player to reconnect..." overlay but SHALL NOT receive the kick dialog. | Overlay visible to spectators; kick dialog not shown to spectators |

### Kick Mechanism (KM)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| REQ-F-KM01 | The kick dialog SHALL appear 5 seconds after a player crosses the 2-minute continuous disconnection threshold. | Dialog appears at ~2:05 of continuous disconnection |
| REQ-F-KM02 | If ANY single player chooses to kick, the disconnected player SHALL be immediately kicked (no vote required). | One "kick" response triggers immediate seat vacancy |
| REQ-F-KM03 | If all players choose NOT to kick, the dialog SHALL be dismissed with no further action. | Dialog dismissed; no kick; no reappearance for this disconnect session |
| REQ-F-KM04 | After a kick, the seat becomes empty and follows existing seat-vacancy logic (offered to spectators, host can add bot). | Standard vacancy flow triggered |
| REQ-F-KM05 | If the disconnected player reconnects while the kick dialog is showing, the kick dialog SHALL be automatically dismissed for all players and play resumes immediately. | Dialog dismissed on reconnect; game continues |
| REQ-F-KM06 | If multiple players cross the 2-minute threshold, kick dialogs SHALL be presented one at a time, in order of threshold crossing (first to cross = first prompted). | Sequential presentation; ordered by crossing time |
| REQ-F-KM07 | The kick dialog SHALL be non-blocking — players can continue to play cards and take game actions while the dialog is showing. | Game actions work while dialog is visible |
| REQ-F-KM08 | When multiple players cross the 2-minute threshold, kick dialogs SHALL be queued in order of threshold crossing. | Queue ordered by server timestamp |
| REQ-F-KM09 | If a queued player reconnects before their kick dialog is shown, they SHALL be removed from the queue silently. | No dialog shown for reconnected queued players |
| REQ-F-KM10 | The kick dialog is a one-time prompt per disconnect session. If all players decline, the dialog does not reappear for that same continuous disconnection. Players may manually initiate a kick vote if desired. | No reappearance after player-initiated dismissal |
| REQ-F-KM11 | If the same player reconnects and later disconnects for 2+ minutes again (new session), a new kick dialog SHALL appear. | New disconnect session = new dialog eligibility |
| REQ-F-KM12 | If a new vote is initiated while a kick dialog is showing, the kick dialog SHALL be automatically dismissed and replaced by the new vote. After the vote resolves, if the player is still disconnected 2+ min, the kick dialog SHALL reappear. | Vote takes priority over kick dialog; kick dialog reappears after vote if still applicable |
| REQ-F-KM13 | If a kick dialog is dismissed due to a new vote (per REQ-F-KM12), and the player remains disconnected 2+ minutes after the vote resolves, the kick dialog SHALL reappear. The "one-time per session" rule applies only to player-initiated dismissals, not system-initiated interruptions. | Reappearance after system dismissal; no reappearance after player dismissal |
| REQ-F-KM14 | The kick dialog is identical for all connected players — no special host privileges. | Same dialog content and options for all players |

### Vote Integration (VI)

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| REQ-F-VI01 | A player who has been continuously disconnected for 2+ minutes SHALL be excluded from all votes (their vote is not needed and not counted toward majority). | Vote proceeds without requiring their input |
| REQ-F-VI02 | A player who has been disconnected for less than 2 minutes SHALL still participate in votes normally (receives vote dialog, counted in required votes). | Player included in vote; subject to existing 30s vote timeout |
| REQ-F-VI03 | If a player crosses the 2-minute disconnect threshold during an active vote, that vote SHALL be automatically dismissed. | Vote terminated on threshold crossing |
| REQ-F-VI04 | After dismissing a vote per REQ-F-VI03, the kick dialog for the newly-threshold-crossing player SHALL be shown to all remaining connected players. | Kick dialog appears after vote dismissal |
| REQ-F-VI05 | After the kick dialog is resolved (player kicked or reconnected), the previously-dismissed vote SHALL be automatically restarted — UNLESS the vote was to kick the player who was just kicked (in which case it is skipped). | Vote restarts or is skipped appropriately |
| REQ-F-VI06 | When a disconnected player reconnects during a kick dialog, the kick dialog SHALL be dismissed and any previously-interrupted vote SHALL be automatically restarted. | Kick dialog dismissed; prior vote restarted |
| REQ-F-VI07 | If a vote is in progress and a participant disconnects (but has not yet crossed 2 minutes), they remain a vote participant. The vote waits for them (subject to existing 30-second vote timeout). | Vote includes recently-disconnected player; 30s timeout applies |
| REQ-F-VI08 | When a vote is started, the turn timer SHALL be paused for the duration of the vote. | Turn timer frozen during vote |
| REQ-F-VI09 | When a vote ends (resolved or dismissed), the turn timer SHALL be reset to its full duration so the active player has their complete time to act. | Full timer granted after vote |

### Non-Functional Requirements

| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| REQ-NF-DC01 | The disconnection handling SHALL not introduce noticeable latency or performance degradation for connected players. | No measurable impact on game responsiveness |
| REQ-NF-DC02 | The disconnect timer SHALL be accurate to within ±2 seconds of the 2-minute threshold. | Timer fires between 1:58 and 2:02 |
| REQ-NF-UI01 | The "Waiting for player to reconnect..." overlay SHALL appear within 1 second of the game reaching the disconnected player's untimed action. | Overlay renders < 1s after state broadcast |
| REQ-NF-GF01 | The bomb window SHALL run its full natural duration regardless of disconnection state — no observable timing difference from a connected player choosing not to bomb. | Bomb window duration identical for connected/disconnected players |

## Constraints

- Must integrate with the existing WebSocket reconnection flow (seat preservation, state sync on reconnect)
- Must work with the existing kick/vacancy mechanics (seat offered to spectators, host can add bot)
- Must coexist with the existing vote system (restart round, restart game, kick votes)
- Client must work on mobile browsers where aggressive connection killing is the norm

## Assumptions

- The server can reliably detect WebSocket disconnection (close event fires promptly)
- Reconnection restores full game state to the player (existing behavior)
- The "kick" outcome is identical to the existing seat-vacancy flow (no new post-kick logic needed)

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | Race condition between reconnect and kick (player reconnects at exact moment someone clicks kick) | Low | High | Server validates player is still disconnected before processing kick. If reconnected, ignore kick action and dismiss dialog. |
| R2 | Kick queue ordering edge case with near-simultaneous threshold crossings | Low | Low | Use server timestamp comparison; ties broken arbitrarily |
| R3 | Vote timeout (30s) interacting with disconnected participant who can't vote | Medium | Medium | Existing 30s timeout handles this — vote times out, treated as failed. No new logic needed. |
| R4 | Complexity of state machine (kick dialog, votes, disconnection, timers interacting) | Medium | Medium | Thorough integration testing of state transitions; clear priority ordering (vote > kick dialog) |
| R5 | Client-side overlay flicker if player rapidly reconnects/disconnects at their turn | Low | Low | Debounce overlay display with short delay (~500ms) |

## Success Metrics

1. Connected players experience zero game pauses from other players' transient disconnections
2. A disconnected player can be removed from the game within ~2:05 of disconnecting if any one player chooses
3. Votes are never blocked by a player disconnected 2+ minutes
4. No observable difference in game flow between a disconnected player and a slow connected player (except the overlay during untimed phases)

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| No bot takeover for disconnected players | Game should never play on behalf of a human; disconnection looks like slow play |
| Single player can trigger kick (not unanimous) | After 2 minutes, any player should be able to unblock the game |
| 5-second delay after 2-minute threshold | Avoids flashing dialog for players mid-reconnection |
| Disconnect timer resets fully on reconnect | Prevents "accumulated frustration" edge cases; abuse handled by manual kick votes |
| Bomb window runs naturally (no instant skip) | Preserves the illusion that the disconnected player is simply choosing not to bomb |
| Kick dialog non-blocking | Players shouldn't be forced to deal with the dialog before playing their turn |
| Vote takes priority over kick dialog | Votes are player-initiated actions that should not be blocked by system dialogs |
| Turn timer still applies to disconnected players | Keeps timed game flow moving; only untimed phases truly stall |
| No visual indicator outside disconnected player's untimed turn | Prevents premature frustration about transient disconnects that don't affect gameplay |

## Confidence

**High** — All requirements are clear, specific, and testable. Edge cases have been systematically probed and resolved. No open questions remain. The feature builds on existing well-understood mechanics (kick, vacancy, votes, turn timer).
