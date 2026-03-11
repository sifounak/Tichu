# Milestone 12: Client Gameplay UI

**Package(s):** client
**Requirements:** Card selection, play/pass, trick display, Tichu calls, Dragon gift, Phoenix picker

## Goal

Implement the interactive gameplay UI: card selection with progressive filtering, play/pass actions, trick display, and all game-phase dialogs.

## Tasks

### 12.1 Card selection hook (`packages/client/src/hooks/useCardSelection.ts`)
- Track selected cards
- Call `@tichu/shared` hand-filter for progressive filtering
- Compute disabled card set on each selection change
- Phoenix resolution: auto-determine or present picker
- Expose `canPlay` boolean for action bar

### 12.2 Card interaction
- Click-to-select: toggle card selection, lift animation
- Drag-and-drop (@dnd-kit): drag selected cards to trick area
- Disabled cards: 0.4 opacity + diagonal pattern, ignore events

### 12.3 Action bar (`packages/client/src/components/game/ActionBar.tsx`)
- Play button (enabled when valid combination selected)
- Pass button (enabled when passing is legal)
- Tichu call button (during appropriate phases)

### 12.4 Phoenix value picker (`packages/client/src/components/cards/PhoenixValuePicker.tsx`)
- Inline popover near Phoenix card
- Shows only valid values from PhoenixResolution
- Auto-dismiss when only one value (no prompt)
- Mobile: bottom sheet instead of popover

### 12.5 Trick display (`packages/client/src/components/game/TrickDisplay.tsx`)
- Center area showing current trick plays
- Cards from each player positioned near their seat
- Current winner highlighted
- Trick completion animation (sweep to winner)

### 12.6 Game phase UIs (`packages/client/src/components/phases/`)
- `PreGamePhase.tsx`: 8-card view → Grand Tichu prompt → 6-card reveal → Regular Tichu → card passing
- `PlayingPhase.tsx`: game table with hand interaction
- `RoundEndPhase.tsx`: score breakdown overlay
- `GameEndPhase.tsx`: final scores

### 12.7 Dragon gift dialog (`packages/client/src/components/game/DragonGiftModal.tsx`)
- Modal: pick which opponent receives the trick
- Only shows active opponents

### 12.8 Mahjong wish indicator
- Display wished rank prominently
- Indicate when wish is active / fulfilled

### 12.9 Score panel (`packages/client/src/components/game/ScorePanel.tsx`)
- Current score per team
- Collapsible history (per-round breakdown)
- Tichu call indicators

## Tests

- Card selection: progressive filtering matches shared engine output
- Phoenix picker: appears only when ambiguous, correct values
- Action bar: play/pass enabled/disabled correctly per state
- Phase transitions: UI updates smoothly between phases
- Dragon gift: correct opponents shown

## Verification

1. Build succeeds
2. Full gameplay flow with mock data: deal → tichu → pass → play → score
3. Responsive: all dialogs work on mobile
4. Accessibility: keyboard navigation through cards, screen reader labels
