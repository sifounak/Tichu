# Stats Page Overhaul — Milestones 3 & 4

## Summary

**Goal:** Client UI overhaul — Overview restructuring, Card Stats tab, History tab redesign.

**Changes to `code/packages/client/src/app/stats/page.tsx`:**
- Updated `PlayerProfile` interface with 31 new fields (6 new stats + 25 Group C)
- Updated `GameHistoryEntry` interface with userId columns
- Changed container from `max-w-3xl` to `max-w-4xl` for wider layout
- REQ-F-SO21: All grids now use `grid-cols-2 sm:grid-cols-4` (4 columns)
- REQ-F-SO22: `pct()` helper returns "-" instead of "N/A"
- REQ-F-SO23: Game Record section with 11 stats (added Games Lost, Tie Break, Spectating)
- REQ-F-SO24: Round Record section with 12 stats (added Rounds Lost, all finish rates)
- REQ-F-SO25: Tichu Record section with 14 stats (added Failed counts, Broken by Partner)
- REQ-F-SO26: Removed Special section entirely — stats redistributed
- REQ-F-SO27: Card Stats tab with 6 sections (Dragon, Phoenix, Dog, Bombs, Pass Tracking, Achievements)
- REQ-F-SO28: History tab redesigned as table with columns: Date, Result, Your Score, Opp Score, Rounds, Partner, Opponents
- REQ-F-SO29: Player team detection using userId matching against seat positions

**Build:** `next build` passes, /stats page 3.26 kB
**Requirements:** REQ-F-SO21–SO29, REQ-NF-SO03 all Passed
