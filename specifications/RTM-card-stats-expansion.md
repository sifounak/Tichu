# Requirements Traceability Matrix — Card / Hand Stats Expansion

**Spec:** `specifications/2026-03-31-card-stats-expansion.md`
**Plan:** `plans/2026-03-31-card-stats-expansion.md`

## Functional Requirements

| ID | Description | Milestone | Source File(s) | Status |
|----|-------------|-----------|----------------|--------|
| REQ-F-CS01 | Rename tab to "Card / Hand Stats" | M4 | `code/packages/client/src/app/stats/page.tsx:208` | Passed |
| REQ-F-CS02 | Move Achievements section to top | M4 | `code/packages/client/src/app/stats/page.tsx:349-354` | Passed |
| REQ-F-CS03 | Detect Phoenix play types | M2 | `code/packages/server/src/game/round-event-tracker.ts:400-440` | Passed |
| REQ-F-CS04 | Phoenix play type DB columns | M1 | `code/packages/server/src/db/schema.ts:156-162`, `connection.ts:230-236` | Passed |
| REQ-F-CS05 | Phoenix play type UI | M4 | `code/packages/client/src/app/stats/page.tsx:365-380` | Passed |
| REQ-F-CS06 | Detect Dog control outcomes | M2 | `code/packages/server/src/game/round-event-tracker.ts:320-345` | Passed |
| REQ-F-CS07 | Detect stuck with Dog as last card | M2 | `code/packages/server/src/game/round-event-tracker.ts:443-453` | Passed |
| REQ-F-CS08 | Dog tracking DB columns | M1 | `code/packages/server/src/db/schema.ts:164-167`, `connection.ts:238-241` | Passed |
| REQ-F-CS09 | Dog tracking UI | M4 | `code/packages/client/src/app/stats/page.tsx:383-392` | Passed |
| REQ-F-CS10 | Track individual bomb sizes | M2 | `code/packages/server/src/game/round-event-tracker.ts:245-250` | Passed |
| REQ-F-CS11 | Bomb size DB columns | M1 | `code/packages/server/src/db/schema.ts:169-179`, `connection.ts:243-253` | Passed |
| REQ-F-CS12 | Bomb Sizes UI card | M4 | `code/packages/client/src/app/stats/page.tsx:407-427` | Passed |
| REQ-F-CS13 | Detect conflicting bombs in dealt hand | M2 | `code/packages/server/src/game/round-event-tracker.ts:456-520` | Passed |
| REQ-F-CS14 | Conflicting bombs DB column | M1 | `code/packages/server/src/db/schema.ts:182`, `connection.ts:255` | Passed |
| REQ-F-CS15 | Conflicting bombs UI | M4 | `code/packages/client/src/app/stats/page.tsx:399` | Passed |
| REQ-F-CS16 | Split over-bomb tracking | M2 | `code/packages/server/src/game/round-event-tracker.ts:253-261` | Passed |
| REQ-F-CS17 | Over-bomb DB columns | M1 | `code/packages/server/src/db/schema.ts:184-185`, `connection.ts:257-258` | Passed |
| REQ-F-CS18 | Over-bomb UI | M4 | `code/packages/client/src/app/stats/page.tsx:401-402` | Passed |
| REQ-F-CS19 | Track gave/received for all card types | M2 | `code/packages/server/src/game/round-event-tracker.ts:128-200` | Passed |
| REQ-F-CS20 | Bomb completion detection in pass | M2 | `code/packages/server/src/game/round-event-tracker.ts:174-213` | Passed |
| REQ-F-CS21 | Pass tracking DB columns | M1 | `code/packages/server/src/db/schema.ts:187-197`, `connection.ts:260-270` | Passed |
| REQ-F-CS22 | Pass Tracking UI card | M4 | `code/packages/client/src/app/stats/page.tsx:430-472` | Passed |
| REQ-F-CS23 | Associate pass stats with passing player | M3 | `code/packages/server/src/room/room-handler.ts:719-739` | Passed |
| REQ-F-CS24 | Save pass stats on game abandon/restart | M3 | `code/packages/server/src/room/room-handler.ts:701,246`, `game-manager.ts:288-299` | Passed |
| REQ-F-CS25 | Bombs section stat list | M4 | `code/packages/client/src/app/stats/page.tsx:395-427` | Passed |
| REQ-F-CS26 | Dragon section stat list | M4 | `code/packages/client/src/app/stats/page.tsx:357-363` | Passed |

## Non-Functional Requirements

| ID | Description | Milestone | Verification | Status |
|----|-------------|-----------|-------------|--------|
| REQ-NF-CS01 | No game engine modification | All | `git diff game-state-machine.ts` shows no changes | Passed |
| REQ-NF-CS02 | Backward compatibility | M1, M3 | All new columns DEFAULT 0; over-bomb migration idempotent | Passed |
| REQ-NF-CS03 | Build passes | All | `tsc --noEmit` passes for all packages | Passed |
