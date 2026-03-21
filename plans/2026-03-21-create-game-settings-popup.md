# Implementation Plan: Create Game Settings Popup & Direct-to-Game Flow

**Date:** 2026-03-21
**Specification:** `specifications/2026-03-21-spec-create-game-settings-popup.md`
**Branch:** `feature/create-game-settings-popup`

## Context

The current game creation requires three steps: lobby → room waiting page (configure, add bots, ready up) → game page. This adds unnecessary friction. We're replacing it with: lobby → settings popup → game page directly. The room waiting page is removed entirely. All pre-game management (bot addition, ready system, host settings) moves to the game page.

**Key architectural insight:** The game page currently has a loading gate at line 505 that returns a spinner when `!gameStore.gameId || !gameStore.phase`. For pre-room state (room exists, game not started), we need to intercept BEFORE this gate and render a pre-room UI using `roomStore` data.

## Milestones

### Milestone 1: Protocol & Server — Extend CREATE_ROOM with Config
**Requirements:** REQ-F-CG06

**Files:**
- `code/packages/shared/src/types/protocol.ts` — Add optional `config` field to CREATE_ROOM schema
- `code/packages/server/src/room/room-handler.ts` — Apply config from CREATE_ROOM message

### Milestone 2: Lobby Settings Popup & Navigation Changes
**Requirements:** REQ-F-CG01-05, REQ-F-CG07, REQ-F-CG08, REQ-F-CG12

**Files:**
- `code/packages/client/src/app/lobby/page.tsx` — Add popup modal, rename button, change navigation
- `code/packages/client/src/components/lobby/CreateGamePopup.tsx` — New settings popup component
- `code/packages/client/src/components/lobby/CreateGamePopup.module.css` — Popup styles
- **Delete** `code/packages/client/src/app/lobby/[roomId]/page.tsx` — Remove room waiting page

### Milestone 3: Game Page Pre-Room State
**Requirements:** REQ-F-CG09-11, REQ-F-CG13-17

**Files:**
- `code/packages/client/src/app/game/[gameId]/page.tsx` — Add pre-room rendering branch, ROOM_UPDATE handler, auto-join
- `code/packages/client/src/components/game/PreRoomView.tsx` — New pre-room UI component
- `code/packages/client/src/components/game/PreRoomView.module.css` — Styles

### Milestone 4: Documentation & Cleanup
**Requirements:** All (verification)

**Files:**
- `documentation/codebase-index.md` — Update routes, components, flow descriptions
