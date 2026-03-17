# M3: Out-of-Turn Bomb Button — Conversation Transcript

**Date:** 2026-03-16
**Branch:** feature/game-summary-bomb-button-dog-anim
**Milestone:** M3 — Out-of-Turn Bomb Button (REQ-F-BB01–BB08, REQ-NF-BB01)

## Summary

Resumed implementation after context clear. M1 (dog animation) and M2 (game summary) were already committed. This session implemented M3.

## Key Decisions

1. **`detectAllBombs()` placement** — Added as an exported function at the end of `combination-detector.ts`, reusing the existing private `detectFourBomb` and `detectStraightFlushBomb` helpers directly (same file scope). No new barrel/index file needed — `shared/src/index.ts` already does `export *` from combination-detector.

2. **Bomb button position** — Placed as an absolutely positioned element to the RIGHT of the CardHand container (left: '100%', marginLeft: '48px'), exactly mirroring the Tichu button on the left. Inline in `page.tsx`, not a separate component.

3. **Multi-bomb popup** — State-driven (React `useState(bombPopupOpen)`) with `onMouseEnter`/`onMouseLeave` handlers, not CSS `:hover`, since conditional rendering requires React state. Popup appears above the button (bottom: '100%').

4. **Popup labels** — Four-of-a-kind shown as `4× {rank}`, straight-flush as `SF {length}: {minRank}–{maxRank}`.

5. **Pre-existing TS errors** — Several pre-existing TypeScript errors in ActionBar, PreGamePhase, useBombWindow, and lobby page were present before M3 and not introduced by this work.

## Test Results

- `combination-detector.test.ts`: 69 passed (58 pre-existing + 11 new detectAllBombs tests)
- No new TypeScript errors introduced
- Pre-existing protocol.test.ts failures (roomName schema) unchanged

## Files Changed

- `code/packages/shared/src/engine/combination-detector.ts` — Added `detectAllBombs()` export
- `code/packages/client/src/app/game/[gameId]/page.tsx` — Added bomb button UI, handBombs memo, handleBombPlay handler, bombPopupOpen state
- `code/packages/shared/tests/engine/combination-detector.test.ts` — 11 new tests for `detectAllBombs`
- `documentation/ui-ux-changes-inventory.md` — Added entry 65
- `specifications/RTM-game-summary-bomb-button-dog-anim.md` — All BB* rows updated to Passed
