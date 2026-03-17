# Requirements Traceability Matrix — Grand Tichu Real-Time Decisions

| Req ID | Description | Milestone | File(s) | Line(s) | Test(s) | Status |
|--------|-------------|-----------|---------|---------|---------|--------|
| REQ-F-GT01 | Decision broadcast reaches all players immediately | M1 | `gameStore.ts`, `game/[gameId]/page.tsx` | TBD | gameStore unit test | Pending |
| REQ-F-GT02 | `grandTichuDecided` stored in gameStore | M1 | `gameStore.ts` | TBD | gameStore unit test | Pending |
| REQ-F-GT03 | Undecided player sees status row of others | M2 | `PreGamePhase.tsx` | TBD | PreGamePhase render test | Pending |
| REQ-F-GT04 | Decided player sees waiting screen | M2 | `PreGamePhase.tsx` | TBD | PreGamePhase render test | Pending |
| REQ-F-GT05 | Grand Tichu callers visually distinct from passers | M2 | `PreGamePhase.tsx`, `PreGamePhase.module.css` | TBD | PreGamePhase render test | Pending |
| REQ-F-GT06 | Bots decide at exactly 1000 ms | M3 | `bot-runner.ts` | TBD | BotRunner unit test | Pending |
| REQ-F-GT07 | No duplicate Grand Tichu timers per bot | M3 | `bot-runner.ts` | TBD | BotRunner unit test | Pending |
| REQ-NF-GT01 | No optimistic UI — server-driven only | M1 | `game/[gameId]/page.tsx` | TBD | — | Pending |
| REQ-NF-GT02 | No layout shift on status updates | M2 | `PreGamePhase.module.css` | TBD | — | Pending |
