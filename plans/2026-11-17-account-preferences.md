# Account preferences implementation

1. Shared preferences schema and SQLite authenticated GET/PUT endpoints (UP01). Validate defaults, authorization, invalid payloads, account isolation, persistence, and CORS.
2. Saved account store, responsive Save/Cancel dialog, previews, menu integration, and sound gating (UP02, UP03, UP07, NF-UP01). Test drafts, errors, dismissal, stale requests, and category controls.
3. Shared card display sorting/stacking, exposed-edge labels, and full-house exception across hand/trick/bomb previews (UP04–UP06). Test four combinations, Phoenix membership, card identity/focus, and responsive rendering. Run workspace tests, typecheck, build, and targeted coverage; update docs and RTM.

No new dependencies. Use current Fastify/Drizzle/Zod/React/Zustand/CSS Modules conventions. Do not change gameplay rules, shared timing, or seat associations.

## Approved follow-up, 2026-11-18

Center rank/suit in a shared 1.5-font-size corner block with equal 4.5% edge insets (UP08). Remove the full-house preferences preview/caption/sample, retaining one live hand (UP09). Update card/dialog and browser verification; compare both sides at preview, hand, trick, and compact bomb sizes. Existing preferences, API, and gameplay full-house rules remain unchanged.
