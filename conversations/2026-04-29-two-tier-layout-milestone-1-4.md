# Two-Tier Layout — Implementation (Milestones 1–4)

**Date:** 2026-04-29
**Phase:** Implementation (Phase 2)

## Summary

All 4 milestones implemented in a single pass:

### Milestone 1: Core Hooks
- `useLayoutTier.ts`: Changed to `'full' | 'mobile'`, breakpoint at 900px, single matchMedia listener
- `useScaleFactor.ts`: Removed compact config, updated mobile config (ref: 900, scaleBelow: 700)

### Milestone 2: CSS Modules
- `GameTable.module.css`: Deleted compact section (lines 118–158), kept mobile
- `PlayerSeat.module.css`: Deleted compact rules, mobile already covered all
- `ActionBar.module.css`: Renamed `.compactLayout` → `.mobileLayout`, merged mobile overrides
- `CardHand.module.css`: Deleted compact rules
- `VoteOverlay.module.css`: Removed compact selector from joint rule
- `ChatPanel.module.css`: Renamed `.compactToggleButton/.compactBackdrop/.compactPanel` → `.mobile*`
- `ScorePanel.module.css`, `WishPicker.module.css`, `PhoenixValuePicker.module.css`: No changes needed

### Milestone 3: Components & Page
- `page.tsx`: Renamed `isCompactLayout` → `isMobileLayout`, ChatPanel `compact` → `mobile` prop, updated comments
- `GameTable.tsx`: Renamed `isCompact` → `isMobile`
- `ActionBar.tsx`: Renamed `isCompact` → `isMobile`, `compactLayout` → `mobileLayout`
- `PreRoomView.tsx`: Renamed `isCompactLayout` → `isMobileLayout`
- `ChatPanel.tsx`: Renamed `compact` prop → `mobile`, updated CSS class references

### Milestone 4: Global CSS Variables
- `globals.css`: Deleted compact card variant variables (were identical to lg variants)

## Verification
- `pnpm typecheck`: Passed (0 errors)
- `pnpm test`: Passed (all 4 tasks successful)
- No layout-tier `compact` references remain (ScorePanel `.compact*` class names are display variants, not tier)
- Visual testing: Pending (REQ-NF-L01, L02, L03)
