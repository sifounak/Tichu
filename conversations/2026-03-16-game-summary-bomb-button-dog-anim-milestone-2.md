# Milestone 2 Transcript: Game Summary Dialog

**Date:** 2026-03-16
**Branch:** feature/game-summary-bomb-button-dog-anim
**Milestone:** M2 — Game Summary Dialog (REQ-F-GS01–GS15, REQ-NF-GS01)

## What Was Implemented

### Type Extensions (shared/src/types/game.ts)
- Added `TichuResult` interface: `{ call: TichuCall; won: boolean }`
- Added `tichuResults: Record<Seat, TichuResult | null>` to `RoundScore` (REQ-F-GS11)
- Added `bombsPerTeam: Record<Team, number>` to `RoundScore` (REQ-F-GS12)
- Added `bombsPerTeam: Record<Team, number>` to `RoundState` (REQ-F-GS13)

### scoring.ts Updates (shared/src/engine/scoring.ts)
- Added `bombsPerTeam` parameter with default `{ northSouth: 0, eastWest: 0 }` (backwards compatible)
- Added `SEATS_IN_ORDER` import
- Computes `tichuResults` per seat: `null` if no call, `{ call, won: seat === firstOut }` otherwise
- Returns `tichuResults` and `bombsPerTeam` in `RoundScore` (REQ-F-GS15)

### Server: game-state-machine.ts
- `createRoundState()`: initialized `bombsPerTeam: { northSouth: 0, eastWest: 0 }` (REQ-F-GS13)
- `playCards` action: increments `round.bombsPerTeam[getTeam(seat)]` when `combination.isBomb` (REQ-F-GS14)
- `scoreAndFinishRound()`: passes `round.bombsPerTeam` to `scoreRound()` (REQ-F-GS15)

### GameEndPhase.tsx — Full Redesign
- Props extended: added `mySeat: Seat`, `onLeaveRoom: () => void`
- Computes `myTeam` and `theirTeam` from `mySeat`
- `computeStats()` function aggregates per-team stats across `roundHistory`
- 2-column grid layout: "Your Team" | "Their Team" (REQ-F-GS03)
- "You won!" / "You lost!" headline in green/red (REQ-F-GS02)
- Stat rows: Grand Tichu won/broken, Tichu won/broken, 1-2 Victories, Bombs (REQ-F-GS04–07)
- Final scores prominently displayed (REQ-F-GS08)
- "Leave Room" + "Start New Game" buttons side-by-side (REQ-F-GS09, REQ-F-GS10)

### GameEndPhase.module.css — New Styles
- Full CSS-variable usage (`--color-success`, `--color-error`, `--color-gold-accent`, etc.) (REQ-NF-GS01)
- `.statsGrid` 2-column layout, `.colHeader`, `.statLabel`, `.statValue`
- `.buttons` flex row with `.leaveButton` and `.newGameButton`

### page.tsx Changes
- Added `mySeat={gameStore.mySeat!}` prop (REQ-F-GS03 support)
- Added `onLeaveRoom={() => router.push('/')}` (REQ-F-GS09)
- Fixed `spectate/[gameId]/page.tsx` to use `mySeat ?? 'south'` and empty `onLeaveRoom`

## Key Decisions
- Used default parameter for `bombsPerTeam` in `scoreRound()` to maintain backwards compatibility with existing test calls
- Spectator page uses `mySeat ?? 'south'` as fallback (spectators have no seat)
- `tichuResults` stores `won = seat === firstOut` (only 1st place wins tichu/grand tichu)

## Test Results
- 43 scoring tests pass (11 new tests for tichuResults and bombsPerTeam)
- 2 pre-existing protocol test failures unrelated to M2 (roomName schema mismatch)
- No new TypeScript errors introduced (REQ-NF-GEN01)

## Coverage
- `scoring.ts` new code: 100% statement coverage (all branches exercised by new tests)
