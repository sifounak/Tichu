# Back Button Navigation & Bot Strategy Improvements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix back button to show leave-game dialog instead of navigating away, and improve bot AI to prefer multi-card plays and enforce strict Phoenix singleton rules.

**Architecture:** Three independent changes. Task 1 is client-only (game page popstate interception + LeaveConfirmDialog enhancement). Tasks 2-3 are server-only bot AI changes (lead play logic in bot.ts). Task 4 adds getHighestUnaccountedStandardRank() to CardTracker then tightens Phoenix singleton rules. All changes have independent test suites.

**Tech Stack:** Next.js (client), Vitest (testing), TypeScript, Zustand stores

**Spec:** `docs/superpowers/specs/2026-04-26-back-button-and-bot-strategy-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `packages/client/src/components/game/LeaveConfirmDialog.tsx` | Modify | Add `externalOpen` prop to allow programmatic opening |
| `packages/client/src/app/game/[gameId]/page.tsx` | Modify | Add popstate listener, back-button dialog state |
| `packages/server/src/bot/bot.ts` | Modify | Strengthen single-card suppression in `chooseLeadPlay`, Phoenix lead preference, strict Phoenix singleton rules |
| `packages/server/src/bot/card-tracker.ts` | Modify | Add `getHighestUnaccountedStandardRank()` |
| `packages/server/tests/bot/card-tracker.test.ts` | Modify | Test new tracker method |
| `packages/server/tests/bot/bot-strategy-utils.test.ts` | Modify | Test multi-card preference |
| `packages/server/tests/bot/bot.test.ts` | Modify | Test Phoenix singleton strict rules, multi-card lead preference |

---

### Task 1: Back Button Intercepts Navigation with Leave Dialog

**Files:**
- Modify: `packages/client/src/components/game/LeaveConfirmDialog.tsx`
- Modify: `packages/client/src/app/game/[gameId]/page.tsx:640-649` (near existing beforeunload effect)
- Modify: `packages/client/src/app/game/[gameId]/page.tsx:1107-1133` (LeaveConfirmDialog usage)

- [ ] **Step 1: Add `externalOpen` prop to LeaveConfirmDialog**

In `packages/client/src/components/game/LeaveConfirmDialog.tsx`, add an optional `externalOpen` prop and a `useEffect` to sync it with the internal `show` state:

```tsx
interface LeaveConfirmDialogProps {
  title: string;
  subtitle: string;
  onConfirm: () => void;
  children: (openDialog: () => void) => React.ReactNode;
  /** When true, opens the dialog programmatically (e.g., from back button) */
  externalOpen?: boolean;
  /** Called when dialog closes (cancel or confirm) so parent can reset externalOpen */
  onClose?: () => void;
}

export const LeaveConfirmDialog = memo(function LeaveConfirmDialog({
  title,
  subtitle,
  onConfirm,
  children,
  externalOpen,
  onClose,
}: LeaveConfirmDialogProps) {
  const [show, setShow] = useState(false);

  const open = useCallback(() => setShow(true), []);
  const close = useCallback(() => {
    setShow(false);
    onClose?.();
  }, [onClose]);
  const confirm = useCallback(() => {
    setShow(false);
    onClose?.();
    onConfirm();
  }, [onConfirm, onClose]);

  // Sync external open trigger
  useEffect(() => {
    if (externalOpen) setShow(true);
  }, [externalOpen]);

  return (
    <>
      {children(open)}
      {show && createPortal(
        // ... rest unchanged
```

The `close` and `confirm` callbacks now also call `onClose?.()` so the parent can reset its state.

- [ ] **Step 2: Add popstate interception in game page**

In `packages/client/src/app/game/[gameId]/page.tsx`, add state and a `useEffect` right after the existing `beforeunload` effect (after line 649):

```tsx
// REQ-F-BB01: Intercept browser back button during active game
const [backButtonDialogOpen, setBackButtonDialogOpen] = useState(false);

useEffect(() => {
  if (isSpectator || !gameInProgress) return;

  // Push sentinel state so back button has something to pop
  history.pushState({ tichuGame: true }, '');

  const handlePopState = () => {
    // Re-push to keep URL stable
    history.pushState({ tichuGame: true }, '');
    setBackButtonDialogOpen(true);
  };

  window.addEventListener('popstate', handlePopState);
  return () => {
    window.removeEventListener('popstate', handlePopState);
  };
}, [isSpectator, gameInProgress]);
```

- [ ] **Step 3: Wire backButtonDialogOpen to LeaveConfirmDialog**

Update the existing `LeaveConfirmDialog` usage around line 1107 to pass the new props:

```tsx
<LeaveConfirmDialog
  title={isSpectator ? 'Leave Room?' : 'Leave Game?'}
  subtitle={isSpectator ? '' : 'This will count as a forfeit if you leave.'}
  onConfirm={handleLeaveGame}
  externalOpen={backButtonDialogOpen}
  onClose={() => setBackButtonDialogOpen(false)}
>
```

- [ ] **Step 4: Build and verify**

Run from `code/`:
```bash
pnpm --filter @tichu/client build
```
Expected: Build succeeds with no type errors.

- [ ] **Step 5: Manual browser test**

Run `bash scripts/dev-start.sh`, join a game, press browser back button.
Expected: Leave Game dialog appears. Cancel keeps you in game. Confirm navigates to lobby.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/components/game/LeaveConfirmDialog.tsx packages/client/src/app/game/\[gameId\]/page.tsx
git commit -m "feat(client): intercept back button to show leave-game dialog

REQ-F-BB01 through REQ-F-BB05: Instead of navigating away when user
presses back button during a game, show the Leave Game confirmation
dialog. Spectators and non-game states are exempt."
```

---

### Task 2: Bot Prefers Multi-Card Plays Over Singles When Leading

**Files:**
- Modify: `packages/server/src/bot/bot.ts:1131-1141`
- Modify: `packages/server/tests/bot/bot.test.ts`

- [ ] **Step 1: Write failing tests for multi-card preference**

Add tests to `packages/server/tests/bot/bot.test.ts`. These test that when a bot has cards forming a multi-card combo, it doesn't lead singles from that combo. Use the existing `Bot` class directly with a mock round state.

First, check how bot tests are structured by reading the existing test file to find the test helpers and patterns used. The tests should create a Bot, set up a hand with triple Jacks + other cards, generate valid plays, and verify the bot chooses the triple over single Jacks.

Add a new `describe` block:

```typescript
describe('REQ-F-MC01: Multi-card preference over singles', () => {
  it('leads triple Jacks instead of single Jack', () => {
    const hand: GameCard[] = [
      card('standard', 11, 'jade', 1101),
      card('standard', 11, 'pagoda', 1102),
      card('standard', 11, 'star', 1103),
      card('standard', 5, 'jade', 501),
      card('standard', 3, 'pagoda', 302),
    ];

    const validPlays: Combination[] = [
      makeCombo(CombinationType.Single, [hand[0]], 11),
      makeCombo(CombinationType.Single, [hand[1]], 11),
      makeCombo(CombinationType.Single, [hand[2]], 11),
      makeCombo(CombinationType.Triple, [hand[0], hand[1], hand[2]], 11),
      makeCombo(CombinationType.Single, [hand[3]], 5),
      makeCombo(CombinationType.Single, [hand[4]], 3),
    ];

    const roundState = makeRoundState();
    roundState.players.south.hand = hand;

    const bot = new Bot();
    const decision = bot.choosePlay({
      hand,
      validPlays,
      roundState,
      seat: 'south' as Seat,
      currentTrick: null,
      canPass: false,
    });

    // Should NOT play a single Jack — should play triple or a non-Jack single
    const playedCards = decision.cards!;
    const isSingleJack = playedCards.length === 1 &&
      playedCards[0].card.kind === 'standard' && playedCards[0].card.rank === 11;
    expect(isSingleJack).toBe(false);
  });

  it('does not play single card that is part of a straight', () => {
    const hand: GameCard[] = [
      card('standard', 5, 'jade', 501),
      card('standard', 6, 'jade', 601),
      card('standard', 7, 'jade', 701),
      card('standard', 8, 'jade', 801),
      card('standard', 9, 'jade', 901),
      card('standard', 13, 'pagoda', 1302),
    ];

    const validPlays: Combination[] = [
      makeCombo(CombinationType.Single, [hand[0]], 5),
      makeCombo(CombinationType.Single, [hand[1]], 6),
      makeCombo(CombinationType.Single, [hand[2]], 7),
      makeCombo(CombinationType.Single, [hand[3]], 8),
      makeCombo(CombinationType.Single, [hand[4]], 9),
      makeCombo(CombinationType.Single, [hand[5]], 13),
      makeCombo(CombinationType.Straight, [hand[0], hand[1], hand[2], hand[3], hand[4]], 9),
    ];

    const roundState = makeRoundState();
    roundState.players.south.hand = hand;

    const bot = new Bot();
    const decision = bot.choosePlay({
      hand,
      validPlays,
      roundState,
      seat: 'south' as Seat,
      currentTrick: null,
      canPass: false,
    });

    // Should play the straight, not any single from it
    const playedCards = decision.cards!;
    expect(playedCards.length).toBe(5);
  });

  it('plays truly singleton cards as singles', () => {
    const hand: GameCard[] = [
      card('standard', 3, 'jade', 301),
      card('standard', 7, 'pagoda', 702),
      card('standard', 13, 'star', 1303),
    ];

    const validPlays: Combination[] = [
      makeCombo(CombinationType.Single, [hand[0]], 3),
      makeCombo(CombinationType.Single, [hand[1]], 7),
      makeCombo(CombinationType.Single, [hand[2]], 13),
    ];

    const roundState = makeRoundState();
    roundState.players.south.hand = hand;

    const bot = new Bot();
    const decision = bot.choosePlay({
      hand,
      validPlays,
      roundState,
      seat: 'south' as Seat,
      currentTrick: null,
      canPass: false,
    });

    // Only singles available — should play lowest
    expect(decision.cards!.length).toBe(1);
    expect(decision.cards![0].card.kind === 'standard' && decision.cards![0].card.rank).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd code && pnpm --filter @tichu/server test -- --run -t "Multi-card preference"
```
Expected: First two tests FAIL (bot plays single Jack / single from straight).

- [ ] **Step 3: Implement multi-card preference in chooseLeadPlay**

In `packages/server/src/bot/bot.ts`, replace the current REQ-F-DEF04 logic at lines 1131-1141:

**Old code:**
```typescript
      // REQ-F-DEF04: Skip singles that are part of a multi-card combo in hand
      if (combo.type === CombinationType.Single && combo.cards[0].card.kind === 'standard') {
        if (isCardInMultiCardCombo(combo.cards[0], hand)) {
          // Check if there's a multi-card combo of this rank available
          const multiCardOfSameRank = ranked.find(
            (c) => c.cards.length > 1 && !c.isBomb &&
              c.cards.some((gc) => gc.card.kind === 'standard' && gc.card.rank === combo.rank),
          );
          if (multiCardOfSameRank) continue; // Skip the single, prefer the multi-card
        }
      }
```

**New code:**
```typescript
      // REQ-F-MC01: Skip singles whose card appears in ANY multi-card combo in validPlays
      if (combo.type === CombinationType.Single && combo.cards[0].card.kind === 'standard') {
        const cardId = combo.cards[0].id;
        const hasMultiCardCombo = validPlays.some(
          (c) => c.cards.length > 1 && !c.isBomb && c.cards.some((gc) => gc.id === cardId),
        );
        if (hasMultiCardCombo) continue;
      }
```

This is simpler and broader — it checks if the card's `id` appears in any multi-card (non-bomb) combination, not just same-rank combos. This covers straights, full houses, consecutive pairs, etc.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd code && pnpm --filter @tichu/server test -- --run -t "Multi-card preference"
```
Expected: All 3 tests PASS.

- [ ] **Step 5: Run full bot test suite for regressions**

```bash
cd code && pnpm --filter @tichu/server test -- --run
```
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/bot/bot.ts packages/server/tests/bot/bot.test.ts
git commit -m "feat(bot): prefer multi-card plays over singles when leading

REQ-F-MC01: When leading, skip any single card that appears in a valid
multi-card combination (pair, triple, straight, full house, consecutive
pairs). Previously only checked same-rank combos, missing straights
and cross-rank combinations."
```

---

### Task 3: Add getHighestUnaccountedStandardRank to CardTracker

**Files:**
- Modify: `packages/server/src/bot/card-tracker.ts:299-312` (after `allRanksAboveAccountedFor`)
- Modify: `packages/server/tests/bot/card-tracker.test.ts`

- [ ] **Step 1: Write failing tests for new tracker method**

Add tests to `packages/server/tests/bot/card-tracker.test.ts`:

```typescript
describe('getHighestUnaccountedStandardRank', () => {
  it('returns 14 (Ace) when no cards have been played', () => {
    const tracker = new CardTracker();
    tracker.update(makeRoundState(), 'south', []);
    expect(tracker.getHighestUnaccountedStandardRank()).toBe(14);
  });

  it('returns 13 (King) when all Aces are accounted for', () => {
    const tracker = new CardTracker();
    // Put 4 Aces in own hand
    const hand = [
      card('standard', 14, 'jade', 1401),
      card('standard', 14, 'pagoda', 1402),
      card('standard', 14, 'star', 1403),
      card('standard', 14, 'sword', 1404),
    ];
    tracker.update(makeRoundState(), 'south', hand);
    expect(tracker.getHighestUnaccountedStandardRank()).toBe(13);
  });

  it('returns 12 (Queen) when all Aces and Kings are accounted for', () => {
    const tracker = new CardTracker();
    const hand = [
      card('standard', 14, 'jade', 1401),
      card('standard', 14, 'pagoda', 1402),
      card('standard', 14, 'star', 1403),
      card('standard', 14, 'sword', 1404),
      card('standard', 13, 'jade', 1301),
      card('standard', 13, 'pagoda', 1302),
      card('standard', 13, 'star', 1303),
      card('standard', 13, 'sword', 1304),
    ];
    tracker.update(makeRoundState(), 'south', hand);
    expect(tracker.getHighestUnaccountedStandardRank()).toBe(12);
  });

  it('returns null when all standard ranks are accounted for', () => {
    // This is an extreme edge case — all 52 standard cards accounted for
    const tracker = new CardTracker();
    const hand: GameCard[] = [];
    let id = 1;
    for (let rank = 2; rank <= 14; rank++) {
      for (const suit of ['jade', 'pagoda', 'star', 'sword']) {
        hand.push(card('standard', rank, suit, id++));
      }
    }
    tracker.update(makeRoundState(), 'south', hand);
    expect(tracker.getHighestUnaccountedStandardRank()).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd code && pnpm --filter @tichu/server test -- --run -t "getHighestUnaccountedStandardRank"
```
Expected: FAIL — method does not exist.

- [ ] **Step 3: Implement getHighestUnaccountedStandardRank**

In `packages/server/src/bot/card-tracker.ts`, add after `allRanksAboveAccountedFor` (after line 312):

```typescript
  /**
   * REQ-F-PHX12: Get the highest standard rank (14 down to 2) that has
   * unaccounted cards (not played and not in own hand). Returns null if
   * all standard ranks are fully accounted for.
   */
  getHighestUnaccountedStandardRank(): number | null {
    for (let r = 14; r >= 2; r--) {
      const played = this.playedByRank.get(r)?.count ?? 0;
      const inHand = this.ownHandRankCounts.get(r) ?? 0;
      if (played + inHand < 4) return r;
    }
    return null;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd code && pnpm --filter @tichu/server test -- --run -t "getHighestUnaccountedStandardRank"
```
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/bot/card-tracker.ts packages/server/tests/bot/card-tracker.test.ts
git commit -m "feat(bot): add getHighestUnaccountedStandardRank to CardTracker

REQ-F-PHX12: Returns the highest standard rank (Ace down to 2) that
still has unaccounted cards. Used by the strict Phoenix singleton
rules to determine the minimum acceptable rank for Phoenix single plays."
```

---

### Task 4: Strict Phoenix Singleton Rules

**Files:**
- Modify: `packages/server/src/bot/bot.ts:778-816` (evaluatePhoenixPlay singleton logic)
- Modify: `packages/server/tests/bot/bot.test.ts`

- [ ] **Step 1: Write failing tests for strict Phoenix singleton rules**

Add tests to `packages/server/tests/bot/bot.test.ts`:

```typescript
describe('REQ-F-PHX12/PHX13: Strict Phoenix singleton rules', () => {
  it('returns never for Phoenix single on Mah Jong (rank 1)', () => {
    const bot = new Bot();
    const hand: GameCard[] = [
      card('phoenix'),
      card('standard', 10, 'jade', 1001),
      card('standard', 8, 'pagoda', 802),
    ];
    const phoenixCard = hand[0];
    const phoenixCombo = makeCombo(CombinationType.Single, [phoenixCard], 1.5);

    const currentTrick = {
      plays: [{
        seat: 'east' as Seat,
        combination: makeCombo(CombinationType.Single, [card('mahjong')], 1),
      }],
      currentWinner: 'east' as Seat,
      passCount: 0,
    };

    const result = (bot as any).evaluatePhoenixPlay(phoenixCombo, currentTrick, hand);
    expect(result).toBe('never');
  });

  it('returns never for Phoenix single on 10 (below Queen floor)', () => {
    const bot = new Bot();
    const hand: GameCard[] = [
      card('phoenix'),
      card('standard', 5, 'jade', 501),
      card('standard', 3, 'pagoda', 302),
    ];
    const phoenixCard = hand[0];
    const phoenixCombo = makeCombo(CombinationType.Single, [phoenixCard], 10.5);

    const currentTrick = {
      plays: [{
        seat: 'east' as Seat,
        combination: makeCombo(CombinationType.Single, [card('standard', 10, 'star', 1003)], 10),
      }],
      currentWinner: 'east' as Seat,
      passCount: 0,
    };

    const result = (bot as any).evaluatePhoenixPlay(phoenixCombo, currentTrick, hand);
    expect(result).toBe('never');
  });

  it('returns acceptable for Phoenix single on Ace when Aces are highest unaccounted', () => {
    const bot = new Bot();
    const hand: GameCard[] = [
      card('phoenix'),
      card('standard', 5, 'jade', 501),
    ];
    const phoenixCard = hand[0];
    const phoenixCombo = makeCombo(CombinationType.Single, [phoenixCard], 14.5);

    const currentTrick = {
      plays: [{
        seat: 'east' as Seat,
        combination: makeCombo(CombinationType.Single, [card('standard', 14, 'star', 1403)], 14),
      }],
      currentWinner: 'east' as Seat,
      passCount: 0,
    };

    const result = (bot as any).evaluatePhoenixPlay(phoenixCombo, currentTrick, hand);
    expect(result).toBe('acceptable');
  });

  it('returns never for Phoenix single on Queen when Kings are unaccounted', () => {
    const bot = new Bot();
    // No Kings in hand, no Kings played → Kings unaccounted → highest is Ace (14) or King (13)
    const hand: GameCard[] = [
      card('phoenix'),
      card('standard', 5, 'jade', 501),
      card('standard', 3, 'pagoda', 302),
    ];
    const phoenixCard = hand[0];
    const phoenixCombo = makeCombo(CombinationType.Single, [phoenixCard], 12.5);

    const currentTrick = {
      plays: [{
        seat: 'east' as Seat,
        combination: makeCombo(CombinationType.Single, [card('standard', 12, 'star', 1203)], 12),
      }],
      currentWinner: 'east' as Seat,
      passCount: 0,
    };

    // Aces unaccounted → highest unaccounted = 14 → Queen (12) < 14 → never
    const result = (bot as any).evaluatePhoenixPlay(phoenixCombo, currentTrick, hand);
    expect(result).toBe('never');
  });

  it('returns acceptable for Phoenix as last card regardless of rank', () => {
    const bot = new Bot();
    const hand: GameCard[] = [card('phoenix')];
    const phoenixCard = hand[0];
    const phoenixCombo = makeCombo(CombinationType.Single, [phoenixCard], 3.5);

    const currentTrick = {
      plays: [{
        seat: 'east' as Seat,
        combination: makeCombo(CombinationType.Single, [card('standard', 3, 'star', 303)], 3),
      }],
      currentWinner: 'east' as Seat,
      passCount: 0,
    };

    const result = (bot as any).evaluatePhoenixPlay(phoenixCombo, currentTrick, hand);
    expect(result).toBe('acceptable');
  });

  it('returns acceptable for Phoenix second-to-last with Dragon remaining', () => {
    const bot = new Bot();
    const hand: GameCard[] = [card('phoenix'), card('dragon')];
    const phoenixCard = hand[0];
    const phoenixCombo = makeCombo(CombinationType.Single, [phoenixCard], 5.5);

    const currentTrick = {
      plays: [{
        seat: 'east' as Seat,
        combination: makeCombo(CombinationType.Single, [card('standard', 5, 'star', 503)], 5),
      }],
      currentWinner: 'east' as Seat,
      passCount: 0,
    };

    const result = (bot as any).evaluatePhoenixPlay(phoenixCombo, currentTrick, hand);
    expect(result).toBe('acceptable');
  });

  it('returns never for Phoenix second-to-last with low single remaining', () => {
    const bot = new Bot();
    const hand: GameCard[] = [card('phoenix'), card('standard', 3, 'jade', 301)];
    const phoenixCard = hand[0];
    const phoenixCombo = makeCombo(CombinationType.Single, [phoenixCard], 5.5);

    const currentTrick = {
      plays: [{
        seat: 'east' as Seat,
        combination: makeCombo(CombinationType.Single, [card('standard', 5, 'star', 503)], 5),
      }],
      currentWinner: 'east' as Seat,
      passCount: 0,
    };

    const result = (bot as any).evaluatePhoenixPlay(phoenixCombo, currentTrick, hand);
    expect(result).toBe('never');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd code && pnpm --filter @tichu/server test -- --run -t "Strict Phoenix singleton"
```
Expected: Several tests FAIL (current logic is less strict).

- [ ] **Step 3: Implement strict Phoenix singleton logic**

In `packages/server/src/bot/bot.ts`, replace the singleton portion of `evaluatePhoenixPlay`. The method handles both singleton and multi-card Phoenix plays. Replace the REQ-F-PHX01a and REQ-F-PHX03a blocks (lines 780-816) with the new strict logic:

**Old code (lines 778-816):**
```typescript
    // ─── NEVER rules ───

    // REQ-F-PHX01a: Cascading singleton Phoenix guard — Phoenix on rank R is 'never'
    // unless all standard ranks above R are accounted for (played or in own hand).
    // E.g., Phoenix on Queen requires all Aces AND Kings accounted for.
    if (currentTrick && combo.cards.length === 1) {
      const lastPlay = currentTrick.plays[currentTrick.plays.length - 1];
      if (lastPlay && lastPlay.combination.cards.length === 1) {
        const lastCard = lastPlay.combination.cards[0];
        if (lastCard.card.kind === 'standard' && lastCard.card.rank < 14
          && !this.cardTracker.allRanksAboveAccountedFor(lastCard.card.rank)) {
          return 'never';
        }
      }
    }

    // ... (PHX02a stays) ...

    // ─── ACCEPTABLE scenarios ───

    // REQ-F-PHX03a: Cascading singleton Phoenix acceptance — Phoenix on rank R
    // is 'acceptable' when all ranks above R are accounted for.
    // Subsumes old PHX03 (over Ace) and PHX04 (over King if Aces played).
    if (currentTrick && combo.cards.length === 1) {
      const lastPlay = currentTrick.plays[currentTrick.plays.length - 1];
      if (lastPlay && lastPlay.combination.cards.length === 1) {
        const lastCard = lastPlay.combination.cards[0];
        if (lastCard.card.kind === 'standard'
          && this.cardTracker.allRanksAboveAccountedFor(lastCard.card.rank)) {
          return 'acceptable';
        }
      }
    }
```

**New code:**
```typescript
    // ─── NEVER rules ───

    // REQ-F-PHX12/PHX13: Strict Phoenix singleton rules
    if (currentTrick && combo.cards.length === 1) {
      const lastPlay = currentTrick.plays[currentTrick.plays.length - 1];
      if (lastPlay && lastPlay.combination.cards.length === 1) {
        const lastCard = lastPlay.combination.cards[0];
        const lastRank = lastCard.card.kind === 'standard' ? lastCard.card.rank
          : lastCard.card.kind === 'mahjong' ? 1 : 0;

        const remainingAfterPhoenix = hand.filter((gc) => !isPhoenix(gc.card));

        // Exception (a): Phoenix is last card — always acceptable
        if (remainingAfterPhoenix.length === 0) {
          return 'acceptable';
        }

        // Exception (b): Phoenix is second-to-last card and remaining card
        // guarantees going out next (Dragon or Ace)
        if (remainingAfterPhoenix.length === 1) {
          const lastCard2 = remainingAfterPhoenix[0];
          if (isDragon(lastCard2.card) ||
            (lastCard2.card.kind === 'standard' && lastCard2.card.rank === 14)) {
            return 'acceptable';
          }
        }

        // REQ-F-PHX13: Hard floor — never below Queen (rank 12)
        if (lastRank < 12) {
          return 'never';
        }

        // REQ-F-PHX12: Must be played over the highest unaccounted standard rank
        const highestUnaccounted = this.cardTracker.getHighestUnaccountedStandardRank();
        if (highestUnaccounted !== null && lastRank < highestUnaccounted) {
          return 'never';
        }

        return 'acceptable';
      }
    }
```

Keep REQ-F-PHX02a (short low multi-card guard) unchanged — it follows right after and covers multi-card Phoenix, not singletons.

Remove the old REQ-F-PHX03a block from the ACCEPTABLE section (since the new code above handles singleton acceptance inline).

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd code && pnpm --filter @tichu/server test -- --run -t "Strict Phoenix singleton"
```
Expected: All 7 tests PASS.

- [ ] **Step 5: Run full test suite for regressions**

```bash
cd code && pnpm --filter @tichu/server test -- --run
```
Expected: All tests pass. Some existing Phoenix singleton tests may need updating if they relied on the old less-strict behavior — update them to match the new stricter rules.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/bot/bot.ts packages/server/tests/bot/bot.test.ts
git commit -m "feat(bot): enforce strict Phoenix singleton rules

REQ-F-PHX12: Phoenix single can only be played over the highest
unaccounted standard rank.
REQ-F-PHX13: Hard floor of Queen — never play Phoenix single below
Queen except when going out or guaranteed to go out next.
Replaces old cascading guard (PHX01a/PHX03a) with stricter logic."
```

---

### Task 5: Promote Phoenix in Multi-Card Combos When Leading

**Files:**
- Modify: `packages/server/src/bot/bot.ts:1110-1160` (chooseLeadPlay main loop)
- Modify: `packages/server/tests/bot/bot.test.ts`

- [ ] **Step 1: Write failing tests for Phoenix multi-card preference**

Add tests to `packages/server/tests/bot/bot.test.ts`:

```typescript
describe('REQ-F-PHX10/PHX11: Prefer Phoenix in multi-card combos when leading', () => {
  it('prefers straight containing Phoenix over holding Phoenix for singleton use', () => {
    // Hand: Phoenix, 6, 7, 8, 9, King
    // Phoenix can form a 5-card straight 6-7-8-9-Phoenix(10)
    // Bot should play the straight, not hold Phoenix
    const hand: GameCard[] = [
      card('phoenix'),
      card('standard', 6, 'jade', 601),
      card('standard', 7, 'jade', 701),
      card('standard', 8, 'jade', 801),
      card('standard', 9, 'jade', 901),
      card('standard', 13, 'pagoda', 1302),
    ];

    const validPlays: Combination[] = [
      makeCombo(CombinationType.Single, [hand[1]], 6),
      makeCombo(CombinationType.Single, [hand[2]], 7),
      makeCombo(CombinationType.Single, [hand[3]], 8),
      makeCombo(CombinationType.Single, [hand[4]], 9),
      makeCombo(CombinationType.Single, [hand[5]], 13),
      makeCombo(CombinationType.Straight, [hand[0], hand[1], hand[2], hand[3], hand[4]], 10),
    ];

    const roundState = makeRoundState();
    roundState.players.south.hand = hand;

    const bot = new Bot();
    const decision = bot.choosePlay({
      hand,
      validPlays,
      roundState,
      seat: 'south' as Seat,
      currentTrick: null,
      canPass: false,
    });

    // Should play the 5-card straight containing Phoenix
    expect(decision.cards!.length).toBe(5);
    expect(decision.cards!.some((gc) => isPhoenix(gc.card))).toBe(true);
  });

  it('prefers full house with Phoenix over separate pair lead', () => {
    // Hand: Phoenix, 8, 8, 5, 5, King
    // Phoenix + pair of 5s + pair of 8s → full house (8,8,8+5,5 or 5,5,5+8,8)
    const hand: GameCard[] = [
      card('phoenix'),
      card('standard', 8, 'jade', 801),
      card('standard', 8, 'pagoda', 802),
      card('standard', 5, 'jade', 501),
      card('standard', 5, 'pagoda', 502),
      card('standard', 13, 'star', 1303),
    ];

    // Full house: Phoenix acts as third 8 → triple 8s + pair 5s
    const validPlays: Combination[] = [
      makeCombo(CombinationType.Pair, [hand[1], hand[2]], 8),
      makeCombo(CombinationType.Pair, [hand[3], hand[4]], 5),
      makeCombo(CombinationType.Single, [hand[1]], 8),
      makeCombo(CombinationType.Single, [hand[3]], 5),
      makeCombo(CombinationType.Single, [hand[5]], 13),
      makeCombo(CombinationType.FullHouse, [hand[0], hand[1], hand[2], hand[3], hand[4]], 8),
    ];

    const roundState = makeRoundState();
    roundState.players.south.hand = hand;

    const bot = new Bot();
    const decision = bot.choosePlay({
      hand,
      validPlays,
      roundState,
      seat: 'south' as Seat,
      currentTrick: null,
      canPass: false,
    });

    // Should play the full house (5 cards with Phoenix)
    expect(decision.cards!.length).toBe(5);
    expect(decision.cards!.some((gc) => isPhoenix(gc.card))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd code && pnpm --filter @tichu/server test -- --run -t "Prefer Phoenix in multi-card"
```
Expected: Tests FAIL — bot doesn't actively prefer Phoenix multi-card combos.

- [ ] **Step 3: Implement Phoenix multi-card preference in chooseLeadPlay**

In `packages/server/src/bot/bot.ts`, in the `chooseLeadPlay` method, add logic after the hand plan section (after line 1093) and before the go-out check (line 1096). This promotes Phoenix multi-card combos as leads:

```typescript
    // REQ-F-PHX10/PHX11: Prefer Phoenix in multi-card combos over holding for singleton
    if (hand.some((gc) => isPhoenix(gc.card))) {
      const phoenixMultiCombos = validPlays.filter(
        (c) => c.cards.length > 1 && !c.isBomb && c.cards.some((gc) => isPhoenix(gc.card)),
      );
      if (phoenixMultiCombos.length > 0) {
        // Prefer the largest combo (clears most cards), then lowest rank
        const best = phoenixMultiCombos.sort((a, b) => {
          if (b.cards.length !== a.cards.length) return b.cards.length - a.cards.length;
          return a.rank - b.rank;
        })[0];
        const phoenixEval = this.evaluatePhoenixPlay(best, null, hand);
        if (phoenixEval !== 'never') {
          return this.toDecision(best);
        }
      }
    }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd code && pnpm --filter @tichu/server test -- --run -t "Prefer Phoenix in multi-card"
```
Expected: Both tests PASS.

- [ ] **Step 5: Run full test suite for regressions**

```bash
cd code && pnpm --filter @tichu/server test -- --run
```
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/bot/bot.ts packages/server/tests/bot/bot.test.ts
git commit -m "feat(bot): actively prefer Phoenix in multi-card combos when leading

REQ-F-PHX10/PHX11: When leading and Phoenix is in hand, prefer the
largest valid multi-card combination containing Phoenix over holding
it for singleton use. Phoenix in a straight or full house extracts
more value than Phoenix as a singleton."
```

---

### Task 6: Full Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all server tests**

```bash
cd code && pnpm --filter @tichu/server test -- --run
```
Expected: All tests pass.

- [ ] **Step 2: Run full monorepo tests**

```bash
cd code && pnpm test -- --run
```
Expected: All tests pass across shared, server, and client.

- [ ] **Step 3: Type check**

```bash
cd code && pnpm typecheck
```
Expected: No type errors.

- [ ] **Step 4: Build all**

```bash
cd code && pnpm build
```
Expected: Build succeeds.

- [ ] **Step 5: Manual play test**

Start dev server with `bash scripts/dev-start.sh`. Play a game with bots:
1. Verify bots lead multi-card combos instead of splitting (watch for triple/pair leads)
2. Verify bots use Phoenix in straights/full houses when possible
3. Verify bots never play Phoenix single on low cards
4. Press browser back button during game — verify dialog appears
5. Cancel dialog — verify game continues normally
6. Confirm dialog — verify navigation to lobby
