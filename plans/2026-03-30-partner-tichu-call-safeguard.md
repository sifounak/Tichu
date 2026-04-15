# Partner Tichu Call Safeguard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent accidental double Tichu/Grand Tichu calls by partners — server-side gate with human confirmation override and bot rejection handling.

**Architecture:** Add a `partnerOverride` field to two protocol messages. MoveHandler checks partner's call before accepting. GameManager passes a structured error code (`PARTNER_ALREADY_CALLED`) back to the client or BotRunner. Client shows a confirmation dialog; bots silently obey the rejection.

**Tech Stack:** TypeScript, Zod (protocol schemas), XState (state machine — unchanged), React (confirmation dialog), Vitest (tests)

---

## File Structure

| File | Role |
|------|------|
| `code/packages/shared/src/types/protocol.ts` | Add `partnerOverride?` to two message schemas |
| `code/packages/server/src/game/move-handler.ts` | Add partner check guard to GT and Tichu handlers |
| `code/packages/server/src/game/game-manager.ts` | Pass `partnerOverride` through; use structured error code |
| `code/packages/server/src/bot/bot-runner.ts` | Handle `PARTNER_ALREADY_CALLED` rejection from MoveHandler |
| `code/packages/client/src/app/game/[gameId]/page.tsx` | Intercept `PARTNER_ALREADY_CALLED` error, show confirmation dialog, re-send with override |
| `code/packages/server/tests/game/move-handler.test.ts` | Tests for partner check guard |
| `code/packages/server/tests/bot/bot-runner.test.ts` | Tests for bot rejection handling |

---

### Task 1: Protocol — Add `partnerOverride` to message schemas

**Files:**
- Modify: `code/packages/shared/src/types/protocol.ts:63-64`

- [ ] **Step 1: Add `partnerOverride` to `GRAND_TICHU_DECISION` schema**

In `code/packages/shared/src/types/protocol.ts`, change line 63 from:

```typescript
z.object({ type: z.literal('GRAND_TICHU_DECISION'), call: z.boolean() }),
```

to:

```typescript
z.object({ type: z.literal('GRAND_TICHU_DECISION'), call: z.boolean(), partnerOverride: z.boolean().optional() }),
```

- [ ] **Step 2: Add `partnerOverride` to `TICHU_DECLARATION` schema**

In the same file, change line 64 from:

```typescript
z.object({ type: z.literal('TICHU_DECLARATION') }),
```

to:

```typescript
z.object({ type: z.literal('TICHU_DECLARATION'), partnerOverride: z.boolean().optional() }),
```

- [ ] **Step 3: Verify build passes**

Run: `cd code && pnpm build`
Expected: Clean build with no errors.

- [ ] **Step 4: Commit**

```bash
cd code && git add packages/shared/src/types/protocol.ts
git commit -m "feat: add partnerOverride field to GRAND_TICHU_DECISION and TICHU_DECLARATION schemas

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Server — MoveHandler partner check guard

**Files:**
- Modify: `code/packages/server/src/game/move-handler.ts:7-8,12-14,66-80,82-100`
- Test: `code/packages/server/tests/game/move-handler.test.ts`

- [ ] **Step 1: Write failing tests for partner check on Grand Tichu**

Add the following tests to `code/packages/server/tests/game/move-handler.test.ts` inside a new `describe('partner tichu call safeguard')` block:

```typescript
describe('partner tichu call safeguard', () => {
  it('should reject Grand Tichu call when partner already called Grand Tichu', () => {
    const actor = createTestActor();
    fillSeats(actor);
    actor.send({ type: 'HOST_START_GAME' });

    // North calls Grand Tichu
    actor.send({ type: 'GRAND_TICHU_CALL', seat: 'north' });
    expect(actor.getSnapshot().context.currentRound!.players.north.tipiCall).toBe('grandTichu');

    // South (North's partner) tries to call — should be rejected
    const handler = new MoveHandler(actor);
    const result = handler.handleGrandTichuDecision('south', true);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('PARTNER_ALREADY_CALLED');
      expect((result as any).partnerCall).toBe('grandTichu');
    }
  });

  it('should allow Grand Tichu call with partnerOverride when partner already called', () => {
    const actor = createTestActor();
    fillSeats(actor);
    actor.send({ type: 'HOST_START_GAME' });

    // North calls Grand Tichu
    actor.send({ type: 'GRAND_TICHU_CALL', seat: 'north' });

    // South overrides
    const handler = new MoveHandler(actor);
    const result = handler.handleGrandTichuDecision('south', true, true);
    expect(result.ok).toBe(true);
  });

  it('should NOT check partner when passing Grand Tichu', () => {
    const actor = createTestActor();
    fillSeats(actor);
    actor.send({ type: 'HOST_START_GAME' });

    // North calls Grand Tichu
    actor.send({ type: 'GRAND_TICHU_CALL', seat: 'north' });

    // South passes — should always succeed (no partner check on pass)
    const handler = new MoveHandler(actor);
    const result = handler.handleGrandTichuDecision('south', false);
    expect(result.ok).toBe(true);
  });

  it('should allow Grand Tichu call when partner has not called', () => {
    const actor = createTestActor();
    fillSeats(actor);
    actor.send({ type: 'HOST_START_GAME' });

    // No one has called yet — South should be allowed
    const handler = new MoveHandler(actor);
    const result = handler.handleGrandTichuDecision('south', true);
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd code && pnpm test -- --run packages/server/tests/game/move-handler.test.ts`
Expected: The first test (reject when partner called) fails because MoveHandler currently allows it. The override test also fails because the method doesn't accept the third parameter yet.

- [ ] **Step 3: Update MoveResult type and add partner check to handleGrandTichuDecision**

In `code/packages/server/src/game/move-handler.ts`:

First, update the `MoveResult` type (line 12-14) to include the structured error:

```typescript
export type MoveResult =
  | { ok: true }
  | { ok: false; error: string }
  | { ok: false; error: 'PARTNER_ALREADY_CALLED'; partnerCall: 'tichu' | 'grandTichu' };
```

Then add `getPartner` to the import from `@tichu/shared` (line 8):

```typescript
import { SEATS_IN_ORDER, getTeam, getPartner, isMahjong, detectCombination } from '@tichu/shared';
```

Then update `handleGrandTichuDecision` (line 67) to accept `partnerOverride` and add the guard:

```typescript
/** Handle GRAND_TICHU_DECISION */
handleGrandTichuDecision(seat: Seat, call: boolean, partnerOverride?: boolean): MoveResult {
  if (this.stateValue !== 'grandTichuDecision') {
    return { ok: false, error: 'Not in Grand Tichu decision phase' };
  }
  if (this.context.grandTichuDecisions.has(seat)) {
    return { ok: false, error: 'Already made Grand Tichu decision' };
  }

  // Partner call safeguard: only when actively calling (not passing)
  if (call && !partnerOverride) {
    const round = this.context.currentRound;
    if (round) {
      const partner = getPartner(seat);
      const partnerCall = round.players[partner].tipiCall;
      if (partnerCall !== 'none') {
        return { ok: false, error: 'PARTNER_ALREADY_CALLED', partnerCall };
      }
    }
  }

  const event: GameEvent = call
    ? { type: 'GRAND_TICHU_CALL', seat }
    : { type: 'GRAND_TICHU_PASS', seat };
  this.actor.send(event);
  return { ok: true };
}
```

- [ ] **Step 4: Run tests to verify Grand Tichu partner check tests pass**

Run: `cd code && pnpm test -- --run packages/server/tests/game/move-handler.test.ts`
Expected: All 4 new partner safeguard tests pass.

- [ ] **Step 5: Write failing tests for partner check on regular Tichu**

Add to the same `describe('partner tichu call safeguard')` block:

```typescript
it('should reject Tichu call when partner already called Grand Tichu', () => {
  const actor = createTestActor();
  fillSeats(actor);
  actor.send({ type: 'HOST_START_GAME' });

  // North calls Grand Tichu
  actor.send({ type: 'GRAND_TICHU_CALL', seat: 'north' });
  // Pass everyone else through GT phase
  actor.send({ type: 'GRAND_TICHU_PASS', seat: 'south' });
  actor.send({ type: 'GRAND_TICHU_PASS', seat: 'east' });
  actor.send({ type: 'GRAND_TICHU_PASS', seat: 'west' });

  // Now in cardPassing phase — South tries regular Tichu
  const handler = new MoveHandler(actor);
  const result = handler.handleTichuDeclaration('south');
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error).toBe('PARTNER_ALREADY_CALLED');
    expect((result as any).partnerCall).toBe('grandTichu');
  }
});

it('should allow Tichu call with partnerOverride when partner already called', () => {
  const actor = createTestActor();
  fillSeats(actor);
  actor.send({ type: 'HOST_START_GAME' });

  // North calls Grand Tichu
  actor.send({ type: 'GRAND_TICHU_CALL', seat: 'north' });
  actor.send({ type: 'GRAND_TICHU_PASS', seat: 'south' });
  actor.send({ type: 'GRAND_TICHU_PASS', seat: 'east' });
  actor.send({ type: 'GRAND_TICHU_PASS', seat: 'west' });

  // South overrides
  const handler = new MoveHandler(actor);
  const result = handler.handleTichuDeclaration('south', true);
  expect(result.ok).toBe(true);
});

it('should allow Tichu call when partner has not called', () => {
  const actor = createTestActor();
  fillSeats(actor);
  actor.send({ type: 'HOST_START_GAME' });

  // All pass GT
  for (const seat of SEATS_IN_ORDER) {
    actor.send({ type: 'GRAND_TICHU_PASS', seat });
  }

  // No one has called — South should be allowed
  const handler = new MoveHandler(actor);
  const result = handler.handleTichuDeclaration('south');
  expect(result.ok).toBe(true);
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `cd code && pnpm test -- --run packages/server/tests/game/move-handler.test.ts`
Expected: The reject test fails; the override test fails (no `partnerOverride` param yet).

- [ ] **Step 7: Add partner check to handleTichuDeclaration**

Update `handleTichuDeclaration` (line 83) in `code/packages/server/src/game/move-handler.ts`:

```typescript
/** Handle TICHU_DECLARATION — allowed during cardPassing and playing (before first play) */
handleTichuDeclaration(seat: Seat, partnerOverride?: boolean): MoveResult {
  const state = this.stateValue;
  if (state !== 'cardPassing' && state !== 'playing') {
    return { ok: false, error: 'Cannot call Tichu in current phase' };
  }

  const round = this.context.currentRound;
  if (!round) return { ok: false, error: 'No active round' };
  const player = round.players[seat];
  if (player.hasPlayed) {
    return { ok: false, error: 'Cannot call Tichu after first play' };
  }
  if (player.tipiCall !== 'none') {
    return { ok: false, error: 'Already made a Tichu call' };
  }

  // Partner call safeguard
  if (!partnerOverride) {
    const partner = getPartner(seat);
    const partnerCall = round.players[partner].tipiCall;
    if (partnerCall !== 'none') {
      return { ok: false, error: 'PARTNER_ALREADY_CALLED', partnerCall };
    }
  }

  this.actor.send({ type: 'REGULAR_TICHU_CALL', seat });
  return { ok: true };
}
```

- [ ] **Step 8: Run all tests to verify they pass**

Run: `cd code && pnpm test -- --run packages/server/tests/game/move-handler.test.ts`
Expected: All tests pass, including the 7 new partner safeguard tests.

- [ ] **Step 9: Commit**

```bash
cd code && git add packages/server/src/game/move-handler.ts packages/server/tests/game/move-handler.test.ts
git commit -m "feat: add partner call safeguard to MoveHandler for GT and Tichu

Reject GT/Tichu calls when partner has already called, unless
partnerOverride is true. Returns structured PARTNER_ALREADY_CALLED error.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Server — GameManager passes `partnerOverride` and uses structured error code

**Files:**
- Modify: `code/packages/server/src/game/game-manager.ts:130-204`

- [ ] **Step 1: Update handleMessage to pass partnerOverride and use structured error code**

In `code/packages/server/src/game/game-manager.ts`, update the `handleMessage` method's switch cases for `GRAND_TICHU_DECISION` and `TICHU_DECLARATION` (lines 142-148):

```typescript
case 'GRAND_TICHU_DECISION':
  result = this.moveHandler.handleGrandTichuDecision(seat, message.call, message.partnerOverride);
  break;

case 'TICHU_DECLARATION':
  result = this.moveHandler.handleTichuDeclaration(seat, message.partnerOverride);
  break;
```

Then update the error handling block (lines 195-201) to pass the structured error code:

```typescript
if (!result.ok) {
  const snapshot = this.actor.getSnapshot();
  const stateVal = typeof snapshot.value === 'string' ? snapshot.value : String(snapshot.value);
  console.error(`[INVALID_MOVE] seat=${seat} type=${message.type} state=${stateVal} error=${result.error}`);
  // Use structured error code for partner safeguard; generic INVALID_MOVE for others
  const errorCode = result.error === 'PARTNER_ALREADY_CALLED' ? 'PARTNER_ALREADY_CALLED' : 'INVALID_MOVE';
  const errorMessage = result.error === 'PARTNER_ALREADY_CALLED'
    ? `PARTNER_ALREADY_CALLED:${(result as any).partnerCall}`
    : result.error;
  this.broadcaster.sendError(ws, errorCode, errorMessage);
  return;
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd code && pnpm build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
cd code && git add packages/server/src/game/game-manager.ts
git commit -m "feat: pass partnerOverride through GameManager and use structured error code

GameManager now forwards partnerOverride from client messages to
MoveHandler and sends PARTNER_ALREADY_CALLED error code to clients.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Server — BotRunner handles partner call rejection

**Files:**
- Modify: `code/packages/server/src/bot/bot-runner.ts:1,8-9,189-194,203-219,222-246`
- Test: `code/packages/server/tests/bot/bot-runner.test.ts`

- [ ] **Step 1: Write failing tests for bot Grand Tichu rejection**

Add a new `describe('partner tichu call safeguard')` block to `code/packages/server/tests/bot/bot-runner.test.ts`:

```typescript
describe('partner tichu call safeguard', () => {
  it('should send GT pass when bot GT call is rejected due to partner call', async () => {
    actor = createTestActor();
    seatAllPlayers(actor);
    actor.send({ type: 'HOST_START_GAME' });
    expect(getState(actor)).toBe('grandTichuDecision');

    // Create a bot that always wants to call Grand Tichu
    const alwaysCallBot: BotStrategy = {
      difficulty: 'regular',
      chooseGrandTichu: () => true,
      chooseRegularTichu: () => false,
      chooseCardsToPass: (hand: GameCard[], seat: Seat) => {
        const cards: Record<string, GameCard> = {};
        let i = 0;
        for (const s of SEATS_IN_ORDER) {
          if (s !== seat) cards[s] = hand[i++];
        }
        return cards as Record<Seat, GameCard>;
      },
      choosePlay: () => ({ action: 'pass' as const }),
      chooseDragonGiftRecipient: (opponents: Seat[]) => opponents[0],
      chooseMahjongWish: () => null,
    };

    // North (human) calls Grand Tichu first
    actor.send({ type: 'GRAND_TICHU_CALL', seat: 'north' });

    // South (bot, North's partner) — should attempt to call but get rejected, then pass
    runner = new BotRunner(actor, INSTANT_CONFIG);
    runner.addBot('south', alwaysCallBot);
    runner.onStateChange();
    await flushTimers();

    // South should have passed (not called) since partner already called
    expect(getContext(actor).grandTichuDecisions.has('south')).toBe(true);
    expect(getContext(actor).currentRound!.players.south.tipiCall).toBe('none');
  });

  it('should silently drop regular Tichu call when rejected due to partner call', async () => {
    actor = createTestActor();
    seatAllPlayers(actor);
    actor.send({ type: 'HOST_START_GAME' });

    // North calls Grand Tichu
    actor.send({ type: 'GRAND_TICHU_CALL', seat: 'north' });

    // Everyone else passes GT
    actor.send({ type: 'GRAND_TICHU_PASS', seat: 'south' });
    actor.send({ type: 'GRAND_TICHU_PASS', seat: 'east' });
    actor.send({ type: 'GRAND_TICHU_PASS', seat: 'west' });

    expect(getState(actor)).toBe('cardPassing');

    // Create a bot that always wants to call Tichu
    const alwaysTichuBot: BotStrategy = {
      difficulty: 'regular',
      chooseGrandTichu: () => false,
      chooseRegularTichu: () => true,
      chooseCardsToPass: (hand: GameCard[], seat: Seat) => {
        const cards: Record<string, GameCard> = {};
        let i = 0;
        for (const s of SEATS_IN_ORDER) {
          if (s !== seat) cards[s] = hand[i++];
        }
        return cards as Record<Seat, GameCard>;
      },
      choosePlay: () => ({ action: 'pass' as const }),
      chooseDragonGiftRecipient: (opponents: Seat[]) => opponents[0],
      chooseMahjongWish: () => null,
    };

    // South (bot, North's partner) — Tichu call should be silently dropped
    runner = new BotRunner(actor, INSTANT_CONFIG);
    runner.addBot('south', alwaysTichuBot);
    runner.onStateChange();
    await flushTimers();

    // South should NOT have called Tichu (partner already has GT)
    expect(getContext(actor).currentRound!.players.south.tipiCall).toBe('none');
    // But South should still pass cards normally
    expect(getContext(actor).cardPassDecisions.has('south')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd code && pnpm test -- --run packages/server/tests/bot/bot-runner.test.ts`
Expected: Both tests fail — bots currently call without checking.

- [ ] **Step 3: Update BotRunner to use MoveHandler for GT calls and handle rejection**

In `code/packages/server/src/bot/bot-runner.ts`:

First, add the MoveHandler import (line 1 area):

```typescript
import { MoveHandler } from '../game/move-handler.js';
```

Update the constructor to accept and store a MoveHandler:

```typescript
constructor(
  private readonly actor: GameActor,
  private readonly config: BotRunnerConfig = DEFAULT_CONFIG,
  private readonly moveHandler?: MoveHandler,
) {}
```

Then update `handleGrandTichuPhase` (line 203) to route through MoveHandler when available:

```typescript
private handleGrandTichuPhase(context: GameMachineContext): void {
  for (const [seat, bot] of this.bots) {
    if (context.grandTichuDecisions.has(seat)) continue;

    const round = context.currentRound;
    if (!round) continue;
    this.provideContext(bot, round, context);
    const hand8 = round.players[seat].hand;

    this.scheduleGrandTichuAction(seat, () => {
      const call = bot.chooseGrandTichu(hand8);
      if (call && this.moveHandler) {
        const result = this.moveHandler.handleGrandTichuDecision(seat, true);
        if (!result.ok && result.error === 'PARTNER_ALREADY_CALLED') {
          // Partner already called — bot must pass instead
          this.send({ type: 'GRAND_TICHU_PASS', seat });
          return;
        }
        if (result.ok) {
          // MoveHandler already sent the event to the actor
          this.afterActionCallback?.();
          return;
        }
      }
      // Fallback: no moveHandler or non-call — send directly
      this.send(call
        ? { type: 'GRAND_TICHU_CALL', seat }
        : { type: 'GRAND_TICHU_PASS', seat },
      );
    });
  }
}
```

Then update `handleCardPassingPhase` (line 222) to route Tichu calls through MoveHandler:

```typescript
private handleCardPassingPhase(context: GameMachineContext): void {
  for (const [seat, bot] of this.bots) {
    const round = context.currentRound;
    if (!round) continue;
    this.provideContext(bot, round, context);
    const hand = round.players[seat].hand;

    // Bot decides on regular Tichu before passing cards
    if (round.players[seat].tipiCall === 'none') {
      const callTichu = bot.chooseRegularTichu(hand);
      if (callTichu) {
        if (this.moveHandler) {
          const result = this.moveHandler.handleTichuDeclaration(seat);
          if (result.ok) {
            // MoveHandler already sent the event — just broadcast
            this.scheduleAction(() => {
              this.afterActionCallback?.();
            });
          }
          // If PARTNER_ALREADY_CALLED or other error: silently drop the call
        } else {
          this.scheduleAction(() => {
            this.send({ type: 'REGULAR_TICHU_CALL', seat });
          });
        }
      }
    }

    if (context.cardPassDecisions.has(seat)) continue;

    this.scheduleAction(() => {
      const cards = bot.chooseCardsToPass(hand, seat);
      this.send({ type: 'CARDS_PASSED', seat, cards });
    });
  }
}
```

- [ ] **Step 4: Update GameManager to pass MoveHandler to BotRunner**

In `code/packages/server/src/game/game-manager.ts`, update the BotRunner construction (line 97):

```typescript
this.botRunner = new BotRunner(this.actor, undefined, this.moveHandler);
```

Note: The `moveHandler` is created on line 94 (`this.moveHandler = new MoveHandler(this.actor)`), so it's available before the BotRunner is created on line 97.

- [ ] **Step 5: Update tests to pass MoveHandler to BotRunner**

In the new test block in `code/packages/server/tests/bot/bot-runner.test.ts`, update both tests to pass a MoveHandler:

```typescript
// Add import at top of file
import { MoveHandler } from '../../src/game/move-handler.js';
```

Then in each test, create the BotRunner with a MoveHandler:

```typescript
const moveHandler = new MoveHandler(actor);
runner = new BotRunner(actor, INSTANT_CONFIG, moveHandler);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd code && pnpm test -- --run packages/server/tests/bot/bot-runner.test.ts`
Expected: All tests pass, including the 2 new partner safeguard tests.

- [ ] **Step 7: Run full test suite**

Run: `cd code && pnpm test -- --run`
Expected: All tests pass. No regressions — existing BotRunner tests use `new BotRunner(actor, INSTANT_CONFIG)` which still works since `moveHandler` is optional.

- [ ] **Step 8: Commit**

```bash
cd code && git add packages/server/src/bot/bot-runner.ts packages/server/src/game/game-manager.ts packages/server/tests/bot/bot-runner.test.ts
git commit -m "feat: BotRunner routes GT/Tichu calls through MoveHandler for partner safeguard

Bots now respect PARTNER_ALREADY_CALLED rejection:
- Grand Tichu: bot sends pass instead
- Regular Tichu: bot silently drops the call and continues normally

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Client — Confirmation dialog and error interception

**Files:**
- Modify: `code/packages/client/src/app/game/[gameId]/page.tsx:254-255,450-458,456-458`

- [ ] **Step 1: Add partner confirmation state to the game page**

In `code/packages/client/src/app/game/[gameId]/page.tsx`, add state for the confirmation dialog near the other `useState` declarations (around line 300 area):

```typescript
// Partner call safeguard confirmation dialog state
const [partnerCallConfirm, setPartnerCallConfirm] = useState<{
  type: 'grandTichu' | 'tichu';
  partnerCall: string;
} | null>(null);
```

- [ ] **Step 2: Update ERROR handler to intercept PARTNER_ALREADY_CALLED**

Update the ERROR handler (line 254-255) from:

```typescript
} else if (msg.type === 'ERROR') {
  uiStore.showErrorToast(msg.message);
}
```

to:

```typescript
} else if (msg.type === 'ERROR') {
  if (msg.code === 'PARTNER_ALREADY_CALLED') {
    // Parse partner call level from message (format: "PARTNER_ALREADY_CALLED:grandTichu")
    const partnerCall = msg.message.split(':')[1] || 'tichu';
    // Determine which call was attempted based on game phase
    const callType = gameStore.phase === 'grandTichuDecision' ? 'grandTichu' : 'tichu';
    setPartnerCallConfirm({ type: callType, partnerCall });
  } else {
    uiStore.showErrorToast(msg.message);
  }
}
```

- [ ] **Step 3: Add confirmation dialog handlers**

Add these callbacks near the `handleTichu` and `handleGrandTichuDecision` callbacks (around line 454):

```typescript
const handlePartnerOverrideConfirm = useCallback(() => {
  if (!partnerCallConfirm) return;
  if (partnerCallConfirm.type === 'grandTichu') {
    send({ type: 'GRAND_TICHU_DECISION', call: true, partnerOverride: true });
  } else {
    send({ type: 'TICHU_DECLARATION', partnerOverride: true });
  }
  setPartnerCallConfirm(null);
}, [partnerCallConfirm, send]);

const handlePartnerOverrideCancel = useCallback(() => {
  if (!partnerCallConfirm) return;
  if (partnerCallConfirm.type === 'grandTichu') {
    // Send a GT pass instead
    send({ type: 'GRAND_TICHU_DECISION', call: false });
  }
  // For regular Tichu, just dismiss — no further action needed
  setPartnerCallConfirm(null);
}, [partnerCallConfirm, send]);
```

- [ ] **Step 4: Add the confirmation dialog JSX**

Add the dialog JSX just before the closing `</>` of the page's return statement (near the bottom of the component):

```tsx
{/* Partner call safeguard confirmation dialog */}
{partnerCallConfirm && (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.6)',
      zIndex: 1000,
    }}
    role="dialog"
    aria-modal="true"
    aria-label="Partner already called"
  >
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--space-3)',
        padding: 'var(--space-6)',
        maxWidth: '400px',
        textAlign: 'center',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3)',
      }}
    >
      <h3 style={{ margin: '0 0 var(--space-3)', color: 'var(--color-warning, #f59e0b)' }}>
        Partner Already Called
      </h3>
      <p style={{ margin: '0 0 var(--space-4)', color: 'var(--color-text)' }}>
        Your partner has already called{' '}
        <strong>{partnerCallConfirm.partnerCall === 'grandTichu' ? 'Grand Tichu' : 'Tichu'}</strong>.
        {' '}Calling {partnerCallConfirm.type === 'grandTichu' ? 'Grand Tichu' : 'Tichu'} as well is risky.
      </p>
      <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
        <button
          onClick={handlePartnerOverrideCancel}
          autoFocus
          style={{
            padding: 'var(--space-2) var(--space-4)',
            borderRadius: 'var(--space-2)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            cursor: 'pointer',
            fontSize: '1rem',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handlePartnerOverrideConfirm}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            borderRadius: 'var(--space-2)',
            border: 'none',
            background: 'var(--color-tichu-badge)',
            color: 'white',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 600,
          }}
        >
          Call {partnerCallConfirm.type === 'grandTichu' ? 'Grand Tichu' : 'Tichu'} Anyway
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 5: Verify build passes**

Run: `cd code && pnpm build`
Expected: Clean build with no errors.

- [ ] **Step 6: Commit**

```bash
cd code && git add packages/client/src/app/game/\\[gameId\\]/page.tsx
git commit -m "feat: add partner call confirmation dialog for humans

When server rejects a GT/Tichu call with PARTNER_ALREADY_CALLED,
show a dialog with Cancel (default) and Call Anyway options.
Cancel sends a GT pass (during GT phase) or dismisses (during Tichu).
Call Anyway re-sends with partnerOverride: true.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Integration verification

- [ ] **Step 1: Run full test suite**

Run: `cd code && pnpm test -- --run`
Expected: All tests pass.

- [ ] **Step 2: Run build**

Run: `cd code && pnpm build`
Expected: Clean build.

- [ ] **Step 3: Smoke test (manual)**

Start the dev server (`cd code && bash dev-start.sh`) and verify:
1. Create a game with 3 bots
2. During Grand Tichu phase: your partner bot should never call GT if you call GT first
3. Try calling Grand Tichu — if your bot partner already called, you should see the confirmation dialog
4. Test "Cancel" dismisses and sends a pass
5. Test "Call Anyway" sends the call through
6. During playing phase: test the Tichu button with a partner who already called

- [ ] **Step 4: Final commit (if any smoke-test fixes needed)**

Only if fixes are needed from smoke testing.
