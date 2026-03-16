# Requirements Traceability Matrix — Hard & Expert Bot + Bug Fixes

| Req ID | Description | Source File:Line | Test File:Line | Status |
|---|---|---|---|---|
| REQ-F-BUG01 | Round-ending edge cases (game gets stuck) | game-state-machine.ts:293-301 (isRoundComplete guard), game-state-machine.ts:958 (isRoundOver helper) | round-ending-edge-cases.test.ts:125-180 | Passed |
| REQ-F-BUG02 | Dog animation timing (1s pause + 1s sweep) | TrickDisplay.tsx:163 (1.0s sweep), page.tsx:92-94 (2.0s total) | — (manual verification) | Passed |
| REQ-F-BUG03 | Phoenix singleton display contextual value | game-state-machine.ts:563-571 (contextual rank update) | round-ending-edge-cases.test.ts:213-256 | Passed |
| REQ-F-INFO01 | Bots use only human-available information | bot-strategy-utils.ts (all functions), hard-bot.ts:14, expert-bot.ts:9 | hard-bot.test.ts:649, expert-bot.test.ts:538, bot-strategy-utils.test.ts | Passed |
| REQ-F-INFO02 | Expert bot top-10 card tracking + bomb detection | card-tracker.ts:1-235 (CardTracker class) | card-tracker.test.ts:1-250 (18 tests) | Passed |
| REQ-F-CALL01 | Grand Tichu hand evaluation | hard-bot.ts:67-81, expert-bot.ts:96-112 | hard-bot.test.ts:82-130, expert-bot.test.ts:95-143 | Passed |
| REQ-F-CALL02 | Regular Tichu hand evaluation (Expert: score-aware) | hard-bot.ts:91-99, expert-bot.ts:118-155 (setScoreDiff) | hard-bot.test.ts:147-175, expert-bot.test.ts:148-240 | Passed |
| REQ-F-PASS01 | Strategic passing (low to opponents, best to partner) | hard-bot.ts:106-113 (chooseCardsToPass) | hard-bot.test.ts:182-224 | Passed |
| REQ-F-PASS02 | Dog passing strategy | hard-bot.ts:106-113 (delegates to selectPassCards) | hard-bot.test.ts:182-224 | Passed |
| REQ-F-PASS03 | Pass adjustment based on hand strength | hard-bot.ts:106-113 (delegates to selectPassCards) | hard-bot.test.ts:182-224 | Passed |
| REQ-F-PASS04 | Expert anti-bomb passing conventions | expert-bot.ts:161-186 (chooseCardsToPass anti-bomb check) | expert-bot.test.ts:245-280 | Passed |
| REQ-F-PLAY01 | Lead low, win high | hard-bot.ts:119-150, expert-bot.ts:192-208 | hard-bot.test.ts:232-258, expert-bot.test.ts:287-310 | Passed |
| REQ-F-PLAY02 | Special card handling (Dragon, Phoenix, Dog, Mahjong) | hard-bot.ts:119-150, expert-bot.ts:192-208 | hard-bot.test.ts:466-541, expert-bot.test.ts:348-396 | Passed |
| REQ-F-PLAY03 | Bomb timing (save for critical moments) | hard-bot.ts:133-141, expert-bot.ts:196-202 | hard-bot.test.ts:375-462, expert-bot.test.ts:330-345 | Passed |
| REQ-F-PLAY04 | Partner support (don't overplay partner) | hard-bot.ts:193-206, expert-bot.ts:400-412 | hard-bot.test.ts:262-311, expert-bot.test.ts:312-327 | Passed |
| REQ-F-PLAY05 | Endgame one-two prevention (Expert) | expert-bot.ts:237-280 (shouldPreventOneTwo + chooseOneTwoPreventionPlay) | expert-bot.test.ts:401-472 | Passed |
| REQ-F-PLAY06 | Hard 10-15% randomness, Expert always optimal | hard-bot.ts:42, expert-bot.ts (no randomFactor) | hard-bot.test.ts:316-371, expert-bot.test.ts:287-330 | Passed |
| REQ-F-PLAY07 | Expert full hand planning at round start | expert-bot.ts:294-367 (createHandPlan) | expert-bot.test.ts:474-535 | Passed |
| REQ-F-DRAG01 | Dragon gift to opponent most likely to go out last | hard-bot.ts:157-159, expert-bot.ts:215-217 | hard-bot.test.ts:591-618, expert-bot.test.ts:545-570 | Passed |
| REQ-F-WISH01 | Strategic Mahjong wish | hard-bot.ts:169-171, expert-bot.ts:222-224 | hard-bot.test.ts:620-646, expert-bot.test.ts:575-595 | Passed |
| REQ-F-TIER01 | Difficulty type regular/hard/expert across stack | game.ts:114, protocol.ts:37+42, bot-interface.ts:45, game-manager.ts:192, lobby/page.tsx:336+346 | — (type system verified by compilation) | Passed |
| REQ-F-TIER02 | GameManager factory for all 3 bot classes | game-manager.ts:195-199 (case 'hard': HardBot, case 'expert': ExpertBot) | bot-runner.test.ts (full game smoke) | Passed |
| REQ-F-DEF01 | Opponent Tichu defense (save bombs for caller) | hard-bot.ts:133-141, expert-bot.ts:196-202 | hard-bot.test.ts:544-587, expert-bot.test.ts:382-398 | Passed |
| REQ-NF-PERF01 | Bot decision time < 100ms | — | — | Not Started |
| REQ-NF-MAINT01 | Shared bot-strategy-utils.ts module | bot-strategy-utils.ts (30+ functions) | bot-strategy-utils.test.ts (27 tests) | Passed |
| REQ-NF-TEST01 | 80%+ statement coverage for new code | card-tracker.ts: 100%, expert-bot.ts: 93.38%, hard-bot.ts: 92.59% | — | Passed |
