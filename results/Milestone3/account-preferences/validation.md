# Account preferences validation

- Shared suite: 433 tests passed.
- Server suite: 1,065 tests passed; expanded preferences API suite: 12 passed (includes two additional disk-reopen/CORS tests).
- Client suite on final feature behavior: 364 tests passed. Final dialog/card regression rerun: 23 passed.
- Unique verified tests across the workspace: 1,864.
- Targeted client statements: 96.75%; preferences store, controller, preview row, sound hook, and card component: 100% each. Dialog: 99.21%; card hand: 85.45%; card utilities: 97.77%.
- Preferences route statements/branches/functions: 100%.
- Workspace TypeScript checks: passed. Shared and server builds: passed.
- Client production build: compiled, generated pages, and packaged successfully with a temporary, external Windows compatibility preload that replaces denied standalone symlinks with directory junctions or file hard links. No build configuration or dependencies changed. Normal standalone packaging needs Windows symlink support.
- ESLint is not installed in this checkout; Next reports this during its build, so no lint pass is claimed.
- Chromium on the final production build: passed desktop/mobile previews for all four order/overlap combinations, fully exposed identifiers, full-house stacking, Cancel, Save, reload persistence, Escape, pre-game menu access, and real 14-card game-hand readability.
- Browser checks used an isolated in-memory server; existing workspace accounts and games were untouched.
- An existing bot timing test failed once under high full-workspace concurrency, then passed in isolation and in the lower-concurrency full server suite. No bot logic changed.

Screenshots: [desktop](desktop.png), [mobile](mobile.png). Coverage data is archived alongside this report. Browser check: `utilities/check-account-preferences.cjs`.
