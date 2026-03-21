# Requirements Traceability Matrix — Spectator Mode

| Req ID | Description | Source File:Line | Test File:Line | Status |
|---|---|---|---|---|
| REQ-F-SP03 | Room type tracks spectators in FIFO order | shared/types/room.ts:14-20 (RoomSpectator interface) | — | Passed |
| REQ-F-SP04 | Protocol supports spectator join (seat nullable) | shared/types/protocol.ts (ROOM_JOINED seat nullable, JOIN_ROOM asSpectator) | — | Passed |
| REQ-F-SP05 | Spectators see card counts only, no hand data | server/ws/state-projection.ts:142 (projectSpectatorView) | — | Passed |
| REQ-F-SP06 | broadcastGameState() includes spectators | server/ws/broadcaster.ts:53 (broadcastGameState spectator branch) | — | Passed |
| REQ-F-SP02 | Server supports joining room as spectator | server/room/room-manager.ts:joinAsSpectator() | — | Passed |
| REQ-F-SP11 | spectatorCount reflects actual count in lobby | server/room/room-manager.ts:getPublicRooms() | — | Passed |
| REQ-F-SP13 | Spectator reconnection resets queue position | server/room/room-manager.ts:markSpectatorReconnected() | — | Passed |
| REQ-F-SP15 | Room destruction returns spectators to lobby | server/room/room-handler.ts:destroyRoom path | — | Passed |
| REQ-F-SP16 | ROOM_UPDATE includes spectator count | shared/types/protocol.ts (ROOM_UPDATE spectatorCount), server/room/room-handler.ts:broadcastRoomUpdate() | — | Passed |
| REQ-F-SP18 | All-player ready-to-start replaces host-only start | server/room/room-handler.ts:READY_TO_START handler | — | Passed |
| REQ-F-SP20 | Game begins when all 4 players are ready | server/room/room-manager.ts:areAllReady(), room-handler.ts | — | Passed |
| REQ-F-SP21 | Ready state resets when player leaves | server/room/room-manager.ts:resetReady() in leaveRoom() | — | Passed |
| REQ-F-SP22 | Host can create room with empty seats | server/room/room-manager.ts:createRoom() | — | Passed |
| REQ-F-SP23 | Auto-assign seat when joining from lobby | server/room/room-handler.ts:handleJoinRoom() | — | Passed |
| REQ-F-SP25 | Auto-assign and seat selection for subsequent joiners | server/room/room-handler.ts:handleJoinRoom() | — | Passed |
| REQ-F-SP26 | Ready prompt when last seat is taken | server/room/room-handler.ts:broadcastRoomUpdate() + readyPlayers | — | Passed |
| REQ-F-SP29 | Host can add bots to empty seats | server/room/room-handler.ts (existing addBot) | — | Passed |
| REQ-F-SP30 | Bots auto-ready when start is available | server/room/room-handler.ts:auto-ready bots | — | Passed |
| REQ-F-SP07 | Spectator seat priority — FIFO queue processing | server/room/seat-queue.ts:SeatQueue.startQueue() | seat-queue.test.ts (23 tests) | Passed |
| REQ-F-SP08 | Seat offer with 30s timeout and three choices | server/room/seat-queue.ts:offerToSpectator(), handleClaim(), handleDecline() | seat-queue.test.ts:handleClaim, handleDecline, timeout | Passed |
| REQ-F-SP08a | Queue stops when all seats filled | server/room/seat-queue.ts:finishQueue() | seat-queue.test.ts:should finish queue when last seat filled | Passed |
| REQ-F-SP08b | Non-deciding spectators see queue status | server/room/seat-queue.ts:broadcastQueueStatus() | seat-queue.test.ts:should broadcast queue status | Passed |
| REQ-F-SP08c | Up-for-grabs fallback when all decline | server/room/seat-queue.ts:transitionToUpForGrabs() | seat-queue.test.ts:up-for-grabs phase | Passed |
| REQ-F-SP09 | Spectator→player transition seamless | server/room/room-handler.ts:onSeatClaimed callback | — | Passed |
| REQ-F-SP10 | Late joiners enter queue during processing | server/room/seat-queue.ts:addToQueue() | seat-queue.test.ts:addToQueue (late joiners) | Passed |
| REQ-F-SP27 | Lobby joiner with active queue enters as spectator | server/room/room-handler.ts:handleJoinRoom() queue.addToQueue() | — | Passed |
| REQ-F-SP28 | Lobby joiner after queue finished sees up-for-grabs | server/room/seat-queue.ts:up-for-grabs phase | — | Passed |
| REQ-F-SP31 | Host can remove bot mid-game | server/room/room-handler.ts:handleRemoveBot() + tryStartSeatQueue() | — | Passed |
| REQ-F-SP32 | Bot removal mid-game pauses until seat filled | server/room/room-handler.ts:handleRemoveBot() + handleSeatVacated() | — | Passed |
| REQ-F-SP01 | Lobby shows "Spectate" button when room full + spectatorsAllowed | client/app/lobby/page.tsx:handleJoinAsSpectator() | — | Passed |
| REQ-F-SP12 | Spectators see "Waiting for game to start" pre-game | client/app/game/[gameId]/page.tsx:isSpectator loading state | — | Passed |
| REQ-F-SP14 | Spectators read chat but cannot send | client/components/game/ChatPanel.tsx:readOnly prop | — | Passed |
| REQ-F-SP15 (client) | ROOM_CLOSED handler on game page | client/app/game/[gameId]/page.tsx:ROOM_CLOSED handler | — | Passed |
| REQ-F-SP17 | Deprecate /spectate page — redirect to /game | client/app/spectate/[gameId]/page.tsx:redirect() | — | Passed |
| REQ-F-SP19 | Ready player visual indicator (green glow) | client/app/lobby/[roomId]/page.tsx:renderSeatCard isReady | — | Passed |
| REQ-F-SP24 | Seat selection UI when multiple seats available | client/app/lobby/[roomId]/page.tsx:renderSeatCard "Sit Here" buttons | — | Passed |
| REQ-NF-SP01 | Max spectators per room configurable | server/room/room-manager.ts:joinAsSpectator() maxSpectators check | — | Passed |
| REQ-NF-SP02 | Spectator view must not leak hand data | server/ws/state-projection.ts:142 — myHand:[], receivedCards all null, no card objects | broadcaster.test.ts:spectator-projected state | Passed |
