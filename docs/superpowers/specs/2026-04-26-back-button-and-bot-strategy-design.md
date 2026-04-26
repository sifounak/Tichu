# Back Button Navigation & Bot Strategy Improvements

**Date**: 2026-04-26
**Scope**: Client-side navigation fix + Server-side bot AI improvements
**Files affected**: Game page (`page.tsx`), Bot AI (`bot.ts`, `bot-strategy-utils.ts`)

---

## Change 1: Back Button Triggers Leave Game Dialog

### Problem

When a user presses the browser back button during a game, the app navigates away from the game page, the component unmounts, the WebSocket disconnects, and the server treats it as a forfeit. The player is then redirected back to the game, creating a confusing flash of the lobby page.

### Requirements

| ID | Requirement |
|---|---|
| REQ-F-BB01 | When a non-spectator presses the browser back button while on the game page during an active game, intercept the navigation and show the Leave Game confirmation dialog instead of navigating away |
| REQ-F-BB02 | If the user confirms leaving, send `LEAVE_ROOM`, clean up state, and navigate to `/lobby` |
| REQ-F-BB03 | If the user cancels, restore the browser history state so the URL remains on the game page and the game continues uninterrupted |
| REQ-F-BB04 | Spectators are exempt: back button navigates normally for spectators |
| REQ-F-BB05 | When no game is in progress (pre-room, game-end phase), back button navigates normally |

### Design

**Approach**: Use a `popstate` event listener in the game page component.

1. On mount (when game is active and user is not a spectator), push a sentinel state onto the history stack via `history.pushState()` so the back button has an entry to pop.
2. Listen for the `popstate` event. When fired:
   - Push the current URL back onto the history stack (to restore the URL)
   - Open the `LeaveConfirmDialog`
3. The dialog's `onConfirm` handler calls the existing `handleLeaveGame` flow.
4. The dialog's cancel/dismiss does nothing (state is already restored).
5. Clean up the listener on unmount.

**State management**: The `LeaveConfirmDialog` currently uses a render-prop pattern where the child calls `openDialog()`. To trigger it from the `popstate` handler, we'll add an `externalOpen` prop (boolean) to `LeaveConfirmDialog` that, when true, opens the dialog. The game page manages this via a `backButtonDialogOpen` state variable.

### Edge Cases

- **Rapid back-button presses**: Each press re-pushes the sentinel and re-opens the dialog. The dialog is already open, so this is a no-op visually.
- **Back button on pre-room view**: `gameInProgress` is false, so the listener is inactive. Normal navigation occurs.
- **Back button during game-end phase**: `gameInProgress` is false. Normal navigation.

---

## Change 2: Bot Prefers Multi-Card Plays Over Singles

### Problem

Bots split up cards that belong to multi-card combinations and play them as singles. For example, a bot with three Jacks will play them one at a time across three separate tricks instead of leading a triple Jack. This happens because the lead play logic only checks if a single card has a same-rank multi-card combo available, not whether the card participates in *any* multi-card combination (straights, full houses, etc.).

### Requirements

| ID | Requirement |
|---|---|
| REQ-F-MC01 | When leading, a bot must not play a card as a single if that card participates in any valid multi-card combination (pair, triple, straight, full house, consecutive pairs) in the current valid plays |
| REQ-F-MC02 | The bot should prefer multi-card combinations that consume the most cards (e.g., prefer a straight of 5 over a triple of 3) when choosing between multi-card plays involving the same card |
| REQ-F-MC03 | A card is considered "truly singleton" only if no valid multi-card combination in the current valid plays contains it |

### Design

**Location**: `chooseLeadPlay()` in `bot.ts`, lines 1110-1160.

**Current logic** (line 1132-1141): Checks `isCardInMultiCardCombo()` and then looks for a multi-card combo of the **same rank**. If found, skips the single.

**New logic**: Replace the same-rank check with a broader check:
1. For each single card in the ranked plays, check if that card's `id` appears in *any* multi-card (non-bomb) combination in `validPlays`.
2. If it does, skip the single entirely. The multi-card combo will be reached later in the iteration (or already was, since larger combos at the same rank sort first).
3. This ensures cards that are part of straights, full houses, or consecutive pairs are never played as singles when the multi-card play is available.

**`isCardInMultiCardCombo` utility**: Already exists. The change is in how the *follow-up* logic works — instead of looking for a multi-card combo of the same rank, we look for any multi-card combo containing the card's `id`.

### Impact on Existing Strategy

- **Hand plan losers-to-lead**: The hand plan already classifies combos. This change only affects the fallback loop (lines 1110-1160) which runs after hand plan losers are exhausted.
- **Aces**: Ace pairs are already handled with special logic (line 1124). Aces that are part of a straight will now be preserved for the straight instead of being played as singles.
- **Phoenix**: Phoenix singles are already skipped in leads (line 1122). No interaction.

---

## Change 3: Phoenix Strategy Improvements

### Problem

**3a**: Bots don't actively prioritize Phoenix in multi-card combinations. The Phoenix is a powerful wildcard that can turn stray singles into a straight, upgrade two pairs into a full house, etc. Currently the code prevents bad Phoenix plays but doesn't promote good ones.

**3b**: When bots do play Phoenix as a single, they sometimes play it at absurdly low values (e.g., Phoenix over Mah Jong = 1.5). The current cascading guard only blocks Phoenix singles when higher ranks are unaccounted for, but doesn't enforce a minimum floor.

### Requirements

| ID | Requirement |
|---|---|
| REQ-F-PHX10 | When leading, the bot should actively prefer combinations that include the Phoenix over combinations that don't, all else being equal, because Phoenix in a multi-card combo extracts more value than Phoenix as a singleton |
| REQ-F-PHX11 | When leading, if the bot has a valid multi-card combination containing Phoenix, it should not hold the Phoenix for singleton use unless the multi-card combo would be evaluated as 'never' by other Phoenix rules |
| REQ-F-PHX12 | When following with a single card, the bot may only play Phoenix over the highest unaccounted standard rank (excluding Dragon). If all Aces are unaccounted, Phoenix can only be played over an Ace. If all Aces are accounted for, Phoenix can only be played over a King. And so on down the ranks. |
| REQ-F-PHX13 | Hard floor: the bot must never play Phoenix as a single card on top of any card with rank below Queen (rank 12), regardless of card accounting, with exactly two exceptions: (a) it is the bot's last card, or (b) it is the bot's second-to-last card and the remaining card guarantees going out on the next trick |
| REQ-F-PHX14 | The Mah Jong wish cannot force a player to play the Phoenix as a single card. If the bot must use Phoenix to satisfy a wish, it must be as part of a multi-card combination. This is a game rule, not a bot strategy rule — no code change needed in bot strategy, but document for clarity. |

### Design

#### 3a: Promote Phoenix in Multi-Card Combos (Lead Play)

**Location**: `chooseLeadPlay()` in `bot.ts`.

In the hand plan creation (`createHandPlan`), when the Phoenix is present:
- Flag combinations that include Phoenix as `phoenixEnhanced`
- In the loser-to-lead ranking, give a small bonus to Phoenix-enhanced multi-card combos (they clear the Phoenix productively)

In the main lead loop (lines 1110-1160):
- When evaluating multi-card combos, if a Phoenix-enhanced combo is available and its `evaluatePhoenixPlay` returns 'acceptable' or 'neutral', prefer it over a non-Phoenix combo of similar rank/type.

#### 3b: Strict Phoenix Singleton Rules (Follow Play)

**Location**: `evaluatePhoenixPlay()` in `bot.ts`.

Replace the current REQ-F-PHX01a cascading guard with stricter logic:

```
function evaluatePhoenixSingleton(lastCardRank, hand, cardTracker):
  remainingAfterPhoenix = hand.filter(not Phoenix)

  // Exception (a): last card
  if remainingAfterPhoenix.length === 0:
    return 'acceptable'

  // Exception (b): second-to-last, guaranteed out next
  if remainingAfterPhoenix.length === 1:
    lastCard = remainingAfterPhoenix[0]
    if isDragon(lastCard) or isHighWinner(lastCard):
      return 'acceptable'

  // Hard floor: never below Queen
  if lastCardRank < 12:
    return 'never'

  // Must be played over the highest unaccounted rank
  highestUnaccounted = cardTracker.getHighestUnaccountedStandardRank()
  if lastCardRank < highestUnaccounted:
    return 'never'

  return 'acceptable'
```

**Card tracker addition**: Add `getHighestUnaccountedStandardRank()` method to `card-tracker.ts` that returns the highest standard rank (14 down to 2) that still has unaccounted cards.

**Interaction with existing rules**: This replaces REQ-F-PHX01a and REQ-F-PHX03a. The other rules (PHX02a, PHX05-09) remain unchanged as they cover multi-card combos.

### Edge Cases

- **Only play is Phoenix single on a 5**: Bot passes (if it can) or plays if forced. The 'never' evaluation triggers non-Phoenix alternatives or pass.
- **Phoenix is last card**: Always acceptable regardless of rank underneath.
- **Phoenix second-to-last, other card is a low single**: Not guaranteed out → hard floor applies.
- **All standard ranks above 10 are accounted for**: `getHighestUnaccountedStandardRank()` returns something <= 10. Hard floor of Queen still prevents play below Queen, so bot must pass or use Phoenix in a combo instead.

---

## Testing Strategy

### Change 1 (Back Button)
- Manual browser testing: press back during active game, verify dialog appears
- Verify cancel restores game state
- Verify confirm navigates to lobby
- Verify spectator back button navigates normally
- Verify pre-room/game-end back button navigates normally

### Change 2 (Multi-Card Preference)
- Unit tests in `bot.test.ts`: hand with triple Jacks should lead triple, not single Jack
- Unit tests: hand with Jack in a straight should not play Jack as single
- Regression: hands where singles are the only option still work

### Change 3 (Phoenix Strategy)
- Unit tests: Phoenix single on Mah Jong → 'never'
- Unit tests: Phoenix single on 10 → 'never' (below Queen floor)
- Unit tests: Phoenix single on Ace (Aces unaccounted) → 'acceptable'
- Unit tests: Phoenix single on King (Aces all played) → 'acceptable'
- Unit tests: Phoenix single on Queen (Kings and Aces all played) → 'acceptable'
- Unit tests: Phoenix single on Queen (Kings unaccounted) → 'never' (not highest unaccounted)
- Unit tests: Phoenix as last card on any rank → 'acceptable'
- Unit tests: Phoenix second-to-last with Dragon remaining → 'acceptable'
- Unit tests: Phoenix in straight preferred over Phoenix singleton in lead
- Regression: all existing Phoenix multi-card evaluations still pass

---

## Out of Scope

- Server-side handling of LEAVE_ROOM (already works correctly)
- Bot following-play multi-card preference (only leading is addressed — following already uses minimum-force ranking)
- Phoenix behavior in the Mah Jong wish system (game rule, not bot strategy)
