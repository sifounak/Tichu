# Milestone 15: Polish — Conversation Transcript

**Date:** 2026-03-11
**Feature:** Tichu Web Game — Polish (animations, responsive, spectator, chat, disconnect UI, accessibility, visual)
**Branch:** feature/tichu-web-game

## Summary

Implemented Milestone 15 (Polish) — the final milestone covering all visual, UX, and accessibility refinements.

### Key Decisions

1. **Framer Motion v12** used for all animations (card deal, play, trick sweep, bomb effect, banner)
2. **Spring physics** for card animations (stiffness 300, damping 25) — natural feel
3. **Animation speed system** with 4 levels (slow 1.5x, normal 1x, fast 0.5x, off) via `useAnimationSettings` hook
4. **`prefers-reduced-motion`** CSS media query disables all transitions globally
5. **Roving tabindex** pattern for keyboard navigation in card hand
6. **WCAG AA** compliance: raised muted text opacity from 0.45 to 0.6
7. **640px mobile breakpoint** for responsive design
8. **Spectator mode** as separate `/spectate/[gameId]` route — read-only view
9. **Chat panel**: desktop 280px side panel, mobile bottom sheet
10. **REQ-F-HV08 (drag-and-drop)** deferred — @dnd-kit not installed, click-to-select sufficient

### What Was Implemented

#### Animations (REQ-NF-P02, REQ-NF-U02)
- Card deal: staggered spring animation (opacity, y, scale)
- Card play: exit animation (opacity, y, scale)
- Trick display: cards slide in from seat direction, sweep out on collection
- Bomb effect: orange glow pulse + card zoom/rotate
- Score tally: animated number counter with ease-out cubic
- Tichu banner: slide-in from top with auto-dismiss
- Phase transitions: fadeIn + slideUp on round end / game end overlays
- `useAnimationSettings` hook: configurable speed with multipliers
- Body background: radial gradient + SVG noise texture for felt effect

#### Responsive Design (REQ-NF-U01, REQ-NF-U06)
- PlayerSeat: compact avatar + card count on mobile
- ScorePanel: collapsed inline on mobile, bottom sheet for history
- PhoenixValuePicker: bottom sheet on mobile
- ChatPanel: bottom sheet on mobile, 280px side panel on desktop
- DisconnectOverlay: 48px vote buttons for touch targets

#### Spectator Mode (REQ-F-MP06)
- `/spectate/[gameId]` route with read-only game view
- No hand display, no action controls
- Spectator badge indicator

#### In-game Chat (REQ-F-MP07)
- ChatPanel component: toggle button with unread badge
- Desktop side panel (280px), mobile bottom sheet
- Auto-scroll on new messages, 500-char max
- UI store extended with chat state

#### Disconnect Handling UI (REQ-F-MP08)
- DisconnectOverlay: modal with vote buttons (wait/bot/abandon)
- Countdown timer display
- Reconnection toast notification
- UI store extended with disconnect state

#### Accessibility (REQ-NF-U03, REQ-NF-U04, REQ-NF-U05)
- Roving tabindex for card hand (ArrowLeft/Right/Up/Down/Home/End)
- ARIA roles: complementary (chat), log (messages), alert (tichu banner), alertdialog (disconnect)
- aria-live regions: polite (trick area, chat), assertive (tichu banner)
- WCAG AA contrast: muted text raised to 0.6 opacity
- Gold outline on selected cards (2px solid)

### Test Results
- 920 total tests passing (374 shared + 346 server + 200 client)
- 39 new M15 tests added
- No regressions

### Bugs Fixed
- `scrollIntoView` not a function in JSDOM — added optional chaining
- Floating point precision in animation duration tests — used `toBeCloseTo`

### Files Changed
- 20 modified files
- 16 new files (components, hooks, tests, spectate route)
