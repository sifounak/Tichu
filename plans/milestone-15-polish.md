# Milestone 15: Polish

**Package(s):** all
**Requirements:** Animations, responsive tuning, spectator mode, chat, disconnect handling

## Goal

Final polish pass: implement all animations, tune responsive layout, add spectator mode, in-game chat, and disconnect handling. Make it gorgeous.

## Tasks

### 15.1 Animations (Framer Motion)
- Card deal: staggered entry from deck (80ms stagger, 300ms each)
- Card play: hand → trick area (250ms)
- Card selection lift: spring animation (150ms)
- Trick sweep: cards slide to winner (400ms)
- Tichu call banner: scale + opacity (500ms, auto-dismiss 2s)
- Score tally: number counter animation (1000ms)
- Invalid play shake: x oscillation (300ms)
- Bomb effect: screen flash + card zoom (600ms)
- Card passing: slide to recipients (400ms)
- Animation speed setting: slow (1.5x), normal (1x), fast (0.5x), off (0ms)
- Respect `prefers-reduced-motion`

### 15.2 Responsive tuning
- Card hand: aggressive overlap on mobile (16px vs 30px desktop)
- Opponent seats: compact view on mobile (avatar + count only)
- Chat: bottom sheet on mobile, side panel on desktop
- Score panel: collapsed on mobile, expandable overlay
- Phoenix picker: bottom sheet on mobile, popover on desktop
- Touch targets: minimum 44x44px on mobile

### 15.3 Spectator mode
- Spectator route: `spectate/[gameId]`
- Read-only game view (no interaction controls)
- See all public state (no hands)
- Spectator count indicator
- Join as spectator from lobby

### 15.4 In-game chat
- Chat panel: send/receive messages
- Show player name + timestamp
- Desktop: side panel (collapsible)
- Mobile: floating icon → bottom sheet

### 15.5 Disconnect handling UI
- Overlay when player disconnects
- Vote buttons: wait / replace with bot / abandon
- Countdown timer for vote
- "Player reconnected" notification

### 15.6 Accessibility final pass
- Keyboard navigation: roving tabindex on cards, tab order
- Screen reader: aria-labels, aria-live regions for trick announcements
- Color contrast: WCAG AA compliance
- Disabled cards: opacity + pattern (not color alone)

### 15.7 Visual polish
- Felt-green table texture (noise SVG)
- Card face: linen texture gradient
- Radial gradient on table (depth effect)
- Gold accent highlights
- Smooth transitions between all game phases

## Tests

- Animation toggle: animations disabled when preference set
- Responsive: visual tests at 640px, 1024px breakpoints
- Spectator: can view game, cannot interact
- Chat: messages delivered to all room members
- Disconnect: vote flow works, bot replacement succeeds
- Accessibility: keyboard-only navigation through full game flow

## Verification

1. All tests pass across all packages
2. E2E: full game flow with animations
3. Lighthouse: accessibility score ≥ 90
4. Manual testing: desktop Chrome/Firefox/Safari + mobile Chrome/Safari
5. Bot smoke test: 100 games still pass after polish changes
