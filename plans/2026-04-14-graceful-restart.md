# Graceful Restart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serialize active game state to SQLite on shutdown and restore it on startup, so players reconnect to their in-progress games after a server restart.

**Architecture:** On SIGTERM/SIGINT, each active GameManager serializes its full state (XState snapshot, bot memory, round events, timer metadata) as a JSON blob into an `active_games` table. Room state goes into `active_rooms`. On startup, rows are read, GameManagers are reconstructed, and a 5-minute TTL starts per game. Clients receive `SERVER_SHUTTING_DOWN`, auto-reconnect, and resume play.

**Tech Stack:** TypeScript, XState 5 (persisted snapshots), SQLite via better-sqlite3 + Drizzle ORM, Vitest, Zod, Next.js (client)

**Spec:** `docs/superpowers/specs/2026-04-14-graceful-restart-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|----------------|
| `code/packages/server/src/game/game-serializer.ts` | Snapshot type definitions + serialize/deserialize helpers for Set↔Array and Map↔Object conversions |
| `code/packages/server/src/db/active-game-persistence.ts` | DB read/write for `active_games` and `active_rooms` tables |
| `code/packages/server/tests/game/game-serializer.test.ts` | Round-trip tests for snapshot types and conversions |
| `code/packages/server/tests/game/serialize-restore.test.ts` | Integration: GameManager serialize → restore round-trip |
| `code/packages/server/tests/db/active-game-persistence.test.ts` | DB layer tests |
| `code/packages/server/tests/game/reconnection-ttl.test.ts` | TTL timer and cleanup tests |

### Modified Files
| File | Changes |
|------|---------|
| `code/packages/shared/src/types/protocol.ts` | Add `SERVER_SHUTTING_DOWN` to ServerMessage union |
| `code/packages/server/src/db/schema.ts` | Add `activeGames` and `activeRooms` table definitions |
| `code/packages/server/src/db/connection.ts` | Add `CREATE TABLE IF NOT EXISTS` for new tables in `syncSchema()` |
| `code/packages/server/src/bot/card-tracker.ts` | Add `serialize()` and `static restore()` |
| `code/packages/server/src/bot/bot.ts` | Add `serialize()` and `static restore()` |
| `code/packages/server/src/bot/bot-runner.ts` | Add `serialize()` and `static restore()` |
| `code/packages/server/src/game/round-event-tracker.ts` | Add `serialize()` and `static restore()` |
| `code/packages/server/src/game/turn-timer.ts` | Add `serialize()` and `static restore()` |
| `code/packages/server/src/game/game-state-machine.ts` | Add `createGameActorFromSnapshot()` helper |
| `code/packages/server/src/game/game-manager.ts` | Add `serialize()` method and `static restore()` factory |
| `code/packages/server/src/game/game-store.ts` | Add `restoreGame()` method, reconnection TTL logic |
| `code/packages/server/src/room/room-manager.ts` | Add `serializeActiveRooms()`, `restoreRooms()`, `onRoomDestroyed` callback |
| `code/packages/server/src/app.ts` | Add `serializeAndShutdown()`, call restore on startup, wire `onRoomDestroyed` |
| `code/packages/server/src/index.ts` | Add SIGTERM/SIGINT signal handlers |
| `code/packages/client/src/hooks/useWebSocket.ts` | Handle `SERVER_SHUTTING_DOWN` message |
| `code/packages/client/src/app/game/[gameId]/page.tsx` | Show shutdown/reconnecting banner |

---

## Task 1: Snapshot Types & Conversion Helpers

**Files:**
- Create: `code/packages/server/src/game/game-serializer.ts`
- Create: `code/packages/server/tests/game/game-serializer.test.ts`

- [ ] **Step 1: Write failing tests for Set↔Array and Map↔Object conversion**

```typescript
// code/packages/server/tests/game/game-serializer.test.ts
import { describe, it, expect } from 'vitest';
import {
  serializeSet,
  deserializeSet,
  serializeMap,
  deserializeMap,
  type GameSnapshot,
  type RoomSnapshot,
  type BotSnapshot,
  type SerializedContext,
  type TimerSnapshot,
} from '../../src/game/game-serializer.js';

describe('game-serializer', () => {
  describe('Set↔Array conversion', () => {
    it('round-trips a Set of strings', () => {
      const original = new Set(['north', 'south']);
      const serialized = serializeSet(original);
      expect(serialized).toEqual(['north', 'south']);
      const restored = deserializeSet<string>(serialized);
      expect(restored).toEqual(original);
    });

    it('handles empty Set', () => {
      const original = new Set<string>();
      expect(serializeSet(original)).toEqual([]);
      expect(deserializeSet<string>([])).toEqual(original);
    });
  });

  describe('Map↔Object conversion', () => {
    it('round-trips a Map with string keys', () => {
      const original = new Map<string, number>([['north', 3], ['south', 1]]);
      const serialized = serializeMap(original);
      expect(serialized).toEqual({ north: 3, south: 1 });
      const restored = deserializeMap<string, number>(serialized);
      expect(restored).toEqual(original);
    });

    it('round-trips a Map with number keys', () => {
      const original = new Map<number, string[]>([[1, ['a']], [2, ['b', 'c']]]);
      const serialized = serializeMap(original);
      const restored = deserializeMap<string, string[]>(serialized);
      // Keys come back as strings from JSON, caller converts if needed
      expect(restored.get('1')).toEqual(['a']);
      expect(restored.get('2')).toEqual(['b', 'c']);
    });

    it('handles empty Map', () => {
      const original = new Map<string, number>();
      expect(serializeMap(original)).toEqual({});
      expect(deserializeMap<string, number>({})).toEqual(original);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd code && npx vitest run packages/server/tests/game/game-serializer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement snapshot types and conversion helpers**

```typescript
// code/packages/server/src/game/game-serializer.ts
import type {
  Seat,
  Team,
  GameConfig,
  GameCard,
  RoundScore,
  RoundState,
  CombinationType,
} from '@tichu/shared';
import type { RoundEventSummary } from './round-event-types.js';

// ─── Conversion Helpers ────────────────────────────────────────────────────

export function serializeSet<T>(set: Set<T>): T[] {
  return [...set];
}

export function deserializeSet<T>(arr: T[]): Set<T> {
  return new Set(arr);
}

export function serializeMap<K, V>(map: Map<K, V>): Record<string, V> {
  return Object.fromEntries(map);
}

export function deserializeMap<K extends string, V>(
  obj: Record<string, V>,
): Map<K, V> {
  return new Map(Object.entries(obj)) as Map<K, V>;
}

// ─── Snapshot Types ────────────────────────────────────────────────────────

export interface SerializedContext {
  gameId: string;
  config: GameConfig;
  seats: Record<Seat, boolean>;
  scores: Record<Team, number>;
  roundHistory: RoundScore[];
  currentRound: RoundState | null;
  grandTichuDecisions: Seat[];
  cardPassDecisions: Seat[];
  winner: Team | null;
}

export interface TimerSnapshot {
  currentSeat: Seat;
  startTime: number;
  durationMs: number;
}

export interface CardTrackerSnapshot {
  dragonPlayed: boolean;
  dragonPlayedBy: Seat | null;
  phoenixPlayed: boolean;
  phoenixPlayedBy: Seat | null;
  playedByRank: Record<string, { count: number; bySeat: Seat[] }>;
  processedCardIds: number[];
  ownHandRankCounts: Record<string, number>;
  ownHandHasDragon: boolean;
  ownHandHasPhoenix: boolean;
}

export interface BotSnapshot {
  seat: Seat;
  cardTracker: CardTrackerSnapshot;
  handPlan: unknown | null;
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
  lastSeenTrickType: CombinationType | null;
  ptsConsecutiveLeads: number;
  lastLeadSeat: Seat | null;
  lastRoundState: RoundState | null;
}

export interface EventTrackerSnapshot {
  summaries: Record<string, RoundEventSummary>;
  currentRoundNumber: number;
  processedBombCount: Record<string, number>;
  dogStuckDetected: Seat[];
}

export interface GameSnapshot {
  gameId: string;
  roomCode: string;
  machineSnapshot: unknown;
  vacatedSeats: Seat[];
  choosingSeats: Seat[];
  joinedAfterSpectating: string[];
  roundEventHistory: Record<string, RoundEventSummary[]>;
  currentRoundEvents: EventTrackerSnapshot;
  endOfTrickBombWindowEndTime: number | null;
  timerState: TimerSnapshot | null;
  botSeats: Seat[];
  botStates: Record<string, BotSnapshot>;
  config: GameConfig;
}

export interface RoomSnapshot {
  roomCode: string;
  roomName: string;
  hostSeat: Seat;
  players: Array<{ seat: Seat; name: string; isBot: boolean }>;
  config: GameConfig;
  gameInProgress: true;
  seatToUserId: Record<string, string>;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd code && npx vitest run packages/server/tests/game/game-serializer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add code/packages/server/src/game/game-serializer.ts code/packages/server/tests/game/game-serializer.test.ts
git commit -m "feat(restart): add snapshot types and Set/Map conversion helpers"
```

---

## Task 2: CardTracker Serialization

**Files:**
- Modify: `code/packages/server/src/bot/card-tracker.ts`
- Test: `code/packages/server/tests/bot/card-tracker-serialize.test.ts`

- [ ] **Step 1: Write failing tests for CardTracker serialize/restore**

```typescript
// code/packages/server/tests/bot/card-tracker-serialize.test.ts
import { describe, it, expect } from 'vitest';
import { CardTracker } from '../../src/bot/card-tracker.js';

describe('CardTracker serialization', () => {
  it('round-trips an empty tracker', () => {
    const tracker = new CardTracker();
    const snapshot = tracker.serialize();
    const restored = CardTracker.restore(snapshot);

    expect(restored.isDragonPlayed()).toBe(false);
    expect(restored.isPhoenixUnaccounted()).toBe(true);
    expect(restored.getTop10Status()).toEqual(tracker.getTop10Status());
  });

  it('round-trips a tracker with played cards', () => {
    const tracker = new CardTracker();

    // Simulate some state by directly serializing known state
    const snapshot = tracker.serialize();
    snapshot.dragonPlayed = true;
    snapshot.dragonPlayedBy = 'north';
    snapshot.processedCardIds = [1, 2, 3];
    snapshot.playedByRank = { '14': { count: 2, bySeat: ['north', 'east'] } };

    const restored = CardTracker.restore(snapshot);
    expect(restored.isDragonPlayed()).toBe(true);

    const reSnapshot = restored.serialize();
    expect(reSnapshot.dragonPlayed).toBe(true);
    expect(reSnapshot.dragonPlayedBy).toBe('north');
    expect(reSnapshot.processedCardIds).toEqual([1, 2, 3]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd code && npx vitest run packages/server/tests/bot/card-tracker-serialize.test.ts`
Expected: FAIL — serialize/restore not defined

- [ ] **Step 3: Add serialize() and static restore() to CardTracker**

Add these methods to the `CardTracker` class in `code/packages/server/src/bot/card-tracker.ts`:

```typescript
import type { CardTrackerSnapshot } from '../game/game-serializer.js';
import { serializeSet, deserializeSet, serializeMap, deserializeMap } from '../game/game-serializer.js';

// Inside CardTracker class:

serialize(): CardTrackerSnapshot {
  return {
    dragonPlayed: this.dragonPlayed,
    dragonPlayedBy: this.dragonPlayedBy,
    phoenixPlayed: this.phoenixPlayed,
    phoenixPlayedBy: this.phoenixPlayedBy,
    playedByRank: serializeMap(this.playedByRank),
    processedCardIds: serializeSet(this.processedCardIds),
    ownHandRankCounts: serializeMap(this.ownHandRankCounts),
    ownHandHasDragon: this.ownHandHasDragon,
    ownHandHasPhoenix: this.ownHandHasPhoenix,
  };
}

static restore(snapshot: CardTrackerSnapshot): CardTracker {
  const tracker = new CardTracker();
  tracker.dragonPlayed = snapshot.dragonPlayed;
  tracker.dragonPlayedBy = snapshot.dragonPlayedBy;
  tracker.phoenixPlayed = snapshot.phoenixPlayed;
  tracker.phoenixPlayedBy = snapshot.phoenixPlayedBy;
  tracker.playedByRank = deserializeMap(snapshot.playedByRank);
  tracker.processedCardIds = deserializeSet(snapshot.processedCardIds);
  tracker.ownHandRankCounts = deserializeMap(snapshot.ownHandRankCounts);
  tracker.ownHandHasDragon = snapshot.ownHandHasDragon;
  tracker.ownHandHasPhoenix = snapshot.ownHandHasPhoenix;
  return tracker;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd code && npx vitest run packages/server/tests/bot/card-tracker-serialize.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add code/packages/server/src/bot/card-tracker.ts code/packages/server/tests/bot/card-tracker-serialize.test.ts
git commit -m "feat(restart): add CardTracker serialize/restore"
```

---

## Task 3: Bot Serialization

**Files:**
- Modify: `code/packages/server/src/bot/bot.ts`
- Test: `code/packages/server/tests/bot/bot-serialize.test.ts`

- [ ] **Step 1: Write failing tests for Bot serialize/restore**

```typescript
// code/packages/server/tests/bot/bot-serialize.test.ts
import { describe, it, expect } from 'vitest';
import { Bot } from '../../src/bot/bot.js';

describe('Bot serialization', () => {
  it('round-trips a fresh bot', () => {
    const bot = new Bot();
    const snapshot = bot.serialize();
    const restored = Bot.restore(snapshot);

    expect(restored.serialize()).toEqual(snapshot);
  });

  it('preserves seat and strategic state', () => {
    const bot = new Bot();
    bot.setContext(
      { roundNumber: 2 } as any,  // minimal RoundState
      { northSouth: 300, eastWest: 150 },
      1000,
    );

    const snapshot = bot.serialize();
    expect(snapshot.gameScores).toEqual({ northSouth: 300, eastWest: 150 });
    expect(snapshot.targetScore).toBe(1000);

    const restored = Bot.restore(snapshot);
    expect(restored.getGameScores()).toEqual({ northSouth: 300, eastWest: 150 });
    expect(restored.getTargetScore()).toBe(1000);
  });

  it('preserves card tracker state through bot', () => {
    const bot = new Bot();
    const snapshot = bot.serialize();
    snapshot.cardTracker.dragonPlayed = true;

    const restored = Bot.restore(snapshot);
    expect(restored.getCardTracker().isDragonPlayed()).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd code && npx vitest run packages/server/tests/bot/bot-serialize.test.ts`
Expected: FAIL — serialize/restore not defined on Bot

- [ ] **Step 3: Add serialize() and static restore() to Bot**

Add these methods to the `Bot` class in `code/packages/server/src/bot/bot.ts`:

```typescript
import type { BotSnapshot } from '../game/game-serializer.js';
import { CardTracker } from './card-tracker.js';

// Inside Bot class:

serialize(): BotSnapshot {
  return {
    seat: this.mySeat,
    cardTracker: this.cardTracker.serialize(),
    handPlan: this.handPlan,
    planCreated: this.planCreated,
    currentRound: this.currentRound,
    scoreDiff: this.scoreDiff,
    passedToRight: this.passedToRight,
    mahjongPlayedInStraight: this.mahjongPlayedInStraight,
    gameScores: this.gameScores,
    targetScore: this.targetScore,
    partnerPassedCard: this.partnerPassedCard,
    partnerStrengthDetected: this.partnerStrengthDetected,
    partnerStrengthChecked: this.partnerStrengthChecked,
    uncontestedSingleCounts: { ...this.uncontestedSingleCounts },
    uncontestedSingleLastRank: { ...this.uncontestedSingleLastRank },
    lastTricksWonCounts: { ...this.lastTricksWonCounts },
    lastSeenTrickType: this.lastSeenTrickType,
    ptsConsecutiveLeads: this.ptsConsecutiveLeads,
    lastLeadSeat: this.lastLeadSeat,
    lastRoundState: this.lastRoundState,
  };
}

static restore(snapshot: BotSnapshot): Bot {
  const bot = new Bot();
  bot.mySeat = snapshot.seat;
  bot.cardTracker = CardTracker.restore(snapshot.cardTracker);
  bot.handPlan = snapshot.handPlan as any;
  bot.planCreated = snapshot.planCreated;
  bot.currentRound = snapshot.currentRound;
  bot.scoreDiff = snapshot.scoreDiff;
  bot.passedToRight = snapshot.passedToRight;
  bot.mahjongPlayedInStraight = snapshot.mahjongPlayedInStraight;
  bot.gameScores = snapshot.gameScores;
  bot.targetScore = snapshot.targetScore;
  bot.partnerPassedCard = snapshot.partnerPassedCard;
  bot.partnerStrengthDetected = snapshot.partnerStrengthDetected;
  bot.partnerStrengthChecked = snapshot.partnerStrengthChecked;
  bot.uncontestedSingleCounts = { ...snapshot.uncontestedSingleCounts };
  bot.uncontestedSingleLastRank = { ...snapshot.uncontestedSingleLastRank };
  bot.lastTricksWonCounts = { ...snapshot.lastTricksWonCounts };
  bot.lastSeenTrickType = snapshot.lastSeenTrickType;
  bot.ptsConsecutiveLeads = snapshot.ptsConsecutiveLeads;
  bot.lastLeadSeat = snapshot.lastLeadSeat;
  bot.lastRoundState = snapshot.lastRoundState;
  return bot;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd code && npx vitest run packages/server/tests/bot/bot-serialize.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add code/packages/server/src/bot/bot.ts code/packages/server/tests/bot/bot-serialize.test.ts
git commit -m "feat(restart): add Bot serialize/restore"
```

---

## Task 4: BotRunner Serialization

**Files:**
- Modify: `code/packages/server/src/bot/bot-runner.ts`
- Test: `code/packages/server/tests/bot/bot-runner-serialize.test.ts`

- [ ] **Step 1: Write failing tests for BotRunner serialize/restore**

```typescript
// code/packages/server/tests/bot/bot-runner-serialize.test.ts
import { describe, it, expect, vi } from 'vitest';
import { BotRunner } from '../../src/bot/bot-runner.js';
import { Bot } from '../../src/bot/bot.js';
import type { GameActor } from '../../src/game/game-state-machine.js';
import type { MoveHandler } from '../../src/game/move-handler.js';
import type { Seat } from '@tichu/shared';

describe('BotRunner serialization', () => {
  it('serializes all bot states keyed by seat', () => {
    const mockActor = { getSnapshot: vi.fn().mockReturnValue({ context: {} }) } as unknown as GameActor;
    const mockMoveHandler = {} as MoveHandler;
    const runner = new BotRunner(mockActor, undefined, mockMoveHandler);

    // Add bots manually for test
    const botN = new Bot();
    const botE = new Bot();
    runner.addBot('north' as Seat, botN);
    runner.addBot('east' as Seat, botE);

    const snapshot = runner.serialize();
    expect(Object.keys(snapshot)).toContain('north');
    expect(Object.keys(snapshot)).toContain('east');
    expect(snapshot['north'].seat).toBe('north');
  });

  it('round-trips via static restore', () => {
    const mockActor = { getSnapshot: vi.fn().mockReturnValue({ context: {} }) } as unknown as GameActor;
    const mockMoveHandler = {} as MoveHandler;
    const runner = new BotRunner(mockActor, undefined, mockMoveHandler);

    const bot = new Bot();
    runner.addBot('south' as Seat, bot);

    const snapshot = runner.serialize();
    const restored = BotRunner.restore(snapshot, mockActor, mockMoveHandler);

    const reSnapshot = restored.serialize();
    expect(reSnapshot['south'].seat).toBe('south');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd code && npx vitest run packages/server/tests/bot/bot-runner-serialize.test.ts`
Expected: FAIL — serialize/restore/addBot not defined

- [ ] **Step 3: Add serialize(), static restore(), and addBot() to BotRunner**

In `code/packages/server/src/bot/bot-runner.ts`, add:

```typescript
import type { BotSnapshot } from '../game/game-serializer.js';
import { Bot } from './bot.js';

// Inside BotRunner class:

/** Expose bot map for serialization. */
addBot(seat: Seat, bot: Bot): void {
  this.bots.set(seat, bot);
}

/** Get the bot seats. */
getBotSeats(): Seat[] {
  return [...this.bots.keys()];
}

serialize(): Record<string, BotSnapshot> {
  const result: Record<string, BotSnapshot> = {};
  for (const [seat, bot] of this.bots) {
    result[seat] = bot.serialize();
  }
  return result;
}

static restore(
  botStates: Record<string, BotSnapshot>,
  actor: GameActor,
  moveHandler: MoveHandler,
): BotRunner {
  const runner = new BotRunner(actor, undefined, moveHandler);
  for (const [seat, snapshot] of Object.entries(botStates)) {
    const bot = Bot.restore(snapshot);
    runner.bots.set(seat as Seat, bot);
  }
  return runner;
}
```

Note: The `addBot` method may already exist or bots may be added via a different mechanism. Check `bot-runner.ts` for the existing pattern of adding bots to the `this.bots` Map and adapt accordingly. The `static restore` method needs direct access to `this.bots` — if it's private, the static method can access it since it's in the same class.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd code && npx vitest run packages/server/tests/bot/bot-runner-serialize.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add code/packages/server/src/bot/bot-runner.ts code/packages/server/tests/bot/bot-runner-serialize.test.ts
git commit -m "feat(restart): add BotRunner serialize/restore"
```

---

## Task 5: RoundEventTracker Serialization

**Files:**
- Modify: `code/packages/server/src/game/round-event-tracker.ts`
- Test: `code/packages/server/tests/game/round-event-tracker-serialize.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// code/packages/server/tests/game/round-event-tracker-serialize.test.ts
import { describe, it, expect } from 'vitest';
import { RoundEventTracker } from '../../src/game/round-event-tracker.js';
import { createBlankSummary } from '../../src/game/round-event-types.js';

describe('RoundEventTracker serialization', () => {
  it('round-trips an empty tracker', () => {
    const tracker = new RoundEventTracker();
    const snapshot = tracker.serialize();
    const restored = RoundEventTracker.restore(snapshot);
    expect(restored.serialize()).toEqual(snapshot);
  });

  it('preserves summaries and round number', () => {
    const tracker = new RoundEventTracker();
    tracker.reset(3);

    const snapshot = tracker.serialize();
    expect(snapshot.currentRoundNumber).toBe(3);

    const restored = RoundEventTracker.restore(snapshot);
    expect(restored.serialize().currentRoundNumber).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd code && npx vitest run packages/server/tests/game/round-event-tracker-serialize.test.ts`
Expected: FAIL

- [ ] **Step 3: Add serialize() and static restore() to RoundEventTracker**

In `code/packages/server/src/game/round-event-tracker.ts`, add:

```typescript
import type { EventTrackerSnapshot } from './game-serializer.js';
import { serializeMap, deserializeMap, serializeSet, deserializeSet } from './game-serializer.js';

// Inside RoundEventTracker class:

serialize(): EventTrackerSnapshot {
  return {
    summaries: serializeMap(this.summaries),
    currentRoundNumber: this.currentRoundNumber,
    processedBombCount: serializeMap(this.processedBombCount),
    dogStuckDetected: serializeSet(this.dogStuckDetected),
  };
}

static restore(snapshot: EventTrackerSnapshot): RoundEventTracker {
  const tracker = new RoundEventTracker();
  tracker.summaries = deserializeMap(snapshot.summaries);
  tracker.currentRoundNumber = snapshot.currentRoundNumber;
  tracker.processedBombCount = deserializeMap(snapshot.processedBombCount);
  tracker.dogStuckDetected = deserializeSet(snapshot.dogStuckDetected);
  return tracker;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd code && npx vitest run packages/server/tests/game/round-event-tracker-serialize.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add code/packages/server/src/game/round-event-tracker.ts code/packages/server/tests/game/round-event-tracker-serialize.test.ts
git commit -m "feat(restart): add RoundEventTracker serialize/restore"
```

---

## Task 6: TurnTimer Serialization

**Files:**
- Modify: `code/packages/server/src/game/turn-timer.ts`
- Test: `code/packages/server/tests/game/turn-timer-serialize.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// code/packages/server/tests/game/turn-timer-serialize.test.ts
import { describe, it, expect, vi } from 'vitest';
import { TurnTimer } from '../../src/game/turn-timer.js';
import type { TimerSnapshot } from '../../src/game/game-serializer.js';

describe('TurnTimer serialization', () => {
  it('returns null snapshot when timer is disabled', () => {
    const timer = new TurnTimer(null, vi.fn());
    expect(timer.serialize()).toBeNull();
    timer.dispose();
  });

  it('returns null snapshot when timer is not active', () => {
    const timer = new TurnTimer(30, vi.fn());
    expect(timer.serialize()).toBeNull();
    timer.dispose();
  });

  it('captures active timer state', () => {
    const timer = new TurnTimer(30, vi.fn());
    timer.start('north');
    const snapshot = timer.serialize();
    expect(snapshot).not.toBeNull();
    expect(snapshot!.currentSeat).toBe('north');
    expect(snapshot!.durationMs).toBe(30000);
    expect(typeof snapshot!.startTime).toBe('number');
    timer.dispose();
  });

  it('restores with correct duration', () => {
    const onTimeout = vi.fn();
    const snapshot: TimerSnapshot = {
      currentSeat: 'east',
      startTime: Date.now() - 5000,
      durationMs: 30000,
    };
    const restored = TurnTimer.restore(snapshot, onTimeout);
    expect(restored.isEnabled()).toBe(true);
    expect(restored.getDurationMs()).toBe(30000);
    // Timer is NOT started on restore — caller starts it explicitly
    expect(restored.isActive()).toBe(false);
    restored.dispose();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd code && npx vitest run packages/server/tests/game/turn-timer-serialize.test.ts`
Expected: FAIL

- [ ] **Step 3: Add serialize() and static restore() to TurnTimer**

In `code/packages/server/src/game/turn-timer.ts`, add:

```typescript
import type { TimerSnapshot } from './game-serializer.js';

// Inside TurnTimer class:

serialize(): TimerSnapshot | null {
  if (!this.isEnabled() || !this.isActive()) return null;
  return {
    currentSeat: this.currentSeat!,
    startTime: this.startTime!,
    durationMs: this.durationMs!,
  };
}

static restore(
  snapshot: TimerSnapshot | null,
  onTimeout: TurnTimeoutCallback,
): TurnTimer {
  if (!snapshot) return new TurnTimer(null, onTimeout);
  const turnTimerSeconds = snapshot.durationMs / 1000;
  return new TurnTimer(turnTimerSeconds, onTimeout);
  // Note: timer is NOT started here. Caller starts it after first human reconnects.
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd code && npx vitest run packages/server/tests/game/turn-timer-serialize.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add code/packages/server/src/game/turn-timer.ts code/packages/server/tests/game/turn-timer-serialize.test.ts
git commit -m "feat(restart): add TurnTimer serialize/restore"
```

---

## Task 7: XState Actor Snapshot Restoration

**Files:**
- Modify: `code/packages/server/src/game/game-state-machine.ts`
- Test: `code/packages/server/tests/game/game-state-machine-snapshot.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// code/packages/server/tests/game/game-state-machine-snapshot.test.ts
import { describe, it, expect } from 'vitest';
import {
  createGameActor,
  createGameActorFromSnapshot,
} from '../../src/game/game-state-machine.js';
import { SEATS_IN_ORDER } from '@tichu/shared';

describe('createGameActorFromSnapshot', () => {
  it('restores actor to the same state', () => {
    const actor = createGameActor('test-game');
    actor.start();

    // Advance to grandTichuDecision by seating 4 players and starting
    for (const seat of SEATS_IN_ORDER) {
      actor.send({ type: 'PLAYER_JOINED', seat });
    }
    actor.send({ type: 'HOST_START_GAME' });

    // Capture snapshot
    const snapshot = actor.getPersistedSnapshot();
    const contextBefore = actor.getSnapshot().context;
    const stateBefore = actor.getSnapshot().value;

    // Restore
    const restored = createGameActorFromSnapshot(snapshot);
    restored.start();

    expect(restored.getSnapshot().value).toEqual(stateBefore);
    expect(restored.getSnapshot().context.gameId).toBe('test-game');
    expect(restored.getSnapshot().context.scores).toEqual(contextBefore.scores);

    actor.stop();
    restored.stop();
  });

  it('restored actor can continue receiving events', () => {
    const actor = createGameActor('test-game');
    actor.start();

    for (const seat of SEATS_IN_ORDER) {
      actor.send({ type: 'PLAYER_JOINED', seat });
    }
    actor.send({ type: 'HOST_START_GAME' });

    const snapshot = actor.getPersistedSnapshot();
    actor.stop();

    const restored = createGameActorFromSnapshot(snapshot);
    restored.start();

    // Should be in grandTichuDecision — send decisions
    for (const seat of SEATS_IN_ORDER) {
      restored.send({ type: 'GRAND_TICHU_PASS', seat });
    }

    // Should have advanced to cardPassing
    expect(restored.getSnapshot().value).toBe('cardPassing');
    restored.stop();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd code && npx vitest run packages/server/tests/game/game-state-machine-snapshot.test.ts`
Expected: FAIL — `createGameActorFromSnapshot` not found

- [ ] **Step 3: Add createGameActorFromSnapshot to game-state-machine.ts**

At the bottom of `code/packages/server/src/game/game-state-machine.ts`, after `createGameActor`:

```typescript
export function createGameActorFromSnapshot(snapshot: unknown) {
  return createActor(gameMachine, {
    snapshot: snapshot as any,
  });
}
```

Also update the exports if needed — add `createGameActorFromSnapshot` to any barrel exports.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd code && npx vitest run packages/server/tests/game/game-state-machine-snapshot.test.ts`
Expected: PASS

Note: If XState 5's `createActor` with `snapshot` option has issues with the `Set<Seat>` fields in context, you may need to use a custom JSON reviver during snapshot restoration. If `getPersistedSnapshot()` already serializes Sets to arrays, the deserializer in `createGameActorFromSnapshot` must convert them back. Test output will reveal this — adjust accordingly.

- [ ] **Step 5: Commit**

```bash
git add code/packages/server/src/game/game-state-machine.ts code/packages/server/tests/game/game-state-machine-snapshot.test.ts
git commit -m "feat(restart): add createGameActorFromSnapshot for XState 5 restoration"
```

---

## Task 8: DB Schema & Persistence Layer

**Files:**
- Modify: `code/packages/server/src/db/schema.ts`
- Modify: `code/packages/server/src/db/connection.ts`
- Create: `code/packages/server/src/db/active-game-persistence.ts`
- Create: `code/packages/server/tests/db/active-game-persistence.test.ts`

- [ ] **Step 1: Add table definitions to schema.ts**

In `code/packages/server/src/db/schema.ts`, add:

```typescript
// ─── Active Game State (transient, for graceful restart) ────────────────

export const activeGames = sqliteTable('active_games', {
  gameId: text('game_id').primaryKey(),
  roomCode: text('room_code').notNull(),
  stateBlob: text('state_blob').notNull(),
  savedAt: text('saved_at').notNull().default(sql`(datetime('now'))`),
});

export const activeRooms = sqliteTable('active_rooms', {
  roomCode: text('room_code').primaryKey(),
  roomBlob: text('room_blob').notNull(),
  savedAt: text('saved_at').notNull().default(sql`(datetime('now'))`),
});
```

- [ ] **Step 2: Add CREATE TABLE to syncSchema() in connection.ts**

In `code/packages/server/src/db/connection.ts`, inside the `syncSchema()` function, add:

```sql
CREATE TABLE IF NOT EXISTS active_games (
  game_id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL,
  state_blob TEXT NOT NULL,
  saved_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS active_rooms (
  room_code TEXT PRIMARY KEY,
  room_blob TEXT NOT NULL,
  saved_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 3: Write failing tests for persistence layer**

```typescript
// code/packages/server/tests/db/active-game-persistence.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, type Database } from '../../src/db/connection.js';
import {
  saveActiveGames,
  loadActiveGames,
  clearActiveGames,
  saveActiveRooms,
  loadActiveRooms,
  clearActiveRooms,
} from '../../src/db/active-game-persistence.js';
import type { GameSnapshot, RoomSnapshot } from '../../src/game/game-serializer.js';
import { unlinkSync } from 'fs';

const TEST_DB_PATH = './data/test-active-games.sqlite';

describe('active-game-persistence', () => {
  let database: Database;

  beforeEach(() => {
    database = createDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    database.close();
    try { unlinkSync(TEST_DB_PATH); } catch {}
    try { unlinkSync(TEST_DB_PATH + '-wal'); } catch {}
    try { unlinkSync(TEST_DB_PATH + '-shm'); } catch {}
  });

  it('saves and loads game snapshots', () => {
    const snapshot: GameSnapshot = {
      gameId: 'game-1',
      roomCode: 'ROOM1',
      machineSnapshot: { value: 'playing', context: {} },
      vacatedSeats: [],
      choosingSeats: [],
      joinedAfterSpectating: [],
      roundEventHistory: {},
      currentRoundEvents: {
        summaries: {},
        currentRoundNumber: 1,
        processedBombCount: {},
        dogStuckDetected: [],
      },
      endOfTrickBombWindowEndTime: null,
      timerState: null,
      botSeats: ['north'],
      botStates: {},
      config: { targetScore: 1000, turnTimerSeconds: null, spectatorsAllowed: true, isPrivate: false, maxSpectators: 10 } as any,
    };

    saveActiveGames(database, [snapshot]);
    const loaded = loadActiveGames(database);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].gameId).toBe('game-1');
    expect(loaded[0].roomCode).toBe('ROOM1');
  });

  it('clears all active games', () => {
    const snapshot = { gameId: 'game-1', roomCode: 'R1' } as any;
    saveActiveGames(database, [snapshot as GameSnapshot]);
    clearActiveGames(database);
    expect(loadActiveGames(database)).toHaveLength(0);
  });

  it('saves and loads room snapshots', () => {
    const room: RoomSnapshot = {
      roomCode: 'ROOM1',
      roomName: "Test Room",
      hostSeat: 'south',
      players: [{ seat: 'south', name: 'Alice', isBot: false }],
      config: {} as any,
      gameInProgress: true,
      seatToUserId: { south: 'user-1' },
    };

    saveActiveRooms(database, [room]);
    const loaded = loadActiveRooms(database);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].roomCode).toBe('ROOM1');
    expect(loaded[0].seatToUserId.south).toBe('user-1');
  });

  it('writes games and rooms in a single transaction', () => {
    const game = { gameId: 'g1', roomCode: 'R1' } as any;
    const room = { roomCode: 'R1', roomName: 'Test' } as any;
    saveActiveGames(database, [game]);
    saveActiveRooms(database, [room]);
    expect(loadActiveGames(database)).toHaveLength(1);
    expect(loadActiveRooms(database)).toHaveLength(1);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd code && npx vitest run packages/server/tests/db/active-game-persistence.test.ts`
Expected: FAIL — module not found

- [ ] **Step 5: Implement active-game-persistence.ts**

```typescript
// code/packages/server/src/db/active-game-persistence.ts
import { eq } from 'drizzle-orm';
import type { Database } from './connection.js';
import { activeGames, activeRooms } from './schema.js';
import type { GameSnapshot, RoomSnapshot } from '../game/game-serializer.js';

export function saveActiveGames(database: Database, snapshots: GameSnapshot[]): void {
  database.db.transaction((tx) => {
    // Clear existing rows first (in case of partial previous save)
    tx.delete(activeGames).run();
    for (const snapshot of snapshots) {
      tx.insert(activeGames).values({
        gameId: snapshot.gameId,
        roomCode: snapshot.roomCode,
        stateBlob: JSON.stringify(snapshot),
        savedAt: new Date().toISOString(),
      }).run();
    }
  });
}

export function loadActiveGames(database: Database): GameSnapshot[] {
  const rows = database.db.select().from(activeGames).all();
  return rows.map((row) => JSON.parse(row.stateBlob) as GameSnapshot);
}

export function clearActiveGames(database: Database): void {
  database.db.delete(activeGames).run();
}

export function saveActiveRooms(database: Database, snapshots: RoomSnapshot[]): void {
  database.db.transaction((tx) => {
    tx.delete(activeRooms).run();
    for (const snapshot of snapshots) {
      tx.insert(activeRooms).values({
        roomCode: snapshot.roomCode,
        roomBlob: JSON.stringify(snapshot),
        savedAt: new Date().toISOString(),
      }).run();
    }
  });
}

export function loadActiveRooms(database: Database): RoomSnapshot[] {
  const rows = database.db.select().from(activeRooms).all();
  return rows.map((row) => JSON.parse(row.roomBlob) as RoomSnapshot);
}

export function clearActiveRooms(database: Database): void {
  database.db.delete(activeRooms).run();
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd code && npx vitest run packages/server/tests/db/active-game-persistence.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add code/packages/server/src/db/schema.ts code/packages/server/src/db/connection.ts code/packages/server/src/db/active-game-persistence.ts code/packages/server/tests/db/active-game-persistence.test.ts
git commit -m "feat(restart): add active_games/active_rooms DB tables and persistence layer"
```

---

## Task 9: RoomManager Serialization & Restoration

**Files:**
- Modify: `code/packages/server/src/room/room-manager.ts`
- Test: `code/packages/server/tests/room/room-manager-serialize.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// code/packages/server/tests/room/room-manager-serialize.test.ts
import { describe, it, expect } from 'vitest';
import { RoomManager } from '../../src/room/room-manager.js';
import type { RoomSnapshot } from '../../src/game/game-serializer.js';

describe('RoomManager serialization', () => {
  it('serializes rooms with active games', () => {
    const manager = new RoomManager();
    const room = manager.createRoom('user-1', 'Alice');
    const roomCode = room.roomCode;

    // Fill room and start game
    manager.joinRoom('user-2', roomCode, 'Bob');
    manager.addBot(roomCode, 'north');
    manager.addBot(roomCode, 'east');
    manager.startGame(roomCode);

    const snapshots = manager.serializeActiveRooms();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].roomCode).toBe(roomCode);
    expect(snapshots[0].gameInProgress).toBe(true);
    expect(snapshots[0].players).toHaveLength(4);
    expect(snapshots[0].seatToUserId).toHaveProperty('south'); // host seat
    manager.dispose();
  });

  it('does not serialize rooms without active games', () => {
    const manager = new RoomManager();
    manager.createRoom('user-1', 'Alice');
    const snapshots = manager.serializeActiveRooms();
    expect(snapshots).toHaveLength(0);
    manager.dispose();
  });

  it('restores rooms from snapshots', () => {
    const snapshot: RoomSnapshot = {
      roomCode: 'TEST01',
      roomName: "Test Room",
      hostSeat: 'south',
      players: [
        { seat: 'south', name: 'Alice', isBot: false },
        { seat: 'north', name: 'Bot', isBot: true },
        { seat: 'east', name: 'Bot', isBot: true },
        { seat: 'west', name: 'Bob', isBot: false },
      ],
      config: { targetScore: 1000, turnTimerSeconds: null, spectatorsAllowed: true, isPrivate: false, maxSpectators: 10 } as any,
      gameInProgress: true,
      seatToUserId: { south: 'user-1', west: 'user-2' },
    };

    const manager = new RoomManager();
    manager.restoreRooms([snapshot]);

    expect(manager.getRoom('TEST01')).toBeDefined();
    expect(manager.getRoom('TEST01')!.gameInProgress).toBe(true);
    expect(manager.getUserRoom('user-1')).toBe('TEST01');
    expect(manager.getUserSeat('user-1')).toBe('south');
    expect(manager.getUserRoom('user-2')).toBe('TEST01');
    expect(manager.getUserSeat('user-2')).toBe('west');

    // All humans should be disconnected
    const room = manager.getRoom('TEST01')!;
    const alice = room.players.find(p => p.seat === 'south');
    expect(alice!.isConnected).toBe(false);
    manager.dispose();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd code && npx vitest run packages/server/tests/room/room-manager-serialize.test.ts`
Expected: FAIL

- [ ] **Step 3: Add serializeActiveRooms() and restoreRooms() to RoomManager**

In `code/packages/server/src/room/room-manager.ts`, add:

```typescript
import type { RoomSnapshot } from '../game/game-serializer.js';

// Inside RoomManager class:

/** Serialize all rooms with active games for graceful restart. */
serializeActiveRooms(): RoomSnapshot[] {
  const snapshots: RoomSnapshot[] = [];
  for (const [roomCode, room] of this.rooms) {
    if (!room.gameInProgress) continue;

    const seatToUserId: Record<string, string> = {};
    for (const player of room.players) {
      if (!player.isBot) {
        const userId = this.seatToUser.get(`${roomCode}:${player.seat}`);
        if (userId) seatToUserId[player.seat] = userId;
      }
    }

    snapshots.push({
      roomCode: room.roomCode,
      roomName: room.roomName,
      hostSeat: room.hostSeat,
      players: room.players.map(p => ({
        seat: p.seat,
        name: p.name,
        isBot: p.isBot,
      })),
      config: room.config,
      gameInProgress: true,
      seatToUserId,
    });
  }
  return snapshots;
}

/** Restore rooms from snapshots after server restart. */
restoreRooms(snapshots: RoomSnapshot[]): void {
  for (const snap of snapshots) {
    const room: Room = {
      roomCode: snap.roomCode,
      roomName: snap.roomName,
      hostSeat: snap.hostSeat,
      players: snap.players.map(p => ({
        seat: p.seat,
        name: p.name,
        isBot: p.isBot,
        isConnected: p.isBot, // bots are "connected"; humans are not
      })),
      spectators: [],
      config: snap.config,
      gameInProgress: snap.gameInProgress,
      createdAt: Date.now(),
    };

    this.rooms.set(snap.roomCode, room);

    // Rebuild userId maps for human players
    for (const [seat, userId] of Object.entries(snap.seatToUserId)) {
      this.assignUser(userId, snap.roomCode, seat as Seat);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd code && npx vitest run packages/server/tests/room/room-manager-serialize.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add code/packages/server/src/room/room-manager.ts code/packages/server/tests/room/room-manager-serialize.test.ts
git commit -m "feat(restart): add RoomManager serializeActiveRooms/restoreRooms"
```

---

## Task 10: GameManager serialize() and static restore()

**Files:**
- Modify: `code/packages/server/src/game/game-manager.ts`
- Create: `code/packages/server/tests/game/serialize-restore.test.ts`

This is the core task — GameManager is the central coordinator.

- [ ] **Step 1: Write failing test for serialize()**

```typescript
// code/packages/server/tests/game/serialize-restore.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameManager } from '../../src/game/game-manager.js';
import { DisconnectHandler } from '../../src/game/disconnect-handler.js';
import { VoteHandler } from '../../src/game/vote-handler.js';
import type { Broadcaster } from '../../src/ws/broadcaster.js';
import { SEATS_IN_ORDER } from '@tichu/shared';

function createMockBroadcaster(): Broadcaster {
  return {
    send: vi.fn().mockReturnValue(true),
    sendToPlayer: vi.fn().mockReturnValue(true),
    broadcastToRoom: vi.fn().mockReturnValue(3),
    broadcastGameState: vi.fn().mockReturnValue(4),
    broadcastToSpectators: vi.fn().mockReturnValue(0),
    sendError: vi.fn().mockReturnValue(true),
  } as unknown as Broadcaster;
}

describe('GameManager serialize/restore', () => {
  let broadcaster: Broadcaster;
  let disconnectHandler: DisconnectHandler;
  let voteHandler: VoteHandler;

  beforeEach(() => {
    broadcaster = createMockBroadcaster();
    disconnectHandler = new DisconnectHandler(broadcaster);
    voteHandler = new VoteHandler(broadcaster);
  });

  afterEach(() => {
    disconnectHandler.dispose();
    voteHandler.dispose();
  });

  it('serializes a game in lobby state', () => {
    const manager = new GameManager('game-1', 'ROOM1', broadcaster, disconnectHandler, voteHandler);
    const snapshot = manager.serialize();
    expect(snapshot.gameId).toBe('game-1');
    expect(snapshot.roomCode).toBe('ROOM1');
    expect(snapshot.machineSnapshot).toBeDefined();
    manager.destroy();
  });

  it('round-trips a game in grandTichuDecision state', () => {
    const manager = new GameManager('game-1', 'ROOM1', broadcaster, disconnectHandler, voteHandler);

    // Seat players and start
    for (const seat of SEATS_IN_ORDER) {
      manager.seatPlayer(seat);
    }
    manager.startGame();

    const snapshot = manager.serialize();
    expect(snapshot.config).toBeDefined();

    const restored = GameManager.restore(snapshot, broadcaster, disconnectHandler, voteHandler);
    expect(restored.gameId).toBe('game-1');
    expect(restored.roomCode).toBe('ROOM1');
    expect(restored.stateValue).toBe(manager.stateValue);

    manager.destroy();
    restored.destroy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd code && npx vitest run packages/server/tests/game/serialize-restore.test.ts`
Expected: FAIL — serialize/restore not defined

- [ ] **Step 3: Add serialize() to GameManager**

In `code/packages/server/src/game/game-manager.ts`, add imports and method:

```typescript
import type { GameSnapshot } from './game-serializer.js';
import { serializeSet, deserializeSet, serializeMap, deserializeMap } from './game-serializer.js';
import { createGameActorFromSnapshot } from './game-state-machine.js';

// Inside GameManager class:

serialize(): GameSnapshot {
  return {
    gameId: this.gameId,
    roomCode: this.roomCode,
    machineSnapshot: this.actor.getPersistedSnapshot(),
    vacatedSeats: serializeSet(this.vacatedSeats),
    choosingSeats: serializeSet(this.choosingSeats),
    joinedAfterSpectating: serializeSet(this.joinedAfterSpectating),
    roundEventHistory: serializeMap(
      new Map(
        [...this.roundEventHistory].map(([k, v]) => [String(k), v])
      )
    ),
    currentRoundEvents: this.eventTracker.serialize(),
    endOfTrickBombWindowEndTime: this.endOfTrickBombWindowEndTime,
    timerState: this.timer.serialize(),
    botSeats: this.botRunner.getBotSeats(),
    botStates: this.botRunner.serialize(),
    config: this.context.config,
  };
}
```

- [ ] **Step 4: Add static restore() to GameManager**

```typescript
// Inside GameManager class (static method):

static restore(
  snapshot: GameSnapshot,
  broadcaster: Broadcaster,
  disconnectHandler: DisconnectHandler,
  voteHandler: VoteHandler,
): GameManager {
  // Use a private constructor pattern or bypass normal constructor.
  // Since the constructor starts the actor, we need a different path.
  // Create instance with Object.create to skip constructor, then manually init.
  const manager = Object.create(GameManager.prototype) as GameManager;

  // Readonly fields
  (manager as any).gameId = snapshot.gameId;
  (manager as any).roomCode = snapshot.roomCode;
  (manager as any).broadcaster = broadcaster;
  (manager as any).disconnectHandler = disconnectHandler;
  (manager as any).voteHandler = voteHandler;
  (manager as any).destroyed = false;

  // Restore XState actor from snapshot
  const actor = createGameActorFromSnapshot(snapshot.machineSnapshot);
  (manager as any).actor = actor;
  (manager as any).moveHandler = new MoveHandler(actor);

  // Restore timer (not started — caller starts after first human reconnects)
  (manager as any).timer = TurnTimer.restore(snapshot.timerState, (seat) => {
    manager.handleTurnTimeout(seat);
  });

  // Restore bot runner with full bot memory
  (manager as any).botRunner = BotRunner.restore(
    snapshot.botStates,
    actor,
    (manager as any).moveHandler,
  );

  // Restore Sets
  (manager as any).vacatedSeats = deserializeSet(snapshot.vacatedSeats);
  (manager as any).choosingSeats = deserializeSet(snapshot.choosingSeats);
  (manager as any).joinedAfterSpectating = deserializeSet(snapshot.joinedAfterSpectating);

  // Restore round event tracking
  const historyMap = new Map<number, RoundEventSummary[]>();
  for (const [k, v] of Object.entries(snapshot.roundEventHistory)) {
    historyMap.set(Number(k), v);
  }
  (manager as any).roundEventHistory = historyMap;
  (manager as any).eventTracker = RoundEventTracker.restore(snapshot.currentRoundEvents);

  // Restore misc state
  (manager as any).endOfTrickBombWindowEndTime = snapshot.endOfTrickBombWindowEndTime;
  (manager as any).autoPassTimer = null;
  (manager as any).scoringTimer = null;
  (manager as any).endOfTrickBombTimer = null;

  // Subscribe to state changes (same as constructor)
  actor.subscribe((state) => {
    if ((manager as any).destroyed) return;
    manager.onStateChange(state);
  });

  // Start the actor (resumes from snapshot state)
  actor.start();

  return manager;
}
```

Note: The `Object.create` pattern avoids calling the constructor (which would create a fresh actor). An alternative is adding a private `restored` flag and an `if` branch in the constructor. Choose whichever is cleaner after seeing the actual field declarations. If the constructor logic is simple, a second code path in the constructor (`if (snapshot) { ... } else { ... }`) may be cleaner.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd code && npx vitest run packages/server/tests/game/serialize-restore.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add code/packages/server/src/game/game-manager.ts code/packages/server/tests/game/serialize-restore.test.ts
git commit -m "feat(restart): add GameManager serialize/restore"
```

---

## Task 11: GameStore restoreGame() and Reconnection TTL

**Files:**
- Modify: `code/packages/server/src/game/game-store.ts`
- Create: `code/packages/server/tests/game/reconnection-ttl.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// code/packages/server/tests/game/reconnection-ttl.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameStore } from '../../src/game/game-store.js';
import type { GameManager } from '../../src/game/game-manager.js';
import type { Broadcaster } from '../../src/ws/broadcaster.js';

function createMockBroadcaster(): Broadcaster {
  return {
    send: vi.fn().mockReturnValue(true),
    sendToPlayer: vi.fn().mockReturnValue(true),
    broadcastToRoom: vi.fn().mockReturnValue(3),
    broadcastGameState: vi.fn().mockReturnValue(4),
    broadcastToSpectators: vi.fn().mockReturnValue(0),
    sendError: vi.fn().mockReturnValue(true),
  } as unknown as Broadcaster;
}

describe('GameStore restoreGame', () => {
  let store: GameStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new GameStore(createMockBroadcaster());
  });

  afterEach(() => {
    store.dispose();
    vi.useRealTimers();
  });

  it('registers a restored game', () => {
    const mockManager = {
      gameId: 'game-1',
      roomCode: 'ROOM1',
      destroy: vi.fn(),
    } as unknown as GameManager;

    store.restoreGame(mockManager);
    expect(store.getGame('game-1')).toBe(mockManager);
    expect(store.getGameByRoom('ROOM1')).toBe(mockManager);
  });

  it('destroys game after TTL expires with no reconnection', () => {
    const mockManager = {
      gameId: 'game-1',
      roomCode: 'ROOM1',
      destroy: vi.fn(),
    } as unknown as GameManager;

    store.restoreGame(mockManager, { ttlMs: 5 * 60 * 1000 });
    expect(store.getGame('game-1')).toBeDefined();

    vi.advanceTimersByTime(5 * 60 * 1000 + 100);
    expect(store.getGame('game-1')).toBeUndefined();
    expect(mockManager.destroy).toHaveBeenCalled();
  });

  it('cancels TTL when cancelReconnectionTTL is called', () => {
    const mockManager = {
      gameId: 'game-1',
      roomCode: 'ROOM1',
      destroy: vi.fn(),
    } as unknown as GameManager;

    store.restoreGame(mockManager, { ttlMs: 5 * 60 * 1000 });
    store.cancelReconnectionTTL('game-1');

    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(store.getGame('game-1')).toBeDefined();
    expect(mockManager.destroy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd code && npx vitest run packages/server/tests/game/reconnection-ttl.test.ts`
Expected: FAIL

- [ ] **Step 3: Add restoreGame() and TTL logic to GameStore**

In `code/packages/server/src/game/game-store.ts`, add:

```typescript
// New field at top of class:
private readonly reconnectionTTLs = new Map<string, ReturnType<typeof setTimeout>>();

/** Register a pre-built GameManager (from snapshot restore). */
restoreGame(manager: GameManager, options?: { ttlMs?: number }): void {
  this.games.set(manager.gameId, manager);
  this.roomToGame.set(manager.roomCode, manager.gameId);

  if (options?.ttlMs) {
    const timer = setTimeout(() => {
      this.reconnectionTTLs.delete(manager.gameId);
      this.destroyGame(manager.gameId);
    }, options.ttlMs);
    this.reconnectionTTLs.set(manager.gameId, timer);
  }
}

/** Cancel reconnection TTL for a game (called when first human reconnects). */
cancelReconnectionTTL(gameId: string): void {
  const timer = this.reconnectionTTLs.get(gameId);
  if (timer) {
    clearTimeout(timer);
    this.reconnectionTTLs.delete(gameId);
  }
}
```

Also update `dispose()` to clean up TTL timers:

```typescript
dispose(): void {
  for (const timer of this.reconnectionTTLs.values()) {
    clearTimeout(timer);
  }
  this.reconnectionTTLs.clear();
  // ... existing dispose logic
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd code && npx vitest run packages/server/tests/game/reconnection-ttl.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add code/packages/server/src/game/game-store.ts code/packages/server/tests/game/reconnection-ttl.test.ts
git commit -m "feat(restart): add GameStore restoreGame with reconnection TTL"
```

---

## Task 12: Room-to-Game Cleanup Link

**Files:**
- Modify: `code/packages/server/src/room/room-manager.ts`
- Modify: `code/packages/server/src/app.ts` (wiring)

- [ ] **Step 1: Add onRoomDestroyed callback to RoomManager**

In `code/packages/server/src/room/room-manager.ts`, add:

```typescript
// New field at top of class:
onRoomDestroyed: ((roomCode: string) => void) | null = null;
```

Then update `cleanupStaleRooms()` and `destroyRoom()`:

```typescript
private destroyRoom(roomCode: string): void {
  // ... existing cleanup code ...
  this.rooms.delete(roomCode);
  // ... existing user cleanup ...
  
  // Notify subscribers (e.g., GameStore) so they can clean up too
  this.onRoomDestroyed?.(roomCode);
}
```

- [ ] **Step 2: Wire the callback in app.ts**

In `code/packages/server/src/app.ts`, after creating `gameStore` and `roomHandler`:

```typescript
// Link room cleanup to game cleanup
roomHandler.roomManager.onRoomDestroyed = (roomCode) => {
  gameStore.destroyGameByRoom(roomCode);
};
```

- [ ] **Step 3: Commit**

```bash
git add code/packages/server/src/room/room-manager.ts code/packages/server/src/app.ts
git commit -m "fix: link room cleanup to game cleanup (prevents orphaned GameStore entries)"
```

---

## Task 13: Protocol Message & Client Handling

**Files:**
- Modify: `code/packages/shared/src/types/protocol.ts`
- Modify: `code/packages/client/src/hooks/useWebSocket.ts`
- Modify: `code/packages/client/src/app/game/[gameId]/page.tsx`

- [ ] **Step 1: Add SERVER_SHUTTING_DOWN to protocol**

In `code/packages/shared/src/types/protocol.ts`, add to the `serverMessageSchema` discriminated union (before the ERROR entry):

```typescript
z.object({ type: z.literal('SERVER_SHUTTING_DOWN') }),
```

- [ ] **Step 2: Handle SERVER_SHUTTING_DOWN in useWebSocket hook**

In `code/packages/client/src/hooks/useWebSocket.ts`, inside the `onmessage` handler, before calling `onMessage(parsed.data)`, add:

```typescript
if (parsed.data.type === 'SERVER_SHUTTING_DOWN') {
  // Server is restarting — mark as expected disconnect, then let auto-reconnect handle it
  intentionalCloseRef.current = false; // Ensure reconnect is allowed
  retryCountRef.current = 0;          // Reset retry count for fresh reconnection
  onMessage(parsed.data);             // Let app show banner
  return;
}
```

- [ ] **Step 3: Show reconnecting banner in game page**

In `code/packages/client/src/app/game/[gameId]/page.tsx`, in the `handleMessage` callback, add a case:

```typescript
case 'SERVER_SHUTTING_DOWN':
  uiStore.setServerRestarting(true);
  break;
```

Add to the UI store (`code/packages/client/src/stores/uiStore.ts`):

```typescript
serverRestarting: false,
setServerRestarting: (value: boolean) => set({ serverRestarting: value }),
```

In the game page JSX, render a banner when `serverRestarting` is true:

```tsx
{serverRestarting && (
  <div className={styles.restartBanner}>
    Server restarting — you'll be reconnected automatically
  </div>
)}
```

Clear `serverRestarting` when the connection status returns to `'connected'` (in the `onStatusChange` callback or a `useEffect` watching `connectionStatus`).

- [ ] **Step 4: Commit**

```bash
git add code/packages/shared/src/types/protocol.ts code/packages/client/src/hooks/useWebSocket.ts code/packages/client/src/app/game/\\[gameId\\]/page.tsx code/packages/client/src/stores/uiStore.ts
git commit -m "feat(restart): add SERVER_SHUTTING_DOWN protocol message and client banner"
```

---

## Task 14: App-Level Integration (Signal Handler, Serialize, Restore)

**Files:**
- Modify: `code/packages/server/src/app.ts`
- Modify: `code/packages/server/src/index.ts`

- [ ] **Step 1: Add serializeAndShutdown() to app.ts**

In the `createApp()` return object in `code/packages/server/src/app.ts`, add a new method and modify startup:

```typescript
import {
  saveActiveGames,
  saveActiveRooms,
  loadActiveGames,
  loadActiveRooms,
  clearActiveGames,
  clearActiveRooms,
} from './db/active-game-persistence.js';
import { GameManager } from './game/game-manager.js';

// Inside the return object:

/** Restore any games that were serialized before last shutdown. */
restoreActiveGames(): number {
  if (!database) return 0;
  const roomSnapshots = loadActiveRooms(database);
  const gameSnapshots = loadActiveGames(database);
  if (gameSnapshots.length === 0) return 0;

  // Restore rooms first (games depend on room state)
  roomHandler.roomManager.restoreRooms(roomSnapshots);

  // Restore games
  const TTL_MS = 5 * 60 * 1000; // 5 minutes
  for (const snapshot of gameSnapshots) {
    try {
      const manager = GameManager.restore(
        snapshot,
        broadcaster,
        gameStore.disconnectHandler,
        gameStore.voteHandler,
      );
      gameStore.restoreGame(manager, { ttlMs: TTL_MS });
      fastify.log.info(`Restored game ${snapshot.gameId} for room ${snapshot.roomCode}`);
    } catch (err) {
      fastify.log.error(`Failed to restore game ${snapshot.gameId}: ${err}`);
    }
  }

  // Clear DB rows — they've been loaded into memory
  clearActiveGames(database);
  clearActiveRooms(database);

  return gameSnapshots.length;
},

/** Serialize all active games and shut down gracefully. */
async serializeAndShutdown(): Promise<void> {
  // 1. Broadcast shutdown notice to all clients
  broadcaster.broadcastToAll({ type: 'SERVER_SHUTTING_DOWN' });

  // 2. Serialize active games to DB
  if (database && gameStore.size > 0) {
    const gameSnapshots = gameStore.activeGameIds
      .map((id) => gameStore.getGame(id))
      .filter((g): g is GameManager => g !== undefined)
      .map((g) => g.serialize());

    const roomSnapshots = roomHandler.roomManager.serializeActiveRooms();

    try {
      saveActiveGames(database, gameSnapshots);
      saveActiveRooms(database, roomSnapshots);
      fastify.log.info(`Serialized ${gameSnapshots.length} games and ${roomSnapshots.length} rooms`);
    } catch (err) {
      fastify.log.error(`Failed to serialize game state: ${err}`);
    }
  }

  // 3. Normal shutdown
  await this.stop();
},
```

Add a `resumeAfterRestore()` method to `GameManager` (in Task 10's file). This is called once after the first human reconnects:

```typescript
// Inside GameManager class:
private restoredFromSnapshot = false;

/** Called once after first human reconnects to a restored game. */
resumeAfterRestore(): void {
  if (!this.restoredFromSnapshot) return;
  this.restoredFromSnapshot = false;

  const ctx = this.context;
  const round = ctx.currentRound;
  if (!round || !round.currentTurn) return;

  // If it's a human's turn and timers are configured, start a fresh timer
  if (this.timer.isEnabled()) {
    this.timer.start(round.currentTurn);
  }

  // If it's a bot's turn, trigger bot decision
  this.botRunner.onStateChange(this.actor.getSnapshot());
}
```

Set `this.restoredFromSnapshot = true` in the `static restore()` factory method.

Note: `broadcaster.broadcastToAll` may not exist yet. If not, add it to `Broadcaster`:

```typescript
broadcastToAll(message: ServerMessage): void {
  // Iterate all connected clients and send
  for (const ws of this.connections.getAllSockets()) {
    this.send(ws, message);
  }
}
```

And add `getAllSockets()` to `ConnectionManager` if needed:

```typescript
getAllSockets(): WebSocket[] {
  return [...this.clients.keys()];
}
```

- [ ] **Step 2: Update start() to call restoreActiveGames()**

Modify the `start()` method in the return object:

```typescript
async start(): Promise<void> {
  await fastify.listen({ port: cfg.port, host: cfg.host });
  connections.startHeartbeat();
  roomHandler.roomManager.startCleanup();

  // Restore games from previous graceful shutdown
  const restored = this.restoreActiveGames();
  if (restored > 0) {
    fastify.log.info(`Restored ${restored} active games from previous session`);
  }

  fastify.log.info(`Tichu server listening on port ${cfg.port}`);
},
```

- [ ] **Step 3: Wire signal handlers in index.ts**

Replace `code/packages/server/src/index.ts` with:

```typescript
import { createApp } from './app.js';

const app = createApp();
app.start();

// Graceful shutdown on SIGTERM/SIGINT
let shuttingDown = false;

async function handleShutdown(signal: string) {
  if (shuttingDown) return; // Prevent double-shutdown
  shuttingDown = true;
  console.log(`${signal} received — serializing game state and shutting down`);
  await app.serializeAndShutdown();
  process.exit(0);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
```

- [ ] **Step 4: Wire TTL cancellation on reconnect**

In `code/packages/server/src/app.ts`, in the WebSocket `connection` handler where reconnection is detected (around line 119-129), add TTL cancellation:

```typescript
if (existingRoom && existingSeat) {
  connections.assignToRoom(ws, existingRoom, existingSeat);
  roomHandler.roomManager.markReconnected(userId);
  broadcaster.send(ws, { type: 'ROOM_JOINED', roomCode: existingRoom, seat: existingSeat });
  roomHandler.broadcastRoomUpdate(existingRoom);

  const game = gameStore.getGameByRoom(existingRoom);
  if (game) {
    // Cancel reconnection TTL on first human reconnect
    gameStore.cancelReconnectionTTL(game.gameId);
    game.handleReconnect(ws, existingSeat);

    // After restore, timers are paused. On first human reconnect,
    // restart turn timer or trigger bot if it's a bot's turn.
    // handleReconnect already broadcasts GAME_STATE to the player.
    // Check if game was restored (timer not running) and kick-start:
    game.resumeAfterRestore();
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add code/packages/server/src/app.ts code/packages/server/src/index.ts
git commit -m "feat(restart): wire signal handler, serialize on shutdown, restore on startup"
```

---

## Task 15: End-to-End Integration Test

**Files:**
- Create: `code/packages/server/tests/integration/graceful-restart.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
// code/packages/server/tests/integration/graceful-restart.test.ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createApp, type App } from '../../src/app.js';
import { SEATS_IN_ORDER } from '@tichu/shared';
import { unlinkSync } from 'fs';

const TEST_DB = './data/test-restart.sqlite';

describe('Graceful restart integration', () => {
  let app: App;

  afterEach(async () => {
    try { await app?.stop(); } catch {}
    try { unlinkSync(TEST_DB); } catch {}
    try { unlinkSync(TEST_DB + '-wal'); } catch {}
    try { unlinkSync(TEST_DB + '-shm'); } catch {}
  });

  it('serializes and restores a game in progress', async () => {
    // 1. Create app and start a game
    app = createApp({ port: 0, host: '127.0.0.1', databasePath: TEST_DB });
    await app.start();

    // Create a game via the GameStore
    const manager = app.gameStore.createGame('TESTROOM', { targetScore: 1000 });
    for (const seat of SEATS_IN_ORDER) {
      manager.seatPlayer(seat);
    }
    manager.startGame();

    const stateBeforeShutdown = manager.stateValue;
    const gameId = manager.gameId;
    expect(app.gameStore.size).toBe(1);

    // 2. Serialize (simulates SIGTERM path without actually shutting down fully)
    // Use the internal serialize path
    const gameSnapshots = [manager.serialize()];
    const roomSnapshots = app.roomHandler.roomManager.serializeActiveRooms();

    // Import persistence functions
    const { saveActiveGames, saveActiveRooms } = await import(
      '../../src/db/active-game-persistence.js'
    );
    saveActiveGames(app.database!, gameSnapshots);
    saveActiveRooms(app.database!, roomSnapshots);

    // 3. Tear down old app (simulates process restart)
    await app.stop();

    // 4. Start fresh app (simulates new process)
    app = createApp({ port: 0, host: '127.0.0.1', databasePath: TEST_DB });
    await app.start();

    // 5. Verify game was restored
    expect(app.gameStore.size).toBe(1);
    const restoredGame = app.gameStore.getGameByRoom('TESTROOM');
    expect(restoredGame).toBeDefined();
    expect(restoredGame!.stateValue).toBe(stateBeforeShutdown);
  });
});
```

- [ ] **Step 2: Run the integration test**

Run: `cd code && npx vitest run packages/server/tests/integration/graceful-restart.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add code/packages/server/tests/integration/graceful-restart.test.ts
git commit -m "test(restart): add end-to-end graceful restart integration test"
```

---

## Task 16: Manual Verification

- [ ] **Step 1: Start the server and create a game with bots**

Run: `cd code && pnpm dev`

Open browser, create a room, add 3 bots, start a game. Play a few hands so the game is in mid-round with score history.

- [ ] **Step 2: Send SIGINT (Ctrl+C) to the server**

Observe:
- Server logs "SIGINT received — serializing game state and shutting down"
- Server logs "Serialized 1 games and 1 rooms"
- Client shows "Server restarting — you'll be reconnected automatically" banner

- [ ] **Step 3: Restart the server**

Run: `cd code && pnpm dev`

Observe:
- Server logs "Restored 1 active games from previous session"
- Client auto-reconnects
- Client banner dismisses
- Game state matches what it was before shutdown (same scores, same cards, same round)

- [ ] **Step 4: Verify bot behavior resumes**

After reconnection, if it's a bot's turn, the bot should make a play within a few seconds. If it's your turn, play a card and verify the game continues normally.

- [ ] **Step 5: Test TTL cleanup**

Start a game with bots, Ctrl+C the server, wait 6 minutes, then restart. Verify:
- Server logs "Restored 1 active games" on startup
- After 5 minutes with no browser reconnection, the game is cleaned up
- Server logs indicate the game was destroyed

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Snapshot types & conversion helpers | `game-serializer.ts` |
| 2 | CardTracker serialize/restore | `card-tracker.ts` |
| 3 | Bot serialize/restore | `bot.ts` |
| 4 | BotRunner serialize/restore | `bot-runner.ts` |
| 5 | RoundEventTracker serialize/restore | `round-event-tracker.ts` |
| 6 | TurnTimer serialize/restore | `turn-timer.ts` |
| 7 | XState actor snapshot restoration | `game-state-machine.ts` |
| 8 | DB schema & persistence layer | `schema.ts`, `connection.ts`, `active-game-persistence.ts` |
| 9 | RoomManager serialize/restore | `room-manager.ts` |
| 10 | GameManager serialize/restore | `game-manager.ts` |
| 11 | GameStore restoreGame + TTL | `game-store.ts` |
| 12 | Room-to-game cleanup link | `room-manager.ts`, `app.ts` |
| 13 | Protocol message + client banner | `protocol.ts`, `useWebSocket.ts`, game page |
| 14 | App integration (signals, serialize, restore) | `app.ts`, `index.ts` |
| 15 | Integration test | `graceful-restart.test.ts` |
| 16 | Manual verification | Browser + terminal |
