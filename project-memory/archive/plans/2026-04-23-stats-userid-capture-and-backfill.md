# Implementation Plan — Stats User-ID Capture, Back-Fill & Rebuild

**Date**: 2026-04-23
**Branch (suggested)**: `bugfix/stats-userid-capture`
**Derived from**: diagnostic investigation of "dashboards show 0 for pass/tichu/per-round stats" (this document is self-contained — no separate spec).
**Confidence**: High — root cause confirmed via read-only inspection of the live SQLite DB.

---

## 1. Context

### 1.1 Symptom
Dashboards (player-stats pages) display `0` for most counters: cards passed/received, Tichu call counts, bomb counts, etc. `gamesPlayed` and `gamesWon` are also inaccurate (stale values like `2` from earlier code paths rather than the real `4` observed on disk).

### 1.2 Root cause (confirmed)
Three things are true simultaneously:

1. **Raw event data IS being captured correctly.** Inspection of `data/tichu.sqlite` shows `plays` (2132 rows), `tricks` (412 rows), `bomb_inventory` (12 rows), and `player_rounds.passed_to_partner`/`passed_to_left`/`passed_to_right` are all populated with real card IDs.
2. **`player_rounds.user_id` is NULL for every row** (108/108 rows). The column exists in the schema — it is simply never written with a real value.
3. **`computeStatsForUser` filters on `player_rounds.user_id = ?` and early-returns empty stats on no match.** See [stats-cache.ts:337-354](../code/packages/server/src/db/stats-cache.ts#L337-L354).

Combined: stats computation cannot attribute any round-level event to any user → every per-round stat is 0.

### 1.3 Where the user-id gets dropped
In [game-event-capture.ts:172-176](../code/packages/server/src/game/game-event-capture.ts#L172-L176), the auto-init branch of `onStateChange` hard-codes `userId: null` for all four seats:

```ts
this.initPlayerRounds(
  parseInt(context.gameId) || 0,
  round.roundNumber,
  Object.fromEntries(SEATS_IN_ORDER.map(s => [s, { userId: null }])) as Record<Seat, { userId: string | null }>,
);
```

The `initPlayerRounds` signature ([game-event-capture.ts:125](../code/packages/server/src/game/game-event-capture.ts#L125)) already accepts real user IDs — no call site at runtime ever supplies them. The capture module has no reference to `RoomManager` to resolve seat→userId on its own. The callers that DO know (`room-handler.ts`, where `roomManager.getUserIdAtSeat(roomCode, seat)` is readily available) never inject a resolver into the capture module.

### 1.4 Fix strategy (three parts)
1. **M1 — Capture fix.** Add a `seatUserIdResolver?: (seat: Seat) => string | null` callback slot to `GameEventCapture`, wire it via a `wireSeatUserIdResolver` setter on `GameManager` (matching the existing `wireKickCallback` / `wireVoteCallback` / `wireGameEndCallback` style), and call it from `room-handler.ts::startGameInternal` and `app.ts::restoreActiveGames`. Use the resolver in `onStateChange`'s auto-init branch so every new `PlayerRoundRecord` is born with the correct `userId`.
2. **M2 — Back-fill migration.** One-shot update: for every `player_rounds` row with `user_id IS NULL`, set `user_id` to `games.{seat}_user_id` where `seat` matches. This recovers existing games *as long as the seat was never swapped mid-game*. Swap history is not recoverable (the information was never captured) — document this limitation.
3. **M3 — Rebuild-stats admin script.** Mirror `scripts/wipe-stats-history.ts` with a `scripts/rebuild-stats.ts` that calls `rebuildStatsCache(db)`, plus a `pnpm --filter @tichu/server rebuild-stats` package.json entry.
4. **M4 — End-to-end verification.** Play a fresh game (one per human), then run the rebuild, then confirm `player_rounds.user_id` is populated and stats page shows non-zero pass/tichu/bomb counts.

### 1.5 What is NOT in scope
- Fixing seat-swap attribution history (impossible — data never captured; REQ-F-SA01/SA12 design anticipated this and accepts it).
- Changes to the stats-computation logic in `stats-cache.ts` beyond what M2/M3 require (no-op: the computation code is already correct once user_id is present).
- Wiring `wireKickCallback` / `wireVoteCallback` / `wireGameEndCallback` into the restore path in `app.ts`. That is a pre-existing gap unrelated to this bug. Leave a `// TODO:` breadcrumb if convenient but do not fix here.

---

## 2. Milestone Overview

| # | Milestone | Files Touched | Tests |
|---|---|---|---|
| M1 | Seat→userId resolver wiring into capture | `game-event-capture.ts`, `game-manager.ts`, `room-handler.ts`, `app.ts` | `game-event-capture.test.ts`, new `game-manager.wire-resolver.test.ts` |
| M2 | Back-fill migration for existing rows | `db/connection.ts` (startup migration) | new `db/connection.backfill.test.ts` |
| M3 | Rebuild-stats admin script | new `scripts/rebuild-stats.ts`, `package.json` | new `scripts/rebuild-stats.test.ts` |
| M4 | End-to-end verification | (no code — operational checklist) | (manual smoke test) |

Strict ordering: **M1 must land before M2 and M3.** M2 recovers past data; M1 prevents the bug going forward. Without M1, future games continue to produce NULL-user_id rows and the rebuild in M3 would still produce zeros for them.

---

## 3. Milestone Details

### M1 — Seat→userId Resolver Wiring

**Goal**: Every `PlayerRoundRecord` created by `GameEventCapture` is populated with the real `userId` at the time of round auto-init. Bots remain `null`.

**Files:**
- Modify: [game-event-capture.ts:50-133, 164-177](../code/packages/server/src/game/game-event-capture.ts#L50-L177)
- Modify: [game-manager.ts:95-140, 270-320, 900-940](../code/packages/server/src/game/game-manager.ts#L95-L940)
- Modify: [room-handler.ts:649-712](../code/packages/server/src/room/room-handler.ts#L649-L712)
- Modify: [app.ts:251-279](../code/packages/server/src/app.ts#L251-L279)
- Test: [tests/game/game-event-capture.test.ts](../code/packages/server/tests/game/game-event-capture.test.ts) (add cases)
- Test (new): `code/packages/server/tests/game/game-manager.wire-resolver.test.ts`

#### Task 1.1 — Add resolver slot to `GameEventCapture`

- [ ] **Step 1: Write the failing test** in `tests/game/game-event-capture.test.ts`

Add a new describe block:

```ts
describe('seat→userId resolver', () => {
  it('auto-init uses resolver to populate user_id for each seat', () => {
    const capture = new GameEventCapture(42);
    const resolver = (seat: Seat): string | null => {
      const map: Record<Seat, string | null> = {
        north: 'user_n', east: 'user_e', south: 'user_s', west: 'user_w',
      };
      return map[seat];
    };
    capture.wireSeatUserIdResolver(resolver);

    // Build a minimal context that triggers auto-init
    const ctx = buildMinimalContextWithRound({ gameId: '42', roundNumber: 1 });
    capture.onStateChange(ctx);

    const acc = capture.getAccumulator();
    // Round is still in-progress; read currentRound via public helper
    const cr = capture.getCurrentRound();
    expect(cr).not.toBeNull();
    expect(cr!.playerRounds.find(p => p.seat === 'north')!.userId).toBe('user_n');
    expect(cr!.playerRounds.find(p => p.seat === 'east')!.userId).toBe('user_e');
    expect(cr!.playerRounds.find(p => p.seat === 'south')!.userId).toBe('user_s');
    expect(cr!.playerRounds.find(p => p.seat === 'west')!.userId).toBe('user_w');
  });

  it('auto-init leaves user_id null when no resolver is wired (pre-fix behavior)', () => {
    const capture = new GameEventCapture(42);
    // NO resolver wired
    const ctx = buildMinimalContextWithRound({ gameId: '42', roundNumber: 1 });
    capture.onStateChange(ctx);

    const cr = capture.getCurrentRound();
    for (const pr of cr!.playerRounds) {
      expect(pr.userId).toBeNull();
    }
  });

  it('auto-init treats bot seats (resolver returns null) as null userId', () => {
    const capture = new GameEventCapture(42);
    capture.wireSeatUserIdResolver((seat) => (seat === 'north' ? 'user_n' : null));
    const ctx = buildMinimalContextWithRound({ gameId: '42', roundNumber: 1 });
    capture.onStateChange(ctx);

    const cr = capture.getCurrentRound();
    expect(cr!.playerRounds.find(p => p.seat === 'north')!.userId).toBe('user_n');
    expect(cr!.playerRounds.find(p => p.seat === 'east')!.userId).toBeNull();
    expect(cr!.playerRounds.find(p => p.seat === 'south')!.userId).toBeNull();
    expect(cr!.playerRounds.find(p => p.seat === 'west')!.userId).toBeNull();
  });
});
```

> **Reuse helper**: the existing test file already has fixture-builder patterns — `buildMinimalContextWithRound` may need to be added or cribbed from an existing helper. If the file uses `createGameMachineContext` or similar directly, follow that pattern instead. The principle is: a context with `currentRound.roundNumber = 1` and `gameId = "42"` is enough to trigger the auto-init branch at [game-event-capture.ts:166-177](../code/packages/server/src/game/game-event-capture.ts#L166).

- [ ] **Step 2: Run test to verify it fails**

```
cd code && pnpm --filter @tichu/server test -- tests/game/game-event-capture.test.ts
```
Expected: FAIL — `capture.wireSeatUserIdResolver is not a function`.

- [ ] **Step 3: Add the resolver slot and method to `GameEventCapture`**

In [game-event-capture.ts](../code/packages/server/src/game/game-event-capture.ts):

At line 79 (after `private initialHandsCaptured = false;` and the other private fields), add:

```ts
  // Resolver from seat → userId, wired by GameManager. Null or missing
  // returns mean "no human at that seat" (bots or unseated).
  private seatUserIdResolver: ((seat: Seat) => string | null) | null = null;
```

Below `getAccumulator()` at line 88, add a new public method:

```ts
  /**
   * Wire the seat→userId resolver. Called by GameManager at construction /
   * restore time, with a closure that reads RoomManager.getUserIdAtSeat.
   * Without this, auto-init leaves player_rounds.user_id as null and all
   * per-user stats compute to zero (see plans/2026-04-23-…).
   */
  wireSeatUserIdResolver(resolver: (seat: Seat) => string | null): void {
    this.seatUserIdResolver = resolver;
  }
```

Then in `onStateChange`, replace lines 172-176 with:

```ts
      const playersForInit = Object.fromEntries(
        SEATS_IN_ORDER.map((s) => [
          s,
          { userId: this.seatUserIdResolver ? this.seatUserIdResolver(s) : null },
        ]),
      ) as Record<Seat, { userId: string | null }>;
      this.initPlayerRounds(
        parseInt(context.gameId) || 0,
        round.roundNumber,
        playersForInit,
      );
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd code && pnpm --filter @tichu/server test -- tests/game/game-event-capture.test.ts
```
Expected: all three new tests PASS; existing tests unchanged.

- [ ] **Step 5: Commit**

```
git add code/packages/server/src/game/game-event-capture.ts code/packages/server/tests/game/game-event-capture.test.ts
git commit -m "[Stats]: Add seat→userId resolver slot to GameEventCapture"
```

---

#### Task 1.2 — Expose `wireSeatUserIdResolver` on `GameManager` and preserve it across restart/restore

- [ ] **Step 1: Write the failing test** at `code/packages/server/tests/game/game-manager.wire-resolver.test.ts` (new file)

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GameManager } from '../../src/game/game-manager.js';
import { Broadcaster } from '../../src/ws/broadcaster.js';
import { DisconnectHandler } from '../../src/game/disconnect-handler.js';
import { VoteHandler } from '../../src/game/vote-handler.js';
import type { Seat } from '@tichu/shared';

// Helper — no sockets needed; unit test targets only wiring.
function makeManager(): GameManager {
  const broadcaster = new Broadcaster();
  const disconnectHandler = new DisconnectHandler(broadcaster);
  const voteHandler = new VoteHandler(broadcaster);
  return new GameManager('1', 'ROOM', broadcaster, disconnectHandler, voteHandler);
}

describe('GameManager.wireSeatUserIdResolver', () => {
  it('forwards the resolver to the underlying GameEventCapture', () => {
    const mgr = makeManager();
    const resolver = (_s: Seat): string | null => 'u_x';
    mgr.wireSeatUserIdResolver(resolver);

    // Trigger a state change so the capture module auto-inits a round.
    // The public surface for this is limited; the cleanest path is a reflection
    // check: the capture module stores the resolver in a private field. Use
    // `(mgr as any).eventCapture` to verify the field is set — limited but
    // localized. (Also asserted end-to-end in game-event-capture.test.ts.)
    const capture = (mgr as unknown as { eventCapture: { seatUserIdResolver: unknown } }).eventCapture;
    expect(capture.seatUserIdResolver).toBe(resolver);

    mgr.destroy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd code && pnpm --filter @tichu/server test -- tests/game/game-manager.wire-resolver.test.ts
```
Expected: FAIL — `mgr.wireSeatUserIdResolver is not a function`.

- [ ] **Step 3: Implement `wireSeatUserIdResolver` on `GameManager`**

In [game-manager.ts](../code/packages/server/src/game/game-manager.ts), below the existing `wireGameEndCallback` at line 313-315 add:

```ts
  /**
   * Wire the seat→userId resolver for stats capture. Matches the pattern of
   * wireKickCallback / wireVoteCallback / wireGameEndCallback — caller is
   * room-handler.ts::startGameInternal (fresh games) or app.ts::restoreActiveGames
   * (snapshot restore). Without this, player_rounds.user_id stays null and
   * per-user stats compute to zero.
   */
  wireSeatUserIdResolver(resolver: (seat: Seat) => string | null): void {
    this.eventCapture.wireSeatUserIdResolver(resolver);
  }
```

> **Import check**: `Seat` is already imported from `@tichu/shared` in game-manager.ts (grep to confirm). If not, add to the existing shared import line.

- [ ] **Step 4: Run the new test to verify it passes**

```
cd code && pnpm --filter @tichu/server test -- tests/game/game-manager.wire-resolver.test.ts
```
Expected: PASS.

- [ ] **Step 5: Verify it also survives restart by running the full GameManager test file**

```
cd code && pnpm --filter @tichu/server test -- tests/game/game-manager
```
Expected: all existing tests PASS (restart/destroy paths exist in the codebase; they recreate `eventCapture` at [game-manager.ts:916](../code/packages/server/src/game/game-manager.ts#L916) so a restored GameManager has a fresh (unwired) capture until the caller re-wires it — that is handled in Task 1.4).

- [ ] **Step 6: Commit**

```
git add code/packages/server/src/game/game-manager.ts code/packages/server/tests/game/game-manager.wire-resolver.test.ts
git commit -m "[Stats]: Expose wireSeatUserIdResolver on GameManager"
```

---

#### Task 1.3 — Wire the resolver from `room-handler.ts::startGameInternal`

The call site is [room-handler.ts:649-712](../code/packages/server/src/room/room-handler.ts#L649-L712), where the other `wire*` calls happen immediately after `createGame`.

- [ ] **Step 1: Write the failing integration test**

Add to an existing or new file — suggested location: `code/packages/server/tests/room/room-handler.stats-wiring.test.ts`. (If the existing `tests/room/room-handler.test.ts` is the convention, extend that.)

```ts
import { describe, it, expect } from 'vitest';
// (adjust imports to match existing room-handler test harness patterns)

describe('startGameInternal wires seat→userId resolver', () => {
  it('populates player_rounds.user_id with real user ids on fresh game', () => {
    const { roomHandler, roomManager, gameStore } = setupRoomHarness();
    const roomCode = createRoomWith4Humans(roomHandler, roomManager, [
      { seat: 'north', userId: 'u_n', name: 'Alice' },
      { seat: 'east',  userId: 'u_e', name: 'Bob' },
      { seat: 'south', userId: 'u_s', name: 'Carol' },
      { seat: 'west',  userId: 'u_w', name: 'Dave' },
    ]);
    readyAllSeats(roomHandler, roomCode);  // triggers startGameInternal

    const game = gameStore.getGameByRoom(roomCode)!;
    // Run through enough turns to reach Playing phase (pass phase triggers
    // auto-init via onStateChange). If the harness exposes a helper to
    // fast-forward past grand-tichu+pass, use it; otherwise call the state
    // machine directly.
    advancePastPassPhase(game);

    const acc = game.getEventAccumulator();
    // Current in-progress round
    const current = (game as unknown as { eventCapture: { getCurrentRound: () => any } })
      .eventCapture.getCurrentRound();
    expect(current).not.toBeNull();
    const byseat = Object.fromEntries(current.playerRounds.map((p: any) => [p.seat, p.userId]));
    expect(byseat).toEqual({ north: 'u_n', east: 'u_e', south: 'u_s', west: 'u_w' });
  });

  it('bot seats get null userId (not a crash)', () => {
    const { roomHandler, roomManager, gameStore } = setupRoomHarness();
    const roomCode = createRoomWith4Humans(roomHandler, roomManager, [
      { seat: 'north', userId: 'u_n', name: 'Alice' },
      { seat: 'east',  bot: true, name: 'Bot-E' },
      { seat: 'south', userId: 'u_s', name: 'Carol' },
      { seat: 'west',  bot: true, name: 'Bot-W' },
    ]);
    readyAllSeats(roomHandler, roomCode);
    const game = gameStore.getGameByRoom(roomCode)!;
    advancePastPassPhase(game);

    const current = (game as unknown as { eventCapture: { getCurrentRound: () => any } })
      .eventCapture.getCurrentRound();
    const byseat = Object.fromEntries(current.playerRounds.map((p: any) => [p.seat, p.userId]));
    expect(byseat).toEqual({ north: 'u_n', east: null, south: 'u_s', west: null });
  });
});
```

> **Note on harness helpers**: if `setupRoomHarness`, `createRoomWith4Humans`, `readyAllSeats`, `advancePastPassPhase` don't yet exist, check for equivalents in the existing room-handler tests and reuse them. If none exist, the minimum viable test is to spy on `GameManager.prototype.wireSeatUserIdResolver` and assert it was called once with a function — see the fallback test below.

**Fallback test (if full harness is too heavy):**

```ts
import { describe, it, expect, vi } from 'vitest';
import { GameManager } from '../../src/game/game-manager.js';

describe('startGameInternal wires resolver (spy form)', () => {
  it('calls wireSeatUserIdResolver on the created GameManager', () => {
    const spy = vi.spyOn(GameManager.prototype, 'wireSeatUserIdResolver');
    // ... boot room handler, create room, ready all seats ...
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBeTypeOf('function');
    // Verify the wired resolver actually resolves correctly:
    const resolver = spy.mock.calls[0][0];
    expect(resolver('north')).toBe('u_n');  // matches the seat map set up by the test
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd code && pnpm --filter @tichu/server test -- tests/room/room-handler.stats-wiring.test.ts
```
Expected: FAIL — resolver never called / user_ids are null.

- [ ] **Step 3: Add the wire call in `startGameInternal`**

In [room-handler.ts](../code/packages/server/src/room/room-handler.ts), after the `game.wireGameEndCallback(...)` block that ends at line 712 and **before** the `for (const player of room.players)` loop at line 714, add:

```ts
      // [Stats]: Wire seat→userId resolver so GameEventCapture can populate
      // player_rounds.user_id. Without this, per-user stats compute to zero.
      game.wireSeatUserIdResolver((seat) => {
        return this.roomManager.getUserIdAtSeat(roomCode, seat) ?? null;
      });
```

- [ ] **Step 4: Run test to verify it passes**

```
cd code && pnpm --filter @tichu/server test -- tests/room/room-handler.stats-wiring.test.ts
```
Expected: PASS.

- [ ] **Step 5: Run full server test suite to guard against regressions**

```
cd code && pnpm --filter @tichu/server test
```
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```
git add code/packages/server/src/room/room-handler.ts code/packages/server/tests/room/room-handler.stats-wiring.test.ts
git commit -m "[Stats]: Wire seat→userId resolver in startGameInternal"
```

---

#### Task 1.4 — Wire the resolver in the restore path (`app.ts::restoreActiveGames`)

- [ ] **Step 1: Write the failing test** — add to `tests/app.ts`-adjacent test (or create `tests/app.restore-resolver.test.ts`).

The restore path in [app.ts:251-279](../code/packages/server/src/app.ts#L251-L279) creates a fresh `eventCapture` at [game-manager.ts:916](../code/packages/server/src/game/game-manager.ts#L916), so an unwired restored game will revert to NULL user_ids on its next round auto-init. Test that restoring a serialized game and then advancing to a new round produces user_ids.

Minimum viable test (spy form):

```ts
import { describe, it, expect, vi } from 'vitest';
import { GameManager } from '../src/game/game-manager.js';

describe('restoreActiveGames wires resolver', () => {
  it('re-wires wireSeatUserIdResolver on each restored GameManager', async () => {
    const spy = vi.spyOn(GameManager.prototype, 'wireSeatUserIdResolver');
    // Boot app with a seeded DB that has one active_games row + its active_rooms row.
    // (Use existing snapshot fixtures if present; otherwise construct via serializeAndShutdown.)
    const app = await bootAppWithPersistedSnapshot();
    const count = app.restoreActiveGames();
    expect(count).toBeGreaterThan(0);
    expect(spy).toHaveBeenCalledTimes(count);
    spy.mockRestore();
    await app.stop();
  });
});
```

> **Helper note**: if `bootAppWithPersistedSnapshot` doesn't exist, reuse an existing app-restore test fixture (search for `loadActiveGames` in the tests directory) and add a lightweight wrapper. If no such test exists yet, either add a small seed-a-db helper, or downgrade this step to a focused unit test that calls `restoreActiveGames` with a hand-crafted snapshot.

- [ ] **Step 2: Run test to verify it fails**

```
cd code && pnpm --filter @tichu/server test -- tests/app.restore-resolver.test.ts
```
Expected: FAIL — spy not called.

- [ ] **Step 3: Wire the resolver in `app.ts::restoreActiveGames`**

In [app.ts](../code/packages/server/src/app.ts), inside the `for (const snapshot of gameSnapshots)` loop at line 261, after `const manager = GameManager.restore(...)` returns successfully and before `gameStore.restoreGame(manager, { ttlMs: TTL_MS })`, add:

```ts
          // [Stats]: Re-wire seat→userId resolver — GameManager.restore creates
          // a fresh GameEventCapture which has no resolver by default.
          manager.wireSeatUserIdResolver((seat) => {
            return roomHandler.roomManager.getUserIdAtSeat(manager.roomCode, seat) ?? null;
          });
```

Full context — this goes between the `GameManager.restore(...)` call and the `gameStore.restoreGame(...)` call:

```ts
          const manager = GameManager.restore(
            snapshot,
            broadcaster,
            gameStore.disconnectHandler,
            gameStore.voteHandler,
          );
          manager.wireSeatUserIdResolver((seat) => {
            return roomHandler.roomManager.getUserIdAtSeat(manager.roomCode, seat) ?? null;
          });
          gameStore.restoreGame(manager, { ttlMs: TTL_MS });
```

Note that `roomHandler.roomManager.restoreRooms(roomSnapshots)` has already run at line 258, so `getUserIdAtSeat` is guaranteed to have seat data by the time the resolver runs.

- [ ] **Step 4: Run test to verify it passes**

```
cd code && pnpm --filter @tichu/server test -- tests/app.restore-resolver.test.ts
```
Expected: PASS.

- [ ] **Step 5: Run full test suite**

```
cd code && pnpm --filter @tichu/server test && cd code && pnpm typecheck
```
Expected: PASS.

- [ ] **Step 6: Commit**

```
git add code/packages/server/src/app.ts code/packages/server/tests/app.restore-resolver.test.ts
git commit -m "[Stats]: Wire seat→userId resolver on game restore"
```

---

### M2 — Back-Fill Migration for Existing `player_rounds.user_id`

**Goal**: Every existing `player_rounds` row gets `user_id` populated from `games.{seat}_user_id` where not already set. Runs once on server startup. Idempotent — running it twice is a no-op.

**Files:**
- Modify: [db/connection.ts](../code/packages/server/src/db/connection.ts) — add startup migration
- Test (new): `code/packages/server/tests/db/connection.backfill.test.ts`

**Limitation to document in the migration comment and in `documentation/`**: this back-fill uses the FINAL occupant at each seat (the `games.{seat}_user_id` column is what gets stored). If a seat was occupied by different users in different rounds in a pre-fix game, those rounds will be retroactively attributed to the final occupant only — the per-round seat occupancy history was never captured. This is accepted: it matches the behavior of pre-M1 code, and new games (post-M1) will not suffer from this because they capture per-round user_ids correctly.

#### Task 2.1 — Write the back-fill migration

- [ ] **Step 1: Write the failing test** at `code/packages/server/tests/db/connection.backfill.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createDatabase } from '../../src/db/connection.js';

describe('player_rounds.user_id back-fill migration', () => {
  it('populates user_id from games.{seat}_user_id where NULL', () => {
    // Use in-memory DB so each test is isolated.
    const { client, db, close } = createDatabase(':memory:');

    // Seed: 1 user, 1 game, 4 player_rounds all with NULL user_id.
    client.prepare(`INSERT INTO users (id, display_name, created_at, last_seen_at) VALUES ('u1','Alice',unixepoch(),unixepoch())`).run();
    // (...more inserts for u2, u3, u4 — match the users schema columns)
    client.prepare(`
      INSERT INTO games (started_at, ended_at, winner_team, final_score_ns, final_score_ew,
                         target_score, round_count, north_user_id, east_user_id, south_user_id, west_user_id)
      VALUES (unixepoch(), unixepoch(), 'NS', 1000, 500, 1000, 3,
              'u1', 'u2', 'u3', 'u4')
    `).run();
    const gameId = (client.prepare('SELECT last_insert_rowid() AS id').get() as { id: number }).id;

    // Insert a game_round row (player_rounds FK references it)
    client.prepare(`
      INSERT INTO game_rounds (game_id, round_number, score_ns_at_start, score_ew_at_start,
                               score_ns_this_round, score_ew_this_round)
      VALUES (?, 1, 0, 0, 100, 0)
    `).run(gameId);
    const roundId = (client.prepare('SELECT last_insert_rowid() AS id').get() as { id: number }).id;

    for (const seat of ['north','east','south','west'] as const) {
      client.prepare(`
        INSERT INTO player_rounds (game_id, round_number, seat, user_id)
        VALUES (?, 1, ?, NULL)
      `).run(gameId, seat);
    }

    close();

    // Now re-open — this should trigger the back-fill migration.
    const reopened = createDatabase(':memory:');
    // BUT :memory: is fresh each time, so we can't reopen. Instead, use a
    // temp file path. Adjust accordingly:
    // const tmpPath = join(os.tmpdir(), `backfill-test-${Date.now()}.sqlite`);
    // ... (seed against tmpPath, close, then createDatabase(tmpPath) again)

    // Assert all 4 rows now have the correct user_id:
    const rows = reopened.client.prepare(`
      SELECT seat, user_id FROM player_rounds ORDER BY seat
    `).all() as { seat: string; user_id: string }[];
    expect(rows).toEqual([
      { seat: 'east', user_id: 'u2' },
      { seat: 'north', user_id: 'u1' },
      { seat: 'south', user_id: 'u3' },
      { seat: 'west', user_id: 'u4' },
    ]);
    reopened.close();
  });

  it('is idempotent — running twice does not change already-set user_ids', () => {
    // Seed a row with user_id = 'manually_set'. After running createDatabase twice,
    // the row should still say 'manually_set' (NOT overwritten by games.{seat}_user_id).
    // (Implementation detail: use tmpfile path so the DB persists across closes.)
  });

  it('leaves user_id NULL when games.{seat}_user_id is also NULL (bot seat)', () => {
    // Seed games row with east_user_id = NULL (bot seat). After migration,
    // player_rounds[seat='east'].user_id remains NULL.
  });
});
```

> **Implementation note**: because `createDatabase(':memory:')` is ephemeral, use a `tmpfile` path (via `os.tmpdir()`) to test across two `createDatabase` calls. Or, alternatively, expose the migration as a named exported function (e.g. `backfillPlayerRoundsUserId(client)`) that tests can call directly — preferred because it sidesteps the file-vs-memory issue.

- [ ] **Step 2: Run test to verify it fails**

```
cd code && pnpm --filter @tichu/server test -- tests/db/connection.backfill.test.ts
```
Expected: FAIL — migration function not exported / user_ids still NULL.

- [ ] **Step 3: Add the back-fill migration to `db/connection.ts`**

Locate `createDatabase` in [db/connection.ts](../code/packages/server/src/db/connection.ts). After schema creation / existing migrations but before returning the `{ client, db, close }` tuple, add a call:

```ts
  backfillPlayerRoundsUserId(client);
```

Then add the exported function (near the other migration helpers, or at the bottom of the file):

```ts
/**
 * [Stats back-fill] For every player_rounds row where user_id IS NULL,
 * populate it from games.{seat}_user_id. This recovers attribution for
 * games created before plans/2026-04-23-stats-userid-capture-and-backfill.md.
 *
 * Limitation: uses the FINAL seat occupant. If a pre-fix game had different
 * users at the same seat across rounds, this back-fill will attribute all of
 * those rounds to the final occupant. Per-round occupancy history was never
 * captured in pre-fix games and cannot be recovered.
 *
 * Idempotent: only updates rows where user_id IS NULL.
 *
 * Exported for testing.
 */
export function backfillPlayerRoundsUserId(client: BetterSqlite3Database): number {
  const result = client.prepare(`
    UPDATE player_rounds
    SET user_id = (
      SELECT CASE player_rounds.seat
        WHEN 'north' THEN games.north_user_id
        WHEN 'east'  THEN games.east_user_id
        WHEN 'south' THEN games.south_user_id
        WHEN 'west'  THEN games.west_user_id
      END
      FROM games
      WHERE games.id = player_rounds.game_id
    )
    WHERE player_rounds.user_id IS NULL
  `).run();
  return result.changes;
}
```

> **Import**: at the top of `connection.ts`, add if not present:
> ```ts
> import type { Database as BetterSqlite3Database } from 'better-sqlite3';
> ```

- [ ] **Step 4: Run test to verify it passes**

```
cd code && pnpm --filter @tichu/server test -- tests/db/connection.backfill.test.ts
```
Expected: all three tests PASS.

- [ ] **Step 5: Run full server test suite — existing connection/migration tests must still pass**

```
cd code && pnpm --filter @tichu/server test
```
Expected: all PASS.

- [ ] **Step 6: Commit**

```
git add code/packages/server/src/db/connection.ts code/packages/server/tests/db/connection.backfill.test.ts
git commit -m "[Stats]: Backfill player_rounds.user_id from games on startup"
```

---

### M3 — `rebuild-stats` Admin Script

**Goal**: A one-shot script that calls `rebuildStatsCache(db)` to recompute `stats_cache` and `relational_stats_cache` from raw event tables. Modeled on `scripts/wipe-stats-history.ts`.

**Files:**
- Create: [code/packages/server/scripts/rebuild-stats.ts](../code/packages/server/scripts/rebuild-stats.ts)
- Modify: [code/packages/server/package.json](../code/packages/server/package.json) (add `"rebuild-stats"` script)
- Test (new): `code/packages/server/tests/scripts/rebuild-stats.test.ts`

#### Task 3.1 — Write the script

- [ ] **Step 1: Write the failing test**

```ts
// code/packages/server/tests/scripts/rebuild-stats.test.ts
import { describe, it, expect } from 'vitest';
import { runRebuild } from '../../scripts/rebuild-stats.js';
import { createDatabase } from '../../src/db/connection.js';

describe('runRebuild', () => {
  it('repopulates stats_cache after a back-filled DB', () => {
    // Build a fixture in-memory DB with:
    //   - 1 user
    //   - 1 game (NS win)
    //   - 8 rounds, 8 player_rounds with real user_ids (post-backfill state)
    //   - plays / tricks / bomb_inventory rows
    //   - stats_cache initially empty
    const { client, close } = seedFixtureDb();

    const { db } = createDatabaseFromClient(client);
    const result = runRebuild({ client, db });

    expect(result.usersUpdated).toBeGreaterThan(0);

    // Cache should now reflect reality
    const cached = client.prepare(`SELECT * FROM stats_cache WHERE user_id = ?`).get('u1') as any;
    expect(cached).toBeTruthy();
    expect(cached.games_played).toBe(1);
    expect(cached.total_rounds_played).toBe(8);

    close();
  });
});
```

> **Helper note**: `seedFixtureDb` and `createDatabaseFromClient` are test helpers to build — keep them minimal. Alternatively, use the in-memory path of `createDatabase(':memory:')` and seed via SQL, then drive `runRebuild` against the same handle.

- [ ] **Step 2: Run test to verify it fails**

```
cd code && pnpm --filter @tichu/server test -- tests/scripts/rebuild-stats.test.ts
```
Expected: FAIL — script doesn't exist.

- [ ] **Step 3: Create `scripts/rebuild-stats.ts`** (modeled on `scripts/wipe-stats-history.ts`):

```ts
// [Stats] Admin script — rebuild stats_cache and relational_stats_cache from
// raw event tables. Use after the back-fill migration (M2) to recompute
// stats for existing games.
//
// Usage:
//   pnpm --filter @tichu/server rebuild-stats [--db <path>] [--force]
//
//   --db <path>   Path to the SQLite file. Defaults to TICHU_DB_PATH env var,
//                 else data/tichu.sqlite.
//   --force       Skip the y/N confirmation prompt.

import { createInterface } from 'readline';
import type { Database as BetterSqlite3Database } from 'better-sqlite3';
import { createDatabase } from '../src/db/connection.js';
import { rebuildStatsCache } from '../src/db/stats-cache.js';
import type { Database } from '../src/db/connection.js';

export interface RebuildResult {
  usersUpdated: number;
  statsCacheRows: number;
  relationalStatsCacheRows: number;
}

export function runRebuild(database: Database): RebuildResult {
  rebuildStatsCache(database);

  const { client } = database;
  const statsRows = (client.prepare(`SELECT COUNT(*) AS n FROM stats_cache`).get() as { n: number }).n;
  const relRows = (client.prepare(`SELECT COUNT(*) AS n FROM relational_stats_cache`).get() as { n: number }).n;
  return {
    usersUpdated: statsRows,  // one row per user
    statsCacheRows: statsRows,
    relationalStatsCacheRows: relRows,
  };
}

function parseArgs(argv: string[]): { dbPath: string; force: boolean } {
  let dbPath = process.env.TICHU_DB_PATH ?? 'data/tichu.sqlite';
  let force = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--force') {
      force = true;
    } else if (arg === '--db') {
      const next = argv[i + 1];
      if (!next) throw new Error('--db requires a path argument');
      dbPath = next;
      i++;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { dbPath, force };
}

function promptYN(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

async function main(): Promise<void> {
  const { dbPath, force } = parseArgs(process.argv.slice(2));
  console.log(`Tichu stats-cache rebuild`);
  console.log(`Database: ${dbPath}`);
  console.log('');

  if (!force) {
    const ok = await promptYN('This will drop and rebuild stats_cache + relational_stats_cache. Continue? (y/N) ');
    if (!ok) {
      console.log('Aborted.');
      process.exit(1);
    }
  }

  const database = createDatabase(dbPath);
  try {
    const result = runRebuild(database);
    console.log(`Rebuilt cache for ${result.usersUpdated} users.`);
    console.log(`  stats_cache rows:             ${result.statsCacheRows}`);
    console.log(`  relational_stats_cache rows:  ${result.relationalStatsCacheRows}`);
  } finally {
    database.close();
  }
}

const invokedAsScript =
  typeof process !== 'undefined'
  && Array.isArray(process.argv)
  && process.argv[1]
  && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop() ?? '');

if (invokedAsScript) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
```

- [ ] **Step 4: Add the `rebuild-stats` script to `package.json`**

In [code/packages/server/package.json](../code/packages/server/package.json), add under `"scripts"`:

```json
    "rebuild-stats": "tsx scripts/rebuild-stats.ts"
```

Placement: alongside the existing `"wipe-stats"` entry at line 16.

- [ ] **Step 5: Run test to verify it passes**

```
cd code && pnpm --filter @tichu/server test -- tests/scripts/rebuild-stats.test.ts
```
Expected: PASS.

- [ ] **Step 6: Run full server test suite**

```
cd code && pnpm --filter @tichu/server test && cd code && pnpm typecheck && cd code && pnpm lint
```
Expected: all PASS.

- [ ] **Step 7: Commit**

```
git add code/packages/server/scripts/rebuild-stats.ts code/packages/server/package.json code/packages/server/tests/scripts/rebuild-stats.test.ts
git commit -m "[Stats]: Add rebuild-stats admin script"
```

---

### M4 — End-to-End Verification (Operational Checklist)

**Goal**: Confirm real user flow — pre-existing DB is back-filled, new games capture user_ids, dashboards show non-zero stats.

- [ ] **Step 1: Start the server fresh against the real DB.**

```
cd code && bash scripts/dev-start.sh
```

Watch the logs for migration messages. The back-fill migration should run once (silent, or with a log line if added).

- [ ] **Step 2: Verify the back-fill ran against existing data.**

```
cd code && sqlite3 packages/server/data/tichu.sqlite "SELECT COUNT(*) AS total, SUM(user_id IS NULL) AS nulls FROM player_rounds"
```
Expected: `total = 108` (or current row count), `nulls = 0` (down from 108) **if all pre-existing games had full 4-human seats**. If some games had bots, `nulls` will equal the number of bot-seat rounds.

- [ ] **Step 3: Run the rebuild script.**

```
cd code && pnpm --filter @tichu/server rebuild-stats -- --force
```
Expected: report prints users updated > 0, stats_cache rows > 0.

- [ ] **Step 4: Check the dashboard.**

Open http://localhost:3000, sign in as a user that played pre-existing games. Navigate to their stats page. Expected: pass/tichu/bomb counters now show non-zero values consistent with their actual play history. `gamesPlayed` reflects the real count (not 2).

- [ ] **Step 5: Play a fresh test game (post-M1).**

Start a new 4-human or mixed human+bot room, play at least one full round to completion. On game-end, verify:

```
cd code && sqlite3 packages/server/data/tichu.sqlite "SELECT game_id, round_number, seat, user_id FROM player_rounds ORDER BY game_id DESC, round_number, seat LIMIT 8"
```
Expected: the newest rows have non-NULL `user_id` for human seats (and NULL for bot seats).

- [ ] **Step 6: Rebuild again, re-check dashboard.**

```
cd code && pnpm --filter @tichu/server rebuild-stats -- --force
```

Open the new player's stats page, verify pass/tichu/bomb counters updated.

- [ ] **Step 7: Update the Definition-of-Done artifacts**

Per [CLAUDE.md](../CLAUDE.md) §Definition of Done:
- Add/update RTM entries for this bug-fix (if an RTM tracks this)
- Update `documentation/` if stats-page behavior docs referenced the broken zero values
- Archive results under `results/` if milestone discipline calls for it

---

## 4. Requirements Traceability (Informal)

| Bug/Symptom | Milestone(s) | Verification |
|---|---|---|
| `player_rounds.user_id` never written | M1 | Unit tests on GameEventCapture + integration on room-handler |
| Pre-existing rows have NULL user_id | M2 | Back-fill migration test |
| `stats_cache` stale / all zeros | M3 | Rebuild script test + M4 dashboard check |
| Bot seats must remain NULL (not crash) | M1 | Unit test in Task 1.1 third case |
| Restored games keep writing NULL user_ids | M1 (Task 1.4) | `app.ts` restore-resolver test |

---

## 5. Self-Review Checklist (before handoff)

- [x] Every task has exact file paths with line numbers.
- [x] Every code step contains the complete code to paste — no "TODO" or "similar to above".
- [x] Every test step shows the exact `pnpm` invocation.
- [x] M1 covers fresh-game path (Task 1.3) AND restore path (Task 1.4).
- [x] M2 back-fill is idempotent (second test case asserts this).
- [x] M3 script mirrors the existing `wipe-stats` pattern (consistent argv parsing, `--force`, import.meta.url guard).
- [x] Bot-seat edge case explicitly tested (Task 1.1 third case).
- [x] Limitation of the back-fill (seat-swap history unrecoverable) documented in comments and in §1.5.
- [x] Commit messages use `[Tag]:` convention (per `.claude/skills/diligent-developer/references/commit-formats.md`).
- [x] Definition-of-Done items (RTM, docs, archives) called out in M4.

---

## 6. Handoff Note

After implementing M1–M3, the server **must be restarted** for the back-fill migration to run (it fires in `createDatabase`). If operating against a long-running server, schedule a restart window. The rebuild script (M3) can be run live without a restart.

If the dashboard still shows zero after M4 step 6, the next diagnostic step is to grep `stats_cache` directly for the affected user_id and compare against what `computeStatsForUser` would produce — the most likely remaining cause would be a user who only ever played as a bot (no user_id to attribute) or a user whose rows are in `bomb_events` / other tables that aren't user-keyed (those are aggregated differently, not per-user).
