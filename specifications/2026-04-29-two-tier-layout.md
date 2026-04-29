# Two-Tier Layout Consolidation

**Date:** 2026-04-29
**Type:** Refactoring / Simplification
**Status:** Approved

## Goal

Consolidate the 3-tier responsive layout system (full >1100px / compact 700–1100px / mobile <700px) into a 2-tier system (full ≥900px / mobile <900px). Remove the intermediate "compact" tier entirely. Simplify the codebase and establish a clean foundation for future layout tuning.

## Requirements

### Functional Requirements

| ID | Requirement | Acceptance Criteria |
|----|------------|-------------------|
| REQ-F-L01 | Replace `LayoutTier` type from `'full' \| 'compact' \| 'mobile'` to `'full' \| 'mobile'` | Type exported, no `compact` references in LayoutTier |
| REQ-F-L02 | Set breakpoint at 900px: full ≥900px, mobile <900px | `useLayoutTier()` returns `'full'` at 900px, `'mobile'` at 899px |
| REQ-F-L03 | Full layout uses current full-tier CSS grid (partner top-center, opponents left/right absolute) | Grid layout renders at 900px+ widths |
| REQ-F-L04 | Mobile layout uses current mobile-tier flexbox column as base | Flexbox column layout renders at <900px |
| REQ-F-L05 | Full layout always uses large card sizes (`--card-width-lg`, `--card-height-lg`) | No card size switching in full tier |
| REQ-F-L06 | Mobile layout uses mobile card sizes (`--card-width-mobile`, etc.) | Mobile cards use smaller dimensions |
| REQ-F-L07 | Chat auto-collapses only on full→mobile transition | Chat stays open during full-tier resizing; collapses when crossing below 900px |
| REQ-F-L08 | Remove all CSS rules targeting `data-layout="compact"` | No `:root[data-layout="compact"]` selectors remain in any CSS file |
| REQ-F-L09 | Remove `compact` tier from `useScaleFactor` `TIER_CONFIG` | Only `full` and `mobile` configs exist |
| REQ-F-L10 | Update `useScaleFactor` mobile config for new breakpoint | Mobile scaling behavior preserved or improved |
| REQ-F-L11 | Rename all JS `isCompactLayout` / `isCompact` to `isMobileLayout` / `isMobile` | Semantic naming matches new 2-tier model |

### Non-Functional Requirements

| ID | Requirement | Acceptance Criteria |
|----|------------|-------------------|
| REQ-NF-L01 | No visual regression in full layout at ≥1100px | Existing full layout looks identical to before |
| REQ-NF-L02 | No visual regression in mobile layout at <700px | Existing mobile layout looks identical to before |
| REQ-NF-L03 | Full layout is usable (not broken) at 900–1100px range | Grid layout renders reasonably — may need future tuning but must not break |
| REQ-NF-L04 | Type-check passes (`pnpm typecheck`) | Zero type errors |
| REQ-NF-L05 | All existing tests pass | `pnpm test` green |

## Scope

### In Scope

**Hook files (2):**
- `useLayoutTier.ts` — remove compact tier, change breakpoint to 900px
- `useScaleFactor.ts` — remove compact config, adjust mobile config

**CSS module files (8):**
- `GameTable.module.css` — remove `:root[data-layout="compact"]` rules, keep mobile rules
- `PlayerSeat.module.css` — fold compact rules into mobile rules (no mobile overrides exist)
- `ActionBar.module.css` — remove compact references, keep mobile rules
- `CardHand.module.css` — fold compact rules into mobile rules
- `ScorePanel.module.css` — keep mobile rules as-is
- `VoteOverlay.module.css` — fold compact rules into mobile rules
- `WishPicker.module.css` — fold compact rules into mobile rules
- `PhoenixValuePicker.module.css` — fold compact rules into mobile rules

**Component/page files (4):**
- `page.tsx` — rename `isCompactLayout` → `isMobileLayout`, update chat auto-collapse
- `GameTable.tsx` — rename `isCompact` → `isMobile`
- `ActionBar.tsx` — rename `isCompact` → `isMobile`
- `PreRoomView.tsx` — rename `isCompactLayout` → `isMobileLayout`

**Global CSS (1):**
- `globals.css` — remove compact-only CSS variables if any exist

### Out of Scope (Future Iteration)

- Tuning mobile layout spacing/dimensions
- Tuning `--scale` behavior (acknowledged as needing rework)
- Redesigning the full layout grid for the 900–1100px range
- Adding new breakpoints or layout modes

## CSS Compact→Mobile Folding Strategy

When removing `:root[data-layout="compact"]` rules, each must be handled:

1. **If mobile already overrides the compact rule:** Delete the compact rule (mobile rule covers it)
2. **If mobile does NOT override the compact rule:** Move the compact rule to target `data-layout="mobile"` instead (the mobile layout was inheriting this behavior via the compact tier)

This ensures mobile layout retains all visual behavior it had before.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Full grid layout looks cramped at 900–1100px | High | Medium | Accepted — REQ-NF-L03 says "usable, not perfect"; future iteration will tune |
| CSS compact rules had mobile fallthrough | Medium | Medium | Fold compact-only rules into mobile selectors per strategy above |
| Scale factor behavior changes at 900–1100px | Medium | Low | Full tier uses proportional scaling from existing config; test visually |

## Success Metrics

- Zero `:root[data-layout="compact"]` selectors in codebase
- Zero references to `'compact'` in TypeScript layout code
- `pnpm typecheck` passes
- `pnpm test` passes
- Visual spot-check at 500px, 899px, 900px, 1200px widths

## Confidence: High

Scope is finite (15 files), transformation is mechanical, and the main risk (900–1100px range) is explicitly deferred to future iteration.
