# Account preferences

Registered users can choose card order, overlap direction, and sounds from Preferences in the lobby account menu or game menu. Settings follow the account across devices.

The dialog shows a live sample hand and full house. Changes remain previews until Save succeeds; Cancel, X, Escape, and clicking the backdrop discard them. Failed saves keep the draft for retry.

Card order is Low to high or High to low, from left to right. Card overlap is Left cards on top or Right cards on top. The exposed edge shows card identifiers. A full house always places its triple at the top end of the stack, even when this overrides rank order. Passing/received cards stay associated with their players.

Sound enabled is the master switch. Categories are Cards and wagers, Your turn, Timer warning, and Chat. Defaults match current presentation: high to low, right cards on top, all sounds enabled, playback at 70%.

Account-only API: `GET /api/users/me/preferences` returns `{ preferences }`; `PUT` accepts the complete preferences object and returns `{ preferences }`. Bearer authentication is required. SQLite stores one JSON preferences record per account in `user_preferences`. Missing records use shared defaults.

Guest removal, animation controls, volume controls, card sizing, and default chat visibility are separate follow-ups.

## Validation

`utilities/check-account-preferences.cjs` checks live previews, all four sort/overlap combinations, identifier visibility, full houses, Save/Cancel, reload persistence, pre-game access, and a 14-card hand at desktop/mobile sizes. It creates an account and room, so run it against a disposable local server (the implementation was verified with an in-memory SQLite database). It uses an existing Playwright installation; `PLAYWRIGHT_MODULE` and `PLAYWRIGHT_CHROMIUM` can select the module and browser executable. Screenshots are saved under `results/Milestone3/account-preferences/`.
