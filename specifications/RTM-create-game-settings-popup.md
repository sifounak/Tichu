# Requirements Traceability Matrix — Create Game Settings Popup

**Specification:** `specifications/2026-03-21-spec-create-game-settings-popup.md`
**Plan:** `plans/2026-03-21-create-game-settings-popup.md`

| Requirement | Description | Milestone | Source Files | Test Files | Status |
|---|---|---|---|---|---|
| REQ-F-CG01 | Lobby "Create Game" opens settings popup | M2 | client/src/app/lobby/page.tsx:91, client/src/components/lobby/CreateGamePopup.tsx | | Implemented |
| REQ-F-CG02 | Popup contains 5 settings (no bot difficulty) | M2 | client/src/components/lobby/CreateGamePopup.tsx:53-119 | | Implemented |
| REQ-F-CG03 | Popup has Create Game + Cancel buttons | M2 | client/src/components/lobby/CreateGamePopup.tsx:121-129 | | Implemented |
| REQ-F-CG04 | Cancel dismisses popup, no side effects | M2 | client/src/components/lobby/CreateGamePopup.tsx:38 | | Implemented |
| REQ-F-CG05 | Create Game sends CREATE_ROOM with config, navigates to game | M2 | client/src/app/lobby/page.tsx:96-99 | | Implemented |
| REQ-F-CG06 | CREATE_ROOM accepts optional config payload | M1 | shared/src/types/protocol.ts:30-37, server/src/room/room-handler.ts:68-70 | | Implemented |
| REQ-F-CG07 | Joiners navigate directly to game page | M2 | client/src/app/lobby/page.tsx:51-53 | | Implemented |
| REQ-F-CG08 | Remove /lobby/[roomId] room waiting page | M2 | (deleted client/src/app/lobby/[roomId]/page.tsx) | | Implemented |
| REQ-F-CG09 | Empty seats show bot controls (dropdown + button) | M3 | client/src/components/game/PreRoomView.tsx:111-125 | | Implemented |
| REQ-F-CG10 | Bots auto-ready when added pre-game | M3 | server/src/room/room-handler.ts:256-259 (existing) | | Implemented |
| REQ-F-CG11 | All 4 players must confirm ready to start | M3 | client/src/components/game/PreRoomView.tsx:233-248 | | Implemented |
| REQ-F-CG12 | Rename lobby button to "Create Game" | M2 | client/src/app/lobby/page.tsx:228 | | Implemented |
| REQ-F-CG13 | Game page shows room code pre-game | M3 | client/src/components/game/PreRoomView.tsx:163-172 | | Implemented |
| REQ-F-CG14 | Host can remove bots / kick players pre-game | M3 | client/src/components/game/PreRoomView.tsx:140-148 | | Implemented |
| REQ-F-CG15 | Host can change settings from game page pre-game | M3 | client/src/components/game/PreRoomView.tsx:177-224 | | Implemented |
| REQ-F-CG16 | Start Game button in center of play area | M3 | client/src/components/game/PreRoomView.tsx:230-249 | | Implemented |
| REQ-F-CG17 | Only host sees bot controls | M3 | client/src/components/game/PreRoomView.tsx:113 | | Implemented |
| REQ-NF-CG01 | Popup uses existing CSS design tokens | M2 | client/src/components/lobby/CreateGamePopup.module.css | | Implemented |
| REQ-NF-CG02 | Popup defaults match server defaults | M2 | client/src/components/lobby/CreateGamePopup.tsx:30-35 | | Implemented |
