# Requirements Traceability Matrix — Expert Bot Strategy Rewrite

| Req ID | Description | Milestone | Source File(s) | Test File(s) | Status |
|---|---|---|---|---|---|
| REQ-F-GT01 | Stanford Grand Tichu Index | M1 | bot-strategy-utils.ts:30 | bot-strategy-utils.test.ts:434 | Passed |
| REQ-F-GT02 | Score-Adaptive Grand Tichu Thresholds | M1 | expert-bot.ts:86 | expert-bot.test.ts:97 | Passed |
| REQ-F-RT01 | Stanford Tichu Index | M1 | bot-strategy-utils.ts:45 | bot-strategy-utils.test.ts:478 | Passed |
| REQ-F-RT02 | Score-Adaptive Tichu Thresholds | M1 | expert-bot.ts:122 | expert-bot.test.ts:247 | Passed |
| REQ-F-PASS01 | Strength Concentration | M2 | expert-bot.ts:153 | expert-bot.test.ts:345 | Passed |
| REQ-F-PASS02 | Parity Convention | M2 | expert-bot.ts:206 | expert-bot.test.ts:374 | Passed |
| REQ-F-PASS03 | Anti-Bomb Check | M2 | expert-bot.ts:195 | expert-bot.test.ts:327 | Passed |
| REQ-F-PASS04 | Special Card Rules | M2 | expert-bot.ts:163 | expert-bot.test.ts:388 | Passed |
| REQ-F-PASS05 | Track Passed Card for Mah Jong | M2 | expert-bot.ts:228 | expert-bot.test.ts:420 | Passed |
| REQ-F-DOG01 | Context-Dependent Dog Play | M3 | expert-bot.ts:468 | expert-bot.test.ts:745 | Passed |
| REQ-F-PHX01 | Hand-Dependent Phoenix Evaluation | M4 | expert-bot.ts:439 | expert-bot.test.ts:1043 | Passed |
| REQ-F-BOMB01 | Enhanced Offensive Bomb Timing | M5 | expert-bot.ts:430 | expert-bot.test.ts:1199 | Passed |
| REQ-F-BOMB02 | Bomb-Proof Exit Planning | M5 | expert-bot.ts:716 | expert-bot.test.ts:1314 | Passed |
| REQ-F-BOMB03 | Straight-Flush Bomb Detection | M5 | bot-strategy-utils.ts:242 | bot-strategy-utils.test.ts:152 | Passed |
| REQ-F-MJ01 | Context-Adaptive Mah Jong Wish | M6 | expert-bot.ts:335 | expert-bot.test.ts:1205 | Passed |
| REQ-F-END01 | 3-Player Endgame (Partner Out) | M7 | expert-bot.ts:862 | expert-bot.test.ts:1668 | Passed |
| REQ-F-END02 | 3-Player Endgame (Partner Not Out) | M7 | expert-bot.ts:884 | expert-bot.test.ts:1700 | Passed |
| REQ-F-END03 | 2-Player Endgame (Opp 1 Card) | M7 | expert-bot.ts:923 | expert-bot.test.ts:1732 | Passed |
| REQ-F-END04 | 2-Player Endgame (Opp Many Cards) | M7 | expert-bot.ts:946 | expert-bot.test.ts:1790 | Passed |
| REQ-F-DEF01 | Risk-Based Tichu Defense | M8 | expert-bot.ts:762 | expert-bot.test.ts:1852 | Passed |
| REQ-F-TRK01 | Rough Point Tracking | M9 | card-tracker.ts:275 | card-tracker.test.ts:332 | Passed |
| REQ-F-TRK02 | Enhanced Dragon Gift Decision | M9 | expert-bot.ts:338 | expert-bot.test.ts:1173 | Passed |
| REQ-F-FOL01 | King Safety Using Card Tracker | M10 | expert-bot.ts:715 | expert-bot.test.ts:1975 | Passed |
| REQ-F-FOL02 | Smart Pass on Low Tricks | M10 | expert-bot.ts:917 | expert-bot.test.ts:2012 | Passed |
| REQ-F-FOL03 | Split Aces | M10 | expert-bot.ts:754 | expert-bot.test.ts:2052 | Passed |
| REQ-NF-PERF01 | Decision Speed <50ms | All | bot-integration.test.ts | bot-integration.test.ts | Passed |
| REQ-NF-MAINT01 | Code Organization | All | expert-bot.ts, bot-strategy-utils.ts, card-tracker.ts | — | Passed |
| REQ-NF-TEST01 | 80%+ Coverage | All | — | 171 tests across 4 files | Passed |
| REQ-NF-COMPAT01 | Backward Compatibility | All | — | hard-bot.test.ts, regular-bot.test.ts | Passed |
