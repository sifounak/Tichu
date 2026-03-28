# Turn Timer Visual Indicator — Specification Conversation

## Summary

### Goal
Add a visual turn timer indicator visible to all players showing how much time the current player has left to play.

### Key Design Decisions

1. **Timer placement**: On the active player's `PlayerSeat` component (Option A), not a central timer
2. **Visual elements (final design)**:
   - **Depleting border ring**: Thick SVG path stroke around the seat border, starts at top-center and extends counter-clockwise, depletes as time runs out
   - **Countdown badge**: Small pill-shaped badge showing remaining seconds (no "s" suffix), placed to the left of "Your Turn" / "Their Turn" label
3. **Color progression**: Blue (#4a9eff, >50%) → Amber (#f39c12, 17-50%) → Red (#e74c3c, ≤17%)
   - Blue default matches existing active turn glow — timer feels invisible at first
4. **Critical stage pulse**: All elements pulse in sync at 1s ease-in-out infinite — glow peaks bright when text peaks bright (same phase)
5. **Data flow**: Server sends `turnTimerStartedAt` + `turnTimerDurationMs`; client counts down locally via `setInterval` (hybrid approach — minimal network, smooth UI)

### Design Evolution
- Started with ring overlay on player avatar + mini badge below → user preferred badge next to turn label + border ring around entire seat
- Iterated on: ring direction (clockwise → counter-clockwise from top-center), pulse sync (aligned all animations to same 1s timing and phase), badge format (removed "s" suffix), default color (green → blue to match existing turn glow)

### Specification
Saved to `specifications/2026-03-27-turn-timer-visual-indicator.md` with 7 requirements (REQ-F-TT01 through REQ-F-TT07).
