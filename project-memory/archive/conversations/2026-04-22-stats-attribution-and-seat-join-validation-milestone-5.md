# M5 Milestone Transcript — Client Rejection Dialog

**Date**: 2026-04-23
**Branch**: `bugfix/stats-attribution-midgame`
**Milestone**: M5 of 5 — Client Rejection Dialog
**Requirements**: REQ-F-SJ07; closes M5 slice of REQ-NF-SA02, REQ-NF-SJ02, REQ-NF-SJ03

---

## Summary

M5 delivers the client-side dialog that surfaces the `SEAT_CLAIM_REJECTED` payloads emitted by M2+M3 server enforcement. The dialog renders the server-authored `reason` text and — when the server sets `offerClaimOriginal=true` — a one-click "Claim {originalSeat} instead" action that dispatches `CLAIM_SEAT` with the user's previously-held seat.

The component is driven entirely by a `seatClaimRejection` slice on the `uiStore` that the WebSocket message handler populates on `SEAT_CLAIM_REJECTED`. The dialog is rendered from two places:

1. **Pre-room (PreRoomView)** — for rejections that arrive while the user is in the lobby/pre-game state (spectator CLAIM_SEAT, JOIN_ROOM mid-game auto-seat, CHOOSE_SEAT).
2. **In-game page root** — for rejections that arrive while the user is viewing the main game board (mid-game spectator promotion attempts, free-for-all attempts on the SpectatorOverlay path).

Both render the same `SeatClaimRejectedDialog` component with the same callbacks; the uiStore is the single source of truth. Closing the dialog (Close button, backdrop click, or claim-original action) clears the store slice.

## Key Decisions

- **Standalone presentational component, not a render-prop factory**. `LeaveConfirmDialog` uses a render-prop "openDialog" pattern because it *owns* its own open-state (it's triggered by a nearby button). `SeatClaimRejectedDialog` is different: the dialog is opened by an *inbound server message*, not by a local user click. Treating `rejection: Rejection | null` as a controlled prop is the natural fit — render when non-null, return null otherwise — and it makes testing trivial (render with a mock rejection, assert, done).
- **`uiStore` slice, not local component state**. A local `useState` in PreRoomView would not survive the pre-room → in-game transition (e.g., a rejection fires right as a seat becomes available and the user transitions), and the in-game path needs the same state independently. The store slice also makes the message-handler code path simple: `setSeatClaimRejection(payload)` is a one-liner.
- **Render the dialog in two places, deliberately**. An alternative was to hoist it to a single top-level portal in `page.tsx`, which would avoid duplication. But the pre-room and in-game branches are mutually exclusive early-return paths in `page.tsx`; each has its own JSX tree. Rendering the dialog at each branch root is exactly one line at each site, matches the existing `VoteOverlay` / `SpectatorOverlay` pattern, and keeps the branches self-contained.
- **`CLAIM_SEAT` already accepts an optional `seat`**. Verified in `packages/shared/src/types/protocol.ts:58` — no protocol change needed for the "claim original" action. Server's `handleClaimSeat` in `room-handler.ts:1026` dispatches to the same eligibility check, so claiming the original seat is subject to the same rules (which will accept it under SJ04 since it IS the user's original seat).
- **Portal to `document.body`** (matching `LeaveConfirmDialog`) rather than a relative overlay, so the dialog stacks above any other UI (game board, spectator overlays, chat). `z-index: 100` matches the LeaveConfirmDialog convention.
- **Accessibility**: `role="dialog"`, `aria-modal="true"`, `aria-label="Seat claim rejected"` — consistent with existing dialogs and meaningful to screen readers.
- **Backdrop dismiss with `stopPropagation` on the inner panel**. Standard modal pattern — click outside to close, click inside to interact. Explicitly tested for both directions (click backdrop → dismiss; click inside → no dismiss).

## Test Coverage

**Unit tests** (`tests/components/game/SeatClaimRejectedDialog.test.tsx`, 9 tests):
1. null rejection → nothing rendered (no portal, empty container).
2. Reason text from server is displayed verbatim.
3. "Claim {originalSeat} instead" button appears when `offerClaimOriginal=true`.
4. "Claim {originalSeat} instead" button is absent when `offerClaimOriginal=false`.
5. Clicking "Claim" invokes `onClaimOriginal(originalSeat)` AND `onClose` — the close is the caller's cue to clear the store.
6. Clicking Close invokes `onClose` only.
7. Backdrop click dismisses via `onClose`.
8. Inner-panel click does NOT dismiss (stopPropagation).
9. Seat-label + reason update correctly when the rejection prop changes between renders (rerender case).

**Store tests** (`tests/stores/uiStore-seatClaimRejection.test.ts`, 4 tests):
1. Initial state is null.
2. `setSeatClaimRejection` stores the payload verbatim.
3. `clearSeatClaimRejection` resets to null.
4. A subsequent `setSeatClaimRejection` replaces the prior payload.

**Coverage** (v8):
- `SeatClaimRejectedDialog.tsx`: 100% statements / 77.77% branches / 100% funcs. The two uncovered branches are the `typeof document === 'undefined'` SSR guard and the null-rejection short-circuit; both are exercised once in the positive direction but not branch-covered for both legs (the SSR branch is untestable in jsdom by design).
- `uiStore.ts`: 97.27% statements — the new `seatClaimRejection` slice is fully covered.
- PreRoomView + page.tsx wiring are pass-through (prop forwarding + single render) — the logic under test lives in the new dialog component and the new uiStore slice, both of which exceed the 80% gate.

**Test suite**: 211/211 client tests pass (up from 198 pre-M5: +13 from this milestone). Server suite unchanged at 812/812. Total project tests: 1023.

**Typecheck**: clean on both packages.

**Lint**: `eslint` binary still missing (pre-existing repo issue documented in memory `project_remaining_cleanup.md`, accepted through M1–M4).

## Files Changed

| File | Change |
|---|---|
| `code/packages/client/src/components/game/SeatClaimRejectedDialog.tsx` | **NEW** — presentational dialog for REQ-F-SJ07 |
| `code/packages/client/src/stores/uiStore.ts` | Added `seatClaimRejection` slice + setters |
| `code/packages/client/src/app/game/[gameId]/page.tsx` | Handle `SEAT_CLAIM_REJECTED` → populate store; render dialog at in-game root; wire to PreRoomView |
| `code/packages/client/src/components/game/PreRoomView.tsx` | New optional props + render `SeatClaimRejectedDialog` |
| `code/packages/client/tests/components/game/SeatClaimRejectedDialog.test.tsx` | **NEW** — 9 dialog behavior tests |
| `code/packages/client/tests/stores/uiStore-seatClaimRejection.test.ts` | **NEW** — 4 store slice tests |
| `specifications/RTM-stats-attribution-and-seat-join-validation.md` | SJ07 → Passed; upgraded NF-SA02/SJ02/SJ03 from sliced-Passed to Passed with M5 refs |
| `documentation/codebase-index.md` | Added SeatClaimRejectedDialog row + SEAT_CLAIM_REJECTED protocol line |
| `results/Milestone5/tests/test-results.json` | Archived vitest JSON |

## Results Archive

- `results/Milestone5/tests/test-results.json` — vitest JSON for 25 client test files, 211 passing tests.
