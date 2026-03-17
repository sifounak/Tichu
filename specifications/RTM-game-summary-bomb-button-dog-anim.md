# Requirements Traceability Matrix: Game Summary, Bomb Button, Dog Animation

**Feature:** Game Summary Dialog, Out-of-Turn Bomb Button, Dog Animation Fix
**Spec:** specifications/2026-03-16-game-summary-bomb-button-dog-anim.md
**Plan:** plans/parallel-noodling-lynx.md

| Req ID | Description | Milestone | Source File | Test File | Status |
|--------|-------------|-----------|-------------|-----------|--------|
| REQ-F-GS01 | Game-over modal overlay | M2 | client/src/components/phases/GameEndPhase.tsx:22 | tests/shared/scoring.test.ts | Passed |
| REQ-F-GS02 | You won/lost headline | M2 | client/src/components/phases/GameEndPhase.tsx:84 | tests/shared/scoring.test.ts | Passed |
| REQ-F-GS03 | 2-column Your Team / Their Team layout | M2 | client/src/components/phases/GameEndPhase.tsx:88 | tests/shared/scoring.test.ts | Passed |
| REQ-F-GS04 | Grand Tichu Won/Broken stat | M2 | client/src/components/phases/GameEndPhase.tsx:103 | tests/shared/scoring.test.ts | Passed |
| REQ-F-GS05 | Tichu Won/Broken stat | M2 | client/src/components/phases/GameEndPhase.tsx:108 | tests/shared/scoring.test.ts | Passed |
| REQ-F-GS06 | 1-2 Victories stat | M2 | client/src/components/phases/GameEndPhase.tsx:113 | tests/shared/scoring.test.ts | Passed |
| REQ-F-GS07 | Bombs stat | M2 | client/src/components/phases/GameEndPhase.tsx:118 | tests/shared/scoring.test.ts | Passed |
| REQ-F-GS08 | Final scores displayed | M2 | client/src/components/phases/GameEndPhase.tsx:94 | tests/shared/scoring.test.ts | Passed |
| REQ-F-GS09 | Leave Room button | M2 | client/src/components/phases/GameEndPhase.tsx:124 | — | Passed |
| REQ-F-GS10 | Start New Game button | M2 | client/src/components/phases/GameEndPhase.tsx:127 | — | Passed |
| REQ-F-GS11 | RoundScore.tichuResults type | M2 | shared/src/types/game.ts:86 | tests/shared/scoring.test.ts | Passed |
| REQ-F-GS12 | RoundScore.bombsPerTeam type | M2 | shared/src/types/game.ts:89 | tests/shared/scoring.test.ts | Passed |
| REQ-F-GS13 | RoundState.bombsPerTeam tracking | M2 | server/src/game/game-state-machine.ts:135 | — | Passed |
| REQ-F-GS14 | bombsPerTeam increment on bomb play | M2 | server/src/game/game-state-machine.ts:571 | — | Passed |
| REQ-F-GS15 | scoreRound() tichuResults + bombsPerTeam | M2 | shared/src/engine/scoring.ts:48 | tests/shared/scoring.test.ts | Passed |
| REQ-F-BB01 | detectAllBombs() shared function | M3 | shared/src/engine/combination-detector.ts:516 | shared/tests/engine/combination-detector.test.ts | Passed |
| REQ-F-BB02 | Bomb button appears right of hand | M3 | client/src/app/game/[gameId]/page.tsx:821 | — | Passed |
| REQ-F-BB03 | Bomb button hidden when no bombs | M3 | client/src/app/game/[gameId]/page.tsx:821 | shared/tests/engine/combination-detector.test.ts | Passed |
| REQ-F-BB04 | Single bomb: click plays immediately | M3 | client/src/app/game/[gameId]/page.tsx:832 | — | Passed |
| REQ-F-BB05 | Multiple bombs: hover shows popup | M3 | client/src/app/game/[gameId]/page.tsx:845 | — | Passed |
| REQ-F-BB06 | Popup click plays specific bomb | M3 | client/src/app/game/[gameId]/page.tsx:873 | — | Passed |
| REQ-F-BB07 | Straight-flush sub-sequences enumerated | M3 | shared/src/engine/combination-detector.ts:558 | shared/tests/engine/combination-detector.test.ts | Passed |
| REQ-F-BB08 | Four-of-a-kind uses exactly 4 cards | M3 | shared/src/engine/combination-detector.ts:540 | shared/tests/engine/combination-detector.test.ts | Passed |
| REQ-F-DA02 | Dog entry uses durations.cardPlay | M1 | client/src/components/game/TrickDisplay.tsx:81 | — | Passed |
| REQ-F-DA03 | Dog rests 1.0s before sweep triggers | M1 | client/src/app/game/[gameId]/page.tsx:350 | — | Passed |
| REQ-F-DA04 | Dog sweep uses trickSweep, no internal delay | M1 | client/src/components/game/TrickDisplay.tsx:89 | — | Passed |
| REQ-F-DA05 | Gameplay blocked until sweep completes | M1 | client/src/app/game/[gameId]/page.tsx:352 | — | Passed |
| REQ-F-DA06 | Total animation 1.65s at normal speed | M1 | client/src/app/game/[gameId]/page.tsx:344 | — | Passed |
| REQ-NF-GS01 | Stats dialog uses CSS variables | M2 | client/src/components/phases/GameEndPhase.module.css:50 | — | Passed |
| REQ-NF-BB01 | Bomb button consistent with Tichu button | M3 | client/src/app/game/[gameId]/page.tsx:823 | — | Passed |
| REQ-NF-DA01 | Dog timing scales with animMultiplier | M1 | client/src/app/game/[gameId]/page.tsx:344 | — | Passed |
| REQ-NF-GEN01 | No new TypeScript errors | All | All | tsc --noEmit | Passed |
