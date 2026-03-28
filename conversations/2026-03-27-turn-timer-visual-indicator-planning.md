# Turn Timer Visual Indicator — Planning Conversation

## Summary

### Plan Structure
4 milestones covering server → shared types → client hook → component + styles → integration.

### Key Design Decisions

1. **Server sends epoch timestamp + duration, not remaining seconds** — Client derives remaining time locally via `setInterval`. Handles reconnects, eliminates per-second broadcasts.
2. **Timer info as a projection parameter** — `projectGameState` receives timer data as an argument (not imported from TurnTimer), preserving the pure-function pattern.
3. **Stage computed in the hook** — `useTurnTimer` returns `stage` ('blue'/'amber'/'red') directly, keeping TurnTimer component purely presentational.
4. **SVG path for border ring** — Counter-clockwise rounded-rectangle path from top-center. Uses `stroke-dasharray` for depletion. First SVG in the codebase.
5. **CSS-only pulse sync** — All critical-stage animations use same 1s period. No JS coordination needed.

### Milestones
- **M1**: Server data pipeline (TurnTimer getters → state-projection → broadcaster → game-manager)
- **M2**: Client `useTurnTimer` hook (local countdown interval)
- **M3**: TurnTimer component + all CSS styles (ring, badge, pulse animations)
- **M4**: Integration into PlayerSeat, GameTable, page.tsx

### Files Identified
- Server: turn-timer.ts, state-projection.ts, broadcaster.ts, game-manager.ts
- Shared: game.ts (ClientGameView interface)
- Client new: useTurnTimer.ts, TurnTimer.tsx, TurnTimer.module.css
- Client modified: PlayerSeat.tsx, PlayerSeat.module.css, GameTable.tsx, page.tsx
