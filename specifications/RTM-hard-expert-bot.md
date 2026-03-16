# Requirements Traceability Matrix — Hard & Expert Bot + Bug Fixes

| Req ID | Description | Source File:Line | Test File:Line | Status |
|---|---|---|---|---|
| REQ-F-BUG01 | Round-ending edge cases (game gets stuck) | game-state-machine.ts:293-301 (isRoundComplete guard), game-state-machine.ts:958 (isRoundOver helper) | round-ending-edge-cases.test.ts:125-180 | Passed |
| REQ-F-BUG02 | Dog animation timing (1s pause + 1s sweep) | TrickDisplay.tsx:163 (1.0s sweep), page.tsx:92-94 (2.0s total) | — (manual verification) | Passed |
| REQ-F-BUG03 | Phoenix singleton display contextual value | game-state-machine.ts:563-571 (contextual rank update) | round-ending-edge-cases.test.ts:213-256 | Passed |
| REQ-F-INFO01 | Bots use only human-available information | bot-strategy-utils.ts (all functions), hard-bot.ts:14 | hard-bot.test.ts:649, bot-strategy-utils.test.ts | Passed |
| REQ-F-INFO02 | Expert bot top-10 card tracking + bomb detection | — | — | Not Started |
| REQ-F-CALL01 | Grand Tichu hand evaluation | hard-bot.ts:67-81 (chooseGrandTichu) | hard-bot.test.ts:82-130 | Passed |
| REQ-F-CALL02 | Regular Tichu hand evaluation | hard-bot.ts:91-99 (chooseRegularTichu) | hard-bot.test.ts:147-175 | Passed |
| REQ-F-PASS01 | Strategic passing (low to opponents, best to partner) | hard-bot.ts:106-113 (chooseCardsToPass) | hard-bot.test.ts:182-224 | Passed |
| REQ-F-PASS02 | Dog passing strategy | hard-bot.ts:106-113 (delegates to selectPassCards) | hard-bot.test.ts:182-224 | Passed |
| REQ-F-PASS03 | Pass adjustment based on hand strength | hard-bot.ts:106-113 (delegates to selectPassCards) | hard-bot.test.ts:182-224 | Passed |
| REQ-F-PASS04 | Expert anti-bomb passing conventions | — | — | Not Started |
| REQ-F-PLAY01 | Lead low, win high | hard-bot.ts:119-150, 178-186 (chooseLeadPlay) | hard-bot.test.ts:232-258 | Passed |
| REQ-F-PLAY02 | Special card handling (Dragon, Phoenix, Dog, Mahjong) | hard-bot.ts:119-150 (choosePlay), 178-186 (Dog lead) | hard-bot.test.ts:466-541 | Passed |
| REQ-F-PLAY03 | Bomb timing (save for critical moments) | hard-bot.ts:133-141, 229-238 (shouldPlayBomb + makeBombDecision) | hard-bot.test.ts:375-462 | Passed |
| REQ-F-PLAY04 | Partner support (don't overplay partner) | hard-bot.ts:193-206 (chooseFollowPlay partner check) | hard-bot.test.ts:262-311 | Passed |
| REQ-F-PLAY05 | Endgame one-two prevention (Expert) | — | — | Not Started |
| REQ-F-PLAY06 | Hard 10-15% randomness, Expert always optimal | hard-bot.ts:42 (HARD_BOT_RANDOM_FACTOR=0.12), 180-181, 215-216 | hard-bot.test.ts:316-371 | Passed |
| REQ-F-PLAY07 | Expert full hand planning at round start | — | — | Not Started |
| REQ-F-DRAG01 | Dragon gift to opponent most likely to go out last | hard-bot.ts:157-159 (chooseDragonGiftRecipient) | hard-bot.test.ts:591-618 | Passed |
| REQ-F-WISH01 | Strategic Mahjong wish | hard-bot.ts:169-171 (chooseMahjongWish) | hard-bot.test.ts:620-646 | Passed |
| REQ-F-TIER01 | Difficulty type regular/hard/expert across stack | game.ts:114, protocol.ts:37+42, bot-interface.ts:45, game-manager.ts:192, lobby/page.tsx:336+346 | — (type system verified by compilation) | Passed |
| REQ-F-TIER02 | GameManager factory for all 3 bot classes | game-manager.ts:195 (case 'hard': new HardBot()) | bot-runner.test.ts (full game smoke) | In Progress |
| REQ-F-DEF01 | Opponent Tichu defense (save bombs for caller) | hard-bot.ts:133-141 (shouldPlayBomb check for Tichu callers) | hard-bot.test.ts:544-587 | Passed |
| REQ-NF-PERF01 | Bot decision time < 100ms | — | — | Not Started |
| REQ-NF-MAINT01 | Shared bot-strategy-utils.ts module | bot-strategy-utils.ts (30+ functions) | bot-strategy-utils.test.ts (27 tests) | Passed |
| REQ-NF-TEST01 | 80%+ statement coverage for new code | hard-bot.ts: 92.59% stmts | — | In Progress |
