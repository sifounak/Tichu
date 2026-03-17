# Conversation: Game Summary, Bomb Button, Dog Animation — Specification

**Date:** 2026-03-16
**Branch:** feature/game-summary-bomb-button-dog-anim
**Phase:** Specification

---

## Key Decisions

### Feature 1: Game Summary Dialog
- Replace existing `GameEndPhase` (shows only winner + scores) with a full stats dialog
- "You won!" / "You lost!" in large green/red font at top
- 2-column layout: "Your Team" (left, human player's team) | "Their Team" (right)
- Stats: Grand Tichu Won/Broken, Tichu Won/Broken, 1-2 Victories, Bombs
- Two buttons: "Leave Room" (left, navigates to `/`) and "Start New Game" (right, sends START_GAME)
- Requires extending `RoundScore` with `tichuResults` and `bombsPerTeam`
- Requires tracking bomb counts in `RoundState` during play

### Feature 2: Out-of-Turn Bomb Button
- New "Bomb!" button to the RIGHT of the card hand (mirrors Tichu button on left)
- Visible during `playing` phase whenever hand contains ≥1 bomb
- Single bomb → click plays immediately
- Multiple bombs → hover shows popup with mini card representations; click plays specific bomb
- Requires new `detectAllBombs(cards)` function in shared engine
- Server already supports out-of-turn bomb validation — no server changes needed

### Feature 3: Dog Animation Fix
- Root cause: `clearDogAnimation()` fires at t=1.0s, bomb window also expires at t=1.0s, but exit animation has internal `delay: 0.5s` → sweep runs t=1.5s–2.0s after gameplay already resumed
- Fix: Remove internal delay from exit; use `durations.trickSweep` for exit duration; set `dogAnimMs = (0.25 + 1.00) × multiplier × 1000`; set `dogBlockMs = (0.25 + 1.00 + 0.40) × multiplier × 1000`
- Dog pause time: 1.00s (changed from 0.25s by user during planning)
- Total at normal speed: 1.65s

## Requirements Summary
- REQ-F-GS01 through REQ-F-GS15: Game summary dialog
- REQ-F-BB01 through REQ-F-BB08: Bomb button
- REQ-F-DA02 through REQ-F-DA06: Dog animation fix
- REQ-NF-GS01, REQ-NF-BB01, REQ-NF-DA01, REQ-NF-GEN01: Non-functional

## Implementation Order (from plan)
1. Feature 3 (Dog fix) — 2 files, isolated
2. Feature 1 (Game summary) — type + server + client
3. Feature 2 (Bomb button) — new shared function + UI
