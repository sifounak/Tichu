# Implementation Plan: Auto-Pass Until Next Trick

**Date:** 2026-03-25
**Specification:** `specifications/2026-03-25-auto-pass-until-next-trick.md`
**Branch:** `feature/auto-pass-until-next-trick`

---

## Milestones

### Milestone 1: State Management + Auto-Pass Logic
**Requirements:** REQ-F-AP03, AP04, AP05, AP06, AP08, AP09, AP10, AP12

- 1A: Add `autoPassEnabled` state to `uiStore.ts`
- 1B: Add auto-pass useEffect to game page
- 1C: Add reset triggers (GAME_STATE, trick won, play cards, bomb, phoenix, wish, dragon)

### Milestone 2: UI Toggle + Styling
**Requirements:** REQ-F-AP01, AP02, AP07, AP11, REQ-NF-AP01, AP02, AP03

- 2A: Add toggle props + rendering to `ActionBar.tsx`
- 2B: Add toggle CSS to `ActionBar.module.css`
- 2C: Wire props from game page to ActionBar

### Milestone 3: Tests
**Requirements:** All REQ-F-AP* verification

- 3A: ActionBar component tests for toggle visibility, interaction, bomb independence

## Files Modified

| File | Change |
|------|--------|
| `code/packages/client/src/stores/uiStore.ts` | Add autoPassEnabled state |
| `code/packages/client/src/app/game/[gameId]/page.tsx` | Auto-pass effect, reset triggers, showAutoPass, props |
| `code/packages/client/src/components/game/ActionBar.tsx` | Toggle UI with new optional props |
| `code/packages/client/src/components/game/ActionBar.module.css` | Toggle styles |
| `code/packages/client/tests/components/game/ActionBar.test.tsx` | New test cases |
