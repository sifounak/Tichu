# Milestone 11: Client Foundation — Conversation Transcript

**Date:** 2026-03-11
**Milestone:** 11 — Client Foundation
**Package:** @tichu/client

## Summary

Built the client foundation for the Tichu web game: page routing, WebSocket hook, Zustand stores, card component system, game table layout, and player hand fan layout.

## Key Decisions

1. **CSS Modules over Tailwind for components** — Used CSS Modules for component-specific styles (Card, CardHand, PlayerSeat, etc.) while keeping Tailwind for page layouts. Design tokens in CSS custom properties for consistency.

2. **Suit symbols** — Used Unicode emoji (🟢, 🏯, ⭐, ⚔️) for suit distinction by symbol rather than color only (REQ-NF-U05).

3. **Card sort order** — Dog (0), Mahjong (1), standard cards by suit then rank (100-179), Phoenix (200), Dragon (201).

4. **WebSocket Zod validation** — Client-side validation using `serverMessageSchema.safeParse()` with console warnings for invalid messages. Type-safe `send()` for client messages.

5. **Zustand stores** — Two stores: `gameStore` (authoritative server state) and `uiStore` (client-only: card selection, animation settings, connection status). The `applyServerMessage` handler uses Partial<GameStore> return type with explicit casts for Zod-inferred types.

6. **Game table seat positioning** — Player always at bottom, partner at top, opponents left/right. `getSeatPositions()` maps actual seats to table positions relative to the player.

7. **Testing setup** — Added Vitest + @testing-library/react + jsdom + @vitejs/plugin-react. Cleanup between tests via afterEach.

## Files Created/Modified

### New files (22):
- `src/hooks/useWebSocket.ts` — WebSocket hook with reconnection and Zod validation
- `src/stores/gameStore.ts` — Game state store
- `src/stores/uiStore.ts` — UI state store
- `src/components/cards/Card.tsx` + `Card.module.css` — Card component
- `src/components/cards/CardHand.tsx` + `CardHand.module.css` — Fan layout
- `src/components/cards/card-utils.ts` — Suit symbols, labels, colors, sorting
- `src/components/cards/index.ts` — Barrel export
- `src/components/game/GameTable.tsx` + `GameTable.module.css` — CSS Grid table
- `src/components/game/PlayerSeat.tsx` + `PlayerSeat.module.css` — Seat component
- `src/components/game/TrickArea.tsx` + `TrickArea.module.css` — Trick display
- `src/components/game/index.ts` — Barrel export
- `src/components/ui/ConnectionStatus.tsx` + `ConnectionStatus.module.css`
- `src/types/css-modules.d.ts` — CSS module type declarations
- `src/app/lobby/page.tsx` — Lobby placeholder
- `src/app/lobby/[roomId]/page.tsx` — Room placeholder
- `src/app/game/[gameId]/page.tsx` — Game view
- `src/app/game/[gameId]/layout.tsx` — Game layout

### Modified files (3):
- `src/app/globals.css` — Enhanced design tokens
- `src/app/layout.tsx` — Added viewport config
- `src/app/page.tsx` — Added Play Now link

### Test files (9):
- `tests/components/cards/Card.test.tsx` — 11 tests
- `tests/components/cards/CardHand.test.tsx` — 8 tests
- `tests/components/cards/card-utils.test.ts` — 13 tests
- `tests/components/game/GameTable.test.tsx` — 6 tests
- `tests/components/game/PlayerSeat.test.tsx` — 9 tests
- `tests/components/game/TrickArea.test.tsx` — 5 tests
- `tests/stores/gameStore.test.ts` — 12 tests
- `tests/stores/uiStore.test.ts` — 10 tests
- `tests/hooks/useWebSocket.test.ts` — 11 tests

## Test Results

- 9 test files, 85 tests — all pass
- 93.38% statement coverage (threshold: 80%)
- All 220 existing server/shared tests continue to pass

## Coverage

| File | Statements | Branch | Functions |
|------|-----------|--------|-----------|
| Card.tsx | 100% | 100% | 100% |
| CardHand.tsx | 100% | 100% | 100% |
| card-utils.ts | 100% | 100% | 100% |
| GameTable.tsx | 100% | 83% | 100% |
| PlayerSeat.tsx | 100% | 100% | 100% |
| TrickArea.tsx | 100% | 100% | 100% |
| useWebSocket.ts | 93% | 91% | 83% |
| gameStore.ts | 90% | 81% | 100% |
| uiStore.ts | 100% | 100% | 100% |
| **Overall** | **93.38%** | **93.83%** | **97.14%** |
