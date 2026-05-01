# Responsive Layout Redesign — Working Notes

## Status: In Progress (Uncommitted)

All changes are uncommitted on the `main` branch. 18 files modified, 1 new file (`useLayoutTier.ts`). Typecheck and all 217 tests pass. No work has been committed yet for this feature.

## What Was Built

A three-tier responsive layout system for the game screen:

| Tier | Width | Behavior |
|------|-------|----------|
| Full | >1100px | Original grid layout, unchanged |
| Compact | 700–1100px | Flexbox column, chrome row, staggered opponents |
| Mobile | <700px | Same as compact, tighter spacing, smaller cards |

### Core Architecture

1. **`useLayoutTier.ts`** (NEW) — Returns `'full' | 'compact' | 'mobile'`, sets `data-layout` attribute on `:root` via `matchMedia` listeners.

2. **`useScaleFactor.ts`** (MODIFIED) — "Fixed then scale" approach:
   - Full: `min(width, height) / 1200` (unchanged)
   - Compact: stays at `--scale: 1.0` until width < 850px, then `width/850`
   - Mobile: stays at `--scale: 1.0` until width < 550px, then `width/550`
   - Elements stay full-size while flexbox compresses whitespace; scaling only when needed.

3. **CSS selectors** — All `@media (max-width: 640px)` replaced with `:root[data-layout="compact"]` / `:root[data-layout="mobile"]` selectors across all component CSS files.

### Key Layout Changes (Compact/Mobile)

- **GameTable**: flexbox column (partner → opponents row → trick area → bottom spacer) instead of CSS Grid + absolute positioning. Opponents row uses `justify-content: space-between` with negative `margin-top` so opponent centerlines align with partner box bottom.
- **Chrome row**: fixed top bar with room info (left) + chat bubble + compact score (right). Chat auto-collapses when transitioning from full to compact.
- **ScorePanel**: compact mode shows "You: #" / "Them: #" on two lines (left-aligned labels, right-aligned scores). Mobile shows single line "You: 0 | Them: 0" with centered pipe separator.
- **ChatPanel**: compact mode uses inline bubble button + centered overlay modal instead of fixed side panel.
- **ActionBar**: compact mode shows just Pass/AutoPass + Play slots (fixed-width, no reflow). Tichu and Bomb are floating buttons beside the card hand.
- **Card hand**: flex row `[Tichu btn] [cards] [Bomb btn]` where buttons are `flex-shrink: 0` and cards fill the center. `CardHand.tsx` has auto-scale via ResizeObserver — measures natural width at `transform: none`, applies `transform: scale()` when cards exceed container.
- **Card sizes**: `-lg` tokens reduced to match compact (105x150px). Wide and compact use same card size; mobile uses smaller (85x122px).
- **Player Tichu banner**: shown between action bar and cards in compact mode (width matches player seat boxes).

### Files Changed (18 modified + 1 new)

**New:**
- `code/packages/client/src/hooks/useLayoutTier.ts`

**Modified:**
- `code/packages/client/src/app/game/[gameId]/page.tsx` — main integration: useLayoutTier, chrome row, conditional rendering, card hand flex row
- `code/packages/client/src/app/globals.css` — card size tokens (lg reduced, compact/mobile added)
- `code/packages/client/src/components/cards/CardHand.tsx` — ResizeObserver auto-scale, wrapper div
- `code/packages/client/src/components/cards/CardHand.module.css` — handWrapper, data-layout selectors
- `code/packages/client/src/components/cards/PhoenixValuePicker.module.css` — data-layout selectors
- `code/packages/client/src/components/game/ActionBar.tsx` — compact layout (2 slots), layoutTier prop
- `code/packages/client/src/components/game/ActionBar.module.css` — compactLayout, buttonSlot, sizing
- `code/packages/client/src/components/game/ChatPanel.tsx` — compact prop, "Allow Spectators" text
- `code/packages/client/src/components/game/ChatPanel.module.css` — compactToggleButton, compactPanel, send button scaling
- `code/packages/client/src/components/game/GameTable.tsx` — layoutTier prop, opponentsRow wrapper
- `code/packages/client/src/components/game/GameTable.module.css` — compact/mobile flexbox layout
- `code/packages/client/src/components/game/PlayerSeat.module.css` — data-layout selectors
- `code/packages/client/src/components/game/ScorePanel.tsx` — compact prop
- `code/packages/client/src/components/game/ScorePanel.module.css` — compactPanel, mobile single-line
- `code/packages/client/src/components/game/VoteOverlay.module.css` — data-layout selectors
- `code/packages/client/src/components/game/WishPicker.module.css` — data-layout selectors
- `code/packages/client/src/hooks/useScaleFactor.ts` — tier-aware "fixed then scale" formula
- `code/packages/client/tests/setup.ts` — ResizeObserver mock for jsdom

### Design Spec & Plan

- Spec: `docs/superpowers/specs/2026-04-28-responsive-layout-redesign-design.md`
- Plan: `C:\Users\asifouna\.claude\plans\snazzy-wishing-koala.md`

## What Remains / Known Issues to Check

1. **Visual testing** — Need thorough manual testing at >1100px, ~900px, ~750px, ~600px, ~500px widths across all game phases (grand tichu, card passing, playing, round scoring, game over).
2. **Card auto-scale edge cases** — The ResizeObserver auto-scale in CardHand.tsx temporarily resets transform to measure natural width. Verify no visual flicker during resize.
3. **Floating button overlap** — Tichu/Bomb buttons are now flex siblings (not absolute). Verify they don't overlap cards at very narrow widths where the hand auto-scales aggressively.
4. **Spectator layout** — Compass layout for spectators in compact/mobile needs testing.
5. **Pre-game phases** — Card passing UI, Grand Tichu decision in compact mode.
6. **Overlays** — Phoenix picker, Wish picker, Vote overlay all use data-layout selectors now. Verify at compact/mobile.
7. **No commits yet** — All work is uncommitted. Needs to be committed when ready.
