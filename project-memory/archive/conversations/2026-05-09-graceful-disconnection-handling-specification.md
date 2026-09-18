# Graceful Disconnection Handling — Specification Conversation

## Summary of Key Decisions

1. **No game pause on disconnect** — Game continues normally; disconnected player appears as a slow player
2. **Timed vs untimed phases** — Timed phases (active play) use existing turn timer + auto-action; untimed phases (GT call, card passing, Dragon gift) wait indefinitely
3. **Bomb window** — Runs naturally; disconnected player treated as choosing not to bomb
4. **2-minute threshold** — After 2 min + 5 sec delay, kick dialog shown to all connected players
5. **Single-player kick** — Any one player can trigger an immediate kick (no unanimous vote)
6. **Timer resets fully on reconnect** — No accumulation across disconnect/reconnect cycles
7. **Vote integration** — Players disconnected 2+ min excluded from votes; crossing threshold during vote dismisses vote, shows kick dialog, then restarts prior vote
8. **Turn timer pauses during votes** — Resets to full duration after vote ends
9. **Kick dialog non-blocking** — Players can still take game actions while dialog shows
10. **No visual indicator outside disconnected player's untimed turn** — Prevents premature frustration
11. **Spectators** — See overlay, don't get kick dialog
12. **Sequential kick dialogs** — Queued by threshold crossing order; reconnected players removed from queue
13. **Kick = existing vacancy logic** — Seat offered to spectators, host can add bot
14. **Reconnect during kick dialog** — Dialog dismissed, prior interrupted vote restarted
15. **One-time dialog per disconnect session** — Player dismissal = no reappear; system interruption = reappear after resolution

## Specification Output

Written to: `specifications/2026-05-09-graceful-disconnection-handling.md`

## Requirements Count

- Functional: 4 DC + 4 GF + 3 UI + 14 KM + 9 VI = 34 requirements
- Non-Functional: 4 requirements
- Total: 38 requirements

## Confidence: High
