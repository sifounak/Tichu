# Create Game Settings Popup — Specification Conversation

**Date:** 2026-03-21
**Phase:** Specification (Phase 1.2)

## Key Decisions

1. **Flow change:** Lobby → settings popup → directly to game page (skip room waiting page entirely)
2. **Settings popup contents:** Target score, turn timer, animation speed, private room, allow spectators. Bot difficulty excluded (chosen per-seat on game page).
3. **Room waiting page:** Removed entirely. Both creators and joiners go directly to game page.
4. **Game start:** All players (including bots) must confirm ready. "Start Game" button in center of play area for all players.
5. **Bot controls on game page:** Only host sees bot controls. Layout: Difficulty dropdown + Add Bot button, stacked vertically.
6. **Bots auto-ready:** Bots automatically enter ready state when added pre-game.
7. **Host controls on game page:** Host can remove bots, kick players, and change room settings pre-game.
8. **Button rename:** "Create Room" → "Create Game" on lobby page.
9. **CREATE_ROOM protocol:** Extended to accept optional config payload with game settings.
10. **Room code display:** Shown on game page pre-game so others can join.

## Specification Output

Serialized to: `specifications/2026-03-21-spec-create-game-settings-popup.md`
