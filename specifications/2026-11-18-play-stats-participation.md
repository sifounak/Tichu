# Play statistics repairs and participation filters

Approved by the user on 2026-11-18: implement the plan developed in this conversation.

## Goal and acceptance criteria

| Requirement | Behavior and acceptance criteria |
|---|---|
| REQ-F-PS01 | Capture-compatible Phoenix usage for all six combinations, including singles without substitution metadata; longest ordinary and Phoenix straight; clean/dirty 13-card achievements. |
| REQ-F-PS02 | Exact bomb-pass contribution using recipient hands. One maximal same-suit run and each four-of-a-kind count separately; extensions count. At most two credits per passed card. Received direction rows overlap, but total counts each bomb once. |
| REQ-F-PS03 | Relationships use co-participating rounds; Double Bomb counts plays; Blind Grand broken-call counters participate in totals. Preserve final-occupant win semantics. |
| REQ-F-PS04 | Four views: all, human-only (no actual bot ever), mixed (bot and >=2 distinct humans), solo (bot and exactly one human). Autopilot remains human. |
| REQ-F-PS05 | Persist participation immediately, preserve it through recovery/restart; infer and label older records. |
| REQ-F-PS06 | Filter-aware profile, relationships, history and leaderboard; filter before pagination and ranking. Cache per user/view with calculation version and round/participation invalidation. |
| REQ-F-PS07 | Shared URL selector across stats tabs, profile and leaderboard. Personal default all, leaderboard default human-only. Explain inferred history and overlapping bomb directions. Clarify post-pass/power/lead labels. |
| REQ-NF-PS01 | Regression coverage through gameplay capture/persistence/API, relevant client tests, type checks and lint; document behavior and migration. |

## Boundaries and defaults

Preserve completed-round credit in ongoing games, completion-dependent game results, existing win/forfeit semantics, 13-card achievement definitions and power thresholds. Longest ordinary straight uses CombinationType.Straight. Full bot participation history is unavailable for historical games; inferred classifications are intentionally qualified. Gameplay bomb candidate enumeration must remain unchanged.

## Risks and mitigation

Historical attribution cannot be made exact: preserve inferred provenance. Bot replacements can change the entire game's filter: invalidate every participant's views immediately. Long runs contain many playable subsets: canonicalize only pass-stat inventory. Additive database migrations and versioned disposable caches enable existing-game repair.

## Success and confidence

High confidence: product choices approved; all requirements have observable tests. Corrected fields populate from production-shaped events and all surfaces agree on selected participation.
