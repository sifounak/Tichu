# Milestone 4: Client UI — Spinner Overlay + State Restoration

## Date: 2026-05-18

## Summary

Added UI layer for reliable action delivery: spinner overlay after 3s without ACK, pre-action snapshot capture, and state restoration on NACK/timeout.

## Key Decisions

1. **onResolved signature includes snapshot** — Changed PendingActionManager to pass the stored snapshot directly in the `onResolved` callback, so the game page can restore state without needing to look it up separately.
2. **ActionSpinner as absolute overlay** — Positioned over the action bar container (both mobile and desktop). Uses inline styles consistent with other overlays (WaitingForReconnectOverlay pattern).
3. **captureSnapshot helper** — Simple `useCallback` in the game page that reads current `selectedCardIds` and `autoPassEnabled` from uiStore at send time.
4. **restoreSnapshot in uiStore** — Converts `number[]` back to `Set<CardId>` for `selectedCardIds`.
5. **CSS keyframes via inline style tag** — Avoids needing a CSS module for a single `@keyframes spin` rule.

## Files Created
- `code/packages/client/src/components/game/ActionSpinner.tsx` — Spinner overlay component

## Files Modified
- `code/packages/client/src/stores/uiStore.ts` — Added `pendingActionSpinner`, `setPendingActionSpinner`, `restoreSnapshot`
- `code/packages/client/src/services/PendingActionManager.ts` — Updated `onResolved` to pass snapshot
- `code/packages/client/src/hooks/useWebSocket.ts` — Updated `onResolved` callback type
- `code/packages/client/src/app/game/[gameId]/page.tsx` — Wired callbacks, snapshot capture, ActionSpinner render
- `code/packages/client/tests/services/PendingActionManager.test.ts` — Updated for new signature, added snapshot tests

## Test Results
- 17/17 PendingActionManager tests pass
- 11/11 useWebSocket tests pass
- 8/8 uiStore tests pass
- Typecheck clean across all packages

## Requirements Addressed
- REQ-F-RAD07: Spinner overlay after 3s
- REQ-F-RAD08: Restore pre-action UI state + error toast on failure
- REQ-F-RAD10: ACK clears spinner (complete)
- REQ-F-RAD11: NACK restores state + shows error (complete)
- REQ-F-RAD13: Pre-action UI snapshot capture
