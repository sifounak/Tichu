# Requirements Traceability Matrix: Game Summary, Bomb Button, Dog Animation

**Feature:** Game Summary Dialog, Out-of-Turn Bomb Button, Dog Animation Fix
**Spec:** specifications/2026-03-16-game-summary-bomb-button-dog-anim.md
**Plan:** plans/parallel-noodling-lynx.md

| Req ID | Description | Milestone | Source File | Test File | Status |
|--------|-------------|-----------|-------------|-----------|--------|
| REQ-F-GS01 | Game-over modal overlay | M2 | client/src/components/phases/GameEndPhase.tsx | tests/components/phases/GameEndPhase.test.tsx | Pending |
| REQ-F-GS02 | You won/lost headline | M2 | client/src/components/phases/GameEndPhase.tsx | tests/components/phases/GameEndPhase.test.tsx | Pending |
| REQ-F-GS03 | 2-column Your Team / Their Team layout | M2 | client/src/components/phases/GameEndPhase.tsx | tests/components/phases/GameEndPhase.test.tsx | Pending |
| REQ-F-GS04 | Grand Tichu Won/Broken stat | M2 | client/src/components/phases/GameEndPhase.tsx | tests/components/phases/GameEndPhase.test.tsx | Pending |
| REQ-F-GS05 | Tichu Won/Broken stat | M2 | client/src/components/phases/GameEndPhase.tsx | tests/components/phases/GameEndPhase.test.tsx | Pending |
| REQ-F-GS06 | 1-2 Victories stat | M2 | client/src/components/phases/GameEndPhase.tsx | tests/components/phases/GameEndPhase.test.tsx | Pending |
| REQ-F-GS07 | Bombs stat | M2 | client/src/components/phases/GameEndPhase.tsx | tests/components/phases/GameEndPhase.test.tsx | Pending |
| REQ-F-GS08 | Final scores displayed | M2 | client/src/components/phases/GameEndPhase.tsx | tests/components/phases/GameEndPhase.test.tsx | Pending |
| REQ-F-GS09 | Leave Room button | M2 | client/src/components/phases/GameEndPhase.tsx | tests/components/phases/GameEndPhase.test.tsx | Pending |
| REQ-F-GS10 | Start New Game button | M2 | client/src/components/phases/GameEndPhase.tsx | tests/components/phases/GameEndPhase.test.tsx | Pending |
| REQ-F-GS11 | RoundScore.tichuResults type | M2 | shared/src/types/game.ts | tests/shared/scoring.test.ts | Pending |
| REQ-F-GS12 | RoundScore.bombsPerTeam type | M2 | shared/src/types/game.ts | tests/shared/scoring.test.ts | Pending |
| REQ-F-GS13 | RoundState.bombsPerTeam tracking | M2 | server/src/game/game-state-machine.ts | tests/server/game-state-machine.test.ts | Pending |
| REQ-F-GS14 | bombsPerTeam increment on bomb play | M2 | server/src/game/game-state-machine.ts | tests/server/game-state-machine.test.ts | Pending |
| REQ-F-GS15 | scoreRound() tichuResults + bombsPerTeam | M2 | shared/src/engine/scoring.ts | tests/shared/scoring.test.ts | Pending |
| REQ-F-BB01 | detectAllBombs() shared function | M3 | shared/src/engine/combination-detector.ts | tests/shared/combination-detector.test.ts | Pending |
| REQ-F-BB02 | Bomb button appears right of hand | M3 | client/src/app/game/[gameId]/page.tsx | tests/client/page.test.tsx | Pending |
| REQ-F-BB03 | Bomb button hidden when no bombs | M3 | client/src/app/game/[gameId]/page.tsx | tests/client/page.test.tsx | Pending |
| REQ-F-BB04 | Single bomb: click plays immediately | M3 | client/src/app/game/[gameId]/page.tsx | tests/client/page.test.tsx | Pending |
| REQ-F-BB05 | Multiple bombs: hover shows popup | M3 | client/src/app/game/[gameId]/page.tsx | tests/client/page.test.tsx | Pending |
| REQ-F-BB06 | Popup click plays specific bomb | M3 | client/src/app/game/[gameId]/page.tsx | tests/client/page.test.tsx | Pending |
| REQ-F-BB07 | Straight-flush sub-sequences enumerated | M3 | shared/src/engine/combination-detector.ts | tests/shared/combination-detector.test.ts | Pending |
| REQ-F-BB08 | Four-of-a-kind uses exactly 4 cards | M3 | shared/src/engine/combination-detector.ts | tests/shared/combination-detector.test.ts | Pending |
| REQ-F-DA02 | Dog entry uses durations.cardPlay | M1 | client/src/components/game/TrickDisplay.tsx | tests/client/TrickDisplay.test.tsx | Pending |
| REQ-F-DA03 | Dog rests 1.0s before sweep triggers | M1 | client/src/app/game/[gameId]/page.tsx | tests/client/page.test.tsx | Pending |
| REQ-F-DA04 | Dog sweep uses trickSweep, no internal delay | M1 | client/src/components/game/TrickDisplay.tsx | tests/client/TrickDisplay.test.tsx | Pending |
| REQ-F-DA05 | Gameplay blocked until sweep completes | M1 | client/src/app/game/[gameId]/page.tsx | tests/client/page.test.tsx | Pending |
| REQ-F-DA06 | Total animation 1.65s at normal speed | M1 | client/src/app/game/[gameId]/page.tsx | — | Pending |
| REQ-NF-GS01 | Stats dialog uses CSS variables | M2 | client/src/components/phases/GameEndPhase.module.css | — | Pending |
| REQ-NF-BB01 | Bomb button consistent with Tichu button | M3 | client/src/app/game/[gameId]/page.tsx | — | Pending |
| REQ-NF-DA01 | Dog timing scales with animMultiplier | M1 | client/src/app/game/[gameId]/page.tsx | — | Pending |
| REQ-NF-GEN01 | No new TypeScript errors | All | All | tsc --noEmit | Pending |
