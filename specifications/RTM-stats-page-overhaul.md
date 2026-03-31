# Requirements Traceability Matrix — Stats Page Overhaul

**Spec:** `specifications/2026-03-31-stats-page-overhaul.md`
**Plan:** `plans/2026-03-31-stats-page-overhaul.md`

## Functional Requirements

| ID | Description | Milestone | File:Line | Status |
|----|-------------|-----------|-----------|--------|
| REQ-F-SO01 | Add finishOrder to RoundScore | M1 | shared/src/types/game.ts:98, shared/src/engine/scoring.ts:145 | Passed |
| REQ-F-SO02 | lastFinishes column | M1 | server/src/db/schema.ts:107 | Passed |
| REQ-F-SO03 | tichuBrokenByPartner columns | M1 | server/src/db/schema.ts:109-110 | Passed |
| REQ-F-SO04 | Tie-break tracking columns | M1 | server/src/db/schema.ts:112-113 | Passed |
| REQ-F-SO05 | gamesJoinedAfterSpectating column | M1 | server/src/db/schema.ts:115 | Passed |
| REQ-F-SO06 | Database migration | M1 | server/src/db/connection.ts:224-230 | Passed |
| REQ-F-SO07 | Fix firstFinishes to count all 1st-place | M1 | server/src/db/stat-computations.ts:119-121 | Passed |
| REQ-F-SO08 | Compute lastFinishes | M1 | server/src/db/stat-computations.ts:124-126 | Passed |
| REQ-F-SO09 | Compute tichuBrokenByPartner | M1 | server/src/db/stat-computations.ts:153-157 | Passed |
| REQ-F-SO10 | Compute tie-break stats | M1 | server/src/db/stat-computations.ts:71-83 | Passed |
| REQ-F-SO11 | Improve partnerTichuBroken with finishOrder | M1 | server/src/db/stat-computations.ts:147-150 | Passed |
| REQ-F-SO12 | Upsert new stat columns | M2 | server/src/db/game-persistence.ts:238-280 | Passed |
| REQ-F-SO13 | Pass targetScore to computeGameStats | M2 | server/src/db/game-persistence.ts:103 | Passed |
| REQ-F-SO14 | Track joinedAfterSpectating in persistence | M2 | server/src/db/game-persistence.ts:28,106 | Passed |
| REQ-F-SO15 | GameManager joinedAfterSpectating tracking | M2 | server/src/game/game-manager.ts:71-72,286-288 | Passed |
| REQ-F-SO16 | RoomHandler spectator promotion tracking | M2 | server/src/room/room-handler.ts:803 | Passed |
| REQ-F-SO17 | Expand PlayerProfile with Group C stats | M2 | server/src/db/queries.ts:44-68 | Passed |
| REQ-F-SO18 | Expand PlayerProfile with new stats | M2 | server/src/db/queries.ts:38-43 | Passed |
| REQ-F-SO19 | Enrich game history with userId columns | M2 | server/src/db/game-persistence.ts:393-396 | Passed |
| REQ-F-SO20 | Enrich game history with Tichu summaries | M2 | server/src/db/game-persistence.ts:449-475 | Passed |
| REQ-F-SO21 | 4-column grid layout | M3 | client/src/app/stats/page.tsx (all grids) | Passed |
| REQ-F-SO22 | Display "-" for missing values | M3 | client/src/app/stats/page.tsx:197 | Passed |
| REQ-F-SO23 | Game Record section (11 stats) | M3 | client/src/app/stats/page.tsx:200-213 | Passed |
| REQ-F-SO24 | Round Record section (12 stats) | M3 | client/src/app/stats/page.tsx:216-230 | Passed |
| REQ-F-SO25 | Tichu Record section (14 stats) | M3 | client/src/app/stats/page.tsx:233-249 | Passed |
| REQ-F-SO26 | Remove Special section | M3 | client/src/app/stats/page.tsx (removed) | Passed |
| REQ-F-SO27 | Card Stats tab with Group C data | M3 | client/src/app/stats/page.tsx:255-320 | Passed |
| REQ-F-SO28 | History tab table redesign | M4 | client/src/app/stats/page.tsx:352-415 | Passed |
| REQ-F-SO29 | Player team detection in History | M4 | client/src/app/stats/page.tsx:370-382 | Passed |

## Non-Functional Requirements

| ID | Description | Milestone | Status |
|----|-------------|-----------|--------|
| REQ-NF-SO01 | No game engine modification | All | Passed |
| REQ-NF-SO02 | Backward compatibility | M1 | Passed |
| REQ-NF-SO03 | Build passes | M3 | Passed |
