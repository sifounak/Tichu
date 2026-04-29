# Two-Tier Layout Consolidation — Implementation Plan

**Date:** 2026-04-29
**Spec:** `specifications/2026-04-29-two-tier-layout.md`

## Context

Consolidate 3-tier responsive layout (full/compact/mobile) into 2 tiers: full (≥900px) and mobile (<900px). Remove the intermediate "compact" tier entirely.

## Milestones

### Milestone 1: Core Hooks (2 files)
- `useLayoutTier.ts` — remove compact tier, change breakpoint to 900px
- `useScaleFactor.ts` — remove compact config, adjust mobile config

### Milestone 2: CSS Modules (8 files)
- Delete/fold compact CSS rules into mobile selectors
- Rename `.compactLayout` → `.mobileLayout` in ActionBar
- Rename `.compactToggleButton` etc. → `.mobileToggleButton` in ChatPanel

### Milestone 3: Components & Page (5 files)
- Rename `isCompactLayout` → `isMobileLayout`, `isCompact` → `isMobile`
- Rename ChatPanel `compact` prop → `mobile`
- Update comments

### Milestone 4: Global CSS Variables
- Delete unused compact card variant variables from globals.css

## Verification
1. `pnpm typecheck` — zero errors
2. `pnpm test` — all pass
3. `pnpm build` — builds successfully
4. Visual spot-check at 500px, 899px, 900px, 1200px
