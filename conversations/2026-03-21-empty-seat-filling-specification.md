# Empty Seat Filling Overhaul — Specification Conversation

## Date: 2026-03-21

## Summary of Key Decisions

1. **Timeout**: 30 seconds per spectator seat offer
2. **Explicit leave vs disconnect**: Treated differently
   - Explicit leave (click Leave Room or close browser) → immediate empty seat + queue
   - Disconnect (connection loss) → vote among remaining players (Wait/Kick)
3. **Disconnect vote**: Wait/Kick options, 2/3 majority required, 45-second auto-kick timeout
   - Vote UI: player info boxes show green glow "Vote: Wait" or red glow "Vote: Kick"
   - Players can switch votes at will
   - Spectators see "Waiting for current players to choose..."
4. **Lobby join during queue**: Join as spectator, added to end of queue (fair FIFO)
5. **Seat change scope**: Pre-room only (before first round starts)
6. **Multi-vacancy**: Deciding spectator sees visual table layout with highlighted empty seats to choose from
7. **Up for grabs**: First click wins, auto-assign to first available seat (no seat choice)
8. **Reconnect after Wait vote**: Auto-restore to original seat
9. **Pre-room queue**: Same FIFO queue process applies (consistent with mid-game)
10. **Lobby button**: Green "Join (In Progress)" label for games with empty seats mid-game
11. **Seat inherit**: Drop straight in, no onboarding message
12. **Interaction during queue**: Chat allowed, game frozen
13. **All players leave**: Destroy the game room
14. **Team info in seat picker**: Show standard in-game layout with empty seats highlighted
15. **Empty seat state**: Maintain full previous state (cards, tichu calls, finish order)
16. **AFK voters**: Auto-kick after 45 seconds if no 2/3 majority reached

## Requirements Summary

17 functional requirements (REQ-F-ES01 through REQ-F-ES17) and 3 non-functional requirements (REQ-NF-ES01 through REQ-NF-ES03) covering:
- Empty seat visuals
- Game halt mechanics
- Explicit leave flow
- Disconnect vote flow
- Lobby join button
- FIFO spectator queue
- Claim/pass/timeout handling
- Up-for-grabs fallback
- Queue status display
- Pre-room behavior
- Reconnection handling
- Game destruction
- Multi-player disconnect

Confidence: HIGH — all edge cases addressed through structured elicitation.
