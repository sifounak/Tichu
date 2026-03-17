# Specification: Game Summary Dialog, Out-of-Turn Bomb Button, Dog Animation Fix

**Version:** 1.0
**Date:** 2026-03-16
**Status:** Approved
**Confidence:** High — All requirements are clear, directly mapped to existing code, non-conflicting, and fully testable. Implementation plan approved by user.

---

## 1. Goal

Implement three distinct gameplay and UI enhancements:

1. **Game Summary Dialog** — Replace the minimal `GameEndPhase` component with a rich end-of-game stats dialog that shows the outcome ("You won!" / "You lost!"), per-team statistics across all rounds, and navigation actions.

2. **Out-of-Turn Bomb Button** — Add a "Bomb!" button to the right of the player's hand that auto-detects all valid bomb combinations and allows playing a bomb without manual card selection, including out of turn.

3. **Dog Animation Fix** — Correct the dog card animation sequence so the card visibly enters the play area, rests for 1 second, sweeps to the target player, and gameplay resumes only after the sweep completes — matching normal trick animation behavior.

---

## 2. Context & Background

- **Game stack:** TypeScript monorepo — `shared` (engine/types), `server` (XState + Node.js), `client` (Next.js + Framer Motion).
- **Game summary gap:** `GameEndPhase.tsx` currently shows only the winner label and final scores. `RoundScore` does not carry tichu results or bomb counts.
- **Bomb button gap:** Players can only play bombs by manually selecting cards and hitting Play. When it is not their turn, the Play button is disabled — there is no out-of-turn bomb shortcut.
- **Dog animation bug:** `clearDogAnimation()` fires at t=1.0s and the bomb window also expires at t=1.0s, but the exit animation in `TrickDisplay` has an internal `delay: 0.5s`, so the sweep runs from t=1.5s to t=2.0s — after gameplay has already resumed.

---

## 3. Requirements

### 3.1 Functional Requirements — Feature 1: Game Summary Dialog

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| REQ-F-GS01 | On game over, display a full-screen modal overlay | Must | `GameEndPhase` renders when `phase === GamePhase.GameOver` |
| REQ-F-GS02 | Top of dialog shows "You won!" (green) or "You lost!" (red) in large font | Must | Text matches outcome; color matches CSS variable for success/error |
| REQ-F-GS03 | 2-column stat layout: "Your Team" (left) / "Their Team" (right), determined by `mySeat` | Must | Columns align with human player's team and opponent team |
| REQ-F-GS04 | Stats per team: Grand Tichu Won / Broken (e.g. `2 / 1`) | Must | Counts match tichuResults across all rounds in roundHistory |
| REQ-F-GS05 | Stats per team: Tichu Won / Broken (e.g. `3 / 0`) | Must | Counts match tichuResults across all rounds in roundHistory |
| REQ-F-GS06 | Stats per team: 1-2 Victories (rounds where oneTwoBonus === team) | Must | Count matches sum of `oneTwoBonus === myTeam` across roundHistory |
| REQ-F-GS07 | Stats per team: Bombs played count | Must | Count matches sum of `bombsPerTeam[team]` across roundHistory |
| REQ-F-GS08 | Final cumulative scores displayed | Must | Matches `finalScores` passed to component |
| REQ-F-GS09 | "Leave Room" button (left) navigates to home page | Must | `router.push('/')` is called on click |
| REQ-F-GS10 | "Start New Game" button (right) sends `START_GAME` WebSocket message | Must | `onNewGame()` callback is called on click |
| REQ-F-GS11 | `RoundScore` extended with `tichuResults: Record<Seat, { call: TichuCall; won: boolean } \| null>` | Must | Type compiles; all consumers updated |
| REQ-F-GS12 | `RoundScore` extended with `bombsPerTeam: Record<Team, number>` | Must | Type compiles; all consumers updated |
| REQ-F-GS13 | `RoundState` extended with `bombsPerTeam: Record<Team, number>`, initialized to `{northSouth:0, eastWest:0}` each round | Must | Increments correctly during a round |
| REQ-F-GS14 | `bombsPerTeam[getTeam(seat)]` is incremented in the `playCards` action whenever `combination.isBomb === true` | Must | After a bomb play, the counter for the bomber's team increases by 1 |
| REQ-F-GS15 | `scoreRound()` accepts `bombsPerTeam` parameter and includes `tichuResults` and `bombsPerTeam` in its return value | Must | Computed values match expected test cases |

### 3.2 Functional Requirements — Feature 2: Out-of-Turn Bomb Button

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| REQ-F-BB01 | Add `detectAllBombs(cards: GameCard[]): Combination[]` to shared engine | Must | Returns all valid four-of-a-kind and straight-flush-bomb sub-sequences |
| REQ-F-BB02 | "Bomb!" button appears to the right of the player's hand during `playing` phase when hand has ≥1 bomb | Must | Button is visible; positioned `left: 100%` relative to hand container |
| REQ-F-BB03 | Button is hidden when hand has no bombs or phase is not `playing` | Must | Button not present in DOM when hand is bomb-free |
| REQ-F-BB04 | Single bomb in hand: clicking button immediately sends `PLAY_CARDS` with that bomb's card IDs | Must | Server receives the play; no popup shown |
| REQ-F-BB05 | Multiple bombs in hand: hovering the button reveals a popup showing mini card representations of each bomb option | Must | Popup visible on hover; each option shows the bomb's cards at reduced size |
| REQ-F-BB06 | Clicking a bomb option in the popup plays that specific bomb via `PLAY_CARDS` | Must | Correct card IDs sent for the selected bomb |
| REQ-F-BB07 | Straight-flush sub-sequences are fully enumerated: a run of N cards yields all contiguous sub-sequences of length 5..N | Must | A 6-card same-suit run produces 3 bomb options |
| REQ-F-BB08 | Four-of-a-kind bomb uses exactly 4 cards of the same rank (first 4 found if >4 available, though not possible in Tichu) | Must | Always 4 cards; no more |

### 3.3 Functional Requirements — Feature 3: Dog Animation Fix

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| REQ-F-DA02 | Dog card entry spring animation uses `duration: durations.cardPlay` to respect animation speed setting | Must | At "fast" speed, entry completes faster proportionally |
| REQ-F-DA03 | Dog card rests visibly in play area for 1.0s × `animMultiplier` before the exit animation begins | Must | `clearDogAnimation` timer fires at `(0.25 + 1.00) × animMultiplier × 1000` ms |
| REQ-F-DA04 | Dog card sweep (exit) uses `duration: durations.trickSweep` with no internal delay | Must | Exit animation starts immediately when `clearDogAnimation()` fires |
| REQ-F-DA05 | Gameplay is blocked (bomb window active) for the full `(0.25 + 1.00 + 0.40) × animMultiplier` seconds | Must | No card can be played until after sweep completes |
| REQ-F-DA06 | Existing behavior preserved: animation skips entirely when only bots are active | Must | `humanStillActive` check unchanged |

### 3.4 Non-Functional Requirements

| ID | Requirement | Category | Acceptance Criteria |
|----|-------------|----------|---------------------|
| REQ-NF-GS01 | Stats dialog uses existing CSS variables (`--color-success`, `--color-error`, `--font-display`, etc.) | Usability | No hardcoded colors outside CSS variables |
| REQ-NF-BB01 | Bomb button style is visually consistent with the Tichu button (same size, border-radius, font) | Usability | Visual comparison; same 84×84px square button style |
| REQ-NF-DA01 | All dog animation timing constants scale with `animMultiplier` | Maintainability | "slow" (1.5×) and "fast" (0.5×) speeds produce proportional timings |
| REQ-NF-GEN01 | TypeScript strict mode — no new `any` types introduced | Maintainability | `tsc --noEmit` passes with zero new errors |

### 3.5 Constraints

- TypeScript strict mode throughout; no `any` escapes
- No new npm dependencies — use existing Framer Motion, Zustand, React
- Server-side game logic stays in XState state machine; client is projection-only
- Out-of-turn bomb validation already handled by server `move-handler.ts` — no server play-validation changes

### 3.6 Assumptions

- `getTeam(seat)` from `shared/src/types/game.ts` correctly maps seat → team (verified in code)
- Each standard card in a Tichu deck has a unique rank+suit combination — no duplicates possible, so `detectAllBombs` four-of-a-kind logic can use first 4 found without ambiguity
- `animMultiplier` is `0` when animation is "off", which causes 0ms timers — existing behavior preserved for this case (skip animation entirely via the `animEnabled` guard)

---

## 4. Scope

### 4.1 In Scope

- `GameEndPhase.tsx` and `GameEndPhase.module.css` redesign
- `RoundScore` and `RoundState` type extensions
- `scoreRound()` signature and return value changes
- Bomb tracking in `game-state-machine.ts` `playCards` action
- `detectAllBombs()` shared function
- Bomb button UI in `page.tsx`
- Dog animation timing fixes in `TrickDisplay.tsx` and `page.tsx`

### 4.2 Out of Scope

- Database schema changes (existing `game-persistence.ts` stats are unaffected)
- Server-side play validation changes (bomb-out-of-turn already supported)
- Spectator view changes
- Mobile/touch support for the bomb popup (desktop hover only)
- Adding bomb stats to the per-player database stats table

---

## 5. Edge Cases & Boundary Conditions

| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| EC-001 | No tichu calls in any round | Grand Tichu and Tichu rows show `0 / 0` for both teams |
| EC-002 | No bombs played in any round | Bombs row shows `0` for both teams |
| EC-003 | Player's partner called and broke tichu in same round | Broken count for myTeam increments by 1 |
| EC-004 | 1-2 finish by opponents | "Their Team" 1-2 Victories increments; "Your Team" does not |
| EC-005 | Player has a 7-card straight flush in hand | `detectAllBombs` returns sub-sequences of length 5, 6, and 7 (multiple options) |
| EC-006 | Dog played when partner has already finished | Dog passes to next active player; animation still plays to the correct target |
| EC-007 | Animation speed set to "off" | Dog animation skipped entirely (existing `animEnabled` guard); gameplay unblocks immediately |
| EC-008 | Bomb button clicked out of turn when no active trick | Server rejects with "Not your turn"; client shows error toast |
| EC-009 | Player finishes (plays last card) as a bomb out of turn | Server handles finish check; bomb button disappears as hand becomes empty |

---

## 6. Risks & Concerns

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|-----------|
| R-001 | `RoundScore` type change breaks existing tests or consumers | Medium | Medium | Update all type usages; run full test suite after type changes |
| R-002 | `detectAllBombs` misses sub-sequences for longer straight flushes | Low | Medium | Unit test with 5-, 6-, 7-card same-suit runs |
| R-003 | Dog animation timer and bomb window disagree due to floating point | Low | Low | Use same constant expressions for both timers |
| R-004 | Framer Motion exit animation ignores `duration` override when element is removed simultaneously | Low | Medium | Test visually; fallback to `onAnimationComplete` callback if needed |

---

## 7. Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Game summary shows correct stats | 100% accuracy across test scenarios | Manual play-through + unit tests on stat computation |
| Bomb button appears/disappears correctly | Button present iff hand has bomb during playing phase | Component test + manual verification |
| Dog animation sequence is correct | Entry → 1s pause → sweep, gameplay resumes after sweep | Visual inspection at normal/slow/fast speeds |
| Type safety | Zero new TypeScript errors | `tsc --noEmit` |
| Statement coverage for new code | ≥ 80% | Coverage report |

---

## 8. Files to Modify

| File | Change |
|------|--------|
| `shared/src/types/game.ts` | Add `tichuResults`, `bombsPerTeam` to `RoundScore`; add `bombsPerTeam` to `RoundState` |
| `shared/src/engine/scoring.ts` | Add `tichuResults` computation; accept + return `bombsPerTeam` |
| `shared/src/engine/combination-detector.ts` | Add `detectAllBombs()` |
| `shared/src/engine/index.ts` | Export `detectAllBombs` |
| `server/src/game/game-state-machine.ts` | Init `bombsPerTeam` in round state; increment on bomb plays; pass to `scoreRound` |
| `client/src/components/phases/GameEndPhase.tsx` | Full redesign with 2-col stats layout |
| `client/src/components/phases/GameEndPhase.module.css` | New styles for 2-col layout, win/loss colors, stat rows, buttons |
| `client/src/app/game/[gameId]/page.tsx` | Pass `mySeat` + `onLeaveRoom` to GameEndPhase; add bomb button + handler |
| `client/src/components/game/TrickDisplay.tsx` | Fix dog entry duration; remove exit delay; use `durations.trickSweep` |

---

## 9. Open Questions

None — all requirements confirmed with user during planning session.
