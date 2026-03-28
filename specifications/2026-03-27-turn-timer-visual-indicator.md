# Turn Timer Visual Indicator

## Overview

Add a visual turn timer indicator visible to all players showing how much time the current player has left to play. The timer is displayed on the active player's `PlayerSeat` component using two visual elements: a depleting SVG border ring around the seat and a countdown badge next to the turn label.

## Requirements

### REQ-F-TT01: Countdown Badge
- Display a small pill-shaped badge showing remaining seconds (number only, no "s" suffix) to the left of the "Your Turn" / "Their Turn" label
- Badge color matches the current timer stage (blue / amber / red)
- Badge only appears on the active player's seat when a turn timer is enabled and running

### REQ-F-TT02: Depleting Border Ring
- Render a thick SVG path stroke around the `PlayerSeat` border that represents the countdown progress
- Ring starts at the center of the top edge and extends counter-clockwise
- Ring starts full (100%) when the turn begins and depletes smoothly to 0% as time runs out
- Uses `stroke-dasharray` with a counter-clockwise path starting from top-center for the depletion effect
- A dim track (low-opacity stroke) shows the full ring outline behind the active stroke

### REQ-F-TT03: Three-Stage Color Transition
- **Blue** (`#4a9eff`): > 50% time remaining — matches existing active turn glow
- **Amber** (`#f39c12`): 17–50% time remaining — warning stage
- **Red** (`#e74c3c`): ≤ 17% time remaining — critical stage (≤5s on a 30s timer)
- Color applies to: border ring stroke, seat box-shadow glow, countdown badge, and ring track tint

### REQ-F-TT04: Critical Stage Pulse Animation
- When in red stage (≤17%), all visual elements pulse in sync at `1s ease-in-out infinite`:
  - Seat `box-shadow` glow pulses between normal and intense red
  - SVG ring stroke pulses width and `drop-shadow`
  - Badge pulses `scale` and `box-shadow`
  - "Your Turn" / "Their Turn" label turns red and pulses opacity (dim at 0%/100%, bright at 50% — synced with glow peak)
- Respects `prefers-reduced-motion`: disables all pulse animations

### REQ-F-TT05: Server Timer Data
- Server includes `turnTimerStartedAt` (epoch ms) and `turnTimerDurationMs` in `ClientGameView` when a turn timer is active
- Both fields are `number | null` — null when timer is disabled or not running
- Values are sent with every `GAME_STATE` broadcast during active play

### REQ-F-TT06: Client-Side Countdown
- A `useTurnTimer` hook reads `turnTimerStartedAt` and `turnTimerDurationMs` from game state
- Runs a local `setInterval` (every 1s) computing remaining seconds from `Date.now() - turnTimerStartedAt`
- Returns `{ remainingSeconds: number, totalSeconds: number, isActive: boolean }`
- Resets when `turnTimerStartedAt` changes (new turn) or becomes null (timer stopped)
- Clamps `remainingSeconds` to 0 minimum (never negative)

### REQ-F-TT07: No Timer Display When Disabled
- When `turnTimerSeconds` is null in game config, no timer fields are sent and no timer UI is shown
- Seat reverts to the existing blue active glow with no badge or ring

## Technical Design

### Data Flow
1. **Server** (`GameManager.onStateChange`): When starting a turn timer, compute `turnTimerStartedAt = Date.now()` and `turnTimerDurationMs = turnTimerSeconds * 1000`. Include both in `ClientGameView`.
2. **Shared** (`protocol.ts` / `game.ts`): Add optional `turnTimerStartedAt` and `turnTimerDurationMs` fields to `ClientGameView`.
3. **Client** (`useTurnTimer` hook): Subscribe to game state, run local countdown interval, return remaining time.
4. **Client** (`TurnTimer` component): New component rendering the SVG ring + badge. Receives `remainingSeconds`, `totalSeconds`.
5. **Client** (`PlayerSeat`): Conditionally render `TurnTimer` when `isCurrentTurn && timer.isActive`. Pass timer stage color to seat className for glow override.

### SVG Ring Implementation
- Use an SVG `<path>` tracing a rounded rectangle matching the seat's `border-radius`
- Path starts at top-center and proceeds counter-clockwise: `M center,top → H left-corner → arc → V bottom → arc → H right-corner → arc → V top → arc → H center`
- Calculate total perimeter once (sum of straight edges + quarter-circle arcs)
- Set `stroke-dasharray` to `"${visibleLength} ${totalPerimeter - visibleLength}"` where `visibleLength = (remainingSeconds / totalSeconds) * totalPerimeter`
- Position SVG absolutely over the seat with `inset: -5px` and `pointer-events: none`

### Color Thresholds
```
const ratio = remainingSeconds / totalSeconds;
if (ratio > 0.5) return 'blue';    // #4a9eff
if (ratio > 0.17) return 'amber';  // #f39c12
return 'red';                       // #e74c3c
```

### Edge Cases
- **Timer disabled** (`turnTimerSeconds: null`): No timer fields sent, no UI shown, existing blue glow preserved
- **Auto-pass** (no valid plays): Timer still briefly visible before 500ms auto-pass fires
- **Reconnect**: Client picks up `turnTimerStartedAt` from fresh game state and resumes countdown mid-timer
- **Seat vacation**: Server stops timer, fields become null, timer UI hides
- **Timer expiry**: When `remainingSeconds` reaches 0, ring is fully depleted; server fires `TURN_TIMEOUT` which advances the turn

## Files to Modify

### Server
- `code/packages/server/src/game/game-manager.ts` — Include timer start time and duration in ClientGameView
- `code/packages/server/src/game/turn-timer.ts` — Expose `getStartTime()` and `getDurationMs()` accessors

### Shared
- `code/packages/shared/src/types/game.ts` — Add `turnTimerStartedAt` and `turnTimerDurationMs` to ClientGameView

### Client (new files)
- `code/packages/client/src/hooks/useTurnTimer.ts` — Timer countdown hook
- `code/packages/client/src/components/game/TurnTimer.tsx` — SVG ring + badge component
- `code/packages/client/src/components/game/TurnTimer.module.css` — Timer styles and animations

### Client (modified files)
- `code/packages/client/src/components/game/PlayerSeat.tsx` — Integrate TurnTimer, add timer-stage glow classes
- `code/packages/client/src/components/game/PlayerSeat.module.css` — Add amber/red glow + pulse animation classes
- `code/packages/client/src/components/game/GameTable.tsx` — Pass timer data to PlayerSeat

## Success Criteria
- All players can see the turn timer countdown on the active player's seat
- Ring depletes smoothly counter-clockwise from top-center
- Color transitions blue → amber → red at correct thresholds
- All critical-stage pulse animations are synchronized
- Timer hidden when disabled in room config
- No visual regression when timer is off (existing blue glow preserved)
- Reconnecting clients see accurate remaining time
