# In-Game UI/UX Changes Inventory

Complete inventory of all in-game UI/UX improvements found across the commit history, organized chronologically by commit.

---

## Milestone 15: Polish & Animations (`6a69d1c`)

1. **Card deal animation** — staggered spring animation (opacity, y, scale)
2. **Card play exit animation** — opacity, y, scale transitions
3. **Trick display animations** — cards slide in from seat direction, sweep out on collection
4. **Bomb visual effect** — orange glow pulse + card zoom/rotate
5. **Animated score counter** — ease-out cubic number tally (AnimatedScore component)
6. **Tichu banner** — slide-in from top with auto-dismiss
7. **Phase transition animations** — fadeIn + slideUp on round end / game end overlays
8. **Animation speed settings** — configurable multipliers (slow/normal/fast/off)
9. **Felt table background** — radial gradient + SVG noise texture
10. **prefers-reduced-motion support** — disables all transitions globally
11. **Responsive mobile layout** (640px breakpoint) — compact player seats, bottom-sheet panels
12. **Spectator mode** — `/spectate/[gameId]` read-only view
13. **In-game chat** — toggle panel with unread badge, auto-scroll
14. **Disconnect handling UI** — overlay with vote buttons (wait/bot/abandon) + countdown
15. **Accessibility** — roving tabindex for cards, ARIA roles/live regions, WCAG AA contrast, 44px touch targets

## Game UI Improvements (`b30496a`)

16. **Eliminate bot pre-game delays** — immediate scheduling instead of artificial thinking delays
17. **Game table visible during all phases** — pre-game prompts shown in hand area
18. **Opponent card back stacks** with count overlay in PlayerSeat
19. **Pulsing gold glow** for current turn player
20. **Star badge** for trick leader
21. **Human-readable combination labels** (e.g., "Pair of 7s") in trick area
22. **TrickDisplay component** replacing text-only TrickArea

## Loading Feedback (`cb921fb`)

23. **Lobby button loading states** — "Creating..."/"Joining..." with disabled state
24. **Start Game button** — "Starting..." feedback
25. **Grand Tichu / Regular Tichu** — buttons hide after click, show "Waiting for other players..."

## Tichu Flow & Layout Fix (`5d2c0ed`)

26. **Non-blocking Tichu** — optional button during card passing/playing (instead of blocking phase)
27. **East/West swap fix** in lobby D-pad layout
28. **Card sorting** — by rank then suit (instead of suit then rank)
29. **Score panel** moved to top-right corner, removed duplicate score bar
30. **Enlarged opponent card-back display** (40x56px)

## UI Bug Fixes & Features (`10a3bb5`)

31. **Larger player seat panels** — bigger card backs, stack counts, fonts
32. **Stronger active turn border/glow**
33. **"Your Turn" / "Thinking..." turn badge** on player seats
34. **"★ Leading" pill** replacing small star indicator
35. **TrickDisplay shows only latest play** in center
36. **BombButton component** — single-click for 1 bomb, dropdown for multiple, above ActionBar
37. **Tichu button disappears** after first card play (and stays hidden)

## Graphical Polish (`a54f94e`)

38. **Card size increase** — 70x100 -> 80x114px
39. **Player seat dimensions increased** — min-width 160->200px, avatar 52->64px
40. **Disabled cards** — greyscale filter instead of transparent/striped
41. **Card passing triangle slots** — click-card then click-slot workflow
42. **Centered trick cards** in middle of table
43. **Turn/Leading badges** moved above player box (prevent overlap)
44. **Gold glow animation** on leading player's seat
45. **Full words** "Tichu"/"Grand Tichu" replacing abbreviations "T"/"GT"

## Visual Polish v2 (`7ce02b3`)

46. **Trick cards 2x larger** (100x144px)
47. **Trick area centered** via CSS Grid (320px wide)
48. **Player boxes 50% bigger** (300px min-width, 96px avatar)
49. **Blue glow** for current player (replacing previous color)
50. **Card hover fix** — doesn't shift already-selected cards
51. **Gold outline** on selected cards (2px solid)
52. **ScorePanel** — 2-column layout with player names, 300px min-width
53. **Tichu/GT as full-width banners** above/below player box
54. **DragonGiftBanner** component with auto-dismiss

## Card Passing Rework (`bd1f497` on bugfix branch, also stashed)

55. **Horizontal pass slots** — Left | Partner | Right matching table layout (replacing triangle)
56. **Pass Cards button inline** with card fan
57. **Explicit submit** — no more auto-submit on third slot fill

## UX Improvements (`ac324b4`)

58. **Button order swap** — Pass on left, Play on right
59. **Click-to-play trick area** — play cards by clicking center of table
60. **Pre-select cards** during opponents' turns

## Out-of-Turn Bombs (`9a4b91e`)

61. **Bomb interrupt UI** — Bomb! button available even when not your turn
62. **Red pulsing Bomb! button** styling

## Game Summary Dialog & Dog Animation Fix (feature/game-summary-bomb-button-dog-anim)

63. **Game Summary Dialog** — Full redesign of `GameEndPhase`: "You won!" / "You lost!" headline (green/red), 2-column "Your Team" / "Their Team" stat grid (Grand Tichu won/broken, Tichu won/broken, 1-2 Victories, Bombs), final scores, Leave Room + Start New Game buttons
64. **Dog animation timing fix** — Entry (0.25s spring) → 1.0s pause → sweep (0.40s trickSweep); gameplay unblocks only after sweep completes; all timings scale with animation speed setting
65. **Auto-detect Bomb button** — "Bomb!" button appears to the right of the card hand whenever the player holds ≥1 bomb; single bomb plays immediately on click; multiple bombs open a hover popup listing each option (four-of-a-kind or straight-flush with rank range); button disappears when no bombs remain in hand
