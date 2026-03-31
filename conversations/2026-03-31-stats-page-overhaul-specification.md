# Stats Page Overhaul — Specification Conversation

## Summary

**Goal:** Overhaul the `/stats` page with restructured sections, new stats, Card Stats tab, and History tab redesign.

**Key Decisions:**
- 4-column grids for all Overview sections
- Display "-" instead of "N/A" for missing values
- Remove "Special" section, redistribute stats to Game Record, Round Record, Tichu Record
- Fix `firstFinishes` to count ALL 1st-place finishes (not just Tichu callers) — requires adding `finishOrder` to `RoundScore`
- "Tie-break" = both teams hit target score simultaneously, requiring extra rounds
- "Games Joined After Spectating" — implement tracking now via `GameManager.markJoinedAfterSpectating()` called from room-handler `onSeatClaimed`
- Wire up Card Stats tab with lifetime Group C stats (already in DB, just not exposed via API)
- History tab redesigned as table with player-relative data (Win/Loss, Your Score, Opp Score, Team Tichu, Partner/Opponent names)
- Server-side JOIN for Tichu summaries in history to avoid N+1

**Requirements:** 29 functional (REQ-F-SO01–SO29), 3 non-functional (REQ-NF-SO01–SO03)
**Confidence:** High
**Spec file:** `specifications/2026-03-31-stats-page-overhaul.md`

## Conversation

User requested stats page changes including:
- 4-column grids for all sections
- "-" instead of "N/A" for missing values
- Game Record: 11 stats (added Games Lost, Tie Break stats, Games Joined After Spectating)
- Round Record: 12 stats (added Rounds Lost, Finished 1st/Last with rates, 1-2 rates)
- Tichu Record: 14 stats (added Failed counts, Broken by Partner stats)
- Remove Special section
- Card Stats: wire up lifetime Group C stats
- History: table with Date, Win/Loss, Scores, Rounds, Team Tichu/GT, Partner/Opponent names

Clarifying questions asked and answered:
1. Tie-break definition → Yes, count games where both teams at/above target requiring extra rounds
2. Games Joined After Spectating → Implement tracking now (not deferred)
3. Finished 1st → Count ALL 1st-place finishes, not just Tichu callers
4. Card Stats → Wire up now, expose Group C via API

Spec written with 29 FR + 3 NFR, confidence High. User approved without changes.
