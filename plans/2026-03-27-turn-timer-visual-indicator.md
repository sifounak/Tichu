# Implementation Plan: Turn Timer Visual Indicator

## Context

The turn timer exists on the server (`TurnTimer` class) but no countdown data is sent to clients — players cannot see how much time the current player has left. This feature adds a visual indicator on each `PlayerSeat`: a depleting SVG border ring (counter-clockwise from top-center) + countdown badge next to "Your/Their Turn" label, with a blue→amber→red color progression.

**Spec:** `specifications/2026-03-27-turn-timer-visual-indicator.md` (REQ-F-TT01 through REQ-F-TT07)

---

## Milestone 1: Server Data Pipeline (REQ-F-TT05, REQ-F-TT07)

**Goal:** Expose timer start time and duration in `ClientGameView`.

### Files to modify:

1. **`code/packages/server/src/game/turn-timer.ts`** — Add two public getters:
   - `getStartTime(): number | null` — returns `this.startTime`
   - `getDurationMs(): number | null` — returns `this.durationMs`

2. **`code/packages/shared/src/types/game.ts`** (line 211) — Add to `ClientGameView`:
   ```ts
   turnTimerStartedAt?: number | null;
   turnTimerDurationMs?: number | null;
   ```

3. **`code/packages/server/src/ws/state-projection.ts`** — Add `timerInfo?: { startTime: number | null; durationMs: number | null }` parameter to both `projectGameState` (line 21) and `projectSpectatorView` (line 156). Add `turnTimerStartedAt: timerInfo?.startTime ?? null` and `turnTimerDurationMs: timerInfo?.durationMs ?? null` to all 4 return object literals (lines 37, 82, 167, 204).

4. **`code/packages/server/src/ws/broadcaster.ts`** — Add same `timerInfo` parameter to `broadcastGameState` (line 53). Thread it to `projectGameState` (line 60) and `projectSpectatorView` (line 68).

5. **`code/packages/server/src/game/game-manager.ts`** — In `broadcastState()` and `sendStateTo()`, construct `{ startTime: this.timer.getStartTime(), durationMs: this.timer.getDurationMs() }` and pass to broadcaster/projection calls.

---

## Milestone 2: Client useTurnTimer Hook (REQ-F-TT06)

**Goal:** Local 1s countdown computing remaining time from server timestamps.

### File to create:

**`code/packages/client/src/hooks/useTurnTimer.ts`**

- Accepts `turnTimerStartedAt: number | null | undefined` and `turnTimerDurationMs: number | null | undefined`
- When either is nullish → return inactive state (no interval)
- Uses `useState` + `useEffect` with `setInterval(1000ms)` to compute `remainingSeconds = Math.max(0, Math.ceil((startedAt + durationMs - Date.now()) / 1000))`
- Resets when `turnTimerStartedAt` changes (new turn)
- Derives `stage`: `ratio > 0.5 → 'blue'`, `ratio > 0.17 → 'amber'`, else `'red'`
- Returns `{ remainingSeconds, totalSeconds, isActive, stage }`

---

## Milestone 3: TurnTimer Component + Styles (REQ-F-TT01, REQ-F-TT02, REQ-F-TT03, REQ-F-TT04)

**Goal:** SVG ring + countdown badge + pulse animations as a self-contained component.

### Files to create:

1. **`code/packages/client/src/components/game/TurnTimer.tsx`**
   - Props: `{ remainingSeconds, totalSeconds, stage, seatRef }`
   - Uses `seatRef` (ref to parent `.seat` div) + `useLayoutEffect` to measure width/height and compute SVG viewBox dynamically
   - Renders absolutely-positioned `<svg>` with `pointer-events: none`, `inset: calc(-5px * var(--scale))`
   - Two `<path>` elements (same `d`): dim track + active ring with `stroke-dasharray="${visible} ${gap}"`
   - Path traces counter-clockwise rounded rectangle from top-center matching seat's `border-radius: var(--space-3)`
   - `transition: stroke-dasharray 1s linear` for smooth depletion
   - Does NOT render the badge (badge goes into PlayerSeat's label area — see Milestone 4)

2. **`code/packages/client/src/components/game/TurnTimer.module.css`**
   - `.ring` container: absolute positioning, pointer-events none, z-index above seat
   - Stage color classes: `.blue`, `.amber`, `.red` for stroke color
   - `@keyframes timerRingPulse` (1s ease-in-out infinite): stroke-width + drop-shadow oscillation
   - `@media (prefers-reduced-motion: reduce)` disables all animations

### Files to modify:

3. **`code/packages/client/src/components/game/PlayerSeat.module.css`** — Add:
   - `.timerAmber`: amber border-color + box-shadow (like `.active` but `#f39c12`)
   - `.timerRed`: red border-color + box-shadow (like `.voteKick` but for timer)
   - `@keyframes timerGlowPulse` (1s ease-in-out infinite): seat glow pulses red
   - `.timerRedPulse`: applies timerGlowPulse animation
   - `.timerBadge`: pill badge styling (gradient bg, white text, scaled font, border-radius)
   - `.timerBadgePulse`: badge scale + box-shadow pulse at 1s (synced with glow)
   - `.turnLabelRed`: red color + opacity pulse at 1s (bright at 50%, dim at 0%/100%)
   - `@media (prefers-reduced-motion: reduce)` for all timer animations

---

## Milestone 4: Integration (REQ-F-TT01–TT07)

**Goal:** Wire everything into the component tree.

### Files to modify:

1. **`code/packages/client/src/components/game/PlayerSeat.tsx`**
   - Add props: `turnTimerStartedAt?: number | null`, `turnTimerDurationMs?: number | null`
   - Call `useTurnTimer(turnTimerStartedAt, turnTimerDurationMs)` inside component
   - Add `seatRef = useRef<HTMLDivElement>(null)` on the `.seat` div
   - When `isCurrentTurn && timer.isActive`:
     - Render `<TurnTimer>` as first child of `.seat` div
     - Replace `styles.active` in className with stage-dependent class: blue→`styles.active`, amber→`styles.timerAmber`, red→`styles.timerRed` + `styles.timerRedPulse`
   - Modify turn label (line 204-206): add badge span + conditional `.turnLabelRed` class in red stage
   - Turn label becomes: `<span className={...}><span className={styles.timerBadge}>{remainingSeconds}</span> {isMe ? 'Your Turn' : 'Their Turn'}</span>`

2. **`code/packages/client/src/components/game/GameTable.tsx`** — In `renderSeat()`:
   - Both branches (self line 91, other line 131): add `turnTimerStartedAt={view.turnTimerStartedAt}` and `turnTimerDurationMs={view.turnTimerDurationMs}`

3. **`code/packages/client/src/app/game/[gameId]/page.tsx`** — Add timer props to:
   - Spectator bottom seat (line 1108): `turnTimerStartedAt={view.turnTimerStartedAt}` etc.
   - Action bar player seat (line 1188): same two props

---

## Verification

1. **Server**: Start a game with `turnTimerSeconds: 30`. Verify GAME_STATE messages include `turnTimerStartedAt` and `turnTimerDurationMs` during play phase.
2. **Client countdown**: Verify badge counts down from 30 each turn, resets on new turn, stops at 0.
3. **Color stages**: At >15s blue, 5-15s amber, <5s red with pulsing.
4. **Timer disabled**: Create game with no timer — verify no badge, no ring, normal blue glow.
5. **Reconnect**: Disconnect and rejoin mid-turn — timer should show correct remaining time.
6. **Build**: `npm run build` passes with no type errors.
