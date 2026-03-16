# Requirements Traceability Matrix — Hard & Expert Bot + Bug Fixes

| Req ID | Description | Source File:Line | Test File:Line | Status |
|---|---|---|---|---|
| REQ-F-BUG01 | Round-ending edge cases (game gets stuck) | game-state-machine.ts:293-301 (isRoundComplete guard), game-state-machine.ts:958 (isRoundOver helper) | round-ending-edge-cases.test.ts:125-180 | Passed |
| REQ-F-BUG02 | Dog animation timing (1s pause + 1s sweep) | TrickDisplay.tsx:163 (1.0s sweep), page.tsx:92-94 (2.0s total) | — (manual verification) | Passed |
| REQ-F-BUG03 | Phoenix singleton display contextual value | game-state-machine.ts:563-571 (contextual rank update) | round-ending-edge-cases.test.ts:213-256 | Passed |
| REQ-F-INFO01 | Bots use only human-available information | — | — | Not Started |
| REQ-F-INFO02 | Expert bot top-10 card tracking + bomb detection | — | — | Not Started |
| REQ-F-CALL01 | Grand Tichu hand evaluation | — | — | Not Started |
| REQ-F-CALL02 | Regular Tichu hand evaluation | — | — | Not Started |
| REQ-F-PASS01 | Strategic passing (low to opponents, best to partner) | — | — | Not Started |
| REQ-F-PASS02 | Dog passing strategy | — | — | Not Started |
| REQ-F-PASS03 | Pass adjustment based on hand strength | — | — | Not Started |
| REQ-F-PASS04 | Expert anti-bomb passing conventions | — | — | Not Started |
| REQ-F-PLAY01 | Lead low, win high | — | — | Not Started |
| REQ-F-PLAY02 | Special card handling (Dragon, Phoenix, Dog, Mahjong) | — | — | Not Started |
| REQ-F-PLAY03 | Bomb timing (save for critical moments) | — | — | Not Started |
| REQ-F-PLAY04 | Partner support (don't overplay partner) | — | — | Not Started |
| REQ-F-PLAY05 | Endgame one-two prevention (Expert) | — | — | Not Started |
| REQ-F-PLAY06 | Hard 10-15% randomness, Expert always optimal | — | — | Not Started |
| REQ-F-PLAY07 | Expert full hand planning at round start | — | — | Not Started |
| REQ-F-DRAG01 | Dragon gift to opponent most likely to go out last | — | — | Not Started |
| REQ-F-WISH01 | Strategic Mahjong wish | — | — | Not Started |
| REQ-F-TIER01 | Difficulty type regular/hard/expert across stack | — | — | Not Started |
| REQ-F-TIER02 | GameManager factory for all 3 bot classes | — | — | Not Started |
| REQ-F-DEF01 | Opponent Tichu defense (save bombs for caller) | — | — | Not Started |
| REQ-NF-PERF01 | Bot decision time < 100ms | — | — | Not Started |
| REQ-NF-MAINT01 | Shared bot-strategy-utils.ts module | — | — | Not Started |
| REQ-NF-TEST01 | 80%+ statement coverage for new code | — | — | Not Started |
