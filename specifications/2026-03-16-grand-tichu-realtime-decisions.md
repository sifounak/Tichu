# Specification: Grand Tichu Real-Time Decisions

**Date:** 2026-03-16
**Branch:** feature/grand-tichu-realtime-decisions
**Type:** Feature

---

## Goal

Make the Grand Tichu decision phase fully real-time. Each player sees every other player's decision (Grand Tichu call or pass) as soon as it is made — without waiting for all four players to decide. Bots make their Grand Tichu decision exactly 1 second after receiving their first 8 cards.

---

## Background

The server already broadcasts a full `GAME_STATE` message to all players after each `GRAND_TICHU_DECISION` is processed. The `ClientGameView` type already includes `grandTichuDecided: Seat[]` and each player's `tichuCall`. However:

1. `gameStore.ts` does not store `grandTichuDecided` — it is silently dropped in `applyGameState`.
2. `game/[gameId]/page.tsx` hardcodes `grandTichuDecided: []` in the local view construction.
3. `PreGamePhase.tsx` accepts `grandTichuDecided` and `otherPlayerCalls` props but never uses them in the Grand Tichu UI.
4. `bot-runner.ts` uses a 800–1500 ms random delay for all pre-game decisions; the user requires exactly 1000 ms for Grand Tichu.

---

## Requirements

### Functional

| ID | Description | Acceptance Criteria |
|----|-------------|---------------------|
| REQ-F-GT01 | When any player makes their Grand Tichu decision, all other connected players receive a broadcast immediately and see that player's status update. | After one player decides, other players' UI reflects the new status before the deciding player sees any confirmation response. |
| REQ-F-GT02 | `grandTichuDecided: Seat[]` is stored in `gameStore` and updated on every `GAME_STATE` broadcast. | `useGameStore().grandTichuDecided` reflects the server's `grandTichuDecided` array after each state sync. |
| REQ-F-GT03 | A player who has not yet decided sees the Grand Tichu buttons (Pass / Grand Tichu!) plus a per-player status row showing who has already decided and what they chose. | Status row is visible when `mySeat` is not in `grandTichuDecided`; it correctly distinguishes "decided" from "waiting". |
| REQ-F-GT04 | A player who has already decided sees a waiting screen showing their own decision and the status of every other player. | When `mySeat` is in `grandTichuDecided`, decision buttons are replaced with a waiting screen. |
| REQ-F-GT05 | Players who called Grand Tichu are visually distinguished from those who passed. | Grand Tichu callers show a distinct colour/label vs. passers. |
| REQ-F-GT06 | Bots make their Grand Tichu decision exactly 1000 ms after entering the `grandTichuDecision` state. | In production config, bot Grand Tichu timer fires at 1000 ms ± jitter-free. In test config (`INSTANT_CONFIG`), fires immediately. |
| REQ-F-GT07 | If `onStateChange` is triggered more than once while a bot's Grand Tichu timer is already pending, no additional timer is scheduled for that bot. | Only one Grand Tichu timer exists per bot per round, regardless of how many state broadcasts arrive. |

### Non-Functional

| ID | Description |
|----|-------------|
| REQ-NF-GT01 | No optimistic UI — all decision updates come from server `GAME_STATE` broadcasts only. |
| REQ-NF-GT02 | The waiting screen and status row must render without layout shift or flicker on state updates. |

---

## Out of Scope

- Regular Tichu decision phase real-time display (not requested)
- Bot timing changes for any phase other than Grand Tichu
- Spectator view updates

---

## Milestones

| # | Title | Files | Requirements |
|---|-------|-------|--------------|
| M1 | Data plumbing | `gameStore.ts`, `game/[gameId]/page.tsx` | REQ-F-GT02, REQ-NF-GT01 |
| M2 | Real-time UI | `PreGamePhase.tsx`, `PreGamePhase.module.css` | REQ-F-GT03, REQ-F-GT04, REQ-F-GT05, REQ-NF-GT02 |
| M3 | Bot timing | `bot-runner.ts` | REQ-F-GT06, REQ-F-GT07 |

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Multiple GAME_STATE broadcasts cause excessive re-renders | Low | Low | `PreGamePhase` is wrapped in `memo`; props are stable arrays |
| Bot fires multiple Grand Tichu decisions if timers stack | Medium | Low | Deduplication `Set<Seat>` in `handleGrandTichuPhase` |
| `grandTichuDecided` not reset between rounds | Low | Medium | `applyGameState` replaces the entire field; verified per-round in tests |

---

## Success Metrics

- All players see decision updates within one network round-trip after another player decides
- Bots decide at exactly 1000 ms in production mode, immediately in `INSTANT_CONFIG`
- No duplicate Grand Tichu events sent by bots
- ≥ 80% statement coverage on all new/modified code
