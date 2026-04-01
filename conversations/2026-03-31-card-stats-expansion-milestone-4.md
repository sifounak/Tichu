# Card / Hand Stats Expansion — Milestone 4

**Date:** 2026-03-31
**Milestone:** M4: Client UI — Card / Hand Stats Tab Overhaul
**Requirements:** REQ-F-CS01, CS02, CS05, CS09, CS12, CS15, CS18, CS22, CS25, CS26, REQ-NF-CS01, CS03

## What Was Implemented

Full overhaul of the CardStatsTab component in stats/page.tsx:

1. **Tab rename (CS01):** "Card Stats" -> "Card / Hand Stats"
2. **Section reorder (CS02):** Achievements moved to top
3. **Dragon section (CS26):** Reduced to 3 stats: Hands with Dragon, Tricks Won with Dragon, Dragon Win Rate
4. **Phoenix section (CS05):** Expanded to 10 stats — added 6 play type counters + longest straight
5. **Dog section (CS09):** 5 stats — Hands with Dog + 4 control outcomes (partner/opponent/self/stuck)
6. **Bombs section (CS25):** 8 stat cards + Bomb Sizes table (2 rows x 11 columns for sizes 4-14)
7. **Pass Tracking section (CS22):** Table card with 3 rows x 9 columns (Gave/Received x 8 card categories)

## NFR Verification

- REQ-NF-CS01: `git diff game-state-machine.ts` shows zero changes
- REQ-NF-CS03: `tsc --noEmit` passes for all packages

## Test Results

- TypeScript compilation passes for all 3 packages (shared, server, client)
