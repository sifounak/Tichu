# Create Game Settings Popup — Planning Conversation

**Date:** 2026-03-21
**Phase:** Planning (Phase 1.4)

## Key Decisions

1. **4 milestones:** Protocol/server → Lobby popup + navigation → Game page pre-room → Documentation
2. **PreRoomView as separate component** rather than extending GameTable — cleaner separation
3. **Pre-room rendering branch** inserted before the loading gate in game page
4. **Auto-join on connect** for direct navigation to `/game/[roomCode]`
5. **ROOM_UPDATE handler** added to game page message handler
6. **Shared config schema** extracted from CONFIGURE_ROOM for reuse in CREATE_ROOM

## Plan Output

Serialized to: `plans/2026-03-21-create-game-settings-popup.md`
RTM: `specifications/RTM-create-game-settings-popup.md`
