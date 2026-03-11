# Milestone 11: Client Foundation

**Package(s):** client
**Requirements:** Next.js app, game board layout, card rendering, WebSocket connection

## Goal

Build the client foundation: page routing, WebSocket hook, Zustand stores, card component, and the game table layout. No gameplay interaction yet — just rendering state.

## Tasks

### 11.1 Page structure (`packages/client/src/app/`)
- `layout.tsx` — root layout with providers (theme, WebSocket context)
- `page.tsx` — landing page (placeholder)
- `lobby/page.tsx` — lobby placeholder
- `lobby/[roomId]/page.tsx` — room waiting area placeholder
- `game/[gameId]/page.tsx` — main game view
- `game/[gameId]/layout.tsx` — WebSocket connection scoped to game

### 11.2 WebSocket hook (`packages/client/src/hooks/useWebSocket.ts`)
- Connect to server, handle reconnection with exponential backoff
- Parse incoming messages (Zod validation)
- Send typed messages
- Connection status indicator

### 11.3 Zustand stores
- `gameStore.ts` — authoritative game state from server (phase, players, trick, scores, hand)
- `uiStore.ts` — client-only state (selected cards, animation queue, settings)

### 11.4 Card component (`packages/client/src/components/cards/Card.tsx`)
- Render card face: suit symbol, rank, color
- Card back design
- States: normal, selected (lifted), disabled (greyed), face-down
- Responsive sizing via CSS custom properties

### 11.5 Game table layout (`packages/client/src/components/game/GameTable.tsx`)
- CSS Grid: 4 player seats + center trick area
- Desktop: landscape (partner top, opponents left/right, player bottom)
- Mobile: portrait stack
- `PlayerSeat.tsx` — avatar, card count, Tichu indicator, pass status

### 11.6 Design tokens (`packages/client/src/styles/tokens.css`)
- Colors: felt-green, card-white, suit colors, special card colors
- Spacing: card dimensions, overlap values
- Typography: display font, card font
- Shadows and animations

### 11.7 Player hand (`packages/client/src/components/cards/CardHand.tsx`)
- Fan layout of cards
- Card overlap (desktop vs mobile)
- Sorting: by suit, then rank

## Tests

- Card component renders all 56 cards correctly
- Game table layout renders at desktop and mobile breakpoints
- WebSocket hook: connect, disconnect, reconnect, message parsing
- Zustand store: state updates from server messages

## Verification

1. `pnpm turbo build --filter=@tichu/client` succeeds
2. Dev server starts and renders game table with placeholder data
3. Card component visual test: all suits, ranks, special cards
4. Responsive: table layout correct at 640px and 1024px
