# Specification Conversation — Stats Attribution & Seat-Join Validation

**Date**: 2026-04-22
**Branch**: `bugfix/stats-attribution-midgame`
**Spec**: [specifications/2026-04-22-stats-attribution-and-seat-join-validation.md](../specifications/2026-04-22-stats-attribution-and-seat-join-validation.md)
**Source plan**: [plans/2026-04-20-stats-attribution-midgame.md](../plans/2026-04-20-stats-attribution-midgame.md)

---

## Key Decisions

### Scope framing
- Bugfix scope expanded from stats-only to include **seat-join validation enforcement** after the user recognized that preventing the "user on both teams in one game" scenario at the room layer would eliminate a class of edge cases at the root.
- Decision: one spec with two requirement groups (SA for Stats Attribution, SJ for Seat Join), implemented in a single feature branch with two milestone groups.

### Stats attribution policy (user-approved in plan, re-confirmed here)
- `gamesPlayed`: +1 for any user with ≥1 `player_rounds` row in the game.
- `gamesWon`: +1 only when user is final seat occupant AND their team won.
- `largestWinDiff` / `largestLossDiff`: only to final occupants.
- Per-event stats: attributed by `(game_id, round_number, seat)` tuple.
- Per-round loop aggregates: only credit rounds the user played.
- Team derivation for round-level aggregates: from the seat the user occupied during played rounds.

### New counters populated
- `gamesForfeited`: user has ≥1 `player_rounds` row but is NOT final seat occupant. Triggers regardless of team outcome.
- `gamesJoinedAfterSpectating`: user IS final seat occupant AND `min(round_number) > 1`. Reconnection preserves min round, so reconnects don't trigger this counter.
- Both columns exist in the DB schema but were hardcoded to 0 — now properly populated.

### Player definition (seat-join validation)
- A user is a "previous occupant" of seat S in game G iff a `player_rounds` row exists matching `(game_id = G, seat = S, user_id = U)`.
- Accepted limitation (F1 Option A): `player_rounds` is written at round end with the user who finished the round. Intra-round seat takeover (user A holds cards, leaves mid-round, user B finishes) is NOT captured — only B appears. A loses stats credit AND is unrestricted on return. Accepted because:
  - The attribution layer and the seat-validation layer use the same signal → consistent behavior.
  - Intra-round takeover is a rare edge case.
  - Alternative options (schema extension / multi-row-per-seat-round) add substantial implementation surface and should be a separate spec if pursued.

### Seat-join validation rules
- Rule engages from the moment round-1 cards are first dealt.
- User with no prior `player_rounds` row in this game → unrestricted.
- Previously at seat S, claims S: allowed; bot at S gets displaced.
- Previously at seat S, S held by human B: blocked, payload includes B's name.
- Previously at seat S, claims different seat T: blocked with *"already seen seat S's cards"*; offer varies based on S's current occupant.
- Queue processing: silently skip ineligible spectators (no offer), preserve spectator order.
- Free-for-all (queue exhausted): ineligible user sees specific dialog text.

### Grace period
- 1 minute, applies only to involuntary disconnections (network, WS drop, crash, server restart).
- Does NOT apply to voluntary Leave or kick — seat released immediately.
- If grace period elapses and someone else claims the seat, returning user goes through normal queue/spectator flow, still subject to reclaim rules.
- **Direction**: align existing code to this spec (not the other way around) if current behavior differs.

### Historical data
- **Full wipe** of game/event/stats tables as part of deployment. Preserved: `users`, `active_games`, `active_rooms`.
- User confirmed no data of value exists in the current database. Simpler than implementing a backfill/rebuild.
- Replaces the plan's original approach of running `rebuildStatsCache()` post-deploy.

### Enforcement levels
- Server-authoritative for seat-join validation; client may pre-filter for UX.
- Rule applies uniformly across lobby-join, queue-promotion, and post-kick rejoin paths.
- Defensive: validation correctly handles auto-reconnect case even if that path routes through it.

---

## Clarifications & Trade-offs

### E1 — Queue processing nuance
User introduced the "go ahead of me" model: during ordered queue, ineligible spectators are silently skipped (no offer, no dialog). During free-for-all, ineligible users who actively try get a dialog explaining the rejection. Balances UX noise against informativeness.

### E3 — DB wipe vs. rebuild
Selected full wipe over historical rebuild. User stated "no data of value" currently in the database. Simplifies the deployment step: no one-shot rebuild script, no perf risk, no edge cases around pre-fix dirty data.

### E5 — "Player" definition refined
Initially user said "at least 1 card in hand" is the rule. On reflection, clarified: a user does not become a player based on a seat-takeover with no cards in play — they become one when cards next enter their possession (the deal at round start). This narrowing aligns with `player_rounds` semantics (written at deal, finalized at round end), which is why Option A for Finding 1 works.

### F1 — Data-capture gap finding
Mid-round takeovers aren't captured in `player_rounds`. Three options presented:
- A: Accept gap, align stats + validation on the same practical signal (chosen).
- B: New schema table for seat sessions.
- C: Allow multiple rows per `(game, round, seat)` at deal/takeover time.

Option A selected to keep this bugfix scoped.

### Risk mitigations (Phase 5)
- R5 (grace-period divergence): resolved by user choosing to align code to spec.
- R4 (queue silent skip): server log sufficient; no UX change.

---

## Final Statistics

- **~25 functional requirements** (SA01–SA15, SJ01–SJ13)
- **8 non-functional requirements** (NF-SA01–SA05, NF-SJ01–SJ03)
- **5 assumptions** (A1–A5)
- **8 identified risks** with mitigations
- **3 deferred-to-planning investigation items**: grace-period current behavior, `bomb_events` attribution, WS rejection message shape
- **Confidence**: High

---

## Full Conversation

> _Included in git history via the conversation transcript commit. Summary above captures the decision-relevant content. Full verbatim conversation is not reproduced here to keep the transcript scannable — see the session log in the branch commit history if verbatim context is needed later._

### Turn-by-turn summary

1. **User** invoked `/diligent-developer` on `main` with uncommitted settings.json changes and leftover plan/spec files from the completed stats redesign.
2. **Claude** scoped the task, proposed a two-branch approach (chore cleanup → feature branch), and got approval.
3. **Cleanup**: created `chore/workspace-cleanup`, removed stale stats-redesign plan/spec files, committed settings.json permission additions, fast-forward merged to main. Created `bugfix/stats-attribution-midgame` from updated main. Copied source plan into `plans/2026-04-20-stats-attribution-midgame.md`.
4. **Claude** invoked `/spec-builder` with source-plan context.
5. **Phase 1** (goal capture): grounded the spec in actual code (`computeStatsForUser`, `player_rounds` schema, `stats-cache.ts`). Restated three bugs and the user-approved policy. Asked four open clarifying questions.
6. **User answers**: (1) manual one-shot DB rebuild post-deploy → later replaced by full wipe; (2) mixed-team case impossible; (3) populate `gamesJoinedAfterSpectating`; (4) populate `gamesForfeited`.
7. **Claude** probed existing column semantics — both counters declared in schema but zero-filled. Proposed definitions; flagged naming ambiguity on `gamesJoinedAfterSpectating`; got user-clarified definition (first-ever presence in game + round > 1).
8. **User** then added the major requirement: **block a user from occupying two different seats within the same game** — enforcement at room layer, not just stats layer. Introduced spectator-queue and reclaim rules.
9. **Claude** scanned `room-handler.ts` to ground the new requirements, drafted SJ01–SJ07, flagged A2 upgrade from product-rule to enforced-invariant, posed six edge-case questions (E1–E6).
10. **User answers**: detailed queue "go ahead of me" model, confirmed DB wipe preferred, clarified player definition, specified grace-period exclusions for voluntary leave and kick.
11. **Claude** iterated: added queue skip/order-preservation requirements, grace-period exclusions, reworded free-for-all dialog. Asked about per-game-reset (confirmed). Added player definition clarification.
12. **Phase 4** (improvement): scanned `player_rounds` persistence, discovered intra-round takeovers not captured. Presented three resolution options; user chose Option A. Confirmed spectator-hand assumption. Applied six refinements.
13. **Phase 5** (risk): enumerated 8 risks with mitigations. User accepted, chose code-aligns-to-spec for grace period, server-log for queue-skip telemetry.
14. **Phase 6** (metrics): laid out acceptance criteria table per requirement. User approved.
15. **Phase 7** (finalization): confidence = High. User confirmed and requested serialization.

---

**End of specification phase. Next: Phase 1.3 commit gate, context clear, then Phase 1.4 implementation planning.**
