# Conversation: Game Message Routing + Delays — Specification

**Date:** 2026-03-13
**Phase:** Specification

## Summary

Investigation revealed two critical bugs and delay issues:

1. **Game messages not routed:** The MessageRouter only registers room message handlers (via RoomHandler). All game message types (GRAND_TICHU_DECISION, PLAY_CARDS, etc.) return "No handler" errors. Bots work because BotRunner calls actor.send() directly. Human players cannot interact with the game.

2. **Regular Tichu Pass bug:** handleTichuSkip sends GRAND_TICHU_DECISION during the regular Tichu phase, which the server rejects since it's not in grandTichuDecision state.

3. **Delay reductions:** 5 timing constants identified for reduction (lobby polling, room auto-join, bot thinking, tichu dismiss, reconnected message).

## Key Decisions

- Create a new GameHandler class (follows RoomHandler pattern) to route game messages
- Add REGULAR_TICHU_PASS as a new protocol message type
- Handle CHAT_MESSAGE directly in GameHandler (broadcast to room)
- Apply 5 delay reductions across client and server
