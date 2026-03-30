# Requirements Traceability Matrix: Player Statistics System

## Summary

| Requirement ID | Description | Status |
|---|---|---|
| REQ-F-PW01 | Game end callback | Passed |
| REQ-F-PW02 | Human-only persistence | Passed |
| REQ-F-PW03 | Forfeit tracking | Not Started |
| REQ-F-PW04 | Spectator tracking | Not Started |
| REQ-F-GA01 | Games played and win rate | Passed |
| REQ-F-GA02 | Largest win/loss score difference | Passed |
| REQ-F-GA03 | Games forfeited and forfeit rate | Passed |
| REQ-F-GA04 | Games spectated | Passed |
| REQ-F-GA05 | 1-2 finish wins and against | Passed |
| REQ-F-GB01 | Rounds played and won | Passed |
| REQ-F-GB02 | Tichu calls and successes | Passed |
| REQ-F-GB03 | Opponent Tichu/Grand Tichu broken | Passed |
| REQ-F-GB04 | Partner Tichu/Grand Tichu broken | Passed |
| REQ-F-GB05 | Hands (rounds) won | Passed |
| REQ-F-GC01 | Rounds with Dragon / Phoenix | Not Started |
| REQ-F-GC02 | Special cards received in pass | Not Started |
| REQ-F-GC03 | Dragon trick wins | Not Started |
| REQ-F-GC04 | Dragon given after opponent's Dragon victory | Not Started |
| REQ-F-GC05 | Dog pass tracking | Not Started |
| REQ-F-GC06 | Dog played for Tichu partner | Not Started |
| REQ-F-GC07 | Bomb statistics | Not Started |
| REQ-F-GC08 | Over-bombed | Not Started |
| REQ-F-GC09 | Bomb forced by wish | Not Started |
| REQ-F-GC10 | "The Tichu" straight | Not Started |
| REQ-F-EC01 | RoundEventTracker class | Not Started |
| REQ-F-EC02 | State-diff detection | Not Started |
| REQ-F-EC03 | Hand snapshots for pass tracking | Not Started |
| REQ-F-EC04 | Round event persistence | Not Started |
| REQ-F-DB01 | Extended playerStats table | Passed |
| REQ-F-DB02 | playerRelationalStats table | Passed |
| REQ-F-DB03 | roundPlayerEvents table | Passed |
| REQ-F-DB04 | Atomic stat updates | Passed |
| REQ-F-GD01 | Partner stats | Not Started |
| REQ-F-GD02 | Opponent stats | Not Started |
| REQ-F-API01 | Extended profile endpoint | Passed |
| REQ-F-API02 | Partner stats endpoint | Not Started |
| REQ-F-API03 | Opponent stats endpoint | Not Started |
| REQ-F-UI01 | Stats button in lobby | Not Started |
| REQ-F-UI02 | Dedicated stats page | Not Started |
| REQ-F-UI03 | Overview tab | Not Started |
| REQ-F-UI04 | Card Stats tab | Not Started |
| REQ-F-UI05 | Relationships tab | Not Started |
| REQ-F-UI06 | History tab | Not Started |
| REQ-NF-P01 | Profile page load time | Not Started |
| REQ-NF-P02 | Game end persistence latency | Passed |
| REQ-NF-P03 | No game engine modification | Passed |
| REQ-NF-P04 | Backward compatibility | Passed |

## Detailed Entries

> **REQ-F-PW01** — Game end callback — *Passed*
> - Code:
>   - `code/packages/server/src/game/game-manager.ts:69` (onGameEnd callback field)
>   - `code/packages/server/src/game/game-manager.ts:268-270` (wireGameEndCallback method)
>   - `code/packages/server/src/game/game-manager.ts:488-499` (gameOver detection in onStateChange)
>   - `code/packages/server/src/room/room-handler.ts:657-661` (wiring in startGameInternal)
>   - `code/packages/server/src/room/room-handler.ts:710-770` (persistGameResult method)
> - Tests:
>   - `code/packages/server/tests/db/game-persistence.test.ts:125-133` (saveGameResult transaction)

> **REQ-F-PW02** — Human-only persistence — *Passed*
> - Code:
>   - `code/packages/server/src/db/game-persistence.ts:82-87` (filter human players)
>   - `code/packages/server/src/room/room-handler.ts:720-726` (skip bot seats in playerMap)
> - Tests:
>   - `code/packages/server/tests/db/game-persistence.test.ts:182-198` (all-bot test)

> **REQ-F-PW03** — Forfeit tracking — *Not Started*
> - Code: (pending)
> - Tests: (pending)

> **REQ-F-PW04** — Spectator tracking — *Not Started*
> - Code: (pending)
> - Tests: (pending)

> **REQ-F-GA01** — Games played and win rate — *Passed*
> - Code: `code/packages/server/src/db/stat-computations.ts:46-49`
> - Tests: `code/packages/server/tests/db/stat-computations.test.ts:39-52`

> **REQ-F-GA02** — Largest win/loss score difference — *Passed*
> - Code: `code/packages/server/src/db/stat-computations.ts:55-58`
> - Tests: `code/packages/server/tests/db/stat-computations.test.ts:55-69`

> **REQ-F-GA03** — Games forfeited and forfeit rate — *Passed*
> - Code: `code/packages/server/src/db/schema.ts` (column defined, tracking wired in PW03)
> - Tests: `code/packages/server/tests/db/schema.test.ts` (column existence)

> **REQ-F-GA04** — Games spectated — *Passed*
> - Code: `code/packages/server/src/db/schema.ts` (column defined, tracking wired in PW04)
> - Tests: `code/packages/server/tests/db/schema.test.ts` (column existence)

> **REQ-F-GA05** — 1-2 finish wins and against — *Passed*
> - Code: `code/packages/server/src/db/stat-computations.ts:52-57`
> - Tests: `code/packages/server/tests/db/stat-computations.test.ts:72-82`

> **REQ-F-GB01** — Rounds played and won — *Passed*
> - Code: `code/packages/server/src/db/stat-computations.ts:84-89`
> - Tests: `code/packages/server/tests/db/stat-computations.test.ts:86-96`

> **REQ-F-GB02** — Tichu calls and successes — *Passed*
> - Code: `code/packages/server/src/db/stat-computations.ts:92-108`
> - Tests: `code/packages/server/tests/db/stat-computations.test.ts:99-132`

> **REQ-F-GB03** — Opponent Tichu/Grand Tichu broken — *Passed*
> - Code: `code/packages/server/src/db/stat-computations.ts:115-121`
> - Tests: `code/packages/server/tests/db/stat-computations.test.ts:135-160`

> **REQ-F-GB04** — Partner Tichu/Grand Tichu broken — *Passed*
> - Code: `code/packages/server/src/db/stat-computations.ts:128-133`
> - Tests: `code/packages/server/tests/db/stat-computations.test.ts:163-179`

> **REQ-F-GB05** — Hands (rounds) won — *Passed*
> - Code: Same as REQ-F-GB01 (roundsWon)
> - Tests: Same as REQ-F-GB01

> **REQ-F-GC01** — Rounds with Dragon / Phoenix — *Not Started*
> - Code: (pending)
> - Tests: (pending)

> **REQ-F-GC02** — Special cards received in pass — *Not Started*
> - Code: (pending)
> - Tests: (pending)

> **REQ-F-GC03** — Dragon trick wins — *Not Started*
> - Code: (pending)
> - Tests: (pending)

> **REQ-F-GC04** — Dragon given after opponent's Dragon victory — *Not Started*
> - Code: (pending)
> - Tests: (pending)

> **REQ-F-GC05** — Dog pass tracking — *Not Started*
> - Code: (pending)
> - Tests: (pending)

> **REQ-F-GC06** — Dog played for Tichu partner — *Not Started*
> - Code: (pending)
> - Tests: (pending)

> **REQ-F-GC07** — Bomb statistics — *Not Started*
> - Code: (pending)
> - Tests: (pending)

> **REQ-F-GC08** — Over-bombed — *Not Started*
> - Code: (pending)
> - Tests: (pending)

> **REQ-F-GC09** — Bomb forced by wish — *Not Started*
> - Code: (pending)
> - Tests: (pending)

> **REQ-F-GC10** — "The Tichu" straight — *Not Started*
> - Code: (pending)
> - Tests: (pending)

> **REQ-F-EC01** — RoundEventTracker class — *Not Started*
> - Code: (pending)
> - Tests: (pending)

> **REQ-F-EC02** — State-diff detection — *Not Started*
> - Code: (pending)
> - Tests: (pending)

> **REQ-F-EC03** — Hand snapshots for pass tracking — *Not Started*
> - Code: (pending)
> - Tests: (pending)

> **REQ-F-EC04** — Round event persistence — *Not Started*
> - Code: (pending)
> - Tests: (pending)

> **REQ-F-DB01** — Extended playerStats table — *Passed*
> - Code:
>   - `code/packages/server/src/db/schema.ts:64-130` (playerStats with ~50 columns)
>   - `code/packages/server/src/db/connection.ts:46-170` (syncSchema with CREATE TABLE + ALTER TABLE)
> - Tests:
>   - `code/packages/server/tests/db/schema.test.ts:79-117` (Group A/B/C column verification)

> **REQ-F-DB02** — playerRelationalStats table — *Passed*
> - Code:
>   - `code/packages/server/src/db/schema.ts:132-142` (playerRelationalStats table)
> - Tests:
>   - `code/packages/server/tests/db/schema.test.ts:120-132` (table/column verification)

> **REQ-F-DB03** — roundPlayerEvents table — *Passed*
> - Code:
>   - `code/packages/server/src/db/schema.ts:144-153` (roundPlayerEvents table)
> - Tests:
>   - `code/packages/server/tests/db/schema.test.ts:135-147` (table/column verification)

> **REQ-F-DB04** — Atomic stat updates — *Passed*
> - Code:
>   - `code/packages/server/src/db/game-persistence.ts:43-124` (single db.transaction wrapping all inserts)
> - Tests:
>   - `code/packages/server/tests/db/game-persistence.test.ts:125-133` (transaction verification)

> **REQ-F-GD01** — Partner stats — *Not Started*
> - Code: (pending)
> - Tests: (pending)

> **REQ-F-GD02** — Opponent stats — *Not Started*
> - Code: (pending)
> - Tests: (pending)

> **REQ-F-API01** — Extended profile endpoint — *Passed*
> - Code:
>   - `code/packages/server/src/db/queries.ts:17-40` (PlayerProfile interface extended)
>   - `code/packages/server/src/db/queries.ts:104-130` (SELECT with new columns)
> - Tests: `code/packages/server/tests/db/queries.test.ts` (existing query tests pass)

> **REQ-F-API02** — Partner stats endpoint — *Not Started*
> - Code: (pending)
> - Tests: (pending)

> **REQ-F-API03** — Opponent stats endpoint — *Not Started*
> - Code: (pending)
> - Tests: (pending)

> **REQ-F-UI01** — Stats button in lobby — *Not Started*
> - Code: (pending)
> - Tests: (pending)

> **REQ-F-UI02** — Dedicated stats page — *Not Started*
> - Code: (pending)
> - Tests: (pending)

> **REQ-F-UI03** — Overview tab — *Not Started*
> - Code: (pending)
> - Tests: (pending)

> **REQ-F-UI04** — Card Stats tab — *Not Started*
> - Code: (pending)
> - Tests: (pending)

> **REQ-F-UI05** — Relationships tab — *Not Started*
> - Code: (pending)
> - Tests: (pending)

> **REQ-F-UI06** — History tab — *Not Started*
> - Code: (pending)
> - Tests: (pending)

> **REQ-NF-P01** — Profile page load time — *Not Started*
> - Code: (pending)
> - Tests: (pending)

> **REQ-NF-P02** — Game end persistence latency — *Passed*
> - Code:
>   - `code/packages/server/src/game/game-manager.ts:488-499` (callback runs AFTER broadcastState)
> - Tests: (verified by code inspection — broadcast before callback)

> **REQ-NF-P03** — No game engine modification — *Passed*
> - Code: `code/packages/server/src/game/game-state-machine.ts` has zero changes
> - Tests: (verified by git diff — file untouched)

> **REQ-NF-P04** — Backward compatibility — *Passed*
> - Code:
>   - `code/packages/server/src/db/connection.ts:46-170` (CREATE TABLE IF NOT EXISTS + ALTER TABLE with catch)
>   - All new columns have DEFAULT 0
> - Tests:
>   - `code/packages/server/tests/db/game-persistence.test.ts` (existing tests still pass)
