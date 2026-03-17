# Specification: Fix Phoenix 'choose' Status Blocking Play Button

**Date:** 2026-03-17
**Branch:** bugfix/phoenix-choose-blocks-play-button
**Type:** Bugfix
**Confidence:** High

---

## Goal

Fix a catch-22 where selecting a 2+2+Phoenix full house (e.g. JJ+AA+Phoenix) disables
the Play button, making it impossible to complete the play. The Phoenix picker — which
resolves which rank the Phoenix takes — is triggered by clicking Play, but Play is
disabled because the picker hasn't run yet.

## Root Cause

`useCardSelection.ts` line 102 returns `canPlay = false` when
`phoenixResolution.status === 'choose'`. However, `handlePlay` in `page.tsx` (line 192)
intercepts `status === 'choose'` and shows the Phoenix picker — but only if `canPlay`
is `true`. The guard is redundant and counter-productive.

## Requirements

| ID | Type | Requirement | Acceptance Criteria |
|---|---|---|---|
| REQ-F-PH10 | F | `canPlay` MUST return `true` when `phoenixResolution.status === 'choose'` and `detectCombination` returns a non-null combination | JJ+AA+Phoenix on a full-house trick: Play button is enabled |
| REQ-F-PH11 | F | Clicking Play when `phoenixResolution.status === 'choose'` MUST open the Phoenix picker | Clicking Play shows picker with two rank options (existing page.tsx behavior — no change needed) |
| REQ-F-PH12 | F | `canPlay` MUST still return `false` when `phoenixResolution.status === 'invalid'` | Invalid Phoenix combos keep Play button disabled |
| REQ-F-PH13 | F | After choosing a rank in the picker, the play MUST be submitted with the correct `phoenixAs` value | Server receives `PLAY_CARDS` with `phoenixAs` matching the chosen rank |

## Scope

**In scope:**
- Remove the `if (phoenixResolution.status === 'choose') return false` guard from
  `useCardSelection.ts`

**Out of scope:**
- `phoenix-resolver.ts` — no changes
- `combination-detector.ts` — no changes
- `page.tsx` — no changes (existing `handlePlay` logic is already correct)
- Server code — no changes

## Edge Cases

- **Leading with 2+2+Phoenix (no trick):** Same fix applies — `filterChoicesByTrick`
  returns `'choose'` when leading; play button should be enabled.
- **Off-turn with 2+2+Phoenix:** Not a bomb — `canPlay` returns `combo.isBomb`
  (false) when `!isMyTurn`. Correctly stays disabled. No change needed.
- **`invalid` status:** Still blocked by the `status === 'invalid'` guard that remains.

## Risk

**Low.** The only consumer of `canPlay === true` that could accidentally submit a play
without Phoenix resolution is `handlePlay`, which already guards:
```typescript
if (selection.phoenixResolution.status === 'choose') {
  uiStore.showPhoenixPicker(...);  // shows picker, returns — never sends play
  return;
}
```
No play message reaches the server without a resolved `phoenixAs`.

## Files Modified

| File | Change |
|---|---|
| `code/packages/client/src/hooks/useCardSelection.ts` | Remove line 102: `if (phoenixResolution.status === 'choose') return false;` |

## Success Metrics

- Play button enabled for JJ+AA+Phoenix over an active full-house trick
- Phoenix picker appears on Play click with correct rank options
- Play submits with correct `phoenixAs` after picker selection
- All existing tests pass
- No regression in `canPlay === false` for genuinely invalid combos
