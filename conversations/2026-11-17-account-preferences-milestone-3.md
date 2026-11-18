# Card presentation and final verification milestone

Connected saved order/overlap to hands, tricks, and all three bomb-preview layouts. Full houses put the triple at the top end of the selected stack, including Phoenix completing either group. Card IDs, selected state, focused card, and seat-associated passing slots stay stable. Pre-game menus also open Preferences.

Browser testing exposed clipping of Do/Ph in the preview. The exposed strip now retains at least 46% of the card width, and full groups scale to fit. The live dialog uses an opaque panel and visible sound switches. Regression tests cover all four order/overlap combinations and all full-house rank/Phoenix variants.

Validation: 1,864 unique tests passed across the full suites and additional API cases; workspace types pass; targeted client coverage 96.75%, route coverage 100%. Final production build and Chromium checks pass with a temporary Windows junction/hard-link compatibility preload. No build config/dependencies changed. ESLint unavailable; normal standalone packaging is blocked by Windows symlink privileges. One existing bot timing test initially failed under concurrency and subsequently passed both alone and in the full lower-concurrency server suite.

Added user documentation, codebase index entries, completed RTM, coverage archives, desktop/mobile screenshots, and reusable browser smoke check. No guest removal, animation/volume preferences, deployment, or remote publication.
