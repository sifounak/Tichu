# Tichu Web Game — Milestone 12: Gameplay UI

**Date:** 2026-03-11
**Phase:** Implementation (Phase 2, Milestone 12)

## Summary

Implemented the full interactive gameplay UI for the Tichu web client, building on the M11 client foundation. This milestone adds card selection with progressive filtering, action buttons, game phase UIs, and all interactive dialogs.

## Key Implementation Decisions

### Architecture
- **useCardSelection hook**: Central hook bridging shared engine's hand-filter with React UI state. Computes selectable/disabled card sets, Phoenix resolution, canPlay/canPass on every selection change.
- **Phase-based routing**: Game page renders different UIs based on GamePhase — PreGame phases (Grand Tichu, Tichu, Card Passing), Playing phase (table + hand + action bar), RoundEnd overlay, GameEnd overlay.
- **Shared engine reuse**: All game logic (hand filtering, Phoenix resolution, combination detection, pass validation) delegated to @tichu/shared — no logic duplication in client.

### Components Created
1. **useCardSelection** — Progressive filtering hook
2. **ActionBar** — Play/Pass/Tichu buttons with validity enforcement
3. **PhoenixValuePicker** — Rank selection dialog for ambiguous Phoenix
4. **TrickDisplay** — Per-seat card rendering in trick area with winner highlight
5. **PreGamePhase** — Grand Tichu, Tichu, and Card Passing UIs
6. **RoundEndPhase** — Score breakdown overlay
7. **GameEndPhase** — Final scores with round history
8. **DragonGiftModal** — Opponent selection for Dragon trick
9. **ScorePanel** — Team scores with expandable round history

### Store Updates
- Added `dragonGiftOptions`, `hasPlayedCards`, `latestRoundScore`, `gameOverInfo` to gameStore
- Added handlers for CARDS_PLAYED, GAME_OVER server messages

### Deferred
- **REQ-F-HV08 (Drag-and-drop)**: Deferred to M15 (polish). Click-to-select provides full functionality.

## Test Results
- 18 test files, 161 tests (76 new for M12)
- 92.68% statement coverage, 90.21% branch coverage
- All 220 server + shared tests continue to pass

## Requirements Addressed
- REQ-F-HV06: Prevent invalid plays via UI (Passed)
- REQ-F-HV07: Click-to-select interaction (Passed)
- REQ-F-HV09: Greyed-out card styling (Passed)
- REQ-F-DI01-DI07: All display indicators (Passed)
- REQ-F-HV08: Drag-and-drop (Deferred to M15)
