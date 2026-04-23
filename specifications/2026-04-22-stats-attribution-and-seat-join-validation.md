# Stats Attribution Correctness & Seat-Join Validation

**Type**: Bugfix + enforcement addition
**Date**: 2026-04-22
**Confidence**: High
**Derived from**: [plans/2026-04-20-stats-attribution-midgame.md](../plans/2026-04-20-stats-attribution-midgame.md)

---

## 1. Goal

Correct per-user statistics attribution so that mid-game seat changes (disconnect/bot takeover, host bot-swap, reconnect, voluntary leave + replacement) produce accurate per-user stats, AND introduce server-enforced seat-join validation so a user cannot ever occupy two different seats within the same game (thereby eliminating the class of edge cases that motivated the attribution bug at its root).

### Background

The room/game layer already supports mid-game player changes. The stats layer, however, assumes stable seat→user identity for the entire game, causing attribution errors in three places:

1. **Game-level counters** (`gamesPlayed`, `gamesWon`, `winRate`, `largestWinDiff`, `largestLossDiff`, `oneTwoWins/Against`, `gamesRequiringTieBreak`, `mostTieBreakRoundsNeeded`) are computed by filtering the `games` table on `{seat}_user_id`. That column stores only the **final seat occupant**, so a player who played 6 of 8 rounds and left gets zero game credit; their replacement gets full credit. ([stats-cache.ts:337-343](../code/packages/server/src/db/stats-cache.ts#L337-L343), [stats-cache.ts:456-504](../code/packages/server/src/db/stats-cache.ts#L456-L504))

2. **Per-play, per-trick, per-bomb, per-dog, per-dragon stats** are filtered by a `validGameSeat` set keyed on `gameId-seat`, with no round dimension. If users A and B shared one seat across different rounds of the same game, A gets credit for B's plays and vice versa. ([stats-cache.ts:404-408](../code/packages/server/src/db/stats-cache.ts#L404-L408), [stats-cache.ts:435](../code/packages/server/src/db/stats-cache.ts#L435))

3. **Per-round loop aggregates** (e.g., `oneTwoWins`, tie-break detection) walk every round of every game the user appears in, without checking whether the user actually played that specific round. A late joiner gets credited for 1-2 finishes that happened before they sat down.

### Separate-but-related concern

The existing room layer does not prevent a user from occupying multiple seats within the same game (e.g., leaving seat N, then later taking seat E as a spectator-promoted replacement). Allowing this creates (a) an unfair information advantage — seeing two hands' cards — and (b) makes attribution ambiguous at the edges. This spec introduces enforcement so the case becomes impossible by construction.

---

## 2. Scope

### In scope
- [code/packages/server/src/db/stats-cache.ts](../code/packages/server/src/db/stats-cache.ts) — rewrite of attribution joins in `computeStatsForUser`.
- [code/packages/server/src/room/room-handler.ts](../code/packages/server/src/room/room-handler.ts) and related modules (e.g., `seat-queue.ts`) — seat-join validation logic.
- Grace-period handling on disconnect — align existing behavior to the 1-minute involuntary-only rule (REQ-F-SJ12).
- One-shot DB wipe script (operator-run, committed under `code/packages/server/scripts/`).
- New unit/integration tests covering mid-game swap and seat-validation scenarios.
- Minimal client changes to surface the seat-claim rejection dialog + "claim original seat instead" action.

### Out of scope (follow-up specs)
- `relational_stats_cache` attribution — same class of bug, larger surface. File separately.
- Fractional credit / participation-weighted stats.
- UI badges for partial games.
- Schema changes to the `games` table (keeping "final occupant" semantics there).
- Capturing intra-round seat takeovers in `player_rounds` (accepted gap per F1 Option A — see Assumptions below).

---

## 3. Assumptions

- **A1**: `player_rounds` is the authoritative source for "who was seated at what seat for which round," with the row for `(game_id, round_number, seat)` written at round end reflecting the final user of that seat-round.
- **A2**: A user cannot sit on both teams in one game — **enforced by REQ-F-SJ04–SJ06** (previously a product rule, now an invariant).
- **A3**: `games.{seat}_user_id` reflects the final occupant at game end (not mid-game state).
- **A4**: Reconnection to the same seat produces `player_rounds` rows continuous with the pre-disconnect history (same `user_id`, same seat), so reconnection does not trigger mid-game-join heuristics.
- **A5**: Spectators see only the played-cards view, not any player's hand. Spectating alone confers no card knowledge, so spectators are not restricted by the seat-reclaim rule unless they previously held a seat in this game per REQ-F-SJ02.

---

## 4. Functional Requirements

### Group SA — Stats Attribution Correctness

| ID | Requirement |
|---|---|
| **REQ-F-SA01** | `gamesPlayed` shall increment for any user with ≥1 `player_rounds` row in that game. |
| **REQ-F-SA02** | `gamesWon` shall increment only when the user is the final seat occupant AND their team is the game winner. |
| **REQ-F-SA03** | `largestWinDiff` and `largestLossDiff` shall be credited only to final seat occupants (same gating as `gamesWon`). |
| **REQ-F-SA04** | Per-play stats (`plays` table) shall be filtered by exact `(game_id, round_number, seat)` tuples drawn from the user's `player_rounds` rows. |
| **REQ-F-SA05** | Per-bomb stats (`bomb_inventory`) shall be filtered by the same tuple rule. The `bomb_events` table, if used for user-attributed stats, shall also follow this rule (verified during planning). |
| **REQ-F-SA06** | Dragon-trick stats (`tricks.winner_seat`) shall be filtered by the same tuple rule. |
| **REQ-F-SA07** | Dog-play stats (`dog_play_events.player_seat`) shall be filtered by the same tuple rule. |
| **REQ-F-SA08** | Dragon-gift stats (`dragon_gift_events.gifter_seat`, `.recipient_seat`) shall be filtered by the same tuple rule. |
| **REQ-F-SA09** | `oneTwoWins` / `oneTwoAgainst` shall only accumulate for rounds the user actually played. |
| **REQ-F-SA10** | `gamesRequiringTieBreak` / `mostTieBreakRoundsNeeded` shall credit a user only if the user played at least one of the tie-break rounds. (Cumulative-score computation still walks all rounds; credit is gated on participation.) |
| **REQ-F-SA11** | The team used for round-level team-aware aggregates shall be derived from the seat the user occupied during the rounds they played. (Single team per user per game is guaranteed by REQ-F-SJ04–SJ06.) |
| **REQ-F-SA12** | `gamesForfeited` shall increment when the user has ≥1 `player_rounds` row in the game AND is NOT the final seat occupant. Applies regardless of whether the team ultimately won. |
| **REQ-F-SA13** | `gamesJoinedAfterSpectating` shall increment when the user IS the final seat occupant AND `min(round_number)` for that user in that game is > 1. (Reconnection to a previously held seat does not trigger this counter because the user's minimum round number is preserved.) |
| **REQ-F-SA14** | As part of this deployment, existing game-history and stats data shall be wiped from tables: `games`, `game_rounds`, `player_rounds`, `plays`, `tricks`, `bomb_inventory`, `bomb_events`, `dog_play_events`, `dragon_gift_events`, `wish_events`, `stats_cache`, `relational_stats_cache`, `player_global_stats`. User accounts (`users`) and active room/session state (`active_games`, `active_rooms`) shall be preserved. |
| **REQ-F-SA15** | For any user in any game, at most one of `gamesWon` or `gamesForfeited` increments. The two counters are disjoint subsets of `gamesPlayed`; the remainder is final-occupant losses (not a stored counter). |

### Group SJ — Seat-Join Validation

| ID | Requirement |
|---|---|
| **REQ-F-SJ01** | The seat-join validation rule shall engage from the moment round-1 cards are first dealt in a game. Before that point, existing unrestricted seat-claim logic applies. |
| **REQ-F-SJ02** | For seat-join validation, user U is considered a "previous occupant" of seat S in game G iff a `player_rounds` row exists matching `(game_id = G, seat = S, user_id = U)`. This signal is tied to round completion; a user who was dealt cards mid-round and replaced before round-end may not appear in `player_rounds` and is therefore treated as a non-occupant for this rule. This limitation is accepted (aligns with REQ-F-SA01 — both layers use the same data and behave consistently). |
| **REQ-F-SJ03** | If the user has no `player_rounds` row in this game, the seat claim shall proceed through existing unrestricted validation. |
| **REQ-F-SJ04** | If the user previously occupied seat S in this game and is attempting to claim seat S, the claim shall be allowed. If seat S is currently held by a bot, the bot shall be displaced (same semantics as host bot-swap). |
| **REQ-F-SJ05** | If the user previously occupied seat S in this game and seat S is currently held by another human player B, the claim shall be rejected. The rejection payload shall include the reason and B's display name with instruction to wait. |
| **REQ-F-SJ06** | If the user previously occupied seat S in this game and is attempting to claim a different seat T (T ≠ S), the claim shall be rejected. The rejection payload shall include the reason *"already seen seat S's cards"* and: (a) if seat S is empty, an offer to claim seat S; (b) if seat S is held by a human, that human's display name with instruction to wait; (c) if seat S is held by a bot, an offer to claim seat S (bot will be displaced). |
| **REQ-F-SJ07** | The client shall surface the server's rejection payload to the user as a dialog and shall expose the "claim seat S instead" action when offered. |
| **REQ-F-SJ08** | During ordered seat-queue processing, ineligible spectators (those who previously occupied a different seat per REQ-F-SJ02) shall be silently skipped — no offer emitted — and the queue shall advance to the next spectator. Server logs shall record the skip for debugging. |
| **REQ-F-SJ09** | Spectator order shall be preserved across queue processing. Skipping an ineligible spectator or having an eligible spectator decline an offer does not change any spectator's position in the list. After queue processing completes, the spectator list — minus any spectator who accepted and became a player — remains in its original relative order. |
| **REQ-F-SJ10** | If the ordered queue is exhausted without acceptance, the seat shall enter a "free-for-all" state where any spectator or lobby joiner may attempt to claim it (subject to REQ-F-SJ04–SJ06). |
| **REQ-F-SJ11** | In free-for-all, an ineligible user who attempts a claim shall receive a dialog with the exact text: *"You are ineligible to take the empty seat because you previously sat in a different seat during this game. You must wait for your previous seat to become available before you can join the game."* |
| **REQ-F-SJ12** | When a user disconnects while seated, the seat shall be held for a 1-minute grace period applicable only to involuntary disconnections (network failures, WebSocket drops, client crashes, server restarts/updates). During the grace period, in-memory reconnection preserves the seat without routing through seat-claim validation. |
| **REQ-F-SJ13** | The grace period shall NOT apply when a user voluntarily leaves via the "Leave" action or is removed via kick (host or vote). In those cases the seat is released immediately. If the grace period elapses or the seat is otherwise released, and the seat is subsequently claimed by another player before the original user returns, the original user has lost the seat and must go through normal spectator/queue processes on their return (and remains subject to REQ-F-SJ04–SJ06). Existing reconnect/disconnect code shall be aligned to this specification where it diverges. |

---

## 5. Non-Functional Requirements

| ID | Requirement |
|---|---|
| **REQ-NF-SA01** | No database schema changes. No new columns, tables, or indexes. |
| **REQ-NF-SA02** | No changes to the WebSocket protocol shape, REST API surface, or client UI beyond what REQ-F-SJ07 requires (the seat-claim rejection dialog). |
| **REQ-NF-SA03** | All pre-existing stats-cache tests shall continue to pass unchanged (clean-game regression guard). |
| **REQ-NF-SA04** | Statement coverage ≥ 80% for `computeStatsForUser` after changes. |
| **REQ-NF-SA05** | SQL row-value IN syntax `(a, b, c) IN (SELECT …)` requires SQLite ≥ 3.15. Implementation shall verify the runtime SQLite version meets this, or use an equivalent JS-side filter. |
| **REQ-NF-SJ01** | Enforcement of seat-join validation is server-authoritative. The client may pre-filter seat options for UX but is not the source of truth. |
| **REQ-NF-SJ02** | The seat-validation rule shall apply uniformly across all seat-claim entry points: lobby-based join, spectator-queue promotion, and post-kick rejoin. |
| **REQ-NF-SJ03** | Statement coverage ≥ 80% for new/modified seat-validation code paths in `room-handler.ts` and related modules. |

---

## 6. Risks

| ID | Risk | Likelihood / Impact | Mitigation |
|---|---|---|---|
| **R1** | SQLite row-value IN tuple syntax unsupported at runtime | Low / High | REQ-NF-SA05 runtime check; fallback to JS-side filter |
| **R2** | Intra-round leaver's card holding not captured in `player_rounds` → user gets no credit AND is unrestricted on return | Medium / Low | Accepted per F1 Option A; release-note mention; follow-up spec if needed |
| **R3** | Seat-validation accidentally blocks legitimate auto-reconnect | Low / High | Defensive design: rule permits reclaim of original seat; test both reconnect and fresh-claim paths |
| **R4** | Queue "silent skip" leaves ineligible spectators confused | Low / Low | Server log (REQ-F-SJ08); no UX work in this spec |
| **R5** | Existing grace-period behavior diverges from 1-minute involuntary-only rule | Medium / Medium | Planning verifies current behavior; code aligned to spec per user decision |
| **R6** | One-shot DB wipe is irreversible; operator error | Low / High | Wipe script committed with clear preconditions; operator runs explicitly |
| **R7** | Round-persistence failure mid-crash leaves `player_rounds` incomplete → stats wrong, reclaim rule breaks | Low / High | Existing crash-recovery path (from stats redesign) assumed correct; verified during planning |
| **R8** | Intra-round takeover scenarios hard to construct in test fixtures | Medium / Low | Known test gap; indirect coverage via round-boundary tests |

---

## 7. Success Metrics

1. All pre-existing `stats-cache.test.ts` tests pass unchanged.
2. All new stats-attribution test scenarios pass (see §8 acceptance criteria).
3. All new seat-validation test scenarios pass (see §8 acceptance criteria).
4. Statement coverage ≥ 80% for both `computeStatsForUser` (REQ-NF-SA04) and new seat-validation code (REQ-NF-SJ03).
5. Manual end-to-end smoke: a 4-player game exercising mid-game bot takeover, spectator-queue promotion, an attempted cross-seat reclaim, and an involuntary disconnect+reconnect — all produce correct stats and correct join behavior.
6. `typecheck` and `lint` clean across all affected packages.
7. DB wipe script (REQ-F-SA14) executes cleanly: targeted tables empty; `users` preserved; active rooms/sessions unaffected.

---

## 8. Acceptance Criteria

### Stats Attribution (SA)

| REQ | Verification |
|---|---|
| SA01–SA03 | Unit: user has `player_rounds` rows for rounds 1–4, `games.{seat}_user_id ≠ user`. Assert `gamesPlayed=1`, `gamesWon=0`, `largestWinDiff=0`, `largestLossDiff=0`. |
| SA04–SA08 | Unit: two users share seat N across rounds (A rounds 1–4, B rounds 5–8). Assert each user's plays/bombs/dragon/dog/tricks reflect only their own rounds. |
| SA09–SA10 | Unit: user holds `player_rounds` only for rounds 5–8; game had 1-2 finish in round 2 and tie-break. Assert `oneTwoWins=0`, `gamesRequiringTieBreak` credited only if user played a tie-break round. |
| SA11 | Implicit — team-aware aggregates are correct in mid-game-leaver fixtures. |
| SA12 | Unit: user has `player_rounds` row, not final seat occupant. Assert `gamesForfeited=1` (regardless of team outcome). |
| SA13 | Unit: user IS final seat occupant, `min(round_number)=3`. Assert `gamesJoinedAfterSpectating=1`. Reconnection-after-round-1 does not trigger. |
| SA14 | Operator runs wipe script; targeted tables empty; `users` intact; active rooms/sessions unaffected. |
| SA15 | Property-test sweep across fixtures: for each user/game pair, assert `gamesWon` and `gamesForfeited` never both increment. |

### Stats Attribution — Non-Functional (SA)

| REQ | Verification |
|---|---|
| NF-SA01 | `git diff` shows no changes to `schema.ts` or `connection.ts` CREATE TABLE blocks. |
| NF-SA02 | No changes in `@tichu/shared` protocol types, REST routes, or client UI files beyond REQ-F-SJ07 dialog wiring. |
| NF-SA03 | `pnpm --filter @tichu/server test` green on the full pre-existing suite. |
| NF-SA04 | Coverage report shows `computeStatsForUser` ≥ 80% statement coverage. |
| NF-SA05 | Runtime check confirms SQLite ≥ 3.15, or row-value IN syntax is replaced by equivalent JS-side filter. |

### Seat Join (SJ)

| REQ | Verification |
|---|---|
| SJ01 | Integration: before round-1 deal, any seat claim succeeds. After deal, validation engages. |
| SJ03 | Unit/integration: user with no `player_rounds` row in game G → claim succeeds at any open seat. |
| SJ04 | Integration: user A previously at seat N, N currently empty → reclaim succeeds. N held by bot → reclaim succeeds, bot displaced. |
| SJ05 | Integration: A previously at seat N, N held by human B → claim rejected; rejection payload includes B's display name. |
| SJ06 | Integration: A previously at seat N, attempts seat T — rejected with *"already seen seat N's cards"*. Three sub-tests: (a) N empty → offer includes N; (b) N held by human → offer names current occupant; (c) N held by bot → offer includes N (bot displaces on accept). |
| SJ07 | Client unit/integration: rejection payload renders as dialog; "claim seat S instead" action exposed and wired. |
| SJ08 | Integration: queue of 4 spectators, 2 ineligible. Expect 2 silent skips (no offers emitted); logged at server (R4 mitigation). |
| SJ09 | Integration: exercise skip/decline/accept combinations; assert spectator list order preserved post-processing (minus the accepting spectator, if any). |
| SJ10–SJ11 | Integration: queue exhausted → seat enters free-for-all; ineligible user attempts claim → receives the REQ-F-SJ11 dialog text verbatim. |
| SJ12 | Integration: involuntary WS drop — seat held for 1 minute; reconnect within window restores seat without re-claim. |
| SJ13 | Integration: (a) voluntary Leave — seat released immediately; (b) kick — seat released immediately; (c) grace period elapsed then another player claims → original user's return subject to REQ-F-SJ04–SJ06. |

### Seat Join — Non-Functional (SJ)

| REQ | Verification |
|---|---|
| NF-SJ01 | Test: forged client message bypassing pre-filter → server rejects the claim. |
| NF-SJ02 | Integration: same validation outcome for lobby-join, queue-promotion, and post-kick rejoin paths (parameterized test). |
| NF-SJ03 | Coverage report shows ≥ 80% statement coverage for new/modified seat-validation modules. |

---

## 9. Verification Methods

- **Unit tests** (vitest): stats-cache attribution logic; pure-function seat-eligibility checks.
- **Integration tests** (vitest + test harness): WebSocket join flows, queue processing, reconnect scenarios.
- **Coverage** (vitest `--coverage`): enforced thresholds.
- **Manual smoke test**: documented checklist run on dev server before PR merge.
- **Operational verification**: DB wipe script output check.

---

## 10. Confidence

**High**. Every functional requirement has a concrete verification method. The data model is grounded in actual code inspection. Scope boundaries are explicit. Policy decisions are user-approved at every branch point. Invariants and assumptions are stated. Risks identified with mitigations. No internal conflicts.

### Deferred to planning (not spec gaps)

1. **Grace-period current implementation** — planning reads existing reconnect/disconnect code and aligns it to REQ-F-SJ12–SJ13.
2. **`bomb_events` table attribution** — planning confirms whether this table requires tuple-filter treatment.
3. **Seat-claim rejection message shape** — follows existing WebSocket error conventions.
