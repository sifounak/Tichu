# Implementation Plan — Grand Tichu Real-Time Decisions

**Date:** 2026-03-16
**Spec:** specifications/2026-03-16-grand-tichu-realtime-decisions.md
**Branch:** feature/grand-tichu-realtime-decisions

---

## Milestone 1 — Data Plumbing

**Goal:** `grandTichuDecided` flows correctly from server → store → game page.

**Requirements:** REQ-F-GT02, REQ-NF-GT01

### Files

#### `code/packages/client/src/stores/gameStore.ts`
1. Add `grandTichuDecided: Seat[]` to `GameStore` interface
2. Add `grandTichuDecided: [] as Seat[]` to `initialState`
3. In `applyGameState`, add `grandTichuDecided: view.grandTichuDecided`

#### `code/packages/client/src/app/game/[gameId]/page.tsx`
1. Line ~505: change `grandTichuDecided: []` to `grandTichuDecided: gameStore.grandTichuDecided`

### Tests
- `code/packages/client/src/stores/__tests__/gameStore.test.ts` (new file)
  - `applyGameState` stores `grandTichuDecided` from view
  - `applyGameState` resets `grandTichuDecided` to `[]` on new round (empty array)
  - `reset()` clears `grandTichuDecided`

### Acceptance
- `gameStore.grandTichuDecided` reflects server data after `applyGameState`
- No TypeScript errors

---

## Milestone 2 — Real-Time UI

**Goal:** `PreGamePhase` shows live decision status during the Grand Tichu phase.

**Requirements:** REQ-F-GT03, REQ-F-GT04, REQ-F-GT05, REQ-NF-GT02

### Files

#### `code/packages/client/src/components/phases/PreGamePhase.tsx`
The `grandTichuDecision` branch (currently lines 58–81) needs to be extended:

**Logic:**
```
hasMadeDecision = grandTichuDecided?.includes(mySeat) ?? false
```

**If `hasMadeDecision` (waiting screen):**
- Title: "Waiting for other players..."
- Show own decision: "You called Grand Tichu!" (gold) or "You passed"
- For each other player: show name + status badge
  - Not in `grandTichuDecided`: "Deciding..." (muted)
  - In `grandTichuDecided`, tichuCall === 'grandTichu': "Grand Tichu!" (gold)
  - In `grandTichuDecided`, tichuCall === 'none': "Passed" (muted)

**If `!hasMadeDecision` (decision screen with status):**
- Keep existing Pass / Grand Tichu! buttons
- Add a status row below buttons: for each other player, show name + status badge using same logic above

**How to distinguish my call:** `myTichuCall` prop already exists on the component as `otherPlayerCalls` includes other players; for self, read from `myTichuCall` but we can derive it: if `grandTichuDecided` includes `mySeat`, check `otherPlayerCalls` doesn't have mySeat (it won't — `otherPlayerCalls` is other players). The game page passes `myTichuCall` indirectly through the view.

Actually: the page needs to also pass `myTichuCall` or we derive the self-call from the `gameStore.myTichuCall`. The cleanest approach: add a `myGrandTichuCall?: TichuCall` prop to `PreGamePhaseProps`, populated from `gameStore.myTichuCall`.

#### `code/packages/client/src/components/phases/PreGamePhase.module.css`
Add:
- `.decisionStatus` — flex column, gap between rows
- `.statusRow` — flex row, name + badge, space-between
- `.statusBadge` — small pill badge
- `.statusBadgeCall` — gold background (Grand Tichu called)
- `.statusBadgePass` — muted background (passed)
- `.statusBadgeWaiting` — dim/italic (waiting)
- `.waitingTitle` — styled title for waiting screen
- `.myDecision` — banner showing own decision

### Tests
- `code/packages/client/src/components/phases/__tests__/PreGamePhase.test.tsx` (new or extend)
  - REQ-F-GT03: Undecided player sees buttons + other players' statuses
  - REQ-F-GT04: Decided player sees waiting screen (no buttons)
  - REQ-F-GT05: Grand Tichu callers vs passers use different class names

### Acceptance
- Snapshot/behavior tests pass
- No layout regression (CSS modules scope ensures isolation)

---

## Milestone 3 — Bot Timing

**Goal:** Bots decide Grand Tichu at exactly 1000 ms; no duplicate timers.

**Requirements:** REQ-F-GT06, REQ-F-GT07

### Files

#### `code/packages/server/src/bot/bot-runner.ts`
1. Add `private readonly grandTichuTimerSeats = new Set<Seat>()` — tracks seats that already have a Grand Tichu timer pending
2. In `handleGrandTichuPhase`, before `scheduleAction`:
   - If `grandTichuTimerSeats.has(seat)`, skip (timer already pending)
   - Add `seat` to `grandTichuTimerSeats` before scheduling
   - In the callback, remove `seat` from `grandTichuTimerSeats` before sending event
3. Use `GRAND_TICHU_DELAY_MS = 1000` constant instead of random `scheduleAction` delay
   - In instant mode (`minDelayMs === 0`), use 0 ms as before
4. In `dispose()`, clear `grandTichuTimerSeats`

### Tests
- `code/packages/server/src/bot/__tests__/bot-runner.test.ts` (new or extend)
  - REQ-F-GT06: Grand Tichu timer fires at 1000 ms (fake timers)
  - REQ-F-GT07: Second `onStateChange` call during pending timer does not schedule duplicate
  - Existing instant-mode tests still pass

### Acceptance
- Bot fires exactly once per round for Grand Tichu
- 1000 ms delay in production mode, 0 ms in `INSTANT_CONFIG`

---

## Testing Strategy

All tests use Vitest. Run: `cd code && pnpm test`

| Milestone | Test files |
|-----------|-----------|
| M1 | `client/src/stores/__tests__/gameStore.test.ts` |
| M2 | `client/src/components/phases/__tests__/PreGamePhase.test.tsx` |
| M3 | `server/src/bot/__tests__/bot-runner.test.ts` |

Coverage target: ≥ 80% statement coverage on all modified files.

---

## Revision History

| Rev | Date | Change |
|-----|------|--------|
| 1.0 | 2026-03-16 | Initial plan |
