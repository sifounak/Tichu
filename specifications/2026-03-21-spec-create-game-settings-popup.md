# Specification: Create Game Settings Popup & Direct-to-Game Flow

**Date:** 2026-03-21
**Type:** Feature
**Status:** Approved

## Goal

Replace the current two-step room creation flow (lobby → room waiting page → game) with a streamlined single-step flow: lobby → settings popup → directly into the game page with empty seats. The room waiting page (`/lobby/[roomId]`) is removed entirely. Empty seats on the game page show bot-add controls (difficulty dropdown + Add Bot button) for the host. All players (including bots) must confirm ready before the game starts.

**Why:** The current flow requires navigating to a separate room waiting page to configure settings and add bots before starting a game. This adds unnecessary friction. The new flow lets the creator configure everything in a popup, land directly on the game table, and manage seats from there.

## Functional Requirements

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| REQ-F-CG01 | Lobby "Create Game" button opens a settings popup (modal) instead of immediately creating a room | Clicking "Create Game" shows a modal overlay; no WebSocket message sent yet |
| REQ-F-CG02 | Settings popup contains: target score, turn timer, animation speed, private room toggle, allow spectators toggle (NO bot difficulty) | All 5 settings present with same options as current room config, excluding bot difficulty |
| REQ-F-CG03 | Settings popup has "Create Game" and "Cancel" buttons | Both buttons visible and labeled correctly |
| REQ-F-CG04 | Cancel button dismisses popup with no side effects | Modal closes, no room created, no navigation |
| REQ-F-CG05 | "Create Game" in popup sends CREATE_ROOM with config and navigates directly to the game page (`/game/[roomCode]`) | Room created server-side with provided config; player lands on game page with 3 empty seats |
| REQ-F-CG06 | CREATE_ROOM message accepts an optional `config` payload with game settings | Server applies provided config instead of defaults when config is present |
| REQ-F-CG07 | Joiners (via room code or lobby list) navigate directly to game page, not room waiting page | JOIN_ROOM → ROOM_JOINED → `/game/[roomCode]` |
| REQ-F-CG08 | Remove `/lobby/[roomId]` room waiting page entirely | Route deleted; any deep links redirect appropriately |
| REQ-F-CG09 | Empty seats on game page display bot controls: difficulty dropdown + "Add Bot" button | Layout: label "Difficulty", dropdown (Normal/Expert), "Add Bot" button — stacked vertically |
| REQ-F-CG10 | Bots automatically enter "Ready to Start" state when added pre-game | Bot's ready status is set immediately upon ADD_BOT; broadcast reflects this |
| REQ-F-CG11 | Game starts only when all 4 seated players (humans + bots) confirm ready | Ready system remains; all must be ready before game begins |
| REQ-F-CG12 | Rename lobby button from "Create Room" to "Create Game" | Button text updated |
| REQ-F-CG13 | Game page shows room code in pre-game state so others can join | Room code visible and prominent for sharing |
| REQ-F-CG14 | Host can remove bots and kick human players from the game page pre-game | Remove/Kick buttons appear on occupied seats for the host |
| REQ-F-CG15 | Host can change room settings from the game page pre-game | Settings panel accessible to host; changes broadcast via CONFIGURE_ROOM |
| REQ-F-CG16 | "Start Game" (ready) button displayed in center of play area for all players | Button centered in the trick display area; all players see it; acts as ready confirmation |
| REQ-F-CG17 | Only the host can see bot controls and add bots | Non-host players see empty seats without bot add UI |

## Non-Functional Requirements

| ID | Requirement | Acceptance Criteria |
|---|---|---|
| REQ-NF-CG01 | Settings popup uses existing CSS design tokens (felt green, gold accent, etc.) | Visually consistent with rest of app |
| REQ-NF-CG02 | Settings popup defaults match current server defaults (1000 pts, no timer, normal speed, public, spectators allowed) | All defaults pre-populated correctly |

## Assumptions

1. The existing WebSocket protocol for ROOM_UPDATE, CONFIGURE_ROOM, ADD_BOT, REMOVE_BOT, KICK_PLAYER, READY_TO_START, CANCEL_READY, and START_GAME remains unchanged (only CREATE_ROOM is extended).
2. The game page already handles game state rendering; we are adding a pre-game state layer on top of it.
3. Bot difficulty per-seat (chosen at add time) overrides room-level bot difficulty.

## Scope Boundaries

**In scope:**
- Settings popup on lobby page
- CREATE_ROOM protocol extension (optional config)
- Direct-to-game navigation for both creators and joiners
- Room waiting page removal
- Pre-game UI on game page (bot controls, ready system, host controls, settings, room code)
- Bot auto-ready behavior

**Out of scope:**
- Changes to gameplay, bot AI, scoring, or card mechanics
- Spectator flow changes (spectators already go to game page)
- Auth, leaderboard, or profile changes
- Changes to the join-by-code or lobby-list browse UI (other than navigation target)

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Game page complexity increases handling both pre-game and in-game states | Medium | Medium | Clean separation using game phase state; pre-game components only render when phase is appropriate |
| Removing room page breaks deep links or bookmarks | Low | Low | Remove the route; stale links will 404 naturally |
| CREATE_ROOM config validation on server | Low | Medium | Reuse existing CONFIGURE_ROOM validation logic for the new config field |

## Success Metrics

1. Player can go from lobby to in-game screen in 2 clicks (Create Game → Create Game in popup)
2. All settings from the old room page are accessible either in the popup or on the game page
3. Bot addition works from the game page with per-seat difficulty selection
4. Ready system works identically to current behavior, just relocated to game page
5. No regression in join-by-code or lobby-list join flows
6. Room waiting page is fully removed with no dead links

## Confidence

**High** — All requirements are clear, testable, and non-conflicting. The scope is well-bounded. The main work is UI relocation (room page features → popup + game page) plus a protocol extension (config in CREATE_ROOM).
