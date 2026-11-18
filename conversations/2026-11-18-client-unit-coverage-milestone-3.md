# Game and room controls checkpoint

New tests exercise settings/create cancellation, actual menu/drawer states, ready/cancel, bot management, direct kick and kick-vote/force target selection, host transfer, cooldowns, seat offers/queues, votes, autopilot, Tichu/card passing, queued play and layout variants.

Failed regressions exposed repeated seat-offer expiry callbacks in pre-room and in-game spectator overlays, duplicate mobile leave portals, and missing leave dialog semantics/Escape handling. Timers now stop at expiry; desktop chrome unmounts in mobile; leave dialog gains accessible semantics, keyboard cancellation, focus containment/restoration. No product rules changed.

Initial focused critical coverage exceeded all thresholds: ActionBar 96.66% statements/92.64% branches, PreRoomView 91.29%/80.22%, vote/kick/reconnect 100% statements, leave 96.55%/89.47%. Additional target-selection and keyboard assertions expand behavior coverage. Full coverage verification recorded in results.

Combined interaction cases exceeded the default timeout under full-suite coverage contention. Split them into independent scenarios, keeping the timeout unchanged and improving failure isolation.

Assistant: "The room tests found two defects: an expired seat offer calls its decline handler repeatedly, and a mobile back-button request opens two leave dialogs because both layouts are mounted. I’ll fix those, along with the leave dialog’s missing accessibility label and Escape cancellation."
