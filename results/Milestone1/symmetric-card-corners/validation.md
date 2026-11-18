# Symmetric corners and one hand preview

- 72 card/preferences tests passed, including gameplay full-house stacking regressions.
- Targeted statement coverage: 99.5% (Card: 100%, PreferencesDialog: 99.13%).
- Workspace TypeScript checking passed.
- Client production build passed with a temporary external junction/hard-link preload for Windows standalone packaging. Build configuration and dependencies were not changed. ESLint is unavailable in this checkout; no lint pass is claimed.
- Chromium checks passed on desktop/mobile for one preview, all four order/overlap combinations, centered rank/suit and equal insets at 42, 64, 70, 105, and 131.25 pixel card widths, visible rank/suit labels, Save/Cancel, reload, Escape, pre-game menu access, and a real 14-card hand.
- Browser checks ran against a disposable in-memory server. Existing accounts/games were untouched.
- No API, sound, sorting, stacking, or gameplay rule changes.

[Desktop](desktop.png) · [Mobile](mobile.png)
