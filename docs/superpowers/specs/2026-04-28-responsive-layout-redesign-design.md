# Responsive Layout Redesign

## Context

The game screen was designed around a 1200px reference size. At smaller window sizes (laptops, resized windows, tablets, high-DPI scaling), everything scales down uniformly via a `--scale` CSS variable, resulting in small elements surrounded by wasted space. Fixed UI chrome (room code panel, score panel, chat panel) consumes screen real estate without adapting. This redesign makes the game use space more effectively across all window sizes.

## Scope

Changes apply **only to compact and mobile layout tiers**. The full table layout (>1100px) remains untouched.

---

## Design Decisions

### Three Layout Tiers

| Tier | Width | Layout |
|------|-------|--------|
| Full table | >1100px | Current layout, no changes |
| Compact | 700–1100px | Two-row opponent layout (described below) |
| Mobile | <700px | Same structure as compact, scaled smaller |

### Compact/Mobile Layout (top to bottom)

```
┌─────────────────────────────────────┐
│ [Room Info]    [💬] [You:# Them:#]  │  ← Top chrome row
├─────────────────────────────────────┤
│            [Partner]                │  ← Row 1: partner centered
│     [Left Opp]    [Right Opp]      │  ← Row 2: opponents side-by-side
│                                     │
│          ┌─────────────┐            │
│          │  Trick Area  │            │  ← Fills remaining vertical space
│          └─────────────┘            │
│                                     │
│    [Pass] [Tichu] [Bomb] [Play]    │  ← Action bar
│   ┌─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┐  │
│   │ Card Hand                     │  │  ← Card hand
│   └─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┘  │
└─────────────────────────────────────┘
```

Partner gets its own centered row. Opponents sit side-by-side on a separate row below. This avoids overlap issues as the window narrows — the two rows simply shrink independently.

### Top Chrome Row

- **Left**: Room info (room code, player count). Visible when room available; collapses to icon button at mobile sizes.
- **Right**: Chat bubble icon + compact score. Chat bubble sits just left of the score box.
- No overlap between left and right — use `justify-content: space-between` with overflow protection.

### Score Panel (compact/mobile only)

Two-line format when space allows:
```
You: 245
Them: 180
```

Single-line when tight:
```
You: 245 | Them: 180
```

### Chat Panel (compact/mobile only)

- Remove the permanent right-side panel.
- Replace with a chat bubble icon in the top chrome row (left of score).
- Clicking opens chat as a centered overlay/modal.
- Unread message badge on the bubble icon (reuses existing unread count logic).

### Room Info (compact/mobile only)

- Compact tier: show room code inline in top-left, smaller font.
- Mobile tier: collapse to an icon button that opens a dropdown/popover.

### Card Hand Adaptation

At narrower widths, use a **mix of both** tighter overlap and card shrinking:
- Cards shrink somewhat (not as aggressively as pure shrink).
- Overlap increases somewhat (not as aggressively as pure overlap).
- Both scale proportionally with the `--scale` factor.
- Dynamic overflow protection: if 14 cards still can't fit, increase overlap further.

### Action Button Order

Left to right: **Pass, Call Tichu, Bomb, Play**

In compact/mobile, use a linear (non-split) layout — no player seat between buttons. The floating Tichu and Bomb buttons (currently flanking the card hand) are hidden in compact/mobile and consolidated into the action bar row.

---

## Implementation

### Phase 1: Foundation

**New file**: `code/packages/client/src/hooks/useLayoutTier.ts`
- Hook returning `'full' | 'compact' | 'mobile'` based on `window.innerWidth` thresholds (1100px, 700px).
- Sets `data-layout` attribute on `document.documentElement` for CSS targeting.
- Uses `window.matchMedia` listeners.

**Modify**: `code/packages/client/src/hooks/useScaleFactor.ts`
- Adjust scale formula per tier:
  - Full: keep current `min(width, height) / 1200`
  - Compact: `innerWidth / 1100`, clamped [0.5, 1.5]
  - Mobile: `innerWidth / 700`, clamped [0.5, 1.2]

**Modify**: `code/packages/client/src/app/globals.css`
- Add compact/mobile card size tokens (`--card-width-compact`, `--card-height-compact`, `--card-overlap-compact`, etc.).

### Phase 2: GameTable Compact Layout

**Modify**: `code/packages/client/src/components/game/GameTable.tsx`
- Accept `layoutTier` prop.
- Wrap left + right opponent divs in a new `<div className={styles.opponentsRow}>`.
- In full tier: opponents row uses `display: contents` (invisible to layout).
- In compact/mobile: opponents row becomes `display: flex; justify-content: center; gap`.

**Modify**: `code/packages/client/src/components/game/GameTable.module.css`
- Replace `@media (max-width: 640px)` with `:root[data-layout="compact"]` and `:root[data-layout="mobile"]` selectors.
- Compact layout: flexbox column — partner row, opponents row, trick area (flex: 1), bottom spacer.
- Remove absolute positioning for left/right/center in compact/mobile.

### Phase 3: Player Seat Adaptation

**Modify**: `code/packages/client/src/components/game/PlayerSeat.module.css`
- Replace 640px media query with data-layout selectors.
- Compact: reduce min-width, slightly smaller fonts/avatars.
- Mobile: more aggressive — abbreviate names, smaller avatars.

### Phase 4: Score, Chat, Room Info

**Modify**: `code/packages/client/src/components/game/ScorePanel.tsx` + `.module.css`
- Add compact rendering: "You: # / Them: #" format.
- Render as flex child in chrome row instead of fixed-position.

**Modify**: `code/packages/client/src/components/game/ChatPanel.tsx` + `.module.css`
- Compact/mobile: render bubble icon (positioned in chrome row) + overlay modal.
- Keep existing desktop behavior unchanged.

**New file**: `code/packages/client/src/components/game/RoomInfoPanel.tsx`
- Extract room info rendering from page.tsx (lines ~942-1204).
- Compact: inline room code in top-left.
- Mobile: icon button with popover.

### Phase 5: Card Hand

**Modify**: `code/packages/client/src/components/cards/CardHand.module.css`
- Replace 640px media query with data-layout selectors.
- Compact: use intermediate card size + overlap tokens.
- Mobile: use smaller card size + tighter overlap tokens.

**Modify**: `code/packages/client/src/app/game/[gameId]/page.tsx`
- Switch card CSS variable overrides based on layout tier.

### Phase 6: Action Bar

**Modify**: `code/packages/client/src/components/game/ActionBar.tsx`
- Compact/mobile: linear layout with order **Pass, Tichu, Bomb, Play**.
- Restore Tichu/Bomb rendering in compact/mobile action bar.
- Hide floating Tichu/Bomb buttons in page.tsx for compact/mobile tiers.

### Phase 7: Page-Level Integration

**Modify**: `code/packages/client/src/app/game/[gameId]/page.tsx`
- Call `useLayoutTier()`.
- Render top chrome row in compact/mobile (RoomInfoPanel + ChatBubble + ScorePanel).
- Pass `layoutTier` to GameTable and other components.
- Conditionally hide floating Tichu/Bomb buttons in compact/mobile.
- Adjust bottom panel positioning (no side chat panel consuming width).

### Phase 8: Breakpoint Cleanup

Update remaining 640px breakpoints in:
- `PhoenixValuePicker.module.css`
- `WishPicker.module.css`
- `VoteOverlay.module.css`
- `TurnTimer.tsx`

---

## Files Changed

| File | Type | Purpose |
|------|------|---------|
| `hooks/useLayoutTier.ts` | NEW | Layout tier hook |
| `hooks/useScaleFactor.ts` | MODIFY | Tier-aware scale formula |
| `app/globals.css` | MODIFY | Compact/mobile card tokens |
| `game/GameTable.tsx` | MODIFY | Opponents row wrapper, tier prop |
| `game/GameTable.module.css` | MODIFY | Compact/mobile flex layout |
| `game/PlayerSeat.module.css` | MODIFY | Compact/mobile styles |
| `game/ScorePanel.tsx` + `.module.css` | MODIFY | Compact rendering |
| `game/ChatPanel.tsx` + `.module.css` | MODIFY | Bubble icon + overlay modal |
| `game/RoomInfoPanel.tsx` | NEW | Extracted from page.tsx |
| `game/ActionBar.tsx` + `.module.css` | MODIFY | Button reorder, linear layout |
| `cards/CardHand.module.css` | MODIFY | Compact overlap/sizing |
| `app/game/[gameId]/page.tsx` | MODIFY | Tier integration, chrome row |
| Various `.module.css` | MODIFY | Replace 640px breakpoints |

## Edge Cases

- **Tier transitions on resize**: Layout snaps between tiers with no animation (standard responsive behavior). Framer Motion components may briefly show intermediate states — debounce tier switch by ~100ms.
- **Trick area in compact**: Uses `flex: 1` to fill remaining space. Set `min-height: calc(180px * var(--scale))` to prevent over-compression.
- **14-card hand on narrow screens**: Dynamic overlap fallback — if cards overflow container, further increase overlap proportionally.
- **Pre-game card passing**: Card pass UI may need horizontal slot layout in compact to save vertical space.
- **Spectator compass layout**: Still works — compass seat mapping is independent of visual arrangement.

## Verification

1. Start dev server (`bash scripts/dev-start.sh`).
2. Open game at various window sizes and verify:
   - **>1100px**: No visual changes from current behavior.
   - **700–1100px**: Compact two-row layout, top chrome row, chat overlay, linear action bar.
   - **<700px**: Same compact structure, smaller elements, abbreviated names.
3. Resize browser across breakpoints — layout transitions cleanly, no overlap or clipping.
4. Test chat overlay: open/close, unread badge, message sending.
5. Test all game phases: grand tichu decision, card passing, playing, between rounds.
6. Run `pnpm typecheck` and `pnpm test` from `code/`.
