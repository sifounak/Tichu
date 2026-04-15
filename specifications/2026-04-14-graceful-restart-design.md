# Graceful Restart: State Serialization & Restore

## Context

The Tichu game server holds all game state in memory (XState actors, room Maps, bot strategy objects). When the server process restarts — for a bug fix, a deploy, or any other reason — all active games are destroyed and players lose their progress.

This design adds the ability to serialize active game state to SQLite on shutdown and restore it on startup, so that players experience only a brief WebSocket reconnection rather than a lost game.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage format | Single JSON blob per game | Always loaded/discarded as a unit; normalization adds complexity without benefit |
| Save trigger | SIGTERM/SIGINT only | Zero runtime overhead; crash recovery is out of scope (accepted risk) |
| Bot state | Fully serialized | Bots resume with card tracker, hand plan, and strategic memory intact |
| Reconnection TTL | 5 minutes | Quick cleanup for dev iteration; long enough for a browser tab refresh |

## Database Schema

Two new transient tables in the existing SQLite database, added to `syncSchema()` using the existing `CREATE TABLE IF NOT EXISTS` pattern. These tables are populated on shutdown and emptied after restore on startup.

### `active_games`

| Column | Type | Purpose |
|--------|------|---------|
| `game_id` | TEXT PRIMARY KEY | GameManager's `gameId` |
| `room_code` | TEXT NOT NULL | Links game to its room |
| `state_blob` | TEXT NOT NULL | Full JSON snapshot (see State Blob Shape) |
| `saved_at` | TEXT NOT NULL | ISO timestamp |

### `active_rooms`

| Column | Type | Purpose |
|--------|------|---------|
| `room_code` | TEXT PRIMARY KEY | Room identifier |
| `room_blob` | TEXT NOT NULL | JSON: Room + userId-to-seat mappings |
| `saved_at` | TEXT NOT NULL | ISO timestamp |

### State Blob Shape (`active_games.state_blob`)

```typescript
interface GameSnapshot {
  gameId: string;
  roomCode: string;
  // XState machine
  machineState: string;               // "playing", "grandTichuDecision", etc.
  machineContext: SerializedContext;    // GameMachineContext with Sets converted to arrays
  // GameManager fields
  vacatedSeats: Seat[];
  choosingSeats: Seat[];
  joinedAfterSpectating: string[];     // userIds
  roundEventHistory: Record<number, RoundEventSummary[]>;
  currentRoundEvents: Record<Seat, RoundEventSummary>;
  endOfTrickBombWindowEndTime: number | null;
  // Timer
  timerState: {
    currentSeat: Seat;
    startTime: number;
    durationMs: number;
  } | null;
  // Bots
  botSeats: Seat[];
  botStates: Record<Seat, BotSnapshot>;
  // Config
  config: GameConfig;
}

interface BotSnapshot {
  seat: Seat;
  // CardTracker state
  cardTracker: {
    topPlayed: Array<{ card: GameCard; playedBy: Seat }>;
    // any other CardTracker fields
  };
  // Strategic state
  handPlan: unknown | null;          // HandPlan structure (serializable as-is)
  planCreated: boolean;
  currentRound: number;
  scoreDiff: number | null;
  passedToRight: GameCard | null;
  mahjongPlayedInStraight: boolean;
  gameScores: Record<Team, number> | null;
  targetScore: number;
  partnerPassedCard: GameCard | null;
  partnerStrengthDetected: boolean;
  partnerStrengthChecked: boolean;
  uncontestedSingleCounts: Record<Seat, number>;
  uncontestedSingleLastRank: Record<Seat, number>;
  lastTricksWonCounts: Record<Seat, number>;
  lastSeenTrickType: string | null;  // CombinationType enum value
  ptsConsecutiveLeads: number;
  lastLeadSeat: Seat | null;
}

// GameMachineContext with Set<Seat> fields converted to Seat[]
interface SerializedContext {
  gameId: string;
  config: GameConfig;
  seats: Record<Seat, boolean>;
  scores: Record<Team, number>;
  roundHistory: RoundScore[];
  currentRound: RoundState | null;
  grandTichuDecisions: Seat[];         // was Set<Seat>
  cardPassDecisions: Seat[];           // was Set<Seat>
  winner: Team | null;
}
```

### Room Blob Shape (`active_rooms.room_blob`)

```typescript
interface RoomSnapshot {
  roomCode: string;
  roomName: string;
  hostSeat: Seat;
  players: Array<{
    seat: Seat;
    name: string;
    isBot: boolean;
  }>;
  config: GameConfig;
  gameInProgress: true;                // only rooms with active games are saved
  // userId mappings (needed to reconstruct RoomManager's internal Maps)
  seatToUserId: Record<Seat, string>;  // human seats only
}
```

## Serialization (Shutdown Path)

Triggered by `SIGTERM` or `SIGINT` signal handler, before `app.stop()`.

### Sequence

1. Broadcast `SERVER_SHUTTING_DOWN` to all connected WebSocket clients
2. For each active game in `GameStore`:
   - Call `GameManager.serialize()` which captures:
     - `actor.getSnapshot()` — XState state value + context
     - Converts `Set` fields to arrays for JSON compatibility
     - Bot state via `BotRunner.serialize()` → each `Bot.serialize()`
     - Turn timer metadata (seat, start time, duration)
     - Round event history + current event tracker summaries
     - GameManager-level fields (vacatedSeats, choosingSeats, etc.)
   - Write JSON to `active_games`
3. For each room with `gameInProgress` in `RoomManager`:
   - Call `RoomManager.serializeActiveRooms()` which captures:
     - Room object (players, config, hostSeat)
     - userId-to-seat mappings from internal Maps
   - Write JSON to `active_rooms`
4. All writes in a single SQLite transaction
5. Proceed with `app.stop()` (close WebSockets, DB, Fastify)

### New Methods

| Class | Method | Returns |
|-------|--------|---------|
| `GameManager` | `serialize(): GameSnapshot` | JSON-ready snapshot of all game state |
| `Bot` | `serialize(): BotSnapshot` | Card tracker, hand plan, strategic flags |
| `BotRunner` | `serialize(): Record<Seat, BotSnapshot>` | All bot states keyed by seat |
| `RoomManager` | `serializeActiveRooms(): RoomSnapshot[]` | Rooms with `gameInProgress === true` |

## Deserialization (Startup Path)

Runs on server startup, after `syncSchema()` but before `connections.startHeartbeat()`.

### Sequence

1. Read all rows from `active_games` and `active_rooms`
2. If no rows, skip (normal fresh start)
3. For each room snapshot:
   - Reconstruct `Room` object in `RoomManager` via `RoomManager.restoreRooms(snapshots)`
   - Rebuild `userToRoom`, `userToSeat`, `seatToUser` Maps
   - Mark all human players as `isConnected: false`
4. For each game snapshot:
   - Call `GameManager.restore(snapshot, broadcaster, disconnectHandler, voteHandler)`
   - Inside restore:
     - Create XState actor via `createActor(gameMachine, { snapshot: persistedSnapshot })` (XState 5 snapshot restoration)
     - Convert arrays back to Sets
     - Reconstruct `BotRunner` with deserialized `Bot` instances via `Bot.restore(snapshot)`
     - Reconstruct `RoundEventTracker` state
     - Do NOT start turn timers yet — timers resume when the first human reconnects (see Timer Restart below)
   - Register in `GameStore` via `GameStore.restoreGame(gameManager)`
5. Start a 5-minute reconnection TTL timer per restored game
6. Delete all rows from `active_games` and `active_rooms`
7. Continue normal startup

### New Methods

| Class | Method | Purpose |
|-------|--------|---------|
| `GameManager` | `static restore(snapshot, broadcaster, disconnectHandler, voteHandler): GameManager` | Factory that rebuilds from snapshot |
| `Bot` | `static restore(snapshot): Bot` | Reconstruct bot with full strategic memory |
| `BotRunner` | `static restore(snapshots, actor, moveHandler): BotRunner` | Reconstruct with deserialized bots |
| `RoomManager` | `restoreRooms(snapshots): void` | Bulk rebuild room state from snapshots |
| `GameStore` | `restoreGame(gameManager): void` | Register a pre-built GameManager |

## Reconnection TTL & Cleanup

### Timer Restart After Reconnection

Turn timers are NOT started on restore (nobody is connected to act). When the first human player reconnects to a restored game:

1. Cancel the reconnection TTL timer for that game
2. If the restored XState state is `playing` and it's a human player's turn, start a fresh turn timer for the full configured duration (don't try to calculate "remaining time" — just give them a full turn)
3. If it's a bot's turn, trigger the bot's decision logic immediately
4. If the state is `grandTichuDecision` or `cardPassing`, no turn timer is needed (those phases don't have per-turn timers)

Subsequent human reconnections follow normal reconnection logic (no special timer handling).

### Per-Game TTL

- On restore, each game gets a 5-minute `setTimeout`
- If the timer fires (no human reconnected), the game and its room are destroyed
- Any human reconnection for that game cancels the TTL timer
- After TTL cancellation, normal disconnect/vote logic governs further disconnections

### Room-to-Game Cleanup Link (Pre-existing Gap Fix)

`RoomManager.cleanupStaleRooms()` currently destroys rooms with no connected humans after 30 minutes, but does NOT clean up the corresponding `GameStore` entry. This is an independent bug.

**Fix:** Add an `onRoomDestroyed` callback to `RoomManager` that `GameStore.destroyGameByRoom()` subscribes to. When a stale room is cleaned up, its game is destroyed too.

### No Leftover DB Rows

- `active_games` and `active_rooms` are emptied immediately after loading on startup
- If the server crashes before clearing them, the next startup finds them and restores — correct behavior
- A crash during serialization (partial write) is handled by the SQLite transaction — either all games are saved or none are

## Graceful Shutdown Broadcast

### New Protocol Message

Server to client: `SERVER_SHUTTING_DOWN` (no payload)

### Client Behavior

1. On receiving `SERVER_SHUTTING_DOWN`, show a non-dismissable banner: "Server restarting — you'll be reconnected automatically"
2. When the WebSocket closes, enter an auto-reconnect loop with exponential backoff: 1s, 2s, 4s, 8s, capped at 15s
3. On successful reconnect, the existing reconnection logic in `app.ts` finds the restored room/game and sends `ROOM_JOINED` + `GAME_STATE`
4. Dismiss the banner on successful reconnect

### Protocol Addition

Add to `ServerMessage` union in `@tichu/shared` `protocol.ts`:
```typescript
| { type: 'SERVER_SHUTTING_DOWN' }
```

## What Is NOT Serialized

| Item | Reason |
|------|--------|
| Spectators | Rejoin naturally; no game state depends on them |
| Disconnect vote sessions | Moot after restart; all players start disconnected, TTL governs cleanup |
| Player vote sessions | Same reasoning |
| Ready states | Only relevant pre-game, not mid-game |
| WebSocket references | Ephemeral by definition |
| `autoPassTimer`, `scoringTimer`, `endOfTrickBombTimer` | Reconstructed contextually from XState state value on re-entry |
| `dragonGiftedTo`, `lastDogPlay` | Animation-only signals; safe to clear |

## Set-to-Array Conversion

`JSON.stringify` cannot handle `Set` objects. The following fields require conversion:

| Location | Field | Serialize | Deserialize |
|----------|-------|-----------|-------------|
| `GameMachineContext` | `grandTichuDecisions` | `[...set]` | `new Set(arr)` |
| `GameMachineContext` | `cardPassDecisions` | `[...set]` | `new Set(arr)` |
| `GameManager` | `vacatedSeats` | `[...set]` | `new Set(arr)` |
| `GameManager` | `choosingSeats` | `[...set]` | `new Set(arr)` |
| `GameManager` | `joinedAfterSpectating` | `[...set]` | `new Set(arr)` |
| `RoundEventTracker` | `dogStuckDetected` | `[...set]` | `new Set(arr)` |

### Map-to-Object Conversion

`JSON.stringify` also cannot handle `Map` objects. These require `Object.fromEntries()` / `new Map(Object.entries())`:

| Location | Field | Serialize | Deserialize |
|----------|-------|-----------|-------------|
| `GameManager` | `roundEventHistory` | `Object.fromEntries(map)` | `new Map(Object.entries(obj))` |
| `RoundEventTracker` | `summaries` | `Object.fromEntries(map)` | `new Map(Object.entries(obj))` |
| `RoundEventTracker` | `processedBombCount` | `Object.fromEntries(map)` | `new Map(Object.entries(obj))` |

## Files to Modify

### New Files
- `code/packages/server/src/game/game-serializer.ts` — serialize/deserialize logic, snapshot types
- `code/packages/server/src/db/active-game-persistence.ts` — DB read/write for `active_games` and `active_rooms`

### Modified Files
- `code/packages/server/src/db/schema.ts` — add `activeGames` and `activeRooms` table definitions
- `code/packages/server/src/db/connection.ts` — add `CREATE TABLE IF NOT EXISTS` for new tables in `syncSchema()`
- `code/packages/server/src/game/game-manager.ts` — add `serialize()` method and `static restore()` factory
- `code/packages/server/src/game/game-store.ts` — add `restoreGame()` method
- `code/packages/server/src/game/game-state-machine.ts` — add `createGameActorFromSnapshot()` helper
- `code/packages/server/src/bot/bot.ts` — add `serialize()` and `static restore()` methods
- `code/packages/server/src/bot/bot-runner.ts` — add `serialize()` and `static restore()` methods
- `code/packages/server/src/game/round-event-tracker.ts` — add `serialize()` and `restore()` methods
- `code/packages/server/src/game/turn-timer.ts` — add `serialize()` and `static restore()` methods
- `code/packages/server/src/room/room-manager.ts` — add `serializeActiveRooms()`, `restoreRooms()`, `onRoomDestroyed` callback
- `code/packages/server/src/app.ts` — add signal handler, call serialize on shutdown, call restore on startup
- `code/packages/server/src/index.ts` — wire signal handling
- `code/packages/shared/src/types/protocol.ts` — add `SERVER_SHUTTING_DOWN` message type
- Client: WebSocket hook — handle `SERVER_SHUTTING_DOWN`, show banner, auto-reconnect with backoff

## Verification

1. **Unit tests**: `GameManager.serialize()` → `GameManager.restore()` round-trip preserves all state fields
2. **Unit tests**: Set-to-array conversion round-trips correctly
3. **Unit tests**: Bot state serialization round-trip preserves card tracker and strategic fields
4. **Integration test**: Start server → create game → advance to mid-round → send SIGTERM → restart → verify game state restored → simulate client reconnection → verify `GAME_STATE` message matches pre-shutdown state
5. **TTL test**: Restore a game, wait 5+ minutes with no reconnection, verify game and room are destroyed
6. **Room-game cleanup test**: Destroy a stale room, verify corresponding GameStore entry is also destroyed
7. **Manual test**: Play a game with bots → restart server → reconnect in browser → verify game resumes seamlessly
