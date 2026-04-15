# Partner Tichu Call Safeguard

## Problem

In Tichu, both partners on a team can independently call Grand Tichu or Tichu. In the web app, simultaneous or accidental double-calls lack the visual cues of in-person play, making it easy for teammates to unknowingly stack risky bets. This feature adds a server-side safeguard that warns humans and blocks bots when a partner has already called.

## Requirements

### Functional

- **FR-01**: When a player attempts to call Grand Tichu or Tichu and their partner has already called Grand Tichu or Tichu (`tichuCall !== 'none'`), the server rejects the call with a `PARTNER_ALREADY_CALLED` error that includes the partner's call level.
- **FR-02**: The partner check applies regardless of call combination — Grand Tichu vs Tichu, Tichu vs Grand Tichu, or matching calls.
- **FR-03**: The partner check does NOT apply when a player passes/declines Grand Tichu — only when actively calling.
- **FR-04**: Human players who receive `PARTNER_ALREADY_CALLED` see a confirmation dialog informing them of their partner's call, with "Cancel" (default/focused) and "Call [X] Anyway" options.
- **FR-05**: If the human clicks "Call Anyway", the client re-sends the same message with `partnerOverride: true`, which the server accepts without the partner check.
- **FR-06**: If the human clicks "Cancel" during the Grand Tichu phase, a Grand Tichu pass is sent instead.
- **FR-07**: If the human clicks "Cancel" during card passing or playing phase (regular Tichu), the dialog simply dismisses with no further action.
- **FR-08**: Bot players who attempt to call Grand Tichu and receive `PARTNER_ALREADY_CALLED` must send a Grand Tichu pass instead.
- **FR-09**: Bot players who attempt to call regular Tichu and receive `PARTNER_ALREADY_CALLED` silently drop the call attempt and continue their normal game flow (card passing or trick play) unaffected.
- **FR-10**: The `partnerOverride` flag is optional and defaults to `false`/absent. Only human re-submissions after confirmation should set it to `true`.

### Non-Functional

- **NFR-01**: No additional round-trips beyond the rejection + re-send for the override case.
- **NFR-02**: Bot rejection handling must not introduce additional delay or disrupt bot timing.

## Design

### Protocol Changes

**`GRAND_TICHU_DECISION`** message — add optional field:
```typescript
{ type: 'GRAND_TICHU_DECISION', call: boolean, partnerOverride?: boolean }
```

**`TICHU_DECLARATION`** message — add optional field:
```typescript
{ type: 'TICHU_DECLARATION', partnerOverride?: boolean }
```

Both Zod schemas updated to accept the new optional boolean.

### Server — MoveHandler

**`handleGrandTichuDecision(seat, call, partnerOverride?)`**:
1. Existing validations (phase check, already-decided check) remain unchanged.
2. New guard (only when `call === true`): look up partner via `getPartner(seat)`, read `partner.tichuCall`.
3. If `partner.tichuCall !== 'none'` and `partnerOverride !== true`: return `{ ok: false, error: 'PARTNER_ALREADY_CALLED', partnerCall: partner.tichuCall }`.
4. Otherwise: proceed to send the XState event as before.

**`handleTichuDeclaration(seat, partnerOverride?)`**:
1. Existing validations (phase check, hasPlayed check, already-called check) remain unchanged.
2. New guard: same partner check as above.
3. If rejected: return `{ ok: false, error: 'PARTNER_ALREADY_CALLED', partnerCall: partner.tichuCall }`.
4. Otherwise: proceed normally.

### Server — GameHandler

Update message routing to pass `partnerOverride` from the parsed client message through to MoveHandler methods.

### Server — BotRunner

**Grand Tichu phase** — when a bot decides to call GT:
1. BotRunner sends the GT call event to MoveHandler.
2. If MoveHandler returns `PARTNER_ALREADY_CALLED`, BotRunner sends a GT pass event instead.

**Regular Tichu (card passing / playing phase)** — when a bot decides to call Tichu:
1. BotRunner sends the Tichu call to MoveHandler.
2. If MoveHandler returns `PARTNER_ALREADY_CALLED`, BotRunner silently drops the call. No pass or skip is sent — the bot continues its normal card-passing or trick-playing flow.

No changes to bot strategy implementations (`RegularBot`, `HardBot`, `ExpertBot`). The safeguard is enforced at the server level; bots simply respect the rejection.

### Client — Error Handling

**New `MoveResult` error code**: The client must distinguish `PARTNER_ALREADY_CALLED` from generic errors. The server error response includes `partnerCall: 'tichu' | 'grandTichu'` so the dialog can name the partner's specific call.

### Client — Confirmation Dialog

A reusable confirmation dialog component (or inline modal) shown when the client receives `PARTNER_ALREADY_CALLED`.

**Dialog content:**
> Your partner has already called **[Grand Tichu / Tichu]**.
> Calling [Grand Tichu / Tichu] as well is risky.
>
> [Cancel] (default, focused) | [Call {Grand Tichu / Tichu} Anyway]

**Trigger points:**
- **Grand Tichu phase** (`PreGamePhase.tsx`): after clicking "Grand Tichu!" and receiving the rejection.
- **Card Passing / Playing phase** (`ActionBar.tsx`): after clicking the Tichu call button and receiving the rejection.

### Affected Files

| Layer | File | Change |
|-------|------|--------|
| Shared | `types/protocol.ts` | Add `partnerOverride?` to `GRAND_TICHU_DECISION` and `TICHU_DECLARATION` schemas |
| Server | `game/move-handler.ts` | Add partner check guard to `handleGrandTichuDecision` and `handleTichuDeclaration` |
| Server | `game/game-handler.ts` | Pass `partnerOverride` from parsed message to MoveHandler |
| Server | `bot/bot-runner.ts` | Handle `PARTNER_ALREADY_CALLED` rejection for GT (send pass) and Tichu (drop call) |
| Client | `components/phases/PreGamePhase.tsx` | Show confirmation dialog on GT rejection |
| Client | `components/game/ActionBar.tsx` | Show confirmation dialog on Tichu rejection |
| Client | New: confirmation dialog component or inline modal | Reusable partner-call warning UI |

### Edge Cases

- **Both partners call simultaneously before either is processed**: The server processes messages sequentially per game (single GameManager). The first call succeeds; the second hits the partner check. This is the core scenario the feature addresses.
- **Partner called Grand Tichu, player tries regular Tichu (or vice versa)**: The guard fires on any non-`'none'` partner call regardless of level. The dialog names the partner's specific call level.
- **Bot partner called, human tries to call**: Same flow — human gets the dialog.
- **Human partner called, bot tries to call**: Bot gets rejected and obeys.
