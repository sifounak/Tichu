# Two-Tier Layout — Specification Conversation

**Date:** 2026-04-29
**Phase:** Specification (Phase 1.2)

## Summary

User wants to consolidate the 3-tier responsive layout system into 2 tiers:
- **Full** (≥900px): Desktop/laptop grid layout with large cards
- **Mobile** (<900px): Narrow flexbox column layout based on current mobile tier

### Key Decisions
- Breakpoint set at 900px (changed from initial 700px suggestion)
- "mobile" is the naming keyword (not "compact")
- Current mobile tier CSS is the base for the new mobile layout
- Compact-only CSS rules that mobile inherited must be folded into mobile selectors
- Chat auto-collapses only on full→mobile transition
- Full layout always uses large card sizes
- Scale factor behavior acknowledged as needing future rework — out of scope
- 900–1100px range may look cramped with full grid — accepted, will iterate

### Clarifying Questions Asked
1. Breakpoint value — user chose 900px (semi-arbitrary, reasonably chosen)
2. Tuning compact/mobile values — will iterate together
3. Full layout range — full applies to everything ≥900px
4. Card sizing — full always uses large, revisit later
5. Chat auto-collapse — only on full→mobile transition
6. Scale behavior — will adjust separately, acknowledged as "funky"

### Files Identified (15 total)
- 2 hooks: useLayoutTier.ts, useScaleFactor.ts
- 8 CSS modules: GameTable, PlayerSeat, ActionBar, CardHand, ScorePanel, VoteOverlay, WishPicker, PhoenixValuePicker
- 4 components: page.tsx, GameTable.tsx, ActionBar.tsx, PreRoomView.tsx
- 1 global CSS: globals.css
