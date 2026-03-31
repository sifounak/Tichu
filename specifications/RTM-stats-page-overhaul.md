# Requirements Traceability Matrix — Stats Page Overhaul

**Spec:** `specifications/2026-03-31-stats-page-overhaul.md`
**Plan:** `plans/2026-03-31-stats-page-overhaul.md`

## Functional Requirements

| ID | Description | Milestone | File:Line | Status |
|----|-------------|-----------|-----------|--------|
| REQ-F-SO01 | Add finishOrder to RoundScore | M1 | shared/src/types/game.ts:98, shared/src/engine/scoring.ts:145 | Passed |
| REQ-F-SO02 | lastFinishes column | M1 | server/src/db/schema.ts:107, server/src/db/connection.ts:225 | Passed |
| REQ-F-SO03 | tichuBrokenByPartner columns | M1 | server/src/db/schema.ts:109-110, server/src/db/connection.ts:226-227 | Passed |
| REQ-F-SO04 | Tie-break tracking columns | M1 | server/src/db/schema.ts:112-113, server/src/db/connection.ts:228-229 | Passed |
| REQ-F-SO05 | gamesJoinedAfterSpectating column | M1 | server/src/db/schema.ts:115, server/src/db/connection.ts:230 | Passed |
| REQ-F-SO06 | Database migration | M1 | server/src/db/connection.ts:224-230 | Passed |
| REQ-F-SO07 | Fix firstFinishes to count all 1st-place | M1 | server/src/db/stat-computations.ts:119-121 | Passed |
| REQ-F-SO08 | Compute lastFinishes | M1 | server/src/db/stat-computations.ts:124-126 | Passed |
| REQ-F-SO09 | Compute tichuBrokenByPartner | M1 | server/src/db/stat-computations.ts:153-157 | Passed |
| REQ-F-SO10 | Compute tie-break stats | M1 | server/src/db/stat-computations.ts:71-83 | Passed |
| REQ-F-SO11 | Improve partnerTichuBroken with finishOrder | M1 | server/src/db/stat-computations.ts:147-150 | Passed |
| REQ-F-SO12 | Upsert new stat columns | M2 | | Not Started |
| REQ-F-SO13 | Pass targetScore to computeGameStats | M2 | | Not Started |
| REQ-F-SO14 | Track joinedAfterSpectating in persistence | M2 | | Not Started |
| REQ-F-SO15 | GameManager joinedAfterSpectating tracking | M2 | | Not Started |
| REQ-F-SO16 | RoomHandler spectator promotion tracking | M2 | | Not Started |
| REQ-F-SO17 | Expand PlayerProfile with Group C stats | M2 | | Not Started |
| REQ-F-SO18 | Expand PlayerProfile with new stats | M2 | | Not Started |
| REQ-F-SO19 | Enrich game history with userId columns | M2 | | Not Started |
| REQ-F-SO20 | Enrich game history with Tichu summaries | M2 | | Not Started |
| REQ-F-SO21 | 4-column grid layout | M3 | | Not Started |
| REQ-F-SO22 | Display "-" for missing values | M3 | | Not Started |
| REQ-F-SO23 | Game Record section (11 stats) | M3 | | Not Started |
| REQ-F-SO24 | Round Record section (12 stats) | M3 | | Not Started |
| REQ-F-SO25 | Tichu Record section (14 stats) | M3 | | Not Started |
| REQ-F-SO26 | Remove Special section | M3 | | Not Started |
| REQ-F-SO27 | Card Stats tab with Group C data | M3 | | Not Started |
| REQ-F-SO28 | History tab table redesign | M4 | | Not Started |
| REQ-F-SO29 | Player team detection in History | M4 | | Not Started |

## Non-Functional Requirements

| ID | Description | Milestone | Status |
|----|-------------|-----------|--------|
| REQ-NF-SO01 | No game engine modification | All | Passed |
| REQ-NF-SO02 | Backward compatibility | M1 | Passed |
| REQ-NF-SO03 | Build passes | M3, M4 | Not Started |
