# Implementation Plan: Uncontested Singles Defense & Partner Tichu Support

## Context

The expert bot (M1-M12) lacks two strategic behaviors: it passively accepts opponents winning cheap single tricks, and it has minimal active support for partner's Tichu/Grand Tichu calls. This plan adds M13 (Uncontested Singles Defense) and M14 (Partner Tichu Support) as milestones M5-M7 on the existing `feature/expert-bot-strategy-update` branch.

**Specification:** `specifications/2026-03-27-expert-bot-partner-support.md`

## Critical Files

- `code/packages/server/src/bot/expert-bot.ts` — Main ExpertBot class (1437 lines)
- `code/packages/server/src/bot/bot-strategy-utils.ts` — Shared utilities
- `code/packages/server/tests/bot/expert-bot.test.ts` — Tests (Vitest)

## Key Design Decision: Detecting Uncontested Singles

`roundState.players[seat].tricksWon` stores `GameCard[][]`. Each entry = all cards from a won trick. If entry has exactly 1 card → it was an uncontested single (only 1 play made, all others passed). Track `lastTricksWonCounts` per seat to detect new entries between `choosePlay` calls.

## Key Design Decision: PTS03 Escalation

Instead of complex pass detection, use a simple heuristic: if the bot keeps getting the lead back when partner has GT/T, partner didn't take over. Escalate the combo type each time the bot leads again. Track `ptsLeadCount` (number of consecutive PTS leads). Reset when partner takes the lead or round changes.

---

## Milestone 5: Uncontested Singles Defense (REQ-F-USD01, USD02, USD03)

### New State Fields (reset on round change)
```
uncontestedSingleCounts: Record<Seat, number>  // per-opponent counter
uncontestedSingleLastRank: Record<Seat, number> // last uncontested single rank per opponent
lastTricksWonCounts: Record<Seat, number>       // for detecting new entries
lastSeenTrickType: CombinationType | null        // for counter reset on non-single
```

### New Methods

**`updateUncontestedSingleTracking(roundState, seat)`** — Called from `choosePlay` after card tracker update.
- Track current trick type from `currentTrick?.plays[0]?.combination.type`
- If non-Single type detected, reset all `uncontestedSingleCounts`
- Compare `tricksWon.length` vs `lastTricksWonCounts` for each opponent
- New entry with length 1 → increment counter, store rank
- Update `lastTricksWonCounts`

**`getUSDComboBreak(hand, validPlays, roundState, seat)`** → `Combination | null` — Called from `chooseFollowPlay` when opponent is winning a single trick.
- Check if any opponent meets threshold: 2 uncontested wins with rank < 11, or 1 win with rank < 12 if partner GT/T (USD03)
- Find weakest breakable multi-card hand (pair > triple > fullHouse > longer) whose freed card beats the current trick rank
- Search `validPlays` for the freed single card
- Return the single play, or null

### Integration Points
- `choosePlay` line ~451: call `updateUncontestedSingleTracking` after card tracker
- `chooseFollowPlay` line ~1193: insert USD check before "win with minimum force" — only when following on a single trick and opponent is winning
- Round reset block (line ~437): reset all USD state

### Tests (~10)
- Counter increments on uncontested single win
- Counter resets on non-single trick type
- Counter resets on new round
- No break at 1 uncontested (threshold 2)
- Break pair to contest at 2 uncontested < Jack
- No break when rank >= Jack
- Break priority: pair before triple
- USD03: threshold 1 when partner GT/T
- USD03: rank threshold < Queen when partner GT/T
- No break when freed card can't beat opponent rank

---

## Milestone 6: Partner Tichu Lead Support (REQ-F-PTS01, PTS02, PTS03)

### New State Fields (reset on round change)
```
ptsConsecutiveLeads: number     // how many times bot led consecutively during PTS
```

### New Methods

**`hasPartnerTichuCall(roundState, seat)`** → `boolean` — Helper checking partner's tipiCall.

**`choosePTSLeadPlay(validPlays, hand, roundState, seat)`** → `BotPlayDecision | null`
- PTS01: If Dog in validPlays → play Dog immediately
- PTS02: If no Dog → lead lowest single
- PTS03: If `ptsConsecutiveLeads >= 1` → partner didn't take control. Escalate:
  - 1st re-lead → lowest pair
  - 2nd re-lead → lowest triple
  - 3rd re-lead → lowest straight or whatever is available
  - Fallthrough: if no combo of escalated type exists, try next type or fall to normal
- Increment `ptsConsecutiveLeads` after each PTS lead
- Reset `ptsConsecutiveLeads` when partner leads (detected: `currentTrick === null && lastLeader !== seat`)

### Integration Points
- `chooseLeadPlay` line ~943: Insert PTS lead check AFTER bomb-proof exit but BEFORE existing Dog/shouldSaveDog block. This ensures PTS overrides the "save Dog for partner Tichu" logic in `shouldSaveDog` (line 846).
- Round reset block: reset `ptsConsecutiveLeads`

### Critical Interaction: shouldSaveDog Conflict
Existing `shouldSaveDog` returns `true` when partner called Tichu (line 846), which PREVENTS Dog play. PTS01 requires the OPPOSITE. Fix: PTS lead check in `chooseLeadPlay` comes BEFORE the shouldSaveDog block, so Dog gets played before shouldSaveDog is ever reached.

### Tests (~9)
- PTS01: Leads Dog when partner called Tichu
- PTS01: Leads Dog when partner called Grand Tichu
- PTS02: Leads lowest single when no Dog and partner GT/T
- PTS03: Escalates to pair on 2nd PTS lead
- PTS03: Escalates to triple on 3rd PTS lead
- PTS03: Resets on round change
- PTS03: Falls through to normal if no combo of escalated type
- Integration: PTS Dog overrides shouldSaveDog
- Negative: No PTS behavior without partner GT/T call

---

## Milestone 7: Partner Follow, Go-Out Suppression, Overplay (REQ-F-PTS04, PTS05, PTS06, PTS07)

### New Methods

**`shouldSuppressGoOut(roundState, seat, hand, validPlays)`** → `boolean` — PTS05/PTS06 combined.
- If no partner GT/T → return false
- If partner already out → return false
- PTS06 check: both partner AND opponent called Tichu, partner 8+ cards, opponent 3 or fewer, bot meets "very high chance" → return false (allow go-out to nullify)
- Otherwise → return true (suppress)

**`isVeryHighGoOutChance(hand, validPlays, opponentCardCount)`** → `boolean` — PTS06 criteria.
- (a) 3 or fewer cards AND all winners (Ace, Dragon, in bomb)
- (b) Winners + multi-card combo rank >= 10 or combo length > opponentCardCount, with a backup winner

**`getPartnerTrickRank(currentTrick)`** → `number | null` — Extract partner's winning rank for PTS07.

### Modifications

**`chooseFollowPlay`** — Multiple changes:
1. **PTS07 (before partner-winning pass):** When partner winning AND no partner GT/T, check if cheapest play has rank diff <= 4 and partner rank < 10. If so, play over partner.
2. **PTS04 (after partner-winning check):** When partner GT/T and opponent winning, play to win (minimum force, but don't pass when normally would).
3. **PTS05 (all go-out checks):** Wrap `canGoOut` with `!shouldSuppressGoOut` in:
   - `chooseFollowPlay` lines 1173-1174 and 1180-1182
   - `chooseLeadPlay` line 976
   - `chooseOneTwoPreventionPlay` line 903
   - Do NOT suppress in `chooseEndgamePlay` (endgame overrides PTS)

### Tests (~13)
- PTS04: Aggressive follow when partner GT/T, opponent leading
- PTS04: Does NOT aggressively follow when no partner GT/T
- PTS05: Suppresses go-out in follow when partner Tichu
- PTS05: Suppresses go-out in lead when partner Tichu
- PTS05: Does NOT suppress when partner already out
- PTS06: Allows go-out — partner+opponent Tichu, partner 8+ cards, opponent 3 cards, bot 3 winners
- PTS06: Allows go-out — bot has strong multi-card (rank 10+) + backup
- PTS06: Blocks go-out — partner has 7 cards (not 8+)
- PTS06: Blocks go-out — opponent has 4 cards (not 3 or fewer)
- PTS07: Plays over partner's 5 with a 9 (diff=4, rank < 10)
- PTS07: Passes on partner's 10 (rank >= 10)
- PTS07: Passes when diff > 4
- PTS07: Passes when partner called Tichu (PTS01-05 apply instead)

---

## RTM Updates

Add all REQ-F-USD01-03 and REQ-F-PTS01-07 to `specifications/RTM-expert-bot-strategy-update.md` with milestone assignments M5/M6/M7.

## Verification

After each milestone:
1. `npx vitest run code/packages/server/tests/bot/expert-bot.test.ts` — all tests pass
2. Coverage check for new code >= 80%
3. Existing tests do not regress
