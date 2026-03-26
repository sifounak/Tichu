# Auto-Pass Until Next Trick — Implementation (Milestones 1-3)

**Date:** 2026-03-25
**Phase:** Implementation (Phase 2)

## Summary

Implemented all 3 milestones for the client-only auto-pass feature.

## Milestone 1: State + Logic
- Added `autoPassEnabled` boolean + `setAutoPassEnabled` to uiStore
- Added auto-pass useEffect with 350ms delay, guards for dragon gift, trick leadership, wish enforcement
- Added trick-won reset via prevTrickRef watching currentTrick → null
- Added GAME_STATE sync reset in handleMessage
- Added reset in all 5 play handlers: handlePlay, handleBomb, handleBombPlay, handlePhoenixChoice, handleWishChoice

## Milestone 2: UI Toggle + Styling
- Added optional props to ActionBar: autoPassEnabled, onAutoPassToggle, showAutoPass
- Rendered styled label+hidden checkbox toggle in splitLeft (before Pass button)
- CSS: autoPassLabel, autoPassActive (gold accent), autoPassCheckbox (hidden)
- Computed showAutoPass in game page: playing && !spectator && !finished && !showReceivedCards
- Wired all props from game page to ActionBar

## Milestone 3: Tests
- 6 new ActionBar tests: toggle hidden by default, rendered when shown, unchecked default, click callback, checked state, bomb independence
- All 16 ActionBar tests pass
- TypeScript compiles cleanly

## Test Results
- ActionBar.test.tsx: 16/16 passed
- TypeScript: no errors
- Pre-existing failures in GameEndPhase, PreGamePhase, server room-handler (unrelated)
