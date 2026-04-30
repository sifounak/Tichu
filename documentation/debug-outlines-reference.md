# Debug Outlines Reference

Toggle with **Ctrl+Shift+D** in the browser.

| Area | Color | Hex | Location |
|---|---|---|---|
| **Game Table** | Red | `#ff6b6b` | The main table grid |
| **Partner Seat** | Teal | `#4ecdc4` | Top seat (your partner) |
| **Left Opponent** | Blue | `#45b7d1` | Left seat |
| **Right Opponent** | Green | `#96ceb4` | Right seat |
| **Center / Trick** | Yellow | `#ffd93d` | Trick display area |
| **Bottom Seat** | Lavender | `#c9b1ff` | Bottom seat area |
| **Control Panel** | Pink | `#ff9ff3` | Top-left room code/controls (desktop) |
| **Score Panel** | Gold | `#feca57` | Top-right scores (desktop) |
| **Mobile Chrome** | Pink | `#ff9ff3` | Top bar (mobile) |
| **Bottom Panel** | Orange-red | `#ff6348` | Entire fixed bottom section |
| **Pre-Game Phase** | Light green | `#7bed9f` | Grand Tichu / card passing UI |
| **Action Bar** | Blue | `#70a1ff` | Play/Pass/Tichu buttons |
| **Card Hand Row** | Orange | `#ffa502` | Cards + Tichu/Bomb buttons |
| **Server Banner** | Dark orange | `#ee5a24` | Server restart notification |

## Implementation

- CSS: `globals.css` — rules under `html.debug-outlines`
- Toggle component: `src/components/DebugOutlines.tsx`
- Data attributes: `data-debug-area="..."` on elements in `page.tsx` and `GameTable.tsx`
