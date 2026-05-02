# Requirements Traceability Matrix — Game Actions Menu

| Req ID | Description | Milestone | Source File(s) | Test File(s) | Status |
|--------|-------------|-----------|---------------|--------------|--------|
| REQ-F-GA01 | Room name click copies game URL | M3 | PreRoomView.tsx:160 | | Passed |
| REQ-F-GA02 | "Link copied!" toast (2s) | M3 | PreRoomView.tsx:160-162 | | Passed |
| REQ-F-GA03 | Room name hover hint (underline/icon) | M3 | PreRoomView.tsx:527 | | Passed |
| REQ-F-GA04 | Room Code display removed | M3 | PreRoomView.tsx (removed) | | Passed |
| REQ-F-GA05 | Spectators: # display | M3 | PreRoomView.tsx:554 | | Passed |
| REQ-F-GA06 | Spectator names tooltip/tap | M3 | PreRoomView.tsx:565-580 | | Passed |
| REQ-F-GA07 | Kebab (⋮) button for all users | M2 | GameActionsMenu.tsx:164 | | Passed |
| REQ-F-GA08 | Desktop popover dropdown | M2 | GameActionsMenu.tsx:175, GameActionsMenu.module.css:33 | | Passed |
| REQ-F-GA09 | Mobile slide-in drawer | M2 | GameActionsDrawer.tsx, GameActionsDrawer.module.css:19 | | Passed |
| REQ-F-GA10 | Menu dismiss (Escape/click-outside/select) | M2 | GameActionsMenu.tsx:72-90 | | Passed |
| REQ-F-GA11 | Menu disabled during active vote | M5 | | | Not Started |
| REQ-F-GA12 | Pre-game menu items | M2 | GameActionsMenu.tsx:107-130 | | Passed |
| REQ-F-GA13 | Kick Player target selection (pre-game) | M3 | PreRoomView.tsx:178-185 | | Passed |
| REQ-F-GA14 | In-game menu items | M2 | GameActionsMenu.tsx:113-123 | | Passed |
| REQ-F-GA15 | Kick Player target selection (in-game) | M4 | | | Not Started |
| REQ-F-GA16 | Restart Round confirmation dialog | M4 | | | Not Started |
| REQ-F-GA17 | Restart Game confirmation dialog | M4 | | | Not Started |
| REQ-F-GA18 | Non-host dialog: Cancel + Start Vote | M2 | ActionConfirmDialog.tsx:128-140 | | Passed |
| REQ-F-GA19 | Start Vote sends correct message type | M3/M4 | | | Not Started |
| REQ-F-GA20 | Host dialog: Cancel + Start Vote + Force | M2 | ActionConfirmDialog.tsx:142-157 | | Passed |
| REQ-F-GA21 | Force button destructive styling | M2 | ActionConfirmDialog.tsx:148 | | Passed |
| REQ-F-GA22 | Start Vote is primary button | M2 | ActionConfirmDialog.tsx:130 | | Passed |
| REQ-F-GA23 | Force sends force message | M4 | | | Not Started |
| REQ-F-GA24 | Transfer Host visible to host only | M2 | GameActionsMenu.tsx:126-128 | | Passed |
| REQ-F-GA25 | Transfer Host target selection (human seats) | M3/M4 | | | Not Started |
| REQ-F-GA26 | Transfer Host confirmation dialog | M2 | ActionConfirmDialog.tsx:115-126 | | Passed |
| REQ-F-GA27 | TRANSFER_HOST message sent | M3/M4 | | | Not Started |
| REQ-F-GA28 | Server transfers host role | M1 | room-manager.ts:283, room-handler.ts:526 | room-handler.test.ts | Passed |
| REQ-F-GA29 | ROOM_UPDATE broadcast with new host | M1 | room-handler.ts:548, room-handler.ts:1417 | room-handler.test.ts | Passed |
| REQ-F-GA30 | Game Settings last item in menu | M2 | GameActionsMenu.tsx:136 | | Passed |
| REQ-F-GA31 | Settings: editable host pre-game, read-only otherwise | M3/M4 | PreRoomView.tsx (via menu, readOnly=!isHost) | | Passed |
| REQ-F-GA32 | Standalone Settings button removed | M3 | PreRoomView.tsx (removed settingsToggle) | | Passed |
| REQ-F-GA33 | Leave Game standalone button | M3/M4 | PreRoomView.tsx:608 | | Passed |
| REQ-F-GA34 | Leave Game behavior unchanged | M3/M4 | PreRoomView.tsx (LeaveConfirmDialog unchanged) | | Passed |
| REQ-F-GA35 | Server FORCE_KICK (host only) | M1 | protocol.ts:88, room-handler.ts:419 | room-handler.test.ts | Passed |
| REQ-F-GA36 | Server FORCE_RESTART_ROUND (host only) | M1 | protocol.ts:88, room-handler.ts:482 | room-handler.test.ts | Passed |
| REQ-F-GA37 | Server FORCE_RESTART_GAME (host only) | M1 | protocol.ts:88, room-handler.ts:504 | room-handler.test.ts | Passed |
| REQ-F-GA38 | Server TRANSFER_HOST (host, human, no vote) | M1 | protocol.ts:93, room-handler.ts:526, room-manager.ts:283 | room-handler.test.ts | Passed |
| REQ-F-GA39 | Spectator menu: Game Settings only | M2 | GameActionsMenu.tsx:105-106 | | Passed |
| REQ-F-GA40 | In-game settings read-only for all | M4 | | | Not Started |
| REQ-F-GA41 | One target selection mode at a time | M3 | PreRoomView.tsx:178,188, uiStore.ts:285-286 | | Passed |
| REQ-F-GA42 | Opening kebab cancels target selection | M3 | PreRoomView.tsx:209-210 | | Passed |
| REQ-F-GA43 | Vote actions disabled during active vote | M5 | | | Not Started |
| REQ-F-GA44 | Transfer Host disabled during active vote | M4 | | | Not Started |
| REQ-F-GA45 | Cancel Vote button replaces kebab | M2 | GameActionsMenu.tsx:155-162 | | Passed |
| REQ-F-GA46 | Host toggle voting | M2 | GameActionsMenu.tsx:131-134 | | Passed |
| REQ-F-GA47 | Voting disabled: items greyed with hint | M2 | GameActionsMenu.tsx:109, GameActionsMenu.module.css:71 | | Passed |
| REQ-F-GA48 | Transfer Host: human seats only | M3/M4 | PreRoomView.tsx:189 | | Passed |
| REQ-F-GA49 | Self-kick allowed (ALLOW_SELF_KICK) | M3 | PreRoomView.tsx:29,179 | | Passed |
| REQ-F-GA50 | Mobile drawer closes before target/settings | M3/M4 | PreRoomView.tsx:650-653 | | Passed |
| REQ-F-GA51 | Server CANCEL_VOTE (host/initiator) | M1 | protocol.ts:96, room-handler.ts:560, vote-handler.ts:229 | room-handler.test.ts | Passed |
| REQ-F-GA52 | Server TOGGLE_VOTING (host) | M1 | protocol.ts:99, room-handler.ts:600, room-manager.ts:299 | room-handler.test.ts | Passed |
| REQ-F-GA53 | Server rejects non-host votes when disabled | M1 | room-handler.ts:376, game-manager.ts:480 | room-handler.test.ts | Passed |
| REQ-F-GA54 | "Vote cancelled by [Name]" message | M1/M5 | vote-handler.ts:236 | | In Progress |
| REQ-F-GA55 | Voting-disabled persists in room | M1 | room.ts:37, room-manager.ts:299 | room-handler.test.ts | Passed |
| REQ-F-GA56 | Disabled items visible but greyed | M2 | GameActionsMenu.module.css:71-73 | | Passed |
| REQ-F-GA57 | Kebab tooltip "Game Actions" | M2 | GameActionsMenu.tsx:170 | | Passed |
| REQ-F-GA58 | Arrow key menu navigation | M2 | GameActionsMenu.tsx:139-150 | | Passed |
| REQ-F-GA59 | Vote cooldown 120s (same type+target) | M5 | | | Not Started |
| REQ-F-GA60 | No cooldown for host | M5 | | | Not Started |
| REQ-F-GA61 | Cooldown client-side only | M5 | | | Not Started |
| REQ-NF-GA01 | Menu opens instantly (desktop) | M2 | GameActionsMenu.tsx (no delay) | | Passed |
| REQ-NF-GA02 | Drawer 200ms slide transition | M2 | GameActionsDrawer.module.css:28 | | Passed |
| REQ-NF-GA03 | Works at both layout tiers | M3/M4 | | | Not Started |
