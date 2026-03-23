# Specification: Player Vote System (Kick Player / Restart Game)

**Date:** 2026-03-22
**Type:** Feature
**Status:** Draft

## 1. Goal

Add a democratic voting system that allows human players to collectively vote to kick a player or restart the game during active gameplay. The system provides real-time visual feedback through the existing glow/indicator system, temporarily suspends normal game state displays during voting, and executes the voted action upon unanimous approval.

### Why

The Tichu game currently has no mechanism for players to collectively remove a disruptive player or restart a game mid-play. This creates a poor experience when players are stuck in a game with someone who is AFK, trolling, or when the game state has become undesirable for all participants.

## 2. Scope

### In Scope
- "Start a Vote" button with dropdown menu (Kick Player, Restart Game)
- Server-authoritative vote logic with real-time broadcast
- Vote dialog overlays for human players
- Player seat glow/indicator updates during voting
- Kick execution (vacate seat, redirect kicked player to lobby)
- Restart execution (destroy & recreate game, reset scores, start at Grand Tichu)
- Temporary hiding of existing player state indicators during votes
- State restoration after vote completion
- Vote timeout (30 seconds)

### Out of Scope
- Bot voting (bots are excluded from all voting)
- Spectator voting
- Pre-game (lobby) voting — button only appears during active games
- Vote history or logging
- Custom vote types beyond kick and restart

## 3. Functional Requirements

### Vote Initiation

**REQ-F-PV01: Start a Vote button**
A "Start a Vote" button appears above the "Leave Room" button in the fixed top-left panel during active gameplay. Only visible to human players with a seat when no vote or disconnect vote is active.
- *Acceptance:* Button renders above Leave Room, hidden for spectators/bots/during active votes.

**REQ-F-PV02: Vote dropdown menu**
Clicking "Start a Vote" opens a dropdown with two options: "Kick Player" and "Restart Game". Closes on click outside or option selection.
- *Acceptance:* Dropdown appears on click with both options; closes on outside click.

**REQ-F-PV03: Kick Player target selection**
Selecting "Kick Player" enters a target selection mode where all other player seats (including bots) receive a red glow with "Kick Player" indicator text. Clicking a seat initiates the kick vote for that player. Escape key or clicking empty space cancels.
- *Acceptance:* Red glow on all non-self seats; clicking a seat sends START_KICK_VOTE; Escape cancels.

**REQ-F-PV04: Restart Game initiation**
Selecting "Restart Game" immediately sends START_RESTART_VOTE to the server without target selection.
- *Acceptance:* Single click initiates restart vote; no intermediate step.

### Vote Dialog

**REQ-F-PV05: Kick vote dialog**
All human players except the kick target receive a dialog: "[initiator name] has started a vote to kick [target name]" with "Kick" and "Don't Kick" buttons.
- *Acceptance:* Dialog shows for all non-target humans with correct names and two action buttons.

**REQ-F-PV06: Kick target notification**
The player being voted to be kicked sees an info-only message: "[initiator name] has started a vote to kick you" with no action buttons.
- *Acceptance:* Target sees info dialog with no voting buttons.

**REQ-F-PV07: Restart vote dialog**
All human players receive a dialog: "[initiator name] has started a vote to restart the game" with "Restart" and "Don't Restart" buttons.
- *Acceptance:* Dialog shows for all humans with correct name and two action buttons.

**REQ-F-PV08: Vote submission**
Clicking a vote button sends PLAYER_VOTE to the server. After voting, buttons become disabled and show "Waiting for other players...".
- *Acceptance:* Vote sent on click; buttons disabled after; waiting message displayed.

### Visual Feedback

**REQ-F-PV09: State hiding during vote**
When a vote is active, temporarily hide existing player state indicators (Your Turn, Their Turn, Leading Trick, Ready to Pass, Pass).
- *Acceptance:* Normal labels suppressed during active vote; restored after.

**REQ-F-PV10: Kick vote glow indicators**
During an active kick vote, players who voted "Kick" get green glow with "Voted: Kick" label. Players who voted "Don't Kick" get red glow with "Voted: Don't Kick" label.
- *Acceptance:* Green glow + label for approve; red glow + label for reject; updates in real-time.

**REQ-F-PV11: Restart vote glow indicators**
During an active restart vote, players who voted "Restart" get green glow with "Voted: Restart" label. Players who voted "Don't Restart" get red glow with "Voted: Don't Restart" label.
- *Acceptance:* Green glow + label for approve; red glow + label for reject; updates in real-time.

**REQ-F-PV12: State restoration after vote**
After vote completes (pass or fail), previous player state indicators (glow, labels) are restored.
- *Acceptance:* Normal turn/leader/pass indicators reappear after vote ends.

### Vote Resolution

**REQ-F-PV13: Kick vote pass threshold**
A kick vote passes only when ALL human players except the target vote "Kick".
- *Acceptance:* Vote passes with unanimous approval from eligible voters.

**REQ-F-PV14: Restart vote pass threshold**
A restart vote passes only when ALL human players vote "Restart".
- *Acceptance:* Vote passes with unanimous approval from all humans.

**REQ-F-PV15: Vote timeout**
Votes automatically fail after 30 seconds if not all eligible voters have voted.
- *Acceptance:* Vote resolves as failed at 30s timeout; VOTE_RESULT broadcast with passed=false.

**REQ-F-PV16: Kick vote success result**
On successful kick vote, display "[target name] was kicked!" center status, then immediately kick the player (vacate seat, redirect to lobby).
- *Acceptance:* Center status displayed; kicked player navigates to lobby; seat vacated.

**REQ-F-PV17: Kick vote failure result**
On failed kick vote, display "Vote Failed!" center status for 2 seconds, then resume play.
- *Acceptance:* "Vote Failed!" displayed for 2s; game resumes; indicators restored.

**REQ-F-PV18: Restart vote success result**
On successful restart vote, display "Restarting game!" center status for 2 seconds, then clear all state/scores and restart at Grand Tichu phase.
- *Acceptance:* Message displayed 2s; scores reset to 0-0; game starts at Grand Tichu decision phase.

**REQ-F-PV19: Restart vote failure result**
On failed restart vote, display "Restart vote failed!" center status for 2 seconds, then resume play.
- *Acceptance:* "Restart vote failed!" displayed for 2s; game resumes; indicators restored.

### Server Protocol

**REQ-F-PV20: Client-to-server messages**
Three new client message types: START_KICK_VOTE (with targetSeat), START_RESTART_VOTE, PLAYER_VOTE (with voteId and boolean vote).
- *Acceptance:* Messages validated via Zod schemas; routed to GameManager.

**REQ-F-PV21: Server-to-client messages**
Three new server message types: VOTE_STARTED (with voteId, voteType, initiatorSeat, optional targetSeat, timeoutMs), VOTE_UPDATE (per-seat vote status), VOTE_RESULT (outcome with message).
- *Acceptance:* Messages broadcast to all room players; contain required fields.

**REQ-F-PV22: Server-authoritative vote logic**
All vote logic runs on the server via a standalone VoteHandler class (modeled after DisconnectHandler). Server validates initiator eligibility, manages vote state, evaluates thresholds, and executes outcomes.
- *Acceptance:* No client-side vote evaluation; server broadcasts final result.

**REQ-F-PV23: Active vote in game state projection**
The active vote status (voteId, type, initiator, target, per-seat votes, timeout) is included in the ClientGameView state projection.
- *Acceptance:* ClientGameView contains activeVote field; projected per broadcast.

### Edge Cases

**REQ-F-PV24: Single human player**
When only one human player exists (rest are bots), the vote passes immediately since the sole voter is the only eligible voter.
- *Acceptance:* Vote resolves immediately with passed=true when 1 human.

**REQ-F-PV25: Concurrent vote prevention**
Only one vote (player vote or disconnect vote) can be active per room at a time. Attempting a second returns an error.
- *Acceptance:* Error message returned; no second vote session created.

**REQ-F-PV26: Initiator disconnect**
If the vote initiator disconnects during an active vote, the vote is automatically cancelled (fails).
- *Acceptance:* Vote cancelled; VOTE_RESULT with passed=false broadcast.

**REQ-F-PV27: Target disconnect during kick vote**
If the kick target disconnects during the vote, the vote is cancelled and the disconnect handler takes over.
- *Acceptance:* Kick vote cancelled; disconnect handling proceeds normally.

**REQ-F-PV28: Cannot kick self**
A player cannot initiate a kick vote targeting themselves.
- *Acceptance:* Server rejects START_KICK_VOTE where initiator === target with error.

## 4. Non-Functional Requirements

**REQ-NF-PV01: Real-time feedback**
Vote updates broadcast to all players on each individual vote change (not just at resolution), providing real-time visual feedback.
- *Acceptance:* VOTE_UPDATE sent after each vote; glow updates within 100ms.

**REQ-NF-PV02: Consistent UI patterns**
Vote UI follows existing codebase patterns: modal overlay pattern (like DragonGiftModal), glow/label pattern (like disconnect vote), button styling (like Leave Room).
- *Acceptance:* Visual consistency with existing components verified by inspection.

**REQ-NF-PV03: Accessibility**
Vote dialogs use role="dialog", aria-label, and aria-live for countdown timers.
- *Acceptance:* Screen reader compatibility; keyboard navigable.

**REQ-NF-PV04: No game state machine modification**
The vote system operates independently of the XState game state machine, modeled after DisconnectHandler pattern.
- *Acceptance:* No changes to game-state-machine.ts; VoteHandler is standalone.

## 5. Assumptions

1. The existing `KICKED` server message type can be reused for vote-kick (already exists at protocol.ts:100)
2. The existing seat vacancy system (vacatedSeats + spectator queue) handles kicked player seats
3. Game restart can be achieved by destroying and recreating the GameManager with the same config
4. Bots never need to vote or have opinions on votes

## 6. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Restart destroys game state unexpectedly | Medium | High | 2s delay before restart; clear "Restarting game!" message |
| Vote spam / griefing | Low | Medium | One vote at a time; 30s timeout prevents rapid re-voting |
| Race condition: vote + disconnect | Medium | Medium | Cancel vote on initiator/target disconnect; mutual exclusion with disconnect votes |
| Client state desync after restart | Low | High | Server broadcasts fresh GAME_STATE; client stores fully reset |

## 7. Success Metrics

1. Human players can successfully kick another player via unanimous vote
2. Human players can successfully restart a game via unanimous vote
3. Failed votes display appropriate messages and resume normal play within 2 seconds
4. Visual indicators (glows, labels) update in real-time during voting
5. Existing game state indicators are hidden during votes and restored after
6. No interference with existing disconnect vote system
7. Server handles all edge cases (timeout, disconnect, single human, concurrent attempts)

## 8. Confidence

**High** — All requirements are clear, testable, and non-conflicting. The feature follows well-established patterns in the codebase (DisconnectHandler for server logic, existing glow/label system for UI). The user provided detailed specifications for all flows.
